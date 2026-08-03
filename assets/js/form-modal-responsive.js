'use strict';

(() => {
  const VERSION = 'FORMCRAFT-FORM-MODAL-2.0';
  const modal = document.querySelector('[data-modal]');
  if (!modal) return;

  let resizeObserver = null;

  const visible = element => {
    if (!(element instanceof HTMLElement)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity) !== 0
      && rect.width > 0
      && rect.height > 0;
  };

  const rectFor = element => {
    if (!(element instanceof Element)) return null;
    const rect = element.getBoundingClientRect();
    return {
      left: Math.round(rect.left * 100) / 100,
      top: Math.round(rect.top * 100) / 100,
      right: Math.round(rect.right * 100) / 100,
      bottom: Math.round(rect.bottom * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100
    };
  };

  function labelFor(value) {
    return String(value || '')
      .trim()
      .split(/\s+/)
      .map(word => /^[A-Z0-9]{2,}$/.test(word)
        ? word
        : word.replace(/(^|[-/])([a-z])/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`))
      .join(' ');
  }

  function updateScrollState(form) {
    const body = form?.querySelector('.modal-body');
    if (!(body instanceof HTMLElement)) return;
    const max = Math.max(0, body.scrollHeight - body.clientHeight);
    const top = Math.max(0, body.scrollTop);
    const position = max <= 2 ? 'none' : top <= 2 ? 'start' : top >= max - 2 ? 'end' : 'middle';
    form.dataset.formScrollPosition = position;
  }

  function normalizeERPHeading(form) {
    if (!form.matches('[data-erp-form]')) return;
    const moduleKey = form.dataset.erpModule;
    const module = window.FormcraftERP?.modulesByKey?.get(moduleKey);
    const heading = form.querySelector('#modal-title');
    if (!module || !heading) return;
    const editing = /^edit\b/i.test(heading.textContent || '');
    const verb = editing ? 'Edit' : 'Create';
    const singular = labelFor(module.singular);
    const headingText = `${verb} ${singular}`;
    if (heading.textContent !== headingText) heading.textContent = headingText;

    const submit = form.querySelector('button[type="submit"]');
    const submitText = editing ? 'Save changes' : `Create ${singular}`;
    if (submit && submit.textContent !== submitText) submit.textContent = submitText;
  }

  function improveAccessibleDescription(form) {
    const description = form.querySelector('.modal-head p:last-child');
    if (description) {
      description.id ||= `form-modal-description-${form.dataset.erpModule || 'workspace'}`;
      modal.setAttribute('aria-describedby', description.id);
    } else {
      modal.removeAttribute('aria-describedby');
    }

    const fieldset = form.querySelector('fieldset');
    const fieldsetHelp = fieldset?.querySelector(':scope > p');
    if (fieldset && fieldsetHelp) {
      fieldsetHelp.id ||= `form-section-help-${form.dataset.erpModule || 'workspace'}`;
      fieldset.setAttribute('aria-describedby', fieldsetHelp.id);
    }
  }

  function bindScrollState(form) {
    const body = form.querySelector('.modal-body');
    if (!(body instanceof HTMLElement)) return;
    if (!body.dataset.formScrollBound) {
      body.dataset.formScrollBound = 'true';
      body.addEventListener('scroll', () => updateScrollState(form), { passive: true });
    }
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => updateScrollState(form));
    resizeObserver.observe(body);
    requestAnimationFrame(() => updateScrollState(form));
  }

  function enhance() {
    const form = modal.open ? modal.querySelector('form.form-modal') : null;
    if (!form) {
      resizeObserver?.disconnect();
      modal.removeAttribute('data-form-modal-ready');
      return;
    }

    form.dataset.formModalVersion = VERSION;
    modal.dataset.formModalReady = VERSION;
    normalizeERPHeading(form);
    improveAccessibleDescription(form);
    bindScrollState(form);
  }

  function audit() {
    const form = modal.open ? modal.querySelector('form.form-modal') : null;
    if (!form) return { version: VERSION, status: 'closed' };

    const header = form.querySelector('.modal-head');
    const body = form.querySelector('.modal-body');
    const actions = form.querySelector('.modal-actions');
    const grid = form.querySelector('.erp-form-grid, .field-grid');
    const dialogRect = rectFor(modal);
    const formRect = rectFor(form);
    const headerRect = rectFor(header);
    const bodyRect = rectFor(body);
    const actionsRect = rectFor(actions);
    const bounds = bodyRect || dialogRect;
    const controls = [...form.querySelectorAll('input, select, textarea, button')].filter(visible);
    const clipped = controls.filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.left < bounds.left - 2 || rect.right > bounds.right + 2;
    }).map(element => ({
      name: element.getAttribute('name') || element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 48) || element.tagName,
      ...rectFor(element)
    }));

    const actionButtons = actions
      ? [...actions.querySelectorAll('button')].filter(visible).map(button => ({
          label: button.textContent?.trim() || button.getAttribute('aria-label') || '',
          ...rectFor(button)
        }))
      : [];
    const gridColumns = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0;
    const mobileShell = document.documentElement.dataset.formcraftMobileShell === 'true';
    const overflow = {
      dialog: Math.max(0, modal.scrollWidth - modal.clientWidth),
      form: Math.max(0, form.scrollWidth - form.clientWidth),
      body: body ? Math.max(0, body.scrollWidth - body.clientWidth) : 0
    };
    const horizontalFit = dialogRect && formRect
      ? formRect.left >= dialogRect.left - 2 && formRect.right <= dialogRect.right + 2
      : false;
    const verticalRegions = dialogRect && headerRect && bodyRect && actionsRect
      ? headerRect.top >= dialogRect.top - 2
        && actionsRect.bottom <= dialogRect.bottom + 2
        && bodyRect.top >= headerRect.bottom - 2
        && bodyRect.bottom <= actionsRect.top + 2
      : false;
    const touchTargets = !mobileShell || actionButtons.every(button => button.height >= 44);
    const accessible = Boolean(
      form.querySelector('#modal-title')
      && form.querySelector('[data-close-modal][aria-label]')
      && modal.getAttribute('aria-describedby')
    );
    const status = horizontalFit
      && verticalRegions
      && Math.max(...Object.values(overflow)) <= 2
      && clipped.length === 0
      && touchTargets
      && accessible
      ? 'ready-to-test'
      : 'blocked';

    return {
      version: VERSION,
      status,
      mobileShell,
      viewport: {
        width: Math.round(window.visualViewport?.width || window.innerWidth),
        height: Math.round(window.visualViewport?.height || window.innerHeight)
      },
      module: form.dataset.erpModule || '',
      dialog: dialogRect,
      form: formRect,
      header: headerRect,
      body: bodyRect,
      actions: actionsRect,
      overflow,
      clipped,
      gridColumns,
      actionButtons,
      touchTargets,
      accessible,
      scrollPosition: form.dataset.formScrollPosition || '',
      bodyScrollable: body ? body.scrollHeight > body.clientHeight + 2 : false
    };
  }

  const observer = new MutationObserver(enhance);
  observer.observe(modal, {
    attributes: true,
    attributeFilter: ['open'],
    childList: true,
    subtree: true
  });

  window.addEventListener('resize', () => requestAnimationFrame(enhance), { passive: true });
  document.addEventListener('formcraft:workspace-ready', enhance);
  requestAnimationFrame(enhance);

  window.FormcraftFormModal = Object.freeze({
    version: VERSION,
    enhance,
    audit,
    labelFor
  });
})();
