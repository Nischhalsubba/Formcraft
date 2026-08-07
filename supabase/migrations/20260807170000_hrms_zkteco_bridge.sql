-- Formcraft HRMS / ZKTeco bridge data plane
-- Additive only: no existing tables, routes, workspace records, or policies are replaced.

create extension if not exists pgcrypto;

create table if not exists public.hrms_bridges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  token_hash text not null,
  active boolean not null default true,
  version text not null default '',
  hostname text not null default '',
  platform text not null default '',
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.hrms_devices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bridge_id uuid not null references public.hrms_bridges(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  ip_address text not null,
  port integer not null default 4370 check (port between 1 and 65535),
  model text not null default '',
  force_udp boolean not null default false,
  connection_timeout integer not null default 10 check (connection_timeout between 3 and 120),
  active boolean not null default true,
  secret_configured boolean not null default false,
  last_seen_at timestamptz,
  last_pull_at timestamptz,
  last_error text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.hrms_device_users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bridge_id uuid not null references public.hrms_bridges(id) on delete cascade,
  device_id uuid not null references public.hrms_devices(id) on delete cascade,
  device_uid integer,
  device_user_id text not null default '',
  name text not null default '',
  privilege integer not null default 0,
  card text not null default '',
  fingerprint_count integer not null default 0 check (fingerprint_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (device_id, device_uid),
  unique (device_id, device_user_id)
);

create table if not exists public.hrms_attendance_punches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bridge_id uuid not null references public.hrms_bridges(id) on delete cascade,
  device_id uuid not null references public.hrms_devices(id) on delete cascade,
  device_uid integer,
  device_user_id text not null default '',
  employee_name text not null default '',
  punched_at timestamptz not null,
  punch_code integer,
  punch_label text not null default '',
  source text not null default 'device',
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique (device_id, device_uid, punched_at, punch_code)
);

create table if not exists public.hrms_pull_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bridge_id uuid not null references public.hrms_bridges(id) on delete cascade,
  device_id uuid not null references public.hrms_devices(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  records_pulled integer not null default 0 check (records_pulled >= 0),
  new_inserts integer not null default 0 check (new_inserts >= 0),
  status text not null default 'running' check (status in ('running','succeeded','failed','cancelled')),
  error_message text not null default '',
  error_detail text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.hrms_device_commands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bridge_id uuid not null references public.hrms_bridges(id) on delete cascade,
  device_id uuid references public.hrms_devices(id) on delete cascade,
  command text not null check (command in (
    'test','pull','pull-month','pull-all','backup','migrate-users','sync-user','delete-user',
    'set-secret','set-schedule','set-auto-attend-rules','refresh-config'
  )),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  error_message text not null default '',
  expires_at timestamptz not null default (now() + interval '30 minutes')
);

create index if not exists hrms_bridges_workspace_idx on public.hrms_bridges(workspace_id, active, last_seen_at desc);
create index if not exists hrms_devices_workspace_idx on public.hrms_devices(workspace_id, bridge_id, active, name);
create index if not exists hrms_device_users_workspace_idx on public.hrms_device_users(workspace_id, device_id, device_user_id);
create index if not exists hrms_punches_workspace_received_idx on public.hrms_attendance_punches(workspace_id, received_at, punched_at);
create index if not exists hrms_punches_device_time_idx on public.hrms_attendance_punches(device_id, punched_at desc);
create unique index if not exists hrms_punches_device_user_time_code_uidx on public.hrms_attendance_punches(device_id, device_user_id, punched_at, punch_code);
create index if not exists hrms_pull_sessions_workspace_idx on public.hrms_pull_sessions(workspace_id, started_at desc);
create index if not exists hrms_commands_bridge_queue_idx on public.hrms_device_commands(bridge_id, status, requested_at) where status = 'queued';

create trigger hrms_bridges_touch_updated_at
before update on public.hrms_bridges
for each row execute function public.touch_updated_at();

create trigger hrms_devices_touch_updated_at
before update on public.hrms_devices
for each row execute function public.touch_updated_at();

alter table public.hrms_bridges enable row level security;
alter table public.hrms_devices enable row level security;
alter table public.hrms_device_users enable row level security;
alter table public.hrms_attendance_punches enable row level security;
alter table public.hrms_pull_sessions enable row level security;
alter table public.hrms_device_commands enable row level security;

drop policy if exists hrms_bridges_select_members on public.hrms_bridges;
create policy hrms_bridges_select_members on public.hrms_bridges for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists hrms_bridges_manage_admins on public.hrms_bridges;
create policy hrms_bridges_manage_admins on public.hrms_bridges for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

