create table if not exists public.installation_state (
  id boolean primary key default true check (id = true),
  owner_created boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.installation_state (id, owner_created, updated_at)
values (true, exists(select 1 from auth.users), now())
on conflict (id) do update
set owner_created = excluded.owner_created,
    updated_at = excluded.updated_at;

create or replace function public.sync_installation_owner_state()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.installation_state
  set owner_created = true,
      updated_at = now()
  where id = true;
  return new;
end;
$$;

drop trigger if exists on_auth_owner_state_created on auth.users;
create trigger on_auth_owner_state_created
after insert on auth.users
for each row execute function public.sync_installation_owner_state();

alter table public.installation_state enable row level security;

drop policy if exists installation_state_read on public.installation_state;
create policy installation_state_read
on public.installation_state for select
to anon, authenticated
using (true);

revoke all on table public.installation_state from public, anon, authenticated;
grant select on table public.installation_state to anon, authenticated;

revoke all on function public.sync_installation_owner_state() from public, anon, authenticated;
