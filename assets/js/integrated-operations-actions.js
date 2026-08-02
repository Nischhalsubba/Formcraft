'use strict';

(() => {
  const C = window.FormcraftOpsCore;
  if (!C?.openTaskDetail) throw new Error('Integrated operations views are required.');
  const {
    STATUSES, base, record, arr, num, round, now, currentUserId, canEdit, normalizeStatus, statusLabel,
    memberName, ensure, syncAll, taskHours, metrics, openTaskDetail, rerenderRecord
  } = C;

  function openQuickForm(task, title, copy, fields, commit) {
    closeModal();
    let saved = false;
    openFormModal(title, copy, fields, async form => {
      await commit(form);
      saved = true;
      syncAll();
      await Promise.resolve(saveState());
      closeModal(); renderShell(); requestAnimationFrame(() => openTaskDetail(task));
    });
    modal.addEventListener('close', () => {
      if (!saved) requestAnimationFrame(() => openTaskDetail(task));
    }, { once: true });
  }

  function addComment(task) {
    openQuickForm(task, 'Add comment', 'Record an update, decision, question, or handoff.', `<div class="field-grid">${field('Comment', 'body', '', { textarea: true, span: true, required: true, maxlength: 2000 })}</div>`, form => {
      const body = String(form.elements.body.value || '').trim();
      task.comments.push({ id: uid(), body, author: currentUserName(), userId: currentUserId(), createdAt: now() });
      task.updatedAt = now();
      logActivity('task', 'Comment added', `${task.key} · ${body.slice(0, 120)}`, { projectId: task.projectId, taskId: task.id });
      toast('Comment added.');
    });
  }

  function logTime(task) {
    openQuickForm(task, 'Log time', 'Time updates project capacity, profitability, and billable-hours reporting.', `<div class="field-grid">${field('Date', 'date', dateKey(today()), { type: 'date', required: true })}${field('Hours', 'hours', '', { type: 'number', min: .25, step: '.25', required: true })}${field('Work description', 'description', '', { textarea: true, span: true, required: true, maxlength: 500 })}<label class="setting-row nepal-inline-check span-2"><span class="setting-copy"><strong>Billable time</strong><p>Include this entry in project billable hours.</p></span><span class="switch"><input type="checkbox" name="billable" ${task.billable ? 'checked' : ''}><span class="switch-track"></span></span></label></div>`, form => {
      const values = formValues(form);
      const hours = num(values.hours);
      if (hours <= 0) throw new Error('Enter a positive number of hours.');
      state.timeEntries.unshift({ id: uid(), projectId: task.projectId, taskId: task.id, userId: currentUserId(), date: values.date, hours: round(hours), description: values.description, billable: Boolean(form.elements.billable?.checked), createdAt: now() });
      task.updatedAt = now();
      logActivity('time', 'Time logged', `${task.key} · ${round(hours)}h`, { projectId: task.projectId, taskId: task.id });
      toast('Time logged.');
    });
  }

  function addDependency(task) {
    const options = state.tasks.filter(item => item.id !== task.id && !task.dependencyIds.includes(item.id)).map(item => [item.id, `${item.key} · ${item.title}`]);
    if (!options.length) return toast('No additional tasks are available to link.', 'warning');
    openQuickForm(task, 'Link dependency', 'Select work that must be completed or coordinated first.', `<div class="field-grid">${customSelectField('Depends on', 'dependencyId', options, options[0][0])}</div>`, form => {
      const id = form.elements.dependencyId.value;
      if (id && !task.dependencyIds.includes(id)) task.dependencyIds.push(id);
      task.updatedAt = now();
      logActivity('task', 'Dependency linked', `${task.key} depends on ${state.tasks.find(item => item.id === id)?.key || 'another task'}`, { projectId: task.projectId, taskId: task.id });
      toast('Dependency linked.');
    });
  }

  function addChecklist(task) {
    openQuickForm(task, 'Add checklist item', 'Use checklist items for small steps that do not need a separate assignee.', `<div class="field-grid">${field('Checklist item', 'text', '', { required: true, span: true, maxlength: 300 })}</div>`, form => {
      task.checklist.push({ id: uid(), text: String(form.elements.text.value || '').trim(), done: false });
      task.updatedAt = now();
      logActivity('task', 'Checklist item added', task.key, { projectId: task.projectId, taskId: task.id });
      toast('Checklist item added.');
    });
  }

  function removeTask(task) {
    closeModal();
    confirmAction('Delete task?', `Delete ${task.key} · ${task.title}? Subtasks will be detached, not deleted.`, async () => {
      state.tasks.forEach(item => {
        if (item.parentTaskId === task.id) item.parentTaskId = '';
        item.dependencyIds = arr(item.dependencyIds).filter(id => id !== task.id);
      });
      state.tasks = state.tasks.filter(item => item.id !== task.id);
      state.timeEntries = state.timeEntries.filter(entry => entry.taskId !== task.id);
      syncAll();
      await Promise.resolve(saveState()); closeModal(); renderShell(); toast('Task deleted.', 'warning');
    });
  }

  function createInvoice(project) {
    closeModal(); openInvoiceForm(null, { projectId: project.id, client: project.client });
  }

  openInvoiceForm = function openOpsInvoiceForm(invoice = null, preset = null) {
    ensure();
    const before = new Set(state.invoices.map(item => item.id));
    const initialProjectId = invoice?.projectId || preset?.projectId || '';
    base.openInvoiceForm(invoice, preset);
    requestAnimationFrame(() => {
      const form = modal.querySelector('[data-nepal-invoice-form], [data-modal-form], form');
      if (!form || form.querySelector('[name="opsProjectId"]')) return;
      const grid = form.querySelector('fieldset .field-grid, .field-grid');
      if (!grid) return;
      const label = document.createElement('label');
      label.className = 'field';
      label.innerHTML = `<span>Related project</span><select name="opsProjectId"><option value="">No project</option>${state.projects.map(project => `<option value="${escapeHtml(project.id)}" ${initialProjectId === project.id ? 'selected' : ''}>${escapeHtml(project.code)} · ${escapeHtml(project.name)}</option>`).join('')}</select><span class="field-hint">Connects billing with delivery and profitability reports.</span>`;
      grid.append(label);
      if (preset?.client) {
        const customer = form.elements.customerName || form.elements.client;
        if (customer && !customer.value) customer.value = preset.client;
      }
      let submitted = false;
      let projectId = initialProjectId;
      form.addEventListener('submit', () => {
        submitted = true; projectId = form.elements.opsProjectId?.value || '';
        if (invoice) invoice.projectId = projectId;
      }, true);
      modal.addEventListener('close', () => {
        if (!submitted || invoice) return;
        requestAnimationFrame(() => {
          const created = state.invoices.find(item => !before.has(item.id));
          if (created) { created.projectId = projectId; Promise.resolve(saveState()).catch(() => {}); }
        });
      }, { once: true });
    });
  };

  function createEvent(project) {
    closeModal();
    base.openEventForm(null);
    requestAnimationFrame(() => {
      const form = modal.querySelector('[data-modal-form], form');
      if (form?.elements.projectId) form.elements.projectId.value = project.id;
    });
  }

  toggleTask = function toggleOpsTask(id, completed) {
    const task = state.tasks.find(item => item.id === id);
    if (!task) return;
    const previous = task.status;
    task.status = completed ? 'done' : 'todo';
    task.completedAt = completed ? (task.completedAt || now()) : null;
    task.updatedAt = now();
    syncAll();
    logActivity('task', completed ? 'Task completed' : 'Task reopened', `${task.key} · ${task.title}`, { projectId: task.projectId, taskId: task.id });
    Promise.resolve(saveState()).catch(() => {});
    if (record.type && modal.open) rerenderRecord(); else renderShell();
    if (previous !== task.status) toast(completed ? 'Task completed.' : 'Task reopened.');
  };

  document.addEventListener('click', event => {
    const target = event.target;
    const projectLink = target.closest('[data-view-project]');
    if (projectLink) {
      const project = state.projects.find(item => item.id === projectLink.dataset.viewProject);
      if (project) { event.preventDefault(); event.stopImmediatePropagation(); openProjectDetail(project); }
      return;
    }
    const taskLink = target.closest('[data-ops-open-task]');
    if (taskLink) { event.preventDefault(); event.stopImmediatePropagation(); openTaskDetail(state.tasks.find(item => item.id === taskLink.dataset.opsOpenTask)); return; }
    const taskFilter = target.closest('[data-task-filter]');
    if (taskFilter) {
      event.preventDefault(); event.stopImmediatePropagation();
      ui.taskFilter = taskFilter.dataset.taskFilter;
      state.settings.operations.globalTaskStatus = ui.taskFilter === 'all' ? 'all' : ui.taskFilter;
      saveState(); renderShell(); return;
    }
    const tab = target.closest('[data-ops-project-tab]');
    if (tab) { record.projectTab = tab.dataset.opsProjectTab; rerenderRecord(); return; }
    const projectView = target.closest('[data-ops-project-task-view]');
    if (projectView) { record.taskView = projectView.dataset.opsProjectTaskView; rerenderRecord(); return; }
    const globalView = target.closest('[data-ops-global-task-view]');
    if (globalView) { state.settings.operations.globalTaskView = globalView.dataset.opsGlobalTaskView; saveState(); renderShell(); return; }
    const editProject = target.closest('[data-detail-edit-project]');
    if (editProject && record.type === 'project') { const project = state.projects.find(item => item.id === record.id); closeModal(); openProjectForm(project); return; }
    const editTask = target.closest('[data-ops-edit-task], [data-edit-task]');
    if (editTask) {
      const id = editTask.dataset.opsEditTask || editTask.dataset.editTask;
      const task = state.tasks.find(item => item.id === id);
      if (task) { event.preventDefault(); event.stopImmediatePropagation(); closeModal(); openTaskForm(task); }
      return;
    }
    const newTask = target.closest('[data-ops-new-task]');
    if (newTask) { const id = newTask.dataset.opsNewTask; closeModal(); openTaskForm({ projectId: id, __returnProjectId: id }); return; }
    const milestone = target.closest('[data-ops-new-milestone]');
    if (milestone) { const id = milestone.dataset.opsNewMilestone; closeModal(); openTaskForm({ projectId: id, issueType: 'milestone', __returnProjectId: id }); return; }
    const subtask = target.closest('[data-ops-add-subtask]');
    if (subtask) { const parent = state.tasks.find(item => item.id === subtask.dataset.opsAddSubtask); if (parent) { closeModal(); openTaskForm({ projectId: parent.projectId, parentTaskId: parent.id, __returnProjectId: parent.projectId }); } return; }
    const comment = target.closest('[data-ops-add-comment]');
    if (comment) return addComment(state.tasks.find(item => item.id === comment.dataset.opsAddComment));
    const time = target.closest('[data-ops-log-time]');
    if (time) return logTime(state.tasks.find(item => item.id === time.dataset.opsLogTime));
    const dependency = target.closest('[data-ops-add-dependency]');
    if (dependency) return addDependency(state.tasks.find(item => item.id === dependency.dataset.opsAddDependency));
    const checklist = target.closest('[data-ops-add-checklist]');
    if (checklist) return addChecklist(state.tasks.find(item => item.id === checklist.dataset.opsAddChecklist));
    const back = target.closest('[data-ops-back-project]');
    if (back) { const project = state.projects.find(item => item.id === back.dataset.opsBackProject); return project ? openProjectDetail(project) : closeModal(); }
    const invoiceCreate = target.closest('[data-ops-create-invoice]');
    if (invoiceCreate) { const project = state.projects.find(item => item.id === invoiceCreate.dataset.opsCreateInvoice); if (project) createInvoice(project); return; }
    const eventCreate = target.closest('[data-ops-create-event]');
    if (eventCreate) { const project = state.projects.find(item => item.id === eventCreate.dataset.opsCreateEvent); if (project) createEvent(project); return; }
    const invoiceLink = target.closest('[data-ops-open-invoice]');
    if (invoiceLink) { const invoice = state.invoices.find(item => item.id === invoiceLink.dataset.opsOpenInvoice); closeModal(); openInvoiceDetail(invoice); return; }
    const eventLink = target.closest('[data-ops-open-event]');
    if (eventLink) { const linked = state.events.find(item => item.id === eventLink.dataset.opsOpenEvent); closeModal(); openEventForm(linked); return; }
    const fileLink = target.closest('[data-ops-open-file]');
    if (fileLink) { closeModal(); navigate('files'); requestAnimationFrame(() => document.querySelector(`[data-open-file="${CSS.escape(fileLink.dataset.opsOpenFile)}"]`)?.click()); return; }
    const remove = target.closest('[data-delete-task]');
    if (remove) {
      const task = state.tasks.find(item => item.id === remove.dataset.deleteTask);
      if (task) { event.preventDefault(); event.stopImmediatePropagation(); removeTask(task); }
    }
  }, true);

  document.addEventListener('input', event => {
    if (!event.target.matches('[data-ops-project-task-search]')) return;
    record.query = event.target.value; rerenderRecord();
    requestAnimationFrame(() => { const input = modal.querySelector('[data-ops-project-task-search]'); input?.focus(); input?.setSelectionRange(record.query.length, record.query.length); });
  });

  document.addEventListener('change', event => {
    const completion = event.target.closest('[data-toggle-task]');
    if (completion) { event.preventDefault(); event.stopImmediatePropagation(); toggleTask(completion.dataset.toggleTask, completion.checked); return; }
    if (event.target.matches('[data-ops-project-task-status]')) { record.status = event.target.value; rerenderRecord(); return; }
    if (event.target.matches('[data-ops-project-task-assignee]')) { record.assignee = event.target.value; rerenderRecord(); return; }
    for (const [selector, key] of [['[data-ops-global-project]', 'globalTaskProject'], ['[data-ops-global-status]', 'globalTaskStatus'], ['[data-ops-global-assignee]', 'globalTaskAssignee']]) {
      if (event.target.matches(selector)) { state.settings.operations[key] = event.target.value; saveState(); renderShell(); return; }
    }
    const status = event.target.closest('[data-ops-task-status]');
    if (status) {
      const task = state.tasks.find(item => item.id === status.dataset.opsTaskStatus);
      if (!task) return;
      const previous = task.status; task.status = normalizeStatus(status.value); task.completedAt = task.status === 'done' ? (task.completedAt || now()) : null; task.updatedAt = now();
      syncAll(); logActivity('task', 'Task status changed', `${task.key}: ${statusLabel(previous)} → ${statusLabel(task.status)}`, { projectId: task.projectId, taskId: task.id }); saveState(); rerenderRecord(); return;
    }
    const assignee = event.target.closest('[data-ops-task-assignee]');
    if (assignee) {
      const task = state.tasks.find(item => item.id === assignee.dataset.opsTaskAssignee);
      if (!task) return;
      task.assigneeId = assignee.value; task.updatedAt = now(); logActivity('task', 'Task reassigned', `${task.key} → ${memberName(task.assigneeId)}`, { projectId: task.projectId, taskId: task.id }); saveState(); rerenderRecord(); return;
    }
    const check = event.target.closest('[data-ops-toggle-checklist]');
    if (check) {
      const task = state.tasks.find(item => item.id === check.dataset.opsToggleChecklist);
      const item = task?.checklist.find(value => value.id === check.dataset.checkId);
      if (!item) return;
      item.done = check.checked; task.updatedAt = now(); logActivity('task', 'Checklist updated', task.key, { projectId: task.projectId, taskId: task.id }); saveState(); rerenderRecord();
    }
  }, true);

  renderShell = function renderOpsShell(...args) { ensure(); return base.renderShell.apply(this, args); };
  ensure();
  window.FormcraftOperations = Object.freeze({
    version: C.VERSION, ensureState: ensure, metrics, health: C.health, openTask: openTaskDetail,
    audit: () => ({ projects: state.projects.length, tasks: state.tasks.length, timeEntries: state.timeEntries.length,
      orphanTasks: state.tasks.filter(task => !state.projects.some(project => project.id === task.projectId)).map(task => task.id),
      duplicateTaskKeys: state.tasks.map(task => task.key).filter((key, index, values) => values.indexOf(key) !== index),
      unlinkedInvoices: state.invoices.filter(invoice => !invoice.projectId).length })
  });
})();
