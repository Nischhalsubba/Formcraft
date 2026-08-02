import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, schema, ui, workflows, css, docs, migration] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/js/erp-suite-schema.js', root), 'utf8'),
  readFile(new URL('assets/js/erp-suite-ui.js', root), 'utf8'),
  readFile(new URL('assets/js/erp-suite-workflows.js', root), 'utf8'),
  readFile(new URL('assets/css/erp-suite.css', root), 'utf8'),
  readFile(new URL('docs/ERP_SUITE_IMPLEMENTATION_STATUS.md', root), 'utf8'),
  readFile(new URL('supabase/migrations/20260802170000_erp_relational_foundation.sql', root), 'utf8')
]);

for (const token of [
  'assets/css/erp-suite.css',
  'assets/js/erp-suite-schema.js',
  'assets/js/erp-suite-ui.js',
  'assets/js/erp-suite-workflows.js'
]) assert.ok(html.includes(token), `Missing ERP asset: ${token}`);

const expectedGroups = ['essentials', 'finance', 'sales', 'websites', 'supply', 'hr', 'marketing', 'services', 'productivity'];
for (const group of expectedGroups) assert.ok(schema.includes(`key: '${group}'`), `Missing ERP group: ${group}`);

const expectedApps = [
  'contacts', 'activities', 'approvals', 'automations', 'studio',
  'accounting', 'expenses', 'payments', 'crm', 'sales', 'pos', 'subscriptions', 'rental',
  'website', 'ecommerce', 'elearning', 'forum', 'blog', 'livechat',
  'purchase', 'inventory', 'barcode', 'manufacturing', 'quality', 'maintenance', 'plm', 'repairs',
  'employees', 'attendance', 'timeoff', 'recruitment', 'appraisals', 'payroll', 'fleet', 'frontdesk', 'referrals', 'lunch',
  'emailmarketing', 'smsmarketing', 'marketingautomation', 'events', 'marketingcards', 'surveys',
  'timesheets', 'planning', 'fieldservice', 'helpdesk', 'appointments',
  'documents', 'sign', 'spreadsheet', 'dashboards', 'knowledge', 'discuss', 'datacleaning'
];
for (const app of expectedApps) assert.ok(schema.includes(`key: '${app}'`), `Missing ERP app: ${app}`);

for (const token of [
  'function renderAppLauncher',
  'function renderModulePage',
  'function renderRecordPage',
  'function openRecordForm',
  'data-erp-launcher-search',
  'data-erp-module-view',
  'data-erp-drag-record',
  'data-erp-record-tab',
  'data-erp-company',
  'data-erp-branch',
  'window.FormcraftERPUI'
]) assert.ok(ui.includes(token), `Missing ERP UI contract: ${token}`);

for (const token of [
  'function createInvoice',
  'function createStockMove',
  'function createSalesOrderFromLead',
  'function createTaskFromTicket',
  "case 'crm-quotation'",
  "case 'purchase-receive'",
  "case 'manufacturing-complete'",
  "case 'payroll-compute'",
  "case 'ticket-task'",
  'window.FormcraftERPWorkflows'
]) assert.ok(workflows.includes(token), `Missing ERP workflow contract: ${token}`);

for (const token of [
  '.erp-app-grid', '.erp-module-toolbar', '.erp-table', '.erp-board', '.erp-record-page',
  '.erp-record-tabs', '.erp-form-grid', '.erp-context-switchers', '.erp-summary-grid'
]) assert.ok(css.includes(token), `Missing ERP style contract: ${token}`);

for (const token of [
  'erp_companies', 'erp_branches', 'erp_records', 'erp_record_links', 'erp_record_events',
  'erp_approval_steps', 'erp_automation_jobs', 'erp_posting_locks', 'erp_upsert_record',
  'enable row level security', 'ERP record conflict', 'The posting period is locked'
]) assert.ok(migration.includes(token), `Missing ERP migration contract: ${token}`);

assert.ok(docs.includes('One-to-one full Odoo feature parity: not yet a truthful production claim.'), 'Documentation must state the parity boundary honestly.');
assert.ok(docs.includes('Application launcher and all official Odoo master app categories: implemented.'), 'Documentation must state implemented launcher coverage.');
assert.ok(!`${schema}${ui}${workflows}${css}`.includes('odoo.com'), 'Runtime must not embed Odoo assets or application code.');

console.log(`ERP suite contracts passed for ${expectedApps.length} metadata-driven apps across ${expectedGroups.length} groups.`);
