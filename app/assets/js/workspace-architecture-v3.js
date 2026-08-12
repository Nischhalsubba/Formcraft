'use strict';

(() => {
  const ERP = window.FormcraftERP;
  if (!ERP) throw new Error('Formcraft ERP must load before workspace architecture v3.');

  const {
    GROUPS,
    allApps,
    appByKey,
    moduleByRoute,
    ensureERPState,
    moduleMetrics,
    canEdit
  } = ERP;

  const VERSION = 'WORKSPACE-ARCH-3.0';
  const SIDEBAR_KEY = 'formcraft:workspace-architecture-v3:sidebar';
  const WORK_ROUTES = ['dashboard', 'projects', 'tasks', 'calendar', 'team', 'reports'];
  const TOOL_ROUTES = ['email', 'files', 'invoices', 'activity', 'settings'];
  const routeIcons = {
    dashboard: 'dashboard',
    projects: 'projects',
    tasks: 'tasks',
    calendar: 'calendar',
    team: 'team',
    reports: 'reports',
    email: 'mail',
    files: 'files',
    invoices: 'invoices',
    activity: 'activity',
    settings: 'settings',
    apps: 'grid'
  };

  const escape = (value = '') => typeof escapeHtml === 'function'
    ? escapeHtml(value)
    : String(value).replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);

  const safeStorage = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); } catch {}
    }
  };

  function brandMark(size = 'normal') {
    return `<span class="fc3-brand-mark ${size === 'compact' ? 'is-compact' : ''}" aria-hidden="true"><i></i><i></i><i></i></span>`;
  }

  function appRoute(app) {
    return app?.nativeRoute || (app?.key ? `erp-${app.key}` : 'apps');
  }

  function appCount(app) {
    if (!app) return 0;
    if (app.nativeRoute === 'projects') return state.projects?.length || 0;
    if (app.nativeRoute === 'calendar') return state.events?.length || 0;
    if (app.nativeRoute === 'files') return state.files?.length || 0;
    if (app.nativeRoute === 'invoices') return state.invoices?.length || 0;
    if (app.nativeRoute === 'team') return state.team?.length || 0;
    if (app.nativeRoute === 'email') return state.messages?.length || 0;
    if (app.nativeRoute === 'tasks') return state.tasks?.length || 0;
    if (app.nativeRoute) return 0;
    return moduleMetrics(app).total;
  }

  function routeCount(route) {
    if (route === 'projects') return state.projects?.length || 0;
    if (route === 'tasks') return state.tasks?.filter(task => task.status !== 'done').length || 0;
    if (route === 'calendar') return state.events?.length || 0;
    if (route === 'team') return state.team?.length || 0;
    if (route === 'invoices') return state.invoices?.filter(invoice => !['paid', 'void'].includes(invoice.status)).length || 0;
    if (route === 'email') return state.messages?.filter(message => message.folder === 'inbox' && message.unread).length || 0;
    return null;
  }

  function nativeAppForRoute(route) {
    return allApps.find(candidate => candidate.nativeRoute === route) || null;
  }

  function currentContext() {
    ensureERPState();
    const module = moduleByRoute(ui.route);
    const nativeApp = nativeAppForRoute(ui.route);
    const app = module ? appByKey(module.key) : nativeApp;
    const group = app ? GROUPS.find(candidate => candidate.key === app.group) || null : null;
    const routeMeta = routes[ui.route] || routes.dashboard;

    if (ui.route === 'apps') {
      return {
        kind: 'launcher',
        app: { key: 'apps', label: 'Apps', icon: 'grid', description: routes.apps?.description || 'Business applications' },
        group: null,
        module: null,
        title: 'Business apps',
        description: routes.apps?.description || 'Open connected business applications.'
      };
    }

    return {
      kind: module ? 'module' : app ? 'native-app' : 'workspace',
      app: app || {
        key: ui.route,
        label: routeMeta?.label || routeMeta?.title || 'Workspace',
        icon: routeMeta?.icon || routeIcons[ui.route] || 'grid',
        description: routeMeta?.description || ''
      },
      group,
      module,
      title: routeMeta?.title || app?.label || 'Workspace',
      description: routeMeta?.description || app?.description || ''
    };
  }

  function isRouteActive(route) {
    return ui.route === route;
  }

  function isAppActive(app) {
    return appRoute(app) === ui.route;
  }

  function nativeNavLink(route, options = {}) {
    const meta = routes[route];
    if (!meta) return '';
    const count = routeCount(route);
    const active = isRouteActive(route);
    const classes = [
      options.rail ? 'fc3-rail-button' : 'workspace-nav-link fc3-context-link',
      active ? 'is-active' : ''
    ].filter(Boolean).join(' ');
    const iconMarkup = icon(meta.icon || routeIcons[route] || 'grid', options.rail ? 20 : 17);

    if (options.rail) {
      return `<a href="#${escape(route)}" class="${classes}" data-route="${escape(route)}" ${active ? 'aria-current="page"' : ''} aria-label="${escape(meta.label)}" title="${escape(meta.label)}"><span class="fc3-rail-icon">${iconMarkup}</span><span class="fc3-tooltip">${escape(meta.label)}</span></a>`;
    }

    return `<a href="#${escape(route)}" class="${classes}" data-route="${escape(route)}" ${active ? 'aria-current="page"' : ''}>
      <span class="workspace-nav-icon">${iconMarkup}</span>
      <span class="fc3-context-link-copy"><strong>${escape(meta.label)}</strong>${options.description ? `<small>${escape(meta.description || '')}</small>` : ''}</span>
      ${count !== null && count > 0 ? `<span class="workspace-nav-count">${count}</span>` : ''}
    </a>`;
  }

  function appNavLink(app, options = {}) {
    if (!app) return '';
    if (app.nativeRoute) return nativeNavLink(app.nativeRoute, options);
    const active = isAppActive(app);
    const count = appCount(app);
    const classes = [
      options.rail ? 'fc3-rail-button' : 'workspace-nav-link fc3-context-link',
      active ? 'is-active' : ''
    ].filter(Boolean).join(' ');
    const iconMarkup = icon(app.icon || 'grid', options.rail ? 20 : 17);

    if (options.rail) {
      return `<button type="button" class="${classes}" data-erp-open-app="${escape(app.key)}" aria-label="${escape(app.label)}" title="${escape(app.label)}"><span class="fc3-rail-icon">${iconMarkup}</span><span class="fc3-tooltip">${escape(app.label)}</span></button>`;
    }

    return `<button type="button" class="${classes}" data-erp-open-app="${escape(app.key)}" ${active ? 'aria-current="page"' : ''}>
      <span class="workspace-nav-icon">${iconMarkup}</span>
      <span class="fc3-context-link-copy"><strong>${escape(app.label)}</strong>${options.description ? `<small>${escape(app.description || '')}</small>` : ''}</span>
      ${count > 0 ? `<span class="workspace-nav-count">${count}</span>` : ''}
    </button>`;
  }

  function appsNavLink(options = {}) {
    const active = ui.route === 'apps' || String(ui.route || '').startsWith('erp-');
    if (options.rail) {
      return `<a href="#apps" class="fc3-rail-button ${active ? 'is-active' : ''}" data-route="apps" data-erp-apps-nav ${active ? 'aria-current="page"' : ''} aria-label="Apps" title="Apps"><span class="fc3-rail-icon">${icon('grid', 20)}</span><span class="fc3-tooltip">Apps</span></a>`;
    }
    return `<a href="#apps" class="workspace-nav-link fc3-context-link ${active ? 'is-active' : ''}" data-route="apps" data-erp-apps-nav ${active ? 'aria-current="page"' : ''}>
      <span class="workspace-nav-icon">${icon('grid', 17)}</span>
      <span class="fc3-context-link-copy"><strong>All apps</strong><small>Open the business app launcher</small></span>
      <span class="workspace-nav-count">${allApps.length}</span>
    </a>`;
  }

  function globalRail(context) {
    const favoriteKeys = state.erp?.settings?.favorites || [];
    const recentKeys = state.erp?.settings?.recentApps || [];
    const preferred = [...favoriteKeys, ...recentKeys]
      .map(appByKey)
      .filter(Boolean)
      .filter((candidate, index, values) => values.findIndex(item => item.key === candidate.key) === index)
      .filter(candidate => candidate.key !== context.app?.key)
      .slice(0, 5);

    return `<aside class="fc3-app-rail" aria-label="Global applications">
      <a class="fc3-rail-brand" href="#dashboard" data-route="dashboard" aria-label="Formcraft dashboard" title="Formcraft">${brandMark('compact')}</a>
      <nav class="fc3-rail-nav" aria-label="Global navigation">
        ${nativeNavLink('dashboard', { rail: true })}
        ${appsNavLink({ rail: true })}
        <span class="fc3-rail-divider" aria-hidden="true"></span>
        ${preferred.map(app => appNavLink(app, { rail: true })).join('')}
      </nav>
      <div class="fc3-rail-footer">
        ${nativeNavLink('settings', { rail: true })}
      </div>
    </aside>`;
  }

  function categoryNavigation() {
    const active = ui.erp?.launcherGroup || 'all';
    return `<div class="fc3-context-section">
      <p class="workspace-nav-label">App categories</p>
      <button type="button" class="workspace-nav-link fc3-context-link ${active === 'all' ? 'is-active' : ''}" data-erp-launcher-group="all"><span class="workspace-nav-icon">${icon('grid', 17)}</span><span class="fc3-context-link-copy"><strong>All apps</strong><small>${allApps.length} applications</small></span></button>
      ${GROUPS.map(group => {
        const count = allApps.filter(app => app.group === group.key).length;
        return `<button type="button" class="workspace-nav-link fc3-context-link ${active === group.key ? 'is-active' : ''}" data-erp-launcher-group="${escape(group.key)}"><span class="workspace-nav-icon">${icon(group.icon || 'grid', 17)}</span><span class="fc3-context-link-copy"><strong>${escape(group.label)}</strong><small>${escape(group.description)}</small></span><span class="workspace-nav-count">${count}</span></button>`;
      }).join('')}
    </div>`;
  }

  function groupNavigation(context) {
    const groupApps = context.group
      ? allApps.filter(app => app.group === context.group.key)
      : [];

    if (!groupApps.length) {
      return `<div class="fc3-context-section"><p class="workspace-nav-label">Workspace</p>${WORK_ROUTES.map(route => nativeNavLink(route)).join('')}</div>`;
    }

    return `<div class="fc3-context-section">
      <p class="workspace-nav-label">${escape(context.group.label)}</p>
      ${groupApps.map(app => appNavLink(app)).join('')}
    </div>`;
  }

  function toolNavigation() {
    return `<div class="fc3-context-section fc3-context-tools"><p class="workspace-nav-label">Workspace tools</p>${TOOL_ROUTES.map(route => nativeNavLink(route)).join('')}</div>`;
  }

  function contextSidebar(context) {
    return `<aside class="workspace-sidebar fc3-context-sidebar" aria-label="Context navigation">
      <header class="fc3-context-header">
        <button class="fc3-current-app" type="button" data-erp-open-launcher aria-label="Open app launcher">
          <span class="fc3-current-app-icon">${icon(context.app?.icon || 'grid', 20)}</span>
          <span><small>${escape(context.group?.label || 'Formcraft')}</small><strong>${escape(context.app?.label || 'Workspace')}</strong></span>
          ${icon('chevronDown', 15)}
        </button>
        <button class="icon-button fc3-sidebar-toggle" type="button" data-fc3-toggle-sidebar aria-label="Collapse contextual navigation" title="Collapse navigation">${icon('chevronLeft', 18)}</button>
      </header>
      <nav class="workspace-nav fc3-context-nav" aria-label="Current application navigation">
        ${appsNavLink()}
        ${context.kind === 'launcher' ? categoryNavigation() : groupNavigation(context)}
        ${toolNavigation()}
      </nav>
      <footer class="fc3-context-footer">
        <span class="workspace-user-avatar">${escape(typeof currentUserInitials === 'function' ? currentUserInitials() : 'FC')}</span>
        <span><strong>${escape(typeof currentUserName === 'function' ? currentUserName() : 'Workspace member')}</strong><small>${escape(window.FormcraftBackend?.role || 'member')}</small></span>
      </footer>
    </aside>`;
  }

  function compactContextSwitchers() {
    ensureERPState();
    const settings = state.erp.settings;
    const companies = settings.companies || [];
    const branches = (settings.branches || []).filter(branch => branch.companyId === settings.activeCompanyId);
    if (!companies.length) return '';
    return `<div class="fc3-context-switchers">
      <label><span class="sr-only">Active company</span><select data-erp-company aria-label="Active company">${companies.map(company => `<option value="${escape(company.id)}" ${company.id === settings.activeCompanyId ? 'selected' : ''}>${escape(company.name)}</option>`).join('')}</select></label>
      <span class="fc3-context-separator">/</span>
      <label><span class="sr-only">Active branch</span><select data-erp-branch aria-label="Active branch">${branches.map(branch => `<option value="${escape(branch.id)}" ${branch.id === settings.activeBranchId ? 'selected' : ''}>${escape(branch.name)}</option>`).join('')}</select></label>
    </div>`;
  }

  function notificationsPanel() {
    if (typeof notificationsMarkup === 'function') return notificationsMarkup();
    return '<h2>Notifications</h2><p class="panel-description">No new notifications.</p>';
  }

  function accountPanel() {
    const user = window.FormcraftBackend?.session?.user;
    const name = typeof currentUserName === 'function' ? currentUserName() : user?.email || 'Workspace member';
    const email = user?.email || '';
    return `<div class="fc3-account-summary"><span class="workspace-user-avatar">${escape(typeof currentUserInitials === 'function' ? currentUserInitials() : 'FC')}</span><span><strong>${escape(name)}</strong><small>${escape(email || window.FormcraftBackend?.role || '')}</small></span></div>
      <div class="utility-popover-list">
        <button type="button" data-erp-open-launcher>${icon('grid', 17)}Business apps</button>
        <button type="button" data-account-settings>${icon('settings', 17)}Workspace settings</button>
        <button type="button" data-start-product-tour>${icon('eye', 17)}Take product tour</button>
        <button type="button" data-export-data>${icon('download', 17)}Export workspace data</button>
        <button type="button" data-fc3-sign-out data-dynamic-sign-out>${icon('external', 17)}Sign out</button>
      </div>`;
  }

  function pageBreadcrumb(context) {
    const workspaceName = state.settings?.workspaceName || 'Formcraft';
    const parts = [workspaceName];
    if (context.group) parts.push(context.group.label);
    if (context.app?.label && context.app.label !== context.group?.label) parts.push(context.app.label);
    return parts.map((part, index) => `<span>${index ? '<i>/</i>' : ''}${escape(part)}</span>`).join('');
  }

  function topbar(context) {
    return `<header class="workspace-topbar fc3-topbar">
      <div class="fc3-topbar-start">
        <button class="menu-button fc3-mobile-menu" type="button" data-open-drawer aria-label="Open navigation">${icon('menu', 20)}</button>
        <button class="icon-button fc3-desktop-sidebar-toggle" type="button" data-fc3-toggle-sidebar aria-label="Toggle contextual navigation" title="Toggle navigation">${icon('menu', 18)}</button>
        <div class="fc3-topbar-breadcrumb" aria-label="Current location">${pageBreadcrumb(context)}</div>
      </div>
      <button class="workspace-search-trigger fc3-global-search" type="button" data-search-focus aria-label="Search or jump to an app"><span>${icon('search', 18)}<span>Search records, apps, and actions</span></span><kbd>Ctrl K</kbd></button>
      <div class="nav-utilities fc3-topbar-actions">
        ${compactContextSwitchers()}
        <span class="sync-state fc3-sync-state" data-sync-state>Saved</span>
        <button class="utility-button" type="button" data-command-menu aria-label="Open quick create menu" title="Quick create">${icon('plus', 19)}</button>
        <button class="utility-button notification-button" type="button" data-toggle-notifications aria-expanded="false" aria-controls="notifications-popover" aria-label="Open notifications">${icon('bell', 19)}</button>
        <button class="utility-button" type="button" data-theme-toggle aria-label="Toggle color theme">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 19)}</button>
        <button class="avatar-button fc3-account-button" type="button" data-toggle-account aria-expanded="false" aria-controls="account-popover" aria-label="Open account menu"><span class="workspace-user-avatar">${escape(typeof currentUserInitials === 'function' ? currentUserInitials() : 'FC')}</span><span class="fc3-account-name">${escape(typeof currentUserName === 'function' ? currentUserName() : 'Account')}</span>${icon('chevronDown', 14)}</button>
        <section class="utility-popover" id="notifications-popover" data-notifications-popover hidden>${notificationsPanel()}</section>
        <section class="utility-popover" id="account-popover" data-account-popover hidden>${accountPanel()}</section>
      </div>
    </header>`;
  }

  function pageHeader(context, pageMarkup) {
    const isRecord = /data-(?:erp-)?record-page=/.test(pageMarkup);
    if (context.kind === 'launcher' || isRecord) return '';
    const createLabel = typeof contextCreateLabel === 'function' ? contextCreateLabel() : 'Create';
    const allowCreate = context.kind !== 'module' && !['activity', 'settings', 'reports'].includes(ui.route);
    const routeMeta = routes[ui.route] || {};
    const eyebrow = context.group?.label || (ui.route === 'dashboard' ? 'Workspace overview' : 'Formcraft');
    const titleText = ui.route === 'dashboard'
      ? `Good ${typeof greeting === 'function' ? greeting() : 'day'}, ${typeof currentUserName === 'function' ? currentUserName() : 'there'}.`
      : routeMeta.title || context.app?.label || 'Workspace';
    const description = ui.route === 'dashboard'
      ? state.settings?.workspaceDescription || 'Run delivery and business operations from one connected workspace.'
      : routeMeta.description || context.app?.description || '';

    return `<section class="workspace-page-header fc3-page-header">
      <div class="workspace-page-heading"><p class="panel-kicker">${escape(eyebrow)}</p><h1 data-route-heading>${escape(titleText)}</h1><p>${escape(description)}</p></div>
      <div class="workspace-page-actions">
        ${ui.route === 'dashboard' ? `<button class="button button-secondary" type="button" data-export-data>${icon('download', 16)}Export</button>` : `<button class="button button-secondary" type="button" data-erp-open-launcher>${icon('grid', 16)}Switch app</button>`}
        ${allowCreate ? `<button class="button button-primary" type="button" data-context-create>${icon('plus', 16)}${escape(createLabel)}</button>` : ''}
      </div>
    </section>`;
  }

  function mobileDrawer(context) {
    return `<aside class="mobile-drawer fc3-mobile-drawer" data-drawer aria-label="Mobile navigation">
      <div class="drawer-head fc3-drawer-head"><a class="workspace-brand" href="#dashboard" data-route="dashboard">${brandMark()}<span><strong>${escape(state.settings?.workspaceName || 'Formcraft')}</strong><small>Nepal-first ERP</small></span></a><button class="icon-button" type="button" data-close-drawer aria-label="Close navigation">${icon('close', 19)}</button></div>
      <button class="workspace-search-trigger fc3-drawer-search" type="button" data-search-focus>${icon('search', 18)}<span>Search workspace</span><kbd>Ctrl K</kbd></button>
      <nav class="drawer-nav workspace-nav fc3-drawer-nav" aria-label="Mobile workspace navigation">
        ${appsNavLink()}
        ${context.kind === 'launcher' ? categoryNavigation() : groupNavigation(context)}
        ${toolNavigation()}
      </nav>
      <div class="drawer-footer fc3-drawer-footer"><span class="workspace-user-avatar">${escape(typeof currentUserInitials === 'function' ? currentUserInitials() : 'FC')}</span><span><strong>${escape(typeof currentUserName === 'function' ? currentUserName() : 'Workspace member')}</strong><small>${escape(window.FormcraftBackend?.role || 'member')}</small></span></div>
    </aside><div class="drawer-backdrop fc3-drawer-backdrop" data-drawer-backdrop></div>`;
  }

  function mobileBottomNavigation(context) {
    const contextualApp = context.kind === 'module' || context.kind === 'native-app'
      ? context.app
      : nativeAppForRoute('projects');
    const contextualActive = contextualApp ? isAppActive(contextualApp) : false;
    const contextualButton = !contextualApp
      ? ''
      : contextualApp.nativeRoute
        ? `<a href="#${escape(contextualApp.nativeRoute)}" class="fc3-mobile-nav-button ${contextualActive ? 'is-active' : ''}" data-route="${escape(contextualApp.nativeRoute)}"><span class="fc3-mobile-nav-icon">${icon(contextualApp.icon || routeIcons[contextualApp.nativeRoute] || 'grid', 20)}</span><span>${escape(contextualApp.label)}</span></a>`
        : `<button type="button" class="fc3-mobile-nav-button ${contextualActive ? 'is-active' : ''}" data-erp-open-app="${escape(contextualApp.key)}"><span class="fc3-mobile-nav-icon">${icon(contextualApp.icon || 'grid', 20)}</span><span>${escape(contextualApp.label)}</span></button>`;

    return `<nav class="fc3-mobile-bottom-nav" aria-label="Mobile quick navigation">
      <a href="#dashboard" class="fc3-mobile-nav-button ${ui.route === 'dashboard' ? 'is-active' : ''}" data-route="dashboard"><span class="fc3-mobile-nav-icon">${icon('dashboard', 20)}</span><span>Home</span></a>
      <a href="#apps" class="fc3-mobile-nav-button ${ui.route === 'apps' || String(ui.route || '').startsWith('erp-') ? 'is-active' : ''}" data-route="apps" data-erp-apps-nav><span class="fc3-mobile-nav-icon">${icon('grid', 20)}</span><span>Apps</span></a>
      ${contextualButton}
      <button type="button" class="fc3-mobile-nav-button is-create" data-context-create data-bright-context-create><span class="fc3-mobile-nav-icon">${icon('plus', 21)}</span><span>Create</span></button>
      <button type="button" class="fc3-mobile-nav-button" data-open-drawer data-bright-more><span class="fc3-mobile-nav-icon">${icon('menu', 20)}</span><span>More</span></button>
    </nav>`;
  }

  function updateSyncLabel() {
    const status = document.documentElement.dataset.backend || 'ready';
    const copy = {
      loading: 'Loading',
      saving: 'Saving…',
      offline: 'Offline',
      conflict: 'Resolving…',
      ready: 'Saved'
    }[status] || 'Saved';
    document.querySelectorAll('[data-sync-state]').forEach(node => {
      node.textContent = copy;
      node.dataset.state = status;
    });
  }

  function applySidebarState() {
    const collapsed = safeStorage.get(SIDEBAR_KEY) === 'collapsed';
    document.body.classList.toggle('fc3-sidebar-collapsed', collapsed);
    document.querySelectorAll('[data-fc3-toggle-sidebar]').forEach(button => {
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute('aria-label', collapsed ? 'Expand contextual navigation' : 'Collapse contextual navigation');
      button.title = collapsed ? 'Expand navigation' : 'Collapse navigation';
    });
  }

  function renderWorkspaceArchitecture() {
    ensureERPState();
    const context = currentContext();
    const pageMarkup = renderPage();
    const isRecord = /data-(?:erp-)?record-page=/.test(pageMarkup);
    const routeClass = `fc3-route-${String(ui.route || 'dashboard').replace(/[^a-z0-9-]/gi, '-')}`;

    app.innerHTML = `<div class="app-shell workspace-shell fc3-shell ${routeClass} ${isRecord ? 'fc3-record-open' : ''}" data-workspace-architecture="${VERSION}">
      ${globalRail(context)}
      ${contextSidebar(context)}
      <div class="workspace-main fc3-main">
        ${topbar(context)}
        <main id="main-content" tabindex="-1" class="workspace-content fc3-content">
          ${pageHeader(context, pageMarkup)}
          <div class="fc3-page-surface">${pageMarkup}</div>
        </main>
      </div>
      ${mobileDrawer(context)}
      ${mobileBottomNavigation(context)}
    </div>`;

    document.documentElement.dataset.workspaceArchitecture = VERSION;
    applySidebarState();
    bindShell();
    updateSyncLabel();
    document.title = `${context.app?.label || 'Workspace'} · ${state.settings?.workspaceName || 'Formcraft'}`;
  }

  renderShell = renderWorkspaceArchitecture;

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const toggle = target.closest('[data-fc3-toggle-sidebar]');
    if (toggle) {
      event.preventDefault();
      const collapsed = !document.body.classList.contains('fc3-sidebar-collapsed');
      safeStorage.set(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded');
      applySidebarState();
      return;
    }

    const signOut = target.closest('[data-fc3-sign-out]');
    if (signOut) {
      event.preventDefault();
      window.FormcraftBackend?.client?.auth?.signOut?.();
      return;
    }

    if (target.closest('.mobile-drawer [data-route], .mobile-drawer [data-erp-open-app], .mobile-drawer [data-erp-launcher-group]')) {
      document.body.classList.remove('drawer-open');
    }
  }, true);

  const backendObserver = new MutationObserver(updateSyncLabel);
  backendObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-backend'] });

  if (document.documentElement.dataset.backend === 'ready' && window.FormcraftBackend?.workspace) {
    renderShell();
  }

  window.FormcraftWorkspaceArchitecture = Object.freeze({
    version: VERSION,
    render: renderWorkspaceArchitecture,
    currentContext,
    applySidebarState
  });
})();