drop policy if exists hrms_devices_select_members on public.hrms_devices;
create policy hrms_devices_select_members on public.hrms_devices for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists hrms_devices_manage_admins on public.hrms_devices;
create policy hrms_devices_manage_admins on public.hrms_devices for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

drop policy if exists hrms_device_users_select_members on public.hrms_device_users;
create policy hrms_device_users_select_members on public.hrms_device_users for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists hrms_punches_select_members on public.hrms_attendance_punches;
create policy hrms_punches_select_members on public.hrms_attendance_punches for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists hrms_pull_sessions_select_members on public.hrms_pull_sessions;
create policy hrms_pull_sessions_select_members on public.hrms_pull_sessions for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists hrms_commands_select_admins on public.hrms_device_commands;
create policy hrms_commands_select_admins on public.hrms_device_commands for select to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

drop policy if exists hrms_commands_insert_admins on public.hrms_device_commands;
create policy hrms_commands_insert_admins on public.hrms_device_commands for insert to authenticated
with check (
  public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  and requested_by = auth.uid()
);

drop policy if exists hrms_commands_update_admins on public.hrms_device_commands;
create policy hrms_commands_update_admins on public.hrms_device_commands for update to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

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
    and token_hash = encode(digest(bridge_token, 'sha256'), 'hex');

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
  if not public.has_workspace_role(target_workspace, array['owner','admin']::public.workspace_role[]) then
    raise exception 'Owner or admin permission is required';
  end if;
  if char_length(trim(coalesce(bridge_name, ''))) < 1 then
    raise exception 'Bridge name is required';
  end if;

  raw_token := encode(gen_random_bytes(32), 'hex');
  insert into public.hrms_bridges (workspace_id, name, token_hash, created_by)
  values (target_workspace, trim(bridge_name), encode(digest(raw_token, 'sha256'), 'hex'), auth.uid())
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
  select workspace_id into target_workspace from public.hrms_bridges where id = target_bridge;
  if target_workspace is null or not public.has_workspace_role(target_workspace, array['owner','admin']::public.workspace_role[]) then
    raise exception 'Owner or admin permission is required';
  end if;
  raw_token := encode(gen_random_bytes(32), 'hex');
  update public.hrms_bridges
  set token_hash = encode(digest(raw_token, 'sha256'), 'hex'), updated_at = now()
  where id = target_bridge;
  return query select target_bridge, raw_token;
end;
$$;

create or replace function public.hrms_bridge_pull_config(target_bridge uuid, bridge_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  result jsonb;
begin
  target_workspace := public.hrms_validate_bridge(target_bridge, bridge_token);
  update public.hrms_bridges set last_seen_at = now() where id = target_bridge;

  select jsonb_build_object(
    'workspace_id', target_workspace,
    'bridge_id', target_bridge,
    'devices', coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'ip_address', d.ip_address,
      'port', d.port,
      'model', d.model,
      'force_udp', d.force_udp,
      'connection_timeout', d.connection_timeout,
      'active', d.active,
      'secret_configured', d.secret_configured
    ) order by d.name) filter (where d.id is not null), '[]'::jsonb)
  ) into result
  from public.hrms_devices d
  where d.workspace_id = target_workspace and d.bridge_id = target_bridge;

  return result;
end;
$$;

