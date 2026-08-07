'use strict';

(() => {
  const TOUR_VERSION = '2026.08.07.2';
  const DRIVER_VERSION = '1.8.0';
  const DRIVER_SCRIPT = `https://cdn.jsdelivr.net/npm/driver.js@${DRIVER_VERSION}/dist/driver.js.iife.js`;
  const DRIVER_STYLES = `https://cdn.jsdelivr.net/npm/driver.js@${DRIVER_VERSION}/dist/driver.css`;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeTour = null;
  let autoStartTimer = null;
  let fallbackOpen = false;
  let driverAssetsPromise = null;
  let restoreShellAfterTour = null;

  function userIdentity() {
    const user = window.FormcraftBackend?.session?.user;
    return user?.id || user?.email || 'anonymous';
  }

  function storageKey() {
    return `formcraft:product-tour:${TOUR_VERSION}:${userIdentity()}`;
  }

  function readState() {
    try {
      return window.localStorage.getItem(storageKey());
    } catch {
      return null;
    }
  }

  function writeState(status) {
    try {
      window.localStorage.setItem(storageKey(), JSON.stringify({ status, at: new Date().toISOString() }));
    } catch {
      // Storage can be disabled. The tour still remains usable for this session.
    }
  }

  function clearState() {
    try {
      window.localStorage.removeItem(storageKey());
    } catch {
      // Nothing useful to do when storage is unavailable.
    }
  }

  function isSeen() {
    return Boolean(readState());
  }

  function restoreTourShell() {
    const restore = restoreShellAfterTour;
    restoreShellAfterTour = null;
    restore?.();
  }

  function complete(status = 'completed') {
    writeState(status);
    restoreTourShell();
    document.dispatchEvent(new CustomEvent('formcraft:product-tour-finished', { detail: { status, version: TOUR_VERSION } }));
  }

  function ensureDriverAssets() {
    const existing = window.driver?.js?.driver;
    if (typeof existing === 'function') return Promise.resolve(existing);
    if (driverAssetsPromise) return driverAssetsPromise;

    driverAssetsPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-formcraft-driver-css]')) {
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = DRIVER_STYLES;
        stylesheet.dataset.formcraftDriverCss = 'true';
        document.head.append(stylesheet);
      }

      const finish = () => {
        const factory = window.driver?.js?.driver;
        if (typeof factory === 'function') resolve(factory);
        else reject(new Error('Driver.js loaded without a driver factory.'));
      };

      const existingScript = document.querySelector('script[data-formcraft-driver-js]');
      if (existingScript) {
        existingScript.addEventListener('load', finish, { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Driver.js failed to load.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = DRIVER_SCRIPT;
      script.defer = true;
      script.dataset.formcraftDriverJs = 'true';
      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', () => reject(new Error('Driver.js failed to load.')), { once: true });
      document.head.append(script);
    }).catch(error => {
      driverAssetsPromise = null;
      throw error;
    });

    return driverAssetsPromise;
  }

  function desktopSteps() {
    return [
      {
        popover: {
          title: 'Welcome to Formcraft',
          description: 'A quick tour of the controls you will use every day. Each step highlights the real control in place, then Next moves you forward.',
          side: 'over',
          align: 'center'
        }
      },
      {
        element: '.fc4-sidebar .fc4-workspace-brand',
        popover: {
          title: 'Workspace home',
          description: 'Your workspace identity lives here. Select it whenever you want to return to the dashboard.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: '.fc4-sidebar .fc4-stable-nav',
        popover: {
          title: 'Main navigation',
          description: 'Your everyday work, business, operations, people, insights, and tools stay in one consistent navigation area.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.fc4-sidebar [data-route="projects"]',
        popover: {
          title: 'Plan delivery with projects',
          description: 'Define scope, owner, dates, status, progress, linked tasks, events, and billing.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.fc4-sidebar [data-route="calendar"]',
        popover: {
          title: 'Schedule work',
          description: 'Use the calendar for meetings, reviews, deadlines, and reminders.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.fc4-sidebar [data-route="reports"]',
        popover: {
          title: 'Review performance',
          description: 'Reports summarize delivery progress, work distribution, and overdue items from live workspace records.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.fc4-sidebar [data-route="files"]',
        popover: {
          title: 'Keep working files together',
          description: 'Open Files for shared documents and project resources without leaving the workspace.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.fc3-global-search.workspace-search-trigger',
        popover: {
          title: 'Search the whole workspace',
          description: 'Find records, apps, and actions from one place. You can also press Ctrl or Command + K.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '[data-command-menu]',
        popover: {
          title: 'Create from anywhere',
          description: 'Open quick create for the records you need without navigating away first.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: '[data-toggle-notifications]',
        popover: {
          title: 'Keep up with changes',
          description: 'Notifications surface recent workspace activity and important updates.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: '[data-toggle-account]',
        popover: {
          title: 'Account and help',
          description: 'Use this menu for settings, data export, sign out, and replaying this product tour.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        popover: {
          title: 'You are ready to work',
          description: 'Start with the dashboard, create the next record you need, and use search whenever you want to jump directly to something.',
          side: 'over',
          align: 'center'
        }
      }
    ];
  }

  function mobileSteps() {
    return [
      {
        popover: {
          title: 'Welcome to Formcraft',
          description: 'A short tour of the mobile controls you will use most. Each step highlights the actual control before moving forward.',
          side: 'over',
          align: 'center'
        }
      },
      {
        element: '.fc3-mobile-bottom-nav',
        popover: {
          title: 'Quick navigation',
          description: 'Home, Apps, the current work area, Create, and More stay one tap away.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '[data-bright-more]',
        popover: {
          title: 'Open the full menu',
          description: 'More opens the complete workspace navigation when you need a secondary module or tool.',
          side: 'top',
          align: 'end'
        }
      },
      {
        element: '[data-bright-context-create]',
        popover: {
          title: 'Create in context',
          description: 'The center action adapts to the page so the most relevant record is always close by.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.fc3-global-search.workspace-search-trigger',
        popover: {
          title: 'Search everything',
          description: 'Search records, apps, and actions without digging through menus.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '[data-toggle-account]',
        popover: {
          title: 'Account and help',
          description: 'Open your account menu for settings, export, sign out, and this tour.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        popover: {
          title: 'You are ready',
          description: 'Use the bottom navigation for daily work, More for the full workspace, and Search when you already know what you need.',
          side: 'over',
          align: 'center'
        }
      }
    ];
  }

  function buildSteps() {
    return window.matchMedia('(max-width: 820px)').matches ? mobileSteps() : desktopSteps();
  }

  function isVisibleTourTarget(element) {
    if (!(element instanceof Element) || !element.isConnected || element.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
  }

  function resolveVisibleSteps(steps) {
    return steps.flatMap(step => {
      if (!step.element) return [step];
      const target = typeof step.element === 'string' ? document.querySelector(step.element) : step.element;
      if (!isVisibleTourTarget(target)) return [];
      return [{ ...step, element: target }];
    });
  }

  function prepareTourShell() {
    restoreTourShell();
    const body = document.body;
    const stateBefore = {
      fc4Collapsed: body.classList.contains('fc4-sidebar-collapsed'),
      fc3Collapsed: body.classList.contains('fc3-sidebar-collapsed'),
      contextOpen: body.classList.contains('fc3-context-open'),
      drawerOpen: body.classList.contains('drawer-open')
    };

    body.classList.remove('drawer-open', 'fc3-context-open');
    if (!window.matchMedia('(max-width: 820px)').matches) {
      body.classList.remove('fc4-sidebar-collapsed', 'fc3-sidebar-collapsed');
      window.FormcraftSimpleShell?.decorate?.();
    }

    restoreShellAfterTour = () => {
      body.classList.toggle('fc4-sidebar-collapsed', stateBefore.fc4Collapsed);
      body.classList.toggle('fc3-sidebar-collapsed', stateBefore.fc3Collapsed);
      body.classList.toggle('fc3-context-open', stateBefore.contextOpen);
      body.classList.toggle('drawer-open', stateBefore.drawerOpen);
      window.FormcraftSimpleShell?.decorate?.();
    };
  }

  function fallbackItems() {
    const items = [
      ['projects', 'Projects and tasks'],
      ['calendar', 'Calendar and events'],
      ['reports', 'Reports and activity'],
      ['mail', 'Email and communication'],
      ['files', 'Files and invoices'],
      ['search', 'Search and create menu']
    ];
    return items.map(([iconName, label]) => `<div class="product-tour-fallback-item">${icon(iconName, 18)}<span>${escapeHtml(label)}</span></div>`).join('');
  }

  function showFallbackTour() {
    fallbackOpen = true;
    restoreTourShell();
    openModal(`<div class="modal-card product-tour-fallback">
      <div class="modal-head"><div><p class="panel-kicker">First-login walkthrough</p><h2 id="modal-title">Welcome to Formcraft</h2><p>Everything required to plan, communicate, deliver, and review work lives in this workspace.</p></div><button class="icon-button" type="button" data-dismiss-product-tour aria-label="Close product tour">${icon('close', 18)}</button></div>
      <div class="modal-body"><p class="panel-description">Use the sidebar on desktop or More on mobile to access every source module. Search and the create menu remain available across the application.</p><div class="product-tour-fallback-list">${fallbackItems()}</div></div>
      <div class="modal-actions"><button class="button button-secondary" type="button" data-dismiss-product-tour>Not now</button><button class="button button-primary" type="button" data-complete-product-tour>Start using Formcraft</button></div>
    </div>`);
  }

  function destroyActiveTour() {
    activeTour?.destroy?.();
    activeTour = null;
    restoreTourShell();
  }

  function start(options = {}) {
    const force = Boolean(options.force);
    if (activeTour || fallbackOpen) return;
    if (!force && isSeen()) return;
    if (document.documentElement.dataset.backend !== 'ready' || !document.querySelector('.workspace-shell')) return;

    writeState('started');
    if (modal.open) closeModal();
    if (ui.route !== 'dashboard') navigate('dashboard');
    window.FormcraftFeatures?.enhance?.();
    prepareTourShell();

    window.setTimeout(async () => {
      let driverFactory = window.driver?.js?.driver;
      if (typeof driverFactory !== 'function') {
        try {
          driverFactory = await ensureDriverAssets();
        } catch {
          showFallbackTour();
          return;
        }
      }

      if (typeof driverFactory !== 'function') {
        showFallbackTour();
        return;
      }

      const steps = resolveVisibleSteps(buildSteps());
      if (steps.length < 3) {
        showFallbackTour();
        return;
      }

      const finish = status => {
        complete(status);
        const tour = activeTour;
        activeTour = null;
        tour?.destroy?.();
      };

      activeTour = driverFactory({
        animate: !reducedMotion.matches,
        smoothScroll: !reducedMotion.matches,
        allowClose: true,
        showProgress: true,
        progressText: '{{current}} of {{total}}',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Finish',
        popoverClass: 'formcraft-tour-popover',
        overlayColor: '#111827',
        overlayOpacity: 0.62,
        stagePadding: 7,
        stageRadius: 12,
        skipMissingElement: true,
        waitForElement: 600,
        steps,
        onCloseClick: () => finish('dismissed'),
        onDoneClick: () => finish('completed'),
        onDestroyed: () => {
          activeTour = null;
          restoreTourShell();
        }
      });
      activeTour.drive();
    }, ui.route === 'dashboard' ? 80 : 200);
  }

  function considerAutoStart() {
    if (navigator.webdriver || isSeen() || activeTour || fallbackOpen) return;
    if (document.documentElement.dataset.backend !== 'ready' || !document.querySelector('.workspace-shell')) return;
    window.clearTimeout(autoStartTimer);
    autoStartTimer = window.setTimeout(() => start(), 550);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-complete-product-tour]')) {
      event.preventDefault();
      complete('completed');
      fallbackOpen = false;
      closeModal();
      return;
    }
    if (event.target.closest('[data-dismiss-product-tour]')) {
      event.preventDefault();
      complete('dismissed');
      fallbackOpen = false;
      closeModal();
    }
  }, true);

  const backendObserver = new MutationObserver(considerAutoStart);
  backendObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-backend'] });

  const appRoot = document.querySelector('#app');
  const appObserver = appRoot ? new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.type === 'childList' && mutation.addedNodes.length)) considerAutoStart();
  }) : null;
  appObserver?.observe(appRoot, { childList: true });

  document.addEventListener('formcraft:workspace-ready', considerAutoStart);

  window.FormcraftOnboarding = Object.freeze({
    version: TOUR_VERSION,
    start,
    reset() {
      destroyActiveTour();
      fallbackOpen = false;
      if (modal.open) closeModal();
      clearState();
      window.setTimeout(() => start({ force: true }), 80);
    },
    isComplete: isSeen,
    storageKey
  });

  considerAutoStart();
})();
