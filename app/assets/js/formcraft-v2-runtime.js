'use strict';

(() => {
  const baseSaveState = saveState;
  const baseBindShell = bindShell;
  let normalizing = false;
  let persistPromise = Promise.resolve();

  const fieldId = name => `field-${String(name).replace(/[^a-z0-9_-]/gi, '-')}-${Math.random().toString(36).slice(2, 7)}`;
  const isoNow = () => new Date().toISOString();
  const userId = () => window.FormcraftBackend?.session?.user?.id || '';
  const userEmail = () => window.FormcraftBackend?.session?.user?.email || '';

  function defaultPlaceholder(label, type) {
    if (['date', 'time', 'file', 'number'].includes(type)) return '';
    return `Enter ${String(label).toLowerCase()}`;
  }

  field = function formcraftField(label, name, value, options = {}) {
    const id = fieldId(name);
    const type = options.type || 'text';
    const attrs = [
      `id="${id}"`,
      `name="${escapeHtml(name)}"`,
      options.type ? `type="${escapeHtml(options.type)}"` : '',
      options.required ? 'required' : '',
      options.maxlength ? `maxlength="${Number(options.maxlength)}"` : '',
      options.min !== undefined ? `min="${escapeHtml(options.min)}"` : '',
      options.max !== undefined ? `max="${escapeHtml(options.max)}"` : '',
      options.step ? `step="${escapeHtml(options.step)}"` : '',
      options.multiple ? 'multiple' : '',
      options.autocomplete ? `autocomplete="${escapeHtml(options.autocomplete)}"` : '',
      options.readonly ? 'readonly' : '',
      !options.textarea && type !== 'file' && (options.placeholder || defaultPlaceholder(label, type))
        ? `placeholder="${escapeHtml(options.placeholder || defaultPlaceholder(label, type))}"`
        : ''
    ].filter(Boolean).join(' ');

    const control = options.textarea
      ? `<textarea ${attrs} placeholder="${escapeHtml(options.placeholder || `Add ${String(label).toLowerCase()}`)}">${escapeHtml(value ?? '')}</textarea>`
      : `<input ${attrs}${type === 'file' ? '' : ` value="${escapeHtml(value ?? '')}"`}>`;

    return `<div class="field ${options.span ? 'span-2' : ''}">
      <label for="${id}">${escapeHtml(label)}${options.required ? '<span aria-hidden="true">*</span>' : ''}</label>
      ${control}
      ${options.hint ? `<small class="field-hint">${escapeHtml(options.hint)}</small>` : ''}
      <span class="field-error" data-error-for="${escapeHtml(name)}"></span>
    </div>`;
  };

  customSelectField = function formcraftSelectField(label, name, options, selected, config = {}) {
    const id = fieldId(name);
    return `<div class="field ${config.span ? 'span-2' : ''}">
      <label for="${id}">${escapeHtml(label)}${config.required ? '<span aria-hidden="true">*</span>' : ''}</label>
      <select id="${id}" name="${escapeHtml(name)}" ${config.required ? 'required' : ''}>
        ${options.map(([optionValue, copy]) => `<option value="${escapeHtml(optionValue)}" ${String(optionValue) === String(selected ?? '') ? 'selected' : ''}>${escapeHtml(copy)}</option>`).join('')}
      </select>
      ${config.hint ? `<small class="field-hint">${escapeHtml(config.hint)}</small>` : ''}
      <span class="field-error" data-error-for="${escapeHtml(name)}"></span>
    </div>`;
  };

  selectField = function formcraftSimpleSelect(label, name, options, selected, config = {}) {
    return customSelectField(label, name, options.map(option => [option, titleCase(option)]), selected, config);
  };

  openFormModal = function openFormcraftModal(title, copy, fields, onSubmit, extraActions = []) {
    openModal(`<form class="modal-card form-modal" data-modal-form novalidate>
      <div class="modal-head">
        <div><p class="modal-eyebrow">Workspace form</p><h2 id="modal-title">${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div>
        <button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button>
      </div>
      <div class="modal-body">${fields}</div>
      <div class="modal-actions">
        <div class="modal-actions-leading">${extraActions.map((action, index) => `<button class="button button-${action.tone || 'secondary'}" type="button" data-extra-action="${index}">${escapeHtml(action.label)}</button>`).join('')}</div>
        <div class="modal-actions-trailing"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit"><span data-submit-label>Save changes</span></button></div>
      </div>
    </form>`);

    const form = $('[data-modal-form]', modal);
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!validateForm(form)) return;
      const controls = $$('button, input, select, textarea', form);
      const submitLabel = $('[data-submit-label]', form);
      controls.forEach(control => { control.disabled = true; });
      if (submitLabel) submitLabel.textContent = 'Saving…';
      try {
        await onSubmit(form);
      } catch (error) {
        controls.forEach(control => { control.disabled = false; });
        if (submitLabel) submitLabel.textContent = 'Save changes';
        toast(error.message || 'The changes could not be saved.', 'error');
      }
    });

    extraActions.forEach((action, index) => {
      $(`[data-extra-action="${index}"]`, modal)?.addEventListener('click', action.onClick);
    });
  };

  function ensureSettings() {
    state.settings ||= {};
    let changed = false;
    const defaults = {
      workspaceName: 'Formcraft',
      workspaceDescription: '',
      defaultStatus: 'active',
      theme: 'system',
      currency: 'USD',
      dataVersion: 2
    };
    Object.entries(defaults).forEach(([key, value]) => {
      if (state.settings[key] === undefined || state.settings[key] === null || state.settings[key] === '') {
        if (key === 'workspaceDescription') return;
        state.settings[key] = value;
        changed = true;
      }
    });
    state.settings.notifications ||= { taskReminders: true, projectUpdates: true, weeklySummary: false };
    return changed;
  }

  function syncDerivedState() {
    if (normalizing) return false;
    normalizing = true;
    let changed = ensureSettings();
    const todayKey = dateKey(today());

    state.projects.forEach(project => {
      const linkedTasks = state.tasks.filter(task => task.projectId === project.id);
      if (project.progressMode !== 'manual' && linkedTasks.length) {
        const nextProgress = Math.round(linkedTasks.filter(task => task.status === 'done').length / linkedTasks.length * 100);
        if (Number(project.progress) !== nextProgress) {
          project.progress = nextProgress;
          changed = true;
        }
      }
      if (!project.progressMode) {
        project.progressMode = linkedTasks.length ? 'automatic' : 'manual';
        changed = true;
      }
      if (!project.createdAt) {
        project.createdAt = isoNow();
        changed = true;
      }
    });

    state.tasks.forEach(task => {
      if (!task.createdAt) {
        task.createdAt = isoNow();
        changed = true;
      }
      if (task.status === 'done' && !task.completedAt) {
        task.completedAt = isoNow();
        changed = true;
      }
      if (task.status !== 'done' && task.completedAt) {
        task.completedAt = null;
        changed = true;
      }
    });

    state.invoices.forEach(invoice => {
      if (invoice.dueDate && invoice.dueDate < todayKey && !['paid', 'void'].includes(invoice.status) && invoice.status !== 'overdue') {
        invoice.status = 'overdue';
        changed = true;
      }
      if (!invoice.currency) {
        invoice.currency = state.settings.currency || 'USD';
        changed = true;
      }
    });

    state.meta = {
      ...(state.meta || {}),
      schemaVersion: 2,
      lastCalculatedAt: isoNow()
    };
    normalizing = false;
    return changed;
  }

  saveState = function persistDynamicWorkspace() {
    syncDerivedState();
    baseSaveState();
    const flush = window.FormcraftBackend?.flush;
    persistPromise = typeof flush === 'function'
      ? Promise.resolve(flush()).catch(error => {
          toast(error.message || 'Workspace sync failed.', 'error');
          throw error;
        })
      : Promise.resolve();
    return persistPromise;
  };

  function memberOptions(includeUnassigned = true) {
    const options = includeUnassigned ? [['', 'Unassigned']] : [];
    return options.concat(state.team.filter(member => !member.pending).map(member => [member.id, member.name]));
  }

  function projectOptions(includeUnassigned = true) {
    const options = includeUnassigned ? [['', 'No project']] : [];
    return options.concat(state.projects.map(project => [project.id, project.name]));
  }

  openProjectForm = function openDynamicProjectForm(project = null) {
    const data = project || {
      name: '', client: '', ownerId: userId(), status: state.settings.defaultStatus || 'active',
      startDate: dateKey(today()), dueDate: dateKey(addDays(30)), progressMode: 'automatic', progress: 0, description: ''
    };

    openFormModal(project ? 'Edit project' : 'Create project', 'Define the owner, schedule, status, and delivery scope.', `
      <div class="field-grid">
        ${field('Project name', 'name', data.name, { required: true, span: true, maxlength: 100 })}
        ${field('Client or team', 'client', data.client, { required: true, maxlength: 80 })}
        ${customSelectField('Owner', 'ownerId', memberOptions(), data.ownerId)}
        ${selectField('Status', 'status', ['planning', 'active', 'review', 'completed'], data.status, { required: true })}
        ${field('Start date', 'startDate', data.startDate || dateKey(today()), { type: 'date', required: true })}
        ${field('Due date', 'dueDate', data.dueDate, { type: 'date', required: true })}
        ${customSelectField('Progress calculation', 'progressMode', [['automatic', 'Automatic from tasks'], ['manual', 'Manual percentage']], data.progressMode || 'automatic', { hint: 'Automatic progress updates whenever linked tasks change.' })}
        ${field('Manual progress', 'progress', data.progress || 0, { type: 'number', min: 0, max: 100, step: 1, hint: 'Used only when progress calculation is manual.' })}
        ${field('Description', 'description', data.description, { textarea: true, span: true, required: true, maxlength: 500, placeholder: 'Describe the outcome, scope, and constraints.' })}
      </div>`, async form => {
        const values = formValues(form);
        const now = isoNow();
        const record = {
          ...values,
          ownerId: values.ownerId || '',
          progress: Number(values.progress || 0),
          updatedAt: now
        };
        if (project) Object.assign(project, record);
        else state.projects.push({ ...record, id: uid(), createdAt: now });
        logActivity('project', project ? 'Project updated' : 'Project created', values.name);
        await saveState();
        closeModal();
        renderShell();
        toast(project ? 'Project updated.' : 'Project created.');
      });
  };

  openTaskForm = function openDynamicTaskForm(task = null) {
    const data = task || {
      title: '', projectId: state.projects[0]?.id || '', assigneeId: userId(), priority: 'medium',
      status: 'todo', dueDate: dateKey(addDays(7)), description: ''
    };

    openFormModal(task ? 'Edit task' : 'Create task', 'Add enough context that someone else can complete the work without guessing.', `
      <div class="field-grid">
        ${field('Task title', 'title', data.title, { required: true, span: true, maxlength: 140 })}
        ${customSelectField('Project', 'projectId', projectOptions(), data.projectId)}
        ${customSelectField('Assignee', 'assigneeId', memberOptions(), data.assigneeId)}
        ${selectField('Priority', 'priority', ['low', 'medium', 'high'], data.priority, { required: true })}
        ${selectField('Status', 'status', ['todo', 'progress', 'done'], data.status, { required: true })}
        ${field('Due date', 'dueDate', data.dueDate, { type: 'date', required: true })}
        ${field('Description', 'description', data.description || '', { textarea: true, span: true, maxlength: 600, placeholder: 'Add acceptance criteria, links, or implementation notes.' })}
      </div>`, async form => {
        const values = formValues(form);
        const now = isoNow();
        const wasDone = task?.status === 'done';
        const record = {
          ...values,
          projectId: values.projectId || '',
          assigneeId: values.assigneeId || '',
          updatedAt: now,
          completedAt: values.status === 'done' ? (wasDone ? task.completedAt || now : now) : null
        };
        if (task) Object.assign(task, record);
        else state.tasks.push({ ...record, id: uid(), createdAt: now });
        logActivity('task', task ? 'Task updated' : 'Task created', values.title);
        await saveState();
        closeModal();
        renderShell();
        toast(task ? 'Task updated.' : 'Task created.');
      });
  };

  openEventForm = function openDynamicEventForm(event = null, presetDate = null) {
    const data = event || {
      title: '', date: presetDate || dateKey(today()), time: '09:00', category: 'meeting',
      projectId: '', location: '', notes: ''
    };

    openFormModal(event ? 'Edit event' : 'Create event', 'Schedule a real workspace event and optionally connect it to a project.', `
      <div class="field-grid">
        ${field('Event title', 'title', data.title, { required: true, span: true, maxlength: 120 })}
        ${field('Date', 'date', data.date, { type: 'date', required: true })}
        ${field('Time', 'time', data.time, { type: 'time', required: true })}
        ${selectField('Category', 'category', ['meeting', 'review', 'deadline', 'personal'], data.category, { required: true })}
        ${customSelectField('Related project', 'projectId', projectOptions(), data.projectId)}
        ${field('Location or link', 'location', data.location || '', { maxlength: 200 })}
        ${field('Notes', 'notes', data.notes, { textarea: true, span: true, maxlength: 600, placeholder: 'Add an agenda or preparation notes.' })}
      </div>`, async form => {
        const values = formValues(form);
        const record = { ...values, projectId: values.projectId || '', updatedAt: isoNow() };
        if (event) Object.assign(event, record);
        else state.events.push({ ...record, id: uid(), createdAt: isoNow() });
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

  openInvoiceForm = function openDynamicInvoiceForm(invoice = null) {
    const nextNumber = `FC-${new Date().getFullYear()}-${String(state.invoices.length + 1).padStart(4, '0')}`;
    const data = invoice || {
      number: nextNumber, projectId: '', client: '', email: '', amount: '', status: 'draft',
      issueDate: dateKey(today()), dueDate: dateKey(addDays(14)), notes: ''
    };

    openFormModal(invoice ? 'Edit invoice' : 'Create invoice', 'Record billing details using the workspace currency.', `
      <div class="field-grid">
        ${field('Invoice number', 'number', data.number, { required: true, maxlength: 40 })}
        ${selectField('Status', 'status', ['draft', 'sent', 'paid', 'overdue', 'void'], data.status, { required: true })}
        ${customSelectField('Related project', 'projectId', projectOptions(), data.projectId)}
        ${field('Client', 'client', data.client, { required: true, maxlength: 100 })}
        ${field('Billing email', 'email', data.email, { type: 'email', required: true, autocomplete: 'email' })}
        ${field(`Amount (${state.settings.currency || 'USD'})`, 'amount', data.amount, { type: 'number', required: true, min: 0, step: '.01' })}
        ${field('Issue date', 'issueDate', data.issueDate || dateKey(today()), { type: 'date', required: true })}
        ${field('Due date', 'dueDate', data.dueDate, { type: 'date', required: true })}
        ${field('Notes', 'notes', data.notes, { textarea: true, span: true, maxlength: 600, placeholder: 'Add payment terms or internal notes.' })}
      </div>`, async form => {
        const values = formValues(form);
        const record = {
          ...values,
          projectId: values.projectId || '',
          amount: Number(values.amount),
          currency: state.settings.currency || 'USD',
          updatedAt: isoNow()
        };
        if (invoice) Object.assign(invoice, record);
        else state.invoices.push({ ...record, id: uid(), createdAt: isoNow() });
        logActivity('invoice', invoice ? 'Invoice updated' : 'Invoice created', values.number);
        await saveState();
        closeModal();
        renderShell();
        toast(invoice ? 'Invoice updated.' : 'Invoice created.');
      });
  };

  openInvoiceDetail = function openDynamicInvoiceDetail(invoice) {
    if (!invoice) return;
    openModal(`<div class="modal-card detail-modal">
      <div class="modal-head"><div><p class="modal-eyebrow">Invoice</p><h2 id="modal-title">${escapeHtml(invoice.number)}</h2><p>${escapeHtml(invoice.client)}</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div>
      <div class="modal-body"><div class="summary-grid"><div class="summary-card"><strong>${money(invoice.amount)}</strong><span>Amount · ${escapeHtml(invoice.currency || state.settings.currency || 'USD')}</span></div><div class="summary-card"><strong>${titleCase(invoice.status)}</strong><span>Status</span></div><div class="summary-card"><strong>${formatShortDate(invoice.dueDate)}</strong><span>Due date</span></div><div class="summary-card"><strong>${escapeHtml(invoice.email)}</strong><span>Billing contact</span></div></div><p>${escapeHtml(invoice.notes || 'No notes.')}</p></div>
      <div class="modal-actions"><div></div><div class="modal-actions-trailing"><button class="button button-secondary" type="button" data-print-invoice>${icon('download', 16)}Print</button><button class="button button-primary" type="button" data-modal-edit-invoice>Edit invoice</button></div></div>
    </div>`);
    $('[data-modal-edit-invoice]', modal)?.addEventListener('click', () => { closeModal(); openInvoiceForm(invoice); });
    $('[data-print-invoice]', modal)?.addEventListener('click', () => window.print());
  };

  toggleTask = function toggleDynamicTask(id, completed) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;
    task.status = completed ? 'done' : 'todo';
    task.completedAt = completed ? isoNow() : null;
    task.updatedAt = isoNow();
    logActivity('task', completed ? 'Task completed' : 'Task reopened', task.title);
    saveState().finally(() => {
      renderShell();
      toast('Task updated.');
    });
  };

  function isWorkspaceEmpty() {
    return !state.projects.length && !state.tasks.length && !state.events.length && !state.messages.length && !state.files.length && !state.invoices.length;
  }

  function createStarterWorkspace() {
    const now = isoNow();
    const current = dateKey(today());
    const projectId = uid();
    const taskIds = [uid(), uid(), uid(), uid()];

    state.projects.push({
      id: projectId,
      name: 'Formcraft setup',
      client: 'Internal workspace',
      ownerId: userId(),
      status: 'active',
      startDate: current,
      dueDate: dateKey(addDays(14)),
      progressMode: 'automatic',
      progress: 25,
      description: 'A starter project for configuring the workspace, testing workflows, and replacing examples with real work.',
      createdAt: now,
      updatedAt: now
    });

    state.tasks.push(
      { id: taskIds[0], title: 'Review workspace settings', projectId, assigneeId: userId(), priority: 'high', status: 'done', dueDate: current, description: 'Set the workspace name, description, currency, and notification preferences.', createdAt: now, updatedAt: now, completedAt: now },
      { id: taskIds[1], title: 'Create the first real project', projectId, assigneeId: userId(), priority: 'high', status: 'progress', dueDate: dateKey(addDays(2)), description: 'Replace this starter record with an active delivery project.', createdAt: now, updatedAt: now, completedAt: null },
      { id: taskIds[2], title: 'Invite a collaborator', projectId, assigneeId: userId(), priority: 'medium', status: 'todo', dueDate: dateKey(addDays(5)), description: 'Test workspace roles and the invitation flow.', createdAt: now, updatedAt: now, completedAt: null },
      { id: taskIds[3], title: 'Test calendar and invoice workflows', projectId, assigneeId: userId(), priority: 'low', status: 'todo', dueDate: dateKey(addDays(7)), description: 'Create, edit, and delete records to verify persistence.', createdAt: now, updatedAt: now, completedAt: null }
    );

    state.events.push({
      id: uid(), title: 'Formcraft workflow review', date: dateKey(addDays(7)), time: '10:00', category: 'review',
      projectId, location: '', notes: 'Review projects, tasks, calendar, files, and billing before adding production data.', createdAt: now, updatedAt: now
    });

    state.messages.push({
      id: uid(), folder: 'inbox', from: 'Formcraft', to: userEmail(), subject: 'Your workspace is ready',
      body: 'This starter content is editable and exists only to demonstrate live data flow. Replace or delete it whenever you are ready.',
      date: now, unread: true, starred: false, attachments: [], attachmentPaths: []
    });

    state.invoices.push({
      id: uid(), number: `SAMPLE-${new Date().getFullYear()}-001`, projectId, client: 'Sample client', email: userEmail(),
      amount: 0, currency: state.settings.currency || 'USD', status: 'draft', issueDate: current, dueDate: dateKey(addDays(14)),
      notes: 'Sample draft. Replace it with a real invoice or delete it.', createdAt: now, updatedAt: now
    });

    logActivity('system', 'Starter workspace created', 'Editable onboarding records were added.');
  }

  function mountEmptyWorkspaceGuide() {
    if (ui.route !== 'dashboard' || !isWorkspaceEmpty() || $('[data-starter-workspace]')) return;
    const dashboard = $('.dashboard-content');
    if (!dashboard) return;
    dashboard.insertAdjacentHTML('afterbegin', `<section class="workspace-onboarding" data-starter-workspace>
      <div class="workspace-onboarding-copy"><span class="workspace-onboarding-icon">${icon('projects', 22)}</span><div><p class="panel-kicker">Empty workspace</p><h2>Start with live, editable records</h2><p>Your account is connected, but this workspace has no operational data yet. Add a small starter set to verify that create, edit, delete, dashboard metrics, and Supabase sync all work.</p></div></div>
      <div class="workspace-onboarding-actions"><button class="button button-secondary" type="button" data-context-create>${icon('plus', 17)}Create project</button><button class="button button-primary" type="button" data-add-starter-data>${icon('check', 17)}Add starter data</button></div>
    </section>`);

    $('[data-add-starter-data]')?.addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      event.currentTarget.textContent = 'Adding data…';
      createStarterWorkspace();
      await saveState();
      renderShell();
      toast('Starter workspace added. Every record is editable.');
    });
    $('[data-starter-workspace] [data-context-create]')?.addEventListener('click', openProjectForm);
  }

  function updateSyncIndicator() {
    const indicator = $('[data-sync-state]');
    if (!indicator) return;
    const mode = document.documentElement.dataset.backend;
    const labels = {
      loading: 'Loading…', saving: 'Saving…', ready: 'Saved', offline: 'Offline', conflict: 'Refreshing…', error: 'Sync error'
    };
    indicator.textContent = labels[mode] || 'Saved';
    indicator.dataset.state = mode || 'ready';
  }

  bindShell = function bindFormcraftV2() {
    baseBindShell();
    const changed = syncDerivedState();
    mountEmptyWorkspaceGuide();
    updateSyncIndicator();
    if (changed && window.FormcraftBackend?.workspace) saveState();
  };

  const backendObserver = new MutationObserver(updateSyncIndicator);
  backendObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-backend'] });

  window.FormcraftV2 = Object.freeze({
    sync: saveState,
    addStarterData: async () => {
      if (!isWorkspaceEmpty()) return false;
      createStarterWorkspace();
      await saveState();
      renderShell();
      return true;
    }
  });
})();
