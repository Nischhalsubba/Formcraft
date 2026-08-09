'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-MODULE-TOOLS-1.0';
  const ERP = window.FormcraftERP;
  const Depth = window.FormcraftProductDepth;
  if (!ERP || !Depth) return;

  const enhancedPages = new WeakSet();
  const escape = value => typeof window.escapeHtml === 'function'
    ? window.escapeHtml(value ?? '')
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const arr = value => Array.isArray(value) ? value : [];
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const ROLE_OPTIONS = [
    ['all', 'All apps'],
    ['sales', 'Sales'],
    ['finance', 'Finance'],
    ['hr', 'HR'],
    ['operations', 'Operations'],
    ['owner', 'Owner']
  ];

  function animateIn(node, y = 6) {
    if (!node || reduceMotion.matches || !window.gsap) return;
    window.gsap.fromTo(node, { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power3.out', clearProps: 'opacity,transform,visibility' });
  }

  async function persist() {
    await Promise.resolve(typeof saveState === 'function' ? saveState() : undefined);
    await Promise.resolve(window.FormcraftBackend?.flush?.());
  }

  function moduleForPage(page) {
    return ERP.modulesByKey.get(page?.dataset.erpModulePage || '');
  }

  function currentViewState() {
    return {
      moduleQuery: String(ui.erp.moduleQuery || ''),
      status: String(ui.erp.status || 'all'),
      archived: Boolean(ui.erp.archived),
      view: String(ui.erp.view || 'list')
    };
  }

  function applyView(view) {
    const filters = object(view?.filters);
    ui.erp.moduleQuery = String(filters.moduleQuery || '');
    ui.erp.status = String(filters.status || 'all');
    ui.erp.archived = Boolean(filters.archived);
    ui.erp.view = String(view?.sort?.view || filters.view || 'list');
    if (typeof renderShell === 'function') renderShell();
  }

  async function saveCurrentView(page) {
    const module = moduleForPage(page);
    if (!module) return;
    const suggested = `${module.label} view`;
    const name = window.prompt?.('Name this saved view', suggested)?.trim();
    if (!name) return;
    const state = currentViewState();
    Depth.views.upsert({
      moduleKey: module.key,
      name,
      filters: state,
      sort: { view: state.view }
    });
    await persist();
    if (typeof toast === 'function') toast(`Saved view “${name}”.`, 'success');
    if (typeof renderShell === 'function') renderShell();
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function exportSelected(module, records) {
    if (!records.length) return;
    const fields = module.fields.filter(field => field.name !== 'lineItemsJson');
    const lines = [fields.map(field => csvCell(field.label)).join(',')];
    records.forEach(record => {
      lines.push(fields.map(field => csvCell(record[field.name] ?? '')).join(','));
    });
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${module.key}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function selectedRecords(page, module) {
    const ids = [...page.querySelectorAll('[data-pd-select-record]:checked')].map(input => input.dataset.pdSelectRecord);
    return ERP.collection(module).filter(record => ids.includes(record.id));
  }

  function updateBulkBar(page, module) {
    const bar = page.querySelector('[data-pd-bulk-bar]');
    if (!bar) return;
    const records = selectedRecords(page, module);
    bar.querySelector('[data-pd-selected-count]').textContent = `${records.length} selected`;
    bar.hidden = records.length === 0;
  }

  function leaveSelectionMode(page) {
    page.classList.remove('pd-selection-mode');
    page.querySelectorAll('.pd-select-cell').forEach(cell => cell.remove());
    page.querySelector('[data-pd-bulk-bar]')?.remove();
  }

  function enterSelectionMode(page, module) {
    if (page.classList.contains('pd-selection-mode')) {
      leaveSelectionMode(page);
      return;
    }
    const table = page.querySelector('.erp-table');
    if (!table) {
      if (typeof toast === 'function') toast('Bulk selection is available in List view.', 'info');
      return;
    }
    page.classList.add('pd-selection-mode');
    const headRow = table.querySelector('thead tr');
    const head = document.createElement('th');
    head.className = 'pd-select-cell';
    head.innerHTML = '<input type="checkbox" data-pd-select-all aria-label="Select all visible records">';
    headRow.prepend(head);
    [...table.querySelectorAll('tbody tr')].forEach(row => {
      const id = row.querySelector('[data-erp-open-record]')?.dataset.erpOpenRecord;
      if (!id) return;
      const cell = document.createElement('td');
      cell.className = 'pd-select-cell';
      cell.innerHTML = `<input type="checkbox" data-pd-select-record="${escape(id)}" aria-label="Select record">`;
      row.prepend(cell);
    });
    const members = arr(state.members).filter(member => !member.archived);
    const bar = document.createElement('section');
    bar.className = 'pd-bulk-bar';
    bar.dataset.pdBulkBar = '';
    bar.hidden = true;
    bar.innerHTML = `<strong data-pd-selected-count>0 selected</strong><label><span>Status</span><select data-pd-bulk-status><option value="">Choose status</option>${arr(module.statuses).map(status => `<option value="${escape(status)}">${escape(ERP.title(status))}</option>`).join('')}</select></label><label><span>Owner</span><select data-pd-bulk-owner><option value="">Choose owner</option>${members.map(member => `<option value="${escape(member.id)}">${escape(member.name || member.email || 'Member')}</option>`).join('')}</select></label><div class="pd-bulk-actions"><button class="button button-secondary button-small" type="button" data-pd-bulk-apply-status>Update status</button><button class="button button-secondary button-small" type="button" data-pd-bulk-assign>Assign</button><button class="button button-secondary button-small" type="button" data-pd-bulk-archive>Archive</button><button class="button button-secondary button-small" type="button" data-pd-bulk-export>Export</button><button class="button button-ghost button-small" type="button" data-pd-bulk-done>Done</button></div>`;
    page.querySelector('.erp-module-surface')?.insertAdjacentElement('beforebegin', bar);

    table.addEventListener('change', event => {
      if (event.target.matches('[data-pd-select-all]')) {
        page.querySelectorAll('[data-pd-select-record]').forEach(input => { input.checked = event.target.checked; });
      }
      if (event.target.matches('[data-pd-select-record], [data-pd-select-all]')) updateBulkBar(page, module);
    });

    bar.addEventListener('click', async event => {
      const records = selectedRecords(page, module);
      if (!records.length) return;
      let action = '';
      if (event.target.closest('[data-pd-bulk-apply-status]')) action = 'status';
      else if (event.target.closest('[data-pd-bulk-assign]')) action = 'owner';
      else if (event.target.closest('[data-pd-bulk-archive]')) action = 'archive';
      else if (event.target.closest('[data-pd-bulk-export]')) action = 'export';
      else if (event.target.closest('[data-pd-bulk-done]')) { leaveSelectionMode(page); return; }
      else return;

      if (action === 'export') {
        exportSelected(module, records);
        return;
      }
      const status = bar.querySelector('[data-pd-bulk-status]')?.value || '';
      const ownerId = bar.querySelector('[data-pd-bulk-owner]')?.value || '';
      if (action === 'status' && !status) { toast?.('Choose a status first.', 'warning'); return; }
      if (action === 'owner' && !ownerId) { toast?.('Choose an owner first.', 'warning'); return; }
      records.forEach(record => {
        const before = structuredClone(record);
        if (action === 'status') record[module.statusField || 'status'] = status;
        if (action === 'owner') record.ownerId = ownerId;
        if (action === 'archive') record.archived = true;
        record.updatedAt = new Date().toISOString();
        Depth.audit.recordVersion(module.key, record, `bulk-${action}`, before);
        ERP.recordAudit?.(module, record, `Bulk ${action}`, `${records.length} records updated together`);
      });
      await persist();
      toast?.(`${records.length} record${records.length === 1 ? '' : 's'} updated.`, 'success');
      renderShell();
    });
    animateIn(bar, 4);
  }

  function normalizeImportValue(schema, value) {
    const raw = value == null ? '' : String(value).trim();
    if (schema.type === 'number' || schema.type === 'money') return raw === '' ? 0 : Number(raw.replaceAll(',', '')) || 0;
    if (schema.type === 'boolean') return /^(true|yes|1|y)$/i.test(raw);
    if (schema.type === 'tags') return raw.split(',').map(item => item.trim()).filter(Boolean);
    return raw;
  }

  function autoMapping(module, headers) {
    const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const fields = new Map(module.fields.map(field => [normalize(field.label), field.name]));
    module.fields.forEach(field => fields.set(normalize(field.name), field.name));
    return Object.fromEntries(headers.map(header => [header, fields.get(normalize(header)) || '']));
  }

  function importDialog() {
    let dialog = document.querySelector('[data-pd-import-dialog]');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'pd-import-dialog';
    dialog.dataset.pdImportDialog = '';
    dialog.innerHTML = '<form method="dialog"><button class="icon-button pd-dialog-close" value="cancel" aria-label="Close import center">×</button></form><div data-pd-import-content></div>';
    document.body.append(dialog);
    return dialog;
  }

  async function openImportCenter(module) {
    const dialog = importDialog();
    const content = dialog.querySelector('[data-pd-import-content]');
    content.innerHTML = `<header><span>Import center</span><h2>Import ${escape(module.label)}</h2><p>Upload CSV or XLSX, review field mapping, validate rows, then import only the valid records.</p></header><section class="pd-import-step"><label class="pd-import-file"><span>Choose CSV or XLSX</span><input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-pd-import-file></label></section><section data-pd-import-workspace></section><section class="pd-import-history"><h3>Recent imports</h3><div data-pd-import-history></div></section>`;
    const workspace = content.querySelector('[data-pd-import-workspace]');
    const history = content.querySelector('[data-pd-import-history]');

    function renderHistory() {
      const jobs = Depth.ensureDepthState().importJobs.filter(job => job.moduleKey === module.key).slice(0, 5);
      history.innerHTML = jobs.length ? jobs.map(job => `<article><div><strong>${escape(job.status)}</strong><span>${escape(job.createdAt?.slice(0, 16).replace('T', ' ') || '')}</span></div><small>${job.valid || 0} imported · ${job.invalid || 0} invalid · ${job.duplicates || 0} duplicates</small>${arr(job.recordIds).length ? `<button class="button button-ghost button-small" type="button" data-pd-rollback-import="${escape(job.id)}">Rollback</button>` : ''}</article>`).join('') : '<p>No import history for this app yet.</p>';
    }

    renderHistory();
    content.querySelector('[data-pd-import-file]').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      workspace.innerHTML = '<div class="pd-import-loading">Reading file…</div>';
      try {
        let rows;
        if (/\.xlsx$/i.test(file.name)) rows = await window.FormcraftXLSX.parse(file);
        else rows = Depth.imports.parseCsv(await file.text()).rows;
        if (!rows.length) throw new Error('The file has no data rows.');
        const headers = Object.keys(rows[0]);
        const mapping = autoMapping(module, headers);
        const renderMapping = () => headers.map(header => `<label><span>${escape(header)}</span><select data-pd-import-map="${escape(header)}"><option value="">Do not import</option>${module.fields.filter(field => field.name !== 'lineItemsJson').map(field => `<option value="${escape(field.name)}" ${mapping[header] === field.name ? 'selected' : ''}>${escape(field.label)}</option>`).join('')}</select></label>`).join('');
        workspace.innerHTML = `<div class="pd-import-mapping"><h3>Map columns</h3>${renderMapping()}</div><div class="pd-import-preview" data-pd-import-preview></div><div class="pd-import-actions"><button class="button button-secondary" type="button" data-pd-validate-import>Validate rows</button><button class="button button-primary" type="button" data-pd-run-import disabled>Import valid rows</button></div>`;
        let validation = null;
        const mappingFromUi = () => Object.fromEntries(headers.map(header => [header, workspace.querySelector(`[data-pd-import-map="${CSS.escape(header)}"]`)?.value || '']));
        const validate = () => {
          validation = Depth.imports.validate(module.key, rows, mappingFromUi());
          const preview = workspace.querySelector('[data-pd-import-preview]');
          preview.innerHTML = `<div class="pd-import-stats"><span><strong>${validation.valid.length}</strong> valid</span><span><strong>${validation.invalid.length}</strong> invalid</span><span><strong>${validation.duplicates.length}</strong> duplicates</span></div><div class="pd-import-sample">${validation.invalid.slice(0, 4).map(item => `<p>Row ${item.rowIndex}: missing ${escape(item.missing.join(', '))}</p>`).join('') || '<p>Required-field validation passed.</p>'}</div>`;
          workspace.querySelector('[data-pd-run-import]').disabled = validation.valid.length === 0;
          return validation;
        };
        workspace.querySelector('[data-pd-validate-import]').addEventListener('click', validate);
        workspace.querySelector('[data-pd-run-import]').addEventListener('click', async () => {
          const result = validation || validate();
          const created = [];
          result.valid.forEach(item => {
            const values = {};
            module.fields.forEach(schema => {
              if (Object.prototype.hasOwnProperty.call(item.values, schema.name)) values[schema.name] = normalizeImportValue(schema, item.values[schema.name]);
            });
            const record = ERP.makeRecord(module, values);
            ERP.collection(module).unshift(record);
            Depth.audit.recordVersion(module.key, record, 'import-created');
            created.push(record.id);
          });
          const job = Depth.imports.recordJob(module.key, {
            status: 'completed', total: rows.length, valid: created.length,
            invalid: result.invalid.length, duplicates: result.duplicates.length
          });
          job.recordIds = created;
          await persist();
          toast?.(`${created.length} ${module.label.toLowerCase()} record${created.length === 1 ? '' : 's'} imported.`, 'success');
          renderHistory();
          workspace.querySelector('[data-pd-run-import]').disabled = true;
        });
      } catch (error) {
        workspace.innerHTML = `<div class="pd-import-error"><strong>Could not read this file.</strong><span>${escape(error?.message || 'Unknown import error')}</span></div>`;
      }
    });

    history.addEventListener('click', async event => {
      const button = event.target.closest('[data-pd-rollback-import]');
      if (!button) return;
      const job = Depth.ensureDepthState().importJobs.find(item => item.id === button.dataset.pdRollbackImport);
      if (!job?.recordIds?.length) return;
      if (!window.confirm?.(`Rollback ${job.recordIds.length} imported record${job.recordIds.length === 1 ? '' : 's'}?`)) return;
      const ids = new Set(job.recordIds);
      const collection = ERP.collection(module);
      for (let index = collection.length - 1; index >= 0; index -= 1) {
        if (ids.has(collection[index].id)) collection.splice(index, 1);
      }
      job.status = 'rolled-back';
      job.recordIds = [];
      job.rolledBackAt = new Date().toISOString();
      await persist();
      toast?.('Import rolled back.', 'success');
      renderHistory();
    });

    dialog.showModal();
    animateIn(dialog.querySelector('[data-pd-import-content]'), 8);
  }

  function enhanceModulePage(page) {
    if (!page || enhancedPages.has(page)) return;
    const module = moduleForPage(page);
    const actions = page.querySelector('.erp-module-actions');
    if (!module || !actions) return;
    enhancedPages.add(page);
    const views = Depth.views.all().filter(view => view.moduleKey === module.key);
    const tools = document.createElement('div');
    tools.className = 'pd-module-tools';
    tools.innerHTML = `<label class="pd-saved-view"><span class="sr-only">Saved view</span><select data-pd-saved-view><option value="">Saved views</option>${views.map(view => `<option value="${escape(view.id)}">${escape(view.name)}</option>`).join('')}</select></label><button class="button button-secondary button-small" type="button" data-pd-save-view>Save view</button><button class="button button-secondary button-small" type="button" data-pd-select-mode>Select</button><button class="button button-secondary button-small" type="button" data-pd-import-open>Import</button>`;
    actions.prepend(tools);
    tools.querySelector('[data-pd-saved-view]').addEventListener('change', event => {
      const view = views.find(item => item.id === event.target.value);
      if (view) applyView(view);
    });
    tools.querySelector('[data-pd-save-view]').addEventListener('click', () => saveCurrentView(page));
    tools.querySelector('[data-pd-select-mode]').addEventListener('click', () => enterSelectionMode(page, module));
    tools.querySelector('[data-pd-import-open]').addEventListener('click', () => openImportCenter(module));
  }

  function applyRoleFocus(root, role) {
    const depth = Depth.ensureDepthState();
    depth.preferences.roleFocus = role;
    const allowed = role === 'all' ? null : new Set(Depth.roles.profile(role).apps);
    root.querySelectorAll('.erp-app-card').forEach(card => {
      const key = card.querySelector('[data-erp-open-app]')?.dataset.erpOpenApp || '';
      card.hidden = Boolean(allowed && key && !allowed.has(key));
    });
    root.querySelectorAll('.erp-launcher-group').forEach(group => {
      group.hidden = !group.querySelector('.erp-app-card:not([hidden])');
    });
    document.querySelectorAll('.fc4-nav-item[data-nav-key]').forEach(item => {
      const key = item.dataset.navKey;
      if (!ERP.appByKey(key)) return;
      item.hidden = Boolean(allowed && !allowed.has(key));
    });
  }

  function enhanceLauncher() {
    const launcher = document.querySelector('.erp-launcher');
    if (!launcher || launcher.querySelector('[data-pd-role-focus]')) return;
    const depth = Depth.ensureDepthState();
    const current = String(depth.preferences.roleFocus || 'all');
    const focus = document.createElement('section');
    focus.className = 'pd-role-focus';
    focus.dataset.pdRoleFocus = '';
    focus.innerHTML = `<div><span>Role focus</span><strong>Show the apps that matter to this job</strong></div><div role="group" aria-label="Role focused apps">${ROLE_OPTIONS.map(([key, label]) => `<button type="button" data-pd-role="${key}" class="${current === key ? 'is-active' : ''}">${label}</button>`).join('')}</div>`;
    launcher.querySelector('.erp-launcher-hero')?.insertAdjacentElement('afterend', focus);
    focus.addEventListener('click', async event => {
      const button = event.target.closest('[data-pd-role]');
      if (!button) return;
      focus.querySelectorAll('[data-pd-role]').forEach(item => item.classList.toggle('is-active', item === button));
      applyRoleFocus(launcher, button.dataset.pdRole);
      await persist();
    });
    applyRoleFocus(launcher, current);
  }

  function enhance() {
    document.querySelectorAll('[data-erp-module-page]').forEach(enhanceModulePage);
    enhanceLauncher();
    document.documentElement.dataset.formcraftProductDepthModuleTools = VERSION;
  }

  new MutationObserver(() => requestAnimationFrame(enhance)).observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
  document.addEventListener('formcraft:workspace-ready', enhance);
  enhance();

  window.FormcraftProductDepthModuleTools = Object.freeze({ version: VERSION, refresh: enhance, openImportCenter });
})();
