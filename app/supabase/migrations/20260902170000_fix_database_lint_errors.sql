-- Repair database-lint errors surfaced by the isolated Supabase migration gate.
-- Forward-only: historical migrations may already be applied to remote environments.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.hrms_validate_bridge(target_bridge uuid, bridge_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
begin
  if target_bridge is null or coalesce(bridge_token, '') = '' then
    raise exception 'Bridge credential required';
  end if;

  select workspace_id into target_workspace
  from public.hrms_bridges
  where id = target_bridge
    and active = true
    and token_hash = encode(extensions.digest(bridge_token, 'sha256'), 'hex');

  if target_workspace is null then
    raise exception 'Invalid or inactive bridge credential';
  end if;
  return target_workspace;
end;
$$;

create or replace function public.hrms_create_bridge(target_workspace uuid, bridge_name text)
returns table (bridge_id uuid, bridge_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_token text;
  created_id uuid;
begin
  if not public.has_workspace_role(
    target_workspace,
    array['owner','admin']::public.workspace_role[]
  ) then
    raise exception 'Owner or admin permission is required';
  end if;
  if char_length(trim(coalesce(bridge_name, ''))) < 1 then
    raise exception 'Bridge name is required';
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.hrms_bridges (workspace_id, name, token_hash, created_by)
  values (
    target_workspace,
    trim(bridge_name),
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    auth.uid()
  )
  returning id into created_id;

  return query select created_id, raw_token;
end;
$$;

create or replace function public.hrms_rotate_bridge_token(target_bridge uuid)
returns table (bridge_id uuid, bridge_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_token text;
  target_workspace uuid;
begin
  select workspace_id into target_workspace
  from public.hrms_bridges
  where id = target_bridge;

  if target_workspace is null or not public.has_workspace_role(
    target_workspace,
    array['owner','admin']::public.workspace_role[]
  ) then
    raise exception 'Owner or admin permission is required';
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.hrms_bridges
  set token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex'),
      updated_at = now()
  where id = target_bridge;

  return query select target_bridge, raw_token;
end;
$$;

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
  if not public.has_workspace_role(
    target_workspace,
    array['owner','admin','editor']::public.workspace_role[]
  ) then
    raise exception 'Insufficient workspace permissions';
  end if;

  safe_prefix := upper(
    regexp_replace(coalesce(number_prefix, ''), '[^A-Za-z0-9]', '', 'g')
  );
  safe_branch := upper(
    regexp_replace(coalesce(branch_code, ''), '[^A-Za-z0-9]', '', 'g')
  );
  safe_series := upper(
    regexp_replace(coalesce(series_code, ''), '[^A-Za-z0-9]', '', 'g')
  );

  if safe_prefix = ''
    or safe_branch = ''
    or safe_series = ''
    or trim(coalesce(reserve_invoice_number.fiscal_year, '')) = '' then
    raise exception 'Invalid invoice sequence parameters';
  end if;

  insert into public.invoice_sequences (
    workspace_id,
    fiscal_year,
    branch_code,
    document_type,
    series_code,
    last_number
  ) values (
    target_workspace,
    reserve_invoice_number.fiscal_year,
    safe_branch,
    reserve_invoice_number.document_type,
    safe_series,
    1
  )
  on conflict on constraint invoice_sequences_pkey
  do update
    set last_number = public.invoice_sequences.last_number + 1,
        updated_at = now()
  returning last_number into next_number;

  return query select
    format(
      '%s-%s-%s-%s-%s',
      safe_prefix,
      safe_branch,
      replace(reserve_invoice_number.fiscal_year, '/', '-'),
      safe_series,
      lpad(next_number::text, 6, '0')
    ),
    next_number;
end;
$$;
