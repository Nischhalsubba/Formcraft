'use strict';

(() => {
  const sidebarPrimaryRoutes = ['dashboard', 'projects', 'tasks', 'calendar', 'team'];
  const sidebarSecondaryRoutes = ['reports', 'email', 'files', 'invoices', 'activity', 'settings'];

  function shellRouteLink(route) {
    const meta = routes[route];
    const count = route === 'projects'
      ? state.projects.length
      : route === 'tasks'
        ? state.tasks.filter(task => task.status !== 'done').length
        : route === 'email'
          ? state.messages.filter(message => message.folder === 'inbox' && message.unread).length
          : null;

    return `<a href="#${route}" data-route="${route}" class="workspace-nav-link ${ui.route === route ? 'is-active' : ''}" ${ui.route === route ? 'aria-current="page"' : ''}>
      <span class="workspace-nav-icon">${icon(meta.icon, 18)}</span>
      <span>${escapeHtml(meta.label)}</span>
      ${count !== null && count > 0 ? `<span class="workspace-nav-count">${count}</span>` : ''}
    </a>`;
  }

  function shellPageHeader() {
    const meta = routes[ui.route] || routes.dashboard;
    const isDashboard = ui.route === 'dashboard';
    const title = isDashboard ? `Good ${greeting()}, ${currentUserName()}.` : meta.title;
    const description = isDashboard
      ? (state.settings.workspaceDescription || 'Plan work, keep delivery visible, and update your workspace from one place.')
      : meta.description;

    return `<section class="workspace-page-header">
      <div class="workspace-page-heading">
        <p class="workspace-breadcrumb">${escapeHtml(state.settings.workspaceName || 'Formcraft')}<span>/</span>${escapeHtml(meta.label)}</p>
        <h1 data-route-heading>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="workspace-page-actions">
        ${isDashboard ? `<button class="button button-secondary" type="button" data-export-data>${icon('download', 17)}Export</button>` : `<button class="button button-secondary" type="button" data-command-menu>${icon('grid', 17)}Create menu</button>`}
        <button class="button button-primary" type="button" data-context-create>${icon('plus', 17)}${escapeHtml(contextCreateLabel())}</button>
      </div>
    </section>`;
  }

  function accountPopoverMarkup() {
    return `<h2>Account</h2><div class="utility-popover-list">
      <button type="button" data-account-settings>${icon('settings', 17)}Workspace settings</button>
      <button type="button" data-export-data>${icon('download', 17)}Export workspace data</button>
    </div>`;
  }

  renderShell = function renderFormcraftWorkspace() {
    const userName = currentUserName();
    const workspaceName = state.settings.workspaceName || 'Formcraft';

    app.innerHTML = `<div class="app-shell workspace-shell">
      <aside class="workspace-sidebar" aria-label="Workspace navigation">
        <a class="workspace-brand" href="#dashboard" data-route="dashboard" aria-label="${escapeHtml(workspaceName)} dashboard">
          <span class="workspace-brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span><strong data-workspace-brand>${escapeHtml(workspaceName)}</strong><small>Operations workspace</small></span>
        </a>

        <nav class="workspace-nav" aria-label="Primary navigation">
          <p class="workspace-nav-label">Workspace</p>
          ${sidebarPrimaryRoutes.map(shellRouteLink).join('')}
          <p class="workspace-nav-label workspace-nav-label-spaced">Tools</p>
          ${sidebarSecondaryRoutes.map(shellRouteLink).join('')}
        </nav>

        <div class="workspace-sidebar-footer">
          <span class="workspace-user-avatar">${escapeHtml(currentUserInitials())}</span>
          <span class="workspace-user-copy"><strong>${escapeHtml(userName)}</strong><small>${escapeHtml(window.FormcraftBackend?.role || 'member')}</small></span>
          <button class="icon-button" type="button" data-toggle-account aria-expanded="false" aria-controls="account-popover" aria-label="Open account menu">${icon('more', 18)}</button>
        </div>
      </aside>

      <div class="workspace-main">
        <header class="workspace-topbar">
          <button class="menu-button" type="button" data-open-drawer aria-label="Open navigation">${icon('menu', 20)}</button>
          <button class="workspace-search-trigger" type="button" data-search-focus>
            ${icon('search', 18)}<span>Search workspace</span><kbd>Ctrl K</kbd>
          </button>
          <div class="nav-utilities">
            <span class="sync-state" data-sync-state>Saved</span>
            <button class="utility-button notification-button" type="button" data-toggle-notifications aria-expanded="false" aria-controls="notifications-popover" aria-label="Open notifications">${icon('bell', 19)}</button>
            <button class="utility-button" type="button" data-theme-toggle aria-label="Toggle color theme">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 19)}</button>
            <button class="workspace-create-button" type="button" data-command-menu>${icon('plus', 17)}Create</button>
            <section class="utility-popover" id="notifications-popover" data-notifications-popover hidden>${notificationsMarkup()}</section>
            <section class="utility-popover" id="account-popover" data-account-popover hidden>${accountPopoverMarkup()}</section>
          </div>
        </header>

        <main id="main-content" tabindex="-1" class="workspace-content">
          ${shellPageHeader()}
          ${renderPage()}
        </main>
      </div>

      <aside class="mobile-drawer" data-drawer aria-label="Mobile navigation">
        <div class="drawer-head">
          <span class="workspace-brand"><span class="workspace-brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span><strong>${escapeHtml(workspaceName)}</strong><small>Operations workspace</small></span></span>
          <button class="icon-button" type="button" data-close-drawer aria-label="Close navigation">${icon('close', 19)}</button>
        </div>
        <nav class="drawer-nav" aria-label="Mobile primary navigation">${Object.keys(routes).map(shellRouteLink).join('')}</nav>
        <div class="drawer-footer">Signed in as ${escapeHtml(userName)}</div>
      </aside>
      <div class="drawer-backdrop" data-drawer-backdrop></div>
    </div>`;

    bindShell();
  };

  document.documentElement.classList.add('formcraft-v2');
  renderShell();
})();
