'use strict';

(() => {
  const startOfDay = value => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  };
  const endOfDay = value => {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  };
  const timestampDaysAgo = (days, hour = 10) => {
    const date = addDays(-days, today());
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  const inTimestampRange = (value, start, end) => {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.valueOf()) && date >= start && date <= end;
  };
  const dueDateInRange = (value, start, end) => {
    if (!value) return false;
    const date = new Date(`${value}T12:00:00`);
    return date >= start && date <= end;
  };

  function migrateTaskHistory() {
    const demoHistory = {
      'Define dashboard information architecture': { created: 8, completed: 2 },
      'Build project CRUD interactions': { created: 6 },
      'Review responsive navigation': { created: 4 },
      'Prepare stakeholder design review': { created: 18 },
      'Document mobile interaction states': { created: 42 }
    };
    let changed = false;
    state.tasks.forEach(task => {
      const demo = demoHistory[task.title];
      if (!Object.prototype.hasOwnProperty.call(task, 'createdAt')) {
        task.createdAt = demo ? timestampDaysAgo(demo.created) : null;
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(task, 'completedAt')) {
        task.completedAt = task.status === 'done' && demo?.completed ? timestampDaysAgo(demo.completed, 15) : null;
        changed = true;
      }
    });
    if (changed) saveState();
  }

  migrateTaskHistory();

  activityChart = function activityChartWithHistory() {
    const days = Array.from({ length: 7 }, (_, index) => addDays(index - 6));
    const created = days.map(day => state.tasks.filter(task => task.createdAt && dateKey(new Date(task.createdAt)) === dateKey(day)).length);
    const completed = days.map(day => state.tasks.filter(task => task.completedAt && dateKey(new Date(task.completedAt)) === dateKey(day)).length);
    const max = Math.max(1, ...created, ...completed);
    const ticks = [max, Math.round(max * .67), Math.round(max * .33), 0];
    const createdTotal = created.reduce((sum, value) => sum + value, 0);
    const completedTotal = completed.reduce((sum, value) => sum + value, 0);
    return `<div class="chart-shell"><div class="chart-axis"><div class="chart-y-axis">${ticks.map(tick => `<span>${tick}</span>`).join('')}</div><div class="chart-plot">${days.map((day, index) => `<div class="chart-day"><div class="chart-bars"><span class="chart-bar secondary" style="height:${created[index] / max * 100}%" title="${created[index]} tasks created"></span><span class="chart-bar" style="height:${completed[index] / max * 100}%" title="${completed[index]} tasks completed"></span></div><span class="chart-day-label">${new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(day)}</span></div>`).join('')}</div></div><div class="chart-legend"><span><i class="legend-dot"></i>Completed</span><span><i class="legend-dot secondary"></i>Created</span></div><p class="chart-summary">${createdTotal} tasks were created and ${completedTotal} were completed during the last seven days. Only recorded task timestamps are included.</p><table class="sr-only"><caption>Recorded task activity for the last seven days</caption><thead><tr><th>Day</th><th>Tasks created</th><th>Tasks completed</th></tr></thead><tbody>${days.map((day, index) => `<tr><td>${new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(day)}</td><td>${created[index]}</td><td>${completed[index]}</td></tr>`).join('')}</tbody></table></div>`;
  };

  renderReports = function renderReportsByPeriod() {
    const periodDays = Number(ui.reportPeriod);
    const start = startOfDay(addDays(-(periodDays - 1), today()));
    const end = endOfDay(today());
    const periodTasks = state.tasks.filter(task => inTimestampRange(task.createdAt, start, end) || inTimestampRange(task.completedAt, start, end) || dueDateInRange(task.dueDate, start, end));
    const distribution = ['todo', 'progress', 'done'].map(status => ({ status, count: periodTasks.filter(task => task.status === status).length }));
    const total = periodTasks.length;
    const overdue = periodTasks.filter(task => task.status !== 'done' && task.dueDate < dateKey(today())).length;
    const created = periodTasks.filter(task => inTimestampRange(task.createdAt, start, end)).length;
    const completed = periodTasks.filter(task => inTimestampRange(task.completedAt, start, end)).length;
    const projectRows = state.projects.map(project => {
      const tasks = periodTasks.filter(task => task.projectId === project.id);
      return { project, tasks, progress: tasks.length ? Math.round(tasks.filter(task => task.status === 'done').length / tasks.length * 100) : 0 };
    }).filter(row => row.tasks.length);
    return `<div class="content-shell page-stack"><div class="toolbar"><div><p class="panel-kicker">Reporting period</p><h2 style="margin:4px 0 0">Last ${periodDays} days</h2><p class="panel-description">Includes tasks created, completed, or due during this period.</p></div><select class="select-control" data-report-period aria-label="Report period"><option value="7" ${ui.reportPeriod === '7' ? 'selected' : ''}>Last 7 days</option><option value="30" ${ui.reportPeriod === '30' ? 'selected' : ''}>Last 30 days</option><option value="90" ${ui.reportPeriod === '90' ? 'selected' : ''}>Last 90 days</option></select></div><div class="report-grid"><article class="panel"><div class="panel-head"><div><p class="panel-kicker">Delivery</p><h2>Task completion by project</h2><p class="panel-description">The amber marker represents an 80% target for tasks in this period.</p></div></div>${projectRows.length ? `<div class="report-bars">${projectRows.map(({ project, progress }) => `<div class="report-row"><strong>${escapeHtml(project.name)}</strong><div class="report-track"><span style="width:${progress}%"></span><i class="report-target" style="left:80%" aria-hidden="true"></i></div><span>${progress}%</span></div>`).join('')}</div>` : emptyState('reports', 'No project activity in this period', 'Choose a longer reporting period or add task history.')}</article><article class="panel"><div class="panel-head"><div><p class="panel-kicker">Distribution</p><h2>Current status of period tasks</h2><p class="panel-description">${total} tasks matched the selected reporting period.</p></div></div><div class="distribution-bar" aria-label="Task status distribution">${distribution.map(item => `<span style="width:${total ? item.count / total * 100 : 0}%;background:var(--${item.status === 'done' ? 'success' : item.status === 'progress' ? 'primary' : 'warning'})"></span>`).join('')}</div><div class="distribution-legend">${distribution.map(item => `<div class="distribution-row"><span><i class="legend-dot" style="background:var(--${item.status === 'done' ? 'success' : item.status === 'progress' ? 'primary' : 'warning'})"></i>${titleCase(item.status)}</span><strong>${item.count} · ${total ? Math.round(item.count / total * 100) : 0}%</strong></div>`).join('')}</div></article></div><section class="panel"><div class="panel-head"><div><p class="panel-kicker">Summary</p><h2>Period report</h2></div></div><div class="summary-grid"><div class="summary-card"><strong data-report-task-count>${total}</strong><span>Period tasks</span></div><div class="summary-card"><strong>${created}</strong><span>Tasks created</span></div><div class="summary-card"><strong>${completed}</strong><span>Tasks completed</span></div><div class="summary-card"><strong>${overdue}</strong><span>Overdue period tasks</span></div></div></section></div>`;
  };

  openTaskForm = function openTaskFormWithHistory(task = null) {
    if (!state.projects.length) { toast('Create a project before adding tasks.', 'warning'); return; }
    const data = task || { id: '', title: '', projectId: state.projects[0].id, priority: 'medium', status: 'todo', dueDate: dateKey(addDays(7)) };
    openFormModal(task ? 'Edit task' : 'Create task', 'Add clear ownership, priority, and a due date.', `<input type="hidden" name="id" value="${escapeHtml(data.id)}"><div class="field-grid">${field('Task title', 'title', data.title, { required: true, span: true, maxlength: 100 })}${customSelectField('Project', 'projectId', state.projects.map(project => [project.id, project.name]), data.projectId)}${selectField('Priority', 'priority', ['low', 'medium', 'high'], data.priority)}${selectField('Status', 'status', ['todo', 'progress', 'done'], data.status)}${field('Due date', 'dueDate', data.dueDate, { type: 'date', required: true })}</div>`, form => {
      const values = formValues(form);
      if (task) {
        const wasDone = task.status === 'done';
        Object.assign(task, values);
        if (!wasDone && values.status === 'done') task.completedAt = new Date().toISOString();
        if (values.status !== 'done') task.completedAt = null;
        if (!Object.prototype.hasOwnProperty.call(task, 'createdAt')) task.createdAt = null;
      } else {
        state.tasks.push({ ...values, id: uid(), createdAt: new Date().toISOString(), completedAt: values.status === 'done' ? new Date().toISOString() : null });
      }
      logActivity('task', task ? 'Task updated' : 'Task created', values.title);
      saveState(); closeModal(); renderShell(); toast(task ? 'Task updated.' : 'Task created.');
    });
  };

  toggleTask = function toggleTaskWithHistory(id, completed) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;
    task.status = completed ? 'done' : 'todo';
    task.completedAt = completed ? new Date().toISOString() : null;
    if (!Object.prototype.hasOwnProperty.call(task, 'createdAt')) task.createdAt = null;
    logActivity('task', completed ? 'Task completed' : 'Task reopened', task.title);
    saveState(); renderShell(); toast('Task updated.');
  };

  function workspaceSearchResults(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return Object.entries(routes).map(([route, meta]) => ({ route, kind: 'Page', label: meta.label, meta: meta.description, id: route }));
    }
    const matches = [];
    const add = (route, kind, label, meta, id) => {
      if (`${label} ${meta}`.toLowerCase().includes(normalized)) matches.push({ route, kind, label, meta, id });
    };
    state.projects.forEach(item => add('projects', 'Project', item.name, `${item.client} ${item.description}`, item.id));
    state.tasks.forEach(item => add('tasks', 'Task', item.title, projectById(item.projectId)?.name || 'Unassigned', item.id));
    state.team.forEach(item => add('team', 'Member', item.name, `${item.email} ${item.role}`, item.id));
    state.events.forEach(item => add('calendar', 'Event', item.title, `${item.date} ${item.category} ${item.notes || ''}`, item.id));
    state.messages.forEach(item => add('email', 'Message', item.subject, `${item.from} ${item.to} ${item.body}`, item.id));
    state.files.forEach(item => add('files', item.kind === 'folder' ? 'Folder' : 'File', item.name, item.kind, item.id));
    state.invoices.forEach(item => add('invoices', 'Invoice', item.number, `${item.client} ${item.email} ${item.status}`, item.id));
    return matches.slice(0, 30);
  }

  function renderWorkspaceSearchResults(query) {
    const results = workspaceSearchResults(query);
    const target = $('[data-workspace-search-results]', modal);
    if (!target) return;
    target.innerHTML = results.length ? results.map(result => `<button class="workspace-search-result" type="button" data-workspace-search-route="${result.route}" data-workspace-search-id="${escapeHtml(result.id)}"><span class="metric-icon">${icon(routes[result.route]?.icon || 'search', 17)}</span><span><small>${escapeHtml(result.kind)}</small><strong>${escapeHtml(result.label)}</strong><em>${escapeHtml(result.meta)}</em></span>${icon('arrowRight', 16)}</button>`).join('') : `<div class="workspace-search-empty"><strong>No results found</strong><span>Try a project, task, person, event, message, file, or invoice.</span></div>`;
    $$('[data-workspace-search-route]', target).forEach(button => button.addEventListener('click', () => {
      const route = button.dataset.workspaceSearchRoute;
      closeModal();
      navigate(route);
    }));
  }

  function openWorkspaceSearch() {
    openModal(`<div class="modal-card workspace-search-modal"><div class="modal-head"><div><p class="panel-kicker">Workspace search</p><h2 id="modal-title">Find anything in Formcraft</h2><p>Search projects, tasks, people, events, messages, files, invoices, or pages.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close search">${icon('close', 18)}</button></div><label class="search-control workspace-search-input">${icon('search', 18)}<span class="sr-only">Search workspace</span><input type="search" data-workspace-search placeholder="Search workspace" autocomplete="off"></label><div class="workspace-search-results" data-workspace-search-results></div></div>`);
    const input = $('[data-workspace-search]', modal);
    renderWorkspaceSearchResults('');
    input?.addEventListener('input', () => renderWorkspaceSearchResults(input.value));
    requestAnimationFrame(() => input?.focus());
  }

  function linkFormErrors(root = document) {
    const prefix = root === modal ? 'modal' : 'page';
    $$('[data-error-for]', root).forEach(error => {
      const name = error.dataset.errorFor;
      const control = $(`[name="${CSS.escape(name)}"]`, root);
      if (!control) return;
      const id = `${prefix}-error-${name}`;
      error.id = id;
      error.setAttribute('role', 'alert');
      error.setAttribute('aria-live', 'polite');
      control.setAttribute('aria-describedby', id);
      control.setAttribute('aria-errormessage', id);
    });
  }

  const originalOpenModal = openModal;
  openModal = function openModalWithErrorLinks(markup) {
    originalOpenModal(markup);
    linkFormErrors(modal);
  };

  const originalBindShell = bindShell;
  bindShell = function bindShellWithGlobalSearch() {
    originalBindShell();
    const oldSearch = $('[data-search-focus]');
    if (oldSearch) {
      const searchButton = oldSearch.cloneNode(true);
      oldSearch.replaceWith(searchButton);
      searchButton.setAttribute('aria-label', 'Search workspace');
      searchButton.addEventListener('click', openWorkspaceSearch);
    }
    linkFormErrors(document);
  };

  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      event.stopImmediatePropagation();
      openWorkspaceSearch();
    }
  }, true);

  window.addEventListener('popstate', () => {
    requestAnimationFrame(() => {
      const heading = $('[data-route-heading]');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
      announcer.textContent = `${routes[ui.route]?.title || 'Dashboard'} page loaded`;
    });
  });

  renderShell();
})();
