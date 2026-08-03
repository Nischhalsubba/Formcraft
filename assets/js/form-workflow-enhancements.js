'use strict';

(() => {
  const VERSION = 'FORMCRAFT-FORM-WORKFLOW-1.0';
  const ERP = window.FormcraftERP;
  const modal = document.querySelector('[data-modal]');
  if (!ERP || !modal) return;

  const DRAFT_PREFIX = 'formcraft:erp-form-draft:';
  const FINANCIAL_MODULES = new Set(['sales', 'purchase', 'pos', 'ecommerce', 'rental', 'repairs', 'accounting', 'expenses', 'payments', 'payroll', 'subscriptions']);
  const CURRENCY_FIELDS = new Set(['amount', 'total', 'unitPrice', 'unitCost', 'salePrice', 'cost', 'deposit', 'salary', 'gross', 'net', 'debit', 'credit', 'estimatedCost', 'actualCost', 'partsCost', 'labourCost', 'ticketRevenue', 'expectedRevenue']);
  const NOTES_FIELDS = /note|description|body|content|transcript|tags|criteria/i;
  const OWNERSHIP_FIELDS = /owner|company|branch|manager|approver|responsible|technician|assigned/i;
  const SCHEDULE_FIELDS = /date|time|status|stage|priority|type|category/i;
  const HELP = {
    panVat: 'Nepal PAN is generally 9 digits. VAT-registered businesses also use their PAN as the VAT registration number.',
    taxRate: 'Use the tax rate applicable on the transaction date. The common VAT rate is 13%, but exempt and zero-rated supplies remain distinct.',
    account: 'The ledger account receiving one side of this entry.',
    counterAccount: 'The balancing account. A posted journal entry must remain balanced.',
    debit: 'Debit amount for this journal line.',
    credit: 'Credit amount for this journal line.',
    onHand: 'Physical stock recorded at the selected warehouse.',
    reserved: 'Stock committed to open delivery or production work.',
    reorderPoint: 'Replenishment should be reviewed when available stock reaches this value.',
    salary: 'Base salary before statutory and voluntary deductions.',
    gross: 'Gross pay before deductions.',
    net: 'Take-home amount after deductions. Nepal payroll previews require professional validation before authoritative use.',
    status: 'Status controls available actions, connected workflows, and reports.',
    companyId: 'Company determines the legal and reporting context.',
    branchId: 'Branch determines operating context and can affect numbering, inventory, and reports.'
  };

  const FORM_SECTIONS = {
    sales: [
      ['Customer & order', 'Customer identity, order number, date, and lifecycle.', ['number', 'contactId', 'orderDate', 'status']],
      ['Products & pricing', 'Calculated commercial values for this order.', ['productId', 'quantity', 'unitPrice', 'discount', 'taxRate', 'total']],
      ['Ownership', 'Responsibility and reporting context.', ['ownerId', 'companyId', 'branchId']],
      ['Notes', 'Internal context and fulfilment instructions.', ['notes']]
    ],
    purchase: [
      ['Supplier & order', 'Supplier, purchase number, date, and lifecycle.', ['number', 'supplierId', 'orderDate', 'status']],
      ['Products & cost', 'Destination, quantity, unit cost, and calculated total.', ['productId', 'quantity', 'unitCost', 'total', 'warehouseId']],
      ['Reporting context', 'Company and branch responsible for the purchase.', ['companyId', 'branchId']],
      ['Notes', 'Terms, delivery instructions, and internal context.', ['notes']]
    ],
    accounting: [
      ['Journal identity', 'Reference, date, journal, and posting status.', ['reference', 'date', 'journal', 'status']],
      ['Double entry', 'Debit, credit, and balancing accounts.', ['account', 'counterAccount', 'debit', 'credit']],
      ['Reporting context', 'Company and branch used for reporting.', ['companyId', 'branchId']],
      ['Notes', 'Posting explanation and supporting context.', ['notes']]
    ],
    payments: [
      ['Payment', 'Reference, partner, direction, date, method, and status.', ['reference', 'partnerId', 'direction', 'date', 'method', 'status']],
      ['Allocation', 'Amount and invoice allocation.', ['amount', 'invoiceId']],
      ['Reporting context', 'Company and branch responsible for the payment.', ['companyId', 'branchId']],
      ['Notes', 'Bank, wallet, or reconciliation notes.', ['notes']]
    ],
    expenses: [
      ['Expense', 'Employee, date, category, description, and status.', ['description', 'employeeId', 'date', 'category', 'status']],
      ['Costing', 'Amount and optional project allocation.', ['amount', 'projectId']],
      ['Reporting context', 'Company and branch responsible for reimbursement.', ['companyId', 'branchId']],
      ['Notes', 'Receipt and reimbursement context.', ['notes']]
    ],
    inventory: [
      ['Product identity', 'Product name, SKU, type, category, and lifecycle.', ['name', 'sku', 'type', 'category', 'status']],
      ['Commercial values', 'Sales price, cost, and unit of measure.', ['unit', 'salePrice', 'cost']],
      ['Stock controls', 'Warehouse availability, reservations, and replenishment.', ['onHand', 'reserved', 'reorderPoint', 'warehouseId']],
      ['Reporting context', 'Company, branch, tags, and notes.', ['companyId', 'branchId', 'tags', 'notes']]
    ],
    employees: [
      ['Employee identity', 'Name, employee code, contact details, and status.', ['name', 'employeeCode', 'email', 'phone', 'status']],
      ['Organization', 'Department, role, manager, and start date.', ['department', 'jobTitle', 'managerId', 'joinDate']],
      ['Compensation & context', 'Base salary, company, and branch.', ['salary', 'companyId', 'branchId']],
      ['Tags & notes', 'Skills, labels, and employment notes.', ['tags', 'notes']]
    ],
    payroll: [
      ['Payroll identity', 'Employee, period, and payroll status.', ['reference', 'employeeId', 'periodStart', 'periodEnd', 'status']],
      ['Earnings', 'Base pay, allowances, overtime, and gross pay.', ['baseSalary', 'allowances', 'overtime', 'gross']],
      ['Deductions', 'Tax, SSF, PF, CIT, deductions, and net pay.', ['tax', 'ssf', 'providentFund', 'cit', 'deductions', 'net']],
      ['Reporting context', 'Company, branch, and notes.', ['companyId', 'branchId', 'notes']]
    ],
    helpdesk: [
      ['Ticket', 'Customer, subject, priority, and lifecycle.', ['subject', 'contactId', 'priority', 'status']],
      ['Service ownership', 'Team, assignee, SLA, and related project.', ['team', 'assignedTo', 'slaDue', 'projectId']],
      ['Issue detail', 'Problem description and working notes.', ['description', 'notes']]
    ]
  };

  const arr = value => Array.isArray(value) ? value : [];
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = (value, places = 2) => {
    const factor = 10 ** places;
    return Math.round((number(value) + Number.EPSILON) * factor) / factor;
  };
  const workspaceKey = () => window.FormcraftBackend?.workspace?.id || state?.settings?.workspaceName || 'workspace';
  const formModule = form => ERP.modulesByKey.get(form?.dataset.erpModule || '');
  const isAdmin = () => ['owner', 'admin'].includes(window.FormcraftBackend?.role || 'viewer');
  const titleCaseLabel = value => String(value || '').replace(/\b\w/g, character => character.toUpperCase());

  function ensureSettings() {
    state.erp ||= {};
    state.erp.settings ||= {};
    state.erp.settings.formLayouts ||= {};
    state.erp.settings.formAnalytics ||= { opens: 0, submits: 0, abandons: 0, validationFailures: 0, totalCompletionMs: 0, byModule: {} };
    return state.erp.settings;
  }

  function metric(moduleKey) {
    const analytics = ensureSettings().formAnalytics;
    analytics.byModule[moduleKey] ||= { opens: 0, submits: 0, abandons: 0, validationFailures: 0, totalCompletionMs: 0 };
    return analytics.byModule[moduleKey];
  }

  function recordMetric(moduleKey, key, amount = 1) {
    const analytics = ensureSettings().formAnalytics;
    analytics[key] = number(analytics[key]) + amount;
    const moduleMetric = metric(moduleKey || 'workspace');
    moduleMetric[key] = number(moduleMetric[key]) + amount;
  }

  function serializeForm(form) {
    const data = {};
    [...form.elements].forEach(control => {
      if (!control.name || ['button', 'submit', 'file'].includes(control.type)) return;
      data[control.name] = control.type === 'checkbox' ? Boolean(control.checked) : control.value;
    });
    return data;
  }

  function stableSnapshot(form) {
    const values = serializeForm(form);
    return JSON.stringify(values, Object.keys(values).sort());
  }

  function draftKey(form) {
    const module = formModule(form);
    const mode = form.dataset.formMode || 'create';
    const record = mode === 'edit' ? ui.erp?.record?.id || 'record' : 'new';
    return `${DRAFT_PREFIX}${workspaceKey()}:${module?.key || 'workspace'}:${record}`;
  }

  function readDraft(form) {
    try {
      const raw = localStorage.getItem(draftKey(form));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.values || Date.now() - Number(parsed.savedAt || 0) > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(draftKey(form));
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function saveDraft(form, notify = false) {
    try {
      const payload = { savedAt: Date.now(), values: serializeForm(form), module: form.dataset.erpModule || '', mode: form.dataset.formMode || 'create' };
      localStorage.setItem(draftKey(form), JSON.stringify(payload));
      form.dataset.draftSavedAt = String(payload.savedAt);
      if (notify) toast('Draft saved on this device.');
      return true;
    } catch {
      if (notify) toast('Draft could not be saved in this browser.', 'warning');
      return false;
    }
  }

  function clearDraft(form) {
    try { localStorage.removeItem(draftKey(form)); } catch {}
  }

  function applyDraft(form, draft) {
    Object.entries(draft.values || {}).forEach(([name, value]) => {
      const control = form.elements[name];
      if (!control) return;
      if (control.type === 'checkbox') control.checked = Boolean(value);
      else control.value = value ?? '';
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    });
    form.dataset.draftRecovered = 'true';
    return true;
  }

  function sectionBlueprint(module) {
    if (FORM_SECTIONS[module.key]) return FORM_SECTIONS[module.key];
    const groups = [
      ['Basics', 'Identity and primary record information.', []],
      ['Schedule & status', 'Dates, lifecycle, classification, and priority.', []],
      ['Commercial values', 'Amounts, quantities, prices, and operational values.', []],
      ['Ownership', 'Responsibility, company, and branch context.', []],
      ['Notes & context', 'Descriptions, tags, and supporting information.', []]
    ];
    module.fields.forEach(schema => {
      const name = schema.name;
      if (NOTES_FIELDS.test(name) || schema.type === 'textarea' || schema.type === 'tags') groups[4][2].push(name);
      else if (OWNERSHIP_FIELDS.test(name) || ['member', 'company', 'branch', 'project'].includes(schema.type)) groups[3][2].push(name);
      else if (CURRENCY_FIELDS.has(name) || ['money', 'number'].includes(schema.type) || /quantity|count|rate|probability|rating/i.test(name)) groups[2][2].push(name);
      else if (SCHEDULE_FIELDS.test(name) || schema.type === 'date' || schema.type === 'time' || schema.type === 'select') groups[1][2].push(name);
      else groups[0][2].push(name);
    });
    return groups.filter(group => group[2].length);
  }

  function layoutFor(module) {
    const stored = ensureSettings().formLayouts[module.key] || {};
    return { hidden: new Set(arr(stored.hidden)), order: arr(stored.order) };
  }

  function applySections(form, module) {
    if (form.dataset.sectionsEnhanced === VERSION) return;
    const host = form.querySelector('.erp-form-sections');
    const original = host?.querySelector(':scope > fieldset');
    if (!host || !original) return;
    const layout = layoutFor(module);
    const wrappers = new Map();
    module.fields.forEach(schema => {
      const wrapper = form.elements[schema.name]?.closest('.erp-field, .erp-switch-field');
      if (wrapper) wrappers.set(schema.name, wrapper);
    });
    const ordered = [...layout.order.filter(name => wrappers.has(name)), ...module.fields.map(field => field.name).filter(name => !layout.order.includes(name))];
    const rank = new Map(ordered.map((name, index) => [name, index]));
    const fragment = document.createDocumentFragment();
    sectionBlueprint(module).forEach(([title, description, names], index) => {
      const available = names.filter(name => {
        const schema = module.fields.find(field => field.name === name);
        return wrappers.has(name) && (!layout.hidden.has(name) || schema?.required);
      }).sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999));
      if (!available.length) return;
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'erp-form-section';
      fieldset.dataset.formSection = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const legend = document.createElement('legend');
      legend.textContent = title;
      const help = document.createElement('p');
      help.textContent = description;
      help.id = `erp-form-section-${module.key}-${index}`;
      fieldset.setAttribute('aria-describedby', help.id);
      const grid = document.createElement('div');
      grid.className = 'erp-form-grid';
      available.forEach(name => grid.append(wrappers.get(name)));
      fieldset.append(legend, help, grid);
      fragment.append(fieldset);
    });
    original.replaceWith(fragment);
    form.dataset.sectionsEnhanced = VERSION;
  }

  function addHelp(wrapper, schema) {
    if (!wrapper || wrapper.querySelector('[data-context-help]') || !HELP[schema.name]) return;
    const label = wrapper.querySelector(':scope > span:first-child');
    if (!label) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'erp-context-help';
    button.dataset.contextHelp = '';
    button.setAttribute('aria-label', `Help for ${schema.label}`);
    button.setAttribute('title', HELP[schema.name]);
    button.textContent = '?';
    button.addEventListener('click', () => {
      const current = wrapper.querySelector('[data-context-help-note]');
      if (current) return current.remove();
      const note = document.createElement('small');
      note.dataset.contextHelpNote = '';
      note.className = 'erp-context-help-note';
      note.textContent = HELP[schema.name];
      wrapper.append(note);
    });
    label.append(' ', button);
  }

  function updateDualDate(control, note) {
    if (!control.value) return void (note.textContent = 'Choose a date to see both AD and BS.');
    let bs = '';
    try {
      if (typeof dualDate === 'function') bs = dualDate(control.value, { short: false });
      else if (window.FormcraftNepal?.adToBs) bs = window.FormcraftNepal.adToBs(control.value)?.formatted || '';
    } catch {}
    note.textContent = bs && bs !== control.value ? `AD ${control.value} · BS ${bs}` : `AD ${control.value}`;
  }

  function enhanceRelationSearch(select, wrapper, schema, form) {
    if (wrapper.querySelector('[data-relation-search]')) return;
    const options = [...select.options];
    const status = document.createElement('small');
    status.className = 'erp-relation-status';
    status.dataset.relationStatus = '';
    status.id = `erp-relation-status-${form.dataset.erpModule}-${schema.name}`;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const records = options.filter(option => option.value);
    if (!records.length) {
      status.dataset.state = 'empty';
      status.textContent = `No ${schema.label.toLowerCase()} records are available yet.`;
      select.disabled = true;
      select.before(status);
      return;
    }
    if (records.length <= 7) return;
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'erp-relation-search';
    search.dataset.relationSearch = '';
    search.placeholder = `Search ${schema.label.toLowerCase()}`;
    search.setAttribute('aria-label', `Search ${schema.label}`);
    search.setAttribute('aria-describedby', status.id);
    search.autocomplete = 'off';
    const filter = () => {
      try {
        status.dataset.state = 'loading';
        const query = search.value.trim().toLowerCase();
        let matches = 0;
        options.forEach(option => {
          const show = !option.value || !query || option.textContent.toLowerCase().includes(query) || option.selected;
          option.hidden = !show;
          if (option.value && show) matches += 1;
        });
        status.dataset.state = matches ? 'ready' : 'empty';
        status.textContent = query ? matches ? `${matches} matching ${schema.label.toLowerCase()} record${matches === 1 ? '' : 's'}.` : `No ${schema.label.toLowerCase()} records match this search.` : `${records.length} records available.`;
      } catch {
        status.dataset.state = 'error';
        status.textContent = `${schema.label} options could not be filtered. Clear the search and try again.`;
      }
    };
    search.addEventListener('input', filter);
    select.before(search, status);
    filter();
  }

  function enhanceControl(form, module, schema) {
    const control = form.elements[schema.name];
    const wrapper = control?.closest('.erp-field, .erp-switch-field');
    if (!control || !wrapper) return;
    addHelp(wrapper, schema);
    if (schema.type === 'email' || /email/i.test(schema.name)) control.autocomplete = 'email';
    if (schema.type === 'tel' || /phone|mobile/i.test(schema.name)) { control.autocomplete = 'tel'; control.inputMode = 'tel'; }
    if (schema.type === 'url') { control.autocomplete = 'url'; control.inputMode = 'url'; }
    if (schema.type === 'money') { control.inputMode = 'decimal'; control.autocomplete = 'off'; }
    if (schema.type === 'number') control.inputMode = schema.step && Number(schema.step) < 1 ? 'decimal' : 'numeric';
    if (/pan|vat|tax/i.test(schema.name) && schema.type === 'text') { control.inputMode = 'numeric'; control.autocomplete = 'off'; }
    if (schema.type === 'date' && !wrapper.querySelector('[data-dual-date]')) {
      const note = document.createElement('small');
      note.dataset.dualDate = '';
      note.className = 'erp-dual-date';
      wrapper.append(note);
      updateDualDate(control, note);
      control.addEventListener('change', () => updateDualDate(control, note));
    }
    if (['relation', 'member', 'project'].includes(schema.type) && control.tagName === 'SELECT') enhanceRelationSearch(control, wrapper, schema, form);
  }

  function calculationRule(form) {
    const quantity = form.elements.quantity;
    const unit = form.elements.unitPrice || form.elements.unitCost;
    const output = form.elements.total || form.elements.amount;
    if (!quantity || !unit || !output) return null;
    return () => {
      const qty = Math.max(0, number(quantity.value));
      const price = Math.max(0, number(unit.value));
      const discountRate = Math.min(100, Math.max(0, number(form.elements.discount?.value)));
      const taxRate = Math.min(100, Math.max(0, number(form.elements.taxRate?.value)));
      const subtotal = round(qty * price);
      const discount = round(subtotal * discountRate / 100);
      const taxable = round(subtotal - discount);
      const tax = round(taxable * taxRate / 100);
      const total = round(taxable + tax);
      output.value = String(total);
      output.readOnly = true;
      output.setAttribute('aria-readonly', 'true');
      return { subtotal, discount, taxable, tax, total };
    };
  }

  function enhanceCalculations(form) {
    if (form.dataset.calculationEnhanced === VERSION) return;
    const calculate = calculationRule(form);
    if (!calculate) return;
    const output = form.elements.total || form.elements.amount;
    const wrapper = output?.closest('.erp-field');
    if (!wrapper) return;
    const breakdown = document.createElement('div');
    breakdown.className = 'erp-calculation-breakdown';
    breakdown.dataset.calculationBreakdown = '';
    wrapper.append(breakdown);
    const update = () => {
      const result = calculate();
      breakdown.innerHTML = `<span>Subtotal <strong>NPR ${result.subtotal.toLocaleString('en-NP')}</strong></span><span>Discount <strong>NPR ${result.discount.toLocaleString('en-NP')}</strong></span><span>Taxable <strong>NPR ${result.taxable.toLocaleString('en-NP')}</strong></span><span>Tax <strong>NPR ${result.tax.toLocaleString('en-NP')}</strong></span>`;
    };
    ['quantity', 'unitPrice', 'unitCost', 'discount', 'taxRate'].forEach(name => {
      form.elements[name]?.addEventListener('input', update);
      form.elements[name]?.addEventListener('change', update);
    });
    update();
    form.dataset.calculationEnhanced = VERSION;
  }

  function errorMessage(schema, control, value) {
    if (schema.required && (value === '' || value === null || value === undefined)) return `${schema.label} is required.`;
    if (schema.type === 'email' && value && !/^\S+@\S+\.\S+$/.test(value)) return `Enter a valid email address for ${schema.label.toLowerCase()}.`;
    if (schema.type === 'url' && value) {
      try { new URL(value); } catch { return `Enter a complete URL for ${schema.label.toLowerCase()}.`; }
    }
    const numeric = ['number', 'money'].includes(schema.type) ? number(value) : null;
    if (numeric !== null && schema.min !== undefined && numeric < Number(schema.min)) return `${schema.label} must be at least ${schema.min}.`;
    if (numeric !== null && schema.max !== undefined && numeric > Number(schema.max)) return `${schema.label} must be no more than ${schema.max}.`;
    if (control?.validity?.patternMismatch) return `${schema.label} does not match the expected format.`;
    return '';
  }

  function validateERPForm(form, { focus = true } = {}) {
    const module = formModule(form);
    if (!module) return { valid: true, errors: [] };
    const errors = [];
    module.fields.forEach(schema => {
      const control = form.elements[schema.name];
      if (!control || control.disabled) return;
      const value = control.type === 'checkbox' ? control.checked : String(control.value || '').trim();
      const message = errorMessage(schema, control, value);
      const target = form.querySelector(`[data-erp-error-for="${CSS.escape(schema.name)}"]`);
      control.toggleAttribute('aria-invalid', Boolean(message));
      if (target) target.textContent = message;
      if (message) errors.push({ schema, control, message });
    });
    const summary = form.querySelector('[data-erp-form-error]');
    if (summary) summary.innerHTML = errors.length ? `<strong>Fix ${errors.length} field${errors.length === 1 ? '' : 's'} before saving.</strong><ul>${errors.map(item => `<li>${escapeHtml(item.message)}</li>`).join('')}</ul>` : '';
    if (errors.length && focus) errors[0].control.focus();
    if (errors.length) recordMetric(module.key, 'validationFailures');
    return { valid: errors.length === 0, errors };
  }

  function summaryValue(form, schema) {
    const control = form.elements[schema.name];
    if (!control) return '';
    if (control.type === 'checkbox') return control.checked ? 'Yes' : 'No';
    if (control.tagName === 'SELECT') return control.selectedOptions[0]?.textContent || '';
    if (schema.type === 'money') return `NPR ${number(control.value).toLocaleString('en-NP', { maximumFractionDigits: 2 })}`;
    return String(control.value || '').trim();
  }

  function showReview(form, module) {
    let review = form.querySelector('[data-form-review]');
    if (!review) {
      review = document.createElement('section');
      review.className = 'erp-form-review';
      review.dataset.formReview = '';
      form.querySelector('.modal-body')?.append(review);
    }
    const important = module.fields.filter(schema => schema.required || CURRENCY_FIELDS.has(schema.name) || ['status', 'contactId', 'supplierId', 'employeeId', 'productId', 'date', 'orderDate'].includes(schema.name));
    review.innerHTML = `<header><div><span>Review before saving</span><strong>${escapeHtml(module.singular)}</strong></div><button type="button" class="icon-button" data-close-review aria-label="Close review">${icon('close', 16)}</button></header><dl>${important.map(schema => `<div><dt>${escapeHtml(schema.label)}</dt><dd>${escapeHtml(summaryValue(form, schema) || '—')}</dd></div>`).join('')}</dl><p>Confirm that commercial values and reporting context are correct.</p>`;
    review.querySelector('[data-close-review]')?.addEventListener('click', () => { review.remove(); delete form.dataset.reviewPending; restorePrimaryLabel(form); });
    form.dataset.reviewPending = 'true';
    const primary = form.querySelector('button[type="submit"]');
    if (primary) primary.textContent = 'Confirm and save';
    review.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function restorePrimaryLabel(form) {
    const module = formModule(form);
    const primary = form.querySelector('button[type="submit"]');
    if (module && primary) primary.textContent = form.dataset.formMode === 'edit' ? 'Save changes' : `Create ${titleCaseLabel(module.singular)}`;
  }

  function confirmationDialog({ title, copy, confirmLabel = 'Discard changes', onConfirm }) {
    const dialog = document.createElement('dialog');
    dialog.className = 'workflow-confirm-dialog';
    dialog.innerHTML = `<form method="dialog" class="workflow-confirm-card"><div><span>Unsaved work</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div><div><button class="button button-secondary" value="cancel">Keep editing</button><button class="button button-danger" value="confirm">${escapeHtml(confirmLabel)}</button></div></form>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => { const confirmed = dialog.returnValue === 'confirm'; dialog.remove(); if (confirmed) onConfirm?.(); }, { once: true });
    dialog.showModal();
    dialog.querySelector('[value="cancel"]')?.focus();
  }

  function configureFooter(form, module) {
    if (form.dataset.workflowFooter === VERSION) return;
    const trailing = form.querySelector('.modal-actions-trailing');
    const primary = trailing?.querySelector('button[type="submit"]');
    if (!trailing || !primary) return;
    if (form.dataset.formMode === 'create') {
      const draft = document.createElement('button');
      draft.type = 'button';
      draft.className = 'button button-secondary erp-save-draft';
      draft.textContent = 'Save draft';
      draft.addEventListener('click', () => { saveDraft(form, true); form.dataset.formCommitting = 'draft'; form.dataset.formDirty = 'false'; originalCloseModal?.(); });
      trailing.prepend(draft);
      const another = document.createElement('button');
      another.type = 'button';
      another.className = 'button button-secondary erp-save-another';
      another.textContent = 'Save & add another';
      another.addEventListener('click', () => { form.dataset.afterSubmit = 'new'; form.requestSubmit(primary); });
      trailing.insertBefore(another, primary);
    }
    if (FINANCIAL_MODULES.has(module.key)) primary.dataset.financialSubmit = 'true';
    form.dataset.workflowFooter = VERSION;
  }

  let draftTimer = 0;
  function monitorDirty(form) {
    if (form.dataset.dirtyMonitor === VERSION) return;
    form.dataset.formBaseline = stableSnapshot(form);
    form.dataset.formDirty = 'false';
    form.dataset.openedAt = String(Date.now());
    recordMetric(formModule(form)?.key, 'opens');
    const update = () => {
      const dirty = stableSnapshot(form) !== form.dataset.formBaseline;
      form.dataset.formDirty = String(dirty);
      if (dirty && form.dataset.formCommitting !== 'true') {
        clearTimeout(draftTimer);
        draftTimer = setTimeout(() => saveDraft(form), 450);
      }
      if (!dirty) clearDraft(form);
      if (form.dataset.reviewPending) {
        form.querySelector('[data-form-review]')?.remove();
        delete form.dataset.reviewPending;
        delete form.dataset.reviewConfirmed;
        restorePrimaryLabel(form);
      }
    };
    form.addEventListener('input', update, true);
    form.addEventListener('change', update, true);
    form.dataset.dirtyMonitor = VERSION;
  }

  function enhanceForm(form) {
    if (!form?.matches('[data-erp-form]')) return;
    const module = formModule(form);
    if (!module) return;
    form.dataset.formMode = /^edit\b/i.test(form.querySelector('#modal-title')?.textContent || '') ? 'edit' : 'create';
    applySections(form, module);
    module.fields.forEach(schema => enhanceControl(form, module, schema));
    enhanceCalculations(form);
    const draft = readDraft(form);
    if (draft && applyDraft(form, draft)) {
      const banner = document.createElement('div');
      banner.className = 'erp-draft-recovered';
      banner.innerHTML = `<div><strong>Recovered an unsaved draft</strong><span>Saved ${new Date(draft.savedAt).toLocaleString()} on this device.</span></div><button type="button" class="button button-secondary button-small">Discard draft</button>`;
      banner.querySelector('button')?.addEventListener('click', () => { clearDraft(form); banner.remove(); toast('Recovered draft discarded.', 'warning'); });
      form.querySelector('.modal-body')?.prepend(banner);
    }
    configureFooter(form, module);
    monitorDirty(form);
    const saveError = form.querySelector('[data-erp-form-error]');
    if (saveError) new MutationObserver(() => {
      if (saveError.textContent.trim() && form.dataset.formCommitting === 'true') { delete form.dataset.formCommitting; form.dataset.formDirty = 'true'; }
    }).observe(saveError, { childList: true, subtree: true, characterData: true });
    form.dataset.workflowEnhanced = VERSION;
  }

  function layoutSettings(moduleKey) {
    return ensureSettings().formLayouts[moduleKey] || { hidden: [], order: [] };
  }

  function saveLayout(moduleKey, value) {
    if (!isAdmin()) throw new Error('Only workspace owners and admins can configure forms.');
    ensureSettings().formLayouts[moduleKey] = { hidden: [...new Set(arr(value.hidden))], order: [...new Set(arr(value.order))] };
    saveState();
  }

  function analyticsSummary() {
    const analytics = ensureSettings().formAnalytics;
    const completed = Math.max(1, number(analytics.submits));
    return { ...structuredClone(analytics), averageCompletionMs: round(number(analytics.totalCompletionMs) / completed, 0), completionRate: round(number(analytics.submits) / Math.max(1, number(analytics.opens)) * 100, 1) };
  }

  function renderFormAdminPanel() {
    if (!isAdmin()) return '';
    const modules = ERP.MODULES;
    const selected = state.erp.settings.formAdminModule || modules[0]?.key || '';
    const module = ERP.modulesByKey.get(selected) || modules[0];
    const layout = layoutSettings(module.key);
    const hidden = new Set(arr(layout.hidden));
    const order = [...arr(layout.order), ...module.fields.map(field => field.name).filter(name => !arr(layout.order).includes(name))];
    const summary = analyticsSummary();
    return `<section class="data-lab-card form-admin-card"><header><div><span>Form configuration</span><h2>Field visibility and order</h2><p>Safe metadata controls only. Required fields cannot be hidden, and arbitrary code remains unavailable.</p></div><label>Module<select data-form-admin-module>${modules.map(item => `<option value="${escapeHtml(item.key)}" ${item.key === module.key ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select></label></header><div class="form-admin-grid"><div class="form-admin-fields" data-form-admin-fields>${order.map((name, index) => {
      const field = module.fields.find(item => item.name === name);
      if (!field) return '';
      return `<article data-form-admin-field="${escapeHtml(name)}"><span class="form-admin-handle" aria-hidden="true">⋮⋮</span><div><strong>${escapeHtml(field.label)}</strong><small>${escapeHtml(field.type)}${field.required ? ' · required' : ''}</small></div><label class="form-admin-visible"><input type="checkbox" ${hidden.has(name) && !field.required ? '' : 'checked'} ${field.required ? 'disabled' : ''} data-form-field-visible="${escapeHtml(name)}">${field.required ? 'Required' : 'Visible'}</label><div><button type="button" class="icon-button" data-form-field-up="${escapeHtml(name)}" ${index === 0 ? 'disabled' : ''} aria-label="Move ${escapeHtml(field.label)} up">↑</button><button type="button" class="icon-button" data-form-field-down="${escapeHtml(name)}" ${index === order.length - 1 ? 'disabled' : ''} aria-label="Move ${escapeHtml(field.label)} down">↓</button></div></article>`;
    }).join('')}</div><aside><div class="form-analytics"><span>Forms opened<strong>${summary.opens}</strong></span><span>Saved<strong>${summary.submits}</strong></span><span>Abandoned<strong>${summary.abandons}</strong></span><span>Validation failures<strong>${summary.validationFailures}</strong></span><span>Completion rate<strong>${summary.completionRate}%</strong></span><span>Average completion<strong>${Math.round(summary.averageCompletionMs / 1000)}s</strong></span></div><button type="button" class="button button-primary" data-save-form-layout>Save form layout</button><button type="button" class="button button-secondary" data-reset-form-layout>Reset module layout</button></aside></div></section>`;
  }

  function bindFormAdminPanel(root = document) {
    const select = root.querySelector('[data-form-admin-module]');
    if (!select || select.dataset.bound) return;
    select.dataset.bound = 'true';
    select.addEventListener('change', () => { state.erp.settings.formAdminModule = select.value; renderShell(); });
    root.querySelector('[data-save-form-layout]')?.addEventListener('click', () => {
      const fields = [...root.querySelectorAll('[data-form-admin-field]')];
      saveLayout(select.value, { order: fields.map(item => item.dataset.formAdminField), hidden: fields.filter(item => !item.querySelector('[data-form-field-visible]').checked).map(item => item.dataset.formAdminField) });
      toast('Form layout saved for this workspace.');
    });
    root.querySelector('[data-reset-form-layout]')?.addEventListener('click', () => { delete ensureSettings().formLayouts[select.value]; saveState(); renderShell(); toast('Form layout reset.'); });
    root.querySelectorAll('[data-form-field-up], [data-form-field-down]').forEach(button => button.addEventListener('click', () => {
      const article = button.closest('[data-form-admin-field]');
      if (button.hasAttribute('data-form-field-up')) article.previousElementSibling?.before(article);
      else article.nextElementSibling?.after(article);
    }));
  }

  let originalCloseModal = typeof closeModal === 'function' ? closeModal : null;
  if (originalCloseModal) closeModal = function closeWithUnsavedProtection(...args) {
    const form = modal.querySelector('form[data-erp-form]');
    if (!form || form.dataset.formCommitting || form.dataset.formDirty !== 'true') return originalCloseModal.apply(this, args);
    saveDraft(form);
    confirmationDialog({
      title: 'Discard unsaved changes?',
      copy: 'Your changes have been saved as a local recovery draft. Discarding removes that draft and closes the form.',
      onConfirm: () => {
        recordMetric(formModule(form)?.key, 'abandons');
        clearDraft(form);
        form.dataset.formCommitting = 'discard';
        originalCloseModal?.();
        saveState();
      }
    });
  };

  document.addEventListener('submit', event => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form?.matches('[data-erp-form]')) return;
    const module = formModule(form);
    const result = validateERPForm(form);
    if (!result.valid) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (FINANCIAL_MODULES.has(module.key) && form.dataset.reviewConfirmed !== 'true') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (form.dataset.reviewPending === 'true') { form.dataset.reviewConfirmed = 'true'; form.requestSubmit(form.querySelector('button[type="submit"]')); }
      else showReview(form, module);
      return;
    }
    form.dataset.formCommitting = 'true';
    clearDraft(form);
    recordMetric(module.key, 'submits');
    recordMetric(module.key, 'totalCompletionMs', Math.max(0, Date.now() - number(form.dataset.openedAt)));
    if (form.dataset.afterSubmit === 'new') requestAnimationFrame(() => setTimeout(() => window.FormcraftERPUI?.openRecordForm(module), 180));
    saveState();
  }, true);

  modal.addEventListener('cancel', event => {
    const form = modal.querySelector('form[data-erp-form]');
    if (!form || form.dataset.formCommitting || form.dataset.formDirty !== 'true') return;
    event.preventDefault();
    closeModal();
  });

  const observer = new MutationObserver(() => {
    const form = modal.open ? modal.querySelector('form[data-erp-form]') : null;
    if (form && form.dataset.workflowEnhanced !== VERSION) requestAnimationFrame(() => enhanceForm(form));
  });
  observer.observe(modal, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });

  ensureSettings();
  window.FormcraftFormWorkflow = Object.freeze({ version: VERSION, enhanceForm, validateERPForm, saveDraft, clearDraft, layoutSettings, saveLayout, analyticsSummary, renderFormAdminPanel, bindFormAdminPanel, isAdmin });
})();
