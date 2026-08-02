'use strict';

(() => {
  const ERP = window.FormcraftERP;
  const UI = window.FormcraftERPUI;
  if (!ERP || !UI) throw new Error('Formcraft ERP must load before the ERP shell boot guard.');

  const appsActive = () => ui.route === 'apps' || String(ui.route || '').startsWith('erp-');

  function appsLinkMarkup() {
    const active = appsActive();
    return `<a href="#apps" data-route="apps" data-erp-apps-nav class="workspace-nav-link ${active ? 'is-active' : ''}" ${active ? 'aria-current="page"' : ''}>
      <span class="workspace-nav-icon">${icon('grid', 18)}</span>
      <span>Apps</span>
      <span class="workspace-nav-count">${ERP.allApps.length}</span>
    </a>`;
  }

  function updateActiveState(link) {
    const active = appsActive();
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  function injectAppsNavigation() {
    const navs = [
      document.querySelector('.workspace-sidebar .workspace-nav'),
      document.querySelector('.mobile-drawer .drawer-nav')
    ].filter(Boolean);

    navs.forEach(nav => {
      let link = nav.querySelector('[data-erp-apps-nav]');
      if (!link) {
        const template = document.createElement('template');
        template.innerHTML = appsLinkMarkup().trim();
        link = template.content.firstElementChild;
        const dashboard = nav.querySelector('[data-route="dashboard"]');
        if (dashboard) dashboard.after(link);
        else nav.prepend(link);
      }
      updateActiveState(link);
    });

    const accountList = document.querySelector('[data-account-popover] .utility-popover-list');
    if (accountList && !accountList.querySelector('[data-erp-open-launcher]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.erpOpenLauncher = '';
      button.innerHTML = `${icon('grid', 17)}Business apps`;
      accountList.prepend(button);
    }
  }

  let scheduled = false;
  function scheduleInjection() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      injectAppsNavigation();
    });
  }

  const priorRenderShell = renderShell;
  renderShell = function renderShellWithERPApps(...args) {
    const result = priorRenderShell.apply(this, args);
    scheduleInjection();
    return result;
  };

  const appRoot = document.querySelector('#app');
  const observer = new MutationObserver(scheduleInjection);
  if (appRoot) observer.observe(appRoot, { childList: true, subtree: true });

  const requestedRoute = () => location.hash.slice(1);
  const synchronizeInitialRoute = () => {
    const route = requestedRoute();
    if ((route === 'apps' || route.startsWith('erp-')) && routes[route] && ui.route !== route) {
      ui.route = route;
      const params = new URLSearchParams(location.search);
      const moduleKey = params.get('erp');
      const recordId = params.get('record');
      if (moduleKey && recordId) ui.erp.record = { moduleKey, id: recordId };
      renderShell();
    } else {
      scheduleInjection();
    }
  };

  if (document.documentElement.dataset.backend === 'ready') synchronizeInitialRoute();
  else {
    const timer = window.setInterval(() => {
      if (document.documentElement.dataset.backend !== 'ready') return;
      window.clearInterval(timer);
      synchronizeInitialRoute();
    }, 50);
  }

  window.addEventListener('hashchange', scheduleInjection);
  scheduleInjection();

  window.FormcraftERPBoot = Object.freeze({ injectAppsNavigation, synchronizeInitialRoute });
})();
