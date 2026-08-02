'use strict';

(() => {
  const motion = window.gsap;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canAnimate = () => Boolean(motion) && !reducedMotion.matches;
  const durations = { quick: 0.16, base: 0.24, panel: 0.36 };

  document.documentElement.classList.add('motion-enhanced');

  if (!motion) {
    document.documentElement.classList.add('motion-fallback');
    window.FormcraftMotion = { available: false, reduced: reducedMotion.matches };
    return;
  }

  motion.defaults({ overwrite: 'auto' });

  const baseRenderShell = renderShell;
  const baseOpenModal = openModal;
  const baseCloseModal = closeModal;
  const baseTogglePopover = togglePopover;
  const baseToast = toast;

  let renderedRoute = ui.route;
  let modalCloseTween = null;
  let drawerCloseTween = null;
  let shellAnimated = false;
  const animatedPopovers = new WeakSet();
  const animatedToasts = new WeakSet();

  function clearMotion(target) {
    if (!target) return;
    motion.set(target, { clearProps: 'transform,opacity,visibility,scale' });
  }

  function animateInitialShell() {
    const shell = document.querySelector('.workspace-shell');
    if (!shell || shellAnimated || !canAnimate()) return;
    shellAnimated = true;

    const sidebar = shell.querySelector('.workspace-sidebar');
    const topbar = shell.querySelector('.workspace-topbar');
    const main = shell.querySelector('#main-content');
    const pageHeader = shell.querySelector('.workspace-page-header');

    if (sidebar) {
      motion.fromTo(sidebar, { x: -18, autoAlpha: 0 }, {
        x: 0,
        autoAlpha: 1,
        duration: durations.panel,
        ease: 'power3.out',
        clearProps: 'transform,opacity,visibility'
      });
    }

    if (topbar) {
      motion.fromTo(topbar, { y: -10, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        duration: durations.base,
        ease: 'power2.out',
        clearProps: 'transform,opacity,visibility'
      });
    }

    const reveal = [pageHeader, main?.firstElementChild].filter(Boolean);
    if (reveal.length) {
      motion.fromTo(reveal, { y: 10, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        duration: durations.panel,
        stagger: 0.06,
        delay: 0.05,
        ease: 'power2.out',
        clearProps: 'transform,opacity,visibility'
      });
    }
  }

  function animateRouteEntry() {
    if (!canAnimate()) return;
    const header = document.querySelector('.workspace-page-header');
    const page = document.querySelector('#main-content > *');
    const targets = [header, page].filter(Boolean);
    if (!targets.length) return;

    motion.fromTo(targets, { y: 12, autoAlpha: 0 }, {
      y: 0,
      autoAlpha: 1,
      duration: durations.base,
      stagger: 0.045,
      ease: 'power2.out',
      clearProps: 'transform,opacity,visibility'
    });
  }

  renderShell = function renderShellWithMotion(...args) {
    const nextRoute = ui.route;
    const routeChanged = nextRoute !== renderedRoute;
    const result = baseRenderShell.apply(this, args);
    renderedRoute = nextRoute;

    requestAnimationFrame(() => {
      animateInitialShell();
      if (routeChanged) animateRouteEntry();
    });

    return result;
  };

  function modalType() {
    if (modal.querySelector('.form-modal')) return 'sheet';
    if (modal.querySelector('.full-detail-view')) return 'detail';
    return 'dialog';
  }

  function resetModalMotion() {
    motion.killTweensOf(modal);
    clearMotion(modal);
    modal.removeAttribute('data-motion-closing');
  }

  function animateModalIn() {
    if (!modal.open || !canAnimate()) return;
    resetModalMotion();
    const type = modalType();

    if (type === 'sheet') {
      motion.fromTo(modal, { xPercent: 100, autoAlpha: 1 }, {
        xPercent: 0,
        autoAlpha: 1,
        duration: durations.panel,
        ease: 'power3.out',
        clearProps: 'transform,opacity,visibility'
      });
    } else {
      motion.fromTo(modal, {
        y: type === 'detail' ? 10 : 14,
        scale: type === 'detail' ? 0.992 : 0.975,
        autoAlpha: 0
      }, {
        y: 0,
        scale: 1,
        autoAlpha: 1,
        duration: type === 'detail' ? 0.3 : durations.base,
        ease: 'power3.out',
        clearProps: 'transform,opacity,visibility,scale'
      });
    }

    const content = modal.querySelectorAll(
      '.modal-head, .bright-form-section, .command-button, .bright-detail-summary, .bright-detail-section, .modal-actions'
    );
    if (content.length) {
      motion.fromTo(content, { y: 8, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        duration: 0.26,
        stagger: 0.035,
        delay: type === 'sheet' ? 0.08 : 0.04,
        ease: 'power2.out',
        clearProps: 'transform,opacity,visibility'
      });
    }
  }

  openModal = function openModalWithMotion(markup) {
    if (modalCloseTween) {
      modalCloseTween.kill();
      modalCloseTween = null;
      if (modal.open) baseCloseModal();
      resetModalMotion();
    } else if (modal.open) {
      baseCloseModal();
      resetModalMotion();
    }

    const result = baseOpenModal(markup);
    requestAnimationFrame(animateModalIn);
    return result;
  };

  closeModal = function closeModalWithMotion() {
    if (!modal.open) {
      baseCloseModal();
      return;
    }
    if (!canAnimate()) {
      resetModalMotion();
      baseCloseModal();
      return;
    }
    if (modalCloseTween) return;

    const type = modalType();
    const exit = type === 'sheet'
      ? { xPercent: 100, autoAlpha: 0 }
      : { y: type === 'detail' ? 8 : 12, scale: type === 'detail' ? 0.992 : 0.98, autoAlpha: 0 };

    modal.setAttribute('data-motion-closing', 'true');
    modalCloseTween = motion.to(modal, {
      ...exit,
      duration: type === 'sheet' ? 0.22 : durations.quick,
      ease: 'power2.in',
      onComplete: () => {
        modalCloseTween = null;
        baseCloseModal();
        resetModalMotion();
      }
    });
  };

  function popoverFor(type) {
    return document.querySelector(type === 'notifications'
      ? '[data-notifications-popover]'
      : '[data-account-popover]');
  }

  function animatePopover(popover) {
    if (!popover || popover.hidden || !canAnimate()) return;
    if (animatedPopovers.has(popover)) return;
    animatedPopovers.add(popover);

    motion.fromTo(popover, { y: -6, scale: 0.985, autoAlpha: 0 }, {
      y: 0,
      scale: 1,
      autoAlpha: 1,
      duration: durations.quick,
      ease: 'power2.out',
      clearProps: 'transform,opacity,visibility,scale',
      onComplete: () => window.setTimeout(() => animatedPopovers.delete(popover), 40)
    });
  }

  togglePopover = function togglePopoverWithMotion(type) {
    const target = popoverFor(type);
    const opening = Boolean(target?.hidden);
    const result = baseTogglePopover.apply(this, arguments);
    if (opening) requestAnimationFrame(() => animatePopover(target));
    return result;
  };

  function animateMenu(menu) {
    if (!menu || !canAnimate()) return;
    motion.fromTo(menu, { y: -5, scale: 0.985, autoAlpha: 0 }, {
      y: 0,
      scale: 1,
      autoAlpha: 1,
      duration: durations.quick,
      ease: 'power2.out',
      clearProps: 'transform,opacity,visibility,scale'
    });
  }

  function animateToastOut(node) {
    if (!node?.isConnected || !canAnimate()) {
      node?.remove();
      return;
    }
    motion.to(node, {
      x: 18,
      autoAlpha: 0,
      duration: durations.quick,
      ease: 'power2.in',
      onComplete: () => node.remove()
    });
  }

  toast = function toastWithMotion(...args) {
    const result = baseToast.apply(this, args);
    const node = toastRegion.lastElementChild;
    if (!node || animatedToasts.has(node) || !canAnimate()) return result;
    animatedToasts.add(node);

    motion.fromTo(node, { x: 22, y: 6, autoAlpha: 0 }, {
      x: 0,
      y: 0,
      autoAlpha: 1,
      duration: durations.base,
      ease: 'power3.out',
      clearProps: 'transform,opacity,visibility'
    });

    node.querySelector('button')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      animateToastOut(node);
    }, { capture: true, once: true });

    window.setTimeout(() => animateToastOut(node), 3900);
    return result;
  };

  function animateDrawerIn() {
    if (!canAnimate() || !document.body.classList.contains('drawer-open')) return;
    const drawer = document.querySelector('.mobile-drawer');
    const backdrop = document.querySelector('.drawer-backdrop');
    if (!drawer) return;

    motion.killTweensOf([drawer, backdrop]);
    motion.fromTo(drawer, { xPercent: -105 }, {
      xPercent: 0,
      duration: 0.3,
      ease: 'power3.out',
      clearProps: 'transform'
    });
    if (backdrop) {
      motion.fromTo(backdrop, { autoAlpha: 0 }, {
        autoAlpha: 1,
        duration: durations.base,
        ease: 'power2.out',
        clearProps: 'opacity,visibility'
      });
    }
  }

  function animateDrawerOut(done) {
    const drawer = document.querySelector('.mobile-drawer');
    const backdrop = document.querySelector('.drawer-backdrop');
    if (!drawer || !canAnimate()) {
      done();
      return;
    }
    if (drawerCloseTween) drawerCloseTween.kill();

    drawerCloseTween = motion.timeline({
      onComplete: () => {
        drawerCloseTween = null;
        done();
        clearMotion(drawer);
        clearMotion(backdrop);
      }
    });
    drawerCloseTween.to(drawer, { xPercent: -105, duration: 0.22, ease: 'power2.in' }, 0);
    if (backdrop) drawerCloseTween.to(backdrop, { autoAlpha: 0, duration: 0.18, ease: 'power1.in' }, 0);
  }

  function animateCalendar(direction = 0) {
    const grid = document.querySelector('.calendar-grid');
    if (!grid || !canAnimate()) return;
    motion.fromTo(grid, { x: direction * 14, autoAlpha: 0 }, {
      x: 0,
      autoAlpha: 1,
      duration: durations.base,
      ease: 'power2.out',
      clearProps: 'transform,opacity,visibility'
    });
  }

  const bodyObserver = new MutationObserver(records => {
    if (records.some(record => record.attributeName === 'class') && document.body.classList.contains('drawer-open')) {
      requestAnimationFrame(animateDrawerIn);
    }
  });
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const popoverObserver = new MutationObserver(records => {
    records.forEach(record => {
      const target = record.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.hidden) animatedPopovers.delete(target);
      else requestAnimationFrame(() => animatePopover(target));
    });
  });

  document.querySelectorAll('[data-notifications-popover], [data-account-popover]').forEach(popover => {
    popoverObserver.observe(popover, { attributes: true, attributeFilter: ['hidden'] });
  });

  const appObserver = new MutationObserver(() => {
    document.querySelectorAll('[data-notifications-popover], [data-account-popover]').forEach(popover => {
      popoverObserver.observe(popover, { attributes: true, attributeFilter: ['hidden'] });
    });
    requestAnimationFrame(animateInitialShell);
  });
  appObserver.observe(app, { childList: true, subtree: true });

  document.addEventListener('toggle', event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open) return;
    requestAnimationFrame(() => animateMenu(details.querySelector('.menu-panel, .popover-menu')));
  }, true);

  document.addEventListener('click', event => {
    const calendarControl = event.target.closest('[data-calendar-prev], [data-calendar-next], [data-calendar-today]');
    if (calendarControl) {
      const direction = calendarControl.matches('[data-calendar-prev]') ? -1 : calendarControl.matches('[data-calendar-next]') ? 1 : 0;
      requestAnimationFrame(() => animateCalendar(direction));
    }
  });

  document.addEventListener('pointerdown', event => {
    const dateButton = event.target.closest('.calendar-date-button');
    if (!dateButton || !canAnimate()) return;
    motion.fromTo(dateButton.closest('.calendar-day'), { scale: 0.995 }, {
      scale: 1,
      duration: durations.quick,
      ease: 'power2.out',
      clearProps: 'transform'
    });
  });

  document.addEventListener('click', event => {
    const closeControl = event.target.closest('[data-close-drawer], [data-drawer-backdrop]');
    if (!closeControl || !document.body.classList.contains('drawer-open') || !canAnimate()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    animateDrawerOut(() => document.body.classList.remove('drawer-open'));
  }, true);

  reducedMotion.addEventListener?.('change', event => {
    if (!event.matches) return;
    motion.globalTimeline.clear();
    document.querySelectorAll('[style]').forEach(node => {
      if (node.style.transform || node.style.opacity || node.style.visibility) clearMotion(node);
    });
  });

  requestAnimationFrame(animateInitialShell);

  window.FormcraftMotion = {
    available: true,
    reduced: reducedMotion.matches,
    animateRoute: animateRouteEntry,
    animateModal: animateModalIn,
    animateCalendar
  };
})();