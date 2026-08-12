import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, js, css, pkgText, workflow, docs] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/js/demo-data-system.js', root), 'utf8'),
  readFile(new URL('assets/css/demo-data-system.css', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8'),
  readFile(new URL('.github/workflows/erp-suite-browser-validation.yml', root), 'utf8'),
  readFile(new URL('docs/DEMO_DATA_AND_FORM_WORKFLOWS.md', root), 'utf8')
]);

for (const asset of ['assets/css/demo-data-system.css', 'assets/js/demo-data-system.js']) assert.ok(html.includes(asset), `Missing demo data asset: ${asset}`);
assert.ok(html.indexOf('assets/css/demo-data-system.css') > html.indexOf('assets/css/form-workflow-enhancements.css'), 'Demo data CSS must load after workflow CSS.');
assert.ok(html.indexOf('assets/js/demo-data-system.js') > html.indexOf('assets/js/form-workflow-enhancements.js'), 'Demo data runtime must load after form workflow runtime.');

for (const contract of ["const VERSION = 'FORMCRAFT-DEMO-DATA-1.0'", 'const MIN_RECORDS = 20', 'NATIVE_COLLECTIONS', 'EXTRA_COLLECTIONS', 'WORKFLOW_CHAINS', 'function seedDemoData', 'function resetDemoData', 'function coverageManifest', 'function integrityAudit', 'function linkCoreWorkflows', "routes['data-lab']", 'demoData: true', 'window.FormcraftDemoData']) assert.ok(js.includes(contract), `Missing demo data contract: ${contract}`);
for (const chain of ['Lead to cash', 'Procure to pay', 'Project to invoice', 'Employee to payroll', 'Ticket to resolution', 'Plan to produce']) assert.ok(js.includes(chain), `Missing cross-module chain: ${chain}`);
for (const contract of ['.data-lab-hero', '.data-lab-metrics', '.demo-impact-chain', '.demo-coverage-table', '.demo-section-grid', '@media (max-width: 820px)']) assert.ok(css.includes(contract), `Missing demo data CSS contract: ${contract}`);
for (const section of ['# Connected demo data and form workflows', '## Data safety', '## Coverage contract', '## Cross-module effects', '## Form workflow improvements', '## Test matrix']) assert.ok(docs.includes(section), `Demo data documentation is missing: ${section}`);

const pkg = JSON.parse(pkgText);
assert.ok(pkg.scripts.test.includes('demo-data-system-audit.mjs'), 'Demo data static audit must run in npm test.');
assert.ok(pkg.scripts['test:syntax'].includes('demo-data-system.js'), 'Demo data runtime must receive a syntax check.');
assert.ok(workflow.includes('tests/demo-data-form-workflows-browser-smoke.py'), 'Demo data browser regression must run in CI.');
assert.ok(workflow.includes('demo-data-visual-snapshots'), 'Visual snapshot artifacts must be uploaded in CI.');
console.log('Demo data contracts passed for 20-record coverage, inner activity, safe reset, relationships, impact chains, and visual evidence.');
