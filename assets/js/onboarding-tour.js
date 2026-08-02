'use strict';

(() => {
  const TOUR_VERSION = '2026.08.02.1';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeTour = null;
  let autoStartTimer = null;
  let fallbackOpen = false;

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

  function complete(status = 'completed') {
    writeState(status);
    document.dispatchEvent(new CustomEvent('formcraft:product-tour-finished', { detail: { status, version: TOUR_VERSION } }));
  }

  function desktopSteps() {
    return [
      {
        popover: {
          title: 'Welcome to Formcraft',
          description: 'This short walkthrough shows where work lives, how to create records, and how to find anything again.',
          side: 'over',
          align: 'center'
        }
      },
      {
        element: '.workspace-brand',
        popover: {
          title: 'Your workspace',
          description: 'The workspace name and dashboard link stay here. Select it whenever you need to return to the overview.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: '.workspace-sidebar .workspace-nav',
        popover: {
          title: 'Every source module is available',
          description: 'Projects, tasks, calendar, team, reports, email, files, invoices, activity, and settings are all accessible from the sidebar.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.workspace-sidebar [data-route="projects"]',
        popover: {
          title: 'Plan delivery with projects',
          description: 'Define scope, owner, dates, status, progress, linked tasks, events, and billing.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.workspace-sidebar [data-route="calendar"]',
        popover: {
          title: 'Schedule work',
          description: 'Use the calendar for meetings, reviews, deadlines, and reminders. Select any empty day cell to create an event.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.workspace-sidebar [data-route="reports"]',
        popover: {
          title: 'Review performance',
          description: 'Reports summarize project completion, task distribution, and overdue work from live workspace records.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.workspace-sidebar [data-route="email"]',
        popover: {
          title: 'Manage workspace messages',
          description: 'Compose, search, star, archive, and organize messages without leaving the workspace.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: '.workspace-search-trigger',
        popover: {
          title: 'Search the whole workspace',
          description: 'Find projects, tasks, people, events, messages, files, and invoices. You can also press Ctrl or Command + K.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '.workspace-create-button',
        popover: {
          title: 'Create from anywhere',
          description: 'Open the create menu to add projects, tasks, events, messages, files, invoices, or members.',
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
          description: 'Open this menu for workspace settings, data export, sign out, or to replay this product tour.',
          side: 'right',
          align: 'end'
        }
      },
      {
        popover: {
          title: 'You are ready to work',
          description: 'Start with a project, connect tasks and events, then use reports, activity, and invoices to keep delivery visible.',
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
          description: 'This walkthrough introduces the mobile workspace and the quickest ways to move and create.',
          side: 'over',
          align: 'center'
        }
      },
      {
        element: '.bright-bottom-nav',
        popover: {
          title: 'Primary navigation',
          description: 'Dashboard, projects, tasks, and calendar stay one tap away.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '[data-bright-more]',
        popover: {
          title: 'All workspace modules',
          description: 'Open More for team, reports, email, files, invoices, activity, and settings.',
          side: 'top',
          align: 'end'
        }
      },
      {
        element: '.bright-mobile-create',
        popover: {
          title: 'Context-aware creation',
          description: 'This action changes with the current page, so creating the right record takes fewer steps.',
          side: 'top',
          align: 'end'
        }
      },
      {
        element: '.workspace-search-trigger',
        popover: {
          title: 'Search everything',
          description: 'Search across projects, tasks, people, events, messages, files, and invoices.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        popover: {
          title: 'You are ready',
          description: 'Use More whenever you need a secondary module, and replay this tour later from Settings.',
          side: 'over',
          align: 'center'
        }
      }
    ];
  }

  function buildSteps() {
    return window.matchMedia('(max-width: 760px)').matches ? mobileSteps() : desktopSteps();
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
    openModal(`<div class="modal-card product-tour-fallback">
      <div class="modal-head"><div><p class="panel-kicker">First-login walkthrough</p><h2 id="modal-title">Welcome to Formcraft</h2><p>Everything required to plan, communicate, deliver, and review work lives in this workspace.</p></div><button class="icon-button" type="button" data-dismiss-product-tour aria-label="Close product tour">${icon('close', 18)}</button></div>
      <div class="modal-body"><p class="panel-description">Use the sidebar on desktop or More on mobile to access every source module. Search and the create menu remain available across the application.</p><div class="product-tour-fallback-list">${fallbackItems()}</div></div>
      <div class="modal-actions"><button class="button button-secondary" type="button" data-dismiss-product-tour>Not now</button><button class="button button-primary" type="button" data-complete-product-tour>Start using Formcraft</button></div>
    </div>`);
  }

  function destroyActiveTour() {
    activeTour?.destroy?.();
    activeTour = null;
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

    window.setTimeout(() => {
      const driverFactory = window.driver?.js?.driver;
      if (typeof driverFactory !== 'function') {
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
        overlayColor: '#0f172a',
        overlayOpacity: 0.56,
        stagePadding: 8,
        stageRadius: 10,
        skipMissingElement: true,
        waitForElement: 1600,
        steps: buildSteps(),
        onCloseClick: () => finish('dismissed'),
        onDoneClick: () => finish('completed'),
        onDestroyed: () => {
          activeTour = null;
        }
      });
      activeTour.drive();
    }, ui.route === 'dashboard' ? 60 : 180);
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

  const observer = new MutationObserver(considerAutoStart);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-backend'] });
  observer.observe(document.body, { childList: true, subtree: true });
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