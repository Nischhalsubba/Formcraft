'use strict';

(() => {
  const secondaryMobileRoutes = ['team', 'reports', 'calendar', 'email', 'files', 'invoices', 'activity', 'settings'];

  function workspaceSnapshot() {
    const openTasks = state.tasks.filter(task => task.status !== 'done');
    const activeProjects = state.projects.filter(project => project.status !== 'completed');
    const averageProgress = state.projects.length
      ? Math.round(state.projects.reduce((sum, project) => sum + Number(project.progress || 0), 0) / state.projects.length)
      : 0;
    const dueTasks = openTasks
      .filter(task => task.dueDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const nextTask = dueTasks[0] || null;

    return {
      openTasks: openTasks.length,
      activeProjects: activeProjects.length,
      averageProgress,
      members: state.team.length,
      nextTask
    };
  }

  function mavenOverviewMarkup() {
    const snapshot = workspaceSnapshot();
    const nextDue = snapshot.nextTask
      ? `${escapeHtml(snapshot.nextTask.title)} · ${formatShortDate(snapshot.nextTask.dueDate)}`
      : 'No upcoming task deadline';

    return `
      <section class="maven-overview-grid" aria-label="Workspace health and quick actions">
        <article class="maven-feature-card">
          <div class="maven-feature-head">
            <div>
              <p class="maven-eyebrow">Workspace health</p>
              <h2>${snapshot.averageProgress}%</h2>
              <p>Average delivery progress across ${snapshot.activeProjects} active ${snapshot.activeProjects === 1 ? 'project' : 'projects'}.</p>
            </div>
            <span class="maven-health-orb" aria-hidden="true"><i style="--health:${snapshot.averageProgress}%"></i></span>
          </div>
          <div class="maven-feature-stats">
            <div><strong>${snapshot.openTasks}</strong><span>Open tasks</span></div>
            <div><strong>${snapshot.members}</strong><span>Team members</span></div>
            <div><strong>${snapshot.activeProjects}</strong><span>Active projects</span></div>
          </div>
          <div class="maven-feature-footer">
            <span>${icon('calendar', 17)}<span><small>Next due</small><strong>${nextDue}</strong></span></span>
            <button class="maven-inline-action" type="button" data-maven-route="tasks">Review tasks ${icon('arrowRight', 16)}</button>
          </div>
        </article>

        <article class="maven-quick-card">
          <div class="maven-card-heading">
            <div><p class="maven-eyebrow">Quick actions</p><h2>Move work forward</h2></div>
            <button class="maven-round-action" type="button" data-maven-command aria-label="Open all create options">${icon('plus', 19)}</button>
          </div>
          <div class="maven-action-grid">
            <button type="button" data-maven-action="project"><span>${icon('projects', 20)}</span><strong>New project</strong><small>Plan a delivery</small></button>
            <button type="button" data-maven-action="task"><span>${icon('tasks', 20)}</span><strong>Add task</strong><small>Capture next work</small></button>
            <button type="button" data-maven-action="event"><span>${icon('calendar', 20)}</span><strong>Schedule</strong><small>Add a milestone</small></button>
            <button type="button" data-maven-action="invoice"><span>${icon('invoices', 20)}</span><strong>Invoice</strong><small>Create billing</small></button>
          </div>
        </article>
      </section>`;
  }

  function bottomNavMarkup() {
    const moreActive = secondaryMobileRoutes.includes(ui.route);
    const item = (route, label) => `
      <button type="button" class="maven-bottom-item ${ui.route === route ? 'is-active' : ''}" data-maven-route="${route}" ${ui.route === route ? 'aria-current="page"' : ''}>
        ${icon(routes[route].icon, 20)}<span>${label}</span>
      </button>`;

    return `
      <nav class="maven-bottom-nav" aria-label="Mobile navigation">
        ${item('dashboard', 'Home')}
        ${item('projects', 'Projects')}
        <button type="button" class="maven-bottom-create" data-maven-command aria-label="Create a new item">${icon('plus', 22)}</button>
        ${item('tasks', 'Tasks')}
        <button type="button" class="maven-bottom-item ${moreActive ? 'is-active' : ''}" data-maven-more ${moreActive ? 'aria-current="page"' : ''}>
          ${icon('grid', 20)}<span>More</span>
        </button>
      </nav>`;
  }

  function mountDashboardOverview() {
    if (ui.route !== 'dashboard') return;
    const metricGrid = $('.dashboard-content .metric-grid');
    if (!metricGrid || $('.maven-overview-grid')) return;
    metricGrid.insertAdjacentHTML('afterend', mavenOverviewMarkup());
  }

  function mountBottomNavigation() {
    const shell = $('.app-shell');
    if (!shell || $('.maven-bottom-nav')) return;
    shell.insertAdjacentHTML('beforeend', bottomNavMarkup());
  }

  function bindMavenActions() {
    $$('[data-maven-route]').forEach(control => control.addEventListener('click', () => navigate(control.dataset.mavenRoute)));
    $$('[data-maven-command]').forEach(control => control.addEventListener('click', openCommandMenu));
    $$('[data-maven-more]').forEach(control => control.addEventListener('click', () => document.body.classList.add('drawer-open')));
    $$('[data-maven-action]').forEach(control => control.addEventListener('click', () => {
      const actions = {
        project: openProjectForm,
        task: openTaskForm,
        event: openEventForm,
        invoice: openInvoiceForm
      };
      actions[control.dataset.mavenAction]?.();
    }));
  }

  function enhanceSemanticSurfaces() {
    $$('.metric-card').forEach((card, index) => card.dataset.mavenIndex = String(index + 1));
    $$('.status-badge, .priority-badge').forEach(badge => badge.classList.add('maven-status-pill'));
    $$('.panel, .project-card, .member-card, .file-card, .invoice-kpi, .settings-panel').forEach(surface => surface.classList.add('maven-surface'));
  }

  function mountMavenSystem() {
    document.documentElement.classList.add('maven-system');
    mountDashboardOverview();
    mountBottomNavigation();
    enhanceSemanticSurfaces();
    bindMavenActions();
  }

  const previousBindShell = bindShell;
  bindShell = function bindShellWithMavenSystem() {
    previousBindShell();
    mountMavenSystem();
  };

  renderShell();
})();
