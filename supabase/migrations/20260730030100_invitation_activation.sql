-- Activate invited users and permit workspace peers to read member profiles.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_workspace uuid;
  invited_role public.workspace_role;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update
  set full_name = excluded.full_name,
      updated_at = now();

  begin
    invited_workspace := nullif(new.raw_user_meta_data ->> 'formcraft_workspace_id', '')::uuid;
    invited_role := coalesce(nullif(new.raw_user_meta_data ->> 'formcraft_workspace_role', '')::public.workspace_role, 'viewer');
  exception
    when others then
      invited_workspace := null;
      invited_role := 'viewer';
  end;

  if invited_workspace is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (invited_workspace, new.id, invited_role)
    on conflict (workspace_id, user_id) do update
    set role = excluded.role;

    update public.workspace_invitations
    set status = 'accepted',
        accepted_at = now()
    where workspace_id = invited_workspace
      and lower(email) = lower(new.email)
      and status = 'pending';

    insert into public.activity_log (workspace_id, actor_id, event_type, title, detail)
    values (invited_workspace, new.id, 'member', 'Invitation accepted', coalesce(new.email, ''));
  end if;

  return new;
end;
$$;

-- Replace the self-only read policy with self + workspace peers.
drop policy if exists profiles_select_self on public.profiles;

create policy profiles_select_self_or_peers
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members peer
      on peer.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid()
      and peer.user_id = profiles.id
  )
);
