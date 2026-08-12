'use strict';

(() => {
  const C = window.FormcraftOpsCore;
  const V = window.FormcraftOpsViews;
  if (!C || !V) throw new Error('Integrated operations core and views are required.');

  const {
    previous,
    record,
    arr,
    num,
    round,
    now,
    currentUserId,
    canEdit,
    normalizeStatus,
    normalizePriority,
    statusLabel,
    memberName,
    ensure,
    syncAll,
    metrics,
    canLinkDependency,
    openRecord,
    closeRecord
  } = C;
  const { openTaskDetail } = V;

  const requireEdit = () => {
    if (canEdit()) return true;
    toast('You have read-only access to this workspace.', 'warning');
    return false;
  };

  function taskById(id) {
    return state.tasks.find(item => item.id === id) || null;
  }

  function openQuickForm(task, title, copy, fields, commit) {
    if (!task || !requireEdit()) return;
    openFormModal(title, copy, fields, async form => {
      await commit(form);
      syncAll();
      await Promise.resolve(saveState());
      closeModal();
      renderShell();
    });
  }

  function addComment(task) {
    openQuickForm(task, 'Add comment', 'Record an update, decision, question, or handoff.', `<div class="field-grid">${field('Comment', 'body', '', { textarea: true, span: true, required: true, maxlength: 2000 })}</div>`, form => {
      const body = String(form.elements.body.value || '').trim();
      if (!body) throw new Error('Enter a comment.');
      task.comments.push({ id: uid(), body, author: currentUserName(), userId: currentUserId(), createdAt: now() });
      task.updatedAt = now();
      logActivity('task', 'Comment added', `${task.key} · ${body.slice(0, 120)}`, { projectId: task.projectId, taskId: task.id });
      toast('Comment added.');
    });
  }

  function logTime(task) {
    openQuickForm(task, 'Log time', 'Time updates project capacity, profitability, and billable-hours reporting.', `<div class="field-grid">${field('Date', 'date', dateKey(today()), { type: 'date', required: true })}${field('Hours', 'hours', '', { type: 'number', min: .25, max: 24, step: '.25', required: true })}${field('Work description', 'description', '', { textarea: true, span: true, required: true, maxlength: 500 })}<label class="setting-row nepal-inline-check span-2"><span class="setting-copy"><strong>Billable time</strong><p>Include this entry in project billable hours.</p></span><span class="switch"><input type="checkbox" name="billable" ${task.billable ? 'checked' : ''}><span class="switch-track"></span></span></label></div>`, form => {
      const values = formValues(form);
      const hours = num(values.hours);
      if (hours <= 0 || hours > 24) throw new Error('Enter hours between 0.25 and 24.');
      state.timeEntries.unshift({ id: uid(), projectId: task.projectId, taskId: task.id, userId: currentUserId(), date: values.date, hours: round(hours), description: values.description, billable: Boolean(form.elements.billable?.checked), createdAt: now() });
      task.updatedAt = now();
      logActivity('time', 'Time logged', `${task.key} · ${round(hours)}h`, { projectId: task.projectId, taskId: task.id });
      toast('Time logged.');
    });
  }

  function addDependency(task) {
    if (!task || !requireEdit()) return;
    const options = state.tasks.filter(item => item.id !== task.id && item.projectId === task.projectId).filter(item => !task.dependencyIds.includes(item.id) && canLinkDependency(task.id, item.id)).map(item => [item.id, `${item.key} · ${item.title}`]);
    if (!options.length) return toast('No valid project tasks are available to link.', 'warning');
    openQuickForm(task, 'Link dependency', 'Select work that must be completed or coordinated first.', `<div class="field-grid">${customSelectField('Depends on', 'dependencyId', options, options[0][0])}</div>`, form => {
      const id = form.elements.dependencyId.value;
      if (!canLinkDependency(task.id, id)) throw new Error('That dependency would create a circular link.');
      if (id && !task.dependencyIds.includes(id)) task.dependencyIds.push(id);
      task.updatedAt = now();
      logActivity('task', 'Dependency linked', `${task.key} depends on ${taskById(id)?.key || 'another task'}`, { projectId: task.projectId, taskId: task.id });
      toast('Dependency linked.');
    });
  }

  function addChecklist(task) {
    openQuickForm(task, 'Add checklist item', 'Use checklist items for small steps that do not need a separate assignee.', `<div class="field-grid">${field('Checklist item', 'text', '', { required: true, span: true, maxlength: 300 })}</div>`, form => {
      const text = String(form.elements.text.value || '').trim();
      if (!text) throw new Error('Enter a checklist item.');
      task.checklist.push({ id: uid(), text, done: false });
      task.updatedAt = now();
      logActivity('task', 'Checklist item added', task.key, { projectId: task.projectId, taskId: task.id });
      toast('Checklist item added.');
    });
  }

  function removeTask(task) {
    if (!task || !requireEdit()) return;
    confirmAction('Delete task?', `Delete ${task.key} · ${task.title}? Subtasks will be detached, not deleted.`, async () => {
      state.tasks.forEach(item => {
        if (item.parentTaskId === task.id) item.parentTaskId = '';
        item.dependencyIds = arr(item.dependencyIds).filter(id => id !== task.id);
      });
      state.tasks = state.tasks.filter(item => item.id !== task.id);
      state.timeEntries = state.timeEntries.filter(entry => entry.taskId !== task.id);
      syncAll();
      logActivity('task', 'Task deleted', `${task.key} · ${task.title}`, { projectId: task.projectId, taskId: task.id });
      await Promise.resolve(saveState());
      closeModal();
      if (record.type === 'task' && record.id === task.id) closeRecord({ replace: true });
      else renderShell();
      toast('Task deleted.', 'warning');
    });
  }

  function removeChecklist(taskId, checkId) {
    if (!requireEdit()) return;
    const task = taskById(taskId);
    if (!task) return;
    task.checklist = task.checklist.filter(item => item.id !== checkId);
    task.updatedAt = now();
    logActivity('task', 'Checklist item removed', task.key, { projectId: task.projectId, taskId: task.id });
    saveState();
    renderShell();
  }

  function removeDependency(taskId, dependencyId) {
    if (!requireEdit()) return;
    const task = taskById(taskId);
    if (!task) return;
    task.dependencyIds = task.dependencyIds.filter(id => id !== dependencyId);
    task.updatedAt = now();
    logActivity('task', 'Dependency unlinked', `${task.key} · ${taskById(dependencyId)?.key || 'task'}`, { projectId: task.projectId, taskId: task.id });
    saveState();
    renderShell();
  }

  function removeTimeEntry(entryId, taskId) {
    if (!requireEdit()) return;
    const entry = state.timeEntries.find(item => item.id === entryId);
    const task = taskById(taskId || entry?.taskId);
    if (!entry || !task) return;
    confirmAction('Delete time entry?', `Remove ${entry.hours}h from ${task.key}?`, async () => {
      state.timeEntries = state.timeEntries.filter(item => item.id !== entryId);
      task.updatedAt = now();
      syncAll();
      logActivity('time', 'Time entry deleted', `${task.key} · ${entry.hours}h`, { projectId: task.projectId, taskId: task.id });
      await Promise.resolve(saveState());
      closeModal();
      renderShell();
      toast('Time entry deleted.', 'warning');
    });
  }

  function createInvoice(project) {
    if (!project || !requireEdit()) return;
    openInvoiceForm(null, { projectId: project.id, client: project.client });
  }

  openInvoiceForm = function openOperationsInvoiceForm(invoice = null, preset = null) {
    ensure();
    const before = new Set(state.invoices.map(item => item.id));
    const initialProjectId = invoice?.projectId || preset?.projectId || '';
    previous.openInvoiceForm(invoice, preset);
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
        submitted = true;
        projectId = form.elements.opsProjectId?.value || '';
        if (invoice) invoice.projectId = projectId;
      }, true);
      modal.addEventListener('close', () => {
        if (!submitted) return;
        requestAnimationFrame(() => {
          const created = invoice || state.invoices.find(item => !before.has(item.id));
          if (!created) return;
          created.projectId = projectId;
          logActivity('invoice', 'Invoice linked to project', created.number || 'Invoice', { projectId, invoiceId: created.id });
          Promise.resolve(saveState()).catch(() => toast('Invoice was saved, but the project link needs to retry syncing.', 'warning'));
          renderShell();
        });
      }, { once: true });
    });
  };

  function createEvent(project) {
    if (!project || !requireEdit()) return;
    previous.openEventForm(null);
    requestAnimationFrame(() => {
      const form = modal.querySelector('[data-modal-form], form');
      if (form?.elements.projectId) form.elements.projectId.value = project.id;
    });
  }

  toggleTask = function toggleOperationsTask(id, completed) {
    if (!requireEdit()) return;
    const task = taskById(id);
    if (!task) return;
    const previousStatus = task.status;
    task.status = completed ? 'done' : 'todo';
    task.completedAt = completed ? (task.completedAt || now()) : null;
    task.updatedAt = now();
    syncAll();
    logActivity('task', completed ? 'Task completed' : 'Task reopened', `${task.key} · ${task.title}`, { projectId: task.projectId, taskId: task.id });
    Promise.resolve(saveState()).catch(() => toast('The task changed locally and will retry syncing.', 'warning'));
    renderShell();
    if (previousStatus !== task.status) toast(completed ? 'Task completed.' : 'Task reopened.');
  };

  function changeTaskStatus(task, nextStatus, source = 'Task status changed') {
    if (!task || !requireEdit()) return;
    const previousStatus = task.status;
    const normalized = normalizeStatus(nextStatus);
    if (previousStatus === normalized) return;
    task.status = normalized;
    task.completedAt = normalized === 'done' ? (task.completedAt || now()) : null;
    task.updatedAt = now();
    syncAll();
    logActivity('task', source, `${task.key}: ${statusLabel(previousStatus)} → ${statusLabel(normalized)}`, { projectId: task.projectId, taskId: task.id });
    Promise.resolve(saveState()).catch(() => toast('The status changed locally and will retry syncing.', 'warning'));
    renderShell();
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const close = target.closest('[data-ops-close-record]');
    if (close) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeRecord();
      return;
    }
    const projectLink = target.closest('[data-view-project]');
    if (projectLink) {
      const project = state.projects.find(item => item.id === projectLink.dataset.viewProject);
      if (project) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openRecord('project', project.id);
      }
      return;
    }
    const taskLink = target.closest('[data-ops-open-task]');
    if (taskLink) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openTaskDetail(taskById(taskLink.dataset.opsOpenTask));
      return;
    }
    const taskFilter = target.closest('[data-task-filter]');
    if (taskFilter) {
      event.preventDefault();
      event.stopImmediatePropagation();
      ui.taskFilter = taskFilter.dataset.taskFilter;
      state.settings.operations.globalTaskStatus = ui.taskFilter === 'all' ? 'all' : ui.taskFilter;
      saveState();
      renderShell();
      return;
    }
    const tab = target.closest('[data-ops-project-tab]');
    if (tab) {
      record.projectTab = tab.dataset.opsProjectTab;
      renderShell();
      return;
    }
    const projectView = target.closest('[data-ops-project-task-view]');
    if (projectView) {
      record.taskView = projectView.dataset.opsProjectTaskView;
      renderShell();
      return;
    }
    const globalView = target.closest('[data-ops-global-task-view]');
    if (globalView) {
      state.settings.operations.globalTaskView = globalView.dataset.opsGlobalTaskView;
      saveState();
      renderShell();
      return;
    }
    const editProject = target.closest('[data-detail-edit-project]');
    if (editProject && record.type === 'project') {
      openProjectForm(state.projects.find(item => item.id === record.id));
      return;
    }
    const editTask = target.closest('[data-ops-edit-task], [data-edit-task]');
    if (editTask) {
      const id = editTask.dataset.opsEditTask || editTask.dataset.editTask;
      const task = taskById(id);
      if (task) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openTaskForm(task);
      }
      return;
    }
    const newTask = target.closest('[data-ops-new-task]');
    if (newTask) {
      const id = newTask.dataset.opsNewTask;
      openTaskForm({ projectId: id, __returnType: 'project', __returnId: id });
      return;
    }
    const milestone = target.closest('[data-ops-new-milestone]');
    if (milestone) {
      const id = milestone.dataset.opsNewMilestone;
      openTaskForm({ projectId: id, issueType: 'milestone', __returnType: 'project', __returnId: id });
      return;
    }
    const subtask = target.closest('[data-ops-add-subtask]');
    if (subtask) {
      const parent = taskById(subtask.dataset.opsAddSubtask);
      if (parent) openTaskForm({ projectId: parent.projectId, parentTaskId: parent.id, __returnType: 'task', __returnId: parent.id });
      return;
    }
    const comment = target.closest('[data-ops-add-comment]');
    if (comment) return addComment(taskById(comment.dataset.opsAddComment));
    const time = target.closest('[data-ops-log-time]');
    if (time) return logTime(taskById(time.dataset.opsLogTime));
    const dependency = target.closest('[data-ops-add-dependency]');
    if (dependency) return addDependency(taskById(dependency.dataset.opsAddDependency));
    const checklist = target.closest('[data-ops-add-checklist]');
    if (checklist) return addChecklist(taskById(checklist.dataset.opsAddChecklist));
    const removeCheck = target.closest('[data-ops-remove-checklist]');
    if (removeCheck) return removeChecklist(removeCheck.dataset.opsRemoveChecklist, removeCheck.dataset.checkId);
    const removeDependencyButton = target.closest('[data-ops-remove-dependency]');
    if (removeDependencyButton) return removeDependency(removeDependencyButton.dataset.opsRemoveDependency, removeDependencyButton.dataset.dependencyId);
    const removeTime = target.closest('[data-ops-remove-time]');
    if (removeTime) return removeTimeEntry(removeTime.dataset.opsRemoveTime, removeTime.dataset.taskId);
    const back = target.closest('[data-ops-back-project]');
    if (back) {
      const project = state.projects.find(item => item.id === back.dataset.opsBackProject);
      if (project) openRecord('project', project.id);
      else closeRecord();
      return;
    }
    const invoiceCreate = target.closest('[data-ops-create-invoice]');
    if (invoiceCreate) {
      createInvoice(state.projects.find(item => item.id === invoiceCreate.dataset.opsCreateInvoice));
      return;
    }
    const eventCreate = target.closest('[data-ops-create-event]');
    if (eventCreate) {
      createEvent(state.projects.find(item => item.id === eventCreate.dataset.opsCreateEvent));
      return;
    }
    const invoiceLink = target.closest('[data-ops-open-invoice]');
    if (invoiceLink) {
      openInvoiceDetail(state.invoices.find(item => item.id === invoiceLink.dataset.opsOpenInvoice));
      return;
    }
    const eventLink = target.closest('[data-ops-open-event]');
    if (eventLink) {
      previous.openEventForm(state.events.find(item => item.id === eventLink.dataset.opsOpenEvent));
      return;
    }
    const fileLink = target.closest('[data-ops-open-file]');
    if (fileLink) {
      navigate('files');
      requestAnimationFrame(() => document.querySelector(`[data-open-file="${CSS.escape(fileLink.dataset.opsOpenFile)}"]`)?.click());
      return;
    }
    const remove = target.closest('[data-delete-task]');
    if (remove) {
      const task = taskById(remove.dataset.deleteTask);
      if (task) {
        event.preventDefault();
        event.stopImmediatePropagation();
        removeTask(task);
      }
    }
  }, true);

  document.addEventListener('input', event => {
    if (!(event.target instanceof Element) || !event.target.matches('[data-ops-project-task-search]')) return;
    record.query = event.target.value;
    renderShell();
    requestAnimationFrame(() => {
      const input = document.querySelector('[data-ops-project-task-search]');
      input?.focus();
      input?.setSelectionRange(record.query.length, record.query.length);
    });
  });

  document.addEventListener('change', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const completion = target.closest('[data-toggle-task]');
    if (completion) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleTask(completion.dataset.toggleTask, completion.checked);
      return;
    }
    if (target.matches('[data-ops-project-task-status]')) {
      record.status = target.value;
      renderShell();
      return;
    }
    if (target.matches('[data-ops-project-task-assignee]')) {
      record.assignee = target.value;
      renderShell();
      return;
    }
    for (const [selector, key] of [['[data-ops-global-project]', 'globalTaskProject'], ['[data-ops-global-status]', 'globalTaskStatus'], ['[data-ops-global-assignee]', 'globalTaskAssignee']]) {
      if (target.matches(selector)) {
        state.settings.operations[key] = target.value;
        saveState();
        renderShell();
        return;
      }
    }
    const status = target.closest('[data-ops-task-status]');
    if (status) {
      changeTaskStatus(taskById(status.dataset.opsTaskStatus), status.value);
      return;
    }
    const assignee = target.closest('[data-ops-task-assignee]');
    if (assignee) {
      if (!requireEdit()) return;
      const task = taskById(assignee.dataset.opsTaskAssignee);
      if (!task) return;
      task.assigneeId = assignee.value;
      task.updatedAt = now();
      logActivity('task', 'Task reassigned', `${task.key} → ${memberName(task.assigneeId)}`, { projectId: task.projectId, taskId: task.id });
      saveState();
      renderShell();
      return;
    }
    const priority = target.closest('[data-ops-task-priority]');
    if (priority) {
      if (!requireEdit()) return;
      const task = taskById(priority.dataset.opsTaskPriority);
      if (!task) return;
      task.priority = normalizePriority(priority.value);
      task.updatedAt = now();
      logActivity('task', 'Task priority changed', `${task.key} → ${task.priority}`, { projectId: task.projectId, taskId: task.id });
      saveState();
      renderShell();
      return;
    }
    const check = target.closest('[data-ops-toggle-checklist]');
    if (check) {
      if (!requireEdit()) return;
      const task = taskById(check.dataset.opsToggleChecklist);
      const item = task?.checklist.find(value => value.id === check.dataset.checkId);
      if (!item) return;
      item.done = check.checked;
      task.updatedAt = now();
      logActivity('task', 'Checklist updated', task.key, { projectId: task.projectId, taskId: task.id });
      saveState();
      renderShell();
    }
  }, true);

  document.addEventListener('dragstart', event => {
    const card = event.target instanceof Element ? event.target.closest('[data-ops-drag-task]') : null;
    if (!card || !canEdit() || !event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', card.dataset.opsDragTask);
    card.classList.add('is-dragging');
  });
  document.addEventListener('dragend', event => {
    const card = event.target instanceof Element ? event.target.closest('[data-ops-drag-task]') : null;
    card?.classList.remove('is-dragging');
    document.querySelectorAll('.ops-task-column.is-drop-target').forEach(column => column.classList.remove('is-drop-target'));
  });
  document.addEventListener('dragover', event => {
    const column = event.target instanceof Element ? event.target.closest('[data-ops-drop-status]') : null;
    if (!column || !canEdit()) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    column.classList.add('is-drop-target');
  });
  document.addEventListener('dragleave', event => {
    const column = event.target instanceof Element ? event.target.closest('[data-ops-drop-status]') : null;
    if (!column || column.contains(event.relatedTarget)) return;
    column.classList.remove('is-drop-target');
  });
  document.addEventListener('drop', event => {
    const column = event.target instanceof Element ? event.target.closest('[data-ops-drop-status]') : null;
    if (!column || !canEdit() || !event.dataTransfer) return;
    event.preventDefault();
    const task = taskById(event.dataTransfer.getData('text/plain'));
    column.classList.remove('is-drop-target');
    if (task) changeTaskStatus(task, column.dataset.opsDropStatus, 'Task moved on board');
  });

  ensure();
  window.FormcraftOperations = Object.freeze({
    version: C.VERSION,
    ensureState: ensure,
    metrics,
    health: C.health,
    openProject: project => project && openRecord('project', project.id),
    openTask: openTaskDetail,
    audit: () => {
      const duplicateTaskKeys = state.tasks.map(task => task.key).filter((key, index, values) => values.indexOf(key) !== index);
      const dependencyCycles = state.tasks.filter(task => task.dependencyIds.some(id => !canLinkDependency(task.id, id))).map(task => task.id);
      return {
        projects: state.projects.length,
        tasks: state.tasks.length,
        timeEntries: state.timeEntries.length,
        orphanTasks: state.tasks.filter(task => !state.projects.some(project => project.id === task.projectId)).map(task => task.id),
        duplicateTaskKeys,
        dependencyCycles,
        unlinkedInvoices: state.invoices.filter(invoice => !invoice.projectId).length,
        readiness: duplicateTaskKeys.length || dependencyCycles.length ? 'needs-attention' : 'ready-to-test'
      };
    }
  });
  renderShell();
})();
