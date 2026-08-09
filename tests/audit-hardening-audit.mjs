import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');

const migration = read('supabase/migrations/20260809000100_security_and_integrity_hardening.sql');
const invitation = read('supabase/functions/invite-member/index.ts');
const runtime = read('assets/js/audit-hardening.js');
const fontLoader = read('assets/js/theme-font-loader.js');
const css = read('assets/css/audit-hardening.css');
const html = read('index.html');
const netlify = read('netlify.toml');

assert.match(migration, /create or replace function public\.handle_new_user\(\)/i);
assert.doesNotMatch(migration, /formcraft_workspace_role/);
assert.match(migration, /drop policy if exists members_manage_admins/i);
assert.match(migration, /set_workspace_member_role/i);
assert.match(migration, /transfer_workspace_ownership/i);
assert.match(migration, /Editors cannot modify workspace settings/i);
assert.match(migration, /Editors cannot modify workspace membership presentation data/i);

assert.doesNotMatch(invitation, /formcraft_workspace_id/);
assert.doesNotMatch(invitation, /formcraft_workspace_role/);
assert.match(invitation, /existingMember/);
assert.match(invitation, /\.insert\(\{[\s\S]*workspace_id: invitation\.workspace_id/);
assert.match(invitation, /@supabase\/supabase-js@2\.45\.4/);

assert.match(runtime, /PASSWORD_RECOVERY/);
assert.match(runtime, /updateUser\(\{ password \}\)/);
assert.match(runtime, /set_workspace_member_role/);
assert.ok(runtime.includes('await backend()?.flush?.();'), 'Safe sign-out must flush pending workspace changes before auth sign-out.');
assert.match(runtime, /Concurrent changes need your decision/);
assert.match(runtime, /SENSITIVE_DRAFT_MODULES/);
assert.match(runtime, /aria-label/);
assert.match(runtime, /contrast\(foreground, background\) < 4\.5/);

assert.match(fontLoader, /fonts\.googleapis\.com\/css2\?family=/);
assert.match(fontLoader, /formcraft:workspace-ready/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /\.fc4-nav-section h2/);
assert.match(css, /audit-conflict-banner/);
assert.match(html, /assets\/js\/audit-hardening\.js/);
assert.match(html, /assets\/js\/theme-font-loader\.js/);
assert.match(html, /assets\/css\/audit-hardening\.css/);
assert.match(html, /@supabase\/supabase-js@2\.45\.4/);
assert.doesNotMatch(html, /family=Manrope|family=DM\+Sans|family=IBM\+Plex\+Sans|family=Plus\+Jakarta\+Sans|family=Source\+Sans\+3/);

assert.match(netlify, /Content-Security-Policy/);
assert.match(netlify, /publish\s*=\s*"dist"/);

console.log('Audit hardening static checks passed.');
