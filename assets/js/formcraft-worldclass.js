'use strict';

(() => {
  const VERSION = 'FORMCRAFT-WORLDCLASS-2026.1';
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealSelector = [
    '.fc3-page-surface > .content-shell > *',
    '.fc3-page-surface > .product-dashboard > *',
    '.fc3-page-surface > .erp-module-surface > *',
    '.fc3-page-surface > .erp-launcher-shell > *',
    '.fc3-page-surface > .ops-shell > *',
    'dialog[open] [data-modal-content] > *'
  ].join(',');
  const spotlightSelector = '.product-panel, .erp-app-card, .command-button, .project-card, .task-card, .backend-card';

  let scheduled = false;
  let pointerFrame = 0;
  let pointerTarget = null;
  let pointerX = 0;
  let pointerY = 0;

  function updateThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', document.documentElement.dataset.theme === 'dark' ? '#0b100f' : '#f2f4f1');
  }

  function decorateAuth() {
    const gate = document.querySelector('.backend-gate');
    if (!gate || gate.querySelector('.fc-auth-story')) return;

    const story = document.createElement('aside');
    story.className = 'fc-auth-story';
    story.setAttribute('aria-label', 'About Formcraft');
    story.innerHTML = `
      <span class="fc-auth-story-badge">Nepal-first business workspace</span>
      <h2>Work, money, people. One operating layer.</h2>
      <p>Formcraft keeps projects, customers, finance, operations, and teams in one connected workspace, with Nepal-ready business foundations built into the system.</p>
      <ul class="fc-auth-story-list" aria-label="Product foundations">
        <li>Connected records</li>
        <li>NPR &amp; Nepal fiscal context</li>
        <li>Projects to invoicing</li>
        <li>Realtime workspace</li>
      </ul>`;

    const card = gate.querySelector('.backend-card');
    if (card) gate.insertBefore(story, card);
    else gate.prepend(story);
  }

  function eligibleRevealNodes() {
    return [...document.querySelectorAll(revealSelector)]
      .filter(node => node instanceof HTMLElement)
      .filter(node => !node.dataset.fcwAnimated)
      .filter(node => node.offsetParent !== null)
      .slice(0, 10);
  }

  function revealPage() {
    const nodes = eligibleRevealNodes();
    if (!nodes.length) return;

    nodes.forEach(node => {
      node.dataset.fcwAnimated = 'true';
      node.dataset.fcwReveal = 'true';
    });

    if (reduceMotionQuery.matches || !window.gsap) {
      nodes.forEach(node => node.classList.add('fcw-reveal-complete'));
      return;
    }

    window.gsap.fromTo(nodes,
      { autoAlpha: 0, y: 12 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.42,
        stagger: 0.035,
        ease: 'power3.out',
        overwrite: 'auto',
        clearProps: 'opacity,transform,visibility',
        onComplete: () => nodes.forEach(node => node.classList.add('fcw-reveal-complete'))
      }
    );
  }

  function decorate() {
    scheduled = false;
    document.body.classList.add('fc-worldclass');
    document.documentElement.dataset.formcraftVisualSystem = VERSION;
    updateThemeColor();
    decorateAuth();
    revealPage();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(decorate);
  }

  function updatePointerSpotlight() {
    pointerFrame = 0;
    const target = pointerTarget;
    if (!target || !target.isConnected) return;
    const rect = target.getBoundingClientRect();
    target.style.setProperty('--fcw-pointer-x', `${Math.max(0, Math.min(rect.width, pointerX - rect.left))}px`);
    target.style.setProperty('--fcw-pointer-y', `${Math.max(0, Math.min(rect.height, pointerY - rect.top))}px`);
  }

  function bindPointerPolish() {
    document.addEventListener('pointerover', event => {
      if (reduceMotionQuery.matches) return;
      const target = event.target.closest?.(spotlightSelector);
      if (!(target instanceof HTMLElement)) return;
      pointerTarget = target;
    }, { passive: true });

    document.addEventListener('pointermove', event => {
      if (!pointerTarget || reduceMotionQuery.matches) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(updatePointerSpotlight);
    }, { passive: true });

    document.addEventListener('pointerout', event => {
      if (!pointerTarget) return;
      const related = event.relatedTarget;
      if (related instanceof Node && pointerTarget.contains(related)) return;
      pointerTarget = null;
    }, { passive: true });
  }

  const app = document.querySelector('#app') || document.body;
  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length)) schedule();
  });
  observer.observe(app, { childList: true, subtree: true });

  const themeObserver = new MutationObserver(schedule);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-backend'] });

  window.addEventListener('hashchange', schedule, { passive: true });
  document.addEventListener('formcraft:workspace-ready', schedule);
  reduceMotionQuery.addEventListener?.('change', schedule);

  bindPointerPolish();
  schedule();

  window.FormcraftWorldclass = Object.freeze({
    version: VERSION,
    refresh: schedule,
    audit() {
      const focusable = document.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])').length;
      const worldclassLoaded = document.body.classList.contains('fc-worldclass');
      const authStory = Boolean(document.querySelector('.fc-auth-story'));
      return {
        status: worldclassLoaded ? 'ready-to-test' : 'blocked',
        version: VERSION,
        focusable,
        authStory,
        reducedMotion: reduceMotionQuery.matches,
        gsapAvailable: Boolean(window.gsap)
      };
    }
  });
})();
