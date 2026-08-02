'use strict';

(() => {
  const VERSION = 'OPS-NP-1.0';
  const STATUSES = ['backlog', 'todo', 'progress', 'review', 'blocked', 'done'];
  const PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];
  const TYPES = ['story', 'task', 'bug', 'milestone'];
  const base = {
    renderShell,
    renderTasks,
    renderReports: typeof renderReports === 'function' ? renderReports : null,
    openModal,
    closeModal,
    openInvoiceForm,
    openEventForm,
    logActivity,
    toggleTask
  };
  const record = {
    type: '', id: '', projectTab: 'work', taskView: 'list', query: '', status: 'all', assignee: 'all'
  };
  const arr = value => Array.isArray(value) ? value : [];
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = value => Math.round((num(value) + Number.EPSILON) * 100) / 100;
  const now = () => new Date().toISOString();
  const currentUserId = () => window.FormcraftBackend?.session?.user?.id || '';
  const canEdit = () => window.FormcraftBackend?.role !== 'viewer';
  const safeCode = (value, fallback = 'PRJ') => String(value || '').toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 10) || fallback;
  const codeFromName = (name, index = 0) => safeCode(String(name || '').trim().split(/\s+/).filter(Boolean)
    .slice(0, 4).map(word => word[0]).join(''), `PRJ${index + 1}`);
  const normalizeStatus = value => ({ 'in-progress': 'progress', active: 'progress', completed: 'done', closed: 'done' }[value]
    || (STATUSES.includes(value) ? value : 'todo'));
  const normalizePriority = value => PRIORITIES.includes(value) ? value : ({ urgent: 'highest' }[value] || 'medium');
  const statusLabel = value => ({ backlog: 'Backlog', todo: 'To do', progress: 'In progress', review: 'In review', blocked: 'Blocked', done: 'Done' }[value] || titleCase(value || 'todo'));
  const priorityLabel = value => ({ lowest: 'Lowest', low: 'Low', medium: 'Medium', high: 'High', highest: 'Highest' }[value] || titleCase(value || 'medium'));
  const typeLabel = value => ({ story: 'Story', task: 'Task', bug: 'Bug', milestone: 'Milestone' }[value] || 'Task';
  const memberName = id => state.team.find(member => member.id === id || member.userId === id)?.name || 'Unassigned';
  const projectFor = task => state.projects.find(project => project.id === task?.projectId) || null;
  const npr = invoice => {
    const amount = num(invoice?.total ?? invoice?.amount);
    return (invoice?.currency || 'NPR') === 'NPR' ? amount : num(invoice?.nprEquivalent || amount * num(invoice?.exchangeRate || 1));
  };
  const moneyNpr = value => typeof nprMoney === 'function' ? nprMoney(value) : `NPR ${round(value).toFixed(2)}`;
  const dual = value => !value ? '—' : (typeof dualDate === 'function' ? dualDate(value, { short: true }) : formatShortDate(value));
  const statusBadge = value => `<span class="ops-status-badge" data-status="${escapeHtml(value)}">${escapeHtml(statusLabel(value))}</span>`;
  const priorityBadge = value => `<span class="ops-priority-badge" data-priority="${escapeHtml(value)}">${escapeHtml(priorityLabel(value))}</span>`;
  const typeBadge = value => `<span class="ops-type-badge" data-type="${escapeHtml(value)}">${escapeHtml(typeLabel(value))}</span>`;

  function ensure() {
    if (!state || typeof state !== 'object') return;
    for (const key of ['projects', 'tasks', 'events', 'invoices', 'files', 'activity', 'team']) state[key] = arr(state[key]);
    state.timeEntries = arr(state.timeEntries);
    state.settings ||= {};
    state.settings.operations = {
      version: VERSION, globalTaskView: 'list', globalTaskProject: 'all', globalTaskStatus: 'all', globalTaskAssignee: 'all',
      ...(state.settings.operations || {}), version: VERSION
    };
    const codes = new Map();
    state.projects.forEach((project, index) => {
      project.code = safeCode(project.code || codeFromName(project.name, index), `PRJ${index + 1}`);
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
      codes.set(project.id, project.code);
    });
    const counters = new Map();
    state.tasks.forEach((task, index) => {
      task.status = normalizeStatus(task.status);
      task.priority = normalizePriority(task.priority);
      task.issueType = TYPES.includes(task.issueType) ? task.issueType : 'task';
      task.assigneeId ||= '';
      task.reporterId ||= currentUserId();
      task.parentTaskId ||= '';
      task.dependencyIds = arr(task.dependencyIds).filter(id => id && id !== task.id);
      task.labels = arr(task.labels);
      task.checklist = arr(task.checklist);
      task.comments = arr(task.comments);
      task.estimateHours = num(task.estimateHours);
      task.storyPoints = num(task.storyPoints);
      task.billable = Boolean(task.billable);
      task.startDate ||= task.createdAt?.slice(0, 10) || dateKey(today());
      task.dueDate ||= dateKey(addDays(7));
      task.description ||= '';
      task.acceptanceCriteria ||= '';
      task.createdAt ||= now();
      task.updatedAt ||= task.createdAt;
      task.completedAt = task.status === 'done' ? (task.completedAt || task.updatedAt) : null;
      const projectCode = codes.get(task.projectId) || 'TASK';
      const next = (counters.get(task.projectId) || 0) + 1;
      counters.set(task.projectId, next);
      task.key ||= `${projectCode}-${String(next).padStart(3, '0')}`;
      task.title ||= `Untitled task ${index + 1}`;
    });
    state.timeEntries.forEach(entry => {
      entry.hours = round(entry.hours);
      entry.billable = Boolean(entry.billable);
      entry.date ||= dateKey(today());
      entry.createdAt ||= now();
    });
    syncAll();
  }

  const projectTasks = projectId => state.tasks.filter(task => task.projectId === projectId);
  const taskHours = taskId => round(state.timeEntries.filter(entry => entry.taskId === taskId).reduce((sum, entry) => sum + num(entry.hours), 0));
  const projectHours = projectId => round(state.timeEntries.filter(entry => entry.projectId === projectId).reduce((sum, entry) => sum + num(entry.hours), 0));
  const projectBillableHours = projectId => round(state.timeEntries.filter(entry => entry.projectId === projectId && entry.billable).reduce((sum, entry) => sum + num(entry.hours), 0));

  function syncProject(project) {
    const tasks = projectTasks(project.id);
    if (project.progressMode !== 'manual') {
      const total = tasks.reduce((sum, task) => sum + (task.estimateHours || 1), 0);
      const done = tasks.filter(task => task.status === 'done').reduce((sum, task) => sum + (task.estimateHours || 1), 0);
      project.progress = total ? Math.round(done / total * 100) : 0;
    }
    project.progress = Math.max(0, Math.min(100, num(project.progress)));
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
    const billed = invoices.filter(invoice => invoice.documentType !== 'proforma').reduce((sum, invoice) => sum + npr(invoice), 0);
    const paid = invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + npr(invoice), 0);
    return {
      tasks, invoices, events, files,
      completed: tasks.filter(task => task.status === 'done').length,
      blocked: tasks.filter(task => task.status === 'blocked').length,
      overdue: tasks.filter(task => task.status !== 'done' && task.dueDate && task.dueDate < dateKey(today())).length,
      estimateHours: round(tasks.reduce((sum, task) => sum + num(task.estimateHours), 0)),
      loggedHours: projectHours(project.id), billableHours: projectBillableHours(project.id),
      billed, paid, outstanding: Math.max(0, billed - paid)
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

  function clearSurface() {
    delete modal.dataset.surface;
    modal.removeAttribute('aria-modal');
    document.body.classList.remove('ops-record-open');
  }
  closeModal = function closeOpsModal() {
    const wasRecord = modal.dataset.surface === 'record';
    base.closeModal();
    clearSurface();
    if (wasRecord) Object.assign(record, { type: '', id: '' });
  };
  function showRecord(markup, type = '', id = '') {
    if (modal.open) base.closeModal();
    modalContent.innerHTML = markup;
    modal.dataset.surface = 'record';
    modal.setAttribute('aria-modal', 'false');
    document.body.classList.add('ops-record-open');
    Object.assign(record, { type, id });
    modal.show();
    $$('[data-close-modal]', modal).forEach(button => button.addEventListener('click', closeModal));
    requestAnimationFrame(() => modal.querySelector('#modal-title')?.focus({ preventScroll: true }));
  }
  openModal = function openOpsModal(markup) {
    if (String(markup).includes('full-detail-view')) return showRecord(markup);
    if (modal.open) base.closeModal();
    clearSurface();
    base.openModal(markup);
    modal.dataset.surface = /form-modal|<form[\s>]/i.test(String(markup)) ? 'form' : 'dialog';
  };
  modal.addEventListener('click', event => {
    if (event.target === modal && ['record', 'form'].includes(modal.dataset.surface)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  modal.addEventListener('cancel', event => {
    if (modal.dataset.surface === 'form') {
      event.preventDefault();
      toast('Use Cancel or Close so unfinished changes are not discarded accidentally.', 'warning');
    }
  }, true);
  modal.addEventListener('close', clearSurface);

  logActivity = function logOpsActivity(type, title, copy, metadata = {}) {
    base.logActivity(type, title, copy);
    if (state.activity?.[0] && metadata && typeof metadata === 'object') Object.assign(state.activity[0], metadata);
  };

  window.FormcraftOpsCore = {
    VERSION, STATUSES, PRIORITIES, TYPES, base, record, arr, num, round, now, currentUserId, canEdit,
    safeCode, codeFromName, normalizeStatus, normalizePriority, statusLabel, priorityLabel, typeLabel,
    memberName, projectFor, npr, moneyNpr, dual, statusBadge, priorityBadge, typeBadge,
    ensure, projectTasks, taskHours, projectHours, projectBillableHours, syncProject, syncAll, health, metrics,
    nextTaskKey, showRecord
  };
  ensure();
})();
