'use strict';

(() => {
  const gsap = window.gsap;
  if (!gsap) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compact = window.matchMedia('(max-width: 900px), (pointer: coarse)');
  const saveData = Boolean(navigator.connection?.saveData);
  const lowMemory = Number(navigator.deviceMemory || 8) <= 4;
  const lowPower = saveData || lowMemory;

  const timing = Object.freeze({
    press: 0.10,
    micro: 0.16,
    standard: 0.24,
    reveal: 0.32,
    macro: 0.38
  });

  const selectors = Object.freeze({
    card: [
      '.metric-card',
      '.panel',
      '.product-panel',
      '.erp-card',
      '.project-card',
      '.task-card',
      '.member-card',
      '.file-card',
      '.invoice-card',
      '.hrms-card',
      '.hrms-device-card'
    ].join(','),
    pressable: [
      '.button',
      '.workspace-create-button',
      '.workspace-nav-link',
      '.utility-button',
      '.icon-button',
      '.action-button',
      '.menu-button',
      '.command-button',
      '.filter-chip',
      '.hrms-tabs button'
    ].join(',')
  });

  const revealed = new WeakSet();
  const activePress = new WeakMap();
  let scheduled = false;

  function motionAllowed() {
    return !reduced.matches;
  }

  function visible(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.hidden) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function clear(target) {
    if (!target) return;
    gsap.set(target, { clearProps: 'transform,opacity,visibility,willChange' });
  }

  function revealCards(root = document) {
    if (!motionAllowed()) return;
    const cards = Array.from(root.querySelectorAll?.(selectors.card) || [])
      .filter(card => visible(card) && !revealed.has(card))
      .slice(0, compact.matches ? 6 : 10);

    if (!cards.length) return;
    cards.forEach(card => {
      revealed.add(card);
      card.dataset.fcMotionCard = 'true';
    });

    gsap.fromTo(cards,
      {
        y: compact.matches ? 7 : 11,
        autoAlpha: 0,
        scale: compact.matches ? 1 : 0.995,
        willChange: 'transform,opacity'
      },
      {
        y: 0,
        autoAlpha: 1,
        scale: 1,
        duration: lowPower ? timing.standard : timing.reveal,
        stagger: lowPower ? 0 : 0.035,
        ease: 'power3.out',
        overwrite: 'auto',
        onComplete: () => cards.forEach(clear)
      }
    );
  }

  function revealTabPanel() {
    if (!motionAllowed()) return;
    const panel = Array.from(document.querySelectorAll('.hrms-tab-panel'))
      .find(node => visible(node));
    if (!panel) return;

    gsap.killTweensOf(panel);
    gsap.fromTo(panel,
      { y: compact.matches ? 4 : 7, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: timing.standard,
        ease: 'power2.out',
        overwrite: 'auto',
        onComplete: () => clear(panel)
      }
    );
    revealCards(panel);
  }

  function animateFocus(target, focused) {
    if (!motionAllowed() || !(target instanceof HTMLElement)) return;
    gsap.to(target, {
      scale: focused ? 1.004 : 1,
      duration: timing.micro,
      ease: focused ? 'power2.out' : 'power2.inOut',
      overwrite: 'auto',
      clearProps: focused ? undefined : 'transform'
    });
  }

  function pressIn(target) {
    if (!motionAllowed() || !(target instanceof HTMLElement) || target.matches(':disabled')) return;
    const previous = activePress.get(target);
    previous?.kill?.();
    activePress.set(target, gsap.to(target, {
      scale: target.matches('.workspace-nav-link') ? 0.992 : 0.982,
      duration: timing.press,
      ease: 'power2.out',
      overwrite: 'auto'
    }));
  }

  function pressOut(target) {
    if (!motionAllowed() || !(target instanceof HTMLElement)) return;
    const previous = activePress.get(target);
    previous?.kill?.();
    activePress.set(target, gsap.to(target, {
      scale: 1,
      duration: timing.micro,
      ease: 'power3.out',
      overwrite: 'auto',
      clearProps: 'transform'
    }));
  }

  function hoverCard(target, entering) {
    if (!motionAllowed() || compact.matches || lowPower || !(target instanceof HTMLElement)) return;
    gsap.to(target, {
      y: entering ? -2 : 0,
      duration: entering ? timing.standard : timing.micro,
      ease: entering ? 'power3.out' : 'power2.inOut',
      overwrite: 'auto',
      clearProps: entering ? undefined : 'transform'
    });
  }

  function scheduleReveal(root = document) {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      revealCards(root);
    });
  }

  document.addEventListener('pointerdown', event => {
    const target = event.target.closest?.(selectors.pressable);
    if (target) pressIn(target);
  }, { passive: true });

  document.addEventListener('pointerup', event => {
    const target = event.target.closest?.(selectors.pressable);
    if (target) pressOut(target);
  }, { passive: true });

  document.addEventListener('pointercancel', event => {
    const target = event.target.closest?.(selectors.pressable);
    if (target) pressOut(target);
  }, { passive: true });

  document.addEventListener('pointerover', event => {
    const card = event.target.closest?.(selectors.card);
    if (card && !card.contains(event.relatedTarget)) hoverCard(card, true);
  }, { passive: true });

  document.addEventListener('pointerout', event => {
    const card = event.target.closest?.(selectors.card);
    if (card && !card.contains(event.relatedTarget)) hoverCard(card, false);
  }, { passive: true });

  document.addEventListener('focusin', event => {
    const field = event.target.closest?.('input, select, textarea, .workspace-search-trigger');
    if (field) animateFocus(field, true);
  });

  document.addEventListener('focusout', event => {
    const field = event.target.closest?.('input, select, textarea, .workspace-search-trigger');
    if (field) animateFocus(field, false);
  });

  document.addEventListener('click', event => {
    if (!event.target.closest?.('.hrms-tabs button')) return;
    requestAnimationFrame(revealTabPanel);
  });

  const app = document.querySelector('#app') || document.body;
  const observer = new MutationObserver(mutations => {
    const relevant = mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length);
    if (relevant) scheduleReveal(app);
  });
  observer.observe(app, { childList: true, subtree: true });

  const onReduceChange = () => {
    if (reduced.matches) {
      gsap.killTweensOf(selectors.card);
      gsap.killTweensOf(selectors.pressable);
      document.querySelectorAll('[data-fc-motion-card]').forEach(clear);
    } else {
      scheduleReveal(app);
    }
  };

  reduced.addEventListener?.('change', onReduceChange);
  scheduleReveal(app);

  window.addEventListener('pagehide', () => {
    observer.disconnect();
    reduced.removeEventListener?.('change', onReduceChange);
  }, { once: true });

  window.FormcraftDesignMotion = {
    version: '2026.08',
    timing,
    reduced: () => reduced.matches,
    refresh: () => scheduleReveal(app)
  };
})();
