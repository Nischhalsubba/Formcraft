import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../assets/js/integrated-operations-core.js', import.meta.url), 'utf8');
const fixedToday = new Date('2026-08-02T06:15:00.000Z');
let sequence = 0;
let rendered = 0;
let navigated = null;
let historyUrl = '';

const state = {
  projects: [
    { id: 'project-1', name: 'Formcraft setup', code: 'FORM', progressMode: 'automatic', status: 'active', createdAt: '2026-08-01T00:00:00.000Z' },
    { id: 'project-2', name: 'Formcraft support', code: 'FORM', progressMode: 'automatic', status: 'active', createdAt: '2026-08-01T00:00:00.000Z' }
  ],
  tasks: [
    { id: 'task-1', projectId: 'project-1', key: 'FORM-001', title: 'Completed task', status: 'done', estimateHours: 2 },
    { id: 'task-2', projectId: 'project-1', key: 'FORM-001', title: 'Open task', status: 'progress', estimateHours: 6 },
    { id: 'task-3', projectId: 'project-2', title: 'Other project task', status: 'todo', estimateHours: 1 }
  ],
  events: [{ id: 'event-1', projectId: 'project-1', title: 'Review' }],
  invoices: [
    { id: 'invoice-1', projectId: 'project-1', status: 'sent', currency: 'NPR', total: 1000, payments: [{ type: 'payment', amount: 250 }] },
    { id: 'invoice-2', projectId: 'project-1', status: 'paid', currency: 'NPR', total: 500 }
  ],
  files: [{ id: 'file-1', taskId: 'task-1', name: 'brief.pdf' }],
  activity: [],
  team: [{ id: 'user-1', name: 'Test User' }],
  timeEntries: [{ id: 'time-1', projectId: 'project-1', taskId: 'task-1', userId: 'user-1', hours: 1.5, billable: true }],
  settings: {}
};

const classList = {
  values: new Set(),
  add(value) { this.values.add(value); },
  remove(value) { this.values.delete(value); },
  toggle(value, force) { if (force) this.values.add(value); else this.values.delete(value); }
};
const modal = { open: false, dataset: {}, addEventListener() {}, removeAttribute() {} };
const location = { href: 'https://example.test/#projects', hash: '#projects' };
const history = {
  state: null,
  pushState(stateValue, _title, url) {
    this.state = stateValue;
    historyUrl = String(url);
    location.href = String(url);
    location.hash = new URL(String(url)).hash;
  },
  replaceState(stateValue, _title, url) {
    this.state = stateValue;
    historyUrl = String(url);
    location.href = String(url);
    location.hash = new URL(String(url)).hash;
  }
};

const context = {
  console, URL, Date, Number, Math, String, Set, Map, RegExp, Boolean, Object, Array,
  window: { FormcraftBackend: { session: { user: { id: 'user-1' } }, role: 'owner' }, addEventListener() {} },
  document: { body: { classList }, querySelector() { return null; } },
  location,
  history,
  modal,
  modalContent: { innerHTML: '' },
  state,
  ui: { route: 'projects' },
  routes: { projects: {}, tasks: {}, dashboard: {} },
  renderPage: () => '<base-page>',
  renderShell: () => { rendered += 1; return '<shell>'; },
  navigate: route => { navigated = route; },
  openModal: () => {},
  closeModal: () => { modal.open = false; },
  openInvoiceForm: () => {},
  openEventForm: () => {},
  logActivity: () => {},
  toggleTask: () => {},
  renderReports: () => '<reports>',
  dateKey: date => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`,
  today: () => new Date(fixedToday),
  addDays: (days, base = fixedToday) => new Date(base.getTime() + days * 86400000),
  titleCase: value => String(value).replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
  formatShortDate: value => value,
  nprMoney: value => `NPR ${Number(value).toFixed(2)}`,
  dualDate: value => value,
  escapeHtml: value => String(value ?? ''),
  toast: () => {},
  uid: () => `uid-${++sequence}`,
  queueMicrotask: callback => callback(),
  requestAnimationFrame: callback => callback()
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'integrated-operations-core.js' });

const C = context.window.FormcraftOpsCore;
assert.ok(C, 'Operations core must initialize.');
assert.equal(C.VERSION, 'OPS-NP-2.0');
assert.notEqual(state.projects[0].code, state.projects[1].code, 'Project codes must be unique.');
assert.equal(new Set(state.tasks.map(task => task.key)).size, state.tasks.length, 'Task keys must be unique.');
assert.equal(state.projects[0].progress, 25, 'Weighted task progress must be calculated from estimates.');
assert.equal(C.health(state.projects[0]), 'on-track');

const projectMetrics = C.metrics(state.projects[0]);
assert.equal(projectMetrics.completed, 1);
assert.equal(projectMetrics.loggedHours, 1.5);
assert.equal(projectMetrics.billableHours, 1.5);
assert.equal(projectMetrics.billed, 1500);
assert.equal(projectMetrics.paid, 750);
assert.equal(projectMetrics.outstanding, 750);
assert.equal(projectMetrics.events.length, 1);
assert.equal(projectMetrics.files.length, 1);

state.tasks[0].dependencyIds = [state.tasks[1].id];
assert.equal(C.canLinkDependency(state.tasks[1].id, state.tasks[0].id), false, 'Circular dependency must be rejected.');
assert.equal(C.canLinkDependency(state.tasks[0].id, state.tasks[2].id), true);
state.tasks[0].parentTaskId = state.tasks[1].id;
assert.equal(C.canSetParent(state.tasks[1].id, state.tasks[0].id), false, 'Circular parent hierarchy must be rejected.');

C.openRecord('project', 'project-1');
assert.equal(C.record.type, 'project');
assert.equal(C.record.id, 'project-1');
assert.match(historyUrl, /record=project/);
assert.match(historyUrl, /recordId=project-1/);
assert.equal(context.ui.route, 'projects');
assert.equal(classList.values.has('ops-record-open'), true);
assert.ok(rendered > 0);

C.closeRecord();
assert.equal(C.record.type, '');
assert.equal(classList.values.has('ops-record-open'), false);
assert.equal(new URL(historyUrl).searchParams.has('record'), false);

context.navigate('tasks');
assert.equal(navigated, 'tasks');
assert.equal(new URL(location.href).searchParams.has('record'), false);

console.log('Integrated operations model, calculation, relationship, and route tests passed.');
