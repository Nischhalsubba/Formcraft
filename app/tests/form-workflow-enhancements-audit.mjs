// Verifies draft, validation, relation, calculation, review, and browser-regression contracts for enhanced forms.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appRoot = new URL('../', import.meta.url);
const repositoryRoot = new URL('../../', import.meta.url);
const [html, js, css, pkgText, workflow, demo] = await Promise.all([
  readFile(new URL('index.html', appRoot), 'utf8'),
  readFile(new URL('assets/js/form-workflow-enhancements.js', appRoot), 'utf8'),
  readFile(new URL('assets/css/form-workflow-enhancements.css', appRoot), 'utf8'),
  readFile(new URL('package.json', appRoot), 'utf8'),
  readFile(new URL('.github/workflows/browser-regression.yml', repositoryRoot), 'utf8'),
  readFile(new URL('assets/js/demo-data-system.js', appRoot), 'utf8')
]);

for (const asset of ['assets/css/form-workflow-enhancements.css', 'assets/js/form-workflow-enhancements.js']) assert.ok(html.includes(asset), `Missing form workflow asset: ${asset}`);
assert.ok(html.indexOf('assets/css/form-workflow-enhancements.css') > html.indexOf('assets/css/form-modal-responsive.css'), 'Workflow CSS must load after modal hardening.');
assert.ok(html.indexOf('assets/js/form-workflow-enhancements.js') > html.indexOf('assets/js/form-modal-responsive.js'), 'Workflow runtime must load after modal hardening.');
assert.ok(html.indexOf('assets/js/demo-data-system.js') > html.indexOf('assets/js/form-workflow-enhancements.js'), 'Demo system must load after form workflows.');

for (const contract of ["const VERSION = 'FORMCRAFT-FORM-WORKFLOW-1.0'", 'FORM_SECTIONS', 'saveDraft', 'readDraft', 'validateERPForm', 'enhanceRelationSearch', 'enhanceCalculations', 'showReview', 'confirmationDialog', 'Save & add another', 'renderFormAdminPanel', 'analyticsSummary', 'Discard unsaved changes?', 'window.FormcraftFormWorkflow']) assert.ok(js.includes(contract), `Missing form workflow contract: ${contract}`);
for (const contract of ['.erp-form-section', '.erp-relation-search', '.erp-calculation-breakdown', '.erp-draft-recovered', '.erp-form-review', '.workflow-confirm-dialog', '.form-admin-card', '[aria-invalid="true"]', '@media (max-width: 820px)']) assert.ok(css.includes(contract), `Missing form workflow CSS contract: ${contract}`);
assert.ok(demo.includes('renderFormAdminPanel'), 'Admin form configuration must be visible in the data lab.');
const pkg = JSON.parse(pkgText);
assert.ok(pkg.scripts.test.includes('form-workflow-enhancements-audit.mjs'), 'Form workflow static audit must run in npm test.');
assert.ok(pkg.scripts['test:syntax'].includes('form-workflow-enhancements.js'), 'Form workflow runtime must receive a syntax check.');
assert.ok(workflow.includes('working-directory: app'), 'Browser CI must run from the application workspace.');
assert.ok(workflow.includes('python tests/demo-data-form-workflows-browser-smoke.py'), 'Form workflow browser regression must run in CI.');
console.log('Form workflow contracts passed for drafts, validation, calculations, searchable relations, review, analytics, and admin layout controls.');
