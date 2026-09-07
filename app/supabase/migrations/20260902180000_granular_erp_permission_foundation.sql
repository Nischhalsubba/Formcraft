-- Granular ERP permission foundation for Formcraft.
-- Additive by design: this migration does not replace existing ERP RLS yet.
-- It establishes one server-side permission model, owner-controlled grant lifecycle,
-- and scope validation so the later RLS cutover can be provisioned safely.

create table public.erp_permission_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null check (module_key ~ '^[a-z0-9-]{2,64}$'),
  action_key text not null check (action_key ~ '^[a-z][a-z0-9._-]{1,63}$'),
  company_id uuid references public.erp_companies(id) on delete cascade,
  branch_id uuid references public.erp_branches(id) on delete cascade,
  record_id uuid references public.erp_records(id) on delete cascade,
  granted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  constraint erp_permission_grants_expiry_after_creation
    check (expires_at is null or expires_at > created_at),
  constraint erp_permission_grants_revocation_pair
    check ((revoked_at is null and revoked_by is null)
      or (revoked_at is not null and revoked_by is not null)),
  constraint erp_permission_grants_revocation_after_creation
    check (revoked_at is null or revoked_at >= created_at)
);

create index erp_permission_grants_lookup_idx
on public.erp_permission_grants (
  workspace_id,
  user_id,
  module_key,
  action_key,
  company_id,
  branch_id,
  record_id
)
where revoked_at is null;

create unique index erp_permission_grants_active_scope_unique
on public.erp_permission_grants (
  workspace_id,
  user_id,
  module_key,
  action_key,
  company_id,
  branch_id,
  record_id
) nulls not distinct
where revoked_at is null;

create or replace function public.erp_validate_permission_grant_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  scoped_company_workspace uuid;
  scoped_branch_workspace uuid;
  scoped_branch_company uuid;
  scoped_record_workspace uuid;
  scoped_record_module text;
  scoped_record_company uuid;
  scoped_record_branch uuid;
begin
  if not public.is_workspace_member(new.workspace_id, new.user_id) then
    raise exception 'Permission grantee must be a workspace member';
  end if;

  if new.company_id is not null then
    select workspace_id
    into scoped_company_workspace
    from public.erp_companies
    where id = new.company_id;

    if scoped_company_workspace is null then
      raise exception 'Permission company not found';
    end if;
    if scoped_company_workspace <> new.workspace_id then
      raise exception 'Permission company is outside target workspace';
    end if;
  end if;

  if new.branch_id is not null then
    select workspace_id, company_id
    into scoped_branch_workspace, scoped_branch_company
    from public.erp_branches
    where id = new.branch_id;

    if scoped_branch_workspace is null then
      raise exception 'Permission branch not found';
    end if;
    if scoped_branch_workspace <> new.workspace_id then
      raise exception 'Permission branch is outside target workspace';
    end if;
    if new.company_id is not null and scoped_branch_company <> new.company_id then
      raise exception 'Permission branch does not belong to target company';
    end if;
  end if;

  if new.record_id is not null then
    select workspace_id, module_key, company_id, branch_id
    into scoped_record_workspace, scoped_record_module, scoped_record_company, scoped_record_branch
    from public.erp_records
    where id = new.record_id;

    if scoped_record_workspace is null then
      raise exception 'Permission record not found';
    end if;
    if scoped_record_workspace <> new.workspace_id then
      raise exception 'Permission record is outside target workspace';
    end if;
    if scoped_record_module <> new.module_key then
      raise exception 'Permission record module does not match grant module';
    end if;
    if new.company_id is not null and scoped_record_company is distinct from new.company_id then
      raise exception 'Permission record does not belong to target company';
    end if;
    if new.branch_id is not null and scoped_record_branch is distinct from new.branch_id then
      raise exception 'Permission record does not belong to target branch';
    end if;
  end if;

  return new;
end;
$$;

create trigger erp_permission_grants_validate_scope
before insert or update on public.erp_permission_grants
for each row execute function public.erp_validate_permission_grant_scope();

