'use strict';

(() => {
  const ERP = window.FormcraftERP;
  const modal = document.querySelector('[data-modal]');
  if (!ERP || !modal) return;

  const VERSION = 'FORMCRAFT-RECORD-WORKSPACE-5.0';
  const PAGE_DRAFT_PREFIX = 'formcraft:record-workspace:draft:';
  const MODAL_DRAFT_PREFIX = 'formcraft:modal-draft:';
  const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
  const NOTES_FIELDS = /note|description|body|content|transcript|tag|criteria|address/i;
  const OWNERSHIP_FIELDS = /owner|company|branch|manager|approver|responsible|technician|assigned|employee/i;
  const SCHEDULE_FIELDS = /date|time|status|stage|priority|type|category|period/i;
  const VALUE_FIELDS = /amount|total|price|cost|salary|gross|net|tax|ssf|cit|debit|credit|quantity|count|rate|hours|overtime/i;
  const escape = value => typeof escapeHtml === 'function'
    ? escapeHtml(value ?? '')
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const arr = value => Array.isArray(value) ? value : [];
  const now = () => new Date().toISOString();
  const workspaceKey = () => window.FormcraftBackend?.workspace?.id || state?.settings?.workspaceName || 'workspace';
  const previousRenderPage = renderPage;
  const previousBindPage = bindPage;
  const previousRenderShell = renderShell;
  const workflowCloseModal = typeof closeModal === 'function' ? closeModal : null;

  function safeRead(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.values || Date.now() - Number(parsed.savedAt || 0) > DRAFT_TTL) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  function routeModule() {
    return ERP.moduleByRoute(ui.route) || null;
  }

  function recordTarget() {
    const module = routeModule();
    if (!module) return null;
    const params = new URLSearchParams(location.search);
    const paramModule = params.get('erp');
    const id = paramModule === module.key && params.get('record')
      ? params.get('record')
      : ui.erp?.record?.moduleKey === module.key
        ? ui.erp.record.id
        : '';
    const record = id ? ERP.collection(module).find(item => item.id === id) : null;
    if (!record) return null;
    const mode = params.get('recordMode') === 'edit' || ui.erp?.recordMode === 'edit' ? 'edit' : 'view';
    return { module, record, mode };
  }

  function setRecordLocation(module, record, mode = 'view', { replace = false } = {}) {
    ERP.ensureERPState();
    ui.route = `erp-${module.key}`;
    ui.erp.record = { moduleKey: module.key, id: record.id };
    ui.erp.recordMode = mode;
    const url = new URL(location.href);
    url.hash = `#erp-${module.key}`;
    url.searchParams.set('erp', module.key);
    url.searchParams.set('record', record.id);
    if (mode === 'edit') url.searchParams.set('recordMode', 'edit');
    else url.searchParams.delete('recordMode');
    history[replace ? 'replaceState' : 'pushState']({ route: ui.route, erp: module.key, record: record.id, mode }, '', url);
  }

  function openRecord(moduleKey, recordId, options = {}) {
    const module = ERP.modulesByKey.get(moduleKey);
    const record = module ? ERP.collection(module).find(item => item.id === recordId) : null;
    if (!module || !record) return;
    setRecordLocation(module, record, 'view', options);
    renderShell();
  }

  function openEditor(moduleKey, recordId, options = {}) {
    const module = ERP.modulesByKey.get(moduleKey);
    const record = module ? ERP.collection(module).find(item => item.id === recordId) : null;
    if (!module || !record) return;
    if (!ERP.canEdit()) return toast('You have read-only access to this workspace.', 'warning');
    setRecordLocation(module, record, 'edit', options);
    renderShell();
  }

  function closeRecord(module, { replace = false } = {}) {
    const url = new URL(location.href);
    url.searchParams.delete('erp');
    url.searchParams.delete('record');
    url.searchParams.delete('recordMode');
    url.hash = `#erp-${module.key}`;
    ui.erp.record = null;
    ui.erp.recordMode = 'view';
    ui.route = `erp-${module.key}`;
    history[replace ? 'replaceState' : 'pushState']({ route: ui.route }, '', url);
    renderShell();
  }

  function pageDraftKey(module, record) {
    return `${PAGE_DRAFT_PREFIX}${workspaceKey()}:${module.key}:${record.id}`;
  }

  function serialize(form) {
    const values = {};
    [...form.elements].forEach(control => {
      if (!control.name || ['button', 'submit', 'file', 'password'].includes(control.type)) return;
      values[control.name] = control.type === 'checkbox' ? Boolean(control.checked) : control.value;
    });
    return values;
  }

  function savePageDraft(form, module, record, notify = false) {
    const payload = { savedAt: Date.now(), module: module.key, recordId: record.id, values: serialize(form) };
    const saved = safeWrite(pageDraftKey(module, record), payload);
    const indicator = form.querySelector('[data-rw-save-state]');
    if (indicator) indicator.textContent = saved ? `Draft saved ${new Date(payload.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Draft could not be saved';
    if (notify) toast(saved ? 'Draft saved. You can continue editing later.' : 'Draft could not be saved in this browser.', saved ? undefined : 'warning');
    return saved;
  }

  function clearPageDraft(module, record) {
    safeRemove(pageDraftKey(module, record));
  }

  function groupFields(module) {
    const layout = window.FormcraftFormWorkflow?.layoutSettings?.(module.key) || { hidden: [], order: [] };
    const hidden = new Set(arr(layout.hidden));
    const order = [...arr(layout.order), ...module.fields.map(field => field.name).filter(name => !arr(layout.order).includes(name))];
    const rank = new Map(order.map((name, index) => [name, index]));
    const visible = module.fields
      .filter(field => field.required || !hidden.has(field.name))
      .sort((a, b) => (rank.get(a.name) ?? 999) - (rank.get(b.name) ?? 999));
    const groups = [
      { key: 'details', label: 'Core details', copy: 'Identity and the main information for this record.', fields: [] },
      { key: 'schedule', label: 'Status and schedule', copy: 'Lifecycle, dates, timing and classification.', fields: [] },
      { key: 'values', label: 'Values and quantities', copy: 'Amounts, counts, rates and operational measurements.', fields: [] },
      { key: 'ownership', label: 'Ownership and context', copy: 'People, company, branch and connected records.', fields: [] },
      { key: 'notes', label: 'Notes and supporting context', copy: 'Long-form information, tags and internal context.', fields: [] }
    ];
    visible.forEach(field => {
      if (NOTES_FIELDS.test(field.name) || ['textarea', 'tags'].includes(field.type)) groups[4].fields.push(field);
      else if (OWNERSHIP_FIELDS.test(field.name) || ['member', 'company', 'branch', 'project', 'relation'].includes(field.type)) groups[3].fields.push(field);
      else if (VALUE_FIELDS.test(field.name) || ['money', 'number'].includes(field.type)) groups[2].fields.push(field);
      else if (SCHEDULE_FIELDS.test(field.name) || ['date', 'time', 'select', 'boolean'].includes(field.type)) groups[1].fields.push(field);
      else groups[0].fields.push(field);
    });
    return groups.filter(group => group.fields.length);
  }

  function optionsMarkup(options, value) {
    return arr(options).map(option => {
      const optionValue = Array.isArray(option) ? option[0] : option?.value ?? option;
      const label = Array.isArray(option) ? option[1] : option?.label ?? optionValue;
      return `<option value="${escape(optionValue)}" ${String(value ?? '') === String(optionValue) ? 'selected' : ''}>${escape(label)}</option>`;
    }).join('');
  }

  function fieldInput(module, schema, value) {
    const id = `rw-${module.key}-${schema.name}`;
    const required = schema.required ? 'required' : '';
    const common = `id="${id}" name="${escape(schema.name)}" ${required}`;
    const error = `<small class="rw-field-error" data-rw-error="${escape(schema.name)}"></small>`;
    const hint = schema.hint ? `<small class="rw-field-hint">${escape(schema.hint)}</small>` : '';
    const label = `<span>${escape(schema.label)}${schema.required ? ' <b>*</b>' : ''}</span>`;
    if (schema.type === 'textarea') return `<label class="rw-field span-2" for="${id}">${label}<textarea ${common} rows="6" placeholder="${escape(schema.placeholder || '')}">${escape(value || '')}</textarea>${hint}${error}</label>`;
    if (schema.type === 'boolean') return `<label class="rw-toggle span-2"><span><strong>${escape(schema.label)}</strong>${hint}</span><input type="checkbox" name="${escape(schema.name)}" ${value ? 'checked' : ''}></label>`;
    if (schema.type === 'select') return `<label class="rw-field" for="${id}">${label}<select ${common}>${optionsMarkup(schema.options, value)}</select>${hint}${error}</label>`;
    if (schema.type === 'relation') return `<label class="rw-field" for="${id}">${label}<select ${common}><option value="">Select</option>${optionsMarkup(ERP.relationOptions(schema.relation), value)}</select>${hint}${error}</label>`;
    if (schema.type === 'member') return `<label class="rw-field" for="${id}">${label}<select ${common}><option value="">Unassigned</option>${arr(state.team).filter(member => !member.pending).map(member => `<option value="${escape(member.id || member.userId)}" ${String(value || '') === String(member.id || member.userId) ? 'selected' : ''}>${escape(member.name)}</option>`).join('')}</select>${hint}${error}</label>`;
    if (schema.type === 'company') return `<label class="rw-field" for="${id}">${label}<select ${common}>${arr(state.erp?.settings?.companies).map(company => `<option value="${escape(company.id)}" ${String(value || state.erp.settings.activeCompanyId) === String(company.id) ? 'selected' : ''}>${escape(company.name)}</option>`).join('')}</select>${hint}${error}</label>`;
    if (schema.type === 'branch') return `<label class="rw-field" for="${id}">${label}<select ${common}>${arr(state.erp?.settings?.branches).map(branch => `<option value="${escape(branch.id)}" ${String(value || state.erp.settings.activeBranchId) === String(branch.id) ? 'selected' : ''}>${escape(branch.name)}</option>`).join('')}</select>${hint}${error}</label>`;
    if (schema.type === 'project') return `<label class="rw-field" for="${id}">${label}<select ${common}><option value="">No project</option>${arr(state.projects).map(project => `<option value="${escape(project.id)}" ${String(value || '') === String(project.id) ? 'selected' : ''}>${escape(project.name)}</option>`).join('')}</select>${hint}${error}</label>`;
    if (schema.type === 'module') return `<label class="rw-field" for="${id}">${label}<select ${common}><option value="">Select app</option>${optionsMarkup(ERP.moduleOptions(), value)}</select>${hint}${error}</label>`;
    const type = schema.type === 'money' ? 'number' : schema.type === 'tags' ? 'text' : schema.type || 'text';
    const displayValue = schema.type === 'tags' ? arr(value).join(', ') : value ?? schema.default ?? '';
    const step = schema.type === 'money' ? '.01' : schema.step !== undefined ? schema.step : schema.type === 'number' ? '1' : '';
    const min = schema.min !== undefined ? `min="${escape(schema.min)}"` : '';
    const max = schema.max !== undefined ? `max="${escape(schema.max)}"` : '';
    return `<label class="rw-field ${schema.span === 2 ? 'span-2' : ''}" for="${id}">${label}<input ${common} type="${escape(type)}" value="${escape(displayValue)}" ${step ? `step="${escape(step)}"` : ''} ${min} ${max} placeholder="${escape(schema.placeholder || '')}">${schema.type === 'date' ? '<small class="rw-field-hint" data-rw-dual-date></small>' : hint}${error}</label>`;
  }

  function workflowButtons(module, record) {
    const actions = window.FormcraftERPWorkflows?.actionsFor?.(module.key, record) || [];
    return actions.map(action => `<button class="button ${action.primary ? 'button-primary' : 'button-secondary'} button-small" type="button" data-erp-workflow="${escape(action.key)}" data-erp-module="${escape(module.key)}" data-erp-record="${escape(record.id)}">${icon(action.icon || 'arrowRight', 15)}${escape(action.label)}</button>`).join('');
  }

  function statusBadge(module, record) {
    const status = ERP.statusFor(module, record);
    return `<span class="rw-status" data-status="${escape(status)}">${escape(ERP.title(status))}</span>`;
  }

  function recentActivity(record) {
    const items = [
      ...arr(record.audit).map(item => ({ title: item.action, copy: item.detail, at: item.at, author: item.userName })),
      ...arr(record.comments).map(item => ({ title: 'Comment', copy: item.body, at: item.createdAt, author: item.author })),
      ...arr(record.activities).map(item => ({ title: item.summary, copy: `${item.type || 'activity'} · ${item.status || 'planned'}`, at: item.dueDate || item.createdAt, author: item.ownerName }))
    ].sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))).slice(0, 8);
    if (!items.length) return '<div class="rw-empty"><strong>No activity yet</strong><span>Changes and updates will appear here.</span></div>';
    return `<div class="rw-activity">${items.map(item => `<article><i></i><div><strong>${escape(item.title)}</strong><p>${escape(item.copy || '')}</p><small>${escape(item.author || 'Workspace member')} · ${escape(item.at ? new Date(item.at).toLocaleString() : '')}</small></div></article>`).join('')}</div>`;
  }

  function relatedRecords(module, record) {
    const links = window.FormcraftERPWorkflows?.relatedFor?.(module.key, record) || [];
    if (!links.length) return '<div class="rw-empty"><strong>No related records</strong><span>Connected records will appear as workflows run.</span></div>';
    return `<div class="rw-related">${links.slice(0, 8).map(link => `<button type="button" data-erp-open-related-module="${escape(link.moduleKey)}" data-erp-open-related-id="${escape(link.id)}"><span>${icon(ERP.appByKey(link.moduleKey)?.icon || 'arrowRight', 17)}<strong>${escape(link.label)}</strong></span><small>${escape(link.meta || '')}</small></button>`).join('')}</div>`;
  }

  function viewSection(group, module, record) {
    return `<section class="rw-card" id="rw-view-${escape(group.key)}"><header><div><span>${escape(group.label)}</span><p>${escape(group.copy)}</p></div></header><dl class="rw-detail-grid">${group.fields.map(schema => `<div class="${schema.span === 2 || schema.type === 'textarea' ? 'span-2' : ''}"><dt>${escape(schema.label)}</dt><dd>${escape(ERP.fieldValue(module, record, schema))}</dd></div>`).join('')}</dl></section>`;
  }

  function renderView(module, record) {
    const groups = groupFields(module);
    const updated = record.updatedAt || record.createdAt;
    return `<article class="record-workspace" data-record-workspace data-record-mode="view" data-record-module="${escape(module.key)}" data-record-id="${escape(record.id)}">
      <header class="rw-hero">
        <div class="rw-hero-copy"><button type="button" class="rw-text-button" data-rw-back>${icon('chevronLeft', 15)}${escape(module.label)}</button><div class="rw-title-row"><span class="rw-record-icon">${icon(module.icon || 'grid', 22)}</span><div><p>${escape(module.singular)} · ${escape(record.id.slice(0, 8))}</p><h1 data-route-heading>${escape(ERP.titleFor(module, record))}</h1></div>${statusBadge(module, record)}</div><p>${escape(module.description)}</p></div>
        <div class="rw-hero-actions">${workflowButtons(module, record)}${ERP.canEdit() ? `<button class="button button-primary" type="button" data-rw-edit>${icon('edit', 16)}Edit on page</button>` : ''}</div>
      </header>
      <div class="rw-view-layout">
        <aside class="rw-profile-card"><span class="rw-profile-icon">${icon(module.icon || 'grid', 28)}</span><strong>${escape(ERP.titleFor(module, record))}</strong><small>${escape(module.label)}</small><dl><div><dt>Status</dt><dd>${escape(ERP.title(ERP.statusFor(module, record)))}</dd></div><div><dt>Company</dt><dd>${escape(ERP.companyName(record.companyId))}</dd></div><div><dt>Branch</dt><dd>${escape(ERP.branchName(record.branchId))}</dd></div><div><dt>Updated</dt><dd>${escape(updated ? new Date(updated).toLocaleString() : '—')}</dd></div></dl></aside>
        <main class="rw-view-main">${groups.map(group => viewSection(group, module, record)).join('')}</main>
        <aside class="rw-view-side"><section class="rw-card"><header><div><span>Recent activity</span><p>Comments, changes and planned work.</p></div><button type="button" class="button button-secondary button-small" data-erp-add-note="${escape(record.id)}" data-erp-module="${escape(module.key)}">Add update</button></header>${recentActivity(record)}</section><section class="rw-card"><header><div><span>Connected records</span><p>Trace related operational work.</p></div></header>${relatedRecords(module, record)}</section></aside>
      </div>
    </article>`;
  }

  function renderEditor(module, record) {
    const draft = safeRead(pageDraftKey(module, record));
    const values = draft?.values || record;
    const groups = groupFields(module);
    return `<article class="record-workspace rw-editor" data-record-workspace data-record-workspace-editor data-record-mode="edit" data-record-module="${escape(module.key)}" data-record-id="${escape(record.id)}">
      <header class="rw-editor-header"><div><button type="button" class="rw-text-button" data-rw-cancel>${icon('chevronLeft', 15)}Back to record</button><p>${escape(module.label)}</p><h1 data-route-heading>Edit ${escape(ERP.titleFor(module, record))}</h1><span>Changes are saved locally while you work. The database updates only after Save changes.</span></div><div><span class="rw-save-state" data-rw-save-state>${draft ? `Recovered draft from ${escape(new Date(draft.savedAt).toLocaleString())}` : 'No unsaved changes'}</span><button class="button button-primary" type="submit" form="rw-record-form">${icon('check', 16)}Save changes</button></div></header>
      <form id="rw-record-form" class="rw-editor-layout" data-rw-form novalidate>
        <aside class="rw-editor-outline"><strong>Form sections</strong><nav>${groups.map((group, index) => `<button type="button" data-rw-jump="rw-edit-${escape(group.key)}" class="${index === 0 ? 'is-active' : ''}"><span>${String(index + 1).padStart(2, '0')}</span>${escape(group.label)}</button>`).join('')}</nav><div class="rw-draft-note"><strong>Draft recovery</strong><p>Leaving this page keeps the latest values on this device for seven days.</p></div></aside>
        <main class="rw-editor-main">${draft ? `<section class="rw-recovery-banner"><div><strong>Unsaved work restored</strong><span>Continue editing, save it, or discard the recovered draft.</span></div><button type="button" class="button button-secondary button-small" data-rw-discard>Discard draft</button></section>` : ''}${groups.map(group => `<fieldset class="rw-edit-section" id="rw-edit-${escape(group.key)}"><legend>${escape(group.label)}</legend><p>${escape(group.copy)}</p><div class="rw-form-grid">${group.fields.map(schema => fieldInput(module, schema, values[schema.name])).join('')}</div></fieldset>`).join('')}<p class="rw-form-summary" data-rw-form-summary aria-live="polite"></p></main>
        <aside class="rw-editor-side"><section><span>Editing</span><strong>${escape(ERP.titleFor(module, record))}</strong><small>${escape(module.singular)} · ${escape(record.id.slice(0, 8))}</small></section><section><span>Current status</span>${statusBadge(module, record)}</section><section class="rw-editor-side-actions"><button class="button button-primary" type="submit">Save changes</button><button class="button button-secondary" type="button" data-rw-save-return>Save draft & return</button><button class="button button-secondary" type="button" data-rw-cancel>Back without publishing</button></section><p>Published values remain unchanged until Save changes is selected.</p></aside>
      </form>
    </article>`;
  }

  function controlValue(schema, control) {
    if (schema.type === 'boolean') return Boolean(control.checked);
    if (schema.type === 'tags') return String(control.value || '').split(',').map(value => value.trim()).filter(Boolean);
    if (['number', 'money'].includes(schema.type)) return control.value === '' ? 0 : Number(control.value);
    return control.value;
  }

  function validate(form, module) {
    const errors = [];
    module.fields.forEach(schema => {
      const control = form.elements[schema.name];
      if (!control) return;
      const value = control.type === 'checkbox' ? control.checked : String(control.value || '').trim();
      let message = '';
      if (schema.required && (value === '' || value === null || value === undefined)) message = `${schema.label} is required.`;
      else if (schema.type === 'email' && value && !/^\S+@\S+\.\S+$/.test(value)) message = `Enter a valid ${schema.label.toLowerCase()}.`;
      else if (schema.type === 'url' && value) {
        try { new URL(value); } catch { message = `Enter a complete URL for ${schema.label.toLowerCase()}.`; }
      }
      const target = form.querySelector(`[data-rw-error="${CSS.escape(schema.name)}"]`);
      control.toggleAttribute('aria-invalid', Boolean(message));
      if (target) target.textContent = message;
      if (message) errors.push({ control, message });
    });
    const summary = form.querySelector('[data-rw-form-summary]');
    if (summary) summary.innerHTML = errors.length ? `<strong>Fix ${errors.length} field${errors.length === 1 ? '' : 's'} before saving.</strong><span>${escape(errors.map(item => item.message).join(' '))}</span>` : '';
    errors[0]?.control?.focus();
    return errors.length === 0;
  }

  async function publish(form, module, record) {
    if (!validate(form, module)) return;
    const before = ERP.titleFor(module, record);
    module.fields.forEach(schema => {
      const control = form.elements[schema.name];
      if (control) record[schema.name] = controlValue(schema, control);
    });
    record.updatedAt = now();
    ERP.recordAudit(module, record, 'Updated from record workspace', before === ERP.titleFor(module, record) ? 'Details changed' : `Renamed from ${before}`);
    clearPageDraft(module, record);
    await Promise.resolve(saveState());
    setRecordLocation(module, record, 'view', { replace: true });
    renderShell();
    toast(`${module.singular} updated.`);
  }

  function updateDualDates(form) {
    form.querySelectorAll('input[type="date"]').forEach(control => {
      const note = control.closest('.rw-field')?.querySelector('[data-rw-dual-date]');
      if (!note) return;
      try {
        note.textContent = control.value && typeof dualDate === 'function' ? `AD / BS: ${dualDate(control.value)}` : control.value ? `AD: ${control.value}` : 'Choose a date to see the BS equivalent.';
      } catch {
        note.textContent = control.value ? `AD: ${control.value}` : '';
      }
    });
  }

  function bindWorkspace() {
    const root = document.querySelector('[data-record-workspace]');
    if (!root || root.dataset.rwBound) return;
    root.dataset.rwBound = VERSION;
    const module = ERP.modulesByKey.get(root.dataset.recordModule);
    const record = module ? ERP.collection(module).find(item => item.id === root.dataset.recordId) : null;
    if (!module || !record) return;
    root.querySelectorAll('[data-rw-back]').forEach(button => button.addEventListener('click', () => closeRecord(module)));
    root.querySelector('[data-rw-edit]')?.addEventListener('click', () => openEditor(module.key, record.id));
    const form = root.querySelector('[data-rw-form]');
    if (!form) return;
    updateDualDates(form);
    let timer = 0;
    const persist = () => {
      clearTimeout(timer);
      timer = setTimeout(() => savePageDraft(form, module, record), 350);
      updateDualDates(form);
    };
    form.addEventListener('input', persist, true);
    form.addEventListener('change', persist, true);
    form.addEventListener('submit', event => {
      event.preventDefault();
      publish(form, module, record).catch(error => toast(error.message || 'Record could not be saved.', 'error'));
    });
    root.querySelectorAll('[data-rw-cancel]').forEach(button => button.addEventListener('click', () => {
      savePageDraft(form, module, record);
      setRecordLocation(module, record, 'view', { replace: true });
      renderShell();
      toast('Draft saved. Published values were not changed.');
    }));
    root.querySelector('[data-rw-save-return]')?.addEventListener('click', () => {
      savePageDraft(form, module, record);
      setRecordLocation(module, record, 'view', { replace: true });
      renderShell();
      toast('Draft saved. You can resume from Edit.');
    });
    root.querySelector('[data-rw-discard]')?.addEventListener('click', () => {
      clearPageDraft(module, record);
      renderShell();
      toast('Recovered draft discarded.', 'warning');
    });
    root.querySelectorAll('[data-rw-jump]').forEach(button => button.addEventListener('click', () => {
      root.querySelectorAll('[data-rw-jump]').forEach(item => item.classList.toggle('is-active', item === button));
      document.getElementById(button.dataset.rwJump)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }));
  }

  function modalIdentity(form) {
    const title = form.querySelector('#modal-title')?.textContent?.trim() || form.getAttribute('aria-label') || 'form';
    const semantic = Object.keys(form.dataset).filter(key => /form|module|mode|record|project|task|invoice|event/i.test(key)).sort().map(key => `${key}:${form.dataset[key]}`).join('|');
    const id = form.elements.id?.value || form.elements.recordId?.value || form.elements.projectId?.value || form.elements.taskId?.value || '';
    return `${MODAL_DRAFT_PREFIX}${workspaceKey()}:${ui.route}:${semantic || form.className}:${title}:${id}`;
  }

  function saveGenericModalDraft(form) {
    if (form.matches('[data-erp-form]')) return window.FormcraftFormWorkflow?.saveDraft?.(form) || false;
    if (!form.dataset.rwDirty || form.dataset.rwDirty !== 'true') return false;
    return safeWrite(modalIdentity(form), { savedAt: Date.now(), values: serialize(form) });
  }

  function enhanceGenericModal(form) {
    if (!form || form.matches('[data-erp-form]') || form.dataset.rwGenericDraft === VERSION) return;
    const key = modalIdentity(form);
    const draft = safeRead(key);
    if (draft) {
      Object.entries(draft.values).forEach(([name, value]) => {
        const control = form.elements[name];
        if (!control) return;
        if (control.type === 'checkbox') control.checked = Boolean(value);
        else control.value = value ?? '';
        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
      });
      const body = form.querySelector('.modal-body') || form.firstElementChild;
      body?.insertAdjacentHTML('afterbegin', `<div class="rw-modal-recovery"><div><strong>Recovered your last form values</strong><span>Closing a form now saves it automatically on this device.</span></div><button type="button" class="button button-secondary button-small" data-rw-clear-modal-draft>Discard</button></div>`);
      form.querySelector('[data-rw-clear-modal-draft]')?.addEventListener('click', event => { safeRemove(key); event.currentTarget.closest('.rw-modal-recovery')?.remove(); toast('Saved form draft discarded.', 'warning'); });
    }
    const baseline = JSON.stringify(serialize(form));
    const update = () => {
      form.dataset.rwDirty = String(JSON.stringify(serialize(form)) !== baseline);
      if (form.dataset.rwDirty === 'true') saveGenericModalDraft(form);
    };
    form.addEventListener('input', update, true);
    form.addEventListener('change', update, true);
    form.addEventListener('submit', () => {
      form.dataset.rwSubmitting = 'true';
      setTimeout(() => { if (!modal.open) safeRemove(key); }, 100);
    }, true);
    form.dataset.rwGenericDraft = VERSION;
  }

  if (workflowCloseModal) {
    closeModal = function closeModalWithAutomaticDraft(...args) {
      const form = modal.querySelector('form');
      if (form && !form.dataset.formCommitting && !form.dataset.rwSubmitting) {
        if (form.matches('[data-erp-form]') && form.dataset.formDirty === 'true') {
          window.FormcraftFormWorkflow?.saveDraft?.(form);
          form.dataset.formCommitting = 'draft-close';
          toast('Draft saved. Reopen the form to continue.');
        } else if (saveGenericModalDraft(form)) {
          form.dataset.rwDraftClose = 'true';
          toast('Form draft saved. Reopen it to continue.');
        }
      }
      return workflowCloseModal.apply(this, args);
    };
  }

  const modalObserver = new MutationObserver(() => {
    if (modal.open) requestAnimationFrame(() => enhanceGenericModal(modal.querySelector('form')));
  });
  modalObserver.observe(modal, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });

  function decorateShell() {
    document.querySelectorAll('.fc3-desktop-sidebar-toggle').forEach(button => {
      button.hidden = true;
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
    });
    document.documentElement.dataset.recordWorkspace = VERSION;
  }

  renderPage = function renderRecordWorkspacePage() {
    const target = recordTarget();
    if (target) return target.mode === 'edit' ? renderEditor(target.module, target.record) : renderView(target.module, target.record);
    return previousRenderPage();
  };

  bindPage = function bindRecordWorkspacePage() {
    previousBindPage();
    requestAnimationFrame(bindWorkspace);
  };

  renderShell = function renderRecordWorkspaceShell(...args) {
    const result = previousRenderShell.apply(this, args);
    requestAnimationFrame(() => { decorateShell(); bindWorkspace(); });
    return result;
  };

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const edit = target.closest('[data-erp-edit-record]');
    if (edit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openEditor(edit.dataset.erpModule, edit.dataset.erpEditRecord);
      return;
    }
    const open = target.closest('[data-erp-open-record]');
    if (open) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openRecord(open.dataset.erpModule, open.dataset.erpOpenRecord);
    }
  }, true);

  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(location.search);
    ui.erp.recordMode = params.get('recordMode') === 'edit' ? 'edit' : 'view';
    requestAnimationFrame(renderShell);
  });

  window.addEventListener('beforeunload', () => {
    const form = document.querySelector('[data-rw-form]');
    const root = form?.closest('[data-record-workspace]');
    const module = root ? ERP.modulesByKey.get(root.dataset.recordModule) : null;
    const record = module ? ERP.collection(module).find(item => item.id === root.dataset.recordId) : null;
    if (form && module && record) savePageDraft(form, module, record);
    const modalForm = modal.open ? modal.querySelector('form') : null;
    if (modalForm) saveGenericModalDraft(modalForm);
  });

  decorateShell();
  window.FormcraftRecordWorkspace = Object.freeze({
    version: VERSION,
    openRecord,
    openEditor,
    closeRecord,
    savePageDraft,
    clearPageDraft,
    renderView,
    renderEditor,
    audit() {
      return {
        status: document.querySelector('.fc3-desktop-sidebar-toggle:not([hidden])') ? 'blocked' : 'ready-to-test',
        redundantDesktopMenuRemoved: !document.querySelector('.fc3-desktop-sidebar-toggle:not([hidden])'),
        pageEditorAvailable: true,
        modalDraftAutosaveAvailable: Boolean(workflowCloseModal)
      };
    }
  });
})();
