// Verifies the stable workspace shell, theme studio, documentation, and browser-CI coverage.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appRoot = new URL('../', import.meta.url);
const repositoryRoot = new URL('../../', import.meta.url);
const [html, shellJs, shellActions, shellCss, studioJs, fontLoaderJs, studioCss, readme, pkgText, workflow] = await Promise.all([
  readFile(new URL('index.html', appRoot), 'utf8'),
  readFile(new URL('assets/js/simplified-workspace-v4.js', appRoot), 'utf8'),
  readFile(new URL('assets/js/simplified-workspace-actions.js', appRoot), 'utf8'),
  readFile(new URL('assets/css/simplified-workspace-v4.css', appRoot), 'utf8'),
  readFile(new URL('assets/js/ui-theme-studio.js', appRoot), 'utf8'),
  readFile(new URL('assets/js/theme-font-loader.js', appRoot), 'utf8'),
  readFile(new URL('assets/css/ui-theme-studio.css', appRoot), 'utf8'),
  readFile(new URL('README.md', appRoot), 'utf8'),
  readFile(new URL('package.json', appRoot), 'utf8'),
  readFile(new URL('.github/workflows/browser-regression.yml', repositoryRoot), 'utf8')
]);

for (const asset of [
  'assets/css/simplified-workspace-v4.css',
  'assets/css/ui-theme-studio.css',
  'assets/js/ui-theme-studio.js',
  'assets/js/theme-font-loader.js',
  'assets/js/simplified-workspace-v4.js',
  'assets/js/simplified-workspace-actions.js'
]) assert.ok(html.includes(asset), `Missing simplified workspace asset: ${asset}`);

assert.ok(
  html.indexOf('assets/css/simplified-workspace-v4.css') > html.indexOf('assets/css/responsive-system-v2-landscape.css'),
  'Simplified shell CSS must load after responsive architecture layers.'
);
assert.ok(
  html.indexOf('assets/js/ui-theme-studio.js') > html.indexOf('assets/js/responsive-system-v2.js'),
  'Theme studio must load after the responsive system.'
);
assert.ok(
  html.indexOf('assets/js/theme-font-loader.js') > html.indexOf('assets/js/ui-theme-studio.js'),
  'Font loader must load after the Theme Studio font catalog.'
);
assert.ok(
  html.indexOf('assets/js/simplified-workspace-v4.js') > html.indexOf('assets/js/ui-theme-studio.js'),
  'Stable shell must load after the theme studio.'
);
assert.ok(
  html.indexOf('assets/js/simplified-workspace-actions.js') > html.indexOf('assets/js/simplified-workspace-v4.js'),
  'Stable shell actions must load after the stable shell.'
);
assert.ok(
  html.indexOf('assets/js/simplified-workspace-actions.js') < html.indexOf('assets/js/motion.js'),
  'Motion must remain the final shell wrapper.'
);

for (const contract of [
  "const VERSION = 'FORMCRAFT-SIMPLE-SHELL-4.0'",
  'const DEFAULT_ITEMS',
  'function ensureNavigationSettings',
  'function staticSidebarMarkup',
  'function mobileNavigationMarkup',
  'The menu stays the same in every app.',
  'window.FormcraftSimpleShell'
]) assert.ok(shellJs.includes(contract), `Missing stable navigation contract: ${contract}`);

for (const contract of [
  "const VERSION = 'FORMCRAFT-SIMPLE-ACTIONS-1.0'",
  ".fc3-mobile-bottom-nav [data-context-create]",
  'handleContextCreate',
  'stopImmediatePropagation',
  'window.FormcraftSimpleActions'
]) assert.ok(shellActions.includes(contract), `Missing stable action contract: ${contract}`);

for (const key of ['dashboard', 'apps', 'projects', 'tasks', 'crm', 'sales', 'invoices', 'inventory', 'employees', 'payroll', 'reports', 'files', 'settings']) {
  assert.ok(shellJs.includes(`${key}: { key: '${key}'`), `Missing navigation catalog item: ${key}`);
}

