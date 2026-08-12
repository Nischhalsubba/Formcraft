'use strict';

(() => {
  const C = window.FormcraftOpsCore;
  const V = window.FormcraftOpsViews;
  if (!C || !V) throw new Error('Integrated operations core and views are required.');

  const {
    STATUSES,
    PRIORITIES,
    TYPES,
    arr,
    num,
    round,
    now,
    currentUserId,
    canEdit,
    safeCode,
    codeFromName,
    normalizeStatus,
    normalizePriority,
    statusLabel,
    priorityLabel,
    typeLabel,
    nextTaskKey,
    canSetParent,
    syncAll,
    syncProject,
    openRecord
  } = C;
  const { memberOptions, projectOptions, taskOptions } = V;

  const taskById = id => state.tasks.find(task => task.id === id) || null;
  const section = (title, copy, content) => `<fieldset class="bright-form-section"><legend>${escapeHtml(title)}</legend><p class="bright-form-section-copy">${escapeHtml(copy)}</p><div class="field-grid">${content}</div></fieldset>`;

  function requireEdit() {
    if (canEdit()) return true;
    toast('You have read-only access to this workspace.', 'warning');
    return false;
  }

  function showForm(title, copy, body, submitLabel = 'Save') {
    openModal(`<form class="modal-card form-modal" data-modal-form data-ops-deterministic-form novalidate>
      <div class="modal-head"><div><h2 id="modal-title">${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div>
      <div class="modal-body">${body}<p class="field-error ops-form-error" data-ops-form-error aria-live="polite"></p></div>
      <div class="modal-actions"><div class="modal-actions-leading">Changes are saved to the shared workspace.</div><div class="modal-actions-trailing"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">${escapeHtml(submitLabel)}</button></div></div>
    </form>`);
    return modal.querySelector('[data-ops-deterministic-form]');
  }

  function clearFormError(form) {
    form.querySelectorAll('[aria-invalid="true"]').forEach(control => control.removeAttribute('aria-invalid'));
    const error = form.querySelector('[data-ops-form-error]');
    if (error) error.textContent = '';
  }

  function failForm(form, message, control = null) {
    const error = form.querySelector('[data-ops-form-error]');
    if (error) error.textContent = message;
    control?.setAttribute('aria-invalid', 'true');
    control?.focus();
  }

  function setBusy(form, busy, label = 'Save') {
    form.querySelectorAll('button, input, select, textarea').forEach(control => { control.disabled = busy; });
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = busy ? 'Saving…' : label;
  }

  openProjectForm = function openDeterministicProjectForm(project = null) {
    C.ensure();
    if (!requireEdit()) return;
    const existing = Boolean(project?.id && state.projects.some(item => item.id === project.id));
    const data = existing ? project : {
      name: '', code: codeFromName('', state.projects.length), client: '', ownerId: currentUserId(), status: 'planning',
      startDate: dateKey(today()), dueDate: dateKey(addDays(30)), progressMode: 'automatic', progress: 0,
      billingMethod: 'non-billable', budgetAmount: 0, budgetHours: 0, description: ''
    };
    const body = `<div class="bright-form-sections">
      ${section('Project identity', 'Define the outcome, customer, and accountable owner.', `
        ${field('Project name', 'name', data.name, { required: true, span: true, maxlength: 120 })}
        ${field('Project code', 'code', data.code, { required: true, maxlength: 10, hint: 'Used for task keys such as FORM-001.' })}
        ${field('Client or internal team', 'client', data.client, { required: true, maxlength: 100 })}
        ${customSelectField('Owner', 'ownerId', memberOptions(), data.ownerId)}
        ${customSelectField('Project status', 'status', [['planning', 'Planning'], ['active', 'Active'], ['review', 'Review'], ['completed', 'Completed']], data.status)}
      `)}
      ${section('Schedule and delivery', 'Automatic progress uses completed task estimates.', `
        ${field('Start date', 'startDate', data.startDate, { type: 'date', required: true })}
        ${field('Due date', 'dueDate', data.dueDate, { type: 'date', required: true })}
        ${customSelectField('Progress calculation', 'progressMode', [['automatic', 'Automatic from completed tasks'], ['manual', 'Manual percentage']], data.progressMode)}
        ${field('Manual progress', 'progress', data.progress, { type: 'number', min: 0, max: 100, step: 1 })}
      `)}
      ${section('Commercial setup', 'Connect delivery with budgets, time, and billing.', `
        ${customSelectField('Billing method', 'billingMethod', [['non-billable', 'Non-billable'], ['fixed', 'Fixed price'], ['milestone', 'Milestone billing'], ['time-material', 'Time and materials']], data.billingMethod)}
        ${field('Budget amount (NPR)', 'budgetAmount', data.budgetAmount, { type: 'number', min: 0, step: '.01' })}
        ${field('Budget hours', 'budgetHours', data.budgetHours, { type: 'number', min: 0, step: '.25' })}
      `)}
      ${section('Project brief', 'Keep scope, constraints, and success criteria in one source of truth.', `
        ${field('Description', 'description', data.description, { textarea: true, span: true, required: true, maxlength: 4000 })}
      `)}
    </div>`;
    const form = showForm(existing ? 'Edit project' : 'Create project', 'Create one connected record for tasks, schedule, time, files, and billing.', body, existing ? 'Save project' : 'Create project');
    if (!form) return;
    let submitting = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (submitting) return;
      clearFormError(form);
      if (!validateForm(form)) return;
      const values = formValues(form);
      if (values.dueDate < values.startDate) return failForm(form, 'Due date must be on or after the start date.', form.elements.dueDate);
      const code = safeCode(values.code, codeFromName(values.name, state.projects.length));
      if (state.projects.some(item => item.id !== project?.id && item.code === code)) return failForm(form, 'Project code must be unique.', form.elements.code);
      submitting = true;
      setBusy(form, true);
      const snapshot = existing ? structuredClone(project) : null;
      const saved = existing ? project : { id: uid(), createdAt: now() };
      Object.assign(saved, values, {
        code,
        ownerId: values.ownerId || '',
        progress: num(values.progress),
        budgetAmount: num(values.budgetAmount),
        budgetHours: num(values.budgetHours),
        updatedAt: now()
      });
      if (!existing) state.projects.push(saved);
      syncProject(saved);
      logActivity('project', existing ? 'Project updated' : 'Project created', saved.name, { projectId: saved.id });
      try {
        await Promise.resolve(saveState());
        closeModal();
        openRecord('project', saved.id, { replace: true });
        toast(existing ? 'Project updated.' : 'Project created.');
      } catch (error) {
        if (existing) Object.assign(project, snapshot);
        else state.projects = state.projects.filter(item => item.id !== saved.id);
        syncAll();
        submitting = false;
        setBusy(form, false, existing ? 'Save project' : 'Create project');
        failForm(form, error?.message || 'Project could not be saved.');
      }
    }, true);
  };

  openTaskForm = function openDeterministicTaskForm(task = null) {
    C.ensure();
    if (!requireEdit()) return;
    if (!state.projects.length) return toast('Create a project before adding tasks.', 'warning');
    const existing = Boolean(task?.id && state.tasks.some(item => item.id === task.id));
    const preset = task && !existing ? task : {};
    const data = existing ? task : {
      title: '', projectId: preset.projectId || state.projects[0].id, issueType: preset.issueType || 'task',
      parentTaskId: preset.parentTaskId || '', assigneeId: preset.assigneeId || currentUserId(), reporterId: preset.reporterId || currentUserId(),
      priority: preset.priority || 'medium', status: preset.status || 'todo', startDate: preset.startDate || dateKey(today()),
      dueDate: preset.dueDate || dateKey(addDays(7)), estimateHours: preset.estimateHours || 0, storyPoints: preset.storyPoints || 0,
      billable: Boolean(preset.billable), labels: arr(preset.labels), description: preset.description || '', acceptanceCriteria: preset.acceptanceCriteria || ''
    };
    const body = `<div class="bright-form-sections">
      ${section('Issue', 'Use a stable type and summary so work is easy to scan.', `
        ${customSelectField('Issue type', 'issueType', TYPES.map(value => [value, typeLabel(value)]), data.issueType)}
        ${field('Summary', 'title', data.title, { required: true, span: true, maxlength: 180 })}
        ${customSelectField('Project', 'projectId', projectOptions(false), data.projectId)}
        ${customSelectField('Parent task', 'parentTaskId', taskOptions(existing ? task.id : '', data.projectId), data.parentTaskId)}
      `)}
      ${section('Ownership and workflow', 'Status, priority, and ownership stay visible throughout delivery.', `
        ${customSelectField('Assignee', 'assigneeId', memberOptions(), data.assigneeId)}
        ${customSelectField('Reporter', 'reporterId', memberOptions(), data.reporterId)}
        ${customSelectField('Status', 'status', STATUSES.map(value => [value, statusLabel(value)]), data.status)}
        ${customSelectField('Priority', 'priority', PRIORITIES.map(value => [value, priorityLabel(value)]), data.priority)}
      `)}
      ${section('Planning', 'Estimates drive project progress and capacity reporting.', `
        ${field('Start date', 'startDate', data.startDate, { type: 'date', required: true })}
        ${field('Due date', 'dueDate', data.dueDate, { type: 'date', required: true })}
        ${field('Original estimate (hours)', 'estimateHours', data.estimateHours, { type: 'number', min: 0, step: '.25' })}
        ${field('Story points', 'storyPoints', data.storyPoints, { type: 'number', min: 0, step: 1 })}
        <label class="setting-row nepal-inline-check span-2"><span class="setting-copy"><strong>Billable work</strong><p>Logged time contributes to project billing reports.</p></span><span class="switch"><input type="checkbox" name="billable" ${data.billable ? 'checked' : ''}><span class="switch-track"></span></span></label>
      `)}
      ${section('Delivery context', 'The task record is the source of truth for implementation and acceptance.', `
        ${field('Labels', 'labels', arr(data.labels).join(', '), { span: true, maxlength: 300 })}
        ${field('Description', 'description', data.description, { textarea: true, span: true, maxlength: 4000 })}
        ${field('Acceptance criteria', 'acceptanceCriteria', data.acceptanceCriteria, { textarea: true, span: true, maxlength: 4000 })}
      `)}
    </div>`;
    const form = showForm(existing ? `Edit ${data.key}` : 'Create task', 'Create a traceable work item linked to delivery, time, files, and billing.', body, existing ? 'Save task' : 'Create task');
    if (!form) return;
    const parentSelect = form.elements.parentTaskId;
    form.elements.projectId?.addEventListener('change', () => {
      const selected = parentSelect.value;
      parentSelect.innerHTML = taskOptions(existing ? task.id : '', form.elements.projectId.value)
        .map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`)
        .join('');
    });
    let submitting = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (submitting) return;
      clearFormError(form);
      if (!validateForm(form)) return;
      const values = formValues(form);
      if (!values.projectId) return failForm(form, 'Select a project.', form.elements.projectId);
      if (values.dueDate < values.startDate) return failForm(form, 'Due date must be on or after the start date.', form.elements.dueDate);
      const parent = values.parentTaskId ? taskById(values.parentTaskId) : null;
      if (parent && parent.projectId !== values.projectId) return failForm(form, 'A parent task must belong to the same project.', form.elements.parentTaskId);
      if (existing && !canSetParent(task.id, values.parentTaskId)) return failForm(form, 'That parent selection would create a circular hierarchy.', form.elements.parentTaskId);
      submitting = true;
      setBusy(form, true);
      const snapshot = existing ? structuredClone(task) : null;
      const oldProjectId = existing ? task.projectId : '';
      const oldStatus = existing ? task.status : '';
      const saved = existing ? task : { id: uid(), createdAt: now(), dependencyIds: [], checklist: [], comments: [] };
      Object.assign(saved, values, {
        issueType: TYPES.includes(values.issueType) ? values.issueType : 'task',
        status: normalizeStatus(values.status),
        priority: normalizePriority(values.priority),
        assigneeId: values.assigneeId || '',
        reporterId: values.reporterId || '',
        parentTaskId: values.parentTaskId || '',
        estimateHours: num(values.estimateHours),
        storyPoints: num(values.storyPoints),
        billable: Boolean(form.elements.billable?.checked),
        labels: String(values.labels || '').split(',').map(value => value.trim()).filter(Boolean),
        updatedAt: now()
      });
      if (!existing || oldProjectId !== saved.projectId) saved.key = nextTaskKey(saved.projectId);
      saved.completedAt = saved.status === 'done' ? (saved.completedAt || now()) : null;
      if (!existing) state.tasks.push(saved);
      syncAll();
      logActivity('task', existing ? 'Task updated' : 'Task created', `${saved.key} · ${saved.title}`, { projectId: saved.projectId, taskId: saved.id });
      if (existing && oldStatus !== saved.status) logActivity('task', 'Task status changed', `${saved.key}: ${statusLabel(oldStatus)} → ${statusLabel(saved.status)}`, { projectId: saved.projectId, taskId: saved.id });
      const returnType = preset.__returnType || 'task';
      const returnId = preset.__returnId || saved.id;
      try {
        await Promise.resolve(saveState());
        closeModal();
        openRecord(returnType, returnId, { replace: true });
        toast(existing ? 'Task updated.' : 'Task created.');
      } catch (error) {
        if (existing) Object.assign(task, snapshot);
        else state.tasks = state.tasks.filter(item => item.id !== saved.id);
        syncAll();
        submitting = false;
        setBusy(form, false, existing ? 'Save task' : 'Create task');
        failForm(form, error?.message || 'Task could not be saved.');
      }
    }, true);
  };

  function openTimeEntryForm(task) {
    if (!task || !requireEdit()) return;
    const body = `<div class="bright-form-sections">${section('Work entry', 'Use one entry for one continuous block of work.', `
      ${field('Date', 'date', dateKey(today()), { type: 'date', required: true })}
      ${field('Hours', 'hours', '', { type: 'number', min: .25, max: 24, step: '.25', required: true })}
      ${field('Work description', 'description', '', { textarea: true, span: true, required: true, maxlength: 500 })}
      <label class="setting-row nepal-inline-check span-2"><span class="setting-copy"><strong>Billable time</strong><p>Include this entry in project commercial reporting.</p></span><span class="switch"><input type="checkbox" name="billable" ${task.billable ? 'checked' : ''}><span class="switch-track"></span></span></label>
    `)}</div>`;
    const form = showForm('Log time', `Add work to ${task.key} and its connected project report.`, body, 'Save time');
    if (!form) return;
    let submitting = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (submitting) return;
      clearFormError(form);
      if (!validateForm(form)) return;
      const values = formValues(form);
      const hours = num(values.hours);
      if (hours < .25 || hours > 24) return failForm(form, 'Enter hours between 0.25 and 24.', form.elements.hours);
      submitting = true;
      setBusy(form, true);
      const entry = { id: uid(), projectId: task.projectId, taskId: task.id, userId: currentUserId(), date: values.date, hours: round(hours), description: values.description, billable: Boolean(form.elements.billable?.checked), createdAt: now() };
      state.timeEntries.unshift(entry);
      task.updatedAt = now();
      syncAll();
      logActivity('time', 'Time logged', `${task.key} · ${entry.hours}h`, { projectId: task.projectId, taskId: task.id, timeEntryId: entry.id });
      try {
        await Promise.resolve(saveState());
        closeModal();
        renderShell();
        toast('Time logged.');
      } catch (error) {
        state.timeEntries = state.timeEntries.filter(item => item.id !== entry.id);
        syncAll();
        submitting = false;
        setBusy(form, false, 'Save time');
        failForm(form, error?.message || 'Time could not be saved.');
      }
    }, true);
  }

  document.addEventListener('click', event => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-ops-log-time]') : null;
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openTimeEntryForm(taskById(trigger.dataset.opsLogTime));
  }, true);

  window.FormcraftOperationsRuntime = Object.freeze({ openTimeEntryForm });
})();
