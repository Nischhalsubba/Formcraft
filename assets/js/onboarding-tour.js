'use strict';

(() => {
  const TOUR_VERSION = '2026.08.07.3';
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
      const raw = window.localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeState(status) {
    try {
      window.localStorage.setItem(storageKey(), JSON.stringify({ status, at: new Date().toISOString() }));
    } catch {
      // Storage can be disabled. The tour still works for this session.
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
    const state = readState();
    return state?.status === 'completed' || state?.status === 'dismissed';
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
          description: 'Here is a quick tour. It takes less than a minute.',
          side: 'over',
          align: 'center'
        }
      },
      {
        element: '.fc4-sidebar [data-route="dashboard"]',
        popover: {
          title: 'Home',
          description: 'See your workspace overview and the work that needs attention.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.fc4-sidebar [data-route="projects"]',
        popover: {
          title: 'Projects',
          description: 'Keep project work, owners, dates, and progress in one place.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.fc4-sidebar [data-route="tasks"]',
        popover: {
          title: 'Tasks',
          description: 'See what needs to be done, who owns it, and when it is due.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.fc3-global-search.workspace-search-trigger',
        popover: {
          title: 'Search',
          description: 'Find records, apps, and actions quickly. Press Ctrl K anytime.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '[data-command-menu]',
        popover: {
          title: 'Create',
          description: 'Use + to add a project, task, event, invoice, and more.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: '[data-toggle-notifications]',
        popover: {
          title: 'Notifications',
          description: 'Check recent updates and activity here.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: '[data-toggle-account]',
        popover: {
          title: 'Your account',
          description: 'Open settings, export data, sign out, or restart this tour.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        popover: {
          title: "You're ready",
          description: 'That is it. Start with Home, then use Search or + whenever you need something.',
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
          description: 'Here is a quick tour of the main mobile controls.',
          side: 'over',
          align: 'center'
        }
      },
      {
        element: '.fc3-mobile-bottom-nav [data-route="dashboard"]',
        popover: {
          title: 'Home',
          description: 'Tap Home to see your workspace overview.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.fc3-mobile-bottom-nav [data-route="apps"]',
        popover: {
          title: 'Apps',
          description: 'Open Apps to find your business tools.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '[data-bright-context-create]',
        popover: {
          title: 'Create',
          description: 'Tap Create to add new work from the page you are on.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '[data-bright-more]',
        popover: {
          title: 'More',
          description: 'Tap More to open the full menu.',
          side: 'top',
          align: 'end'
        }
      },
      {
        popover: {
          title: "You're ready",
          description: 'Use Home, Apps, Create, and More to move around.',
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
      ['dashboard', 'Home'],
      ['projects', 'Projects'],
      ['tasks', 'Tasks'],
      ['search', 'Search'],
      ['plus', 'Create'],
      ['settings', 'Settings']
    ];
    return items.map(([iconName, label]) => `<div class="product-tour-fallback-item">${icon(iconName, 18)}<span>${escapeHtml(label)}</span></div>`).join('');
  }

  function showFallbackTour() {
    fallbackOpen = true;
    restoreTourShell();
    openModal(`<div class="modal-card product-tour-fallback">
      <div class="modal-head"><div><p class="panel-kicker">Quick tour</p><h2 id="modal-title">Welcome to Formcraft</h2><p>These are the main places you will use.</p></div><button class="icon-button" type="button" data-dismiss-product-tour aria-label="Close product tour">${icon('close', 18)}</button></div>
      <div class="modal-body"><p class="panel-description">Use the menu to move around. Use Search to find something fast, and use + to create new work.</p><div class="product-tour-fallback-list">${fallbackItems()}</div></div>
      <div class="modal-actions"><button class="button button-secondary" type="button" data-dismiss-product-tour>Skip</button><button class="button button-primary" type="button" data-complete-product-tour>Done</button></div>
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
        progressText: 'Step {{current}} of {{total}}',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        popoverClass: 'formcraft-tour-popover',
        overlayColor: '#0d1715',
        overlayOpacity: 0.5,
        stagePadding: 4,
        stageRadius: 10,
        skipMissingElement: true,
        waitForElement: 500,
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