for (const contract of [
  '.fc3-app-rail',
  '.fc4-stable-nav',
  '.fc4-nav-item.is-active',
  '.fc4-sidebar-collapsed',
  '.fc4-module-route .fc3-page-header',
  '@media (max-width: 1100px)',
  '@media (max-width: 820px)'
]) assert.ok(shellCss.includes(contract), `Missing simplified shell CSS contract: ${contract}`);

for (const contract of [
  "const VERSION = 'FORMCRAFT-THEME-STUDIO-2.0'",
  'const LEGACY_DEFAULT_DESIGN',
  'const DEFAULT_DESIGN',
  'const FONT_STACKS',
  "'Plus Jakarta Sans'",
  "primary: '#4f46e5'",
  "uiFont: 'Plus Jakarta Sans', displayFont: 'Plus Jakarta Sans'",
  'function matchesTemplate',
  'function ensureDesignSettings',
  'matchesTemplate(current, LEGACY_DEFAULT_DESIGN)',
  'function applyDesign',
  'function interfacePanel',
  'function navigationPanel',
  'function designFromForm',
  'data-ui-design-form',
  'data-ui-navigation-form',
  'Only workspace owners and administrators',
  'window.FormcraftThemeStudio'
]) assert.ok(studioJs.includes(contract), `Missing theme studio contract: ${contract}`);

for (const token of [
  '--ui-font-size', '--ui-font-scale', '--ui-line-height', '--ui-spacing-scale',
  '--ui-section-gap', '--ui-card-padding', '--ui-control-height', '--ui-sidebar-width',
  '--ui-content-max', '--ui-radius', '--ui-icon-size', '--ui-shadow'
]) {
  assert.ok(studioCss.includes(token), `Missing customizable design token: ${token}`);
}

for (const font of ['Plus Jakarta Sans', 'DM Sans', 'IBM Plex Sans', 'Source Sans 3', 'Inter', 'Manrope']) {
  assert.ok(studioJs.includes(font), `Missing selectable Theme Studio font: ${font}`);
  assert.ok(fontLoaderJs.includes(font), `Missing lazy-load mapping for Theme Studio font: ${font}`);
}
assert.ok(fontLoaderJs.includes('fonts.googleapis.com/css2?family='), 'Theme Studio fonts must load on demand.');
assert.ok(!html.includes('family=Manrope') && !html.includes('family=DM+Sans') && !html.includes('family=IBM+Plex+Sans'), 'Inactive Theme Studio fonts must not preload in index.html.');

for (const readmeContract of [
  'Nepal-first business operations workspace',
  'Project layout',
  'Local verification',
  'Supabase',
  'Netlify',
  'docs/DESIGN_SYSTEM.md'
]) assert.ok(readme.includes(readmeContract), `README is missing: ${readmeContract}`);

const pkg = JSON.parse(pkgText);
assert.ok(pkg.scripts.test.includes('simplified-workspace-audit.mjs'), 'Simplified workspace audit must run in npm test.');
assert.ok(pkg.scripts['test:shell'].includes('simplified-workspace-v4.js'), 'Stable shell syntax must be checked.');
assert.ok(pkg.scripts['test:shell'].includes('simplified-workspace-actions.js'), 'Stable shell action syntax must be checked.');
assert.ok(pkg.scripts['test:shell'].includes('ui-theme-studio.js'), 'Theme studio syntax must be checked.');
assert.ok(workflow.includes('working-directory: app'), 'Browser CI must run from the application workspace.');
assert.ok(workflow.includes("- 'app/**'"), 'Application changes must trigger browser CI.');
assert.ok(workflow.includes('python tests/simplified-workspace-browser-smoke.py'), 'Simplified workspace browser regression must run in CI.');

assert.ok(!`${shellJs}${shellActions}${shellCss}${studioJs}${studioCss}`.includes('odoo.com'), 'The simplified UI must not embed Odoo assets or source code.');
console.log('Simplified navigation, stable mobile create actions, lazy Theme Studio fonts, design tokens, and cleaned documentation contracts passed.');
