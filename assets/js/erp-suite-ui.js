'use strict';

(() => {
  const ERP = window.FormcraftERP;
  if (!ERP) throw new Error('Formcraft ERP schema must load before the ERP UI.');

  const {
    GROUPS, MODULES, NATIVE_APPS, allApps, appByKey, moduleByRoute, ensureERPState, collection,
    makeRecord, fieldValue, titleFor, statusFor, canEdit, recordAudit, rememberApp, toggleFavorite,
    moduleMetrics, relationOptions, moduleOptions, arr, num, round, title, now
  } = ERP;

  const previous = {
    renderPage,
    bindPage,
    renderShell,
    handleContextCreate,
    contextCreateLabel,
    openCommandMenu
  };

  routes.apps = {
    label: 'Apps',
    title: 'Business apps',
    description: 'Open connected modules across finance, sales, operations, people, services, and productivity.',
    icon: 'grid'
  };

  MODULES.forEach(module => {
    routes[`erp-${module.key}`] = {
      label: module.label,
      title: module.label,
      description: module.description,
      icon: module.icon
    };
  });

  function escape(value = '') {
    return typeof escapeHtml === 'function' ? escapeHtml(value) : String(value);
  }

  function currency(value) {
    const code = state.erp?.settings?.currency || 'NPR';
    try {
      return new Intl.NumberFormat('en-NP', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(num(value));
    } catch {
      return `${code} ${round(value).toFixed(2)}`;
    }
  }

  function formatTimestamp(value) {
    if (!value) return '—';
    try {
      return typeof formatDateTime === 'function' ? formatDateTime(value) : new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }

  function nativeCount(app) {
    if (app.key === 'projects') return state.projects?.length || 0;
    if (app.key === 'calendar') return state.events?.length || 0;
    if (app.key === 'files') return state.files?.length || 0;
    if (app.key === 'invoices') return state.invoices?.length || 0;
    if (app.key === 'team') return state.team?.length || 0;
    if (app.key === 'email') return state.messages?.length || 0;
    return 0;
  }

  function appCount(app) {
    if (app.nativeRoute) return nativeCount(app);
    return moduleMetrics(app).total;
  }

  function appRoute(app) {
    return app.nativeRoute || `erp-${app.key}`;
  }

  function isFavorite(key) {
    ensureERPState();
    return state.erp.settings.favorites.includes(key);
  }

  function renderContextSwitchers(compact = false) {
    ensureERPState();
    const companies = state.erp.settings.companies;
    const branches = state.erp.settings.branches.filter(branch => branch.companyId === state.erp.settings.activeCompanyId);
    return `<div class="erp-context-switchers ${compact ? 'is-compact' : ''}">
      <label><span>Company</span><select data-erp-company>${companies.map(company => `<option value="${escape(company.id)}" ${company.id === state.erp.settings.activeCompanyId ? 'selected' : ''}>${escape(company.name)}</option>`).join('')}</select></label>
      <label><span>Branch</span><select data-erp-branch>${branches.map(branch => `<option value="${escape(branch.id)}" ${branch.id === state.erp.settings.activeBranchId ? 'selected' : ''}>${escape(branch.name)}</option>`).join('')}</select></label>
    </div>`;
  }

  function groupTabs(active) {
    return `<div class="erp-group-tabs" role="tablist" aria-label="App groups">
      <button type="button" class="${active === 'all' ? 'is-active' : ''}" data-erp-launcher-group="all">All apps</button>
      ${GROUPS.map(group => `<button type="button" class="${active === group.key ? 'is-active' : ''}" data-erp-launcher-group="${group.key}">${escape(group.label)}</button>`).join('')}
    </div>`;
  }

  function appCard(app) {
    const favorite = isFavorite(app.key);
    const metrics = app.nativeRoute ? null : moduleMetrics(app);
    const count = appCount(app);
    return `<article class="erp-app-card" data-app-group="${escape(app.group)}">
      <button class="erp-app-favorite ${favorite ? 'is-active' : ''}" type="button" data-erp-favorite-app="${escape(app.key)}" aria-label="${favorite ? 'Remove' : 'Add'} ${escape(app.label)} ${favorite ? 'from' : 'to'} favorites" title="${favorite ? 'Remove from favorites' : 'Add to favorites'}">${icon('star', 16)}</button>
      <button class="erp-app-open" type="button" data-erp-open-app="${escape(app.key)}">
        <span class="erp-app-icon">${icon(app.icon || 'grid', 23)}</span>
        <span class="erp-app-copy"><strong>${escape(app.label)}</strong><small>${escape(app.description)}</small></span>
        <span class="erp-app-meta"><b>${count}</b><small>${app.nativeRoute ? 'workspace records' : metrics?.active ? `${metrics.active} active` : 'ready'}</small></span>
      </button>
    </article>`;
  }

  function appSection(titleText, copyText, apps) {
    if (!apps.length) return '';
    return `<section class="erp-app-section"><header><div><p class="panel-kicker">${escape(titleText)}</p><h2>${escape(copyText)}</h2></div><span>${apps.length} app${apps.length === 1 ? '' : 's'}</span></header><div class="erp-app-grid">${apps.map(appCard).join('')}</div></section>`;
  }

  function renderAppLauncher() {
    ensureERPState();
    const query = String(ui.erp.launcherQuery || '').trim().toLowerCase();
    const activeGroup = ui.erp.launcherGroup || 'all';
    const filtered = allApps.filter(app => {
      const searchable = `${app.label} ${app.description} ${GROUPS.find(group => group.key === app.group)?.label || ''}`.toLowerCase();
      return (!query || searchable.includes(query)) && (activeGroup === 'all' || app.group === activeGroup);
    });
    const favorites = filtered.filter(app => isFavorite(app.key));
    const recent = state.erp.settings.recentApps.map(appByKey).filter(Boolean).filter(app => filtered.includes(app));
    const totalRecords = allApps.reduce((total, app) => total + appCount(app), 0);
    const activeModules = allApps.filter(app => appCount(app) > 0).length;
    const openApprovals = collection('approvalRequests').filter(item => ['draft', 'submitted'].includes(item.status)).length;
    const openTickets = collection('tickets').filter(item => !['resolved', 'closed'].includes(item.status)).length;

    return `<div class="content-shell page-stack erp-launcher">
      <section class="erp-launcher-hero">
        <div><p class="panel-kicker">Nepal-first ERP workspace</p><h2>One workspace, connected business operations</h2><p>Open modules without turning the sidebar into a tax-form-sized wall of links. Records share contacts, products, companies, branches, activities, approvals, files, and reports.</p></div>
        ${renderContextSwitchers()}
      </section>
      <section class="erp-summary-grid" aria-label="ERP summary">
        <article><span>Available apps</span><strong>${allApps.length}</strong><small>${activeModules} with records</small></article>
        <article><span>Business records</span><strong>${totalRecords}</strong><small>Across connected modules</small></article>
        <article><span>Open approvals</span><strong>${openApprovals}</strong><small>Awaiting a decision</small></article>
        <article><span>Open tickets</span><strong>${openTickets}</strong><small>Customer service workload</small></article>
      </section>
      <section class="erp-launcher-controls">
        <label class="search-control erp-launcher-search">${icon('search', 18)}<span class="sr-only">Search business apps</span><input type="search" data-erp-launcher-search value="${escape(ui.erp.launcherQuery || '')}" placeholder="Search apps and capabilities"><kbd>Ctrl K</kbd></label>
        ${groupTabs(activeGroup)}
      </section>
      ${appSection('Favorites', 'Your pinned apps', favorites)}
      ${appSection('Recent', 'Recently opened', recent.filter((app, index, values) => values.indexOf(app) === index).slice(0, 8))}
      ${GROUPS.map(group => appSection(group.label, group.description, filtered.filter(app => app.group === group.key))).join('')}
      ${filtered.length ? '' : '<div class="erp-empty"><strong>No apps match.</strong><span>Try another search or clear the category filter.</span></div>'}
    </div>`;
  }

  function statusBadge(value) {
    const normalized = String(value || 'draft').toLowerCase();
    return `<span class="erp-status" data-status="${escape(normalized)}">${escape(title(normalized))}</span>`;
  }

  function moduleListFields(module) {
    const blocked = new Set(['notes', 'tags', 'address', 'content', 'body', 'description', 'fieldDefinitions', 'steps', 'goals', 'developmentPlan', 'transcript', 'shippingAddress', 'seoDescription', 'formulaNotes', 'widgets', 'filters', 'fieldDefinitions', 'personalizationFields']);
    const candidates = module.fields.filter(schema => !blocked.has(schema.name) && schema.type !== 'boolean');
    const titleSchema = module.fields.find(schema => schema.name === module.titleField);
    const result = titleSchema ? [titleSchema, ...candidates.filter(schema => schema.name !== titleSchema.name)] : candidates;
    return result.slice(0, 6);
  }

  function filterRecords(module) {
    const query = String(ui.erp.moduleQuery || '').trim().toLowerCase();
    const statusFilter = ui.erp.status || 'all';
    const company = state.erp.settings.activeCompanyId;
    const branch = state.erp.settings.activeBranchId;
    return collection(module)
      .filter(record => Boolean(record.archived) === Boolean(ui.erp.archived))
      .filter(record => !record.companyId || record.companyId === company)
      .filter(record => !record.branchId || record.branchId === branch)
      .filter(record => statusFilter === 'all' || statusFor(module, record) === statusFilter)
      .filter(record => {
        if (!query) return true;
        const text = module.fields.map(schema => fieldValue(module, record, schema)).join(' ').toLowerCase();
        return `${titleFor(module, record)} ${text}`.toLowerCase().includes(query);
      })
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  }

  function moduleSummary(module, records) {
    const metrics = moduleMetrics(module);
    return `<section class="erp-summary-grid" aria-label="${escape(module.label)} summary">
      <article><span>Total</span><strong>${metrics.total}</strong><small>${records.length} currently shown</small></article>
      <article><span>Active</span><strong>${metrics.active}</strong><small>${metrics.completed} completed</small></article>
      <article><span>Value</span><strong>${escape(currency(metrics.value))}</strong><small>Amounts available in records</small></article>
      <article><span>Overdue</span><strong>${metrics.overdue}</strong><small>Based on linked due dates</small></article>
    </section>`;
  }

  function moduleToolbar(module) {
    return `<section class="erp-module-toolbar">
      <div class="erp-module-filter-row">
        <label class="search-control">${icon('search', 18)}<span class="sr-only">Search ${escape(module.label)}</span><input type="search" data-erp-module-search value="${escape(ui.erp.moduleQuery || '')}" placeholder="Search ${escape(module.label.toLowerCase())}"><kbd>Ctrl K</kbd></label>
        <label class="erp-filter"><span>Status</span><select data-erp-status-filter><option value="all">All statuses</option>${(module.statuses || []).map(status => `<option value="${escape(status)}" ${ui.erp.status === status ? 'selected' : ''}>${escape(title(status))}</option>`).join('')}</select></label>
        <label class="erp-archive-toggle"><input type="checkbox" data-erp-show-archived ${ui.erp.archived ? 'checked' : ''}><span>Archived</span></label>
      </div>
      <div class="erp-module-actions">
        <div class="erp-view-switch" aria-label="View type"><button type="button" data-erp-module-view="list" class="${ui.erp.view === 'list' ? 'is-active' : ''}">${icon('list', 16)}List</button><button type="button" data-erp-module-view="board" class="${ui.erp.view === 'board' ? 'is-active' : ''}">${icon('grid', 16)}Board</button></div>
        ${canEdit() ? `<button class="button button-primary" type="button" data-erp-new-record="${escape(module.key)}">${icon('plus', 16)}New ${escape(module.singular.toLowerCase())}</button>` : ''}
      </div>
    </section>`;
  }

  function recordMenu(module, record) {
    return `<details class="menu erp-row-menu"><summary class="action-button" aria-label="Actions for ${escape(titleFor(module, record))}">${icon('more', 17)}</summary><div class="menu-popover">
      <button type="button" data-erp-open-record="${escape(record.id)}" data-erp-module="${escape(module.key)}">${icon('eye', 16)}Open</button>
      ${canEdit() ? `<button type="button" data-erp-edit-record="${escape(record.id)}" data-erp-module="${escape(module.key)}">${icon('edit', 16)}Edit</button><button type="button" data-erp-archive-record="${escape(record.id)}" data-erp-module="${escape(module.key)}">${icon('archive', 16)}${record.archived ? 'Restore' : 'Archive'}</button><button class="danger" type="button" data-erp-delete-record="${escape(record.id)}" data-erp-module="${escape(module.key)}">${icon('trash', 16)}Delete</button>` : ''}
    </div></details>`;
  }

  function renderModuleTable(module, records) {
    const fields = moduleListFields(module);
    if (!records.length) return '<div class="erp-empty"><strong>No records found.</strong><span>Create a record or change the active filters.</span></div>';
    return `<div class="erp-table-wrap"><table class="erp-table"><thead><tr>${fields.map(schema => `<th>${escape(schema.label)}</th>`).join('')}<th>Status</th><th>Updated</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${records.map(record => `<tr><td><button class="erp-record-link" type="button" data-erp-open-record="${escape(record.id)}" data-erp-module="${escape(module.key)}"><strong>${escape(fieldValue(module, record, fields[0]))}</strong><small>${escape(record.companyId ? ERP.companyName(record.companyId) : '')}</small></button></td>${fields.slice(1).map(schema => `<td>${escape(fieldValue(module, record, schema))}</td>`).join('')}<td>${statusBadge(statusFor(module, record))}</td><td>${escape(formatTimestamp(record.updatedAt || record.createdAt))}</td><td>${recordMenu(module, record)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderModuleBoard(module, records) {
    const statuses = module.statuses?.length ? module.statuses : ['draft'];
    return `<div class="erp-board">${statuses.map(status => {
      const items = records.filter(record => statusFor(module, record) === status);
      return `<section class="erp-board-column" data-erp-drop-status="${escape(status)}" data-erp-module="${escape(module.key)}"><header><span>${statusBadge(status)}</span><strong>${items.length}</strong></header><div>${items.length ? items.map(record => `<button class="erp-board-card" type="button" draggable="${canEdit() ? 'true' : 'false'}" data-erp-drag-record="${escape(record.id)}" data-erp-module="${escape(module.key)}" data-erp-open-record="${escape(record.id)}"><strong>${escape(titleFor(module, record))}</strong><span>${escape(moduleListFields(module).slice(1, 3).map(schema => fieldValue(module, record, schema)).filter(value => value !== '—').join(' · ') || module.singular)}</span><footer><small>${escape(ERP.companyName(record.companyId))}</small><small>${escape(formatTimestamp(record.updatedAt || record.createdAt))}</small></footer></button>`).join('') : '<p>No records</p>'}</div></section>`;
    }).join('')}</div>`;
  }

  function renderModulePage(module) {
    ensureERPState();
    rememberApp(module.key);
    const recordTarget = recordFromLocation(module);
    if (recordTarget) return renderRecordPage(module, recordTarget);
    const records = filterRecords(module);
    return `<div class="content-shell page-stack erp-module-page" data-erp-module-page="${escape(module.key)}">
      <section class="erp-module-intro"><div><p class="panel-kicker">${escape(GROUPS.find(group => group.key === module.group)?.label || 'Business app')}</p><h2>${escape(module.label)}</h2><p>${escape(module.description)}</p></div>${renderContextSwitchers(true)}</section>
      ${moduleSummary(module, records)}
      ${moduleToolbar(module)}
      <section class="erp-module-surface">${ui.erp.view === 'board' ? renderModuleBoard(module, records) : renderModuleTable(module, records)}</section>
    </div>`;
  }

  function recordFromLocation(module) {
    ensureERPState();
    const params = new URLSearchParams(location.search);
    const moduleKey = params.get('erp');
    const recordId = params.get('record');
    const uiTarget = ui.erp.record;
    const targetId = moduleKey === module.key && recordId ? recordId : uiTarget?.moduleKey === module.key ? uiTarget.id : '';
    return targetId ? collection(module).find(record => record.id === targetId) || null : null;
  }

  function recordDefinition(module, record) {
    return `<dl class="erp-definition-list">${module.fields.map(schema => `<div><dt>${escape(schema.label)}</dt><dd>${escape(fieldValue(module, record, schema))}</dd></div>`).join('')}</dl>`;
  }

  function auditTimeline(record) {
    const items = [
      ...arr(record.audit).map(item => ({ type: 'audit', title: item.action, copy: item.detail, at: item.at, author: item.userName })),
      ...arr(record.comments).map(item => ({ type: 'comment', title: 'Comment', copy: item.body, at: item.createdAt, author: item.author })),
      ...arr(record.activities).map(item => ({ type: 'activity', title: item.summary, copy: `${item.type || 'activity'} · ${item.status || 'planned'}`, at: item.dueDate || item.createdAt, author: item.ownerName }))
    ].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    if (!items.length) return '<div class="erp-empty is-compact"><strong>No activity yet.</strong><span>Changes, comments, and planned activities appear here.</span></div>';
    return `<div class="erp-timeline">${items.map(item => `<article><span class="erp-timeline-dot"></span><div><header><strong>${escape(item.title)}</strong><time>${escape(formatTimestamp(item.at))}</time></header><p>${escape(item.copy || '')}</p><small>${escape(item.author || 'Workspace member')}</small></div></article>`).join('')}</div>`;
  }

  function workflowButtons(module, record) {
    const actions = window.FormcraftERPWorkflows?.actionsFor?.(module.key, record) || [];
    return actions.map(action => `<button class="button ${action.primary ? 'button-primary' : 'button-secondary'} button-small" type="button" data-erp-workflow="${escape(action.key)}" data-erp-module="${escape(module.key)}" data-erp-record="${escape(record.id)}">${icon(action.icon || 'arrowRight', 15)}${escape(action.label)}</button>`).join('');
  }

  function relatedPanel(module, record) {
    const links = window.FormcraftERPWorkflows?.relatedFor?.(module.key, record) || [];
    if (!links.length) return '<div class="erp-empty is-compact"><strong>No related records.</strong><span>Connected workflow records will appear here.</span></div>';
    return `<div class="erp-related-list">${links.map(link => `<button type="button" data-erp-open-related-module="${escape(link.moduleKey)}" data-erp-open-related-id="${escape(link.id)}"><span>${icon(appByKey(link.moduleKey)?.icon || 'arrowRight', 17)}<strong>${escape(link.label)}</strong></span><small>${escape(link.meta || '')}</small></button>`).join('')}</div>`;
  }

  function renderRecordPage(module, record) {
    ui.erp.record = { moduleKey: module.key, id: record.id };
    const tab = ui.erp.tab || 'overview';
    return `<article class="erp-record-page" data-erp-record-page="${escape(module.key)}">
      <header class="erp-record-header"><div class="erp-record-heading"><p class="workspace-breadcrumb"><button type="button" data-erp-back-module="${escape(module.key)}">${escape(module.label)}</button><span>/</span>${escape(record.id.slice(0, 8))}</p><div><span class="erp-record-icon">${icon(module.icon, 18)}</span><h1 data-route-heading>${escape(titleFor(module, record))}</h1>${statusBadge(statusFor(module, record))}</div><p>${escape(module.description)}</p></div><div class="erp-record-actions"><button class="button button-secondary" type="button" data-erp-back-module="${escape(module.key)}">${icon('chevronLeft', 16)}Back</button>${canEdit() ? `<button class="button button-secondary" type="button" data-erp-edit-record="${escape(record.id)}" data-erp-module="${escape(module.key)}">${icon('edit', 16)}Edit</button>${workflowButtons(module, record)}<button class="button button-primary" type="button" data-erp-add-note="${escape(record.id)}" data-erp-module="${escape(module.key)}">${icon('plus', 16)}Add update</button>` : ''}</div></header>
      <div class="erp-record-body">
        <section class="erp-record-summary"><div><span>Status</span><strong>${escape(title(statusFor(module, record)))}</strong></div><div><span>Company</span><strong>${escape(ERP.companyName(record.companyId))}</strong></div><div><span>Branch</span><strong>${escape(ERP.branchName(record.branchId))}</strong></div><div><span>Owner</span><strong>${escape(ERP.memberName(record.ownerId || record.assignedTo || record.responsibleId || record.technicianId))}</strong></div><div><span>Updated</span><strong>${escape(formatTimestamp(record.updatedAt || record.createdAt))}</strong></div></section>
        <nav class="erp-record-tabs">${[['overview', 'Overview'], ['activity', 'Activity'], ['related', 'Related records']].map(([value, label]) => `<button type="button" data-erp-record-tab="${value}" class="${tab === value ? 'is-active' : ''}">${label}</button>`).join('')}</nav>
        <div class="erp-record-content">${tab === 'overview' ? `<div class="erp-record-grid"><main><section class="erp-card"><div class="erp-card-head"><div><p class="panel-kicker">Record details</p><h2>${escape(module.singular)}</h2></div></div>${recordDefinition(module, record)}</section></main><aside><section class="erp-card"><div class="erp-card-head"><div><p class="panel-kicker">Next actions</p><h2>Workflow</h2></div></div><div class="erp-workflow-panel">${workflowButtons(module, record) || '<p>No workflow action is currently available.</p>'}</div></section><section class="erp-card"><div class="erp-card-head"><div><p class="panel-kicker">Activity</p><h2>Plan work</h2></div></div><div class="erp-side-actions">${canEdit() ? `<button class="button button-secondary button-small" type="button" data-erp-add-note="${escape(record.id)}" data-erp-module="${escape(module.key)}">Add comment</button><button class="button button-secondary button-small" type="button" data-erp-schedule-activity="${escape(record.id)}" data-erp-module="${escape(module.key)}">Schedule activity</button>` : '<p>Read-only access.</p>'}</div></section></aside></div>` : tab === 'activity' ? `<section class="erp-card"><div class="erp-card-head"><div><p class="panel-kicker">History</p><h2>Activity and audit trail</h2></div>${canEdit() ? `<div><button class="button button-secondary button-small" type="button" data-erp-add-note="${escape(record.id)}" data-erp-module="${escape(module.key)}">Comment</button><button class="button button-secondary button-small" type="button" data-erp-schedule-activity="${escape(record.id)}" data-erp-module="${escape(module.key)}">Schedule</button></div>` : ''}</div>${auditTimeline(record)}</section>` : `<section class="erp-card"><div class="erp-card-head"><div><p class="panel-kicker">Traceability</p><h2>Connected records</h2></div></div>${relatedPanel(module, record)}</section>`}</div>
      </div>
    </article>`;
  }

  function schemaControl(module, schema, value, record = null) {
    const id = `erp-${module.key}-${schema.name}`;
    const required = schema.required ? 'required' : '';
    const hint = schema.hint ? `<small>${escape(schema.hint)}</small>` : '';
    const common = `id="${id}" name="${escape(schema.name)}" ${required}`;
    if (schema.type === 'textarea') return `<label class="erp-field ${schema.span === 2 ? 'span-2' : ''}" for="${id}"><span>${escape(schema.label)}${schema.required ? ' *' : ''}</span><textarea ${common} rows="5" placeholder="${escape(schema.placeholder || '')}">${escape(value || '')}</textarea>${hint}<em data-erp-error-for="${escape(schema.name)}"></em></label>`;
    if (schema.type === 'select') return `<label class="erp-field" for="${id}"><span>${escape(schema.label)}${schema.required ? ' *' : ''}</span><select ${common}>${arr(schema.options).map(([optionValue, label]) => `<option value="${escape(optionValue)}" ${String(value) === String(optionValue) ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select>${hint}<em data-erp-error-for="${escape(schema.name)}"></em></label>`;
    if (schema.type === 'relation') return `<label class="erp-field" for="${id}"><span>${escape(schema.label)}${schema.required ? ' *' : ''}</span><select ${common}><option value="">Select</option>${relationOptions(schema.relation).map(([optionValue, label]) => `<option value="${escape(optionValue)}" ${String(value) === String(optionValue) ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select>${hint}<em data-erp-error-for="${escape(schema.name)}"></em></label>`;
    if (schema.type === 'member') return `<label class="erp-field" for="${id}"><span>${escape(schema.label)}</span><select ${common}><option value="">Unassigned</option>${arr(state.team).filter(member => !member.pending).map(member => `<option value="${escape(member.id || member.userId)}" ${String(value) === String(member.id || member.userId) ? 'selected' : ''}>${escape(member.name)}</option>`).join('')}</select>${hint}</label>`;
    if (schema.type === 'company') return `<label class="erp-field" for="${id}"><span>${escape(schema.label)}</span><select ${common}>${state.erp.settings.companies.map(company => `<option value="${escape(company.id)}" ${String(value || state.erp.settings.activeCompanyId) === String(company.id) ? 'selected' : ''}>${escape(company.name)}</option>`).join('')}</select>${hint}</label>`;
    if (schema.type === 'branch') return `<label class="erp-field" for="${id}"><span>${escape(schema.label)}</span><select ${common}>${state.erp.settings.branches.map(branch => `<option value="${escape(branch.id)}" ${String(value || state.erp.settings.activeBranchId) === String(branch.id) ? 'selected' : ''}>${escape(branch.name)}</option>`).join('')}</select>${hint}</label>`;
    if (schema.type === 'project') return `<label class="erp-field" for="${id}"><span>${escape(schema.label)}</span><select ${common}><option value="">No project</option>${arr(state.projects).map(project => `<option value="${escape(project.id)}" ${String(value) === String(project.id) ? 'selected' : ''}>${escape(project.name)}</option>`).join('')}</select>${hint}</label>`;
    if (schema.type === 'module') return `<label class="erp-field" for="${id}"><span>${escape(schema.label)}</span><select ${common}><option value="">Select app</option>${moduleOptions().map(([optionValue, label]) => `<option value="${escape(optionValue)}" ${String(value) === String(optionValue) ? 'selected' : ''}>${escape(label)}</option>`).join('')}</select>${hint}</label>`;
    if (schema.type === 'boolean') return `<label class="erp-switch-field ${schema.span === 2 ? 'span-2' : ''}"><span><strong>${escape(schema.label)}</strong>${hint}</span><span class="switch"><input type="checkbox" name="${escape(schema.name)}" ${value ? 'checked' : ''}><span class="switch-track"></span></span></label>`;
    const inputType = schema.type === 'money' ? 'number' : schema.type === 'tags' ? 'text' : schema.type || 'text';
    const step = schema.type === 'money' ? '.01' : schema.step !== undefined ? schema.step : schema.type === 'number' ? '1' : '';
    const min = schema.min !== undefined ? `min="${schema.min}"` : '';
    const max = schema.max !== undefined ? `max="${schema.max}"` : '';
    const displayValue = schema.type === 'tags' ? arr(value).join(', ') : value ?? schema.default ?? '';
    return `<label class="erp-field ${schema.span === 2 ? 'span-2' : ''}" for="${id}"><span>${escape(schema.label)}${schema.required ? ' *' : ''}</span><input ${common} type="${escape(inputType)}" value="${escape(displayValue)}" ${step ? `step="${step}"` : ''} ${min} ${max} placeholder="${escape(schema.placeholder || '')}">${hint}<em data-erp-error-for="${escape(schema.name)}"></em></label>`;
  }

  function openRecordForm(module, record = null) {
    ensureERPState();
    if (!canEdit()) return toast('You have read-only access to this workspace.', 'warning');
    const existing = Boolean(record?.id && collection(module).some(item => item.id === record.id));
    const data = existing ? record : makeRecord(module, {
      companyId: state.erp.settings.activeCompanyId,
      branchId: state.erp.settings.activeBranchId,
      ownerId: window.FormcraftBackend?.session?.user?.id || ''
    });
    openModal(`<form class="modal-card form-modal erp-record-form" data-erp-form data-erp-module="${escape(module.key)}" novalidate>
      <div class="modal-head"><div><p class="modal-eyebrow">${escape(GROUPS.find(group => group.key === module.group)?.label || 'Business app')}</p><h2 id="modal-title">${existing ? `Edit ${escape(module.singular.toLowerCase())}` : `Create ${escape(module.singular.toLowerCase())}`}</h2><p>${escape(module.description)}</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div>
      <div class="modal-body"><div class="erp-form-sections"><fieldset><legend>Record details</legend><p>Required fields are marked with an asterisk. Data remains connected to the active company and branch.</p><div class="erp-form-grid">${module.fields.map(schema => schemaControl(module, schema, data[schema.name], data)).join('')}</div></fieldset><p class="field-error" data-erp-form-error aria-live="polite"></p></div></div>
      <div class="modal-actions"><div class="modal-actions-leading">${existing ? `<span>Created ${escape(formatTimestamp(record.createdAt))}</span>` : `<span>${escape(ERP.companyName(data.companyId))} · ${escape(ERP.branchName(data.branchId))}</span>`}</div><div class="modal-actions-trailing"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">${existing ? 'Save changes' : `Create ${escape(module.singular.toLowerCase())}`}</button></div></div>
    </form>`);
    modal.dataset.surface = 'form';
    const form = modal.querySelector('[data-erp-form]');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const error = form.querySelector('[data-erp-form-error]');
      if (error) error.textContent = '';
      const values = {};
      let firstInvalid = null;
      module.fields.forEach(schema => {
        const control = form.elements[schema.name];
        if (!control) return;
        control.removeAttribute('aria-invalid');
        let value;
        if (schema.type === 'boolean') value = Boolean(control.checked);
        else if (['number', 'money'].includes(schema.type)) value = num(control.value);
        else if (schema.type === 'tags') value = String(control.value || '').split(',').map(item => item.trim()).filter(Boolean);
        else value = String(control.value || '').trim();
        values[schema.name] = value;
        if (schema.required && (value === '' || value === null || value === undefined)) {
          control.setAttribute('aria-invalid', 'true');
          firstInvalid ||= control;
        }
      });
      if (firstInvalid) {
        if (error) error.textContent = 'Complete the required fields.';
        firstInvalid.focus();
        return;
      }
      const saved = existing ? record : makeRecord(module, values);
      Object.assign(saved, values, { updatedAt: now() });
      if (!existing) collection(module).unshift(saved);
      recordAudit(module, saved, existing ? 'Updated' : 'Created');
      try {
        await Promise.resolve(saveState());
        closeModal();
        openERPRecord(module.key, saved.id, { replace: true });
        toast(existing ? `${module.singular} updated.` : `${module.singular} created.`);
      } catch (saveError) {
        if (!existing) {
          const records = collection(module);
          const index = records.findIndex(item => item.id === saved.id);
          if (index >= 0) records.splice(index, 1);
        }
        if (error) error.textContent = saveError?.message || 'The record could not be saved.';
      }
    }, true);
  }

  function openQuickNote(module, record) {
    if (!canEdit()) return toast('You have read-only access to this workspace.', 'warning');
    openModal(`<form class="modal-card erp-quick-form" data-erp-note-form novalidate><div class="modal-head"><div><p class="modal-eyebrow">${escape(titleFor(module, record))}</p><h2 id="modal-title">Add update</h2><p>Record a decision, note, handoff, or customer update.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div><div class="modal-body"><label class="erp-field"><span>Update *</span><textarea name="body" rows="5" required maxlength="3000" placeholder="Write a clear update."></textarea><em data-erp-note-error></em></label></div><div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Add update</button></div></form>`);
    modal.dataset.surface = 'form';
    const form = modal.querySelector('[data-erp-note-form]');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const body = String(form.elements.body.value || '').trim();
      if (!body) {
        form.querySelector('[data-erp-note-error]').textContent = 'Enter an update.';
        form.elements.body.focus();
        return;
      }
      record.comments = arr(record.comments);
      record.comments.unshift({ id: uid(), body, author: typeof currentUserName === 'function' ? currentUserName() : 'Workspace member', userId: window.FormcraftBackend?.session?.user?.id || '', createdAt: now() });
      recordAudit(module, record, 'Commented', body.slice(0, 120));
      await Promise.resolve(saveState());
      closeModal();
      renderShell();
      toast('Update added.');
    });
  }

  function openActivityForm(module, record) {
    if (!canEdit()) return toast('You have read-only access to this workspace.', 'warning');
    openModal(`<form class="modal-card erp-quick-form" data-erp-activity-form novalidate><div class="modal-head"><div><p class="modal-eyebrow">${escape(titleFor(module, record))}</p><h2 id="modal-title">Schedule activity</h2><p>Plan the next call, meeting, email, task, or follow-up.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div><div class="modal-body"><div class="erp-form-grid">${schemaControl(module, { name: 'summary', label: 'Summary', type: 'text', required: true, span: 2 }, '')}${schemaControl(module, { name: 'type', label: 'Activity type', type: 'select', options: [['call', 'Call'], ['meeting', 'Meeting'], ['email', 'Email'], ['task', 'Task'], ['follow-up', 'Follow-up']] }, 'follow-up')}${schemaControl(module, { name: 'dueDate', label: 'Due date', type: 'date', required: true }, dateKey(addDays(1)))}${schemaControl(module, { name: 'ownerId', label: 'Owner', type: 'member' }, window.FormcraftBackend?.session?.user?.id || '')}</div><p class="field-error" data-erp-activity-error></p></div><div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Schedule</button></div></form>`);
    modal.dataset.surface = 'form';
    const form = modal.querySelector('[data-erp-activity-form]');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const summary = String(form.elements.summary.value || '').trim();
      const dueDate = String(form.elements.dueDate.value || '').trim();
      if (!summary || !dueDate) {
        form.querySelector('[data-erp-activity-error]').textContent = 'Add a summary and due date.';
        return;
      }
      const activity = { id: uid(), summary, type: form.elements.type.value, dueDate, ownerId: form.elements.ownerId.value, ownerName: ERP.memberName(form.elements.ownerId.value), status: 'planned', createdAt: now() };
      record.activities = arr(record.activities);
      record.activities.unshift(activity);
      collection('activities').unshift(makeRecord(ERP.modulesByKey.get('activities'), { summary, activityType: activity.type, dueDate, ownerId: activity.ownerId, status: 'planned', relatedModule: module.key, relatedRecordId: record.id }));
      recordAudit(module, record, 'Activity scheduled', `${summary} · ${dueDate}`);
      await Promise.resolve(saveState());
      closeModal();
      renderShell();
      toast('Activity scheduled.');
    });
  }

  function openERPRecord(moduleKey, id, options = {}) {
    const module = ERP.modulesByKey.get(moduleKey);
    if (!module || !collection(module).some(record => record.id === id)) return;
    ensureERPState();
    ui.route = `erp-${module.key}`;
    ui.erp.record = { moduleKey, id };
    ui.erp.tab = options.tab || 'overview';
    rememberApp(moduleKey);
    const url = new URL(location.href);
    url.hash = `erp-${module.key}`;
    url.searchParams.set('erp', moduleKey);
    url.searchParams.set('record', id);
    options.replace ? history.replaceState(null, '', url) : history.pushState(null, '', url);
    renderShell();
  }

  function closeERPRecord(moduleKey, options = {}) {
    ensureERPState();
    const url = new URL(location.href);
    url.searchParams.delete('erp');
    url.searchParams.delete('record');
    url.hash = `erp-${moduleKey}`;
    ui.route = `erp-${moduleKey}`;
    ui.erp.record = null;
    ui.erp.tab = 'overview';
    options.replace ? history.replaceState(null, '', url) : history.pushState(null, '', url);
    renderShell();
  }

  function goToApp(app) {
    if (!app) return;
    ensureERPState();
    rememberApp(app.key);
    ui.erp.record = null;
    ui.erp.moduleQuery = '';
    ui.erp.status = 'all';
    const url = new URL(location.href);
    url.searchParams.delete('erp');
    url.searchParams.delete('record');
    history.replaceState(null, '', `${url.pathname}${url.search}#${appRoute(app)}`);
    navigate(appRoute(app), true);
  }

  function renderAppsNavLink() {
    const count = allApps.length;
    return `<a href="#apps" data-route="apps" data-erp-apps-nav class="workspace-nav-link ${ui.route === 'apps' || ui.route.startsWith('erp-') ? 'is-active' : ''}" ${ui.route === 'apps' || ui.route.startsWith('erp-') ? 'aria-current="page"' : ''}><span class="workspace-nav-icon">${icon('grid', 18)}</span><span>Apps</span><span class="workspace-nav-count">${count}</span></a>`;
  }

  function injectAppsNavigation() {
    const desktop = document.querySelector('.workspace-sidebar .workspace-nav');
    const drawer = document.querySelector('.mobile-drawer .drawer-nav');
    [desktop, drawer].filter(Boolean).forEach(nav => {
      if (nav.querySelector('[data-erp-apps-nav]')) return;
      const template = document.createElement('template');
      template.innerHTML = renderAppsNavLink().trim();
      const link = template.content.firstElementChild;
      const first = nav.querySelector('[data-route="dashboard"]');
      first?.after(link) || nav.prepend(link);
    });

    const account = document.querySelector('[data-account-popover] .utility-popover-list');
    if (account && !account.querySelector('[data-erp-open-launcher]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.erpOpenLauncher = '';
      button.innerHTML = `${icon('grid', 17)}Business apps`;
      account.prepend(button);
    }
  }

  function openERPCommandMenu() {
    ensureERPState();
    const recent = state.erp.settings.recentApps.map(appByKey).filter(Boolean).slice(0, 8);
    const defaults = recent.length ? recent : allApps.slice(0, 8);
    openModal(`<div class="modal-card erp-command-menu"><div class="modal-head"><div><p class="modal-eyebrow">Connected ERP</p><h2 id="modal-title">Open an app or create a record</h2><p>Search the full suite without memorizing where humans decided to hide each module.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div><div class="modal-body"><label class="search-control erp-command-search">${icon('search', 18)}<span class="sr-only">Search apps</span><input type="search" data-erp-command-search placeholder="Search apps"><kbd>Esc</kbd></label><div class="erp-command-grid" data-erp-command-results>${defaults.map(app => `<button type="button" data-erp-open-app="${escape(app.key)}">${icon(app.icon || 'grid', 20)}<span><strong>${escape(app.label)}</strong><small>${escape(app.description)}</small></span></button>`).join('')}</div></div><div class="modal-actions"><button class="button button-secondary" type="button" data-erp-open-launcher>View all apps</button></div></div>`);
  }

  function refreshCommandResults(query) {
    const target = modal.querySelector('[data-erp-command-results]');
    if (!target) return;
    const normalized = String(query || '').trim().toLowerCase();
    const matches = allApps.filter(app => !normalized || `${app.label} ${app.description}`.toLowerCase().includes(normalized)).slice(0, 16);
    target.innerHTML = matches.length ? matches.map(app => `<button type="button" data-erp-open-app="${escape(app.key)}">${icon(app.icon || 'grid', 20)}<span><strong>${escape(app.label)}</strong><small>${escape(app.description)}</small></span></button>`).join('') : '<div class="erp-empty is-compact"><strong>No apps found.</strong><span>Try a broader search.</span></div>';
  }

  renderPage = function renderERPPage() {
    ensureERPState();
    if (ui.route === 'apps') return renderAppLauncher();
    const module = moduleByRoute(ui.route);
    if (module) return renderModulePage(module);
    return previous.renderPage();
  };

  contextCreateLabel = function contextERPCreateLabel() {
    if (ui.route === 'apps') return 'Create';
    const module = moduleByRoute(ui.route);
    return module ? `New ${module.singular}` : previous.contextCreateLabel();
  };

  handleContextCreate = function handleERPContextCreate() {
    const module = moduleByRoute(ui.route);
    if (module) return openRecordForm(module);
    if (ui.route === 'apps') return openERPCommandMenu();
    return previous.handleContextCreate();
  };

  openCommandMenu = openERPCommandMenu;

  bindPage = function bindERPPage() {
    previous.bindPage();
  };

  renderShell = function renderERPShell(...args) {
    ensureERPState();
    const result = previous.renderShell.apply(this, args);
    requestAnimationFrame(injectAppsNavigation);
    return result;
  };

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const appsNav = target.closest('[data-erp-apps-nav], [data-erp-open-launcher]');
    if (appsNav) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeModal();
      goToApp({ key: 'apps', nativeRoute: 'apps' });
      return;
    }

    const openApp = target.closest('[data-erp-open-app]');
    if (openApp) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const app = appByKey(openApp.dataset.erpOpenApp);
      closeModal();
      goToApp(app);
      return;
    }

    const favorite = target.closest('[data-erp-favorite-app]');
    if (favorite) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleFavorite(favorite.dataset.erpFavoriteApp);
      Promise.resolve(saveState()).catch(() => {});
      renderShell();
      return;
    }

    const group = target.closest('[data-erp-launcher-group]');
    if (group) {
      ui.erp.launcherGroup = group.dataset.erpLauncherGroup;
      renderShell();
      return;
    }

    const newRecord = target.closest('[data-erp-new-record]');
    if (newRecord) {
      event.preventDefault();
      openRecordForm(ERP.modulesByKey.get(newRecord.dataset.erpNewRecord));
      return;
    }

    const openRecord = target.closest('[data-erp-open-record]');
    if (openRecord) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openERPRecord(openRecord.dataset.erpModule, openRecord.dataset.erpOpenRecord);
      return;
    }

    const editRecord = target.closest('[data-erp-edit-record]');
    if (editRecord) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const module = ERP.modulesByKey.get(editRecord.dataset.erpModule);
      const record = collection(module).find(item => item.id === editRecord.dataset.erpEditRecord);
      if (record) openRecordForm(module, record);
      return;
    }

    const back = target.closest('[data-erp-back-module]');
    if (back) {
      event.preventDefault();
      closeERPRecord(back.dataset.erpBackModule);
      return;
    }

    const tab = target.closest('[data-erp-record-tab]');
    if (tab) {
      ui.erp.tab = tab.dataset.erpRecordTab;
      renderShell();
      return;
    }

    const note = target.closest('[data-erp-add-note]');
    if (note) {
      const module = ERP.modulesByKey.get(note.dataset.erpModule);
      const record = collection(module).find(item => item.id === note.dataset.erpAddNote);
      if (record) openQuickNote(module, record);
      return;
    }

    const activity = target.closest('[data-erp-schedule-activity]');
    if (activity) {
      const module = ERP.modulesByKey.get(activity.dataset.erpModule);
      const record = collection(module).find(item => item.id === activity.dataset.erpScheduleActivity);
      if (record) openActivityForm(module, record);
      return;
    }

    const archive = target.closest('[data-erp-archive-record]');
    if (archive) {
      const module = ERP.modulesByKey.get(archive.dataset.erpModule);
      const record = collection(module).find(item => item.id === archive.dataset.erpArchiveRecord);
      if (!record || !canEdit()) return;
      record.archived = !record.archived;
      recordAudit(module, record, record.archived ? 'Archived' : 'Restored');
      Promise.resolve(saveState()).then(renderShell).catch(error => toast(error.message || 'Record could not be updated.', 'error'));
      return;
    }

    const remove = target.closest('[data-erp-delete-record]');
    if (remove) {
      const module = ERP.modulesByKey.get(remove.dataset.erpModule);
      const record = collection(module).find(item => item.id === remove.dataset.erpDeleteRecord);
      if (!record || !canEdit()) return;
      closeModal();
      confirmAction(`Delete ${module.singular.toLowerCase()}?`, `Delete ${titleFor(module, record)}? This action removes the workspace record.`, async () => {
        const records = collection(module);
        const index = records.findIndex(item => item.id === record.id);
        if (index >= 0) records.splice(index, 1);
        await Promise.resolve(saveState());
        closeModal();
        closeERPRecord(module.key, { replace: true });
        toast(`${module.singular} deleted.`, 'warning');
      });
      return;
    }

    const related = target.closest('[data-erp-open-related-module]');
    if (related) {
      openERPRecord(related.dataset.erpOpenRelatedModule, related.dataset.erpOpenRelatedId);
      return;
    }

    const workflow = target.closest('[data-erp-workflow]');
    if (workflow) {
      window.FormcraftERPWorkflows?.run?.(workflow.dataset.erpWorkflow, workflow.dataset.erpModule, workflow.dataset.erpRecord);
      return;
    }
  }, true);

  document.addEventListener('input', event => {
    if (event.target.matches('[data-erp-launcher-search]')) {
      ui.erp.launcherQuery = event.target.value;
      renderShell();
      requestAnimationFrame(() => {
        const input = document.querySelector('[data-erp-launcher-search]');
        input?.focus();
        input?.setSelectionRange(ui.erp.launcherQuery.length, ui.erp.launcherQuery.length);
      });
      return;
    }
    if (event.target.matches('[data-erp-module-search]')) {
      ui.erp.moduleQuery = event.target.value;
      renderShell();
      requestAnimationFrame(() => {
        const input = document.querySelector('[data-erp-module-search]');
        input?.focus();
        input?.setSelectionRange(ui.erp.moduleQuery.length, ui.erp.moduleQuery.length);
      });
      return;
    }
    if (event.target.matches('[data-erp-command-search]')) refreshCommandResults(event.target.value);
  });

  document.addEventListener('change', event => {
    if (event.target.matches('[data-erp-company]')) {
      state.erp.settings.activeCompanyId = event.target.value;
      const branches = state.erp.settings.branches.filter(branch => branch.companyId === event.target.value);
      state.erp.settings.activeBranchId = branches[0]?.id || '';
      Promise.resolve(saveState()).catch(() => {});
      renderShell();
      return;
    }
    if (event.target.matches('[data-erp-branch]')) {
      state.erp.settings.activeBranchId = event.target.value;
      Promise.resolve(saveState()).catch(() => {});
      renderShell();
      return;
    }
    if (event.target.matches('[data-erp-status-filter]')) {
      ui.erp.status = event.target.value;
      renderShell();
      return;
    }
    if (event.target.matches('[data-erp-show-archived]')) {
      ui.erp.archived = event.target.checked;
      renderShell();
      return;
    }
    const view = event.target.closest('[data-erp-module-view]');
    if (view) {
      ui.erp.view = view.dataset.erpModuleView;
      renderShell();
    }
  });

  document.addEventListener('click', event => {
    const view = event.target instanceof Element ? event.target.closest('[data-erp-module-view]') : null;
    if (!view) return;
    ui.erp.view = view.dataset.erpModuleView;
    renderShell();
  });

  let dragged = null;
  document.addEventListener('dragstart', event => {
    const card = event.target instanceof Element ? event.target.closest('[data-erp-drag-record]') : null;
    if (!card || !canEdit()) return;
    dragged = { id: card.dataset.erpDragRecord, moduleKey: card.dataset.erpModule };
    card.classList.add('is-dragging');
    event.dataTransfer?.setData('text/plain', JSON.stringify(dragged));
  });
  document.addEventListener('dragend', event => {
    event.target instanceof Element && event.target.closest('[data-erp-drag-record]')?.classList.remove('is-dragging');
    document.querySelectorAll('.erp-board-column.is-drop-target').forEach(column => column.classList.remove('is-drop-target'));
    dragged = null;
  });
  document.addEventListener('dragover', event => {
    const column = event.target instanceof Element ? event.target.closest('[data-erp-drop-status]') : null;
    if (!column || !dragged || column.dataset.erpModule !== dragged.moduleKey) return;
    event.preventDefault();
    document.querySelectorAll('.erp-board-column.is-drop-target').forEach(item => item.classList.toggle('is-drop-target', item === column));
  });
  document.addEventListener('drop', event => {
    const column = event.target instanceof Element ? event.target.closest('[data-erp-drop-status]') : null;
    if (!column || !dragged || column.dataset.erpModule !== dragged.moduleKey || !canEdit()) return;
    event.preventDefault();
    const module = ERP.modulesByKey.get(dragged.moduleKey);
    const record = collection(module).find(item => item.id === dragged.id);
    if (!record) return;
    record[module.statusField || 'status'] = column.dataset.erpDropStatus;
    recordAudit(module, record, 'Status changed', title(column.dataset.erpDropStatus));
    Promise.resolve(saveState()).catch(() => {});
    renderShell();
  });

  window.addEventListener('popstate', () => {
    ensureERPState();
    const route = location.hash.slice(1);
    if (routes[route]) ui.route = route;
    const params = new URLSearchParams(location.search);
    const moduleKey = params.get('erp');
    const recordId = params.get('record');
    ui.erp.record = moduleKey && recordId ? { moduleKey, id: recordId } : null;
    renderShell();
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !modal.open) {
      event.preventDefault();
      openERPCommandMenu();
    }
  }, true);

  ensureERPState();
  window.FormcraftERPUI = Object.freeze({
    renderAppLauncher,
    renderModulePage,
    renderRecordPage,
    openRecordForm,
    openERPRecord,
    closeERPRecord,
    goToApp,
    openERPCommandMenu
  });
})();
