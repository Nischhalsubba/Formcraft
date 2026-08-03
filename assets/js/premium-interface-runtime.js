'use strict';

(() => {
  const ERP = window.FormcraftERP;
  if (!ERP || !window.FormcraftIconography) {
    throw new Error('Formcraft ERP and premium iconography must load before the premium interface runtime.');
  }

  const VERSION = 'FORMCRAFT-PREMIUM-UI-1.0';
  const routeToApp = route => ERP.allApps.find(app => app.nativeRoute === route) || null;
  const currentModule = () => ERP.moduleByRoute(ui.route);
  const currentApp = () => {
    const module = currentModule();
    return module ? ERP.appByKey(module.key) : routeToApp(ui.route);
  };

  function appForNavigationElement(element) {
    const key = element.dataset.erpOpenApp;
    if (key) return ERP.appByKey(key);
    const route = element.dataset.route || element.dataset.sourceRoute || element.dataset.brightRoute;
    return route ? routeToApp(route) : null;
  }

  function replaceAppsGlyph(link) {
    const inRail = Boolean(link.closest('.fc3-app-rail'));
    const host = link.querySelector(inRail ? '.fc3-rail-icon' : '.workspace-nav-icon');
    if (host && host.querySelector('svg')?.dataset.icon !== 'apps') host.innerHTML = icon('apps', inRail ? 20 : 17);
  }

  function decorateAppCards() {
    document.querySelectorAll('.erp-app-card').forEach(card => {
      const opener = card.querySelector('[data-erp-open-app]');
      const app = opener ? ERP.appByKey(opener.dataset.erpOpenApp) : null;
      if (!app) return;
      card.dataset.appKey = app.key;
      card.dataset.appGroup = app.group;
      const glyph = card.querySelector('.erp-app-icon svg[data-icon]');
      if (glyph) card.dataset.iconName = glyph.dataset.icon;
      else delete card.dataset.iconName;
      const title = card.querySelector('.erp-app-copy strong')?.textContent?.trim() || app.label;
      opener.setAttribute('aria-label', `Open ${title}`);
    });
  }

  function decorateContextNavigation() {
    const context = document.querySelector('.fc3-context-sidebar');
    if (!context) return;
    const directAppsLink = context.querySelector('.fc3-context-nav > [data-erp-apps-nav]');
    if (directAppsLink) {
      directAppsLink.hidden = false;
      directAppsLink.setAttribute('aria-label', 'Open app launcher');
      const title = directAppsLink.querySelector('.fc3-context-link-copy strong');
      const description = directAppsLink.querySelector('.fc3-context-link-copy small');
      if (title) title.textContent = 'App launcher';
      if (description) description.textContent = 'Browse all applications';
      replaceAppsGlyph(directAppsLink);
    }

    context.querySelectorAll('[data-erp-open-app], [data-route], [data-source-route]').forEach(item => {
      const app = appForNavigationElement(item);
      if (app) {
        item.dataset.appKey = app.key;
        item.dataset.appGroup = app.group;
      }
      const active = item.classList.contains('is-active') || item.getAttribute('aria-current') === 'page';
      item.dataset.navState = active ? 'active' : 'inactive';
    });

    const current = currentApp();
    const currentButton = context.querySelector('.fc3-current-app');
    if (currentButton && current) {
      currentButton.dataset.appKey = current.key;
      currentButton.dataset.appGroup = current.group;
    }
    if (currentButton && ui.route === 'apps') {
      const iconHost = currentButton.querySelector('.fc3-current-app-icon');
      if (iconHost) iconHost.innerHTML = icon('apps', 18);
    }
  }

  function normalizeAppsState() {
    const moduleActive = String(ui.route || '').startsWith('erp-');
    document.querySelectorAll('[data-erp-apps-nav]').forEach(link => {
      const inRail = Boolean(link.closest('.fc3-app-rail'));
      const actual = ui.route === 'apps';
      const parent = inRail && moduleActive;
      replaceAppsGlyph(link);
      link.classList.toggle('is-active', actual);
      link.classList.toggle('is-parent-active', parent && !actual);
      link.dataset.navState = actual ? 'active' : parent ? 'parent' : 'inactive';
      if (actual) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function decorateRail() {
    document.querySelectorAll('.fc3-app-rail [data-erp-open-app], .fc3-app-rail [data-route]').forEach(item => {
      const app = appForNavigationElement(item);
      if (app) {
        item.dataset.appKey = app.key;
        item.dataset.appGroup = app.group;
      }
      if (!item.matches('[data-erp-apps-nav]')) {
        const active = item.classList.contains('is-active') || item.getAttribute('aria-current') === 'page';
        item.dataset.navState = active ? 'active' : 'inactive';
      }
    });
  }

  function decorateMobileNavigation() {
    document.querySelectorAll('.fc3-mobile-bottom-nav [data-route], .fc3-mobile-bottom-nav [data-erp-open-app]').forEach(item => {
      const app = appForNavigationElement(item);
      if (app) {
        item.dataset.appKey = app.key;
        item.dataset.appGroup = app.group;
      }
      const active = item.classList.contains('is-active') || item.getAttribute('aria-current') === 'page';
      item.dataset.navState = active ? 'active' : 'inactive';
    });
  }

  function decorateGroupTabs() {
    document.querySelectorAll('[data-erp-launcher-group]').forEach(button => {
      const group = button.dataset.erpLauncherGroup;
      button.dataset.appGroup = group === 'all' ? 'all' : group;
      button.dataset.navState = button.classList.contains('is-active') ? 'active' : 'inactive';
    });
  }

  function decorate() {
    document.documentElement.classList.add('formcraft-premium-interface');
    document.body.dataset.formcraftUi = VERSION;
    decorateAppCards();
    decorateContextNavigation();
    decorateRail();
    decorateMobileNavigation();
    decorateGroupTabs();
    normalizeAppsState();
  }

  let scheduled = false;
  function scheduleDecoration() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decorate();
    });
  }

  const previousRenderShell = renderShell;
  renderShell = function renderPremiumFormcraftShell(...args) {
    const result = previousRenderShell.apply(this, args);
    scheduleDecoration();
    return result;
  };

  const observer = new MutationObserver(scheduleDecoration);
  observer.observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
  window.addEventListener('resize', scheduleDecoration);
  window.addEventListener('hashchange', scheduleDecoration);
  scheduleDecoration();

  window.FormcraftPremiumInterface = Object.freeze({
    version: VERSION,
    decorate,
    audit() {
      decorate();
      const cards = [...document.querySelectorAll('.erp-app-card')];
      const cardIcons = cards.map(card => card.dataset.iconName).filter(Boolean);
      const activeByRegion = [...document.querySelectorAll('.fc3-app-rail, .fc3-context-sidebar, .fc3-mobile-bottom-nav')]
        .map(region => ({
          region: region.className,
          active: region.querySelectorAll('[data-nav-state="active"]').length,
          parent: region.querySelectorAll('[data-nav-state="parent"]').length
        }));
      const genericCards = cards.filter(card => ['grid', 'file', 'apps'].includes(card.dataset.iconName));
      return {
        status: genericCards.length ? 'blocked' : 'ready-to-test',
        cardCount: cards.length,
        uniqueCardIcons: new Set(cardIcons).size,
        genericCardIcons: genericCards.map(card => card.dataset.appKey),
        duplicateCardIcons: cardIcons.filter((name, index) => cardIcons.indexOf(name) !== index),
        activeByRegion
      };
    }
  });
})();