create or replace function public.has_erp_permission(
  target_workspace uuid,
  target_module text,
  target_action text,
  target_company uuid default null,
  target_branch uuid default null,
  target_record uuid default null,
  target_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_user is not null
    and (
      public.has_workspace_role(
        target_workspace,
        array['owner']::public.workspace_role[],
        target_user
      )
      or exists (
        select 1
        from public.erp_permission_grants grant_row
        where grant_row.workspace_id = target_workspace
          and grant_row.user_id = target_user
          and grant_row.module_key = lower(trim(target_module))
          and grant_row.action_key = lower(trim(target_action))
          and grant_row.revoked_at is null
          and (grant_row.expires_at is null or grant_row.expires_at > now())
          and (grant_row.company_id is null or grant_row.company_id = target_company)
          and (grant_row.branch_id is null or grant_row.branch_id = target_branch)
          and (grant_row.record_id is null or grant_row.record_id = target_record)
      )
    );
$$;

create or replace function public.erp_grant_permission(
  target_workspace uuid,
  target_user uuid,
  target_module text,
  target_action text,
  target_company uuid default null,
  target_branch uuid default null,
  target_record uuid default null,
  target_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_module text := lower(trim(coalesce(target_module, '')));
  normalized_action text := lower(trim(coalesce(target_action, '')));
  existing_grant uuid;
  created_grant uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_workspace_role(
    target_workspace,
    array['owner']::public.workspace_role[]
  ) then
    raise exception 'Only workspace owners can manage ERP permissions';
  end if;
  if normalized_module !~ '^[a-z0-9-]{2,64}$' then
    raise exception 'Invalid ERP permission module';
  end if;
  if normalized_action !~ '^[a-z][a-z0-9._-]{1,63}$' then
    raise exception 'Invalid ERP permission action';
  end if;
  if target_expires_at is not null and target_expires_at <= now() then
    raise exception 'ERP permission expiry must be in the future';
  end if;

  select id
  into existing_grant
  from public.erp_permission_grants
  where workspace_id = target_workspace
    and user_id = target_user
    and module_key = normalized_module
    and action_key = normalized_action
    and company_id is not distinct from target_company
    and branch_id is not distinct from target_branch
    and record_id is not distinct from target_record
    and revoked_at is null
  limit 1;

  if existing_grant is not null then
    return existing_grant;
  end if;

  insert into public.erp_permission_grants (
    workspace_id,
    user_id,
    module_key,
    action_key,
    company_id,
    branch_id,
    record_id,
    granted_by,
    expires_at
  ) values (
    target_workspace,
    target_user,
    normalized_module,
    normalized_action,
    target_company,
    target_branch,
    target_record,
    auth.uid(),
    target_expires_at
  )
  returning id into created_grant;

  insert into public.activity_log (
    workspace_id,
    actor_id,
    event_type,
    title,
    detail,
    metadata
  ) values (
    target_workspace,
    auth.uid(),
    'security',
    'ERP permission granted',
    target_user::text,
    jsonb_build_object(
      'grant_id', created_grant,
      'module', normalized_module,
      'action', normalized_action,
      'company_id', target_company,
      'branch_id', target_branch,
      'record_id', target_record,
      'expires_at', target_expires_at
    )
  );

  return created_grant;
end;
$$;

create or replace function public.erp_revoke_permission(target_grant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  grant_row public.erp_permission_grants;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into grant_row
  from public.erp_permission_grants
  where id = target_grant
    and revoked_at is null
  for update;

  if grant_row.id is null then
    raise exception 'Active ERP permission grant not found';
  end if;
  if not public.has_workspace_role(
    grant_row.workspace_id,
    array['owner']::public.workspace_role[]
  ) then
    raise exception 'Only workspace owners can manage ERP permissions';
  end if;

  update public.erp_permission_grants
  set revoked_at = now(),
      revoked_by = auth.uid()
  where id = grant_row.id;

  insert into public.activity_log (
    workspace_id,
    actor_id,
    event_type,
    title,
    detail,
    metadata
  ) values (
    grant_row.workspace_id,
    auth.uid(),
    'security',
    'ERP permission revoked',
    grant_row.user_id::text,
    jsonb_build_object(
      'grant_id', grant_row.id,
      'module', grant_row.module_key,
      'action', grant_row.action_key,
      'company_id', grant_row.company_id,
      'branch_id', grant_row.branch_id,
      'record_id', grant_row.record_id
    )
  );
end;
$$;

alter table public.erp_permission_grants enable row level security;

create policy erp_permission_grants_select_visible
on public.erp_permission_grants for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_workspace_role(
    workspace_id,
    array['owner']::public.workspace_role[]
  )
);

revoke all on table public.erp_permission_grants from anon, authenticated;
grant select on table public.erp_permission_grants to authenticated;

revoke all on function public.has_erp_permission(uuid, text, text, uuid, uuid, uuid, uuid) from public;
revoke all on function public.erp_grant_permission(uuid, uuid, text, text, uuid, uuid, uuid, timestamptz) from public;
revoke all on function public.erp_revoke_permission(uuid) from public;

grant execute on function public.has_erp_permission(uuid, text, text, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.erp_grant_permission(uuid, uuid, text, text, uuid, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.erp_revoke_permission(uuid) to authenticated;
