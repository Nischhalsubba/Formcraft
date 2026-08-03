'use strict';

(() => {
  const ERP = window.FormcraftERP;
  if (!ERP) throw new Error('Formcraft ERP must load before simplified workspace v4.');

  const VERSION = 'FORMCRAFT-SIMPLE-SHELL-4.0';
  const REQUIRED_ITEMS = ['dashboard', 'apps', 'settings'];
  const DEFAULT_ITEMS = [
    'dashboard', 'apps',
    'projects', 'tasks', 'calendar',
    'crm', 'sales', 'invoices',
    'inventory', 'purchase',
    'employees', 'payroll',
    'reports', 'files', 'settings'
  ];

  const NAV_ITEMS = Object.freeze({
    dashboard: { key: 'dashboard', kind: 'route', route: 'dashboard', section: 'Overview', label: 'Home', icon: 'dashboard' },
    apps: { key: 'apps', kind: 'route', route: 'apps', section: 'Overview', label: 'All apps', icon: 'apps' },
    projects: { key: 'projects', kind: 'route', route: 'projects', section: 'Work', label: 'Projects', icon: 'projects' },
    tasks: { key: 'tasks', kind: 'route', route: 'tasks', section: 'Work', label: 'Tasks', icon: 'tasks' },
    calendar: { key: 'calendar', kind: 'route', route: 'calendar', section: 'Work', label: 'Calendar', icon: 'calendar' },
    crm: { key: 'crm', kind: 'app', appKey: 'crm', section: 'Business', label: 'CRM', icon: 'crm' },
    sales: { key: 'sales', kind: 'app', appKey: 'sales', section: 'Business', label: 'Sales', icon: 'sales' },
    invoices: { key: 'invoices', kind: 'route', route: 'invoices', section: 'Business', label: 'Invoices', icon: 'invoices' },
    accounting: { key: 'accounting', kind: 'app', appKey: 'accounting', section: 'Business', label: 'Accounting', icon: 'accounting' },
    contacts: { key: 'contacts', kind: 'app', appKey: 'contacts', section: 'Business', label: 'Contacts', icon: 'contacts' },
    inventory: { key: 'inventory', kind: 'app', appKey: 'inventory', section: 'Operations', label: 'Inventory', icon: 'inventory' },
    purchase: { key: 'purchase', kind: 'app', appKey: 'purchase', section: 'Operations', label: 'Purchase', icon: 'purchase' },
    manufacturing: { key: 'manufacturing', kind: 'app', appKey: 'manufacturing', section: 'Operations', label: 'Manufacturing', icon: 'manufacturing' },
    helpdesk: { key: 'helpdesk', kind: 'app', appKey: 'helpdesk', section: 'Operations', label: 'Helpdesk', icon: 'helpdesk' },
    employees: { key: 'employees', kind: 'app', appKey: 'employees', section: 'People', label: 'Employees', icon: 'employees' },
    attendance: { key: 'attendance', kind: 'app', appKey: 'attendance', section: 'People', label: 'Attendance', icon: 'attendance' },
    payroll: { key: 'payroll', kind: 'app', appKey: 'payroll', section: 'People', label: 'Payroll', icon: 'payroll' },
    reports: { key: 'reports', kind: 'route', route: 'reports', section: 'Insights', label: 'Reports', icon: 'reports' },
    dashboards: { key: 'dashboards', kind: 'app', appKey: 'dashboards', section: 'Insights', label: 'Dashboards', icon: 'dashboards' },
    email: { key: 'email', kind: 'route', route: 'email', section: 'Tools', label: 'Email', icon: 'mail' },
    files: { key: 'files', kind: 'route', route: 'files', section: 'Tools', label: 'Files', icon: 'files' },
    activity: { key: 'activity', kind: 'route', route: 'activity', section: 'Tools', label: 'Activity', icon: 'activity' },
    settings: { key: 'settings', kind: 'route', route: 'settings', section: 'Tools', label: 'Settings', icon: 'settings' }
  });

  const SECTIONS = ['Overview', 'Work', 'Business', 'Operations', 'People', 'Insights', 'Tools'];
  const escape = value => typeof escapeHtml === 'function' ? escapeHtml(value) : String(value || '');

  function ensureNavigationSettings() {
    state.settings ||= {};
    const existing = state.settings.uiNavigation && typeof state.settings.uiNavigation === 'object'
      ? state.settings.uiNavigation
      : {};
    const requested = Array.isArray(existing.items) ? existing.items : DEFAULT_ITEMS;
    const items = [...new Set([...REQUIRED_ITEMS, ...requested])]
      .filter(key => NAV_ITEMS[key]);
    state.settings.uiNavigation = {
      version: 1,
      items,
      showCounts: existing.showCounts !== false,
      compactLabels: Boolean(existing.compactLabels)
    };
    return state.settings.uiNavigation;
  }

  function routeForItem(item) {
    return item.kind === 'route' ? item.route : `erp-${item.appKey}`;
  }

  function isActive(item) {
    return ui.route === routeForItem(item);
  }

  function isParentActive(item) {
    return item.key === 'apps' && String(ui.route || '').startsWith('erp-') && !isActive(item);
  }

  function itemCount(item) {
    if (!state.settings.uiNavigation.showCounts) return 0;
    if (item.route === 'projects') return state.projects?.length || 0;
    if (item.route === 'tasks') return state.tasks?.filter(task => task.status !== 'done').length || 0;
    if (item.route === 'calendar') return state.events?.length || 0;
    if (item.route === 'invoices') return state.invoices?.filter(invoice => !['paid', 'void'].includes(invoice.status)).length || 0;
    if (item.route === 'email') return state.messages?.filter(message => message.folder === 'inbox' && message.unread).length || 0;
    if (item.kind === 'app') {
      const app = ERP.appByKey(item.appKey);
      return app ? ERP.moduleMetrics(app).total : 0;
    }
    return 0;
  }

  function navButton(item, mobile = false) {
    const active = isActive(item);
    const parent = isParentActive(item);
    const app = item.kind === 'app' ? ERP.appByKey(item.appKey) : null;
    const resolvedIcon = app?.icon || item.icon;
    const count = itemCount(item);
    const attributes = item.kind === 'route'
      ? `data-route="${escape(item.route)}" href="#${escape(item.route)}"`
      : `data-erp-open-app="${escape(item.appKey)}" type="button"`;
    const compatibility = item.key === 'apps' ? 'data-erp-apps-nav' : '';
    const tag = item.kind === 'route' ? 'a' : 'button';
    const stateName = active ? 'active' : parent ? 'parent' : 'inactive';
    return `<${tag} ${attributes} ${compatibility} class="fc4-nav-item ${active ? 'is-active' : ''} ${parent ? 'is-parent-active' : ''}" data-nav-key="${escape(item.key)}" data-nav-state="${stateName}" ${active ? 'aria-current="page"' : ''} ${mobile ? 'data-fc4-mobile-item' : ''}>
      <span class="fc4-nav-icon">${icon(resolvedIcon || 'grid', 18)}</span>
      <span class="fc4-nav-label">${escape(item.label)}</span>
      ${count > 0 ? `<span class="fc4-nav-count">${count > 99 ? '99+' : count}</span>` : ''}
    </${tag}>`;
  }

  function navSections(mobile = false) {
    const settings = ensureNavigationSettings();
    const items = settings.items.map(key => NAV_ITEMS[key]).filter(Boolean);
    return SECTIONS.map(section => {
      const sectionItems = items.filter(item => item.section === section);
      if (!sectionItems.length) return '';
      return `<section class="fc4-nav-section" data-nav-section="${escape(section.toLowerCase())}">
        <h2>${escape(section)}</h2>
        <div class="fc4-nav-list">${sectionItems.map(item => navButton(item, mobile)).join('')}</div>
      </section>`;
    }).join('');
  }

  function navigationSignature(mobile = false) {
    const settings = ensureNavigationSettings();
    const counts = settings.items.map(key => {
      const item = NAV_ITEMS[key];
      return item ? itemCount(item) : 0;
    });
    return JSON.stringify({
      mobile,
      route: ui.route,
      items: settings.items,
      showCounts: settings.showCounts,
      counts,
      workspace: state.settings?.workspaceName || '',
      member: typeof currentUserName === 'function' ? currentUserName() : '',
      role: window.FormcraftBackend?.role || 'member'
    });
  }

  function staticSidebarMarkup() {
    const workspaceName = state.settings?.workspaceName || 'Formcraft workspace';
    return `<header class="fc4-sidebar-header">
      <a href="#dashboard" data-route="dashboard" class="fc4-workspace-brand" aria-label="Open dashboard">
        <span class="fc4-brand-symbol" aria-hidden="true"><i></i><i></i><i></i></span>
        <span><strong>Formcraft</strong><small>${escape(workspaceName)}</small></span>
      </a>
      <button class="icon-button fc4-collapse-button" type="button" data-fc4-collapse-sidebar aria-label="Collapse sidebar" title="Collapse sidebar">${icon('chevronLeft', 18)}</button>
    </header>
    <nav class="fc4-stable-nav" aria-label="Primary navigation">${navSections(false)}</nav>
    <footer class="fc4-sidebar-footer">
      <span class="workspace-user-avatar">${escape(typeof currentUserInitials === 'function' ? currentUserInitials() : 'FC')}</span>
      <span><strong>${escape(typeof currentUserName === 'function' ? currentUserName() : 'Workspace member')}</strong><small>${escape(window.FormcraftBackend?.role || 'member')}</small></span>
    </footer>`;
  }

  function mobileNavigationMarkup() {
    return `<div class="fc4-mobile-nav-intro"><strong>Navigate Formcraft</strong><small>The menu stays the same in every app.</small></div>${navSections(true)}`;
  }

  function bindNavigation(root) {
    root.querySelectorAll('[data-route]').forEach(link => {
      if (link.dataset.fc4Bound) return;
      link.dataset.fc4Bound = 'true';
      link.addEventListener('click', event => {
        event.preventDefault();
        navigate(link.dataset.route);
        document.body.classList.remove('drawer-open', 'fc3-context-open');
      });
    });
    root.querySelectorAll('[data-erp-open-app]').forEach(button => {
      if (button.dataset.fc4Bound) return;
      button.dataset.fc4Bound = 'true';
      button.addEventListener('click', () => {
        const app = ERP.appByKey(button.dataset.erpOpenApp);
        if (app) window.FormcraftERPUI?.goToApp(app);
        document.body.classList.remove('drawer-open', 'fc3-context-open');
      });
    });
  }

  function simplifyTopbar() {
    const breadcrumb = document.querySelector('.fc3-topbar-breadcrumb');
    if (breadcrumb) {
      const current = routes[ui.route]?.label || ERP.moduleByRoute(ui.route)?.label || 'Workspace';
      breadcrumb.innerHTML = `<span>${escape(state.settings?.workspaceName || 'Workspace')}</span><i>/</i><span>${escape(current)}</span>`;
      breadcrumb.setAttribute('aria-label', `Current location: ${current}`);
    }
    document.body.classList.toggle('fc4-module-route', String(ui.route || '').startsWith('erp-'));
    document.body.classList.toggle('fc4-launcher-route', ui.route === 'apps');
  }

  function decorateSidebar() {
    const sidebar = document.querySelector('.fc3-context-sidebar');
    if (sidebar) {
      sidebar.classList.add('fc4-sidebar');
      const signature = navigationSignature(false);
      if (sidebar.dataset.fc4Signature !== signature) {
        sidebar.dataset.fc4Signature = signature;
        sidebar.innerHTML = staticSidebarMarkup();
        bindNavigation(sidebar);
        sidebar.querySelector('[data-fc4-collapse-sidebar]')?.addEventListener('click', () => {
          document.body.classList.toggle('fc4-sidebar-collapsed');
          try { localStorage.setItem('formcraft:simple-shell:collapsed', String(document.body.classList.contains('fc4-sidebar-collapsed'))); } catch {}
        });
      }
    }

    const drawer = document.querySelector('.fc3-mobile-drawer');
    const drawerNav = drawer?.querySelector('.fc3-drawer-nav, .workspace-nav');
    if (drawerNav) {
      drawerNav.classList.add('fc4-mobile-nav');
      const signature = navigationSignature(true);
      if (drawerNav.dataset.fc4Signature !== signature) {
        drawerNav.dataset.fc4Signature = signature;
        drawerNav.innerHTML = mobileNavigationMarkup();
        bindNavigation(drawerNav);
      }
    }
    const drawerTitle = drawer?.querySelector('.fc3-drawer-head strong, .drawer-head strong');
    if (drawerTitle && drawerTitle.textContent !== 'Menu') drawerTitle.textContent = 'Menu';
  }

  let scheduled = false;
  function decorate() {
    scheduled = false;
    ensureNavigationSettings();
    document.documentElement.dataset.workspaceShell = VERSION;
    document.body.classList.add('fc4-simple-shell');
    try {
      document.body.classList.toggle('fc4-sidebar-collapsed', localStorage.getItem('formcraft:simple-shell:collapsed') === 'true');
    } catch {}
    decorateSidebar();
    simplifyTopbar();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(decorate);
  }

  const previousRenderShell = renderShell;
  renderShell = function renderSimplifiedWorkspace(...args) {
    const result = previousRenderShell.apply(this, args);
    schedule();
    return result;
  };

  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.addedNodes.length)) schedule();
  });
  observer.observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', schedule);
  document.addEventListener('formcraft:workspace-ready', schedule);
  schedule();

  window.FormcraftSimpleShell = Object.freeze({
    version: VERSION,
    catalog: NAV_ITEMS,
    defaults: DEFAULT_ITEMS,
    ensureNavigationSettings,
    decorate,
    audit() {
      decorate();
      const desktopLabels = [...document.querySelectorAll('.fc4-sidebar .fc4-nav-item .fc4-nav-label')].map(node => node.textContent.trim());
      const active = document.querySelectorAll('.fc4-sidebar [data-nav-state="active"]').length;
      return {
        status: desktopLabels.length >= 8 && active <= 1 ? 'ready-to-test' : 'blocked',
        labels: desktopLabels,
        active,
        sidebarStable: Boolean(document.querySelector('.fc4-sidebar .fc4-stable-nav')),
        dynamicGroupNavigationPresent: Boolean(document.querySelector('.fc4-sidebar .fc3-context-section'))
      };
    }
  });
})();
