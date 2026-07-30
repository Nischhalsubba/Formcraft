-- Formcraft dynamic backend
-- Supabase Postgres, Auth, Storage, RLS, Realtime

create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.workspace_state (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint workspace_state_is_object check (jsonb_typeof(data) = 'object')
);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.workspace_role not null default 'viewer',
  status public.invitation_status not null default 'pending',
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (workspace_id, email, status)
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  title text not null,
  detail text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workspace_members_user_idx on public.workspace_members(user_id);
create index workspace_invitations_workspace_idx on public.workspace_invitations(workspace_id, status);
create index activity_log_workspace_created_idx on public.activity_log(workspace_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger workspaces_touch_updated_at
before update on public.workspaces
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_workspace_member(target_workspace uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = target_user
  );
$$;

create or replace function public.has_workspace_role(
  target_workspace uuid,
  allowed_roles public.workspace_role[],
  target_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = target_user
      and role = any(allowed_roles)
  );
$$;

create or replace function public.empty_workspace_state(workspace_name text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'projects', '[]'::jsonb,
    'tasks', '[]'::jsonb,
    'team', '[]'::jsonb,
    'activity', '[]'::jsonb,
    'events', '[]'::jsonb,
    'messages', '[]'::jsonb,
    'files', '[]'::jsonb,
    'invoices', '[]'::jsonb,
    'settings', jsonb_build_object(
      'workspaceName', workspace_name,
      'workspaceDescription', '',
      'defaultStatus', 'active',
      'theme', 'system',
      'notifications', jsonb_build_object(
        'taskReminders', true,
        'projectUpdates', true,
        'weeklySummary', false
      )
    )
  );
$$;

create or replace function public.create_workspace(workspace_name text, workspace_description text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(workspace_name)) < 1 or char_length(trim(workspace_name)) > 80 then
    raise exception 'Workspace name must contain between 1 and 80 characters';
  end if;

  insert into public.workspaces (name, description, created_by)
  values (trim(workspace_name), coalesce(workspace_description, ''), auth.uid())
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  insert into public.workspace_state (workspace_id, data, updated_by)
  values (new_workspace_id, public.empty_workspace_state(trim(workspace_name)), auth.uid());

  insert into public.activity_log (workspace_id, actor_id, event_type, title, detail)
  values (new_workspace_id, auth.uid(), 'system', 'Workspace created', trim(workspace_name));

  return new_workspace_id;
end;
$$;

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
begin
  if not public.has_workspace_role(target_workspace, array['owner','admin','editor']::public.workspace_role[]) then
    raise exception 'Insufficient workspace permissions';
  end if;

  if jsonb_typeof(next_data) <> 'object' then
    raise exception 'Workspace state must be a JSON object';
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

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_state enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.activity_log enable row level security;

create policy profiles_select_self
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy workspaces_select_members
on public.workspaces for select
to authenticated
using (public.is_workspace_member(id));

create policy workspaces_update_admins
on public.workspaces for update
to authenticated
using (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]));

create policy members_select_workspace
on public.workspace_members for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy members_manage_admins
on public.workspace_members for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy state_select_members
on public.workspace_state for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy state_update_editors
on public.workspace_state for update
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.workspace_role[]));

create policy invitations_select_admins
on public.workspace_invitations for select
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy invitations_manage_admins
on public.workspace_invitations for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy activity_select_members
on public.activity_log for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy activity_insert_members
on public.activity_log for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and actor_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit)
values ('formcraft-files', 'formcraft-files', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create policy storage_select_workspace_files
on storage.objects for select
to authenticated
using (
  bucket_id = 'formcraft-files'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);

create policy storage_insert_workspace_files
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'formcraft-files'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner','admin','editor']::public.workspace_role[])
);

create policy storage_update_workspace_files
on storage.objects for update
to authenticated
using (
  bucket_id = 'formcraft-files'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner','admin','editor']::public.workspace_role[])
)
with check (
  bucket_id = 'formcraft-files'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner','admin','editor']::public.workspace_role[])
);

create policy storage_delete_workspace_files
on storage.objects for delete
to authenticated
using (
  bucket_id = 'formcraft-files'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner','admin','editor']::public.workspace_role[])
);

revoke all on function public.create_workspace(text, text) from public;
grant execute on function public.create_workspace(text, text) to authenticated;
revoke all on function public.update_workspace_state(uuid, jsonb, bigint) from public;
grant execute on function public.update_workspace_state(uuid, jsonb, bigint) to authenticated;

-- Enable realtime for collaborative workspace state.
do $$
begin
  alter publication supabase_realtime add table public.workspace_state;
exception
  when duplicate_object then null;
end;
$$;
