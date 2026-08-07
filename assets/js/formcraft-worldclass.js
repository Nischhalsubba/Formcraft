'use strict';

(() => {
  const VERSION = 'FORMCRAFT-WORLDCLASS-2026.2';
  const FORM_WORKFLOW_VERSION = 'FORMCRAFT-FORM-WORKFLOW-1.0';
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const constrainedMotionQuery = window.matchMedia('(max-width: 820px), (pointer: coarse)');
  const saveData = Boolean(navigator.connection?.saveData);
  const lowMemory = Number(navigator.deviceMemory || 8) <= 4;
  const revealSelector = [
    '.fc3-page-surface > .content-shell > *',
    '.fc3-page-surface > .product-dashboard > *',
    '.fc3-page-surface > .erp-module-surface > *',
    '.fc3-page-surface > .erp-launcher-shell > *',
    '.fc3-page-surface > .ops-shell > *',
    'dialog[open] [data-modal-content] > *'
  ].join(',');

  const selectControllers = new Set();
  let openSelectController = null;
  let floatingRepositionFrame = 0;
  let scheduled = false;
  let selectId = 0;

  const decorativeMotionAllowed = () => !reduceMotionQuery.matches
    && !constrainedMotionQuery.matches
    && !saveData
    && !lowMemory;

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

    if (!decorativeMotionAllowed() || !window.gsap) {
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

  function workflowReadyForSelect(select) {
    const erpForm = select.closest('form[data-erp-form]');
    return !erpForm || erpForm.dataset.workflowEnhanced === FORM_WORKFLOW_VERSION;
  }

  function createSelectController(select) {
    if (!(select instanceof HTMLSelectElement) || select.multiple || Number(select.size) > 1 || select.dataset.fcwEnhanced) return null;
    if (!workflowReadyForSelect(select)) return null;

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
      openSelectController = controller;
      requestAnimationFrame(() => panel.querySelector('[aria-selected="true"]:not(:disabled), [role="option"]:not(:disabled)')?.focus());
    }

    function close({ restoreFocus = false } = {}) {
      if (panel.hidden) return;
      if (openSelectController === controller) openSelectController = null;
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
    if (openSelectController && openSelectController.host !== exceptHost) openSelectController.close();
  }

  function cleanupSelectControllers() {
    selectControllers.forEach(controller => {
      if (!controller.select.isConnected || !controller.host.isConnected) {
        if (openSelectController === controller) openSelectController = null;
        controller.panel.remove();
        selectControllers.delete(controller);
      }
    });
  }

  function enhanceSelects(root = document) {
    const candidates = [];
    if (root instanceof HTMLSelectElement && !root.multiple) candidates.push(root);
    root.querySelectorAll?.('select:not([multiple])').forEach(select => candidates.push(select));
    candidates.forEach(createSelectController);
    cleanupSelectControllers();
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

  function scheduleFloatingReposition() {
    if (!openSelectController || floatingRepositionFrame) return;
    floatingRepositionFrame = requestAnimationFrame(() => {
      floatingRepositionFrame = 0;
      if (openSelectController && !openSelectController.panel.hidden) openSelectController.position();
    });
  }

  document.addEventListener('pointerdown', event => {
    const controller = openSelectController;
    if (!controller) return;
    if (!controller.host.contains(event.target) && !controller.panel.contains(event.target)) controller.close();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeAllCustomSelects();
  });

  const appRoot = document.querySelector('#app') || document.body;
  const observer = new MutationObserver(mutations => {
    const selectRoots = new Set();
    let presentationChanged = false;
    let cleanupNeeded = false;

    mutations.forEach(mutation => {
      if (mutation.removedNodes.length) cleanupNeeded = true;
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node instanceof HTMLSelectElement || node.querySelector('select:not([multiple])')) selectRoots.add(node);
        if (
          node.matches('.workspace-shell, .backend-gate, .fc3-page-surface, [data-modal-content]')
          || node.querySelector('.workspace-shell, .backend-gate, .fc3-page-surface, [data-modal-content]')
        ) presentationChanged = true;
      });
    });

    if (selectRoots.size) requestAnimationFrame(() => selectRoots.forEach(enhanceSelects));
    if (cleanupNeeded) requestAnimationFrame(cleanupSelectControllers);
    if (presentationChanged) schedule();
  });
  observer.observe(appRoot, { childList: true, subtree: true });

  const modalRoot = document.querySelector('[data-modal]');
  const modalObserver = modalRoot ? new MutationObserver(mutations => {
    const workflowReady = mutations.some(mutation =>
      mutation.type === 'attributes'
      && mutation.attributeName === 'data-workflow-enhanced'
      && mutation.target instanceof HTMLFormElement
      && mutation.target.dataset.workflowEnhanced === FORM_WORKFLOW_VERSION
    );
    const modalOpened = mutations.some(mutation => mutation.type === 'attributes' && mutation.attributeName === 'open');
    if (workflowReady || modalOpened) requestAnimationFrame(schedule);
  }) : null;
  modalObserver?.observe(modalRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-workflow-enhanced', 'open'] });

  const themeObserver = new MutationObserver(schedule);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-backend'] });

  window.addEventListener('hashchange', schedule, { passive: true });
  window.addEventListener('resize', scheduleFloatingReposition, { passive: true });
  window.addEventListener('scroll', scheduleFloatingReposition, true);
  document.addEventListener('formcraft:workspace-ready', schedule);
  reduceMotionQuery.addEventListener?.('change', schedule);
  constrainedMotionQuery.addEventListener?.('change', schedule);

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
        performanceReduced: constrainedMotionQuery.matches || saveData || lowMemory,
        gsapAvailable: Boolean(window.gsap)
      };
    }
  });
})();
