'use strict';

(() => {
  const architecture = window.FormcraftWorkspaceArchitecture;
  if (!architecture) throw new Error('Workspace architecture v3 must load before its responsive runtime.');

  const TABLET_QUERY = '(min-width: 821px) and (max-width: 1100px)';
  const SOURCE_ROUTES = ['dashboard', 'projects', 'tasks', 'calendar', 'team', 'reports', 'email', 'files', 'invoices', 'activity', 'settings'];
  const isTablet = () => window.matchMedia(TABLET_QUERY).matches;
  const isMobile = () => window.matchMedia('(max-width: 820px)').matches;
  let renderedRoute = ui.route;

  function closeTabletContext() {
    document.body.classList.remove('fc3-context-open');
  }

  function normalizeNavigationState() {
    const moduleActive = String(ui.route || '').startsWith('erp-');
    document.querySelectorAll('.fc3-context-sidebar [data-erp-apps-nav], .fc3-mobile-drawer [data-erp-apps-nav]').forEach(link => {
      const active = ui.route === 'apps';
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('.fc3-app-rail [data-erp-apps-nav]').forEach(link => {
      const active = ui.route === 'apps' || moduleActive;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function sourceRouteLink(route) {
    const meta = routes[route];
    if (!meta) return '';
    return `<a href="#${route}" class="workspace-nav-link fc3-context-link" data-route="${route}" data-source-route="${route}"><span class="workspace-nav-icon">${icon(meta.icon || 'grid', 17)}</span><span class="fc3-context-link-copy"><strong>${escapeHtml(meta.label)}</strong></span></a>`;
  }

  function ensureRouteCoverage(root) {
    if (!root) return;
    const missing = SOURCE_ROUTES.filter(route => !root.querySelector(`[data-route="${route}"]`));
    if (!missing.length) return;
    const section = document.createElement('div');
    section.className = 'fc3-context-section fc3-source-shortcuts';
    section.innerHTML = `<p class="workspace-nav-label">Workspace shortcuts</p>${missing.map(sourceRouteLink).join('')}`;
    const tools = root.querySelector('.fc3-context-tools');
    if (tools) tools.before(section);
    else root.append(section);
  }

  function normalizeLegacyContracts() {
    const brand = document.querySelector('.fc3-topbar-breadcrumb span:first-child');
    if (brand) brand.dataset.workspaceBrand = '';
    ensureRouteCoverage(document.querySelector('.fc3-context-nav'));
    ensureRouteCoverage(document.querySelector('.fc3-drawer-nav'));
    const mobileNav = document.querySelector('.fc3-mobile-bottom-nav');
    mobileNav?.classList.add('bright-bottom-nav');
    const projectShortcut = mobileNav?.querySelector('[data-route="projects"]');
    if (projectShortcut) projectShortcut.dataset.brightRoute = 'projects';
  }

  function syncResponsiveNavigation() {
    normalizeNavigationState();
    normalizeLegacyContracts();
    if (!isTablet()) closeTabletContext();
    document.querySelectorAll('[data-fc3-toggle-sidebar]').forEach(button => {
      if (isTablet()) {
        const open = document.body.classList.contains('fc3-context-open');
        button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-label', open ? 'Close contextual navigation' : 'Open contextual navigation');
        button.title = open ? 'Close navigation' : 'Open navigation';
      }
    });
  }

  const previousRenderShell = renderShell;
  renderShell = function renderWorkspaceArchitectureResponsive(...args) {
    const routeChanged = renderedRoute !== ui.route;
    if (routeChanged) document.body.classList.remove('drawer-open', 'fc3-context-open');
    const result = previousRenderShell.apply(this, args);
    renderedRoute = ui.route;
    syncResponsiveNavigation();
    requestAnimationFrame(syncResponsiveNavigation);
    return result;
  };

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const openDrawer = target.closest('[data-open-drawer]');
    if (openDrawer && isMobile()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.body.classList.add('drawer-open');
      return;
    }

    const closeDrawer = target.closest('[data-close-drawer], [data-drawer-backdrop]');
    if (closeDrawer && isMobile()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.body.classList.remove('drawer-open');
      return;
    }

    const toggle = target.closest('[data-fc3-toggle-sidebar]');
    if (toggle && isTablet()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.body.classList.remove('fc3-sidebar-collapsed');
      try { window.localStorage.setItem('formcraft:workspace-architecture-v3:sidebar', 'expanded'); } catch {}
      document.body.classList.toggle('fc3-context-open');
      syncResponsiveNavigation();
      return;
    }

    if (isTablet() && document.body.classList.contains('fc3-context-open')) {
      const navigated = target.closest('.fc3-context-sidebar [data-route], .fc3-context-sidebar [data-erp-open-app], .fc3-context-sidebar [data-erp-apps-nav]');
      if (navigated) closeTabletContext();
    }
  }, true);

  document.addEventListener('pointerdown', event => {
    if (!isTablet() || !document.body.classList.contains('fc3-context-open')) return;
    if (event.target.closest('.fc3-context-sidebar, [data-fc3-toggle-sidebar]')) return;
    closeTabletContext();
    syncResponsiveNavigation();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (document.body.classList.contains('drawer-open')) {
      document.body.classList.remove('drawer-open');
      document.querySelector('[data-bright-more]')?.focus();
      return;
    }
    if (!document.body.classList.contains('fc3-context-open')) return;
    closeTabletContext();
    syncResponsiveNavigation();
    document.querySelector('.fc3-topbar [data-fc3-toggle-sidebar]')?.focus();
  });

  window.addEventListener('resize', () => requestAnimationFrame(syncResponsiveNavigation));
  requestAnimationFrame(syncResponsiveNavigation);

  window.FormcraftWorkspaceArchitectureRuntime = Object.freeze({
    tabletQuery: TABLET_QUERY,
    syncResponsiveNavigation,
    closeTabletContext
  });
})();