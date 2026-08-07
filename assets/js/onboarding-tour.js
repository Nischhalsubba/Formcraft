'use strict';

(() => {
  const TOUR_VERSION = '2026.08.07.5';
  const MOBILE_BREAKPOINT = 820;
  const CARD_GAP = 14;
  const VIEWPORT_PAD = 14;
  const STAGE_PAD = 7;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let active = false;
  let autoStartTimer = null;
  let restoreShellAfterTour = null;
  let root = null;
  let steps = [];
  let stepIndex = 0;
  let currentTarget = null;
  let previousFocus = null;
  let layoutRaf = 0;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
      // The tour can still run when storage is unavailable.
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

  function desktopSteps() {
    return [
      { title: 'Welcome to Formcraft', description: 'Here is a quick tour of the main controls.', placement: 'center' },
      { selector: '.fc4-sidebar [data-route="dashboard"]', title: 'Home', description: 'See your workspace overview and what needs attention.', placement: 'right' },
      { selector: '.fc4-sidebar [data-route="projects"]', title: 'Projects', description: 'Keep project work, owners, dates, and progress together.', placement: 'right' },
      { selector: '.fc4-sidebar [data-route="tasks"]', title: 'Tasks', description: 'See what needs to be done, who owns it, and when it is due.', placement: 'right' },
      { selector: '.fc3-global-search.workspace-search-trigger', title: 'Search', description: 'Find records, apps, and actions. Press Ctrl K anytime.', placement: 'bottom-start' },
      { selector: '[data-command-menu]', title: 'Create', description: 'Use + to add a project, task, event, invoice, and more.', placement: 'bottom-end' },
      { selector: '[data-toggle-notifications]', title: 'Notifications', description: 'Check recent updates and activity here.', placement: 'bottom-end' },
      { selector: '[data-toggle-account]', title: 'Your account', description: 'Open settings, export data, sign out, or restart this tour.', placement: 'bottom-end' },
      { title: "You're ready", description: 'Start with Home. Use Search or + whenever you need something.', placement: 'center' }
    ];
  }

  function mobileSteps() {
    return [
      { title: 'Welcome to Formcraft', description: 'Here is a quick tour of the main mobile controls.', placement: 'center' },
      { selector: '.fc3-mobile-bottom-nav [data-route="dashboard"]', title: 'Home', description: 'Tap Home to see your workspace overview.', placement: 'top' },
      { selector: '.fc3-mobile-bottom-nav [data-route="apps"]', title: 'Apps', description: 'Open Apps to find your business tools.', placement: 'top' },
      { selector: '[data-bright-context-create]', title: 'Create', description: 'Tap Create to add new work from the page you are on.', placement: 'top' },
      { selector: '[data-bright-more]', title: 'More', description: 'Tap More to open the full menu.', placement: 'top-end' },
      { title: "You're ready", description: 'Use Home, Apps, Create, and More to move around.', placement: 'center' }
    ];
  }

  function isVisibleTarget(element) {
    if (!(element instanceof Element) || !element.isConnected || element.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
  }

  function resolveSteps(definitions) {
    return definitions.flatMap(step => {
      if (!step.selector) return [{ ...step, target: null }];
      const target = document.querySelector(step.selector);
      return isVisibleTarget(target) ? [{ ...step, target }] : [];
    });
  }

  function workspaceRect() {
    if (window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches) {
      return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight };
    }

    const main = document.querySelector('.fc3-main.workspace-main') || document.querySelector('.workspace-main');
    const rect = main?.getBoundingClientRect();
    if (!rect || rect.width < 200) {
      return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight };
    }

    return {
      left: clamp(rect.left, 0, window.innerWidth),
      top: 0,
      right: clamp(rect.right, 0, window.innerWidth),
      bottom: window.innerHeight,
      width: clamp(rect.width, 0, window.innerWidth),
      height: window.innerHeight
    };
  }

  function prepareTourShell() {
    const body = document.body;
    const stateBefore = {
      fc4Collapsed: body.classList.contains('fc4-sidebar-collapsed'),
      fc3Collapsed: body.classList.contains('fc3-sidebar-collapsed'),
      contextOpen: body.classList.contains('fc3-context-open'),
      drawerOpen: body.classList.contains('drawer-open')
    };

    body.classList.remove('drawer-open', 'fc3-context-open');
    if (!window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches) {
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

  function closeIcon() {
    return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  function ensureRoot() {
    if (root?.isConnected) return root;

    root = document.createElement('div');
    root.className = 'fc-tour';
    root.dataset.fcTourRoot = 'true';
    root.innerHTML = `
      <div class="fc-tour__blocker" data-fc-tour-blocker aria-hidden="true"></div>
      <div class="fc-tour__stage" data-fc-tour-stage aria-hidden="true"></div>
      <section class="fc-tour__card" data-fc-tour-card role="dialog" aria-modal="true" aria-labelledby="fc-tour-title" aria-describedby="fc-tour-description" tabindex="-1">
        <div class="fc-tour__body">
          <div class="fc-tour__heading-row">
            <h2 class="fc-tour__title" id="fc-tour-title" data-fc-tour-title></h2>
            <button class="fc-tour__close" type="button" data-fc-tour-close aria-label="Close tour">${closeIcon()}</button>
          </div>
          <p class="fc-tour__description" id="fc-tour-description" data-fc-tour-description></p>
        </div>
        <footer class="fc-tour__footer">
          <div class="fc-tour__progress" aria-label="Tour progress">
            <span class="fc-tour__progress-label" data-fc-tour-progress-label></span>
            <span class="fc-tour__progress-track" aria-hidden="true"><span data-fc-tour-progress-bar></span></span>
          </div>
          <div class="fc-tour__actions">
            <button class="fc-tour__button fc-tour__button--secondary" type="button" data-fc-tour-back>Back</button>
            <button class="fc-tour__button fc-tour__button--primary" type="button" data-fc-tour-next>Next</button>
          </div>
        </footer>
      </section>`;

    document.body.append(root);
    root.querySelector('[data-fc-tour-close]')?.addEventListener('click', () => finish('dismissed'));
    root.querySelector('[data-fc-tour-back]')?.addEventListener('click', () => showStep(stepIndex - 1));
    root.querySelector('[data-fc-tour-next]')?.addEventListener('click', () => {
      if (stepIndex >= steps.length - 1) finish('completed');
      else showStep(stepIndex + 1);
    });
    root.querySelector('[data-fc-tour-blocker]')?.addEventListener('click', () => finish('dismissed'));
    return root;
  }

  function stageRectForTarget(targetRect) {
    const left = clamp(targetRect.left - STAGE_PAD, 6, window.innerWidth - 12);
    const top = clamp(targetRect.top - STAGE_PAD, 6, window.innerHeight - 12);
    const right = clamp(targetRect.right + STAGE_PAD, 12, window.innerWidth - 6);
    const bottom = clamp(targetRect.bottom + STAGE_PAD, 12, window.innerHeight - 6);
    return { left, top, width: Math.max(2, right - left), height: Math.max(2, bottom - top) };
  }

  function candidatePosition(placement, targetRect, width, height) {
    switch (placement) {
      case 'right': return { left: targetRect.right + CARD_GAP, top: targetRect.top + (targetRect.height - height) / 2 };
      case 'left': return { left: targetRect.left - CARD_GAP - width, top: targetRect.top + (targetRect.height - height) / 2 };
      case 'top': return { left: targetRect.left + (targetRect.width - width) / 2, top: targetRect.top - CARD_GAP - height };
      case 'top-end': return { left: targetRect.right - width, top: targetRect.top - CARD_GAP - height };
      case 'bottom-end': return { left: targetRect.right - width, top: targetRect.bottom + CARD_GAP };
      case 'bottom-start': return { left: targetRect.left, top: targetRect.bottom + CARD_GAP };
      case 'bottom':
      default: return { left: targetRect.left + (targetRect.width - width) / 2, top: targetRect.bottom + CARD_GAP };
    }
  }

  function placementOrder(preferred) {
    const fallbacks = {
      right: ['right', 'bottom-start', 'top', 'left'],
      left: ['left', 'bottom-start', 'top', 'right'],
      top: ['top', 'bottom', 'right', 'left'],
      'top-end': ['top-end', 'bottom-end', 'left', 'right'],
      'bottom-end': ['bottom-end', 'top-end', 'left', 'right'],
      'bottom-start': ['bottom-start', 'top', 'right', 'left'],
      bottom: ['bottom', 'top', 'right', 'left']
    };
    return fallbacks[preferred] || fallbacks.bottom;
  }

  function fitsViewport(position, width, height) {
    return position.left >= VIEWPORT_PAD
      && position.top >= VIEWPORT_PAD
      && position.left + width <= window.innerWidth - VIEWPORT_PAD
      && position.top + height <= window.innerHeight - VIEWPORT_PAD;
  }

  function cardPosition(step, targetRect, width, height) {
    if (!targetRect || step.placement === 'center') {
      const workspace = workspaceRect();
      return {
        placement: 'center',
        left: clamp(workspace.left + (workspace.width - width) / 2, VIEWPORT_PAD, window.innerWidth - width - VIEWPORT_PAD),
        top: clamp((window.innerHeight - height) / 2, VIEWPORT_PAD, window.innerHeight - height - VIEWPORT_PAD)
      };
    }

    const order = placementOrder(step.placement);
    for (const placement of order) {
      const position = candidatePosition(placement, targetRect, width, height);
      if (fitsViewport(position, width, height)) return { placement, ...position };
    }

    const fallback = candidatePosition(order[0], targetRect, width, height);
    return {
      placement: order[0],
      left: clamp(fallback.left, VIEWPORT_PAD, window.innerWidth - width - VIEWPORT_PAD),
      top: clamp(fallback.top, VIEWPORT_PAD, window.innerHeight - height - VIEWPORT_PAD)
    };
  }

  function layoutStep() {
    layoutRaf = 0;
    if (!active || !root?.isConnected) return;

    const card = root.querySelector('[data-fc-tour-card]');
    const stage = root.querySelector('[data-fc-tour-stage]');
    const step = steps[stepIndex];
    if (!card || !stage || !step) return;

    let targetRect = null;
    if (currentTarget && isVisibleTarget(currentTarget)) {
      targetRect = currentTarget.getBoundingClientRect();
      const stageRect = stageRectForTarget(targetRect);
      Object.assign(stage.style, {
        left: `${Math.round(stageRect.left)}px`,
        top: `${Math.round(stageRect.top)}px`,
        width: `${Math.round(stageRect.width)}px`,
        height: `${Math.round(stageRect.height)}px`
      });
      stage.dataset.targeted = 'true';
    } else {
      const workspace = workspaceRect();
      Object.assign(stage.style, {
        left: `${Math.round(workspace.left + workspace.width / 2)}px`,
        top: `${Math.round(window.innerHeight / 2)}px`,
        width: '2px',
        height: '2px'
      });
      stage.dataset.targeted = 'false';
    }

    card.style.visibility = 'hidden';
    card.style.left = '0px';
    card.style.top = '0px';
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const position = cardPosition(step, targetRect, width, height);
    card.dataset.placement = position.placement;
    card.style.left = `${Math.round(position.left)}px`;
    card.style.top = `${Math.round(position.top)}px`;
    card.style.visibility = 'visible';
  }

  function scheduleLayout() {
    if (layoutRaf) return;
    layoutRaf = window.requestAnimationFrame(layoutStep);
  }

  function showStep(nextIndex) {
    if (!active || !steps.length) return;
    stepIndex = clamp(nextIndex, 0, steps.length - 1);
    const step = steps[stepIndex];
    currentTarget = step.target || null;

    if (currentTarget && isVisibleTarget(currentTarget)) {
      currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    }

    const tourRoot = ensureRoot();
    const title = tourRoot.querySelector('[data-fc-tour-title]');
    const description = tourRoot.querySelector('[data-fc-tour-description]');
    const progressLabel = tourRoot.querySelector('[data-fc-tour-progress-label]');
    const progressBar = tourRoot.querySelector('[data-fc-tour-progress-bar]');
    const back = tourRoot.querySelector('[data-fc-tour-back]');
    const next = tourRoot.querySelector('[data-fc-tour-next]');
    const card = tourRoot.querySelector('[data-fc-tour-card]');

    title.textContent = step.title;
    description.textContent = step.description;
    progressLabel.textContent = `Step ${stepIndex + 1} of ${steps.length}`;
    progressBar.style.width = `${((stepIndex + 1) / steps.length) * 100}%`;
    back.hidden = stepIndex === 0;
    next.textContent = stepIndex === steps.length - 1 ? 'Done' : 'Next';
    tourRoot.dataset.mode = currentTarget ? 'target' : 'center';
    card.dataset.step = String(stepIndex + 1);

    scheduleLayout();
    window.requestAnimationFrame(() => card.focus({ preventScroll: true }));
  }

  function cleanupRoot() {
    if (layoutRaf) window.cancelAnimationFrame(layoutRaf);
    layoutRaf = 0;
    root?.remove();
    root = null;
    currentTarget = null;
  }

  function restoreTourShell() {
    const restore = restoreShellAfterTour;
    restoreShellAfterTour = null;
    restore?.();
  }

  function finish(status = 'completed') {
    if (!active) return;
    writeState(status);
    active = false;
    cleanupRoot();
    restoreTourShell();
    window.removeEventListener('resize', scheduleLayout);
    window.removeEventListener('scroll', scheduleLayout, true);
    document.removeEventListener('keydown', handleKeydown, true);
    previousFocus?.focus?.({ preventScroll: true });
    previousFocus = null;
    document.dispatchEvent(new CustomEvent('formcraft:product-tour-finished', { detail: { status, version: TOUR_VERSION } }));
  }

  function handleKeydown(event) {
    if (!active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      finish('dismissed');
      return;
    }
    if (event.key === 'ArrowRight' && stepIndex < steps.length - 1) {
      event.preventDefault();
      showStep(stepIndex + 1);
      return;
    }
    if (event.key === 'ArrowLeft' && stepIndex > 0) {
      event.preventDefault();
      showStep(stepIndex - 1);
    }
  }

  function start(options = {}) {
    const force = Boolean(options.force);
    if (active) return;
    if (!force && isSeen()) return;
    if (document.documentElement.dataset.backend !== 'ready' || !document.querySelector('.workspace-shell')) return;

    writeState('started');
    if (typeof modal !== 'undefined' && modal?.open && typeof closeModal === 'function') closeModal();
    if (typeof ui !== 'undefined' && ui?.route !== 'dashboard' && typeof navigate === 'function') navigate('dashboard');
    window.FormcraftFeatures?.enhance?.();
    prepareTourShell();

    window.setTimeout(() => {
      const definitions = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches ? mobileSteps() : desktopSteps();
      steps = resolveSteps(definitions);
      if (steps.length < 3) {
        restoreTourShell();
        return;
      }

      active = true;
      stepIndex = 0;
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      ensureRoot();
      window.addEventListener('resize', scheduleLayout, { passive: true });
      window.addEventListener('scroll', scheduleLayout, true);
      document.addEventListener('keydown', handleKeydown, true);
      showStep(0);
    }, typeof ui !== 'undefined' && ui?.route === 'dashboard' ? 80 : 180);
  }

  function considerAutoStart() {
    if (navigator.webdriver || isSeen() || active) return;
    if (document.documentElement.dataset.backend !== 'ready' || !document.querySelector('.workspace-shell')) return;
    window.clearTimeout(autoStartTimer);
    autoStartTimer = window.setTimeout(() => start(), 550);
  }

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
      if (active) finish('dismissed');
      clearState();
      window.setTimeout(() => start({ force: true }), 80);
    },
    isComplete: isSeen,
    storageKey
  });

  considerAutoStart();
})();
