'use strict';

(() => {
  const VERSION = 'OPS-NP-2.0';
  const STATUSES = ['backlog', 'todo', 'progress', 'review', 'blocked', 'done'];
  const PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];
  const TYPES = ['story', 'task', 'bug', 'milestone'];
  const previous = {
    renderPage,
    renderShell,
    navigate,
    openModal,
    closeModal,
    openInvoiceForm,
    openEventForm,
    logActivity,
    toggleTask,
    renderReports: typeof renderReports === 'function' ? renderReports : null
  };

  const record = {
    type: '',
    id: '',
    projectTab: 'overview',
    taskView: 'list',
    query: '',
    status: 'all',
    assignee: 'all'
  };

  const arr = value => Array.isArray(value) ? value : [];
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = value => Math.round((num(value) + Number.EPSILON) * 100) / 100;
  const now = () => new Date().toISOString();
  const currentUserId = () => window.FormcraftBackend?.session?.user?.id || '';
  const canEdit = () => !window.FormcraftBackend || window.FormcraftBackend.role !== 'viewer';
  const safeCode = (value, fallback = 'PRJ') => String(value || '').toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 10) || fallback;
  const codeFromName = (name, index = 0) => safeCode(
    String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 4).map(word => word[0]).join(''),
    `PRJ${index + 1}`
  );
  const normalizeStatus = value => ({
    'in-progress': 'progress',
    active: 'progress',
    completed: 'done',
    closed: 'done'
  }[value] || (STATUSES.includes(value) ? value : 'todo'));
  const normalizePriority = value => PRIORITIES.includes(value)
    ? value
    : ({ urgent: 'highest' }[value] || 'medium');
  const statusLabel = value => ({
    backlog: 'Backlog',
    todo: 'To do',
    progress: 'In progress',
    review: 'In review',
    blocked: 'Blocked',
    done: 'Done'
  }[value] || titleCase(value || 'todo'));
  const priorityLabel = value => ({
    lowest: 'Lowest',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    highest: 'Highest'
  }[value] || titleCase(value || 'medium'));
  const typeLabel = value => ({
    story: 'Story',
    task: 'Task',
    bug: 'Bug',
    milestone: 'Milestone'
  }[value] || 'Task');
  const memberName = id => state.team.find(member => member.id === id || member.userId === id)?.name || 'Unassigned';
  const projectFor = task => state.projects.find(project => project.id === task?.projectId) || null;
  const npr = invoice => {
    const amount = num(invoice?.total ?? invoice?.amount);
    return (invoice?.currency || 'NPR') === 'NPR'
      ? amount
      : num(invoice?.nprEquivalent || amount * num(invoice?.exchangeRate || 1));
  };
  const moneyNpr = value => typeof nprMoney === 'function'
    ? nprMoney(value)
    : `NPR ${round(value).toFixed(2)}`;
  const dual = value => !value
    ? '—'
    : (typeof dualDate === 'function' ? dualDate(value, { short: true }) : formatShortDate(value));
  const statusBadge = value => `<span class="ops-status-badge" data-status="${escapeHtml(value)}">${escapeHtml(statusLabel(value))}</span>`;
  const priorityBadge = value => `<span class="ops-priority-badge" data-priority="${escapeHtml(value)}">${escapeHtml(priorityLabel(value))}</span>`;
  const typeBadge = value => `<span class="ops-type-badge" data-type="${escapeHtml(value)}">${escapeHtml(typeLabel(value))}</span>`;

  function uniqueProjectCode(project, index, used) {
    const seed = safeCode(project.code || codeFromName(project.name, index), `PRJ${index + 1}`);
    let candidate = seed;
    let suffix = 2;
    while (used.has(candidate)) {
      const room = Math.max(1, 10 - String(suffix).length - 1);
      candidate = `${seed.slice(0, room)}-${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  }

  function repairTaskKeys() {
    const usedByProject = new Map();
    const nextByProject = new Map();
    for (const task of state.tasks) {
      const project = state.projects.find(item => item.id === task.projectId);
      const code = project?.code || 'TASK';
      const used = usedByProject.get(task.projectId) || new Set();
      const expression = new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`, 'i');
      const match = String(task.key || '').match(expression);
      if (match && !used.has(task.key.toUpperCase())) {
        used.add(task.key.toUpperCase());
        nextByProject.set(task.projectId, Math.max(nextByProject.get(task.projectId) || 1, Number(match[1]) + 1));
      }
      usedByProject.set(task.projectId, used);
    }
    for (const task of state.tasks) {
      const project = state.projects.find(item => item.id === task.projectId);
      const code = project?.code || 'TASK';
      const used = usedByProject.get(task.projectId) || new Set();
      if (task.key && used.has(task.key.toUpperCase())) {
        const duplicates = state.tasks.filter(item => item.projectId === task.projectId && String(item.key).toUpperCase() === String(task.key).toUpperCase());
        if (duplicates[0] === task) continue;
      }
      let next = nextByProject.get(task.projectId) || 1;
      let candidate = `${code}-${String(next).padStart(3, '0')}`;
      while (used.has(candidate.toUpperCase())) {
        next += 1;
        candidate = `${code}-${String(next).padStart(3, '0')}`;
      }
      task.key = candidate;
      used.add(candidate.toUpperCase());
      nextByProject.set(task.projectId, next + 1);
      usedByProject.set(task.projectId, used);
    }
  }

  function ensure() {
    if (!state || typeof state !== 'object') return;
    for (const key of ['projects', 'tasks', 'events', 'invoices', 'files', 'activity', 'team']) {
      state[key] = arr(state[key]);
    }
    state.timeEntries = arr(state.timeEntries);
    state.settings ||= {};
    state.settings.operations = {
      version: VERSION,
      globalTaskView: 'list',
      globalTaskProject: 'all',
      globalTaskStatus: 'all',
      globalTaskAssignee: 'all',
      ...(state.settings.operations || {}),
      version: VERSION
    };

    const usedCodes = new Set();
    state.projects.forEach((project, index) => {
      project.code = uniqueProjectCode(project, index, usedCodes);
      project.ownerId ||= '';
      project.status ||= 'planning';
      project.progressMode ||= 'automatic';
      project.progress = num(project.progress);
      project.billingMethod ||= 'non-billable';
      project.budgetAmount = num(project.budgetAmount);
      project.budgetHours = num(project.budgetHours);
      project.startDate ||= project.createdAt?.slice(0, 10) || dateKey(today());
      project.dueDate ||= dateKey(addDays(30));
      project.description ||= '';
      project.createdAt ||= now();
      project.updatedAt ||= project.createdAt;
    });

    const validTaskIds = new Set(state.tasks.map(task => task.id));
    state.tasks.forEach((task, index) => {
      task.status = normalizeStatus(task.status);
      task.priority = normalizePriority(task.priority);
      task.issueType = TYPES.includes(task.issueType) ? task.issueType : 'task';
      task.assigneeId ||= '';
      task.reporterId ||= currentUserId();
      task.parentTaskId = validTaskIds.has(task.parentTaskId) && task.parentTaskId !== task.id ? task.parentTaskId : '';
      task.dependencyIds = [...new Set(arr(task.dependencyIds))].filter(id => validTaskIds.has(id) && id !== task.id);
      task.labels = arr(task.labels).map(value => String(value).trim()).filter(Boolean);
      task.checklist = arr(task.checklist).map(item => ({
        id: item?.id || uid(),
        text: String(item?.text || '').trim() || 'Checklist item',
        done: Boolean(item?.done)
      }));
      task.comments = arr(task.comments).map(comment => ({
        id: comment?.id || uid(),
        body: String(comment?.body || '').trim(),
        author: comment?.author || 'Workspace member',
        userId: comment?.userId || '',
        createdAt: comment?.createdAt || now()
      })).filter(comment => comment.body);
      task.estimateHours = Math.max(0, num(task.estimateHours));
      task.storyPoints = Math.max(0, num(task.storyPoints));
      task.billable = Boolean(task.billable);
      task.startDate ||= task.createdAt?.slice(0, 10) || dateKey(today());
      task.dueDate ||= dateKey(addDays(7));
      task.description ||= '';
      task.acceptanceCriteria ||= '';
      task.createdAt ||= now();
      task.updatedAt ||= task.createdAt;
      task.completedAt = task.status === 'done' ? (task.completedAt || task.updatedAt) : null;
      task.title ||= `Untitled task ${index + 1}`;
    });
    repairTaskKeys();

    const validProjects = new Set(state.projects.map(project => project.id));
    state.timeEntries = state.timeEntries
      .map(entry => ({
        id: entry?.id || uid(),
        projectId: entry?.projectId || state.tasks.find(task => task.id === entry?.taskId)?.projectId || '',
        taskId: entry?.taskId || '',
        userId: entry?.userId || currentUserId(),
        date: entry?.date || dateKey(today()),
        hours: round(Math.max(0, num(entry?.hours))),
        description: String(entry?.description || '').trim(),
        billable: Boolean(entry?.billable),
        createdAt: entry?.createdAt || now()
      }))
      .filter(entry => entry.hours > 0 && validProjects.has(entry.projectId));

    syncAll();
  }

  const projectTasks = projectId => state.tasks.filter(task => task.projectId === projectId);
  const taskHours = taskId => round(state.timeEntries
    .filter(entry => entry.taskId === taskId)
    .reduce((sum, entry) => sum + num(entry.hours), 0));
  const projectHours = projectId => round(state.timeEntries
    .filter(entry => entry.projectId === projectId)
    .reduce((sum, entry) => sum + num(entry.hours), 0));
  const projectBillableHours = projectId => round(state.timeEntries
    .filter(entry => entry.projectId === projectId && entry.billable)
    .reduce((sum, entry) => sum + num(entry.hours), 0));

  function syncProject(project) {
    const tasks = projectTasks(project.id);
    if (project.progressMode !== 'manual') {
      const total = tasks.reduce((sum, task) => sum + (task.estimateHours || 1), 0);
      const done = tasks
        .filter(task => task.status === 'done')
        .reduce((sum, task) => sum + (task.estimateHours || 1), 0);
      project.progress = total ? Math.round((done / total) * 100) : 0;
    }
    project.progress = Math.max(0, Math.min(100, num(project.progress)));
    if (project.progress === 100 && project.status !== 'completed') project.status = 'completed';
    if (project.progress < 100 && project.status === 'completed') project.status = 'active';
    project.updatedAt ||= now();
  }

  const syncAll = () => state.projects.forEach(syncProject);

  function health(project) {
    const tasks = projectTasks(project.id);
    const todayKey = dateKey(today());
    if (tasks.some(task => task.status === 'blocked')) return 'blocked';
    if (tasks.some(task => task.status !== 'done' && task.dueDate && task.dueDate < todayKey)) return 'at-risk';
    if (project.dueDate && project.dueDate < todayKey && project.progress < 100) return 'at-risk';
    return project.progress === 100 || project.status === 'completed' ? 'complete' : 'on-track';
  }

  function metrics(project) {
    const tasks = projectTasks(project.id);
    const invoices = state.invoices.filter(invoice => invoice.projectId === project.id);
    const events = state.events.filter(event => event.projectId === project.id);
    const taskIds = new Set(tasks.map(task => task.id));
    const files = state.files.filter(file => file.projectId === project.id || taskIds.has(file.taskId));
    const billableInvoices = invoices.filter(invoice => invoice.documentType !== 'proforma' && invoice.status !== 'void');
    const billed = billableInvoices.reduce((sum, invoice) => sum + npr(invoice), 0);
    const paid = billableInvoices.reduce((sum, invoice) => {
      if (invoice.status === 'paid') return sum + npr(invoice);
      const payments = arr(invoice.payments).reduce((value, payment) => value + (payment.type === 'refund' ? -num(payment.amount) : num(payment.amount)), 0);
      return sum + Math.max(0, payments * ((invoice.currency || 'NPR') === 'NPR' ? 1 : num(invoice.exchangeRate || 1)));
    }, 0);
    return {
      tasks,
      invoices,
      events,
      files,
      completed: tasks.filter(task => task.status === 'done').length,
      blocked: tasks.filter(task => task.status === 'blocked').length,
      overdue: tasks.filter(task => task.status !== 'done' && task.dueDate && task.dueDate < dateKey(today())).length,
      estimateHours: round(tasks.reduce((sum, task) => sum + num(task.estimateHours), 0)),
      loggedHours: projectHours(project.id),
      billableHours: projectBillableHours(project.id),
      billed,
      paid: Math.min(billed, paid),
      outstanding: Math.max(0, billed - paid)
    };
  }

  function nextTaskKey(projectId) {
    const code = state.projects.find(project => project.id === projectId)?.code || 'TASK';
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const max = state.tasks.reduce((value, task) => {
      if (task.projectId !== projectId) return value;
      const match = String(task.key || '').match(new RegExp(`^${escaped}-(\\d+)$`, 'i'));
      return match ? Math.max(value, Number(match[1])) : value;
    }, 0);
    return `${code}-${String(max + 1).padStart(3, '0')}`;
  }

  function dependencyPath(fromId, targetId, visited = new Set()) {
    if (fromId === targetId) return true;
    if (visited.has(fromId)) return false;
    visited.add(fromId);
    const task = state.tasks.find(item => item.id === fromId);
    return arr(task?.dependencyIds).some(id => dependencyPath(id, targetId, visited));
  }

  function canLinkDependency(taskId, dependencyId) {
    if (!taskId || !dependencyId || taskId === dependencyId) return false;
    return !dependencyPath(dependencyId, taskId);
  }

  function parentPath(fromId, targetId, visited = new Set()) {
    if (fromId === targetId) return true;
    if (visited.has(fromId)) return false;
    visited.add(fromId);
    const task = state.tasks.find(item => item.id === fromId);
    return task?.parentTaskId ? parentPath(task.parentTaskId, targetId, visited) : false;
  }

  function canSetParent(taskId, parentId) {
    if (!parentId) return true;
    if (!taskId || taskId === parentId) return false;
    return !parentPath(parentId, taskId);
  }

  function recordUrl(type, id) {
    const url = new URL(location.href);
    url.searchParams.set('record', type);
    url.searchParams.set('recordId', id);
    url.hash = type === 'project' ? 'projects' : 'tasks';
    return url;
  }

  function listUrl(type) {
    const url = new URL(location.href);
    url.searchParams.delete('record');
    url.searchParams.delete('recordId');
    url.hash = type === 'project' ? 'projects' : 'tasks';
    return url;
  }

  function resolveRecord() {
    if (record.type === 'project') return state.projects.find(item => item.id === record.id) || null;
    if (record.type === 'task') return state.tasks.find(item => item.id === record.id) || null;
    return null;
  }

  function syncRecordFromLocation() {
    const params = new URL(location.href).searchParams;
    const type = params.get('record') || '';
    const id = params.get('recordId') || '';
    if (!['project', 'task'].includes(type) || !id) {
      record.type = '';
      record.id = '';
      document.body.classList.remove('ops-record-open');
      return;
    }
    record.type = type;
    record.id = id;
    ui.route = type === 'project' ? 'projects' : 'tasks';
    document.body.classList.add('ops-record-open');
  }

  function openRecord(type, id, options = {}) {
    ensure();
    const entity = type === 'project'
      ? state.projects.find(item => item.id === id)
      : state.tasks.find(item => item.id === id);
    if (!entity) {
      toast('That record is no longer available.', 'warning');
      return;
    }
    if (modal.open) previous.closeModal();
    record.type = type;
    record.id = id;
    ui.route = type === 'project' ? 'projects' : 'tasks';
    document.body.classList.add('ops-record-open');
    const url = recordUrl(type, id);
    history[options.replace ? 'replaceState' : 'pushState']({ record: type, id }, '', url);
    renderShell();
    requestAnimationFrame(() => document.querySelector('[data-record-page] #modal-title, [data-record-page] h1')?.focus({ preventScroll: true }));
  }

  function closeRecord(options = {}) {
    const type = record.type || (ui.route === 'projects' ? 'project' : 'task');
    record.type = '';
    record.id = '';
    document.body.classList.remove('ops-record-open');
    const url = listUrl(type);
    history[options.replace ? 'replaceState' : 'pushState']({}, '', url);
    ui.route = type === 'project' ? 'projects' : 'tasks';
    renderShell();
  }

  navigate = function navigateWithoutStaleRecord(route, replace = false) {
    record.type = '';
    record.id = '';
    document.body.classList.remove('ops-record-open');
    const url = new URL(location.href);
    url.searchParams.delete('record');
    url.searchParams.delete('recordId');
    history.replaceState(history.state, '', url);
    return previous.navigate(route, replace);
  };

  renderPage = function renderOperationsPage() {
    ensure();
    const entity = resolveRecord();
    if (entity && window.FormcraftOpsViews) {
      return record.type === 'project'
        ? window.FormcraftOpsViews.projectRecord(entity)
        : window.FormcraftOpsViews.taskRecord(entity);
    }
    if (record.type && !entity) {
      record.type = '';
      record.id = '';
      document.body.classList.remove('ops-record-open');
    }
    return previous.renderPage();
  };

  renderShell = function renderOperationsShell(...args) {
    ensure();
    syncRecordFromLocation();
    const result = previous.renderShell.apply(this, args);
    document.body.classList.toggle('ops-record-open', Boolean(resolveRecord()));
    return result;
  };

  function clearModalSurface() {
    delete modal.dataset.surface;
  }

  closeModal = function closeProtectedModal() {
    previous.closeModal();
    clearModalSurface();
  };

  openModal = function openProtectedModal(markup) {
    if (modal.open) previous.closeModal();
    previous.openModal(markup);
    modal.dataset.surface = /form-modal|<form[\s>]/i.test(String(markup)) ? 'form' : 'dialog';
  };

  modal.addEventListener('click', event => {
    if (event.target === modal && modal.dataset.surface === 'form') {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast('Use Cancel or Close so unfinished changes are not discarded.', 'warning');
    }
  }, true);

  modal.addEventListener('cancel', event => {
    if (modal.dataset.surface === 'form') {
      event.preventDefault();
      toast('Use Cancel or Close so unfinished changes are not discarded.', 'warning');
    }
  }, true);
  modal.addEventListener('close', clearModalSurface);

  logActivity = function logOperationsActivity(type, title, copy, metadata = {}) {
    previous.logActivity(type, title, copy);
    if (state.activity?.[0] && metadata && typeof metadata === 'object') Object.assign(state.activity[0], metadata);
  };

  window.addEventListener('popstate', () => {
    syncRecordFromLocation();
    queueMicrotask(() => renderShell());
  });

  window.FormcraftOpsCore = {
    VERSION,
    STATUSES,
    PRIORITIES,
    TYPES,
    previous,
    record,
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
    memberName,
    projectFor,
    npr,
    moneyNpr,
    dual,
    statusBadge,
    priorityBadge,
    typeBadge,
    ensure,
    projectTasks,
    taskHours,
    projectHours,
    projectBillableHours,
    syncProject,
    syncAll,
    health,
    metrics,
    nextTaskKey,
    canLinkDependency,
    canSetParent,
    openRecord,
    closeRecord,
    resolveRecord,
    syncRecordFromLocation
  };

  syncRecordFromLocation();
  ensure();
})();
