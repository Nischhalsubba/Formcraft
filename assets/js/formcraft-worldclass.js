'use strict';

(() => {
  const VERSION = 'FORMCRAFT-WORLDCLASS-2026.2';
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealSelector = [
    '.fc3-page-surface > .content-shell > *',
    '.fc3-page-surface > .product-dashboard > *',
    '.fc3-page-surface > .erp-module-surface > *',
    '.fc3-page-surface > .erp-launcher-shell > *',
    '.fc3-page-surface > .ops-shell > *',
    'dialog[open] [data-modal-content] > *'
  ].join(',');

  const selectControllers = new Set();
  let scheduled = false;
  let selectId = 0;

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

  function selectLabel(select) {
    return select.getAttribute('aria-label')
      || select.closest('label')?.querySelector(':scope > span')?.textContent?.trim()
      || select.name
      || 'Choose an option';
  }

  function optionText(select) {
    return select.selectedOptions?.[0]?.textContent?.trim() || 'Select';
  }

  function createSelectController(select) {
    if (!(select instanceof HTMLSelectElement) || select.multiple || Number(select.size) > 1 || select.dataset.fcwEnhanced) return null;
    select.dataset.fcwEnhanced = 'true';
    select.classList.add('fc-native-select-source');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const id = `fc-context-select-${++selectId}`;
    const listboxId = `${id}-listbox`;
    const host = document.createElement('span');
    host.className = 'fc-context-select';
    host.dataset.selectKind = select.matches('[data-erp-company]') ? 'company' : select.matches('[data-erp-branch]') ? 'branch' : 'default';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = id;
    trigger.className = 'fc-context-select-trigger';
    trigger.setAttribute('aria-label', selectLabel(select));
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', listboxId);

    const panel = document.createElement('div');
    panel.id = listboxId;
    panel.className = 'fc-context-select-popover fc-floating-panel';
    panel.setAttribute('role', 'listbox');
    panel.setAttribute('aria-label', selectLabel(select));
    panel.dataset.floatingTriggerId = id;
    panel.hidden = true;

    function sync() {
      trigger.disabled = select.disabled;
      trigger.innerHTML = `<span class="fc-context-select-copy"><small>${selectLabel(select)}</small><strong>${optionText(select)}</strong></span><span class="fc-context-select-chevron" aria-hidden="true">${icon('chevronDown', 14)}</span>`;
      panel.innerHTML = [...select.options].map((option, index) => `
        <button type="button" class="fc-context-select-option" role="option" data-option-index="${index}" aria-selected="${option.selected ? 'true' : 'false'}" ${option.disabled ? 'disabled' : ''}>
          <span>${escapeHtml(option.textContent || '')}</span>${option.selected ? `<span class="fc-context-select-check" aria-hidden="true">${icon('check', 14)}</span>` : ''}
        </button>`).join('');
    }

    function position() {
      const api = window.FormcraftFloatingUI;
      if (api?.position) {
        api.position(trigger, panel, {
          align: 'start',
          width: Math.max(220, trigger.getBoundingClientRect().width),
          minWidth: 220,
          maxWidth: 360
        });
      }
    }

    function open() {
      if (trigger.disabled || !panel.hidden) return;
      closeAllCustomSelects(host);
      sync();
      const api = window.FormcraftFloatingUI;
      trigger.setAttribute('aria-expanded', 'true');
      panel.classList.add('is-open');
      if (api?.open) api.open(trigger, panel, { align: 'start', width: Math.max(220, trigger.getBoundingClientRect().width), minWidth: 220, maxWidth: 360 });
      else {
        panel.hidden = false;
        position();
      }
      requestAnimationFrame(() => panel.querySelector('[aria-selected="true"]:not(:disabled), [role="option"]:not(:disabled)')?.focus());
    }

    function close({ restoreFocus = false } = {}) {
      if (panel.hidden) return;
      trigger.setAttribute('aria-expanded', 'false');
      panel.classList.remove('is-open');
      const done = () => { if (restoreFocus) trigger.focus(); };
      const api = window.FormcraftFloatingUI;
      if (api?.close) api.close(trigger, panel, { onComplete: done });
      else {
        panel.hidden = true;
        done();
      }
    }

    function choose(index) {
      const option = select.options[index];
      if (!option || option.disabled) return;
      select.value = option.value;
      sync();
      close({ restoreFocus: true });
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function moveFocus(delta) {
      const options = [...panel.querySelectorAll('[role="option"]:not(:disabled)')];
      if (!options.length) return;
      const current = options.indexOf(document.activeElement);
      options[(current + delta + options.length) % options.length]?.focus();
    }

    trigger.addEventListener('click', () => panel.hidden ? open() : close({ restoreFocus: true }));
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key) && panel.hidden) {
        event.preventDefault();
        open();
      } else if (event.key === 'Escape' && !panel.hidden) {
        event.preventDefault();
        close({ restoreFocus: true });
      }
    });

    panel.addEventListener('click', event => {
      const option = event.target.closest('[data-option-index]');
      if (option) choose(Number(option.dataset.optionIndex));
    });
    panel.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveFocus(event.key === 'ArrowDown' ? 1 : -1);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const options = [...panel.querySelectorAll('[role="option"]:not(:disabled)')];
        options[event.key === 'Home' ? 0 : options.length - 1]?.focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        const option = event.target.closest('[data-option-index]');
        if (option) {
          event.preventDefault();
          choose(Number(option.dataset.optionIndex));
        }
      } else if (event.key === 'Escape' || event.key === 'Tab') {
        if (event.key === 'Escape') event.preventDefault();
        close({ restoreFocus: event.key === 'Escape' });
      }
    });

    select.addEventListener('change', sync);
    select.insertAdjacentElement('afterend', host);
    host.append(trigger);
    document.body.append(panel);
    sync();

    const controller = { select, host, trigger, panel, open, close, sync, position };
    host.__fcSelectController = controller;
    selectControllers.add(controller);
    return controller;
  }

  function closeAllCustomSelects(exceptHost = null) {
    selectControllers.forEach(controller => {
      if (controller.host !== exceptHost && !controller.panel.hidden) controller.close();
    });
  }

  function enhanceSelects() {
    document.querySelectorAll('select:not([multiple])').forEach(createSelectController);
    selectControllers.forEach(controller => {
      if (!controller.select.isConnected || !controller.host.isConnected) {
        controller.panel.remove();
        selectControllers.delete(controller);
      }
    });
  }

  function decorate() {
    scheduled = false;
    document.body.classList.add('fc-worldclass');
    document.documentElement.dataset.formcraftVisualSystem = VERSION;
    updateThemeColor();
    decorateAuth();
    enhanceSelects();
    revealPage();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(decorate);
  }

  document.addEventListener('pointerdown', event => {
    selectControllers.forEach(controller => {
      if (!controller.host.contains(event.target) && !controller.panel.contains(event.target)) controller.close();
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeAllCustomSelects();
  });

  const appRoot = document.querySelector('#app') || document.body;
  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length)) schedule();
  });
  observer.observe(appRoot, { childList: true, subtree: true });

  const themeObserver = new MutationObserver(schedule);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-backend'] });

  window.addEventListener('hashchange', schedule, { passive: true });
  window.addEventListener('resize', () => selectControllers.forEach(controller => !controller.panel.hidden && controller.position()), { passive: true });
  window.addEventListener('scroll', () => selectControllers.forEach(controller => !controller.panel.hidden && controller.position()), true);
  document.addEventListener('formcraft:workspace-ready', schedule);
  reduceMotionQuery.addEventListener?.('change', schedule);

  schedule();

  window.FormcraftWorldclass = Object.freeze({
    version: VERSION,
    refresh: schedule,
    audit() {
      const focusable = document.querySelectorAll('button, a[href], input, textarea, [tabindex]:not([tabindex="-1"])').length;
      const worldclassLoaded = document.body.classList.contains('fc-worldclass');
      return {
        status: worldclassLoaded ? 'ready-to-test' : 'blocked',
        version: VERSION,
        focusable,
        authStory: Boolean(document.querySelector('.fc-auth-story')),
        enhancedSelects: document.querySelectorAll('.fc-context-select').length,
        openFloatingPanels: document.querySelectorAll('.fc-floating-panel:not([hidden])').length,
        reducedMotion: reduceMotionQuery.matches,
        gsapAvailable: Boolean(window.gsap)
      };
    }
  });
})();
