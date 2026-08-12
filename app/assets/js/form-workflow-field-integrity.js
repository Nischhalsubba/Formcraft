'use strict';

(() => {
  const VERSION = 'FORMCRAFT-FORM-FIELD-INTEGRITY-1.0';
  const modal = document.querySelector('[data-modal]');
  const ERP = window.FormcraftERP;
  if (!modal || !ERP) return;

  const arr = value => Array.isArray(value) ? value : [];
  const option = (value, label) => ({ value: String(value ?? ''), label: String(label ?? value ?? '') });

  function choices(schema) {
    if (schema.type === 'relation') {
      const related = ERP.modulesByKey.get(schema.relation);
      return related ? ERP.collection(related).map(record => option(record.id, ERP.recordTitle(related, record))) : [];
    }
    if (schema.type === 'member') return arr(state.team).map(record => option(record.id || record.userId, record.name || record.email));
    if (schema.type === 'company') return arr(state.erp?.companies).map(record => option(record.id, record.name));
    if (schema.type === 'branch') return arr(state.erp?.branches).map(record => option(record.id, record.name));
    if (schema.type === 'project') return arr(state.projects).map(record => option(record.id, record.name));
    if (schema.type === 'module') return ERP.MODULES.map(record => option(record.key, record.label));
    return arr(schema.options).map(item => Array.isArray(item) ? option(item[0], item[1]) : option(item, item));
  }

  function createControl(schema) {
    let control;
    if (['select', 'relation', 'member', 'company', 'branch', 'project', 'module'].includes(schema.type)) {
      control = document.createElement('select');
      control.append(new Option('Select', ''));
      choices(schema).forEach(item => control.append(new Option(item.label, item.value)));
    } else if (schema.type === 'textarea' || schema.type === 'tags') {
      control = document.createElement('textarea');
      control.rows = schema.type === 'textarea' ? 4 : 2;
      if (schema.type === 'tags') control.placeholder = 'Separate tags with commas';
    } else if (schema.type === 'boolean') {
      control = document.createElement('input');
      control.type = 'checkbox';
    } else {
      control = document.createElement('input');
      control.type = schema.type === 'money' || schema.type === 'number'
        ? 'number'
        : ['email', 'tel', 'url', 'date', 'time'].includes(schema.type) ? schema.type : 'text';
      if (schema.type === 'money') control.step = schema.step || '0.01';
      if (schema.type === 'number') control.step = schema.step || '1';
      if (schema.min !== undefined) control.min = String(schema.min);
      if (schema.max !== undefined) control.max = String(schema.max);
      if (schema.type === 'money') control.inputMode = 'decimal';
      if (schema.type === 'number') control.inputMode = Number(control.step) < 1 ? 'decimal' : 'numeric';
    }
    control.name = schema.name;
    control.id = `erp-integrity-${schema.name}`;
    control.required = Boolean(schema.required);
    if (schema.default !== undefined && schema.default !== null) {
      if (control.type === 'checkbox') control.checked = Boolean(schema.default);
      else control.value = String(schema.default);
    }
    return control;
  }

  function createWrapper(schema, module) {
    const wrapper = document.createElement('label');
    wrapper.className = schema.type === 'boolean'
      ? `erp-switch-field${schema.span === 2 ? ' span-2' : ''}`
      : `erp-field${schema.span === 2 ? ' span-2' : ''}`;
    wrapper.dataset.integrityField = schema.name;
    const label = document.createElement('span');
    label.textContent = `${schema.label}${schema.required ? ' *' : ''}`;
    const control = createControl(schema);
    const error = document.createElement('em');
    error.dataset.erpErrorFor = schema.name;
    error.id = `error-${module.key}-${schema.name}`;
    control.setAttribute('aria-describedby', error.id);
    if (schema.type === 'boolean') wrapper.append(control, label, error);
    else wrapper.append(label, control, error);
    return wrapper;
  }

  function sectionFor(form, module, schema) {
    if (module.key === 'payroll') {
      if (['name', 'employeeCount'].includes(schema.name)) return form.querySelector('[data-form-section="payroll-identity"]');
      if (schema.name === 'pf') return form.querySelector('[data-form-section="deductions"]');
    }
    let section = form.querySelector('[data-form-section="additional-details"]');
    if (section) return section;
    section = document.createElement('fieldset');
    section.className = 'erp-form-section';
    section.dataset.formSection = 'additional-details';
    const legend = document.createElement('legend');
    legend.textContent = 'Additional details';
    const help = document.createElement('p');
    help.textContent = 'Schema fields not assigned to a custom section are retained here.';
    const grid = document.createElement('div');
    grid.className = 'erp-form-grid';
    section.append(legend, help, grid);
    form.querySelector('.erp-form-sections')?.append(section);
    return section;
  }

  function hiddenFields(module) {
    const layout = window.FormcraftFormWorkflow?.layoutSettings?.(module.key) || {};
    return new Set(arr(layout.hidden));
  }

  function repair(form) {
    if (!form?.matches('[data-erp-form]') || form.dataset.fieldIntegrity === VERSION) return;
    const module = ERP.modulesByKey.get(form.dataset.erpModule);
    if (!module || form.dataset.workflowEnhanced !== 'FORMCRAFT-FORM-WORKFLOW-1.0') return;
    const hidden = hiddenFields(module);
    const added = [];
    module.fields.forEach(schema => {
      if (form.elements[schema.name]) return;
      if (hidden.has(schema.name) && !schema.required) return;
      const section = sectionFor(form, module, schema);
      const grid = section?.querySelector('.erp-form-grid');
      if (!grid) return;
      const wrapper = createWrapper(schema, module);
      if (module.key === 'payroll' && schema.name === 'name') grid.prepend(wrapper);
      else grid.append(wrapper);
      added.push(schema.name);
    });
    form.dataset.fieldIntegrity = VERSION;
    form.dataset.integrityAdded = added.join(',');
  }

  const observer = new MutationObserver(() => {
    const form = modal.open ? modal.querySelector('form[data-erp-form]') : null;
    if (form) requestAnimationFrame(() => repair(form));
  });
  observer.observe(modal, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });

  window.FormcraftFormFieldIntegrity = Object.freeze({ version: VERSION, repair });
})();
