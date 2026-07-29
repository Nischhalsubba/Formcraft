'use strict';

function bindShell() {
    $$('[data-route]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); navigate(link.dataset.route); }));
    $$('[data-route-jump]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.routeJump)));
    $('[data-open-drawer]')?.addEventListener('click', () => document.body.classList.add('drawer-open'));
    $('[data-close-drawer]')?.addEventListener('click', closeDrawer);
    $('[data-drawer-backdrop]')?.addEventListener('click', closeDrawer);
    $('[data-theme-toggle]')?.addEventListener('click', () => { state.settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; saveState(); applyTheme(); renderShell(); toast('Theme updated.'); });
    $('[data-toggle-notifications]')?.addEventListener('click', () => togglePopover('notifications'));
    $('[data-toggle-account]')?.addEventListener('click', () => togglePopover('account'));
    $('[data-account-settings]')?.addEventListener('click', () => navigate('settings'));
    $('[data-search-focus]')?.addEventListener('click', () => $('[data-page-search]')?.focus());
    $('[data-command-menu]')?.addEventListener('click', openCommandMenu);
    $('[data-context-create]')?.addEventListener('click', handleContextCreate);
    $$('[data-export-data]').forEach(button => button.addEventListener('click', exportData));
    bindPage();
  }

  function closeDrawer() { document.body.classList.remove('drawer-open'); }

  function togglePopover(type) {
    const notifications = $('[data-notifications-popover]');
    const account = $('[data-account-popover]');
    const target = type === 'notifications' ? notifications : account;
    const other = type === 'notifications' ? account : notifications;
    other.hidden = true;
    target.hidden = !target.hidden;
    $('[data-toggle-notifications]')?.setAttribute('aria-expanded', String(!notifications.hidden));
    $('[data-toggle-account]')?.setAttribute('aria-expanded', String(!account.hidden));
  }

  function navigate(route, replace = false) {
    if (!routes[route]) route = 'dashboard';
    ui.route = route;
    ui.query = '';
    ui.selectedEmail = null;
    ui.selectedEmails.clear();
    if (replace) history.replaceState(null, '', `#${route}`); else history.pushState(null, '', `#${route}`);
    closeDrawer();
    renderShell();
    requestAnimationFrame(() => {
      const heading = $('[data-route-heading]');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
      announcer.textContent = `${routes[route].title} page loaded`;
    });
  }

  function bindPage() {
    $('[data-page-search]')?.addEventListener('input', event => { ui.query = event.target.value.trim(); renderShell(); requestAnimationFrame(() => { const input = $('[data-page-search]'); input?.focus(); input?.setSelectionRange(ui.query.length, ui.query.length); }); });
    $$('[data-edit-project]').forEach(button => button.addEventListener('click', () => openProjectForm(projectById(button.dataset.editProject))));
    $$('[data-view-project]').forEach(button => button.addEventListener('click', () => openProjectDetail(projectById(button.dataset.viewProject))));
    $$('[data-delete-project]').forEach(button => button.addEventListener('click', () => confirmDelete('project', button.dataset.deleteProject)));
    $$('[data-project-filter]').forEach(button => button.addEventListener('click', () => { ui.projectFilter = button.dataset.projectFilter; renderShell(); }));
    $('[data-project-sort]')?.addEventListener('change', event => { ui.projectSort = event.target.value; renderShell(); });
    $$('[data-project-view]').forEach(button => button.addEventListener('click', () => { ui.projectView = button.dataset.projectView; renderShell(); }));
    $$('[data-toggle-task]').forEach(input => input.addEventListener('change', () => toggleTask(input.dataset.toggleTask, input.checked)));
    $$('[data-edit-task]').forEach(button => button.addEventListener('click', () => openTaskForm(state.tasks.find(task => task.id === button.dataset.editTask))));
    $$('[data-delete-task]').forEach(button => button.addEventListener('click', () => confirmDelete('task', button.dataset.deleteTask)));
    $$('[data-task-filter]').forEach(button => button.addEventListener('click', () => { ui.taskFilter = button.dataset.taskFilter; renderShell(); }));
    $$('[data-edit-member]').forEach(button => button.addEventListener('click', () => openMemberForm(state.team.find(member => member.id === button.dataset.editMember))));
    $$('[data-remove-member]').forEach(button => button.addEventListener('click', () => confirmDelete('member', button.dataset.removeMember)));
    $('[data-report-period]')?.addEventListener('change', event => { ui.reportPeriod = event.target.value; renderShell(); });
    bindCalendar();
    bindEmail();
    bindFiles();
    bindInvoices();
    $('[data-activity-filter]')?.addEventListener('change', event => { ui.activityFilter = event.target.value; renderShell(); });
    $('[data-activity-period]')?.addEventListener('change', event => { ui.activityPeriod = event.target.value; renderShell(); });
    $('[data-clear-activity]')?.addEventListener('click', () => confirmAction('Clear activity history?', 'This removes all activity records from this browser.', () => { state.activity = []; saveState(); renderShell(); toast('Activity history cleared.', 'warning'); }));
    bindSettings();
    markScrollableTables();
  }

  function markScrollableTables() {
    $$('.table-container').forEach(container => {
      const scroller = $('.table-scroll', container);
      container.classList.toggle('is-scrollable', scroller.scrollWidth > scroller.clientWidth + 4);
    });
  }

  function handleContextCreate() {
    ({ dashboard: openProjectForm, projects: openProjectForm, tasks: openTaskForm, team: openMemberForm, calendar: openEventForm, email: openComposeForm, files: () => $('[data-file-upload]')?.click(), invoices: openInvoiceForm }[ui.route] || openCommandMenu)();
  }

  function openCommandMenu() {
    openModal(`<div class="modal-card"><div class="modal-head"><div><h2 id="modal-title">Create in Formcraft</h2><p>Choose the item you want to add.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div><div class="command-grid">${[
      ['Project', 'projects', 'Create a project and track delivery.'], ['Task', 'tasks', 'Add work to a project.'], ['Event', 'calendar', 'Schedule a meeting or deadline.'], ['Message', 'email', 'Compose a workspace email.'], ['Invoice', 'invoices', 'Create a billing record.'], ['Member', 'team', 'Invite a collaborator.']
    ].map(([label, route, copy]) => `<button class="command-button" type="button" data-command="${route}">${icon(routes[route].icon, 22)}<strong>${label}</strong><span>${copy}</span></button>`).join('')}</div></div>`);
    $$('[data-command]', modal).forEach(button => button.addEventListener('click', () => { closeModal(); ({ projects: openProjectForm, tasks: openTaskForm, calendar: openEventForm, email: openComposeForm, invoices: openInvoiceForm, team: openMemberForm }[button.dataset.command])(); }));
  }

  function openProjectDetail(project) {
    if (!project) return;
    const tasks = state.tasks.filter(task => task.projectId === project.id);
    openModal(`<div class="modal-card"><div class="modal-head"><div><p class="panel-kicker">Project details</p><h2 id="modal-title">${escapeHtml(project.name)}</h2><p>${escapeHtml(project.client)}</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div><div class="page-stack"><p>${escapeHtml(project.description)}</p><div class="summary-grid"><div class="summary-card"><strong>${project.progress}%</strong><span>Progress</span></div><div class="summary-card"><strong>${tasks.length}</strong><span>Tasks</span></div><div class="summary-card"><strong>${formatShortDate(project.dueDate)}</strong><span>Due date</span></div><div class="summary-card"><strong>${titleCase(project.status)}</strong><span>Status</span></div></div></div><div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Close</button><button class="button button-primary" type="button" data-modal-edit-project>Edit project</button></div></div>`);
    $('[data-modal-edit-project]', modal)?.addEventListener('click', () => { closeModal(); openProjectForm(project); });
  }

  function openProjectForm(project = null) {
    const data = project || { id: '', name: '', client: '', status: state.settings.defaultStatus || 'active', dueDate: dateKey(addDays(14)), progress: 0, description: '' };
    openFormModal(project ? 'Edit project' : 'Create project', 'Set the delivery details for this project.', `
      <input type="hidden" name="id" value="${escapeHtml(data.id)}">
      <div class="field-grid">
        ${field('Project name', 'name', data.name, { required: true, span: true, maxlength: 80 })}
        ${field('Client or team', 'client', data.client, { required: true, maxlength: 60 })}
        ${selectField('Status', 'status', ['planning', 'active', 'review', 'completed'], data.status)}
        ${field('Due date', 'dueDate', data.dueDate, { type: 'date', required: true })}
        ${field('Progress', 'progress', data.progress, { type: 'number', required: true, min: 0, max: 100 })}
        ${field('Description', 'description', data.description, { textarea: true, span: true, required: true, maxlength: 220 })}
      </div>`, form => {
        const values = formValues(form);
        if (project) Object.assign(project, values, { progress: Number(values.progress) });
        else state.projects.push({ ...values, id: uid(), progress: Number(values.progress) });
        logActivity('project', project ? 'Project updated' : 'Project created', values.name);
        saveState(); closeModal(); renderShell(); toast(project ? 'Project updated.' : 'Project created.');
      });
  }

  function openTaskForm(task = null) {
    if (!state.projects.length) { toast('Create a project before adding tasks.', 'warning'); return; }
    const data = task || { id: '', title: '', projectId: state.projects[0].id, priority: 'medium', status: 'todo', dueDate: dateKey(addDays(7)) };
    openFormModal(task ? 'Edit task' : 'Create task', 'Add clear ownership, priority, and a due date.', `<input type="hidden" name="id" value="${escapeHtml(data.id)}"><div class="field-grid">${field('Task title', 'title', data.title, { required: true, span: true, maxlength: 100 })}${customSelectField('Project', 'projectId', state.projects.map(project => [project.id, project.name]), data.projectId)}${selectField('Priority', 'priority', ['low', 'medium', 'high'], data.priority)}${selectField('Status', 'status', ['todo', 'progress', 'done'], data.status)}${field('Due date', 'dueDate', data.dueDate, { type: 'date', required: true })}</div>`, form => {
      const values = formValues(form);
      if (task) Object.assign(task, values); else state.tasks.push({ ...values, id: uid() });
      logActivity('task', task ? 'Task updated' : 'Task created', values.title);
      saveState(); closeModal(); renderShell(); toast(task ? 'Task updated.' : 'Task created.');
    });
  }

  function openMemberForm(member = null) {
    const data = member || { name: '', email: '', role: 'viewer' };
    openFormModal(member ? 'Change member role' : 'Invite member', member ? 'Update this member’s workspace role.' : 'Invite a real person by name and email.', `<div class="field-grid">${field('Full name', 'name', data.name, { required: true, span: true, maxlength: 80 })}${field('Email address', 'email', data.email, { type: 'email', required: true, span: true })}${selectField('Role', 'role', ['admin', 'editor', 'viewer'], data.role)}</div>`, form => {
      const values = formValues(form);
      if (member) Object.assign(member, values, { initials: initials(values.name) });
      else state.team.push({ ...values, id: uid(), initials: initials(values.name) });
      logActivity('member', member ? 'Member updated' : 'Member invited', values.email);
      saveState(); closeModal(); renderShell(); toast(member ? 'Member role updated.' : 'Invitation added.');
    });
  }

  function initials(name) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join(''); }

  function toggleTask(id, completed) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;
    task.status = completed ? 'done' : 'todo';
    logActivity('task', completed ? 'Task completed' : 'Task reopened', task.title);
    saveState(); renderShell(); toast('Task updated.');
  }

