'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-AUTOMATION-1.0';
  const ERP = window.FormcraftERP;
  const Depth = window.FormcraftProductDepth;
  if (!ERP || !Depth) return;

  const enhanced = new WeakSet();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const escape = value => typeof window.escapeHtml === 'function'
    ? window.escapeHtml(value ?? '')
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const arr = value => Array.isArray(value) ? value : [];

  const TRIGGERS = [
    ['record-created', 'Record created'],
    ['record-updated', 'Record updated'],
    ['status-changed', 'Status changed'],
    ['date-reached', 'Date reached'],
    ['scheduled', 'Scheduled'],
    ['webhook', 'Webhook received']
  ];
  const OPERATORS = [
    ['equals', 'equals'], ['not-equals', 'does not equal'], ['contains', 'contains'],
    ['gt', 'is greater than'], ['lt', 'is less than'], ['exists', 'is present']
  ];
  const ACTIONS = [
    ['notify', 'Notify'], ['create-record', 'Create record'], ['update-record', 'Update record'],
    ['request-approval', 'Request approval'], ['send-webhook', 'Send webhook']
  ];

  function patchSchema() {
    const module = ERP.modulesByKey.get('automations');
    if (!module || module.fields.some(field => field.name === 'definitionJson')) return;
    module.fields.push({ name: 'definitionJson', label: 'Automation definition', type: 'textarea', span: 2, hint: 'Managed by the visual automation builder.' });
  }

  function parseDefinition(form) {
    try {
      const parsed = JSON.parse(form.elements.definitionJson?.value || '{}');
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    return {
      name: form.elements.name?.value || '',
      targetModule: form.elements.targetModule?.value || '',
      trigger: { type: form.elements.trigger?.value || 'record-created' },
      conditions: [],
      actions: [{ type: form.elements.action?.value || 'notify', config: {} }]
    };
  }

  function conditionRow(condition = {}) {
    return `<div class="pd-automation-row" data-pd-condition-row>
      <label><span>Field</span><input data-pd-condition="field" value="${escape(condition.field || '')}" placeholder="status"></label>
      <label><span>Operator</span><select data-pd-condition="operator">${OPERATORS.map(([value, label]) => `<option value="${value}" ${condition.operator === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label><span>Value</span><input data-pd-condition="value" value="${escape(condition.value ?? '')}" placeholder="approved"></label>
      <button class="icon-button" type="button" data-pd-remove-condition aria-label="Remove condition">${typeof icon === 'function' ? icon('trash', 15) : '×'}</button>
    </div>`;
  }

  function actionRow(action = {}) {
    const type = action.type || 'notify';
    return `<div class="pd-automation-row pd-automation-action-row" data-pd-action-row>
      <label><span>Action</span><select data-pd-action="type">${ACTIONS.map(([value, label]) => `<option value="${value}" ${type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="pd-automation-config"><span>Configuration</span><input data-pd-action="config" value="${escape(action.config?.value || action.config?.url || action.config?.message || '')}" placeholder="Message, field update, URL or target"></label>
      <button class="icon-button" type="button" data-pd-remove-action aria-label="Remove action">${typeof icon === 'function' ? icon('trash', 15) : '×'}</button>
    </div>`;
  }

  function readDefinition(form, builder) {
    const trigger = builder.querySelector('[data-pd-trigger]')?.value || 'record-created';
    const targetModule = builder.querySelector('[data-pd-target-module]')?.value || form.elements.targetModule?.value || '';
    const conditions = [...builder.querySelectorAll('[data-pd-condition-row]')].map(row => ({
      field: row.querySelector('[data-pd-condition="field"]')?.value.trim() || '',
      operator: row.querySelector('[data-pd-condition="operator"]')?.value || 'equals',
      value: row.querySelector('[data-pd-condition="value"]')?.value ?? ''
    })).filter(item => item.field);
    const actions = [...builder.querySelectorAll('[data-pd-action-row]')].map(row => {
      const type = row.querySelector('[data-pd-action="type"]')?.value || 'notify';
      const value = row.querySelector('[data-pd-action="config"]')?.value.trim() || '';
      const config = type === 'send-webhook' ? { url: value } : type === 'notify' ? { message: value } : { value };
      return { type, config };
    });
    return {
      name: form.elements.name?.value.trim() || 'Automation',
      targetModule,
      trigger: { type },
      conditions,
      actions
    };
  }

  function syncLegacy(form, definition) {
    if (form.elements.definitionJson) form.elements.definitionJson.value = JSON.stringify(definition);
    if (form.elements.trigger) form.elements.trigger.value = definition.trigger.type;
    if (form.elements.targetModule) form.elements.targetModule.value = definition.targetModule || '';
    if (form.elements.action) form.elements.action.value = definition.actions[0]?.type || 'notify';
    const firstWebhook = definition.actions.find(item => item.type === 'send-webhook');
    if (form.elements.webhookUrl && firstWebhook?.config?.url) form.elements.webhookUrl.value = firstWebhook.config.url;
  }

  function renderValidation(builder, definition) {
    const result = Depth.automation.validate(definition);
    const output = builder.querySelector('[data-pd-automation-validation]');
    output.classList.toggle('is-valid', result.valid);
    output.classList.toggle('is-invalid', !result.valid);
    output.innerHTML = result.valid
      ? `<strong>Ready to test</strong><span>${definition.conditions.length} condition${definition.conditions.length === 1 ? '' : 's'} · ${definition.actions.length} action${definition.actions.length === 1 ? '' : 's'}</span>`
      : `<strong>Needs attention</strong><span>${escape(result.errors.join(' · '))}</span>`;
    return result;
  }

  function moduleOptions(selected = '') {
    return `<option value="">Choose target app</option>${ERP.MODULES.map(module => `<option value="${escape(module.key)}" ${module.key === selected ? 'selected' : ''}>${escape(module.label)}</option>`).join('')}`;
  }

  async function recordTestRun(form, definition, validation) {
    const recordId = form.dataset.erpRecord || '';
    const run = Depth.automation.recordRun(recordId || 'draft', {
      status: validation.valid ? 'simulated' : 'blocked',
      trigger: definition.trigger,
      targetModule: definition.targetModule,
      conditionCount: definition.conditions.length,
      actionCount: definition.actions.length,
      message: validation.valid ? 'Test run completed without executing external side effects.' : validation.errors.join(' · ')
    });
    await Promise.resolve(typeof saveState === 'function' ? saveState() : undefined);
    builderHistory(form, form.querySelector('[data-pd-automation-builder]'));
    if (typeof toast === 'function') toast(validation.valid ? 'Automation test completed. No external actions were executed.' : 'Automation test blocked by validation.', validation.valid ? 'success' : 'warning');
    return run;
  }

  function builderHistory(form, builder) {
    if (!builder) return;
    const recordId = form.dataset.erpRecord || 'draft';
    const runs = Depth.ensureDepthState().automationRuns.filter(run => run.automationId === recordId).slice(0, 5);
    const host = builder.querySelector('[data-pd-automation-history]');
    host.innerHTML = runs.length ? runs.map(run => `<article data-status="${escape(run.status)}"><div><strong>${escape(run.status)}</strong><time>${escape((run.createdAt || '').slice(0, 16).replace('T', ' '))}</time></div><span>${escape(run.message || `${run.actionCount || 0} actions`)}</span></article>`).join('') : '<p>No test runs yet.</p>';
  }

  function enhanceForm(form) {
    if (!form || enhanced.has(form) || form.dataset.erpModule !== 'automations') return;
    enhanced.add(form);
    const definition = parseDefinition(form);
    const builder = document.createElement('section');
    builder.className = 'pd-automation-builder';
    builder.dataset.pdAutomationBuilder = '';
    builder.innerHTML = `<header><div><span>Visual automation</span><h3>Trigger → conditions → actions</h3><p>Build and test the workflow here. Existing Automation fields remain compatible underneath.</p></div><button class="button button-secondary button-small" type="button" data-pd-test-automation>Test workflow</button></header>
      <div class="pd-automation-trigger"><label><span>When</span><select data-pd-trigger>${TRIGGERS.map(([value, label]) => `<option value="${value}" ${definition.trigger?.type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label><span>Target app</span><select data-pd-target-module>${moduleOptions(definition.targetModule)}</select></label></div>
      <section><header><div><strong>Conditions</strong><span>All conditions must match.</span></div><button class="button button-ghost button-small" type="button" data-pd-add-condition>Add condition</button></header><div class="pd-automation-rows" data-pd-condition-list>${arr(definition.conditions).map(conditionRow).join('')}</div></section>
      <section><header><div><strong>Actions</strong><span>Actions run in order after conditions pass.</span></div><button class="button button-ghost button-small" type="button" data-pd-add-action>Add action</button></header><div class="pd-automation-rows" data-pd-action-list>${arr(definition.actions).length ? arr(definition.actions).map(actionRow).join('') : actionRow({ type: 'notify' })}</div></section>
      <div class="pd-automation-validation" data-pd-automation-validation></div>
      <section class="pd-automation-history"><header><div><strong>Test run history</strong><span>Test runs never execute external side effects.</span></div></header><div data-pd-automation-history></div></section>`;
    const grid = form.querySelector('.erp-form-grid');
    if (grid) (grid.closest('fieldset') || grid).insertAdjacentElement('afterend', builder);
    else form.append(builder);
    form.elements.definitionJson?.closest('label, .rw-field')?.classList.add('pd-internal-automation-field');

    function sync() {
      const next = readDefinition(form, builder);
      syncLegacy(form, next);
      return renderValidation(builder, next);
    }
    builder.addEventListener('input', sync);
    builder.addEventListener('change', sync);
    builder.addEventListener('click', event => {
      if (event.target.closest('[data-pd-add-condition]')) builder.querySelector('[data-pd-condition-list]').insertAdjacentHTML('beforeend', conditionRow());
      if (event.target.closest('[data-pd-add-action]')) builder.querySelector('[data-pd-action-list]').insertAdjacentHTML('beforeend', actionRow({ type: 'notify' }));
      event.target.closest('[data-pd-remove-condition]')?.closest('[data-pd-condition-row]')?.remove();
      event.target.closest('[data-pd-remove-action]')?.closest('[data-pd-action-row]')?.remove();
      if (event.target.closest('[data-pd-test-automation]')) {
        const next = readDefinition(form, builder);
        const validation = renderValidation(builder, next);
        syncLegacy(form, next);
        recordTestRun(form, next, validation);
      }
      sync();
    });
    form.addEventListener('submit', () => {
      const next = readDefinition(form, builder);
      syncLegacy(form, next);
    }, true);
    sync();
    builderHistory(form, builder);
    if (!reduceMotion.matches && window.gsap) window.gsap.fromTo(builder, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .22, ease: 'power3.out', clearProps: 'opacity,transform,visibility' });
  }

  function enhance() {
    patchSchema();
    document.querySelectorAll('form[data-erp-form="true"], form[data-erp-form]').forEach(enhanceForm);
    document.documentElement.dataset.formcraftProductDepthAutomation = VERSION;
  }

  new MutationObserver(() => requestAnimationFrame(enhance)).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('formcraft:workspace-ready', enhance);
  enhance();

  window.FormcraftProductDepthAutomationUI = Object.freeze({ version: VERSION, refresh: enhance });
})();
