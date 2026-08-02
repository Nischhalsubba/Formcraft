import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, core, views, actions, legacyCss, routingCss, roadmap] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/js/integrated-operations-core.js', root), 'utf8'),
  readFile(new URL('assets/js/integrated-operations-views.js', root), 'utf8'),
  readFile(new URL('assets/js/integrated-operations-actions.js', root), 'utf8'),
  readFile(new URL('assets/css/integrated-operations.css', root), 'utf8'),
  readFile(new URL('assets/css/integrated-operations-routing.css', root), 'utf8'),
  readFile(new URL('docs/UX_ARCHITECTURE_AND_ERP_ROADMAP.md', root), 'utf8')
]);

for (const token of [
  'assets/css/integrated-operations.css',
  'assets/css/integrated-operations-routing.css',
  'assets/js/integrated-operations-core.js',
  'assets/js/integrated-operations-views.js',
  'assets/js/integrated-operations-actions.js'
]) assert.ok(html.includes(token), `Missing integrated operations asset: ${token}`);

for (const token of [
  "const VERSION = 'OPS-NP-2.0'",
  'state.timeEntries',
  'function metrics',
  'function health',
  'function syncProject',
  'function openRecord',
  'function closeRecord',
  'renderPage = function renderOperationsPage',
  "url.searchParams.set('record'",
  'function canLinkDependency',
  'function canSetParent',
  'window.FormcraftOpsCore'
]) assert.ok(core.includes(token), `Missing operations core contract: ${token}`);

for (const token of [
  'function taskTable',
  'const taskBoard',
  'function taskNavigator',
  'function projectRecord',
  'function taskRecord',
  'Automatic from completed tasks',
  'data-record-page="project"',
  'data-record-page="task"',
  'data-ops-task-status',
  'data-ops-task-priority',
  'data-ops-drag-task',
  'renderTasks = function renderOperationsTasks',
  'Project delivery and commercial report'
]) assert.ok(views.includes(token), `Missing operations view contract: ${token}`);

for (const token of [
  'function logTime',
  'function addDependency',
  'function addChecklist',
  'function removeTask',
  'function removeTimeEntry',
  'data-ops-create-invoice',
  'data-toggle-task',
  'openInvoiceForm = function openOperationsInvoiceForm',
  "document.addEventListener('drop'",
  "readiness: duplicateTaskKeys.length || dependencyCycles.length ? 'needs-attention' : 'ready-to-test'",
  'window.FormcraftOperations'
]) assert.ok(actions.includes(token), `Missing operations action contract: ${token}`);

const css = `${legacyCss}\n${routingCss}`;
for (const token of [
  '.ops-task-table',
  '.ops-task-board',
  '.ops-task-record',
  '.ops-project-record',
  '.ops-record-tabs',
  '.ops-task-commandbar',
  'body.ops-record-open .workspace-page-header',
  '.ops-task-column.is-drop-target',
  'dialog.modal[data-surface="form"]::backdrop'
]) assert.ok(css.includes(token), `Missing integrated operations style: ${token}`);

assert.ok(!core.includes("modal.dataset.surface = 'record'"), 'Record pages must not be simulated as modal surfaces.');
assert.ok(!core.includes('modal.show()'), 'Record pages must render through normal application routing.');

for (const token of [
  'Use a full record page',
  'Use a modal dialog',
  'Current UX audit',
  'Odoo-inspired module map',
  'Nepal finance and accounting',
  'The JSON workspace-state limit',
  'does not claim full Odoo parity'
]) assert.ok(roadmap.includes(token), `Missing UX/ERP roadmap section: ${token}`);

assert.ok(!`${core}${views}${actions}`.includes('odoo.com'), 'Runtime must not embed or copy Odoo assets or application code.');
console.log('Integrated record pages, Jira-style tasks, cross-module operations, permissions, and route contracts passed.');
