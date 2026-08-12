-- Nepal invoice sequence and compliance outbox

create table if not exists public.invoice_sequences (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  fiscal_year text not null,
  branch_code text not null,
  document_type text not null,
  series_code text not null,
  last_number bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, fiscal_year, branch_code, document_type, series_code)
);

create table if not exists public.invoice_compliance_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoice_id text not null,
  idempotency_key text not null,
  payload jsonb not null,
  status text not null default 'pending-adapter',
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz,
  submitted_at timestamptz,
  response_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create index if not exists invoice_compliance_outbox_pending_idx
  on public.invoice_compliance_outbox (workspace_id, status, next_attempt_at, created_at);

alter table public.invoice_sequences enable row level security;
alter table public.invoice_compliance_outbox enable row level security;

create policy invoice_sequences_select_members
on public.invoice_sequences for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy invoice_compliance_outbox_select_members
on public.invoice_compliance_outbox for select
to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.reserve_invoice_number(
  target_workspace uuid,
  fiscal_year text,
  branch_code text,
  document_type text,
  series_code text,
  number_prefix text
)
returns table (invoice_number text, sequence_number bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number bigint;
  safe_prefix text;
  safe_branch text;
  safe_series text;
begin
  if not public.has_workspace_role(target_workspace, array['owner','admin','editor']::public.workspace_role[]) then
    raise exception 'Insufficient workspace permissions';
  end if;

  safe_prefix := upper(regexp_replace(coalesce(number_prefix, ''), '[^A-Za-z0-9]', '', 'g'));
  safe_branch := upper(regexp_replace(coalesce(branch_code, ''), '[^A-Za-z0-9]', '', 'g'));
  safe_series := upper(regexp_replace(coalesce(series_code, ''), '[^A-Za-z0-9]', '', 'g'));

  if safe_prefix = '' or safe_branch = '' or safe_series = '' or trim(coalesce(fiscal_year, '')) = '' then
    raise exception 'Invalid invoice sequence parameters';
  end if;

  insert into public.invoice_sequences (
    workspace_id, fiscal_year, branch_code, document_type, series_code, last_number
  ) values (
    target_workspace, fiscal_year, safe_branch, document_type, safe_series, 1
  )
  on conflict (workspace_id, fiscal_year, branch_code, document_type, series_code)
  do update set last_number = public.invoice_sequences.last_number + 1, updated_at = now()
  returning last_number into next_number;

  return query select
    format('%s-%s-%s-%s-%s', safe_prefix, safe_branch, replace(fiscal_year, '/', '-'), safe_series, lpad(next_number::text, 6, '0')),
    next_number;
end;
$$;

create or replace function public.enqueue_invoice_compliance_payload(
  target_workspace uuid,
  target_invoice_id text,
  target_idempotency_key text,
  target_payload jsonb
)
returns table (outbox_id uuid, outbox_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  resulting_id uuid;
  resulting_status text;
begin
  if not public.has_workspace_role(target_workspace, array['owner','admin','editor']::public.workspace_role[]) then
    raise exception 'Insufficient workspace permissions';
  end if;

  if jsonb_typeof(target_payload) <> 'object' then
    raise exception 'Compliance payload must be a JSON object';
  end if;

  insert into public.invoice_compliance_outbox (
    workspace_id, invoice_id, idempotency_key, payload
  ) values (
    target_workspace, target_invoice_id, target_idempotency_key, target_payload
  )
  on conflict (workspace_id, idempotency_key)
  do update set payload = excluded.payload, updated_at = now()
  returning id, status into resulting_id, resulting_status;

  return query select resulting_id, resulting_status;
end;
$$;

revoke all on function public.reserve_invoice_number(uuid, text, text, text, text, text) from public;
grant execute on function public.reserve_invoice_number(uuid, text, text, text, text, text) to authenticated;
revoke all on function public.enqueue_invoice_compliance_payload(uuid, text, text, jsonb) from public;
grant execute on function public.enqueue_invoice_compliance_payload(uuid, text, text, jsonb) to authenticated;
