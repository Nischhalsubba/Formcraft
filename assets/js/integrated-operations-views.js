'use strict';

(() => {
  const C = window.FormcraftOpsCore;
  if (!C) throw new Error('Integrated operations core is required.');
  const {
    STATUSES, PRIORITIES, TYPES, base, record, arr, num, round, now, currentUserId, canEdit,
    safeCode, codeFromName, normalizeStatus, normalizePriority, statusLabel, priorityLabel, typeLabel,
    memberName, projectFor, moneyNpr, dual, statusBadge, priorityBadge, typeBadge,
    ensure, projectTasks, taskHours, syncProject, syncAll, health, metrics, nextTaskKey, showRecord
  } = C;

  const memberOptions = (unassigned = true) => (unassigned ? [['', 'Unassigned']] : [])
    .concat(state.team.filter(member => !member.pending).map(member => [member.id || member.userId, member.name]));
  const projectOptions = (unassigned = true) => (unassigned ? [['', 'No project']] : [])
    .concat(state.projects.map(project => [project.id, `${project.code} · ${project.name}`]));
  const taskOptions = (excludeId = '', projectId = '') => [['', 'None']].concat(state.tasks
    .filter(task => task.id !== excludeId && (!projectId || task.projectId === projectId))
    .map(task => [task.id, `${task.key} · ${task.title}`]));
  const section = (title, copy, content) => `<fieldset class="bright-form-section"><legend>${escapeHtml(title)}</legend><p class="bright-form-section-copy">${escapeHtml(copy)}</p><div class="field-grid">${content}</div></fieldset>`;

  openProjectForm = function openOpsProjectForm(project = null) {
    ensure();
    const existing = Boolean(project?.id && state.projects.some(item => item.id === project.id));
    const data = existing ? project : {
      name: '', code: codeFromName('', state.projects.length), client: '', ownerId: currentUserId(), status: 'planning',
      startDate: dateKey(today()), dueDate: dateKey(addDays(30)), progressMode: 'automatic', progress: 0,
      billingMethod: 'non-billable', budgetAmount: 0, budgetHours: 0, description: ''
    };
    const fields = `<div class="bright-form-sections">
      ${section('Project identity', 'Define the outcome, customer, and accountable owner.', `
        ${field('Project name', 'name', data.name, { required: true, span: true, maxlength: 120 })}
        ${field('Project code', 'code', data.code, { required: true, maxlength: 10, hint: 'Used for task keys such as FORM-001.' })}
        ${field('Client or internal team', 'client', data.client, { required: true, maxlength: 100 })}
        ${customSelectField('Owner', 'ownerId', memberOptions(), data.ownerId)}
        ${selectField('Project status', 'status', ['planning', 'active', 'review', 'completed'], data.status)}
      `)}
      ${section('Schedule and delivery', 'Progress can be calculated from weighted task estimates.', `
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
        ${field('Description', 'description', data.description, { textarea: true, span: true, required: true, maxlength: 2000 })}
      `)}
    </div>`;
    openFormModal(existing ? 'Edit project' : 'Create project', 'Create one connected record for tasks, schedule, time, files, and billing.', fields, async form => {
      const values = formValues(form);
      if (values.dueDate < values.startDate) throw new Error('Due date must be on or after the start date.');
      const code = safeCode(values.code, codeFromName(values.name, state.projects.length));
      if (state.projects.some(item => item.id !== project?.id && item.code === code)) throw new Error('Project code must be unique.');
      const saved = existing ? project : { id: uid(), createdAt: now() };
      Object.assign(saved, values, { code, ownerId: values.ownerId || '', progress: num(values.progress), budgetAmount: num(values.budgetAmount), budgetHours: num(values.budgetHours), updatedAt: now() });
      if (!existing) state.projects.push(saved);
      syncProject(saved);
      logActivity('project', existing ? 'Project updated' : 'Project created', saved.name, { projectId: saved.id });
      await Promise.resolve(saveState()); closeModal(); renderShell(); toast(existing ? 'Project updated.' : 'Project created.');
    });
  };

  openTaskForm = function openOpsTaskForm(task = null) {
    ensure();
    if (!state.projects.length) return toast('Create a project before adding tasks.', 'warning');
    const existing = Boolean(task?.id && state.tasks.some(item => item.id === task.id));
    const preset = task && !existing ? task : {};
    const data = existing ? task : {
      title: '', projectId: preset.projectId || state.projects[0].id, issueType: preset.issueType || 'task', parentTaskId: preset.parentTaskId || '',
      assigneeId: preset.assigneeId || currentUserId(), reporterId: currentUserId(), priority: preset.priority || 'medium', status: preset.status || 'todo',
      startDate: dateKey(today()), dueDate: preset.dueDate || dateKey(addDays(7)), estimateHours: preset.estimateHours || 0,
      storyPoints: preset.storyPoints || 0, billable: Boolean(preset.billable), labels: [], description: '', acceptanceCriteria: ''
    };
    const fields = `<div class="bright-form-sections">
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
        ${field('Description', 'description', data.description, { textarea: true, span: true, maxlength: 3000 })}
        ${field('Acceptance criteria', 'acceptanceCriteria', data.acceptanceCriteria, { textarea: true, span: true, maxlength: 3000 })}
      `)}
    </div>`;
    openFormModal(existing ? `Edit ${data.key}` : 'Create task', 'Create a traceable work item linked to delivery, time, files, and billing.', fields, async form => {
      const values = formValues(form);
      if (!values.projectId) throw new Error('Select a project.');
      if (values.dueDate < values.startDate) throw new Error('Due date must be on or after the start date.');
      if (existing && values.parentTaskId === task.id) throw new Error('A task cannot be its own parent.');
      const parent = values.parentTaskId ? state.tasks.find(item => item.id === values.parentTaskId) : null;
      if (parent && parent.projectId !== values.projectId) throw new Error('A parent task must belong to the same project.');
      const oldProjectId = existing ? task.projectId : '';
      const oldStatus = existing ? task.status : '';
      const saved = existing ? task : { id: uid(), createdAt: now(), dependencyIds: [], checklist: [], comments: [] };
      Object.assign(saved, values, {
        issueType: TYPES.includes(values.issueType) ? values.issueType : 'task', status: normalizeStatus(values.status), priority: normalizePriority(values.priority),
        assigneeId: values.assigneeId || '', reporterId: values.reporterId || '', parentTaskId: values.parentTaskId || '',
        estimateHours: num(values.estimateHours), storyPoints: num(values.storyPoints), billable: Boolean(form.elements.billable?.checked),
        labels: String(values.labels || '').split(',').map(value => value.trim()).filter(Boolean), updatedAt: now()
      });
      if (!existing) saved.key = nextTaskKey(values.projectId);
      if (existing && oldProjectId !== values.projectId) saved.key = nextTaskKey(values.projectId);
      saved.completedAt = saved.status === 'done' ? (saved.completedAt || now()) : null;
      if (!existing) state.tasks.push(saved);
      syncAll();
      logActivity('task', existing ? 'Task updated' : 'Task created', `${saved.key} · ${saved.title}`, { projectId: saved.projectId, taskId: saved.id });
      if (existing && oldStatus !== saved.status) logActivity('task', 'Task status changed', `${saved.key}: ${statusLabel(oldStatus)} → ${statusLabel(saved.status)}`, { projectId: saved.projectId, taskId: saved.id });
      await Promise.resolve(saveState()); closeModal(); renderShell(); toast(existing ? 'Task updated.' : 'Task created.');
      if (preset.__returnProjectId) requestAnimationFrame(() => openProjectDetail(state.projects.find(project => project.id === preset.__returnProjectId)));
    });
  };

  const taskDepth = (task, seen = new Set()) => {
    if (!task.parentTaskId || seen.has(task.id)) return 0;
    const parent = state.tasks.find(item => item.id === task.parentTaskId);
    if (!parent) return 0;
    seen.add(task.id); return 1 + taskDepth(parent, seen);
  };
  const sortTasks = tasks => [...tasks].sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status)
    || PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority) || String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
  const matches = (task, query, status, assignee) => {
    const project = projectFor(task);
    const text = `${task.key} ${task.title} ${task.description} ${task.labels.join(' ')} ${project?.name || ''}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (status === 'all' || task.status === status) && (assignee === 'all' || task.assigneeId === assignee);
  };

  function taskTable(tasks, includeProject = false) {
    if (!tasks.length) return '<div class="ops-empty"><strong>No tasks match.</strong><span>Create a task or broaden the filters.</span></div>';
    return `<div class="ops-task-table-wrap"><table class="ops-task-table"><thead><tr><th><span class="sr-only">Done</span></th><th>Key</th><th>Summary</th>${includeProject ? '<th>Project</th>' : ''}<th>Type</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Estimate</th><th>Spent</th><th>Due</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${tasks.map(task => {
      const project = projectFor(task);
      const children = state.tasks.filter(item => item.parentTaskId === task.id);
      const childLabel = children.length ? `${children.filter(item => item.status === 'done').length}/${children.length} subtasks` : '';
      return `<tr class="${task.status === 'done' ? 'is-complete' : ''}"><td><input class="email-check" type="checkbox" data-toggle-task="${escapeHtml(task.id)}" ${task.status === 'done' ? 'checked' : ''} aria-label="Mark ${escapeHtml(task.title)} as ${task.status === 'done' ? 'open' : 'complete'}"></td><td><button class="ops-key-button" type="button" data-ops-open-task="${escapeHtml(task.id)}">${escapeHtml(task.key)}</button></td><td><button class="ops-summary-button" type="button" data-ops-open-task="${escapeHtml(task.id)}" style="--task-depth:${taskDepth(task)}"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml([childLabel, task.labels.slice(0, 2).join(' · ')].filter(Boolean).join(' · ') || 'No labels')}</small></button></td>${includeProject ? `<td><button class="ops-link-button" type="button" data-view-project="${escapeHtml(project?.id || '')}">${escapeHtml(project?.name || 'Unassigned')}</button></td>` : ''}<td>${typeBadge(task.issueType)}</td><td>${statusBadge(task.status)}</td><td>${priorityBadge(task.priority)}</td><td>${escapeHtml(memberName(task.assigneeId))}</td><td>${task.estimateHours ? `${task.estimateHours}h` : '—'}</td><td>${taskHours(task.id) ? `${taskHours(task.id)}h` : '—'}</td><td>${escapeHtml(dual(task.dueDate))}</td><td>${overflowMenu([{ label: 'Open task', icon: 'eye', action: 'ops-open-task', id: task.id }, { label: 'Edit task', icon: 'edit', action: 'edit-task', id: task.id }, { label: 'Delete task', icon: 'trash', action: 'delete-task', id: task.id, danger: true }], `Actions for ${task.key}`)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  const taskBoard = tasks => `<div class="ops-task-board">${STATUSES.map(status => {
    const items = tasks.filter(task => task.status === status);
    return `<section class="ops-task-column"><header>${statusBadge(status)}<strong>${items.length}</strong></header><div>${items.length ? items.map(task => `<button class="ops-task-card" type="button" data-ops-open-task="${escapeHtml(task.id)}"><span>${typeBadge(task.issueType)}${priorityBadge(task.priority)}</span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.key)} · ${escapeHtml(memberName(task.assigneeId))}</small><footer><span>${task.estimateHours ? `${task.estimateHours}h estimated` : 'No estimate'}</span><span>${escapeHtml(dual(task.dueDate))}</span></footer></button>`).join('') : '<p>No tasks</p>'}</div></section>`;
  }).join('')}</div>`;

  function taskNavigator(project, data) {
    const tasks = sortTasks(data.tasks.filter(task => matches(task, record.query, record.status, record.assignee)));
    const assignees = [...new Set(data.tasks.map(task => task.assigneeId).filter(Boolean))];
    return `<section class="ops-work-section"><div class="ops-section-heading"><div><p class="panel-kicker">Issue navigator</p><h3>Project tasks</h3><p>Stories, tasks, bugs, milestones, subtasks, estimates, dependencies, time, and billing share one work model.</p></div><button class="button button-primary" type="button" data-ops-new-task="${escapeHtml(project.id)}">${icon('plus', 16)}New task</button></div><div class="ops-task-toolbar"><label class="ops-filter-search">${icon('search', 16)}<input type="search" value="${escapeHtml(record.query)}" placeholder="Search key, summary, label…" data-ops-project-task-search></label><label><span>Status</span><select data-ops-project-task-status><option value="all">All statuses</option>${STATUSES.map(value => `<option value="${value}" ${record.status === value ? 'selected' : ''}>${escapeHtml(statusLabel(value))}</option>`).join('')}</select></label><label><span>Assignee</span><select data-ops-project-task-assignee><option value="all">All assignees</option>${assignees.map(id => `<option value="${escapeHtml(id)}" ${record.assignee === id ? 'selected' : ''}>${escapeHtml(memberName(id))}</option>`).join('')}</select></label><div class="ops-view-switch"><button type="button" data-ops-project-task-view="list" class="${record.taskView === 'list' ? 'is-active' : ''}">${icon('list', 16)}List</button><button type="button" data-ops-project-task-view="board" class="${record.taskView === 'board' ? 'is-active' : ''}">${icon('grid', 16)}Board</button></div></div>${record.taskView === 'board' ? taskBoard(tasks) : taskTable(tasks)}</section>`;
  }

  function definition(rows) {
    return `<dl class="ops-definition-list">${rows.map(([name, value]) => `<div><dt>${escapeHtml(name)}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
  }

  function projectBody(project, data) {
    if (record.projectTab === 'work') return taskNavigator(project, data);
    if (record.projectTab === 'financials') return `<div class="ops-project-grid"><main class="ops-project-main"><section class="ops-card"><div class="ops-section-heading"><div><p class="panel-kicker">Billing</p><h3>Invoices and collections</h3><p>Totals come from invoices explicitly linked to this project.</p></div><button class="button button-primary button-small" type="button" data-ops-create-invoice="${escapeHtml(project.id)}">New invoice</button></div>${data.invoices.length ? `<div class="ops-linked-table"><table><thead><tr><th>Document</th><th>Status</th><th>Customer</th><th>Amount</th><th>Due</th></tr></thead><tbody>${data.invoices.map(invoice => `<tr><td><button class="ops-link-button" type="button" data-ops-open-invoice="${escapeHtml(invoice.id)}">${escapeHtml(invoice.number || 'Invoice')}</button></td><td>${escapeHtml(titleCase(invoice.status || 'draft'))}</td><td>${escapeHtml(invoice.customerName || invoice.client || project.client || '—')}</td><td>${escapeHtml(moneyNpr(C.npr(invoice)))}</td><td>${escapeHtml(dual(invoice.dueDate))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="ops-empty"><strong>No invoices linked.</strong><span>Create an invoice from this project.</span></div>'}</section></main><aside class="ops-project-aside"><section class="ops-card"><h3>Commercial summary</h3>${definition([['Budget', escapeHtml(moneyNpr(project.budgetAmount))], ['Billed', escapeHtml(moneyNpr(data.billed))], ['Paid', escapeHtml(moneyNpr(data.paid))], ['Outstanding', escapeHtml(moneyNpr(data.outstanding))]])}</section><section class="ops-card"><h3>Time summary</h3>${definition([['Budget hours', `${project.budgetHours || 0}h`], ['Estimated', `${data.estimateHours}h`], ['Logged', `${data.loggedHours}h`], ['Billable', `${data.billableHours}h`]])}</section></aside></div>`;
    if (record.projectTab === 'activity') {
      const ids = new Set(data.tasks.map(task => task.id));
      const activity = state.activity.filter(item => item.projectId === project.id || ids.has(item.taskId)).slice(0, 30);
      return `<div class="ops-project-grid"><main class="ops-project-main"><section class="ops-card"><div class="ops-section-heading"><div><p class="panel-kicker">Activity</p><h3>Project history</h3></div></div>${activity.length ? `<div class="ops-timeline">${activity.map(item => `<article><span class="ops-timeline-dot"></span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.copy || '')}</p><time>${escapeHtml(formatDateTime(item.at || item.createdAt || now()))}</time></div></article>`).join('')}</div>` : '<div class="ops-empty"><strong>No linked activity yet.</strong><span>Project and task updates appear here.</span></div>'}</section></main><aside class="ops-project-aside"><section class="ops-card"><div class="ops-section-heading"><div><h3>Schedule</h3></div><button class="button button-secondary button-small" type="button" data-ops-create-event="${escapeHtml(project.id)}">Add event</button></div>${data.events.length ? `<div class="ops-linked-list">${data.events.map(event => `<button type="button" data-ops-open-event="${escapeHtml(event.id)}"><span><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.category || 'event')}</small></span><small>${escapeHtml(dual(event.date))} · ${escapeHtml(event.time || 'All day')}</small></button>`).join('')}</div>` : '<p class="ops-muted">No events linked.</p>'}</section><section class="ops-card"><h3>Documents</h3>${data.files.length ? `<div class="ops-linked-list">${data.files.map(file => `<button type="button" data-ops-open-file="${escapeHtml(file.id)}"><span><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(file.kind || 'file')}</small></span></button>`).join('')}</div>` : '<p class="ops-muted">No files linked.</p>'}</section></aside></div>`;
    }
    const milestones = data.tasks.filter(task => task.issueType === 'milestone');
    return `<div class="ops-project-grid"><main class="ops-project-main"><section class="ops-card"><div class="ops-section-heading"><div><p class="panel-kicker">Project brief</p><h3>Scope and success</h3></div><button class="button button-secondary button-small" type="button" data-detail-edit-project>Edit</button></div><p class="ops-rich-copy">${escapeHtml(project.description || 'No project brief has been added.')}</p></section><section class="ops-card"><div class="ops-section-heading"><div><p class="panel-kicker">Milestones</p><h3>Delivery checkpoints</h3></div><button class="button button-secondary button-small" type="button" data-ops-new-milestone="${escapeHtml(project.id)}">Add milestone</button></div>${milestones.length ? `<div class="ops-linked-list">${milestones.map(task => `<button type="button" data-ops-open-task="${escapeHtml(task.id)}"><span>${statusBadge(task.status)}<strong>${escapeHtml(task.title)}</strong></span><small>${escapeHtml(dual(task.dueDate))}</small></button>`).join('')}</div>` : '<div class="ops-empty"><strong>No milestones yet.</strong><span>Create milestone issues for checkpoints.</span></div>'}</section></main><aside class="ops-project-aside"><section class="ops-card"><h3>Ownership</h3>${definition([['Project code', escapeHtml(project.code)], ['Owner', escapeHtml(memberName(project.ownerId))], ['Client/team', escapeHtml(project.client || 'Internal')], ['Billing', escapeHtml(titleCase(project.billingMethod || 'non-billable'))]])}</section><section class="ops-card"><h3>Schedule</h3>${definition([['Start', escapeHtml(dual(project.startDate))], ['Due', escapeHtml(dual(project.dueDate))], ['Overdue tasks', data.overdue], ['Blocked tasks', data.blocked]])}</section></aside></div>`;
  }

  function projectRecord(project) {
    syncProject(project);
    const data = metrics(project);
    const projectHealth = health(project);
    return `<article class="full-detail-view ops-record-page ops-project-record" data-record-page="project"><header class="ops-record-header"><div class="ops-record-heading"><p class="workspace-breadcrumb">Projects<span>/</span>${escapeHtml(project.code)}</p><div><span class="ops-health" data-health="${projectHealth}">${escapeHtml(titleCase(projectHealth))}</span><h2 id="modal-title" tabindex="-1">${escapeHtml(project.name)}</h2></div><p>${escapeHtml(project.client || 'Internal project')}</p></div><div class="ops-record-actions"><button class="button button-secondary" type="button" data-close-modal>${icon('chevronLeft', 16)}Projects</button>${canEdit() ? `<button class="button button-secondary" type="button" data-detail-edit-project>${icon('edit', 16)}Edit project</button><button class="button button-primary" type="button" data-ops-new-task="${escapeHtml(project.id)}">${icon('plus', 16)}New task</button>` : ''}</div></header><div class="ops-record-body"><section class="ops-summary-strip"><div><span>Status</span><strong>${escapeHtml(titleCase(project.status || 'planning'))}</strong></div><div><span>Progress</span><strong>${project.progress}%</strong><i><b style="width:${project.progress}%"></b></i></div><div><span>Tasks</span><strong>${data.completed}/${data.tasks.length}</strong><small>${data.blocked} blocked · ${data.overdue} overdue</small></div><div><span>Time</span><strong>${data.loggedHours}h</strong><small>${data.estimateHours}h estimated</small></div><div><span>Outstanding</span><strong>${escapeHtml(moneyNpr(data.outstanding))}</strong><small>${data.invoices.length} invoices</small></div></section><nav class="ops-record-tabs">${[['overview', 'Overview'], ['work', 'Work'], ['financials', 'Financials'], ['activity', 'Activity & files']].map(([value, label]) => `<button type="button" data-ops-project-tab="${value}" class="${record.projectTab === value ? 'is-active' : ''}">${label}</button>`).join('')}</nav><div class="ops-record-content">${projectBody(project, data)}</div></div></article>`;
  }

  function comments(task) {
    return task.comments.length ? `<div class="ops-comment-list">${task.comments.map(comment => `<article><span class="ops-avatar">${escapeHtml((comment.author || 'U').slice(0, 2).toUpperCase())}</span><div><header><strong>${escapeHtml(comment.author || 'Workspace member')}</strong><time>${escapeHtml(formatDateTime(comment.createdAt || now()))}</time></header><p>${escapeHtml(comment.body)}</p></div></article>`).join('')}</div>` : '<div class="ops-empty"><strong>No comments yet.</strong><span>Add a decision, update, or question.</span></div>';
  }

  function taskRecord(task) {
    const project = projectFor(task);
    const children = state.tasks.filter(item => item.parentTaskId === task.id);
    const dependencies = task.dependencyIds.map(id => state.tasks.find(item => item.id === id)).filter(Boolean);
    const entries = state.timeEntries.filter(entry => entry.taskId === task.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const done = task.checklist.filter(item => item.done).length;
    const percent = task.checklist.length ? Math.round(done / task.checklist.length * 100) : 0;
    return `<article class="full-detail-view ops-record-page ops-task-record" data-record-page="task"><header class="ops-record-header"><div class="ops-record-heading"><p class="workspace-breadcrumb"><button type="button" data-ops-back-project="${escapeHtml(project?.id || '')}">${escapeHtml(project?.name || 'Tasks')}</button><span>/</span>${escapeHtml(task.key)}</p><div>${typeBadge(task.issueType)}<h2 id="modal-title" tabindex="-1">${escapeHtml(task.title)}</h2></div><p>${escapeHtml(task.key)} · Reported by ${escapeHtml(memberName(task.reporterId))}</p></div><div class="ops-record-actions"><button class="button button-secondary" type="button" data-close-modal>${icon('chevronLeft', 16)}Tasks</button>${canEdit() ? `<button class="button button-secondary" type="button" data-ops-edit-task="${escapeHtml(task.id)}">${icon('edit', 16)}Edit task</button><button class="button button-primary" type="button" data-ops-add-subtask="${escapeHtml(task.id)}">${icon('plus', 16)}Add subtask</button>` : ''}</div></header><div class="ops-record-body"><section class="ops-task-commandbar"><label><span>Status</span><select data-ops-task-status="${escapeHtml(task.id)}">${STATUSES.map(value => `<option value="${value}" ${task.status === value ? 'selected' : ''}>${escapeHtml(statusLabel(value))}</option>`).join('')}</select></label><label><span>Assignee</span><select data-ops-task-assignee="${escapeHtml(task.id)}"><option value="">Unassigned</option>${state.team.filter(member => !member.pending).map(member => `<option value="${escapeHtml(member.id || member.userId)}" ${task.assigneeId === (member.id || member.userId) ? 'selected' : ''}>${escapeHtml(member.name)}</option>`).join('')}</select></label><div><span>Priority</span>${priorityBadge(task.priority)}</div><div><span>Estimate</span><strong>${task.estimateHours || 0}h</strong></div><div><span>Logged</span><strong>${taskHours(task.id)}h</strong></div><div><span>Due</span><strong>${escapeHtml(dual(task.dueDate))}</strong></div></section><div class="ops-task-layout"><main class="ops-task-main"><section class="ops-card"><div class="ops-section-heading"><div><p class="panel-kicker">Description</p><h3>Context and implementation</h3></div></div><p class="ops-rich-copy">${escapeHtml(task.description || 'No description has been added.')}</p></section><section class="ops-card"><div class="ops-section-heading"><div><p class="panel-kicker">Definition of done</p><h3>Acceptance criteria</h3></div></div><p class="ops-rich-copy">${escapeHtml(task.acceptanceCriteria || 'No acceptance criteria have been added.')}</p></section><section class="ops-card"><div class="ops-section-heading"><div><p class="panel-kicker">Subtasks</p><h3>${children.length} linked items</h3></div><button class="button button-secondary button-small" type="button" data-ops-add-subtask="${escapeHtml(task.id)}">Add subtask</button></div>${children.length ? taskTable(sortTasks(children)) : '<div class="ops-empty"><strong>No subtasks.</strong><span>Break work down when separate ownership or estimates help.</span></div>'}</section><section class="ops-card"><div class="ops-section-heading"><div><p class="panel-kicker">Discussion</p><h3>Comments and decisions</h3></div><button class="button button-secondary button-small" type="button" data-ops-add-comment="${escapeHtml(task.id)}">Add comment</button></div>${comments(task)}</section></main><aside class="ops-task-aside"><section class="ops-card"><h3>Details</h3>${definition([['Project', `<button class="ops-link-button" type="button" data-view-project="${escapeHtml(project?.id || '')}">${escapeHtml(project?.name || 'Unassigned')}</button>`], ['Parent', task.parentTaskId ? `<button class="ops-link-button" type="button" data-ops-open-task="${escapeHtml(task.parentTaskId)}">${escapeHtml(state.tasks.find(item => item.id === task.parentTaskId)?.key || 'Task')}</button>` : 'None'], ['Reporter', escapeHtml(memberName(task.reporterId))], ['Story points', task.storyPoints || 0], ['Billable', task.billable ? 'Yes' : 'No'], ['Labels', escapeHtml(task.labels.join(', ') || 'None')]])}</section><section class="ops-card"><div class="ops-section-heading"><div><h3>Checklist</h3><p>${done}/${task.checklist.length} complete</p></div><button class="button button-secondary button-small" type="button" data-ops-add-checklist="${escapeHtml(task.id)}">Add</button></div><div class="ops-mini-progress"><span style="width:${percent}%"></span></div>${task.checklist.length ? `<div class="ops-checklist">${task.checklist.map(item => `<label><input type="checkbox" data-ops-toggle-checklist="${escapeHtml(task.id)}" data-check-id="${escapeHtml(item.id)}" ${item.done ? 'checked' : ''}><span>${escapeHtml(item.text)}</span></label>`).join('')}</div>` : '<p class="ops-muted">No checklist items.</p>'}</section><section class="ops-card"><div class="ops-section-heading"><div><h3>Dependencies</h3></div><button class="button button-secondary button-small" type="button" data-ops-add-dependency="${escapeHtml(task.id)}">Link</button></div>${dependencies.length ? `<div class="ops-linked-list">${dependencies.map(item => `<button type="button" data-ops-open-task="${escapeHtml(item.id)}"><span>${statusBadge(item.status)}<strong>${escapeHtml(item.key)}</strong></span><small>${escapeHtml(item.title)}</small></button>`).join('')}</div>` : '<p class="ops-muted">No blocking dependencies.</p>'}</section><section class="ops-card"><div class="ops-section-heading"><div><h3>Time</h3><p>${taskHours(task.id)}h logged</p></div><button class="button button-secondary button-small" type="button" data-ops-log-time="${escapeHtml(task.id)}">Log time</button></div>${entries.length ? `<div class="ops-time-list">${entries.slice(0, 8).map(entry => `<div><span><strong>${escapeHtml(entry.description || 'Work logged')}</strong><small>${escapeHtml(dual(entry.date))} · ${escapeHtml(memberName(entry.userId))}</small></span><strong>${entry.hours}h${entry.billable ? ' · billable' : ''}</strong></div>`).join('')}</div>` : '<p class="ops-muted">No time logged.</p>'}</section></aside></div></div></article>`;
  }

  function rerenderRecord() {
    ensure();
    const entity = record.type === 'project' ? state.projects.find(item => item.id === record.id) : state.tasks.find(item => item.id === record.id);
    if (!entity) return closeModal();
    modalContent.innerHTML = record.type === 'project' ? projectRecord(entity) : taskRecord(entity);
    $$('[data-close-modal]', modal).forEach(button => button.addEventListener('click', closeModal));
  }
  openProjectDetail = project => project && (ensure(), showRecord(projectRecord(project), 'project', project.id));
  function openTaskDetail(task) { if (task) { ensure(); showRecord(taskRecord(task), 'task', task.id); } }

  renderTasks = function renderOpsTasks() {
    ensure();
    const settings = state.settings.operations;
    const query = ui.query.trim().toLowerCase();
    const tasks = sortTasks(state.tasks.filter(task => matches(task, query, settings.globalTaskStatus || 'all', settings.globalTaskAssignee || 'all')
      && (settings.globalTaskProject === 'all' || !settings.globalTaskProject || task.projectId === settings.globalTaskProject)));
    const open = state.tasks.filter(task => task.status !== 'done').length;
    const blocked = state.tasks.filter(task => task.status === 'blocked').length;
    const overdue = state.tasks.filter(task => task.status !== 'done' && task.dueDate && task.dueDate < dateKey(today())).length;
    const logged = round(state.timeEntries.reduce((sum, entry) => sum + num(entry.hours), 0));
    return `<div class="content-shell page-stack ops-global-tasks"><section class="ops-task-summary"><div><span>Open</span><strong>${open}</strong></div><div><span>Blocked</span><strong>${blocked}</strong></div><div><span>Overdue</span><strong>${overdue}</strong></div><div><span>Logged time</span><strong>${logged}h</strong></div></section><div class="ops-global-task-toolbar"><div class="toolbar-group">${searchToolbar('Search key, summary, label, or project')}<label class="ops-compact-filter"><span>Project</span><select data-ops-global-project><option value="all">All projects</option>${state.projects.map(project => `<option value="${escapeHtml(project.id)}" ${settings.globalTaskProject === project.id ? 'selected' : ''}>${escapeHtml(project.code)} · ${escapeHtml(project.name)}</option>`).join('')}</select></label><label class="ops-compact-filter"><span>Status</span><select data-ops-global-status><option value="all">All statuses</option>${STATUSES.map(value => `<option value="${value}" ${settings.globalTaskStatus === value ? 'selected' : ''}>${escapeHtml(statusLabel(value))}</option>`).join('')}</select></label><label class="ops-compact-filter"><span>Assignee</span><select data-ops-global-assignee><option value="all">All assignees</option>${state.team.filter(member => !member.pending).map(member => `<option value="${escapeHtml(member.id || member.userId)}" ${settings.globalTaskAssignee === (member.id || member.userId) ? 'selected' : ''}>${escapeHtml(member.name)}</option>`).join('')}</select></label></div><div class="ops-view-switch"><button type="button" data-ops-global-task-view="list" class="${settings.globalTaskView === 'list' ? 'is-active' : ''}">${icon('list', 16)}List</button><button type="button" data-ops-global-task-view="board" class="${settings.globalTaskView === 'board' ? 'is-active' : ''}">${icon('grid', 16)}Board</button></div></div><div class="filter-group ops-legacy-filters">${['all', 'todo', 'progress', 'done'].map(value => `<button class="filter-chip" type="button" data-task-filter="${value}">${value === 'all' ? 'All tasks' : statusLabel(value)}</button>`).join('')}</div>${settings.globalTaskView === 'board' ? taskBoard(tasks) : taskTable(tasks, true)}</div>`;
  };

  function portfolio() {
    const rows = state.projects.map(project => ({ project, data: metrics(project), projectHealth: health(project) }));
    const billed = rows.reduce((sum, row) => sum + row.data.billed, 0);
    const outstanding = rows.reduce((sum, row) => sum + row.data.outstanding, 0);
    const hours = rows.reduce((sum, row) => sum + row.data.loggedHours, 0);
    return `<section class="content-shell page-stack ops-portfolio-report"><div class="ops-section-heading"><div><p class="panel-kicker">Connected operations</p><h2>Project delivery and commercial report</h2><p>Tasks, schedule, time, budgets, and invoices are calculated from linked records.</p></div></div><section class="ops-task-summary"><div><span>Projects</span><strong>${rows.length}</strong></div><div><span>Logged time</span><strong>${round(hours)}h</strong></div><div><span>Total billed</span><strong>${escapeHtml(moneyNpr(billed))}</strong></div><div><span>Outstanding</span><strong>${escapeHtml(moneyNpr(outstanding))}</strong></div></section>${rows.length ? `<div class="ops-linked-table"><table><thead><tr><th>Project</th><th>Health</th><th>Tasks</th><th>Progress</th><th>Hours</th><th>Budget</th><th>Billed</th><th>Outstanding</th><th>Due</th></tr></thead><tbody>${rows.map(({ project, data, projectHealth }) => `<tr><td><button class="ops-link-button" type="button" data-view-project="${escapeHtml(project.id)}"><strong>${escapeHtml(project.code)}</strong><small>${escapeHtml(project.name)}</small></button></td><td><span class="ops-health" data-health="${projectHealth}">${escapeHtml(titleCase(projectHealth))}</span></td><td>${data.completed}/${data.tasks.length}</td><td>${project.progress}%</td><td>${data.loggedHours}/${project.budgetHours || '—'}h</td><td>${escapeHtml(moneyNpr(project.budgetAmount))}</td><td>${escapeHtml(moneyNpr(data.billed))}</td><td>${escapeHtml(moneyNpr(data.outstanding))}</td><td>${escapeHtml(dual(project.dueDate))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="ops-empty"><strong>No projects to report.</strong><span>Create projects and linked operational records.</span></div>'}</section>`;
  }
  if (base.renderReports) renderReports = () => `${base.renderReports()}${portfolio()}`;

  Object.assign(C, { memberOptions, projectOptions, taskOptions, sortTasks, taskTable, taskBoard, projectRecord, taskRecord, rerenderRecord, openTaskDetail });
})();
