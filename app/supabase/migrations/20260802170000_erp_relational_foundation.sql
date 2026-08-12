-- Formcraft Nepal ERP relational foundation
-- Generic, tenant-safe records and links for progressive normalization of ERP modules.

create table if not exists public.erp_companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  legal_name text not null default '',
  pan_vat text not null default '',
  currency_code text not null default 'NPR',
  country_code text not null default 'NP',
  timezone text not null default 'Asia/Kathmandu',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.erp_branches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.erp_companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  code text not null check (char_length(trim(code)) between 1 and 24),
  address text not null default '',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, company_id, code)
);

create table if not exists public.erp_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid references public.erp_companies(id) on delete restrict,
  branch_id uuid references public.erp_branches(id) on delete restrict,
  module_key text not null check (module_key ~ '^[a-z0-9-]{2,64}$'),
  record_key text not null,
  title text not null default '',
  status text not null default 'draft',
  owner_id uuid references auth.users(id) on delete set null,
  partner_id uuid,
  product_id uuid,
  project_id uuid,
  source_record_id uuid,
  amount numeric(20,4) not null default 0,
  currency_code text not null default 'NPR',
  record_date date,
  due_date date,
  archived boolean not null default false,
  posted boolean not null default false,
  posted_at timestamptz,
  locked_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erp_records_data_object check (jsonb_typeof(data) = 'object'),
  unique (workspace_id, module_key, record_key)
);

create table if not exists public.erp_record_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_record_id uuid not null references public.erp_records(id) on delete cascade,
  target_record_id uuid not null references public.erp_records(id) on delete cascade,
  link_type text not null default 'related',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (source_record_id, target_record_id, link_type),
  constraint erp_record_links_no_self check (source_record_id <> target_record_id)
);

create table if not exists public.erp_record_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  record_id uuid not null references public.erp_records(id) on delete cascade,
  event_type text not null,
  title text not null,
  detail text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.erp_approval_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  record_id uuid not null references public.erp_records(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0),
  approver_id uuid references auth.users(id) on delete set null,
  required_role public.workspace_role,
  status text not null default 'pending' check (status in ('pending','approved','rejected','skipped','cancelled')),
  decision_note text not null default '',
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (record_id, sequence_no)
);

create table if not exists public.erp_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  module_key text not null,
  rule_key text not null,
  record_id uuid references public.erp_records(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.erp_posting_locks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid references public.erp_companies(id) on delete cascade,
  module_key text not null,
  lock_through date not null,
  reason text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, company_id, module_key)
);

create index if not exists erp_records_workspace_module_idx on public.erp_records(workspace_id, module_key, archived, updated_at desc);
create index if not exists erp_records_partner_idx on public.erp_records(workspace_id, partner_id) where partner_id is not null;
create index if not exists erp_records_product_idx on public.erp_records(workspace_id, product_id) where product_id is not null;
create index if not exists erp_records_project_idx on public.erp_records(workspace_id, project_id) where project_id is not null;
create index if not exists erp_record_links_source_idx on public.erp_record_links(source_record_id);
create index if not exists erp_record_links_target_idx on public.erp_record_links(target_record_id);
create index if not exists erp_record_events_record_idx on public.erp_record_events(record_id, created_at desc);
create index if not exists erp_automation_jobs_queue_idx on public.erp_automation_jobs(status, run_after) where status = 'queued';

create trigger erp_companies_touch_updated_at
before update on public.erp_companies
for each row execute function public.touch_updated_at();

create trigger erp_branches_touch_updated_at
before update on public.erp_branches
for each row execute function public.touch_updated_at();

create trigger erp_records_touch_updated_at
before update on public.erp_records
for each row execute function public.touch_updated_at();

create trigger erp_automation_jobs_touch_updated_at
before update on public.erp_automation_jobs
for each row execute function public.touch_updated_at();

create or replace function public.erp_assert_editable(target_record public.erp_records)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lock_date date;
begin
  if not public.has_workspace_role(target_record.workspace_id, array['owner','admin','editor']::public.workspace_role[]) then
    raise exception 'Insufficient workspace permissions';
  end if;

  if target_record.locked_at is not null then
    raise exception 'Record is locked';
  end if;

  select max(lock_through)
  into lock_date
  from public.erp_posting_locks
  where workspace_id = target_record.workspace_id
    and (company_id is null or company_id = target_record.company_id)
    and module_key = target_record.module_key;

  if lock_date is not null and target_record.record_date is not null and target_record.record_date <= lock_date then
    raise exception 'The posting period is locked';
  end if;
end;
$$;

