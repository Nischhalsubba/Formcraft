'use strict';

(() => {
  const taskProjectName = task => projectById(task.projectId)?.name || 'No project';
  const memberName = id => state.team.find(member => member.id === id || member.userId === id)?.name || 'Unassigned';

  function emptyMarkup(title, copy) {
    return `<div class="product-empty"><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></div></div>`;
  }

  function dueBadge(task, todayKey) {
    if (!task.dueDate) return '<span class="product-due">No due date</span>';
    if (task.dueDate < todayKey) return `<span class="product-due is-overdue">Overdue · ${formatShortDate(task.dueDate)}</span>`;
    if (task.dueDate === todayKey) return '<span class="product-due is-today">Due today</span>';
    return `<span class="product-due">${formatShortDate(task.dueDate)}</span>`;
  }

  function taskRows(tasks, todayKey) {
    if (!tasks.length) return emptyMarkup('Nothing urgent', 'No overdue or upcoming tasks need attention.');
    return `<div class="product-list">${tasks.map(task => `
      <div class="product-task-row">
        <input class="email-check" type="checkbox" data-toggle-task="${escapeHtml(task.id)}" aria-label="Complete ${escapeHtml(task.title)}">
        <button class="product-task-button" type="button" data-edit-task="${escapeHtml(task.id)}">
          <span class="product-row-copy"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(taskProjectName(task))} · ${escapeHtml(memberName(task.assigneeId))}</span></span>
        </button>
        ${dueBadge(task, todayKey)}
      </div>`).join('')}</div>`;
  }

  function eventRows(events) {
    if (!events.length) return emptyMarkup('No upcoming events', 'Schedule a meeting, review, or deadline from the calendar.');
    return `<div class="product-list">${events.map(event => {
      const date = new Date(`${event.date}T12:00:00`);
      const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
      const day = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(date);
      const project = projectById(event.projectId)?.name || titleCase(event.category || 'event');
      return `<button class="product-event-row" type="button" data-event-id="${escapeHtml(event.id)}">
        <span class="product-event-date"><span>${escapeHtml(month)}</span><strong>${escapeHtml(day)}</strong></span>
        <span class="product-row-copy"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(project)}${event.location ? ` · ${escapeHtml(event.location)}` : ''}</span></span>
        <span class="product-row-meta">${escapeHtml(event.time || 'All day')}</span>
      </button>`;
    }).join('')}</div>`;
  }

  function projectTable(projects) {
    if (!projects.length) return emptyMarkup('No active projects', 'Create a project to connect tasks, events, files, and invoices.');
    return `<div class="product-project-table"><table>
      <thead><tr><th>Project</th><th>Owner</th><th>Status</th><th>Progress</th><th>Due</th><th><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${projects.map(project => `<tr>
        <td><button class="text-button" type="button" data-view-project="${escapeHtml(project.id)}">${escapeHtml(project.name)}</button><small>${escapeHtml(project.client || 'Internal')}</small></td>
        <td>${escapeHtml(memberName(project.ownerId))}</td>
        <td>${statusPill(project.status)}</td>
        <td><div class="table-progress"><div class="progress-track"><span style="width:${clamp(Number(project.progress) || 0, 0, 100)}%"></span></div><span>${clamp(Number(project.progress) || 0, 0, 100)}%</span></div></td>
        <td>${project.dueDate ? formatShortDate(project.dueDate) : 'Not set'}</td>
        <td><button class="action-button" type="button" data-edit-project="${escapeHtml(project.id)}" aria-label="Edit ${escapeHtml(project.name)}">${icon('edit', 16)}</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  function activityRows(items) {
    if (!items.length) return emptyMarkup('No activity yet', 'Changes to projects, tasks, events, and invoices appear here.');
    return `<div class="product-list">${items.map(item => `<div class="product-activity-row">
      <span class="product-activity-dot" aria-hidden="true"></span>
      <span class="product-row-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.copy || titleCase(item.type || 'workspace'))}</span></span>
      <time class="product-row-meta" datetime="${escapeHtml(item.at || '')}">${item.at ? formatDateTime(item.at) : ''}</time>
    </div>`).join('')}</div>`;
  }

  function summaryItem(value, label) {
    return `<div class="product-summary-item"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
  }

  renderDashboard = function renderBrightTaskFirstDashboard() {
    const todayKey = dateKey(today());
    const nextWeekKey = dateKey(addDays(7));
    const openTasks = state.tasks.filter(task => task.status !== 'done');
    const urgentTasks = openTasks
      .filter(task => task.dueDate && task.dueDate <= nextWeekKey)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      .slice(0, 7);
    const upcomingEvents = state.events
      .filter(event => event.date >= todayKey)
      .sort((a, b) => `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`))
      .slice(0, 5);
    const activeProjects = state.projects
      .filter(project => project.status !== 'completed')
      .sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'))
      .slice(0, 6);
    const outstanding = state.invoices
      .filter(invoice => !['paid', 'void'].includes(invoice.status))
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const overdueCount = openTasks.filter(task => task.dueDate && task.dueDate < todayKey).length;
    const todayCount = openTasks.filter(task => task.dueDate === todayKey).length;

    return `<div class="content-shell dashboard-content product-dashboard">
      <section class="product-today-grid" aria-label="Today and upcoming schedule">
        <article class="product-panel">
          <div class="product-panel-head"><div><h2>Today</h2><p>${overdueCount} overdue · ${todayCount} due today · showing the next seven days</p></div><button class="text-button" type="button" data-route-jump="tasks">View all tasks</button></div>
          ${taskRows(urgentTasks, todayKey)}
        </article>
        <article class="product-panel">
          <div class="product-panel-head"><div><h2>Upcoming</h2><p>Your next meetings, reviews, and deadlines.</p></div><button class="text-button" type="button" data-route-jump="calendar">Calendar</button></div>
          ${eventRows(upcomingEvents)}
        </article>
      </section>

      <section class="product-panel">
        <div class="product-panel-head"><div><h2>Active projects</h2><p>Ownership, delivery status, progress, and deadlines.</p></div><button class="text-button" type="button" data-route-jump="projects">View all projects</button></div>
        ${projectTable(activeProjects)}
      </section>

      <section class="product-summary-strip" aria-label="Workspace summary">
        ${summaryItem(state.projects.filter(project => project.status !== 'completed').length, 'Active projects')}
        ${summaryItem(openTasks.length, 'Open tasks')}
        ${summaryItem(money(outstanding), 'Outstanding invoices')}
        ${summaryItem(state.team.filter(member => !member.pending).length, 'Team members')}
      </section>

      <section class="product-dashboard-bottom">
        <article class="product-panel">
          <div class="product-panel-head"><div><h2>Recent activity</h2><p>The latest meaningful workspace changes.</p></div><button class="text-button" type="button" data-route-jump="activity">View history</button></div>
          ${activityRows(state.activity.slice(0, 6))}
        </article>
        <article class="product-panel">
          <div class="product-panel-head"><div><h2>Quick actions</h2><p>Create only the records that move work forward.</p></div></div>
          <div class="command-grid">
            <button class="command-button" type="button" data-bright-dashboard-command="projects">${icon('projects', 20)}<strong>New project</strong><span>Define scope and ownership</span></button>
            <button class="command-button" type="button" data-bright-dashboard-command="tasks">${icon('tasks', 20)}<strong>New task</strong><span>Assign the next action</span></button>
            <button class="command-button" type="button" data-bright-dashboard-command="calendar">${icon('calendar', 20)}<strong>New event</strong><span>Schedule a review or deadline</span></button>
            <button class="command-button" type="button" data-bright-dashboard-command="invoices">${icon('invoices', 20)}<strong>New invoice</strong><span>Record billing and due dates</span></button>
          </div>
        </article>
      </section>
    </div>`;
  };

  const previousBindPage = bindPage;
  bindPage = function bindBrightDashboard() {
    previousBindPage();
    $$('[data-bright-dashboard-command]').forEach(button => button.addEventListener('click', () => {
      const actions = {
        projects: openProjectForm,
        tasks: openTaskForm,
        calendar: openEventForm,
        invoices: openInvoiceForm
      };
      actions[button.dataset.brightDashboardCommand]?.();
    }));
  };

  document.documentElement.classList.add('formcraft-bright-dashboard');
  if (document.documentElement.dataset.backend === 'ready') renderShell();
})();
