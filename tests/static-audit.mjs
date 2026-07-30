import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('assets/css/app.css');
const fixesCss = read('assets/css/final-ui-fixes.css');
const headerCss = read('assets/css/header-popover-fixes.css');
const mavenCss = read('assets/css/maven-system.css');
const dynamicCss = read('assets/css/dynamic-backend.css');
const appCore = read('assets/js/app-core.js');
const baseScripts = ['app-pages.js', 'app-actions.js', 'app-modules.js'];
const js = baseScripts.map(name => read(`assets/js/${name}`)).join('\n');
const fixesJs = read('assets/js/final-ui-fixes.js');
const headerJs = read('assets/js/header-popover-fixes.js');
const mavenJs = read('assets/js/maven-system.js');
const dynamicJs = read('assets/js/dynamic-backend.js');
const dynamicWorkflows = read('assets/js/dynamic-workflows.js');
const migration = read('supabase/migrations/20260730030000_formcraft_dynamic_backend.sql');
const invitationMigration = read('supabase/migrations/20260730030100_invitation_activation.sql');
const inviteFunction = read('supabase/functions/invite-member/index.ts');
const buildConfig = read('scripts/build-runtime-config.mjs');
const gitignore = read('.gitignore');

assert.equal((html.match(/rel="stylesheet"/g) || []).length, 6, 'The font and five application stylesheets should load');
for (const stylesheet of ['app.css', 'final-ui-fixes.css', 'header-popover-fixes.css', 'maven-system.css', 'dynamic-backend.css']) {
  assert.ok(html.includes(`assets/css/${stylesheet}`), `${stylesheet} must load`);
}
for (const name of ['app-core.js', ...baseScripts, 'final-ui-fixes.js', 'header-popover-fixes.js', 'maven-system.js', 'dynamic-backend.js', 'dynamic-workflows.js']) {
  assert.ok(html.includes(`assets/js/${name}`), `${name} must load`);
}
assert.match(html, /@supabase\/supabase-js@2/);
assert.match(html, /assets\/js\/runtime-config\.js/);
assert.match(html, /data-backend="loading"/);
assert.doesNotMatch(html, /planiq|flexxeriin|ui-scale-refinement|modules\.css/);

assert.match(css, /@media \(max-width: 700px\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.agenda-list/);
assert.match(css, /\.mobile-card-list/);
assert.match(js, /validateForm/);
assert.match(js, /confirmAction/);
assert.match(js, /aria-label=/);
assert.doesNotMatch(js, /window\.prompt|window\.confirm/);
assert.doesNotMatch(js, /2026-07-29/);
assert.doesNotMatch(js, /⌂|▦|◎|◷|⚙|⌫|✎/);

assert.match(appCore, /function emptyState\(\)/);
assert.doesNotMatch(appCore, /function seedState/);
assert.doesNotMatch(appCore, /localStorage\.setItem/);
assert.doesNotMatch(appCore, /MAS DataHub|Morajaa Mobile|Yarsha System|Aarav Sharma|Maya Thapa|owner@formcraft\.local/);
assert.match(appCore, /currentUserName/);
assert.match(appCore, /state\?\.settings\?\.currency \|\| 'USD'/);

assert.match(fixesJs, /createdAt/);
assert.match(fixesJs, /completedAt/);
assert.match(fixesJs, /inTimestampRange/);
assert.match(fixesJs, /periodTasks/);
assert.match(fixesJs, /openWorkspaceSearch/);
assert.match(fixesJs, /aria-describedby/);
assert.match(fixesJs, /aria-errormessage/);
assert.match(fixesJs, /window\.addEventListener\('popstate'/);

assert.match(headerCss, /\.app-header \{\s*overflow: visible;/);
assert.match(headerCss, /\.dashboard-content \{\s*margin-top: 0;/);
assert.match(headerJs, /mountHeaderPopovers/);
assert.match(headerJs, /aria-expanded/);

assert.match(mavenCss, /--maven-gradient/);
assert.match(mavenCss, /\.maven-overview-grid/);
assert.match(mavenCss, /\.maven-bottom-nav/);
assert.match(mavenJs, /workspaceSnapshot/);
assert.match(mavenJs, /bottomNavMarkup/);

assert.match(dynamicCss, /\.backend-gate/);
assert.match(dynamicCss, /html\[data-backend="offline"\]/);
assert.match(dynamicJs, /createClient/);
assert.match(dynamicJs, /signInWithPassword/);
assert.match(dynamicJs, /create_workspace/);
assert.match(dynamicJs, /update_workspace_state/);
assert.match(dynamicJs, /postgres_changes/);
assert.match(dynamicJs, /formcraft-files/);
assert.match(dynamicJs, /invite-member/);
assert.match(dynamicJs, /\/conflict\/i/);
assert.match(dynamicJs, /reloadWorkspaceState/);
assert.doesNotMatch(dynamicJs, /sb_publishable_[a-zA-Z0-9_-]{20,}/);
assert.doesNotMatch(dynamicJs, /https:\/\/[a-z0-9]+\.supabase\.co/);
assert.match(dynamicWorkflows, /state = emptyState\(\)/);
assert.match(dynamicWorkflows, /currentUserName\(\)/);
assert.doesNotMatch(dynamicWorkflows, /seedState/);

assert.match(migration, /create table public\.workspaces/);
assert.match(migration, /create table public\.workspace_state/);
assert.match(migration, /enable row level security/);
assert.match(migration, /create policy state_select_members/);
assert.match(migration, /create policy storage_select_workspace_files/);
assert.match(migration, /create or replace function public\.create_workspace/);
assert.match(migration, /create or replace function public\.update_workspace_state/);
assert.match(migration, /alter publication supabase_realtime add table public\.workspace_state/);
assert.match(invitationMigration, /formcraft_workspace_id/);
assert.match(invitationMigration, /profiles_select_self_or_peers/);
assert.match(inviteFunction, /inviteUserByEmail/);
assert.match(inviteFunction, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(buildConfig, /SUPABASE_URL/);
assert.match(buildConfig, /SUPABASE_PUBLISHABLE_KEY/);
assert.match(gitignore, /assets\/js\/runtime-config\.js/);

for (const source of [css, fixesCss, headerCss, mavenCss, dynamicCss]) {
  const open = (source.match(/{/g) || []).length;
  const close = (source.match(/}/g) || []).length;
  assert.equal(open, close, 'CSS braces must balance');
}

console.log('Static Formcraft dynamic-backend and design-system checks passed.');
