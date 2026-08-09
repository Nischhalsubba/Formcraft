import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('assets/js/product-depth-core.js', 'utf8');
assert(source.includes('FORMCRAFT-PRODUCT-DEPTH-1.0'), 'Product depth version marker missing');
assert(source.includes('calculateTransaction'), 'Transaction engine missing');
assert(source.includes('inboxItems'), 'Work Inbox aggregator missing');
assert(source.includes('upsertSavedView'), 'Saved views foundation missing');
assert(source.includes('recordVersion'), 'Audit/version history missing');
assert(source.includes('parseCsv'), 'Import center parser missing');
assert(source.includes('validateAutomation'), 'Automation model validator missing');
assert(source.includes('queueIntegration'), 'Integration outbox missing');
assert(source.includes('portalModel'), 'Portal view-model foundation missing');
assert(!source.includes('localStorage'), 'Product depth business state must not use localStorage');
assert(!source.includes('sessionStorage'), 'Product depth business state must not use sessionStorage');

const collections = {
  approvals: [{ id: 'a1', name: 'Purchase approval', status: 'submitted' }],
  helpdesk: [{ id: 't1', subject: 'Payment issue', status: 'new', priority: 'high' }],
  timeoff: [], payroll: [], attendance: [], employees: [], contacts: [], crm: [], sales: [], purchase: [], payments: []
};
const state = { erp: {}, tasks: [{ id: 'task1', title: 'Call customer', status: 'todo', dueDate: '2020-01-01' }], invoices: [] };
const context = {
  console,
  structuredClone,
  CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  document: { documentElement: { dataset: {} }, dispatchEvent() {} },
  state,
  window: {
    FormcraftERP: {
      ensureERPState() { state.erp.settings ||= {}; },
      collection(key) { return collections[key] ||= []; },
      modulesByKey: new Map([
        ['sales', { key: 'sales', fields: [{ name: 'number', required: true }] }],
        ['employees', { key: 'employees', fields: [] }]
      ]),
      allApps: [{ key: 'sales' }, { key: 'employees' }]
    },
    saveState() {},
    FormcraftBackend: { session: { user: { id: 'u1' } } }
  }
};
context.window.window = context.window;
context.window.state = state;
context.window.document = context.document;
vm.createContext(context);
vm.runInContext(source, context);

const api = context.window.FormcraftProductDepth;
assert(api, 'Product depth API was not exposed');
const calc = api.transaction.calculate([
  { productId: 'p1', quantity: 2, unitPrice: 100, discountRate: 10, taxRate: 13 },
  { productId: 'p2', quantity: 1, unitPrice: 50, taxRate: 0 }
]);
assert.equal(calc.subtotal, 230);
assert.equal(calc.discount, 20);
assert.equal(calc.tax, 23.4);
assert.equal(calc.total, 253.4);

const order = { id: 'so1' };
api.transaction.apply(order, calc.lines);
assert.equal(order.lineItems.length, 2);
assert.equal(order.total, 253.4);
assert.equal(order.quantity, 3);

const inbox = api.inbox.items();
assert(inbox.some(item => item.kind === 'approval'));
assert(inbox.some(item => item.kind === 'task'));
assert(inbox.some(item => item.kind === 'ticket'));
assert.equal(inbox[0].priority, 'high');

const parsed = api.imports.parseCsv('Name,Amount\nA,10\nB,20');
assert.equal(Array.from(parsed.headers).join('|'), 'Name|Amount');
assert.equal(parsed.rows.length, 2);

const automation = api.automation.validate({ name: 'Follow up', trigger: { type: 'status-changed' }, actions: [{ type: 'notify' }] });
assert.equal(automation.valid, true);

const invalidAutomation = api.automation.validate({ name: '', trigger: {}, actions: [] });
assert.equal(invalidAutomation.valid, false);

console.log('Product depth core audit passed');
