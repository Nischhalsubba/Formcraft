'use strict';

function renderDashboard() {
    const done = state.tasks.filter(task => task.status === 'done').length;
    const open = state.tasks.length - done;
    const active = state.projects.filter(project => ['active', 'review'].includes(project.status)).length;
    const average = state.projects.length ? Math.round(state.projects.reduce((sum, project) => sum + Number(project.progress), 0) / state.projects.length) : 0;
    const overdue = state.tasks.filter(task => task.status !== 'done' && task.dueDate < dateKey(today())).length;
    const dueToday = state.tasks.filter(task => task.status !== 'done' && task.dueDate === dateKey(today())).length;
    const query = ui.query.trim().toLowerCase();
    const projects = state.projects.filter(project => !query || `${project.name} ${project.client} ${project.description}`.toLowerCase().includes(query)).slice(0, 6);
    const matchingTasks = state.tasks.filter(task => !query || `${task.title} ${projectById(task.projectId)?.name || ''}`.toLowerCase().includes(query)).slice(0, 6);
    const searchResultCount = projects.length + matchingTasks.length;
    return `<div class="content-shell dashboard-content page-stack">
      <section class="metric-grid" aria-label="Workspace metrics">
        ${metricCard('Active projects', active, 'projects', 'info', `${state.projects.length} total projects`, state.projects.length ? active / state.projects.length * 100 : 0)}
        ${metricCard('Open tasks', open, 'tasks', 'success', `${done} completed`, state.tasks.length ? done / state.tasks.length * 100 : 0)}
        ${metricCard('Team members', state.team.length, 'team', 'info', `${state.team.length} workspace members`, 100)}
        ${metricCard('Average progress', `${average}%`, 'reports', 'warning', average >= 60 ? 'Healthy delivery pace' : 'Needs attention', average)}
      </section>
      <div class="toolbar"><div>${searchToolbar('Search projects or tasks')}</div><p class="toolbar-summary" data-search-summary>${query ? `${searchResultCount} matching project and task results` : 'Showing the latest workspace activity'}</p></div>
      ${query ? dashboardSearchResults(projects, matchingTasks) : ''}
      <section class="dashboard-grid">
        <article class="panel"><div class="panel-head"><div class="panel-title-group"><p class="panel-kicker">Performance</p><h2>Project activity</h2><p class="panel-description">Tasks created and completed during the last seven days.</p></div></div>${activityChart()}</article>
        <article class="panel focus-card"><div><p class="panel-kicker">Today</p><h2>Delivery focus</h2><p class="panel-description">A clear view of today’s workload without decorative guesswork.</p></div><div class="progress-ring" style="--progress:${state.tasks.length ? Math.round(done / state.tasks.length * 100) : 0}%"><strong>${state.tasks.length ? Math.round(done / state.tasks.length * 100) : 0}%</strong></div><div class="focus-stats"><div class="focus-stat"><strong>${dueToday}</strong><span>Due today</span></div><div class="focus-stat"><strong>${overdue}</strong><span>Overdue</span></div></div></article>
      </section>
      <section class="dashboard-grid equal">
        <article class="panel"><div class="panel-head"><div class="panel-title-group"><p class="panel-kicker">Workstream</p><h2>Active projects</h2></div><button class="text-button" type="button" data-route-jump="projects">View all</button></div>${dashboardProjectTable(projects)}</article>
        <article class="panel panel-compact"><div class="panel-head"><div class="panel-title-group"><p class="panel-kicker">Updates</p><h2>Recent activity</h2></div></div>${activityList(state.activity.slice(0, 5))}</article>
      </section>
    </div>`;
  }

  function metricCard(label, value, iconName, tone, foot, progress) {
    return `<article class="metric-card" data-tone="${tone}"><div class="metric-header"><span class="metric-label">${escapeHtml(label)}</span><span class="metric-icon">${icon(iconName, 20)}</span></div><p class="metric-value">${escapeHtml(value)}</p><div class="metric-foot"><span>${escapeHtml(foot)}</span><span class="metric-progress" style="color:var(--${tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'primary'})"><span style="width:${clamp(progress, 0, 100)}%"></span></span></div></article>`;
  }

  function activityChart() {
    const days = Array.from({ length: 7 }, (_, index) => addDays(index - 6));
    const created = days.map(day => state.tasks.filter(task => task.dueDate === dateKey(day)).length);
    const completedTotal = state.tasks.filter(task => task.status === 'done').length;
    const completed = days.map((_, index) => index === days.length - 1 ? completedTotal : Math.max(0, completedTotal - (days.length - 1 - index)));
    const max = Math.max(4, ...created, ...completed);
    const ticks = [max, Math.round(max * .67), Math.round(max * .33), 0];
    return `<div class="chart-shell"><div class="chart-axis"><div class="chart-y-axis">${ticks.map(tick => `<span>${tick}</span>`).join('')}</div><div class="chart-plot">${days.map((day, index) => `<div class="chart-day"><div class="chart-bars"><span class="chart-bar secondary" style="height:${created[index] / max * 100}%" title="${created[index]} tasks due"></span><span class="chart-bar" style="height:${completed[index] / max * 100}%" title="${completed[index]} completed tasks"></span></div><span class="chart-day-label">${new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(day)}</span></div>`).join('')}</div></div><div class="chart-legend"><span><i class="legend-dot"></i>Completed</span><span><i class="legend-dot secondary"></i>Tasks due</span></div><p class="chart-summary">${completedTotal} of ${state.tasks.length} tasks are complete. The chart is also summarized in text for assistive technology.</p><table class="sr-only"><caption>Project activity for the last seven days</caption><thead><tr><th>Day</th><th>Tasks due</th><th>Completed total</th></tr></thead><tbody>${days.map((day, index) => `<tr><td>${new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(day)}</td><td>${created[index]}</td><td>${completed[index]}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function dashboardSearchResults(projects, tasks) {
    if (!projects.length && !tasks.length) return emptyState('search', 'No matching workspace items', 'Try another search term.');
    return `<section class="panel"><div class="panel-head"><div><p class="panel-kicker">Search results</p><h2>Projects and tasks</h2></div></div><div class="search-results-grid"><div><h3 class="result-heading">Projects</h3>${projects.length ? projects.map(project => `<button class="search-result" type="button" data-view-project="${project.id}"><span class="metric-icon">${icon('projects', 17)}</span><span><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.client)}</small></span>${icon('arrowRight', 16)}</button>`).join('') : '<p class="panel-description">No projects match.</p>'}</div><div><h3 class="result-heading">Tasks</h3>${tasks.length ? tasks.map(task => `<button class="search-result" type="button" data-edit-task="${task.id}"><span class="metric-icon">${icon('tasks', 17)}</span><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(projectById(task.projectId)?.name || 'Unassigned')}</small></span>${icon('arrowRight', 16)}</button>`).join('') : '<p class="panel-description">No tasks match.</p>'}</div></div></section>`;
  }

  function dashboardProjectTable(projects) {
    if (!projects.length) return emptyState('projects', 'No matching projects', 'Clear the search or create a new project.');
    return `<div class="table-container"><div class="table-scroll"><table><thead><tr><th>Project</th><th>Status</th><th>Progress</th><th>Due</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${projects.map(project => `<tr><td><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.client)}</small></td><td>${statusPill(project.status)}</td><td><div class="table-progress"><div class="progress-track"><span style="width:${project.progress}%"></span></div><span>${project.progress}%</span></div></td><td>${formatShortDate(project.dueDate)}</td><td><button class="action-button" type="button" data-edit-project="${project.id}" aria-label="Edit ${escapeHtml(project.name)}" title="Edit project">${icon('edit', 17)}</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function renderProjects() {
    const query = ui.query.trim().toLowerCase();
    let projects = state.projects.filter(project => (ui.projectFilter === 'all' || project.status === ui.projectFilter) && (!query || `${project.name} ${project.client} ${project.description}`.toLowerCase().includes(query)));
    projects = [...projects].sort((a, b) => ui.projectSort === 'progress' ? b.progress - a.progress : ui.projectSort === 'client' ? a.client.localeCompare(b.client) : a.dueDate.localeCompare(b.dueDate));
    return `<div class="content-shell page-stack"><div class="toolbar"><div class="toolbar-group">${searchToolbar('Search projects')}<div class="filter-group">${['all', 'active', 'review', 'completed'].map(filter => `<button class="filter-chip ${ui.projectFilter === filter ? 'is-active' : ''}" type="button" data-project-filter="${filter}">${filter === 'all' ? 'All' : titleCase(filter)}</button>`).join('')}</div></div><div class="toolbar-group"><label class="sr-only" for="project-sort">Sort projects</label><select id="project-sort" class="select-control" data-project-sort><option value="due" ${ui.projectSort === 'due' ? 'selected' : ''}>Due date</option><option value="progress" ${ui.projectSort === 'progress' ? 'selected' : ''}>Progress</option><option value="client" ${ui.projectSort === 'client' ? 'selected' : ''}>Client</option></select><button class="icon-button small" type="button" data-project-view="grid" aria-label="Grid view" title="Grid view">${icon('grid', 17)}</button><button class="icon-button small" type="button" data-project-view="list" aria-label="List view" title="List view">${icon('list', 17)}</button></div></div><p class="toolbar-summary">${projects.length} project${projects.length === 1 ? '' : 's'} shown</p>${projects.length ? `<div class="project-board ${ui.projectView === 'list' ? 'is-list' : ''}">${projects.map(projectCard).join('')}</div>` : emptyState('projects', 'No projects found', 'Adjust the filter or create a project.')}</div>`;
  }

  function projectCard(project) {
    return `<article class="project-card"><div class="project-card-head"><span class="project-symbol">${escapeHtml(project.name.slice(0, 2).toUpperCase())}</span>${overflowMenu([{ label: 'View details', icon: 'eye', action: 'view-project', id: project.id }, { label: 'Edit project', icon: 'edit', action: 'edit-project', id: project.id }, { label: 'Delete project', icon: 'trash', action: 'delete-project', id: project.id, danger: true }], `Actions for ${project.name}`)}</div><div><h2>${escapeHtml(project.name)}</h2><p class="project-description">${escapeHtml(project.description || 'No description provided.')}</p></div><div class="project-card-footer"><div class="meta-row"><span>${statusPill(project.status)}</span><span>${formatShortDate(project.dueDate)}</span></div><div class="progress-track" aria-label="${project.progress}% complete"><span style="width:${project.progress}%"></span></div><div class="meta-row"><span>${escapeHtml(project.client)}</span><strong>${project.progress}%</strong></div><button class="card-link" type="button" data-view-project="${project.id}">Open project ${icon('arrowRight', 15)}</button></div></article>`;
  }

  function renderTasks() {
    const query = ui.query.trim().toLowerCase();
    const tasks = state.tasks.filter(task => (ui.taskFilter === 'all' || task.status === ui.taskFilter) && (!query || `${task.title} ${projectById(task.projectId)?.name || ''}`.toLowerCase().includes(query)));
    return `<div class="content-shell page-stack"><div class="toolbar"><div class="toolbar-group">${searchToolbar('Search tasks')}<div class="filter-group">${['all', 'todo', 'progress', 'done'].map(filter => `<button class="filter-chip ${ui.taskFilter === filter ? 'is-active' : ''}" type="button" data-task-filter="${filter}">${filter === 'all' ? 'All tasks' : titleCase(filter)}</button>`).join('')}</div></div><p class="toolbar-summary">${tasks.length} task${tasks.length === 1 ? '' : 's'} shown</p></div>${tasks.length ? `<section class="panel desktop-table"><div class="table-container"><div class="table-scroll"><table><thead><tr><th><span class="sr-only">Complete</span></th><th>Task</th><th>Project</th><th>Priority</th><th>Due</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${tasks.map(taskRow).join('')}</tbody></table></div></div></section><div class="mobile-card-list">${tasks.map(taskCard).join('')}</div>` : emptyState('tasks', 'No tasks found', 'Create a task or change the active filter.')}</div>`;
  }

  function taskRow(task) {
    const project = projectById(task.projectId);
    return `<tr class="${task.status === 'done' ? 'is-complete' : ''}"><td><input class="email-check" type="checkbox" data-toggle-task="${task.id}" ${task.status === 'done' ? 'checked' : ''} aria-label="Mark ${escapeHtml(task.title)} as ${task.status === 'done' ? 'open' : 'complete'}"></td><td><strong ${task.status === 'done' ? 'style="text-decoration:line-through;opacity:.65"' : ''}>${escapeHtml(task.title)}</strong></td><td>${escapeHtml(project?.name || 'Unassigned')}</td><td>${priorityPill(task.priority)}</td><td>${formatShortDate(task.dueDate)}</td><td>${statusPill(task.status)}</td><td>${overflowMenu([{ label: 'Edit task', icon: 'edit', action: 'edit-task', id: task.id }, { label: 'Delete task', icon: 'trash', action: 'delete-task', id: task.id, danger: true }], `Actions for ${task.title}`)}</td></tr>`;
  }

  function taskCard(task) {
    const project = projectById(task.projectId);
    return `<article class="task-card ${task.status === 'done' ? 'is-complete' : ''}"><div class="task-card-head"><div><h3>${escapeHtml(task.title)}</h3><p class="panel-description">${escapeHtml(project?.name || 'Unassigned')}</p></div><input class="email-check" type="checkbox" data-toggle-task="${task.id}" ${task.status === 'done' ? 'checked' : ''} aria-label="Mark ${escapeHtml(task.title)} as ${task.status === 'done' ? 'open' : 'complete'}"></div><div class="task-card-meta"><span>${priorityPill(task.priority)}</span><span>${statusPill(task.status)}</span><span>Due ${formatDate(task.dueDate)}</span></div><div class="task-card-actions"><button class="button button-secondary button-small" type="button" data-edit-task="${task.id}">${icon('edit', 15)}Edit</button><button class="button button-secondary button-small" type="button" data-delete-task="${task.id}">${icon('trash', 15)}Delete</button></div></article>`;
  }

  function renderTeam() {
    const query = ui.query.trim().toLowerCase();
    const members = state.team.filter(member => !query || `${member.name} ${member.email} ${member.role}`.toLowerCase().includes(query));
    return `<div class="content-shell page-stack"><div class="toolbar"><div>${searchToolbar('Search team members')}</div><p class="toolbar-summary">${members.length} member${members.length === 1 ? '' : 's'}</p></div><div class="team-grid">${members.map(member => `<article class="member-card"><span class="member-avatar">${escapeHtml(member.initials)}</span><div><h2>${escapeHtml(member.name)}</h2><p>${escapeHtml(member.email)}</p></div><div>${rolePill(member.role)}${member.role !== 'owner' ? overflowMenu([{ label: 'Change role', icon: 'edit', action: 'edit-member', id: member.id }, { label: 'Remove member', icon: 'trash', action: 'remove-member', id: member.id, danger: true }], `Actions for ${member.name}`) : ''}</div></article>`).join('')}</div></div>`;
  }

  function renderReports() {
    const periodDays = Number(ui.reportPeriod);
    const total = state.tasks.length;
    const distribution = ['todo', 'progress', 'done'].map(status => ({ status, count: state.tasks.filter(task => task.status === status).length }));
    const overdue = state.tasks.filter(task => task.status !== 'done' && task.dueDate < dateKey(today())).length;
    const average = state.projects.length ? Math.round(state.projects.reduce((sum, project) => sum + project.progress, 0) / state.projects.length) : 0;
    return `<div class="content-shell page-stack"><div class="toolbar"><div><p class="panel-kicker">Reporting period</p><h2 style="margin:4px 0 0">Last ${periodDays} days</h2></div><select class="select-control" data-report-period aria-label="Report period"><option value="7" ${ui.reportPeriod === '7' ? 'selected' : ''}>Last 7 days</option><option value="30" ${ui.reportPeriod === '30' ? 'selected' : ''}>Last 30 days</option><option value="90" ${ui.reportPeriod === '90' ? 'selected' : ''}>Last 90 days</option></select></div><div class="report-grid"><article class="panel"><div class="panel-head"><div><p class="panel-kicker">Delivery</p><h2>Completion by project</h2><p class="panel-description">The amber marker represents an 80% target.</p></div></div><div class="report-bars">${state.projects.map(project => `<div class="report-row"><strong>${escapeHtml(project.name)}</strong><div class="report-track"><span style="width:${project.progress}%"></span><i class="report-target" style="left:80%" aria-hidden="true"></i></div><span>${project.progress}%</span></div>`).join('')}</div></article><article class="panel"><div class="panel-head"><div><p class="panel-kicker">Distribution</p><h2>Tasks by status</h2><p class="panel-description">${total} tasks across the current workspace.</p></div></div><div class="distribution-bar" aria-label="Task status distribution">${distribution.map(item => `<span style="width:${total ? item.count / total * 100 : 0}%;background:var(--${item.status === 'done' ? 'success' : item.status === 'progress' ? 'primary' : 'warning'})"></span>`).join('')}</div><div class="distribution-legend">${distribution.map(item => `<div class="distribution-row"><span><i class="legend-dot" style="background:var(--${item.status === 'done' ? 'success' : item.status === 'progress' ? 'primary' : 'warning'})"></i>${titleCase(item.status)}</span><strong>${item.count} · ${total ? Math.round(item.count / total * 100) : 0}%</strong></div>`).join('')}</div></article></div><section class="panel"><div class="panel-head"><div><p class="panel-kicker">Summary</p><h2>Workspace report</h2></div></div><div class="summary-grid"><div class="summary-card"><strong>${state.projects.length}</strong><span>Projects</span></div><div class="summary-card"><strong>${state.tasks.filter(task => task.status === 'done').length}</strong><span>Tasks completed</span></div><div class="summary-card"><strong>${overdue}</strong><span>Overdue tasks</span></div><div class="summary-card"><strong>${average}%</strong><span>Average progress</span></div></div></section></div>`;
  }

  function renderCalendar() {
    const year = ui.calendarMonth.getFullYear();
    const month = ui.calendarMonth.getMonth();
    const start = new Date(year, month, 1 - new Date(year, month, 1).getDay());
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const key = dateKey(day);
      const events = state.events.filter(event => event.date === key).sort((a, b) => a.time.localeCompare(b.time));
      const visible = events.slice(0, 3);
      cells.push(`<div class="calendar-day ${day.getMonth() !== month ? 'is-outside' : ''} ${key === dateKey(today()) ? 'is-today' : ''}"><button class="calendar-date-button" type="button" data-new-event-date="${key}" aria-label="Create event on ${formatDate(key)}">${day.getDate()}</button>${visible.map(event => eventButton(event)).join('')}${events.length > 3 ? `<button class="calendar-more" type="button" data-show-day="${key}">+${events.length - 3} more</button>` : ''}</div>`);
    }
    const monthEvents = state.events.filter(event => new Date(`${event.date}T00:00:00`).getMonth() === month && new Date(`${event.date}T00:00:00`).getFullYear() === year).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    const grouped = Object.groupBy ? Object.groupBy(monthEvents, event => event.date) : monthEvents.reduce((groups, event) => ((groups[event.date] ||= []).push(event), groups), {});
    return `<div class="content-shell page-stack"><div class="toolbar calendar-toolbar"><div><p class="panel-kicker">Month view</p><h2 class="calendar-title">${new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(ui.calendarMonth)}</h2></div><div class="toolbar-group"><button class="icon-button" type="button" data-calendar-prev aria-label="Previous month">${icon('chevronLeft', 18)}</button><button class="button button-secondary" type="button" data-calendar-today>Today</button><button class="icon-button" type="button" data-calendar-next aria-label="Next month">${icon('chevronRight', 18)}</button></div></div><div class="calendar-legend"><span><i style="background:var(--primary)"></i>Meeting</span><span><i style="background:var(--warning)"></i>Review</span><span><i style="background:var(--danger)"></i>Deadline</span><span><i style="background:var(--info)"></i>Personal</span></div><div class="calendar-shell"><div class="calendar-head">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<span>${day}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div></div><div class="agenda-list">${Object.entries(grouped).length ? Object.entries(grouped).map(([date, events]) => `<section class="agenda-day"><h3>${formatDate(date)}</h3>${events.map(event => `<button class="agenda-event" type="button" data-event-id="${event.id}"><span><strong>${escapeHtml(event.title)}</strong><br><small>${escapeHtml(event.category)}</small></span><time>${escapeHtml(event.time)}</time></button>`).join('')}</section>`).join('') : emptyState('calendar', 'No events this month', 'Create an event to begin planning.')}</div></div>`;
  }

  function eventButton(event) {
    const label = `${event.time ? `${event.time} ` : ''}${event.title}`;
    return `<button class="calendar-event" type="button" data-event-id="${event.id}" data-category="${escapeHtml(event.category)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
  }

  function renderEmail() {
    const folders = { inbox: 'Inbox', sent: 'Sent', drafts: 'Drafts', starred: 'Starred', archive: 'Archive', trash: 'Trash' };
    const selected = state.messages.find(message => message.id === ui.selectedEmail);
    const messages = emailFolderMessages(ui.emailFolder).filter(message => !ui.query || `${message.from} ${message.to} ${message.subject} ${message.body}`.toLowerCase().includes(ui.query.toLowerCase()));
    return `<div class="content-shell page-stack"><div class="toolbar"><div>${searchToolbar('Search mail')}</div><p class="toolbar-summary">${messages.length} message${messages.length === 1 ? '' : 's'}</p></div><div class="module-layout"><aside class="module-sidebar"><nav class="folder-nav" aria-label="Email folders">${Object.entries(folders).map(([key, label]) => `<button type="button" class="${ui.emailFolder === key ? 'is-active' : ''}" data-email-folder="${key}"><span>${label}</span><small>${emailFolderMessages(key).length}</small></button>`).join('')}</nav></aside><section class="module-content">${selected ? emailReader(selected) : emailList(messages)}</section></div></div>`;
  }

  function emailFolderMessages(folder) {
    if (folder === 'starred') return state.messages.filter(message => message.starred && message.folder !== 'trash');
    return state.messages.filter(message => message.folder === folder);
  }

  function emailList(messages) {
    const selection = ui.selectedEmails.size;
    return `${selection ? `<div class="batch-toolbar"><strong>${selection} selected</strong><div class="toolbar-group"><button class="button button-secondary button-small" type="button" data-email-batch="archive">${icon('archive', 15)}Archive</button><button class="button button-secondary button-small" type="button" data-email-batch="trash">${icon('trash', 15)}Trash</button></div></div>` : ''}${messages.length ? `<div class="email-list">${messages.map(message => `<article class="email-row ${message.unread ? 'is-unread' : ''}"><input class="email-check" type="checkbox" data-select-email="${message.id}" ${ui.selectedEmails.has(message.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(message.subject)}"><button class="email-open" type="button" data-open-email="${message.id}" aria-label="Open ${escapeHtml(message.subject)}"><span class="email-sender">${message.unread ? '<i class="unread-dot"></i>' : ''}${escapeHtml(ui.emailFolder === 'sent' || ui.emailFolder === 'drafts' ? message.to : message.from)}</span><span class="email-subject">${escapeHtml(message.subject)} <span class="email-preview">— ${escapeHtml(message.body.slice(0, 80))}</span></span><time class="email-date">${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(message.date))}</time></button><button class="email-star ${message.starred ? 'is-starred' : ''}" type="button" data-star-email="${message.id}" aria-label="${message.starred ? 'Remove star from' : 'Star'} ${escapeHtml(message.subject)}">${icon('star', 17)}</button></article>`).join('')}</div>` : emptyState('mail', 'No messages', 'This folder has no messages matching the current search.')}`;
  }

  function emailReader(message) {
    return `<article class="email-reader"><div class="email-reader-head"><div><button class="text-button" type="button" data-email-back>${icon('chevronLeft', 15)} Back to ${escapeHtml(ui.emailFolder)}</button><h2>${escapeHtml(message.subject)}</h2><p class="email-reader-meta">From ${escapeHtml(message.from)} · To ${escapeHtml(message.to)} · ${formatDateTime(message.date)}</p></div><div class="email-reader-actions"><button class="button button-secondary button-small" type="button" data-email-action="unread">Mark unread</button><button class="button button-secondary button-small" type="button" data-email-action="archive">${icon('archive', 15)}Archive</button><button class="button button-secondary button-small" type="button" data-email-action="trash">${icon('trash', 15)}Trash</button></div></div><div class="email-reader-body">${escapeHtml(message.body)}</div>${message.attachments?.length ? `<div class="attachment-list">${message.attachments.map(file => `<span class="attachment-chip">${icon('paperclip', 15)}${escapeHtml(file)}</span>`).join('')}</div>` : ''}</article>`;
  }

  function renderFiles() {
    const children = state.files.filter(item => item.parentId === ui.fileFolder && (!ui.query || item.name.toLowerCase().includes(ui.query.toLowerCase())));
    const allFiles = state.files.filter(item => item.kind !== 'folder');
    return `<div class="content-shell page-stack"><div class="toolbar"><div class="toolbar-group"><div class="file-breadcrumbs">${fileBreadcrumbs()}</div>${searchToolbar('Search files')}</div><div class="toolbar-group"><button class="button button-secondary" type="button" data-create-folder>${icon('folder', 16)}New folder</button><label class="button button-primary" for="file-upload">${icon('upload', 16)}Upload files</label><input id="file-upload" type="file" multiple hidden data-file-upload></div></div><div class="file-summary"><article class="file-summary-card"><strong>${state.files.length}</strong><span>Items</span></article><article class="file-summary-card"><strong>${state.files.filter(item => item.kind === 'folder').length}</strong><span>Folders</span></article><article class="file-summary-card"><strong>${allFiles.length}</strong><span>Files</span></article><article class="file-summary-card"><strong>${humanSize(allFiles.reduce((sum, item) => sum + item.size, 0))}</strong><span>Stored metadata</span></article></div><section class="module-content">${children.length ? `<div class="file-grid">${children.map(fileCard).join('')}</div>` : emptyState('files', 'No files found', 'Try another folder or search term.')}</section></div>`;
  }

  function fileBreadcrumbs() {
    const chain = [];
    let current = state.files.find(item => item.id === ui.fileFolder);
    while (current) {
      chain.unshift(current);
      current = state.files.find(item => item.id === current.parentId);
    }
    return `<button type="button" data-file-root>Files</button>${chain.map(item => `<span>/</span><button type="button" data-file-folder="${item.id}">${escapeHtml(item.name)}</button>`).join('')}`;
  }

  function fileCard(item) {
    return `<article class="file-card"><button class="file-card-main" type="button" data-open-file="${item.id}" aria-label="${item.kind === 'folder' ? 'Open folder' : 'Open file'} ${escapeHtml(item.name)}"><span class="file-card-icon">${icon(fileIconName(item), 21)}</span><span><h2>${escapeHtml(item.name)}</h2><p>${humanSize(item.size)} · ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(item.modified))}</p></span></button><div class="file-card-actions"><button class="action-button" type="button" data-star-file="${item.id}" aria-label="${item.starred ? 'Unstar' : 'Star'} ${escapeHtml(item.name)}">${icon('star', 16)}</button>${overflowMenu([{ label: 'Rename', icon: 'edit', action: 'rename-file', id: item.id }, ...(item.kind !== 'folder' && item.persisted ? [{ label: 'Download', icon: 'download', action: 'download-file', id: item.id }] : []), { label: 'Delete', icon: 'trash', action: 'delete-file', id: item.id, danger: true }], `Actions for ${item.name}`)}</div></article>`;
  }

  function fileIconName(item) {
    if (item.kind === 'folder') return 'folder';
    if (item.kind === 'image') return 'image';
    return 'file';
  }

  function humanSize(size) {
    if (!size) return 'Folder';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderInvoices() {
    const invoices = state.invoices.filter(invoice => (ui.invoiceFilter === 'all' || invoice.status === ui.invoiceFilter) && (!ui.query || `${invoice.number} ${invoice.client} ${invoice.email}`.toLowerCase().includes(ui.query.toLowerCase())));
    const total = state.invoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const paid = state.invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const outstanding = state.invoices.filter(invoice => ['sent', 'overdue'].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    return `<div class="content-shell page-stack"><div class="toolbar"><div class="toolbar-group">${searchToolbar('Search invoices')}<select class="select-control" data-invoice-filter aria-label="Filter invoice status"><option value="all">All statuses</option>${['draft', 'sent', 'paid', 'overdue', 'void'].map(status => `<option value="${status}" ${ui.invoiceFilter === status ? 'selected' : ''}>${titleCase(status)}</option>`).join('')}</select></div><p class="toolbar-summary">${invoices.length} invoice${invoices.length === 1 ? '' : 's'}</p></div><div class="invoice-kpi-grid"><article class="invoice-kpi"><span>Total billed</span><strong>${money(total)}</strong><small>All time · USD</small></article><article class="invoice-kpi"><span>Paid</span><strong>${money(paid)}</strong><small>All time · USD</small></article><article class="invoice-kpi"><span>Outstanding</span><strong>${money(outstanding)}</strong><small>Sent and overdue · USD</small></article><article class="invoice-kpi"><span>Invoices</span><strong>${state.invoices.length}</strong><small>All statuses</small></article></div>${invoices.length ? `<section class="panel desktop-table"><div class="table-container"><div class="table-scroll"><table><thead><tr><th>Invoice</th><th>Client</th><th>Status</th><th>Due</th><th style="text-align:right">Amount</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${invoices.map(invoiceRow).join('')}</tbody></table></div></div></section><div class="mobile-card-list">${invoices.map(invoiceCard).join('')}</div>` : emptyState('invoices', 'No invoices found', 'Create an invoice or change the status filter.')}</div>`;
  }

  function invoiceRow(invoice) {
    return `<tr><td><button class="text-button" type="button" data-view-invoice="${invoice.id}">${escapeHtml(invoice.number)}</button></td><td><strong>${escapeHtml(invoice.client)}</strong><small>${escapeHtml(invoice.email)}</small></td><td>${statusPill(invoice.status)}</td><td>${formatDate(invoice.dueDate)}</td><td style="text-align:right"><strong>${money(invoice.amount)}</strong></td><td>${overflowMenu([{ label: 'View invoice', icon: 'eye', action: 'view-invoice', id: invoice.id }, { label: 'Edit invoice', icon: 'edit', action: 'edit-invoice', id: invoice.id }, ...(invoice.status !== 'paid' ? [{ label: 'Mark as paid', icon: 'check', action: 'pay-invoice', id: invoice.id }] : []), { label: 'Duplicate', icon: 'duplicate', action: 'duplicate-invoice', id: invoice.id }, { label: 'Delete invoice', icon: 'trash', action: 'delete-invoice', id: invoice.id, danger: true }], `Actions for ${invoice.number}`)}</td></tr>`;
  }

  function invoiceCard(invoice) {
    return `<article class="invoice-card"><div class="invoice-card-head"><div><h3>${escapeHtml(invoice.number)}</h3><p class="panel-description">${escapeHtml(invoice.client)}</p></div>${statusPill(invoice.status)}</div><div class="invoice-card-meta"><span>${money(invoice.amount)}</span><span>Due ${formatDate(invoice.dueDate)}</span><span>${escapeHtml(invoice.email)}</span></div><div class="invoice-card-actions"><button class="button button-secondary button-small" type="button" data-view-invoice="${invoice.id}">${icon('eye', 15)}View</button><button class="button button-secondary button-small" type="button" data-edit-invoice="${invoice.id}">${icon('edit', 15)}Edit</button>${invoice.status !== 'paid' ? `<button class="button button-secondary button-small" type="button" data-pay-invoice="${invoice.id}">${icon('check', 15)}Mark paid</button>` : ''}</div></article>`;
  }

  function renderActivity() {
    const cutoff = addDays(-Number(ui.activityPeriod));
    const items = state.activity.filter(item => (ui.activityFilter === 'all' || item.type === ui.activityFilter) && new Date(item.at) >= cutoff);
    const types = ['all', ...new Set(state.activity.map(item => item.type))];
    return `<div class="content-shell page-stack"><div class="toolbar activity-toolbar"><div class="toolbar-group"><select class="select-control" data-activity-filter aria-label="Filter activity type">${types.map(type => `<option value="${type}" ${ui.activityFilter === type ? 'selected' : ''}>${type === 'all' ? 'All activity' : titleCase(type)}</option>`).join('')}</select><select class="select-control" data-activity-period aria-label="Activity period"><option value="7" ${ui.activityPeriod === '7' ? 'selected' : ''}>Last 7 days</option><option value="30" ${ui.activityPeriod === '30' ? 'selected' : ''}>Last 30 days</option><option value="90" ${ui.activityPeriod === '90' ? 'selected' : ''}>Last 90 days</option></select></div><button class="button button-secondary" type="button" data-clear-activity>${icon('trash', 16)}Clear history</button></div><section class="panel panel-compact">${items.length ? `<div class="timeline">${items.map(item => `<div class="timeline-item"><time>${formatDateTime(item.at)}</time><span class="timeline-line"></span><div class="timeline-copy"><p><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.copy)}</p></div></div>`).join('')}</div>` : emptyState('activity', 'No activity in this period', 'Change the filters to review older workspace events.')}</section></div>`;
  }

  function renderSettings() {
    const notifications = state.settings.notifications;
    return `<div class="content-shell"><div class="settings-layout"><nav class="settings-nav" aria-label="Settings sections">${['workspace', 'appearance', 'notifications', 'data'].map(tab => `<button type="button" class="${ui.settingsTab === tab ? 'is-active' : ''}" data-settings-tab="${tab}">${titleCase(tab === 'data' ? 'Data & privacy' : tab)}</button>`).join('')}</nav><div>${settingsPanelWorkspace()}${settingsPanelAppearance()}${settingsPanelNotifications(notifications)}${settingsPanelData()}</div></div></div>`;
  }

  function settingsPanelWorkspace() {
    return `<form class="settings-panel ${ui.settingsTab === 'workspace' ? 'is-active' : ''}" data-settings-form><div class="settings-heading"><h2>Workspace details</h2><p>Update the identity displayed across Formcraft.</p></div><div class="field-grid"><label class="field span-2">Workspace name<input name="workspaceName" required maxlength="50" value="${escapeHtml(state.settings.workspaceName)}"><span class="field-error" data-error-for="workspaceName"></span></label><label class="field span-2">Workspace description<textarea name="workspaceDescription" required maxlength="180">${escapeHtml(state.settings.workspaceDescription)}</textarea><span class="field-error" data-error-for="workspaceDescription"></span></label><label class="field">Default project status<select name="defaultStatus"><option value="active" ${state.settings.defaultStatus === 'active' ? 'selected' : ''}>Active</option><option value="planning" ${state.settings.defaultStatus === 'planning' ? 'selected' : ''}>Planning</option></select></label></div><div class="form-actions"><button class="button button-primary" type="submit">Save changes</button></div></form>`;
  }

  function settingsPanelAppearance() {
    return `<section class="settings-panel ${ui.settingsTab === 'appearance' ? 'is-active' : ''}"><div class="settings-heading"><h2>Appearance</h2><p>Choose how Formcraft looks on this device.</p></div><div class="theme-grid">${['light', 'dark', 'system'].map(theme => `<button class="theme-option ${state.settings.theme === theme ? 'is-active' : ''}" type="button" data-theme-option="${theme}" aria-pressed="${state.settings.theme === theme}"><span class="theme-preview ${theme}"></span><strong>${titleCase(theme)}</strong></button>`).join('')}</div></section>`;
  }

  function settingsPanelNotifications(notifications) {
    return `<form class="settings-panel ${ui.settingsTab === 'notifications' ? 'is-active' : ''}" data-notification-form><div class="settings-heading"><h2>Notifications</h2><p>Control which updates appear in Formcraft.</p></div>${switchRow('taskReminders', 'Task reminders', 'Receive reminders for upcoming due dates.', notifications.taskReminders)}${switchRow('projectUpdates', 'Project updates', 'Receive alerts when project status changes.', notifications.projectUpdates)}${switchRow('weeklySummary', 'Weekly summary', 'Receive a weekly workspace digest.', notifications.weeklySummary)}<div class="form-actions"><button class="button button-primary" type="submit">Save preferences</button></div></form>`;
  }

  function switchRow(name, label, copy, checked) {
    return `<label class="setting-row"><span class="setting-copy"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(copy)}</p></span><span class="switch"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span class="switch-track"></span></span></label>`;
  }

  function settingsPanelData() {
    return `<section class="settings-panel danger-zone ${ui.settingsTab === 'data' ? 'is-active' : ''}"><div class="settings-heading"><h2>Data & privacy</h2><p>Export or reset the local workspace dataset.</p></div><div class="setting-row"><span class="setting-copy"><strong>Export workspace data</strong><p>Download projects, tasks, team, settings, events, messages, files, invoices, and activity as JSON.</p></span><button class="button button-secondary" type="button" data-export-data>${icon('download', 16)}Export data</button></div><div class="setting-row"><span class="setting-copy"><strong>Reset demo workspace</strong><p>Restore the original sample data. Uploaded file blobs will also be removed.</p></span><button class="button button-danger" type="button" data-reset-data>${icon('trash', 16)}Reset workspace</button></div></section>`;
  }

  function activityList(items) {
    if (!items.length) return '<p class="panel-description">No recent activity.</p>';
    return `<div class="activity-list">${items.map(item => `<div class="activity-item"><span class="activity-dot"></span><div><p><strong>${escapeHtml(item.title)}</strong> ${escapeHtml(item.copy)}</p><time>${formatDateTime(item.at)}</time></div></div>`).join('')}</div>`;
  }

  function statusPill(status) { return `<span class="status-pill status-${escapeHtml(status)}">${escapeHtml(titleCase(status))}</span>`; }
  function priorityPill(priority) { return `<span class="priority-pill priority-${escapeHtml(priority)}">${escapeHtml(titleCase(priority))}</span>`; }
  function rolePill(role) { return `<span class="role-pill role-${escapeHtml(role)}">${escapeHtml(titleCase(role))}</span>`; }

  function overflowMenu(actions, label) {
    return `<details class="menu"><summary class="action-button" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${icon('more', 17)}</summary><div class="menu-panel">${actions.map(action => `<button type="button" class="${action.danger ? 'danger' : ''}" data-${action.action}="${action.id}">${icon(action.icon, 16)}${escapeHtml(action.label)}</button>`).join('')}</div></details>`;
  }

  function emptyState(iconName, title, copy, action = '') {
    return `<div class="empty-state">${icon(iconName, 34)}<h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p>${action}</div>`;
  }

