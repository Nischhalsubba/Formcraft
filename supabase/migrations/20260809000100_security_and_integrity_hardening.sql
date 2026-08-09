-- Security and integrity hardening for Formcraft.
-- Removes auth-metadata-based membership grants, prevents direct membership mutation,
-- and constrains editor state updates to non-privileged workspace data.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update
  set full_name = excluded.full_name,
      updated_at = now();
  return new;
end;
$$;

-- Direct membership writes from authenticated clients are intentionally disabled.
drop policy if exists members_manage_admins on public.workspace_members;

-- Direct invitation mutation is also disabled. The invite edge function uses the
-- service role after independently authenticating and authorizing the caller.
drop policy if exists invitations_manage_admins on public.workspace_invitations;

-- Editors may write operational state only through update_workspace_state().
-- Owners/admins retain direct update access for backwards compatibility.
drop policy if exists state_update_editors on public.workspace_state;
create policy state_update_admins
on public.workspace_state for update
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create or replace function public.update_workspace_state(
  target_workspace uuid,
  next_data jsonb,
  expected_version bigint
)
returns table (version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role public.workspace_role;
  current_data jsonb;
begin
  select role into requester_role
  from public.workspace_members
  where workspace_id = target_workspace
    and user_id = auth.uid();

  if requester_role is null or requester_role not in ('owner', 'admin', 'editor') then
    raise exception 'Insufficient workspace permissions';
  end if;

  if jsonb_typeof(next_data) <> 'object' then
    raise exception 'Workspace state must be a JSON object';
  end if;

  select data into current_data
  from public.workspace_state
  where workspace_id = target_workspace;

  if requester_role = 'editor' then
    if (next_data -> 'settings') is distinct from (current_data -> 'settings') then
      raise exception 'Editors cannot modify workspace settings';
    end if;
    if (next_data -> 'team') is distinct from (current_data -> 'team') then
      raise exception 'Editors cannot modify workspace membership presentation data';
    end if;
  end if;

  return query
  update public.workspace_state
  set data = next_data,
      version = workspace_state.version + 1,
      updated_by = auth.uid(),
      updated_at = now()
  where workspace_id = target_workspace
    and workspace_state.version = expected_version
  returning workspace_state.version, workspace_state.updated_at;

  if not found then
    raise exception 'Workspace state conflict';
  end if;
end;
$$;

create or replace function public.set_workspace_member_role(
  target_workspace uuid,
  target_user uuid,
  next_role public.workspace_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role public.workspace_role;
  target_role public.workspace_role;
begin
  select role into requester_role
  from public.workspace_members
  where workspace_id = target_workspace and user_id = auth.uid();

  select role into target_role
  from public.workspace_members
  where workspace_id = target_workspace and user_id = target_user;

  if requester_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can manage members';
  end if;
  if target_role is null then
    raise exception 'Workspace member not found';
  end if;
  if target_role = 'owner' then
    raise exception 'Owner role changes require ownership transfer';
  end if;
  if next_role = 'owner' then
    raise exception 'Owner role can only be assigned through ownership transfer';
  end if;

  update public.workspace_members
  set role = next_role
  where workspace_id = target_workspace and user_id = target_user;

  insert into public.activity_log (workspace_id, actor_id, event_type, title, detail, metadata)
  values (
    target_workspace,
    auth.uid(),
    'member',
    'Member role changed',
    target_user::text,
    jsonb_build_object('from', target_role, 'to', next_role)
  );
end;
$$;

create or replace function public.remove_workspace_member(
  target_workspace uuid,
  target_user uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role public.workspace_role;
  target_role public.workspace_role;
begin
  select role into requester_role
  from public.workspace_members
  where workspace_id = target_workspace and user_id = auth.uid();

  select role into target_role
  from public.workspace_members
  where workspace_id = target_workspace and user_id = target_user;

  if requester_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can remove members';
  end if;
  if target_role is null then
    raise exception 'Workspace member not found';
  end if;
  if target_role = 'owner' then
    raise exception 'Workspace owners cannot be removed; transfer ownership first';
  end if;
  if requester_role = 'admin' and target_role = 'admin' and target_user = auth.uid() then
    raise exception 'Admins cannot remove their own membership';
  end if;

  delete from public.workspace_members
  where workspace_id = target_workspace and user_id = target_user;

  insert into public.activity_log (workspace_id, actor_id, event_type, title, detail, metadata)
  values (
    target_workspace,
    auth.uid(),
    'member',
    'Member removed',
    target_user::text,
    jsonb_build_object('former_role', target_role)
  );
end;
$$;

create or replace function public.transfer_workspace_ownership(
  target_workspace uuid,
  next_owner uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_owner uuid;
  next_owner_role public.workspace_role;
begin
  select user_id into current_owner
  from public.workspace_members
  where workspace_id = target_workspace
    and user_id = auth.uid()
    and role = 'owner';

  if current_owner is null then
    raise exception 'Only the current owner can transfer ownership';
  end if;
  if next_owner = current_owner then
    raise exception 'The selected member already owns this workspace';
  end if;

  select role into next_owner_role
  from public.workspace_members
  where workspace_id = target_workspace and user_id = next_owner;

  if next_owner_role is null then
    raise exception 'New owner must already be a workspace member';
  end if;

  update public.workspace_members
  set role = case when user_id = next_owner then 'owner'::public.workspace_role else 'admin'::public.workspace_role end
  where workspace_id = target_workspace
    and user_id in (current_owner, next_owner);

  insert into public.activity_log (workspace_id, actor_id, event_type, title, detail, metadata)
  values (
    target_workspace,
    auth.uid(),
    'member',
    'Workspace ownership transferred',
    next_owner::text,
    jsonb_build_object('previous_owner', current_owner, 'new_owner', next_owner)
  );
end;
$$;

revoke all on function public.set_workspace_member_role(uuid, uuid, public.workspace_role) from public;
revoke all on function public.remove_workspace_member(uuid, uuid) from public;
revoke all on function public.transfer_workspace_ownership(uuid, uuid) from public;
grant execute on function public.set_workspace_member_role(uuid, uuid, public.workspace_role) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.transfer_workspace_ownership(uuid, uuid) to authenticated;
