// Verifies responsive assets, runtime contracts, documentation, and CI coverage for the maintained application workspace.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appRoot = new URL('../', import.meta.url);
const repositoryRoot = new URL('../../', import.meta.url);
const [html, css, landscapeCss, runtime, dashboard, pkgText, workflow, docs] = await Promise.all([
  readFile(new URL('index.html', appRoot), 'utf8'),
  readFile(new URL('assets/css/responsive-system-v2.css', appRoot), 'utf8'),
  readFile(new URL('assets/css/responsive-system-v2-landscape.css', appRoot), 'utf8'),
  readFile(new URL('assets/js/responsive-system-v2.js', appRoot), 'utf8'),
  readFile(new URL('assets/js/formcraft-bright-dashboard.js', appRoot), 'utf8'),
  readFile(new URL('package.json', appRoot), 'utf8'),
  readFile(new URL('.github/workflows/browser-regression.yml', repositoryRoot), 'utf8'),
  readFile(new URL('docs/RESPONSIVE_SYSTEM_AUDIT.md', appRoot), 'utf8')
]);

for (const asset of [
  'assets/css/responsive-system-v2.css',
  'assets/css/responsive-system-v2-landscape.css',
  'assets/js/responsive-system-v2.js'
]) assert.ok(html.includes(asset), `Missing responsive system asset: ${asset}`);

assert.ok(
  html.indexOf('assets/css/responsive-system-v2.css') > html.indexOf('assets/css/premium-interface-geometry.css'),
  'Responsive CSS must load after all architecture and premium geometry layers.'
);
assert.ok(
  html.indexOf('assets/css/responsive-system-v2-landscape.css') > html.indexOf('assets/css/responsive-system-v2.css'),
  'Short landscape extension must load after the primary responsive system.'
);
assert.ok(
  html.indexOf('assets/js/responsive-system-v2.js') > html.indexOf('assets/js/premium-interface-runtime.js'),
  'Responsive runtime must decorate the final premium shell.'
);
assert.ok(
  html.indexOf('assets/js/responsive-system-v2.js') < html.indexOf('assets/js/motion.js'),
  'Motion must wrap the final responsive shell.'
);

for (const contract of [
  '--fc-rsp-visual-height',
  '.product-project-mobile',
  'table[data-responsive-table]',
  '.fc3-topbar.workspace-topbar',
  '.fc3-page-header.workspace-page-header',
  '.product-summary-strip',
  '.erp-module-toolbar',
  '.erp-board',
  '.ops-task-board',
  '.nepal-line-item-row',
  '.calendar-grid',
  '@media (max-width: 820px)',
  '@media (max-width: 360px)',
  '@media (max-height: 560px) and (orientation: landscape)'
]) assert.ok(css.includes(contract), `Missing responsive CSS contract: ${contract}`);

for (const contract of [
  '@media (max-height: 560px) and (orientation: landscape) and (max-width: 1000px)',
  '.fc3-mobile-bottom-nav',
  '.fc3-mobile-drawer.mobile-drawer',
  'dialog.modal[data-surface="record"]',
  '.product-project-mobile'
]) assert.ok(landscapeCss.includes(contract), `Missing landscape responsive contract: ${contract}`);

for (const contract of [
  "const VERSION = 'FORMCRAFT-RESPONSIVE-2.0'",
  'const isShortLandscape',
  'const usesMobileShell',
  'function updateViewportState',
  'function decorateResponsiveTables',
  'function syncBottomInset',
  'function clippedInteractiveElements',
  'function audit()',
  'table.dataset.responsiveTable',
  'visualViewport',
  'window.FormcraftResponsive',
  'const pendingRoots = new Set()',
  'fullRefreshPending',
  'function decorateRoot',
  'function flushScheduledWork'
]) assert.ok(runtime.includes(contract), `Missing responsive runtime contract: ${contract}`);

assert.ok(!runtime.includes("visualViewport?.addEventListener('scroll'"), 'viewport scroll must not trigger responsive layout writes on every frame');
assert.ok(runtime.includes('schedule(appRoot, true)'), 'intentional shell and viewport changes must still request a full responsive refresh');
assert.ok(runtime.includes('roots.forEach(root => schedule(root))'), 'ordinary DOM mutations must use incremental subtree decoration');

for (const contract of [
  'product-project-mobile',
  'product-project-card-meta',
  'product-project-card-progress',
  'data-label="Project"',
  'data-label="Owner"',
  'data-label="Status"',
  'data-label="Progress"',
  'data-label="Due"',
  'data-label="Actions"'
]) assert.ok(dashboard.includes(contract), `Missing responsive dashboard contract: ${contract}`);

for (const bug of ['RDES-001', 'RDEV-001', 'RPO-001', 'Resolved', 'No known release-blocking responsive defects']) {
  assert.ok(docs.includes(bug), `Responsive audit documentation is missing: ${bug}`);
}

const pkg = JSON.parse(pkgText);
assert.ok(pkg.scripts.test.includes('responsive-system-audit.mjs'), 'Responsive static audit must run in npm test.');
assert.ok(pkg.scripts['test:responsive'].includes('responsive-system-v2.js'), 'Responsive runtime syntax must be checked.');
assert.ok(pkg.scripts['test:responsive'].includes('responsive-system-audit.mjs'), 'Responsive audit syntax must be checked.');
assert.ok(workflow.includes('working-directory: app'), 'Browser CI must run from the application workspace.');
assert.ok(workflow.includes("- 'app/**'"), 'Application changes must trigger browser CI.');
assert.ok(workflow.includes('python tests/responsive-system-browser-smoke.py'), 'Responsive browser regression must run in CI.');

assert.ok(!`${css}${landscapeCss}${runtime}`.includes('odoo.com'), 'Responsive runtime must not embed Odoo assets or source code.');
console.log('Responsive system contracts passed for incremental runtime work, dashboard, tables, boards, records, forms, calendar, invoices, mobile, tablet, landscape, and desktop layouts.');
