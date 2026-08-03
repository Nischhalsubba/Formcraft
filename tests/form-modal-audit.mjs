import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css, runtime, browserTest, report, pkgText, workflow] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/css/form-modal-responsive.css', root), 'utf8'),
  readFile(new URL('assets/js/form-modal-responsive.js', root), 'utf8'),
  readFile(new URL('tests/form-modal-browser-smoke.py', root), 'utf8'),
  readFile(new URL('docs/FORM_MODAL_E2E_AUDIT.md', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8'),
  readFile(new URL('.github/workflows/erp-suite-browser-validation.yml', root), 'utf8')
]);

assert.ok(html.includes('assets/css/form-modal-responsive.css'), 'Responsive form modal CSS is not loaded.');
assert.ok(html.includes('assets/js/form-modal-responsive.js'), 'Responsive form modal runtime is not loaded.');
assert.ok(
  html.indexOf('assets/css/form-modal-responsive.css') > html.indexOf('assets/css/ui-theme-studio.css'),
  'Form modal hardening must load after existing interface layers.'
);
assert.ok(
  html.indexOf('assets/js/form-modal-responsive.js') > html.indexOf('assets/js/simplified-workspace-actions.js'),
  'Form modal runtime must load after the final workspace action layer.'
);

for (const contract of [
  'dialog.modal[data-surface="form"]:has(.erp-record-form)',
  '.form-modal.erp-record-form',
  'min-inline-size: 0',
  '.erp-record-form .erp-form-grid',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  'html[data-formcraft-mobile-shell="true"]',
  'width: 100vw',
  'height: 100dvh',
  '.modal-actions-trailing',
  'env(safe-area-inset-bottom)',
  '@media (orientation: landscape) and (max-height: 560px)'
]) {
  assert.ok(css.includes(contract), `Missing form modal CSS contract: ${contract}`);
}

for (const contract of [
  "const VERSION = 'FORMCRAFT-FORM-MODAL-2.0'",
  'function labelFor',
  'function normalizeERPHeading',
  'function improveAccessibleDescription',
  'function updateScrollState',
  'function audit',
  'new MutationObserver',
  'new ResizeObserver',
  'window.FormcraftFormModal'
]) {
  assert.ok(runtime.includes(contract), `Missing form modal runtime contract: ${contract}`);
}

for (const contract of [
  "audit_every_module(page, expected_columns=2)",
  "audit_every_module(page, expected_columns=1)",
  'run_tablet',
  'run_compact_mobile',
  'run_mobile_landscape',
  'create_sales_order_through_ui',
  "FormcraftFormModal.audit()",
  "FormcraftERP.MODULES.map(module => module.key)"
]) {
  assert.ok(browserTest.includes(contract), `Missing form modal browser coverage: ${contract}`);
}

for (const section of [
  '# Form modal E2E audit',
  '## Root cause',
  '## Defects fixed',
  '## End-to-end coverage',
  '## Remaining product improvements',
  '## Release criteria'
]) {
  assert.ok(report.includes(section), `Form modal audit report is missing: ${section}`);
}

const pkg = JSON.parse(pkgText);
assert.ok(pkg.scripts.test.includes('form-modal-audit.mjs'), 'Form modal static audit must run in npm test.');
assert.ok(pkg.scripts['test:syntax'].includes('form-modal-responsive.js'), 'Form modal runtime must receive a syntax check.');
assert.ok(workflow.includes('tests/form-modal-browser-smoke.py'), 'Form modal browser regression must run in CI.');
assert.ok(workflow.includes('assets/css/form-modal-responsive.css'), 'Form modal CSS changes must trigger CI.');
assert.ok(workflow.includes('assets/js/form-modal-responsive.js'), 'Form modal runtime changes must trigger CI.');

console.log('Form modal width, scroll, accessibility, responsive, all-module, and sales-order E2E contracts passed.');