create or replace function public.hrms_bridge_heartbeat(
  target_bridge uuid,
  bridge_token text,
  bridge_hostname text,
  bridge_platform text,
  bridge_version text,
  device_states jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  state_row jsonb;
  target_device uuid;
begin
  target_workspace := public.hrms_validate_bridge(target_bridge, bridge_token);
  update public.hrms_bridges
  set last_seen_at = now(), hostname = coalesce(bridge_hostname, ''), platform = coalesce(bridge_platform, ''), version = coalesce(bridge_version, '')
  where id = target_bridge;

  for state_row in select value from jsonb_array_elements(coalesce(device_states, '[]'::jsonb)) loop
    begin
      target_device := (state_row ->> 'id')::uuid;
    exception when others then
      target_device := null;
    end;
    if target_device is not null then
      update public.hrms_devices
      set last_seen_at = case when coalesce((state_row ->> 'reachable')::boolean, false) then now() else last_seen_at end,
          last_error = coalesce(state_row ->> 'last_error', last_error),
          metadata = metadata || jsonb_build_object('bridge_state', state_row, 'bridge_state_at', now())
      where id = target_device and workspace_id = target_workspace and bridge_id = target_bridge;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.hrms_bridge_pull_commands(target_bridge uuid, bridge_token text, max_commands integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  result jsonb;
begin
  target_workspace := public.hrms_validate_bridge(target_bridge, bridge_token);
  with candidates as (
    select id
    from public.hrms_device_commands
    where workspace_id = target_workspace
      and bridge_id = target_bridge
      and status = 'queued'
      and expires_at > now()
    order by requested_at
    limit greatest(1, least(coalesce(max_commands, 20), 100))
    for update skip locked
  ), claimed as (
    update public.hrms_device_commands c
    set status = 'running', started_at = now()
    from candidates
    where c.id = candidates.id
    returning c.id, c.device_id, c.command, c.payload, c.requested_at, c.expires_at
  )
  select coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb) into result from claimed;
  return result;
end;
$$;

create or replace function public.hrms_bridge_ack_command(
  target_bridge uuid,
  bridge_token text,
  target_command uuid,
  command_status text,
  command_result jsonb default '{}'::jsonb,
  command_error text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  command_name text;
  target_device uuid;
begin
  target_workspace := public.hrms_validate_bridge(target_bridge, bridge_token);
  if command_status not in ('succeeded','failed','cancelled') then
    raise exception 'Invalid terminal command status';
  end if;

  select command, device_id into command_name, target_device
  from public.hrms_device_commands
  where id = target_command and workspace_id = target_workspace and bridge_id = target_bridge;

  if command_name is null then raise exception 'Command not found'; end if;

  update public.hrms_device_commands
  set status = command_status,
      result = coalesce(command_result, '{}'::jsonb),
      error_message = coalesce(command_error, ''),
      completed_at = now(),
      payload = case when command_name = 'set-secret' then '{}'::jsonb else payload end
  where id = target_command;

  if command_name = 'set-secret' and command_status = 'succeeded' and target_device is not null then
    update public.hrms_devices set secret_configured = true where id = target_device and workspace_id = target_workspace;
  end if;
  return true;
end;
$$;

create or replace function public.hrms_bridge_start_pull(
  target_bridge uuid,
  bridge_token text,
  target_device uuid,
  pull_started_at timestamptz default now(),
  pull_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  created_id uuid;
begin
  target_workspace := public.hrms_validate_bridge(target_bridge, bridge_token);
  if not exists (select 1 from public.hrms_devices where id = target_device and workspace_id = target_workspace and bridge_id = target_bridge) then
    raise exception 'Device is not assigned to this bridge';
  end if;
  insert into public.hrms_pull_sessions (workspace_id, bridge_id, device_id, started_at, metadata)
  values (target_workspace, target_bridge, target_device, coalesce(pull_started_at, now()), coalesce(pull_metadata, '{}'::jsonb))
  returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.hrms_bridge_ingest_users(
  target_bridge uuid,
  bridge_token text,
  target_device uuid,
  users_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  row_data jsonb;
  affected integer := 0;
begin
  target_workspace := public.hrms_validate_bridge(target_bridge, bridge_token);
  if not exists (select 1 from public.hrms_devices where id = target_device and workspace_id = target_workspace and bridge_id = target_bridge) then
    raise exception 'Device is not assigned to this bridge';
  end if;

  for row_data in select value from jsonb_array_elements(coalesce(users_payload, '[]'::jsonb)) loop
    insert into public.hrms_device_users (
      workspace_id, bridge_id, device_id, device_uid, device_user_id, name, privilege, card, fingerprint_count, metadata, last_seen_at
    ) values (
      target_workspace,
      target_bridge,
      target_device,
      nullif(row_data ->> 'uid', '')::integer,
      coalesce(row_data ->> 'user_id', ''),
      coalesce(row_data ->> 'name', ''),
      coalesce(nullif(row_data ->> 'privilege', '')::integer, 0),
      coalesce(row_data ->> 'card', ''),
      greatest(0, coalesce(nullif(row_data ->> 'fingerprint_count', '')::integer, 0)),
      coalesce(row_data -> 'metadata', '{}'::jsonb),
      now()
    )
    on conflict (device_id, device_user_id) do update
      set device_uid = excluded.device_uid,
          name = excluded.name,
          privilege = excluded.privilege,
          card = excluded.card,
          fingerprint_count = excluded.fingerprint_count,
          metadata = excluded.metadata,
          last_seen_at = now();
    affected := affected + 1;
  end loop;
  return affected;
end;
$$;

create or replace function public.hrms_bridge_ingest_punches(
  target_bridge uuid,
  bridge_token text,
  target_device uuid,
  punches_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  row_data jsonb;
  inserted_count integer := 0;
  did_insert integer;
begin
  target_workspace := public.hrms_validate_bridge(target_bridge, bridge_token);
  if not exists (select 1 from public.hrms_devices where id = target_device and workspace_id = target_workspace and bridge_id = target_bridge) then
    raise exception 'Device is not assigned to this bridge';
  end if;

  for row_data in select value from jsonb_array_elements(coalesce(punches_payload, '[]'::jsonb)) loop
    did_insert := 0;
    insert into public.hrms_attendance_punches (
      workspace_id, bridge_id, device_id, device_uid, device_user_id, employee_name, punched_at, punch_code, punch_label, source, metadata
    ) values (
      target_workspace,
      target_bridge,
      target_device,
      nullif(row_data ->> 'uid', '')::integer,
      coalesce(row_data ->> 'user_id', ''),
      coalesce(row_data ->> 'name', ''),
      (row_data ->> 'punched_at')::timestamptz,
      nullif(row_data ->> 'punch_code', '')::integer,
      coalesce(row_data ->> 'punch_label', ''),
      coalesce(nullif(row_data ->> 'source', ''), 'device'),
      coalesce(row_data -> 'metadata', '{}'::jsonb)
    )
    on conflict (device_id, device_uid, punched_at, punch_code) do nothing;
    get diagnostics did_insert = row_count;
    inserted_count := inserted_count + did_insert;
  end loop;
  return inserted_count;
end;
$$;

create or replace function public.hrms_bridge_finish_pull(
  target_bridge uuid,
  bridge_token text,
  target_session uuid,
  pull_status text,
  pulled_count integer default 0,
  inserted_count integer default 0,
  pull_error text default '',
  pull_error_detail text default '',
  pull_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  target_device uuid;
begin
  target_workspace := public.hrms_validate_bridge(target_bridge, bridge_token);
  if pull_status not in ('succeeded','failed','cancelled') then raise exception 'Invalid pull status'; end if;
  select device_id into target_device from public.hrms_pull_sessions
  where id = target_session and workspace_id = target_workspace and bridge_id = target_bridge;
  if target_device is null then raise exception 'Pull session not found'; end if;

  update public.hrms_pull_sessions
  set completed_at = now(),
      records_pulled = greatest(0, coalesce(pulled_count, 0)),
      new_inserts = greatest(0, coalesce(inserted_count, 0)),
      status = pull_status,
      error_message = coalesce(pull_error, ''),
      error_detail = coalesce(pull_error_detail, ''),
      metadata = metadata || coalesce(pull_metadata, '{}'::jsonb)
  where id = target_session;

  update public.hrms_devices
  set last_pull_at = now(),
      last_seen_at = case when pull_status = 'succeeded' then now() else last_seen_at end,
      last_error = case when pull_status = 'succeeded' then '' else coalesce(pull_error, '') end
  where id = target_device and workspace_id = target_workspace;
  return true;
end;
$$;

revoke all on function public.hrms_validate_bridge(uuid, text) from public;
revoke all on function public.hrms_create_bridge(uuid, text) from public;
revoke all on function public.hrms_rotate_bridge_token(uuid) from public;
revoke all on function public.hrms_bridge_pull_config(uuid, text) from public;
revoke all on function public.hrms_bridge_heartbeat(uuid, text, text, text, text, jsonb) from public;
revoke all on function public.hrms_bridge_pull_commands(uuid, text, integer) from public;
revoke all on function public.hrms_bridge_ack_command(uuid, text, uuid, text, jsonb, text) from public;
revoke all on function public.hrms_bridge_start_pull(uuid, text, uuid, timestamptz, jsonb) from public;
revoke all on function public.hrms_bridge_ingest_users(uuid, text, uuid, jsonb) from public;
revoke all on function public.hrms_bridge_ingest_punches(uuid, text, uuid, jsonb) from public;
revoke all on function public.hrms_bridge_finish_pull(uuid, text, uuid, text, integer, integer, text, text, jsonb) from public;

grant execute on function public.hrms_create_bridge(uuid, text) to authenticated;
grant execute on function public.hrms_rotate_bridge_token(uuid) to authenticated;

grant execute on function public.hrms_bridge_pull_config(uuid, text) to anon, authenticated;
grant execute on function public.hrms_bridge_heartbeat(uuid, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.hrms_bridge_pull_commands(uuid, text, integer) to anon, authenticated;
grant execute on function public.hrms_bridge_ack_command(uuid, text, uuid, text, jsonb, text) to anon, authenticated;
grant execute on function public.hrms_bridge_start_pull(uuid, text, uuid, timestamptz, jsonb) to anon, authenticated;
grant execute on function public.hrms_bridge_ingest_users(uuid, text, uuid, jsonb) to anon, authenticated;
grant execute on function public.hrms_bridge_ingest_punches(uuid, text, uuid, jsonb) to anon, authenticated;
grant execute on function public.hrms_bridge_finish_pull(uuid, text, uuid, text, integer, integer, text, text, jsonb) to anon, authenticated;
