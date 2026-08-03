import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css, runtime, dashboard, pkgText, workflow, docs] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/css/responsive-system-v2.css', root), 'utf8'),
  readFile(new URL('assets/js/responsive-system-v2.js', root), 'utf8'),
  readFile(new URL('assets/js/formcraft-bright-dashboard.js', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8'),
  readFile(new URL('.github/workflows/erp-suite-browser-validation.yml', root), 'utf8'),
  readFile(new URL('docs/RESPONSIVE_SYSTEM_AUDIT.md', root), 'utf8')
]);

for (const asset of [
  'assets/css/responsive-system-v2.css',
  'assets/js/responsive-system-v2.js'
]) assert.ok(html.includes(asset), `Missing responsive system asset: ${asset}`);

assert.ok(
  html.indexOf('assets/css/responsive-system-v2.css') > html.indexOf('assets/css/premium-interface-geometry.css'),
  'Responsive CSS must load after all architecture and premium geometry layers.'
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
  "const VERSION = 'FORMCRAFT-RESPONSIVE-2.0'",
  'function updateViewportState',
  'function decorateResponsiveTables',
  'function syncBottomInset',
  'function clippedInteractiveElements',
  'function audit()',
  'table.dataset.responsiveTable',
  'visualViewport',
  'window.FormcraftResponsive'
]) assert.ok(runtime.includes(contract), `Missing responsive runtime contract: ${contract}`);

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
assert.ok(workflow.includes('tests/responsive-system-browser-smoke.py'), 'Responsive browser regression must run in CI.');
assert.ok(workflow.includes('assets/css/responsive-system-v2.css'), 'Responsive CSS must trigger CI.');
assert.ok(workflow.includes('assets/js/responsive-system-v2.js'), 'Responsive runtime must trigger CI.');

assert.ok(!`${css}${runtime}`.includes('odoo.com'), 'Responsive runtime must not embed Odoo assets or source code.');
console.log('Responsive system contracts passed for dashboard, tables, boards, records, forms, calendar, invoices, mobile, tablet, landscape, and desktop layouts.');
