'use strict';

(() => {
  const hiddenRoutes = new Set(['email', 'reports']);
  const mobileRoutes = ['dashboard', 'projects', 'tasks', 'calendar'];
  const baseRenderShell = renderShell;
  const baseApplyTheme = applyTheme;
  let persistedLightDefault = false;

  const nowIso = () => new Date().toISOString();
  const currentUserId = () => window.FormcraftBackend?.session?.user?.id || '';

  function memberOptions(includeUnassigned = true) {
    const options = includeUnassigned ? [['', 'Unassigned']] : [];
    return options.concat(
      state.team
        .filter(member => !member.pending)
        .map(member => [member.id || member.userId, member.name])
    );
  }

  function projectOptions(includeUnassigned = true) {
    const options = includeUnassigned ? [['', 'No project']] : [];
    return options.concat(state.projects.map(project => [project.id, project.name]));
  }

  function memberName(id) {
    return state.team.find(member => member.id === id || member.userId === id)?.name || 'Unassigned';
  }

  function formSection(title, copy, content) {
    return `<fieldset class="bright-form-section">
      <legend>${escapeHtml(title)}</legend>
      ${copy ? `<p class="bright-form-section-copy">${escapeHtml(copy)}</p>` : ''}
      <div class="field-grid">${content}</div>
    </fieldset>`;
  }

  applyTheme = function applyBrightTheme() {
    const selected = state.settings?.theme || 'light';
    document.documentElement.dataset.theme = selected === 'dark' ? 'dark' : 'light';
  };

  function ensureLightDefault() {
    state.settings ||= {};
    if (!state.settings.theme || state.settings.theme === 'system') {
      state.settings.theme = 'light';
      applyTheme();
      if (!persistedLightDefault && window.FormcraftBackend?.workspace) {
        persistedLightDefault = true;
        Promise.resolve(saveState()).catch(() => {
          persistedLightDefault = false;
        });
      }
      return;
    }
    baseApplyTheme();
  }

  function contextActionLabel() {
    const labels = {
      dashboard: 'New project',
      projects: 'New project',
      tasks: 'New task',
      calendar: 'New event',
      team: 'Invite member',
      files: 'Upload file',
      invoices: 'New invoice',
      activity: 'Create',
      settings: 'Create'
    };
    return labels[ui.route] || 'Create';
  }

  function mobileRouteLink(route) {
    const meta = routes[route];
    return `<a href="#${route}" class="bright-bottom-nav-link ${ui.route === route ? 'is-active' : ''}" data-bright-route="${route}" ${ui.route === route ? 'aria-current="page"' : ''}>
      ${icon(meta.icon, 20)}<span>${escapeHtml(meta.label)}</span>
    </a>`;
  }

  function mobileNavigationMarkup() {
    return `<nav class="bright-bottom-nav" aria-label="Mobile navigation">
      ${mobileRoutes.map(mobileRouteLink).join('')}
      <button class="bright-bottom-nav-link ${!mobileRoutes.includes(ui.route) ? 'is-active' : ''}" type="button" data-bright-more aria-label="Open more navigation">
        ${icon('grid', 20)}<span>More</span>
      </button>
    </nav>
    <button class="bright-mobile-create" type="button" data-bright-context-create aria-label="${escapeHtml(contextActionLabel())}">
      ${icon('plus', 22)}<span>${escapeHtml(contextActionLabel())}</span>
    </button>`;
  }

  function removeDeferredModules() {
    $$('[data-route="email"], [data-route="reports"]', app).forEach(node => node.remove());
    const labels = $$('.workspace-nav-label', app);
    labels.forEach(label => {
      const next = label.nextElementSibling;
      if (!next || next.classList.contains('workspace-nav-label')) label.remove();
    });
  }

  function decorateResponsiveTables() {
    $$('table', app).forEach(table => {
      const labels = $$('thead th', table).map(cell => cell.textContent.trim());
      $$('tbody tr', table).forEach(row => {
        $$('td', row).forEach((cell, index) => {
          const label = labels[index] || '';
          if (label && !cell.dataset.label) cell.dataset.label = label;
        });
      });
    });
  }

  function bindBrightShellEnhancements() {
    $$('[data-bright-route]', app).forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        navigate(link.dataset.brightRoute);
      });
    });
    $('[data-bright-more]', app)?.addEventListener('click', () => document.body.classList.add('drawer-open'));
    $('[data-bright-context-create]', app)?.addEventListener('click', handleContextCreate);
  }

  function refineShell() {
    ensureLightDefault();
    removeDeferredModules();

    $('.workspace-brand small', app)?.replaceChildren(document.createTextNode('Project workspace'));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', document.documentElement.dataset.theme === 'dark' ? '#101318' : '#F7F8FA');
    const themeToggle = $('[data-theme-toggle]', app);
    if (themeToggle) {
      themeToggle.innerHTML = icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 19);
      themeToggle.setAttribute('aria-label', document.documentElement.dataset.theme === 'dark' ? 'Use light theme' : 'Use dark theme');
    }

    app.insertAdjacentHTML('beforeend', mobileNavigationMarkup());
    bindBrightShellEnhancements();
    requestAnimationFrame(decorateResponsiveTables);
  }

  renderShell = function renderBrightWorkspace() {
    baseRenderShell();
    refineShell();
  };

  handleContextCreate = function handleBrightContextCreate() {
    const actions = {
      dashboard: openProjectForm,
      projects: openProjectForm,
      tasks: openTaskForm,
      calendar: openEventForm,
      team: openMemberForm,
      files: () => { navigate('files'); requestAnimationFrame(() => $('[data-file-upload]')?.click()); },
      invoices: openInvoiceForm
    };
    (actions[ui.route] || openCommandMenu)();
  };

  openCommandMenu = function openBrightCommandMenu() {
    const commands = [
      ['Project', 'projects', 'Define scope, ownership, and delivery dates.'],
      ['Task', 'tasks', 'Assign the next concrete action.'],
      ['Event', 'calendar', 'Schedule a meeting, review, or deadline.'],
      ['File', 'files', 'Upload a working document or project resource.'],
      ['Invoice', 'invoices', 'Create a billing record with clear terms.'],
      ['Member', 'team', 'Invite a collaborator and set their role.']
    ];

    openModal(`<div class="modal-card bright-command-modal">
      <div class="modal-head"><div><h2 id="modal-title">Create</h2><p>Add a real workspace record. No decorative modules, no imaginary productivity.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div>
      <div class="modal-body"><div class="command-grid">${commands.map(([label, route, copy]) => `<button class="command-button" type="button" data-bright-command="${route}">${icon(routes[route].icon, 21)}<strong>${label}</strong><span>${copy}</span></button>`).join('')}</div></div>
    </div>`);

    $$('[data-bright-command]', modal).forEach(button => {
      button.addEventListener('click', () => {
        const route = button.dataset.brightCommand;
        closeModal();
        const actions = {
          projects: openProjectForm,
          tasks: openTaskForm,
          calendar: openEventForm,
          files: () => { navigate('files'); requestAnimationFrame(() => $('[data-file-upload]')?.click()); },
          invoices: openInvoiceForm,
          team: openMemberForm
        };
        actions[route]?.();
      });
    });
  };

  openProjectForm = function openBrightProjectForm(project = null) {
    const data = project || {
      name: '', client: '', ownerId: currentUserId(), status: state.settings.defaultStatus || 'active',
      startDate: dateKey(today()), dueDate: dateKey(addDays(30)), progressMode: 'automatic', progress: 0, description: ''
    };

    const fields = `<div class="bright-form-sections">
      ${formSection('Project details', 'Name the outcome and identify who owns it.', `
        ${field('Project name', 'name', data.name, { required: true, span: true, maxlength: 100 })}
        ${field('Client or team', 'client', data.client, { required: true, maxlength: 80 })}
        ${customSelectField('Owner', 'ownerId', memberOptions(), data.ownerId)}
        ${selectField('Status', 'status', ['planning', 'active', 'review', 'completed'], data.status, { required: true })}
      `)}
      ${formSection('Schedule', 'Keep start and due dates visible to everyone.', `
        ${field('Start date', 'startDate', data.startDate || dateKey(today()), { type: 'date', required: true })}
        ${field('Due date', 'dueDate', data.dueDate, { type: 'date', required: true })}
      `)}
      ${formSection('Delivery', 'Progress can follow completed tasks or be entered manually.', `
        ${customSelectField('Progress calculation', 'progressMode', [['automatic', 'Automatic from tasks'], ['manual', 'Manual percentage']], data.progressMode || 'automatic', { hint: 'Automatic progress updates whenever linked tasks change.' })}
        ${field('Manual progress', 'progress', data.progress || 0, { type: 'number', min: 0, max: 100, step: 1, hint: 'Used only when progress calculation is manual.' })}
        ${field('Description', 'description', data.description, { textarea: true, span: true, required: true, maxlength: 500, placeholder: 'Describe the outcome, scope, and constraints.' })}
      `)}
    </div>`;

    openFormModal(project ? 'Edit project' : 'Create project', 'Capture the minimum information required to plan and deliver the work.', fields, async form => {
      const values = formValues(form);
      if (values.startDate && values.dueDate && values.dueDate < values.startDate) {
        throw new Error('Due date must be on or after the start date.');
      }
      const timestamp = nowIso();
      const record = {
        ...values,
        ownerId: values.ownerId || '',
        progress: Number(values.progress || 0),
        updatedAt: timestamp
      };
      if (project) Object.assign(project, record);
      else state.projects.push({ ...record, id: uid(), createdAt: timestamp });
      logActivity('project', project ? 'Project updated' : 'Project created', values.name);
      await saveState();
      closeModal();
      renderShell();
      toast(project ? 'Project updated.' : 'Project created.');
    });
  };

  openTaskForm = function openBrightTaskForm(task = null) {
    const existingTask = Boolean(task?.id);
    const data = existingTask ? task : {
      title: '', projectId: state.projects[0]?.id || '', assigneeId: currentUserId(), priority: 'medium',
      status: 'todo', dueDate: dateKey(addDays(7)), description: '', ...(task || {})
    };

    const fields = `<div class="bright-form-sections">
      ${formSection('Task details', 'Make the action understandable without opening another document.', `
        ${field('Task title', 'title', data.title, { required: true, span: true, maxlength: 140 })}
        ${customSelectField('Project', 'projectId', projectOptions(), data.projectId)}
        ${customSelectField('Assignee', 'assigneeId', memberOptions(), data.assigneeId)}
      `)}
      ${formSection('Planning', 'Set urgency, workflow state, and a realistic due date.', `
        ${selectField('Priority', 'priority', ['low', 'medium', 'high'], data.priority, { required: true })}
        ${selectField('Status', 'status', ['todo', 'progress', 'done'], data.status, { required: true })}
        ${field('Due date', 'dueDate', data.dueDate, { type: 'date', required: true })}
      `)}
      ${formSection('Context', 'Acceptance criteria and useful links belong here.', `
        ${field('Description', 'description', data.description || '', { textarea: true, span: true, maxlength: 600, placeholder: 'Add acceptance criteria, links, or implementation notes.' })}
      `)}
    </div>`;

    openFormModal(existingTask ? 'Edit task' : 'Create task', 'Assign one clear action to one owner.', fields, async form => {
      const values = formValues(form);
      const timestamp = nowIso();
      const wasDone = existingTask && task?.status === 'done';
      const record = {
        ...values,
        projectId: values.projectId || '',
        assigneeId: values.assigneeId || '',
        updatedAt: timestamp,
        completedAt: values.status === 'done' ? (wasDone ? task.completedAt || timestamp : timestamp) : null
      };
      if (existingTask) Object.assign(task, record);
      else state.tasks.push({ ...record, id: uid(), createdAt: timestamp });
      logActivity('task', existingTask ? 'Task updated' : 'Task created', values.title);
      await saveState();
      closeModal();
      renderShell();
      toast(existingTask ? 'Task updated.' : 'Task created.');
    });
  };

  openEventForm = function openBrightEventForm(event = null, presetDate = null) {
    const data = event || {
      title: '', date: presetDate || dateKey(today()), time: '09:00', category: 'meeting',
      projectId: '', location: '', notes: ''
    };

    const fields = `<div class="bright-form-sections">
      ${formSection('Event details', 'Use a specific title people can understand at a glance.', `
        ${field('Event title', 'title', data.title, { required: true, span: true, maxlength: 120 })}
        ${selectField('Category', 'category', ['meeting', 'review', 'deadline', 'personal'], data.category, { required: true })}
        ${customSelectField('Related project', 'projectId', projectOptions(), data.projectId)}
      `)}
      ${formSection('Schedule', 'Date and time remain separate so they are easy to scan and edit.', `
        ${field('Date', 'date', data.date, { type: 'date', required: true })}
        ${field('Time', 'time', data.time, { type: 'time', required: true })}
        ${field('Location or link', 'location', data.location || '', { span: true, maxlength: 200, placeholder: 'Room, address, or meeting link' })}
      `)}
      ${formSection('Preparation', 'Add only the notes people need before the event.', `
        ${field('Notes', 'notes', data.notes, { textarea: true, span: true, maxlength: 600, placeholder: 'Add an agenda or preparation notes.' })}
      `)}
    </div>`;

    openFormModal(event ? 'Edit event' : 'Create event', 'Schedule a real workspace event and connect it to the relevant work.', fields, async form => {
      const values = formValues(form);
      const record = { ...values, projectId: values.projectId || '', updatedAt: nowIso() };
      if (event) Object.assign(event, record);
      else state.events.push({ ...record, id: uid(), createdAt: nowIso() });
      logActivity('calendar', event ? 'Event updated' : 'Event created', values.title);
      await saveState();
      closeModal();
      renderShell();
      toast(event ? 'Event updated.' : 'Event created.');
    }, event ? [{
      label: 'Delete event',
      tone: 'danger',
      onClick: () => {
        closeModal();
        confirmAction('Delete event?', `Delete ${event.title}?`, async () => {
          state.events = state.events.filter(item => item.id !== event.id);
          await saveState();
          renderShell();
          toast('Event deleted.', 'warning');
        });
      }
    }] : []);
  };

  openInvoiceForm = function openBrightInvoiceForm(invoice = null) {
    const nextNumber = `FC-${new Date().getFullYear()}-${String(state.invoices.length + 1).padStart(4, '0')}`;
    const data = invoice || {
      number: nextNumber, projectId: '', client: '', email: '', amount: '', status: 'draft',
      issueDate: dateKey(today()), dueDate: dateKey(addDays(14)), notes: ''
    };

    const fields = `<div class="bright-form-sections">
      ${formSection('Invoice details', 'Keep the identifier, status, and related project together.', `
        ${field('Invoice number', 'number', data.number, { required: true, maxlength: 40 })}
        ${selectField('Status', 'status', ['draft', 'sent', 'paid', 'overdue', 'void'], data.status, { required: true })}
        ${customSelectField('Related project', 'projectId', projectOptions(), data.projectId, { span: true })}
      `)}
      ${formSection('Billing', 'The billing contact and amount must be explicit.', `
        ${field('Client', 'client', data.client, { required: true, maxlength: 100 })}
        ${field('Billing email', 'email', data.email, { type: 'email', required: true, autocomplete: 'email' })}
        ${field(`Amount (${state.settings.currency || 'USD'})`, 'amount', data.amount, { type: 'number', required: true, min: 0, step: '.01' })}
      `)}
      ${formSection('Dates and terms', 'Use the issue date and due date to drive payment status.', `
        ${field('Issue date', 'issueDate', data.issueDate || dateKey(today()), { type: 'date', required: true })}
        ${field('Due date', 'dueDate', data.dueDate, { type: 'date', required: true })}
        ${field('Notes', 'notes', data.notes, { textarea: true, span: true, maxlength: 600, placeholder: 'Add payment terms or internal notes.' })}
      `)}
    </div>`;

    openFormModal(invoice ? 'Edit invoice' : 'Create invoice', 'Record billing details without turning the form into accounting theatre.', fields, async form => {
      const values = formValues(form);
      if (values.issueDate && values.dueDate && values.dueDate < values.issueDate) {
        throw new Error('Due date must be on or after the issue date.');
      }
      const record = {
        ...values,
        projectId: values.projectId || '',
        amount: Number(values.amount),
        currency: state.settings.currency || 'USD',
        updatedAt: nowIso()
      };
      if (invoice) Object.assign(invoice, record);
      else state.invoices.push({ ...record, id: uid(), createdAt: nowIso() });
      logActivity('invoice', invoice ? 'Invoice updated' : 'Invoice created', values.number);
      await saveState();
      closeModal();
      renderShell();
      toast(invoice ? 'Invoice updated.' : 'Invoice created.');
    });
  };

  function detailStat(value, label) {
    return `<div class="bright-detail-stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
  }

  function projectTaskList(tasks) {
    if (!tasks.length) return '<div class="bright-detail-empty">No tasks are linked to this project.</div>';
    return `<div class="bright-detail-list">${tasks.map(task => `<button type="button" class="bright-detail-row" data-detail-task="${escapeHtml(task.id)}">
      <span class="bright-detail-row-main"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(memberName(task.assigneeId))} · ${titleCase(task.priority || 'medium')} priority</small></span>
      ${statusPill(task.status)}
      <time>${task.dueDate ? formatShortDate(task.dueDate) : 'No due date'}</time>
    </button>`).join('')}</div>`;
  }

  openProjectDetail = function openBrightProjectDetail(project) {
    if (!project) return;
    const tasks = state.tasks.filter(task => task.projectId === project.id);
    const events = state.events.filter(event => event.projectId === project.id).sort((a, b) => a.date.localeCompare(b.date));
    const invoices = state.invoices.filter(invoice => invoice.projectId === project.id);
    const completedTasks = tasks.filter(task => task.status === 'done').length;
    const outstanding = invoices.filter(invoice => !['paid', 'void'].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

    openModal(`<article class="full-detail-view">
      <header class="bright-detail-header">
        <div><p class="workspace-breadcrumb">Projects<span>/</span>${escapeHtml(project.name)}</p><h2 id="modal-title">${escapeHtml(project.name)}</h2><p>${escapeHtml(project.client || 'Internal project')}</p></div>
        <div class="bright-detail-actions"><button class="button button-secondary" type="button" data-close-modal>Close</button><button class="button button-primary" type="button" data-detail-edit-project>${icon('edit', 17)}Edit project</button></div>
      </header>
      <div class="bright-detail-body">
        <section class="bright-detail-summary" aria-label="Project summary">
          ${detailStat(titleCase(project.status || 'planning'), 'Status')}
          ${detailStat(`${Number(project.progress || 0)}%`, 'Progress')}
          ${detailStat(`${completedTasks}/${tasks.length}`, 'Tasks completed')}
          ${detailStat(project.dueDate ? formatShortDate(project.dueDate) : 'Not set', 'Due date')}
        </section>
        <div class="bright-detail-layout">
          <main class="bright-detail-main">
            <section class="bright-detail-section"><div class="bright-detail-section-head"><div><h3>Project brief</h3><p>The intended outcome and constraints.</p></div></div><p class="bright-detail-description">${escapeHtml(project.description || 'No project description has been added.')}</p></section>
            <section class="bright-detail-section"><div class="bright-detail-section-head"><div><h3>Tasks</h3><p>Work linked to this project.</p></div><button class="text-button" type="button" data-detail-new-task>New task</button></div>${projectTaskList(tasks)}</section>
          </main>
          <aside class="bright-detail-aside">
            <section class="bright-detail-section"><h3>Ownership</h3><dl><div><dt>Owner</dt><dd>${escapeHtml(memberName(project.ownerId))}</dd></div><div><dt>Start date</dt><dd>${project.startDate ? formatShortDate(project.startDate) : 'Not set'}</dd></div><div><dt>Due date</dt><dd>${project.dueDate ? formatShortDate(project.dueDate) : 'Not set'}</dd></div></dl></section>
            <section class="bright-detail-section"><h3>Schedule</h3>${events.length ? `<div class="bright-detail-mini-list">${events.slice(0, 5).map(event => `<button type="button" data-detail-event="${escapeHtml(event.id)}"><strong>${escapeHtml(event.title)}</strong><span>${formatShortDate(event.date)} · ${escapeHtml(event.time || 'All day')}</span></button>`).join('')}</div>` : '<div class="bright-detail-empty">No events are linked.</div>'}</section>
            <section class="bright-detail-section"><h3>Billing</h3><dl><div><dt>Invoices</dt><dd>${invoices.length}</dd></div><div><dt>Outstanding</dt><dd>${money(outstanding)}</dd></div></dl>${invoices.length ? `<button class="text-button" type="button" data-detail-invoice="${escapeHtml(invoices[0].id)}">View latest invoice</button>` : ''}</section>
          </aside>
        </div>
      </div>
    </article>`);

    $('[data-detail-edit-project]', modal)?.addEventListener('click', () => { closeModal(); openProjectForm(project); });
    $('[data-detail-new-task]', modal)?.addEventListener('click', () => { closeModal(); openTaskForm({ projectId: project.id }); });
    $$('[data-detail-task]', modal).forEach(button => button.addEventListener('click', () => { const task = state.tasks.find(item => item.id === button.dataset.detailTask); closeModal(); openTaskForm(task); }));
    $$('[data-detail-event]', modal).forEach(button => button.addEventListener('click', () => { const event = state.events.find(item => item.id === button.dataset.detailEvent); closeModal(); openEventForm(event); }));
    $('[data-detail-invoice]', modal)?.addEventListener('click', () => { const button = $('[data-detail-invoice]', modal); const invoice = state.invoices.find(item => item.id === button?.dataset.detailInvoice); closeModal(); openInvoiceDetail(invoice); });
  };

  openInvoiceDetail = function openBrightInvoiceDetail(invoice) {
    if (!invoice) return;
    const project = projectById(invoice.projectId);
    openModal(`<article class="full-detail-view bright-invoice-detail">
      <header class="bright-detail-header">
        <div><p class="workspace-breadcrumb">Invoices<span>/</span>${escapeHtml(invoice.number)}</p><h2 id="modal-title">${escapeHtml(invoice.number)}</h2><p>${escapeHtml(invoice.client)}</p></div>
        <div class="bright-detail-actions"><button class="button button-secondary" type="button" data-print-invoice>${icon('download', 17)}Print</button><button class="button button-secondary" type="button" data-close-modal>Close</button><button class="button button-primary" type="button" data-detail-edit-invoice>${icon('edit', 17)}Edit invoice</button></div>
      </header>
      <div class="bright-detail-body">
        <section class="bright-detail-summary" aria-label="Invoice summary">
          ${detailStat(money(invoice.amount), `Amount · ${invoice.currency || state.settings.currency || 'USD'}`)}
          ${detailStat(titleCase(invoice.status || 'draft'), 'Status')}
          ${detailStat(invoice.issueDate ? formatShortDate(invoice.issueDate) : 'Not set', 'Issue date')}
          ${detailStat(invoice.dueDate ? formatShortDate(invoice.dueDate) : 'Not set', 'Due date')}
        </section>
        <div class="bright-invoice-sheet">
          <section><h3>Bill to</h3><p><strong>${escapeHtml(invoice.client)}</strong><br>${escapeHtml(invoice.email)}</p></section>
          <section><h3>Related work</h3><p>${escapeHtml(project?.name || 'No project linked')}</p></section>
          <section class="bright-invoice-notes"><h3>Terms and notes</h3><p>${escapeHtml(invoice.notes || 'No notes or payment terms have been added.')}</p></section>
        </div>
      </div>
    </article>`);
    $('[data-detail-edit-invoice]', modal)?.addEventListener('click', () => { closeModal(); openInvoiceForm(invoice); });
    $('[data-print-invoice]', modal)?.addEventListener('click', () => window.print());
  };

  function normalizeUnsupportedRoute() {
    const route = location.hash.slice(1);
    if (!hiddenRoutes.has(route)) return;
    history.replaceState(null, '', '#dashboard');
    ui.route = 'dashboard';
    renderShell();
    toast('That unfinished module has been removed from the workspace.', 'warning');
  }

  window.addEventListener('hashchange', normalizeUnsupportedRoute);
  document.documentElement.classList.add('formcraft-bright-workspace');
  normalizeUnsupportedRoute();
  applyTheme();
  renderShell();
})();