create or replace function public.erp_upsert_record(
  target_workspace uuid,
  target_record uuid,
  target_module text,
  target_record_key text,
  target_title text,
  target_status text,
  target_company uuid,
  target_branch uuid,
  target_owner uuid,
  target_amount numeric,
  target_currency text,
  target_record_date date,
  target_due_date date,
  next_data jsonb,
  expected_version bigint default null
)
returns public.erp_records
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record public.erp_records;
  saved public.erp_records;
begin
  if not public.has_workspace_role(target_workspace, array['owner','admin','editor']::public.workspace_role[]) then
    raise exception 'Insufficient workspace permissions';
  end if;

  if jsonb_typeof(next_data) <> 'object' then
    raise exception 'ERP record data must be a JSON object';
  end if;

  if target_record is not null then
    select * into current_record
    from public.erp_records
    where id = target_record and workspace_id = target_workspace
    for update;

    if current_record.id is null then
      raise exception 'ERP record not found';
    end if;

    perform public.erp_assert_editable(current_record);

    if expected_version is not null and current_record.version <> expected_version then
      raise exception 'ERP record conflict';
    end if;

    update public.erp_records
    set title = coalesce(target_title, title),
        status = coalesce(target_status, status),
        company_id = target_company,
        branch_id = target_branch,
        owner_id = target_owner,
        amount = coalesce(target_amount, amount),
        currency_code = coalesce(nullif(target_currency, ''), currency_code),
        record_date = target_record_date,
        due_date = target_due_date,
        data = next_data,
        version = version + 1,
        updated_by = auth.uid()
    where id = current_record.id
    returning * into saved;
  else
    insert into public.erp_records (
      workspace_id, company_id, branch_id, module_key, record_key, title, status,
      owner_id, amount, currency_code, record_date, due_date, data, created_by, updated_by
    ) values (
      target_workspace, target_company, target_branch, target_module, target_record_key,
      coalesce(target_title, ''), coalesce(target_status, 'draft'), target_owner,
      coalesce(target_amount, 0), coalesce(nullif(target_currency, ''), 'NPR'),
      target_record_date, target_due_date, next_data, auth.uid(), auth.uid()
    ) returning * into saved;
  end if;

  insert into public.erp_record_events (workspace_id, record_id, event_type, title, actor_id, metadata)
  values (target_workspace, saved.id, case when target_record is null then 'created' else 'updated' end,
          case when target_record is null then 'Record created' else 'Record updated' end,
          auth.uid(), jsonb_build_object('version', saved.version));

  return saved;
end;
$$;

alter table public.erp_companies enable row level security;
alter table public.erp_branches enable row level security;
alter table public.erp_records enable row level security;
alter table public.erp_record_links enable row level security;
alter table public.erp_record_events enable row level security;
alter table public.erp_approval_steps enable row level security;
alter table public.erp_automation_jobs enable row level security;
alter table public.erp_posting_locks enable row level security;

create policy erp_companies_select_members on public.erp_companies for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy erp_companies_manage_editors on public.erp_companies for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy erp_branches_select_members on public.erp_branches for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy erp_branches_manage_editors on public.erp_branches for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy erp_records_select_members on public.erp_records for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy erp_records_insert_editors on public.erp_records for insert to authenticated
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])
  and created_by = auth.uid() and updated_by = auth.uid());
create policy erp_records_update_editors on public.erp_records for update to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[])
  and updated_by = auth.uid());
create policy erp_records_delete_admins on public.erp_records for delete to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy erp_links_select_members on public.erp_record_links for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy erp_links_manage_editors on public.erp_record_links for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]) and created_by = auth.uid());

create policy erp_events_select_members on public.erp_record_events for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy erp_events_insert_members on public.erp_record_events for insert to authenticated
with check (public.is_workspace_member(workspace_id) and actor_id = auth.uid());

create policy erp_approvals_select_members on public.erp_approval_steps for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy erp_approvals_manage_approvers on public.erp_approval_steps for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy erp_jobs_select_admins on public.erp_automation_jobs for select to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));
create policy erp_jobs_manage_admins on public.erp_automation_jobs for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy erp_locks_select_members on public.erp_posting_locks for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy erp_locks_manage_admins on public.erp_posting_locks for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]) and created_by = auth.uid());

revoke all on function public.erp_upsert_record(uuid, uuid, text, text, text, text, uuid, uuid, uuid, numeric, text, date, date, jsonb, bigint) from public;
grant execute on function public.erp_upsert_record(uuid, uuid, text, text, text, text, uuid, uuid, uuid, numeric, text, date, date, jsonb, bigint) to authenticated;
