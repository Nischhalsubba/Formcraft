'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-1.0';
  const ERP = window.FormcraftERP;
  if (!ERP) return;

  const arr = value => Array.isArray(value) ? value : [];
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = (value, precision = 2) => {
    const factor = 10 ** precision;
    return Math.round((num(value) + Number.EPSILON) * factor) / factor;
  };
  const now = () => new Date().toISOString();
  const uid = () => typeof window.uid === 'function'
    ? window.uid()
    : `pd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  function ensureDepthState() {
    ERP.ensureERPState();
    state.erp.productDepth = object(state.erp.productDepth);
    const depth = state.erp.productDepth;
    depth.version = VERSION;
    depth.savedViews = arr(depth.savedViews);
    depth.auditVersions = arr(depth.auditVersions);
    depth.importJobs = arr(depth.importJobs);
    depth.automationRuns = arr(depth.automationRuns);
    depth.integrationOutbox = arr(depth.integrationOutbox);
    depth.portalSessions = arr(depth.portalSessions);
    depth.preferences = object(depth.preferences);
    return depth;
  }

  async function persist() {
    if (typeof window.saveState !== 'function') return false;
    await Promise.resolve(window.saveState());
    return true;
  }

  function parseLines(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function normalizeLine(line = {}, index = 0) {
    const quantity = Math.max(0, num(line.quantity));
    const unitPrice = Math.max(0, num(line.unitPrice));
    const discountRate = Math.min(100, Math.max(0, num(line.discountRate ?? line.discount)));
    const taxRate = Math.min(100, Math.max(0, num(line.taxRate)));
    const gross = round(quantity * unitPrice);
    const discountAmount = round(gross * discountRate / 100);
    const net = round(gross - discountAmount);
    const taxAmount = round(net * taxRate / 100);
    return {
      id: String(line.id || `line-${index + 1}`),
      productId: String(line.productId || ''),
      description: String(line.description || line.name || ''),
      unit: String(line.unit || 'unit'),
      quantity,
      unitPrice,
      discountRate,
      discountAmount,
      taxRate,
      taxAmount,
      subtotal: net,
      total: round(net + taxAmount),
      deliveredQuantity: Math.min(quantity, Math.max(0, num(line.deliveredQuantity))),
      invoicedQuantity: Math.min(quantity, Math.max(0, num(line.invoicedQuantity)))
    };
  }

  function calculateTransaction(linesInput, options = {}) {
    const lines = parseLines(linesInput).map(normalizeLine).filter(line => line.quantity > 0 || line.description || line.productId);
    const subtotal = round(lines.reduce((sum, line) => sum + line.subtotal, 0));
    const discount = round(lines.reduce((sum, line) => sum + line.discountAmount, 0));
    const tax = round(lines.reduce((sum, line) => sum + line.taxAmount, 0));
    const shipping = Math.max(0, num(options.shipping));
    const adjustment = num(options.adjustment);
    const total = round(subtotal + tax + shipping + adjustment);
    return { lines, subtotal, discount, tax, shipping, adjustment, total };
  }

  function legacyLine(record = {}) {
    if (!record.productId && !num(record.quantity) && !num(record.unitPrice) && !num(record.total)) return [];
    return [{
      productId: record.productId || '',
      description: record.description || record.notes || '',
      quantity: num(record.quantity) || 1,
      unitPrice: num(record.unitPrice) || num(record.total),
      discountRate: num(record.discount),
      taxRate: num(record.taxRate),
      deliveredQuantity: num(record.deliveredQuantity),
      invoicedQuantity: num(record.invoicedQuantity)
    }];
  }

  function linesForRecord(record = {}) {
    const explicit = parseLines(record.lineItemsJson || record.lineItems);
    return explicit.length ? explicit.map(normalizeLine) : legacyLine(record).map(normalizeLine);
  }

  function applyTransaction(record, linesInput, options = {}) {
    if (!record) throw new Error('A transaction record is required.');
    const calculation = calculateTransaction(linesInput, options);
    record.lineItems = calculation.lines;
    record.lineItemsJson = JSON.stringify(calculation.lines);
    record.subtotal = calculation.subtotal;
    record.discountTotal = calculation.discount;
    record.taxTotal = calculation.tax;
    record.shipping = calculation.shipping;
    record.adjustment = calculation.adjustment;
    record.total = calculation.total;
    if (calculation.lines[0]) {
      const first = calculation.lines[0];
      record.productId = first.productId;
      record.quantity = round(calculation.lines.reduce((sum, line) => sum + line.quantity, 0), 3);
      record.unitPrice = first.unitPrice;
      record.discount = first.discountRate;
      record.taxRate = first.taxRate;
    }
    record.updatedAt = now();
    return calculation;
  }

  function invoicePayloadFrom(record, options = {}) {
    const calculation = calculateTransaction(linesForRecord(record), options);
    return {
      lineItems: calculation.lines,
      lineItemsJson: JSON.stringify(calculation.lines),
      subtotal: calculation.subtotal,
      discountTotal: calculation.discount,
      taxTotal: calculation.tax,
      shipping: calculation.shipping,
      adjustment: calculation.adjustment,
      total: calculation.total,
      amount: calculation.total
    };
  }

  function stockDeltas(record, direction = 'out') {
    const sign = direction === 'in' ? 1 : -1;
    return linesForRecord(record)
      .filter(line => line.productId && line.quantity > 0)
      .map(line => ({ productId: line.productId, quantity: round(line.quantity * sign, 3), sourceLineId: line.id }));
  }

  function inboxItems() {
    ensureDepthState();
    const items = [];
    const push = (kind, source, record, title, detail, priority = 'normal', dueAt = '') => {
      if (!record) return;
      items.push({
        id: `${kind}:${record.id || uid()}`,
        kind,
        source,
        recordId: record.id || '',
        title: String(title || 'Work item'),
        detail: String(detail || ''),
        priority,
        dueAt: dueAt || '',
        updatedAt: record.updatedAt || record.createdAt || ''
      });
    };

    ERP.collection('approvals').filter(item => ['draft', 'submitted'].includes(item.status)).forEach(item =>
      push('approval', 'approvals', item, item.name || 'Approval request', item.status === 'submitted' ? 'Decision required' : 'Draft approval', item.status === 'submitted' ? 'high' : 'normal'));

    arr(state.tasks).filter(item => !['done', 'closed', 'cancelled'].includes(item.status)).forEach(item => {
      const overdue = item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10);
      push('task', 'tasks', item, item.title || item.key || 'Task', overdue ? 'Overdue task' : 'Open task', overdue ? 'high' : 'normal', item.dueDate || '');
    });

    ERP.collection('helpdesk').filter(item => !['resolved', 'closed'].includes(item.status)).forEach(item =>
      push('ticket', 'helpdesk', item, item.subject || 'Helpdesk ticket', `${item.priority || 'normal'} priority · ${item.status || 'open'}`, item.priority === 'urgent' ? 'critical' : item.priority === 'high' ? 'high' : 'normal', item.slaDue || ''));

    ERP.collection('timeoff').filter(item => ['draft', 'submitted', 'pending'].includes(item.status)).forEach(item =>
      push('leave', 'timeoff', item, item.name || item.leaveType || 'Leave request', 'Leave decision pending', 'normal', item.startDate || ''));

    ERP.collection('payroll').filter(item => ['draft', 'computed'].includes(item.status)).forEach(item =>
      push('payroll', 'payroll', item, item.name || 'Payroll run', item.status === 'computed' ? 'Payroll review required' : 'Payroll preparation incomplete', 'high'));

    ERP.collection('attendance').filter(item => ['absent', 'exception', 'missing'].includes(String(item.status || '').toLowerCase())).forEach(item =>
      push('attendance', 'attendance', item, item.employeeName || 'Attendance exception', 'Attendance requires review', 'high', item.date || ''));

    const weight = { critical: 4, high: 3, normal: 2, low: 1 };
    return items.sort((a, b) => (weight[b.priority] - weight[a.priority]) || String(a.dueAt || '9999').localeCompare(String(b.dueAt || '9999')) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  function upsertSavedView(view) {
    const depth = ensureDepthState();
    if (!view?.moduleKey || !view?.name) throw new Error('Saved views require moduleKey and name.');
    const next = {
      id: String(view.id || uid()),
      moduleKey: String(view.moduleKey),
      name: String(view.name).trim(),
      filters: object(view.filters),
      sort: object(view.sort),
      columns: arr(view.columns).map(String),
      grouping: String(view.grouping || ''),
      shared: Boolean(view.shared),
      updatedAt: now()
    };
    const index = depth.savedViews.findIndex(item => item.id === next.id);
    if (index >= 0) depth.savedViews[index] = { ...depth.savedViews[index], ...next };
    else depth.savedViews.unshift({ ...next, createdAt: now() });
    return next;
  }

  function removeSavedView(id) {
    const depth = ensureDepthState();
    const index = depth.savedViews.findIndex(item => item.id === id);
    if (index < 0) return false;
    depth.savedViews.splice(index, 1);
    return true;
  }

  function recordVersion(moduleKey, record, action = 'updated', before = null) {
    if (!moduleKey || !record?.id) return null;
    const depth = ensureDepthState();
    const version = {
      id: uid(),
      moduleKey: String(moduleKey),
      recordId: String(record.id),
      action: String(action),
      before: before ? structuredClone(before) : null,
      after: structuredClone(record),
      actorId: window.FormcraftBackend?.session?.user?.id || '',
      actorName: typeof window.currentUserName === 'function' ? window.currentUserName() : 'Workspace member',
      createdAt: now()
    };
    depth.auditVersions.unshift(version);
    if (depth.auditVersions.length > 2000) depth.auditVersions.length = 2000;
    return version;
  }

  function versionsFor(moduleKey, recordId) {
    return ensureDepthState().auditVersions.filter(item => item.moduleKey === moduleKey && item.recordId === recordId);
  }

  function addAttachment(record, attachment) {
    if (!record?.id) throw new Error('A saved record is required before adding attachments.');
    record.attachments = arr(record.attachments);
    const next = {
      id: String(attachment?.id || uid()),
      name: String(attachment?.name || 'Attachment'),
      url: String(attachment?.url || ''),
      storagePath: String(attachment?.storagePath || ''),
      mimeType: String(attachment?.mimeType || ''),
      size: Math.max(0, num(attachment?.size)),
      uploadedBy: window.FormcraftBackend?.session?.user?.id || '',
      createdAt: now()
    };
    record.attachments.unshift(next);
    record.updatedAt = now();
    return next;
  }

  function mentionsFrom(text) {
    const matches = String(text || '').match(/(^|\s)@([\w.-]+)/g) || [];
    return [...new Set(matches.map(match => match.trim().slice(1).toLowerCase()).filter(Boolean))];
  }

  function addComment(record, body) {
    const text = String(body || '').trim();
    if (!record?.id || !text) throw new Error('A saved record and comment body are required.');
    record.comments = arr(record.comments);
    const comment = {
      id: uid(),
      body: text,
      mentions: mentionsFrom(text),
      author: typeof window.currentUserName === 'function' ? window.currentUserName() : 'Workspace member',
      userId: window.FormcraftBackend?.session?.user?.id || '',
      createdAt: now()
    };
    record.comments.unshift(comment);
    record.updatedAt = now();
    return comment;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const input = String(text || '').replace(/^\uFEFF/, '');
    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      const next = input[index + 1];
      if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') index += 1;
        row.push(cell); cell = '';
        if (row.some(value => value !== '')) rows.push(row);
        row = [];
      } else cell += char;
    }
    if (cell || row.length) { row.push(cell); if (row.some(value => value !== '')) rows.push(row); }
    if (!rows.length) return { headers: [], rows: [] };
    const headers = rows[0].map(value => String(value || '').trim());
    return { headers, rows: rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))) };
  }

  function validateImport(moduleKey, rows, mapping = {}) {
    const module = ERP.modulesByKey.get(moduleKey);
    if (!module) throw new Error(`Unknown module: ${moduleKey}`);
    const result = { valid: [], invalid: [], duplicates: [] };
    const required = module.fields.filter(field => field.required).map(field => field.name);
    const seen = new Set();
    arr(rows).forEach((sourceRow, rowIndex) => {
      const mapped = {};
      Object.entries(mapping).forEach(([source, target]) => { if (target) mapped[target] = sourceRow[source]; });
      const missing = required.filter(name => String(mapped[name] ?? sourceRow[name] ?? '').trim() === '');
      const candidate = { ...sourceRow, ...mapped };
      const key = JSON.stringify(required.map(name => String(candidate[name] || '').trim().toLowerCase()));
      const detail = { rowIndex: rowIndex + 2, values: candidate, missing };
      if (missing.length) result.invalid.push(detail);
      else if (key !== '[]' && seen.has(key)) result.duplicates.push(detail);
      else { seen.add(key); result.valid.push(detail); }
    });
    return result;
  }

  function recordImportJob(moduleKey, summary) {
    const depth = ensureDepthState();
    const job = {
      id: uid(), moduleKey: String(moduleKey), status: String(summary?.status || 'previewed'),
      total: num(summary?.total), valid: num(summary?.valid), invalid: num(summary?.invalid), duplicates: num(summary?.duplicates),
      createdAt: now(), createdBy: window.FormcraftBackend?.session?.user?.id || ''
    };
    depth.importJobs.unshift(job);
    return job;
  }

  function validateAutomation(definition = {}) {
    const errors = [];
    if (!definition.name) errors.push('Automation name is required.');
    if (!definition.trigger?.type) errors.push('A trigger is required.');
    if (!arr(definition.actions).length) errors.push('At least one action is required.');
    arr(definition.actions).forEach((action, index) => { if (!action?.type) errors.push(`Action ${index + 1} needs a type.`); });
    return { valid: errors.length === 0, errors };
  }

  function recordAutomationRun(definition, status, detail = {}) {
    const depth = ensureDepthState();
    const run = {
      id: uid(), automationId: String(definition?.id || ''), name: String(definition?.name || 'Automation'),
      status: String(status || 'completed'), detail: object(detail), startedAt: detail.startedAt || now(),
      completedAt: ['completed', 'failed', 'cancelled'].includes(status) ? now() : ''
    };
    depth.automationRuns.unshift(run);
    return run;
  }

  function queueIntegration(event) {
    const depth = ensureDepthState();
    const item = {
      id: uid(), topic: String(event?.topic || 'record.updated'), endpoint: String(event?.endpoint || ''),
      payload: object(event?.payload), status: 'pending', attempts: 0, createdAt: now()
    };
    depth.integrationOutbox.push(item);
    return item;
  }

  function roleProfile(role = '') {
    const key = String(role || '').toLowerCase();
    const profiles = {
      sales: { home: 'crm', apps: ['crm', 'sales', 'contacts', 'activities', 'payments', 'helpdesk'] },
      finance: { home: 'accounting', apps: ['accounting', 'payments', 'expenses', 'purchase', 'sales', 'payroll'] },
      hr: { home: 'employees', apps: ['employees', 'attendance', 'timeoff', 'payroll', 'recruitment', 'appraisal'] },
      operations: { home: 'inventory', apps: ['inventory', 'purchase', 'manufacturing', 'maintenance', 'projects', 'planning'] },
      owner: { home: 'dashboard', apps: ERP.allApps.map(app => app.key) }
    };
    return profiles[key] || { home: 'dashboard', apps: ERP.allApps.map(app => app.key) };
  }

  function portalModel(kind, identity = {}) {
    const type = String(kind || 'customer').toLowerCase();
    if (type === 'employee') {
      const employeeId = identity.employeeId || identity.id || '';
      return {
        type,
        employee: ERP.collection('employees').find(item => item.id === employeeId) || null,
        attendance: ERP.collection('attendance').filter(item => item.employeeId === employeeId),
        timeOff: ERP.collection('timeoff').filter(item => item.employeeId === employeeId),
        payroll: ERP.collection('payroll').filter(item => arr(item.items).some(line => line.employeeId === employeeId))
      };
    }
    const contactId = identity.contactId || identity.id || '';
    if (type === 'vendor') {
      return {
        type,
        contact: ERP.collection('contacts').find(item => item.id === contactId) || null,
        purchases: ERP.collection('purchase').filter(item => item.supplierId === contactId),
        payments: ERP.collection('payments').filter(item => item.partnerId === contactId)
      };
    }
    return {
      type: 'customer',
      contact: ERP.collection('contacts').find(item => item.id === contactId) || null,
      opportunities: ERP.collection('crm').filter(item => item.contactId === contactId),
      orders: ERP.collection('sales').filter(item => item.contactId === contactId),
      tickets: ERP.collection('helpdesk').filter(item => item.contactId === contactId),
      invoices: arr(state.invoices).filter(item => item.contactId === contactId || item.customerId === contactId)
    };
  }

  const api = {
    version: VERSION,
    ensureDepthState,
    persist,
    transaction: { parseLines, normalizeLine, calculate: calculateTransaction, legacyLine, linesForRecord, apply: applyTransaction, invoicePayloadFrom, stockDeltas },
    inbox: { items: inboxItems },
    views: { upsert: upsertSavedView, remove: removeSavedView, all: () => ensureDepthState().savedViews },
    audit: { recordVersion, versionsFor },
    collaboration: { addAttachment, addComment, mentionsFrom },
    imports: { parseCsv, validate: validateImport, recordJob: recordImportJob },
    automation: { validate: validateAutomation, recordRun: recordAutomationRun, runs: () => ensureDepthState().automationRuns },
    integrations: { queue: queueIntegration, outbox: () => ensureDepthState().integrationOutbox },
    roles: { profile: roleProfile },
    portals: { model: portalModel }
  };

  ensureDepthState();
  window.FormcraftProductDepth = api;
  document.documentElement.dataset.formcraftProductDepth = VERSION;
  document.dispatchEvent(new CustomEvent('formcraft:product-depth-ready', { detail: { version: VERSION } }));
})();
