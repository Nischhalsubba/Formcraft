import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, iconography, runtime, css, packageJson, docs] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/js/premium-iconography.js', root), 'utf8'),
  readFile(new URL('assets/js/premium-interface-runtime.js', root), 'utf8'),
  readFile(new URL('assets/css/premium-interface.css', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8'),
  readFile(new URL('docs/PREMIUM_UI_E2E_AUDIT.md', root), 'utf8')
]);

for (const asset of [
  'assets/js/premium-iconography.js',
  'assets/js/premium-interface-runtime.js',
  'assets/css/premium-interface.css'
]) assert.ok(html.includes(asset), `Missing premium UI asset: ${asset}`);

assert.ok(html.includes('family=Inter') && html.includes('family=Manrope'), 'Inter and Manrope typography must be loaded.');
assert.ok(
  html.indexOf('assets/js/premium-iconography.js') > html.indexOf('assets/js/erp-suite-schema.js') &&
  html.indexOf('assets/js/premium-iconography.js') < html.indexOf('assets/js/erp-suite-ui.js'),
  'Premium iconography must load after ERP schema and before ERP UI.'
);
assert.ok(
  html.indexOf('assets/js/premium-interface-runtime.js') > html.indexOf('assets/js/workspace-architecture-v3-runtime.js') &&
  html.indexOf('assets/js/premium-interface-runtime.js') < html.indexOf('assets/js/motion.js'),
  'Premium runtime must decorate the final shell before motion wraps it.'
);

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
const nativeApps = ['dashboard', 'apps', 'projects', 'tasks', 'calendar', 'team', 'reports', 'mail', 'files', 'invoices', 'activity', 'settings'];
const groupIcons = ['group-essentials', 'group-finance', 'group-sales', 'group-websites', 'group-supply', 'group-hr', 'group-marketing', 'group-services', 'group-productivity'];
for (const name of [...expectedApps, ...nativeApps, ...groupIcons]) {
  assert.match(iconography, new RegExp("\\n\\s*['\"]?" + name + "['\"]?:\\s*`"), `Missing premium icon definition: ${name}`);
}

for (const contract of [
  "const VERSION = 'FORMCRAFT-ICONOGRAPHY-1.0'",
  'Object.assign(icons, premiumIcons)',
  'icon = function premiumFormcraftIcon',
  'data-icon=',
  'ERP.MODULES.forEach',
  'ERP.NATIVE_APPS.forEach',
  'ERP.GROUPS.forEach',
  'window.FormcraftIconography'
]) assert.ok(iconography.includes(contract), `Missing iconography contract: ${contract}`);

for (const contract of [
  "const VERSION = 'FORMCRAFT-PREMIUM-UI-1.0'",
  'function decorateAppCards',
  'function normalizeAppsState',
  'is-parent-active',
  'data-nav-state',
  'window.FormcraftPremiumInterface'
]) assert.ok(runtime.includes(contract), `Missing premium interface contract: ${contract}`);

for (const selector of [
  '--font-display:',
  '.fc-icon .fc-icon-accent',
  '[data-nav-state="inactive"]',
  '[data-nav-state="active"]',
  '[data-nav-state="parent"]',
  '.fc3-context-link[data-nav-state="active"]',
  '.fc3-rail-button[data-nav-state="parent"]',
  '.erp-app-card',
  '.erp-app-grid',
  '.erp-app-icon',
  '@media (max-width: 820px)',
  '@media (prefers-reduced-motion: reduce)'
]) assert.ok(css.includes(selector), `Missing premium UI style contract: ${selector}`);

for (const group of ['essentials', 'finance', 'sales', 'websites', 'supply', 'hr', 'marketing', 'services', 'productivity']) {
  assert.ok(css.includes(`[data-app-group="${group}"]`), `Missing semantic group tone: ${group}`);
}

for (const bug of ['DES-001', 'DEV-001', 'PO-001', 'Resolved', 'No known release-blocking defects']) {
  assert.ok(docs.includes(bug), `Missing E2E audit evidence: ${bug}`);
}

const pkg = JSON.parse(packageJson);
assert.ok(pkg.scripts.test.includes('premium-iconography-audit.mjs'), 'Premium audit must run in npm test.');
assert.ok(pkg.scripts.verify.includes('test:premium'), 'Premium syntax verification must be part of the fail-closed build.');
assert.ok(pkg.scripts['test:premium'].includes('premium-iconography.js'), 'Premium iconography syntax must be checked.');
assert.ok(pkg.scripts['test:premium'].includes('premium-interface-runtime.js'), 'Premium runtime syntax must be checked.');
assert.ok(pkg.scripts['test:premium'].includes('premium-iconography-audit.mjs'), 'Premium audit syntax must be checked.');

assert.ok(!`${iconography}${runtime}${css}`.includes('odoo.com'), 'Premium UI must not embed Odoo assets or source code.');
console.log(`Premium iconography and interface contracts passed for ${expectedApps.length} ERP apps, ${nativeApps.length} native icons, and ${groupIcons.length} group icons.`);
