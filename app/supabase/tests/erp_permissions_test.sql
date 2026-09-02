begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

-- Deterministic users for RLS/RPC tests. Password authentication is irrelevant;
-- these tests set the same JWT claim consumed by auth.uid().
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', 'unused', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'editor@example.test', 'unused', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'viewer@example.test', 'unused', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.workspaces (id, name, created_by) values
  ('20000000-0000-0000-0000-000000000001', 'ERP permission test', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'Other workspace', '10000000-0000-0000-0000-000000000001');

insert into public.workspace_members (workspace_id, user_id, role) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'editor'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'viewer'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'owner');

insert into public.erp_companies (id, workspace_id, name, created_by, updated_by) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Main company', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Other company', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

insert into public.erp_branches (id, workspace_id, company_id, name, code, created_by, updated_by) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Kathmandu', 'KTM', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Biratnagar', 'BRT', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

insert into public.erp_records (
  id, workspace_id, company_id, branch_id, module_key, record_key, title,
  created_by, updated_by
) values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'accounting', 'INV-1', 'Invoice 1', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'accounting', 'INV-2', 'Invoice 2', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select ok(
  public.has_erp_permission(
    '20000000-0000-0000-0000-000000000001', 'accounting', 'read'
  ),
  'workspace owner receives the explicit owner bypass'
);

select lives_ok(
  $$select public.erp_grant_permission(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'sales', 'read'
  )$$,
  'owner can grant a workspace-wide module permission'
);

select lives_ok(
  $$select public.erp_grant_permission(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'accounting', 'update',
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001'
  )$$,
  'owner can grant a branch-scoped permission'
);

select lives_ok(
  $$select public.erp_grant_permission(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'accounting', 'delete',
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001'
  )$$,
  'owner can grant a record-scoped permission'
);

select throws_ok(
  $$select public.erp_grant_permission(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'accounting', 'read',
    '30000000-0000-0000-0000-000000000002'
  )$$,
  'P0001',
  'Permission company is outside target workspace',
  'scope validation rejects a company from another workspace'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select ok(
  public.has_erp_permission(
    '20000000-0000-0000-0000-000000000001', 'sales', 'read'
  ),
  'editor receives the granted sales read permission'
);

select ok(
  not public.has_erp_permission(
    '20000000-0000-0000-0000-000000000001', 'accounting', 'read'
  ),
  'editor does not inherit unrelated accounting read permission'
);

select ok(
  public.has_erp_permission(
    '20000000-0000-0000-0000-000000000001',
    'accounting', 'update',
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001'
  ),
  'branch-scoped permission matches its branch'
);

select ok(
  not public.has_erp_permission(
    '20000000-0000-0000-0000-000000000001',
    'accounting', 'update',
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002'
  ),
  'branch-scoped permission does not cross branches'
);

select ok(
  public.has_erp_permission(
    '20000000-0000-0000-0000-000000000001',
    'accounting', 'delete',
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001'
  ),
  'record-scoped permission matches its record'
);

select ok(
  not public.has_erp_permission(
    '20000000-0000-0000-0000-000000000001',
    'accounting', 'delete',
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000002'
  ),
  'record-scoped permission does not cross records'
);

select throws_ok(
  $$select public.erp_grant_permission(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'payroll', 'read'
  )$$,
  'P0001',
  'Only workspace owners can manage ERP permissions',
  'editor cannot grant permissions to self or others'
);

select is(
  (select count(*) from public.erp_permission_grants where user_id = auth.uid()),
  3::bigint,
  'grantee can inspect own active grants through RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.erp_permission_grants', 'INSERT'),
  'authenticated clients cannot insert grants directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.erp_permission_grants', 'UPDATE'),
  'authenticated clients cannot update grants directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.erp_permission_grants', 'DELETE'),
  'authenticated clients cannot delete grants directly'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.erp_permission_grants where user_id = '10000000-0000-0000-0000-000000000002'),
  0::bigint,
  'unprivileged workspace member cannot inspect another users grants'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.erp_permission_grants),
  3::bigint,
  'workspace owner can inspect all workspace grants'
);

select lives_ok(
  $$select public.erp_revoke_permission(
    (select id from public.erp_permission_grants
     where user_id = '10000000-0000-0000-0000-000000000002'
       and module_key = 'sales'
       and action_key = 'read'
       and revoked_at is null)
  )$$,
  'owner can revoke an active permission without deleting history'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select ok(
  not public.has_erp_permission(
    '20000000-0000-0000-0000-000000000001', 'sales', 'read'
  ),
  'revoked permission no longer authorizes the grantee'
);

select is(
  (select count(*) from public.erp_permission_grants where user_id = auth.uid()),
  3::bigint,
  'revoked grant remains visible to its grantee as authorization history'
);

select * from finish();
rollback;
