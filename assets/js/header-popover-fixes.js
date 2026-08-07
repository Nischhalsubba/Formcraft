'use strict';

(() => {
  const GAP = 8;
  const VIEWPORT_MARGIN = 12;
  const FLOATING_Z = 420;
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const openDetails = new Set();
  let scheduled = false;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function currentPopoverEntries() {
    return [
      { type: 'notifications', trigger: $('[data-toggle-notifications]'), popover: $('[data-notifications-popover]') },
      { type: 'account', trigger: $('[data-toggle-account]'), popover: $('[data-account-popover]') }
    ];
  }

  function setFloatingBase(panel, width, maxHeight) {
    Object.assign(panel.style, {
      position: 'fixed',
      inset: 'auto',
      zIndex: String(FLOATING_Z),
      boxSizing: 'border-box',
      width: width ? `${Math.round(width)}px` : '',
      maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
      maxHeight: `${Math.max(120, Math.floor(maxHeight))}px`,
      overflowY: 'auto',
      overscrollBehavior: 'contain'
    });
  }

  function positionFloatingPanel(trigger, panel, options = {}) {
    if (!(trigger instanceof Element) || !(panel instanceof HTMLElement) || panel.hidden) return null;

    const align = options.align === 'start' ? 'start' : 'end';
    const gap = Number.isFinite(options.gap) ? options.gap : GAP;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const triggerRect = trigger.getBoundingClientRect();
    const desiredWidth = clamp(
      options.width || panel.offsetWidth || panel.scrollWidth || 280,
      options.minWidth || 220,
      Math.min(options.maxWidth || 360, viewportWidth - VIEWPORT_MARGIN * 2)
    );

    panel.style.visibility = 'hidden';
    setFloatingBase(panel, desiredWidth, viewportHeight - VIEWPORT_MARGIN * 2);

    const measuredHeight = Math.min(panel.scrollHeight || panel.offsetHeight || 240, viewportHeight - VIEWPORT_MARGIN * 2);
    const roomBelow = viewportHeight - triggerRect.bottom - VIEWPORT_MARGIN - gap;
    const roomAbove = triggerRect.top - VIEWPORT_MARGIN - gap;
    const placeAbove = roomBelow < Math.min(measuredHeight, 220) && roomAbove > roomBelow;

    let left = align === 'start' ? triggerRect.left : triggerRect.right - desiredWidth;
    left = clamp(left, VIEWPORT_MARGIN, viewportWidth - desiredWidth - VIEWPORT_MARGIN);

    const availableHeight = Math.max(120, placeAbove ? roomAbove : roomBelow);
    const renderedHeight = Math.min(measuredHeight, availableHeight);
    let top = placeAbove ? triggerRect.top - gap - renderedHeight : triggerRect.bottom + gap;
    top = clamp(top, VIEWPORT_MARGIN, viewportHeight - renderedHeight - VIEWPORT_MARGIN);

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.maxHeight = `${Math.floor(availableHeight)}px`;
    panel.style.transformOrigin = `${align === 'end' ? 'right' : 'left'} ${placeAbove ? 'bottom' : 'top'}`;
    panel.dataset.floatingPlacement = placeAbove ? 'top' : 'bottom';
    panel.dataset.floatingAlign = align;
    panel.style.visibility = '';

    return { placeAbove, align, left, top, width: desiredWidth, maxHeight: availableHeight };
  }

  function animateOpen(panel) {
    if (reduceMotionQuery.matches || !window.gsap) {
      panel.style.opacity = '1';
      panel.style.transform = 'none';
      return;
    }
    const y = panel.dataset.floatingPlacement === 'top' ? 6 : -6;
    window.gsap.killTweensOf(panel);
    window.gsap.fromTo(panel,
      { autoAlpha: 0, y, scale: 0.985 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.18, ease: 'power2.out', overwrite: 'auto', clearProps: 'opacity,transform,visibility' }
    );
  }

  function animateClose(panel, onComplete) {
    if (reduceMotionQuery.matches || !window.gsap) {
      onComplete?.();
      return;
    }
    const y = panel.dataset.floatingPlacement === 'top' ? 3 : -3;
    window.gsap.killTweensOf(panel);
    window.gsap.to(panel, {
      autoAlpha: 0,
      y,
      scale: 0.99,
      duration: 0.11,
      ease: 'power1.in',
      overwrite: 'auto',
      onComplete
    });
  }

  function openPanel(trigger, panel, options = {}) {
    if (!(trigger instanceof HTMLElement) || !(panel instanceof HTMLElement)) return;
    if (!panel.hidden) {
      positionFloatingPanel(trigger, panel, options);
      return;
    }
    panel.hidden = false;
    panel.classList.add('fc-floating-panel', 'is-open');
    trigger.setAttribute('aria-expanded', 'true');
    positionFloatingPanel(trigger, panel, options);
    animateOpen(panel);
  }

  function closePanel(trigger, panel, options = {}) {
    if (!(panel instanceof HTMLElement) || panel.hidden) return;
    trigger?.setAttribute('aria-expanded', 'false');
    panel.classList.remove('is-open');
    const finish = () => {
      panel.hidden = true;
      panel.style.removeProperty('opacity');
      panel.style.removeProperty('visibility');
      panel.style.removeProperty('transform');
      options.onComplete?.();
    };
    animateClose(panel, finish);
  }

  function closeHeaderPopovers() {
    currentPopoverEntries().forEach(({ trigger, popover }) => {
      if (popover && !popover.hidden) closePanel(trigger, popover);
      else trigger?.setAttribute('aria-expanded', 'false');
    });
  }

  function toggleHeaderPopover(type) {
    const entries = currentPopoverEntries();
    const current = entries.find(entry => entry.type === type);
    if (!current?.trigger || !current?.popover) return;

    entries.forEach(entry => {
      if (entry.type !== type && entry.popover && !entry.popover.hidden) closePanel(entry.trigger, entry.popover);
    });

    if (current.popover.hidden) {
      openPanel(current.trigger, current.popover, {
        align: 'end',
        width: type === 'account' ? 300 : 360,
        minWidth: type === 'account' ? 260 : 300,
        maxWidth: type === 'account' ? 340 : 380
      });
    } else {
      closePanel(current.trigger, current.popover);
    }
  }

  function detailsParts(details) {
    if (!(details instanceof HTMLDetailsElement)) return {};
    return {
      summary: details.querySelector(':scope > summary'),
      panel: details.querySelector(':scope > .menu-popover, :scope > .popover-menu')
    };
  }

  function positionDetails(details) {
    const { summary, panel } = detailsParts(details);
    if (!summary || !panel || !details.open) return;
    panel.hidden = false;
    panel.classList.add('fc-floating-panel', 'is-open');
    positionFloatingPanel(summary, panel, { align: 'end', minWidth: 180, maxWidth: 280 });
  }

  function openDetailsMenu(details) {
    const { summary, panel } = detailsParts(details);
    if (!summary || !panel) {
      details.open = true;
      return;
    }
    [...openDetails].forEach(other => {
      if (other !== details) closeDetailsMenu(other);
    });
    details.open = true;
    openDetails.add(details);
    summary.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    positionDetails(details);
    animateOpen(panel);
  }

  function closeDetailsMenu(details, restoreFocus = false) {
    const { summary, panel } = detailsParts(details);
    if (!details.open) return;
    summary?.setAttribute('aria-expanded', 'false');
    if (!panel) {
      details.open = false;
      openDetails.delete(details);
      return;
    }
    panel.classList.remove('is-open');
    animateClose(panel, () => {
      panel.hidden = true;
      details.open = false;
      openDetails.delete(details);
      if (restoreFocus) summary?.focus?.();
    });
  }

  function alignOpenFloatingUI() {
    currentPopoverEntries().forEach(({ type, trigger, popover }) => {
      if (trigger && popover && !popover.hidden) {
        positionFloatingPanel(trigger, popover, {
          align: 'end',
          width: type === 'account' ? 300 : 360,
          minWidth: type === 'account' ? 260 : 300,
          maxWidth: type === 'account' ? 340 : 380
        });
      }
    });
    [...openDetails].forEach(details => details.isConnected ? positionDetails(details) : openDetails.delete(details));
    document.querySelectorAll('.fc-context-select-popover.is-open').forEach(panel => {
      const triggerId = panel.dataset.floatingTriggerId;
      const trigger = triggerId ? document.getElementById(triggerId) : null;
      if (trigger) positionFloatingPanel(trigger, panel, { align: 'start', width: Math.max(220, trigger.getBoundingClientRect().width), maxWidth: 360 });
    });
  }

  function scheduleAlign() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      alignOpenFloatingUI();
    });
  }

  function removeStaleBodyPopovers(currentAccount, currentNotifications) {
    document.querySelectorAll('body > [data-account-popover], body > [data-notifications-popover]').forEach(popover => {
      if (popover !== currentAccount && popover !== currentNotifications) popover.remove();
    });
  }

  function mountHeaderPopovers() {
    const notifications = $('[data-notifications-popover]', app) || $('[data-notifications-popover]');
    const account = $('[data-account-popover]', app) || $('[data-account-popover]');
    const notificationTrigger = $('[data-toggle-notifications]');
    const accountTrigger = $('[data-toggle-account]');

    removeStaleBodyPopovers(account, notifications);

    [notifications, account].forEach(popover => {
      if (!popover) return;
      popover.classList.add('fc-floating-panel');
      if (popover.parentElement !== document.body) document.body.append(popover);
    });
    account?.classList.add('sidebar-account-popover');

    notificationTrigger?.setAttribute('aria-haspopup', 'dialog');
    accountTrigger?.setAttribute('aria-haspopup', 'menu');
  }

  const previousBindShell = bindShell;
  bindShell = function bindShellWithUnifiedFloatingUI() {
    previousBindShell();
    mountHeaderPopovers();
  };

  // Existing click handlers resolve this binding at click time, so the unified engine becomes canonical.
  togglePopover = function toggleUnifiedPopover(type) {
    toggleHeaderPopover(type);
  };

  document.addEventListener('click', event => {
    const summary = event.target.closest?.('details.menu > summary, details.more-menu > summary, details.erp-row-menu > summary');
    if (summary) {
      const details = summary.closest('details');
      if (detailsParts(details).panel) {
        event.preventDefault();
        if (details.open) closeDetailsMenu(details, true);
        else openDetailsMenu(details);
      }
      return;
    }

    const menuAction = event.target.closest?.('details.menu .menu-popover button, details.more-menu .popover-menu button, details.more-menu .popover-menu a, details.erp-row-menu .menu-popover button');
    if (menuAction) {
      const details = menuAction.closest('details');
      if (details) closeDetailsMenu(details);
    }
  }, true);

  document.addEventListener('pointerdown', event => {
    const insideHeaderPopover = currentPopoverEntries().some(({ trigger, popover }) =>
      trigger?.contains(event.target) || popover?.contains(event.target)
    );
    if (!insideHeaderPopover) closeHeaderPopovers();

    [...openDetails].forEach(details => {
      if (!details.contains(event.target)) closeDetailsMenu(details);
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const activeHeader = currentPopoverEntries().find(({ popover }) => popover && !popover.hidden);
    if (activeHeader) {
      event.preventDefault();
      closePanel(activeHeader.trigger, activeHeader.popover, { onComplete: () => activeHeader.trigger?.focus?.() });
      return;
    }
    const latestDetails = [...openDetails].at(-1);
    if (latestDetails) {
      event.preventDefault();
      closeDetailsMenu(latestDetails, true);
    }
  });

  window.addEventListener('resize', scheduleAlign, { passive: true });
  window.addEventListener('scroll', scheduleAlign, true);
  reduceMotionQuery.addEventListener?.('change', scheduleAlign);

  const shellObserver = new MutationObserver(() => {
    if ($('[data-toggle-account]')) return;
    document.querySelectorAll('body > [data-account-popover], body > [data-notifications-popover]').forEach(popover => popover.remove());
  });
  shellObserver.observe(app, { childList: true, subtree: true });

  window.FormcraftFloatingUI = Object.freeze({
    position: positionFloatingPanel,
    open: openPanel,
    close: closePanel,
    refresh: scheduleAlign
  });

  renderShell();
})();
