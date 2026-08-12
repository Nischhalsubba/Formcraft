'use strict';

(() => {
  const VERSION = 'FORMCRAFT-RECORD-WORKSPACE-FIXES-1.7';
  const ERP = window.FormcraftERP;
  const workspace = window.FormcraftRecordWorkspace;
  const sharedModal = document.querySelector('[data-modal]');
  const appRoot = document.querySelector('#app');
  if (!ERP || !workspace) return;

  function context(target) {
    const root = target?.closest?.('[data-record-workspace]');
    if (!root) return null;
    const module = ERP.modulesByKey.get(root.dataset.recordModule);
    const record = module ? ERP.collection(module).find(item => item.id === root.dataset.recordId) : null;
    const form = root.querySelector('[data-rw-form]');
    return module && record ? { root, module, record, form } : null;
  }

  function ensureSidebarStyles() {
    if (document.querySelector('[data-rw-sidebar-compat-style]')) return;
    const style = document.createElement('style');
    style.dataset.rwSidebarCompatStyle = VERSION;
    style.textContent = `
      @media (min-width: 1181px), (max-width: 768px) {
        .fc3-desktop-sidebar-toggle { display: none !important; }
      }
      @media (min-width: 769px) and (max-width: 1180px) {
        .fc3-desktop-sidebar-toggle { display: inline-flex !important; }
      }
    `;
    document.head.append(style);
  }

  function syncSidebarControl() {
    ensureSidebarStyles();
    const tablet = matchMedia('(min-width: 769px) and (max-width: 1180px)').matches;
    document.querySelectorAll('.fc3-desktop-sidebar-toggle').forEach(button => {
      button.hidden = !tablet;
      if (tablet) {
        button.removeAttribute('aria-hidden');
        button.tabIndex = 0;
      } else {
        button.setAttribute('aria-hidden', 'true');
        button.tabIndex = -1;
      }
    });
  }

  function scheduleShellCompatibility() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      decorateRecordPage();
      syncSidebarControl();
    }));
  }

  function decorateRecordPage() {
    const root = document.querySelector('[data-record-workspace][data-record-mode="view"]');
    if (!root?.dataset.recordModule) return;
    root.dataset.erpRecordPage = root.dataset.recordModule;
  }

  function showDraftState(form) {
    const indicator = form?.closest('[data-record-workspace]')?.querySelector('[data-rw-save-state]');
    if (!indicator) return;
    window.clearTimeout(Number(form.dataset.rwIndicatorTimer || 0));
    const timer = window.setTimeout(() => {
      indicator.textContent = `Draft saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      delete form.dataset.rwIndicatorTimer;
    }, 430);
    form.dataset.rwIndicatorTimer = String(timer);
  }

  function valueFor(schema, control) {
    if (schema.type === 'boolean') return Boolean(control.checked);
    if (schema.type === 'tags') return String(control.value || '').split(',').map(value => value.trim()).filter(Boolean);
    if (['number', 'money'].includes(schema.type)) return control.value === '' ? 0 : Number(control.value);
    return control.value;
  }

  function validate(page) {
    const errors = [];
    page.module.fields.forEach(schema => {
      const control = page.form?.elements?.[schema.name];
      if (!control) return;
      const raw = control.type === 'checkbox' ? control.checked : String(control.value || '').trim();
      let message = '';
      if (schema.required && (raw === '' || raw === null || raw === undefined)) message = `${schema.label} is required.`;
      else if (schema.type === 'email' && raw && !/^\S+@\S+\.\S+$/.test(raw)) message = `Enter a valid ${schema.label.toLowerCase()}.`;
      else if (schema.type === 'url' && raw) {
        try { new URL(raw); } catch { message = `Enter a complete URL for ${schema.label.toLowerCase()}.`; }
      }
      if (!message && ['number', 'money'].includes(schema.type) && raw !== '') {
        const numeric = Number(raw);
        if (!Number.isFinite(numeric)) message = `${schema.label} must be a number.`;
        else if (schema.min !== undefined && numeric < Number(schema.min)) message = `${schema.label} must be at least ${schema.min}.`;
        else if (schema.max !== undefined && numeric > Number(schema.max)) message = `${schema.label} must be no more than ${schema.max}.`;
      }
      const target = page.form.querySelector(`[data-rw-error="${CSS.escape(schema.name)}"]`);
      control.toggleAttribute('aria-invalid', Boolean(message));
      if (target) target.textContent = message;
      if (message) errors.push({ control, message });
    });
    const summary = page.form?.querySelector('[data-rw-form-summary]');
    if (summary) summary.innerHTML = errors.length
      ? `<strong>Fix ${errors.length} field${errors.length === 1 ? '' : 's'} before saving.</strong><span>${errors.map(item => item.message).join(' ')}</span>`
      : '';
    errors[0]?.control?.focus();
    return errors.length === 0;
  }

  async function publish(page) {
    if (!page.form || !validate(page)) return;
    const originalTitle = ERP.titleFor(page.module, page.record);
    page.module.fields.forEach(schema => {
      const control = page.form.elements[schema.name];
      if (control) page.record[schema.name] = valueFor(schema, control);
    });
    const updatedTitle = ERP.titleFor(page.module, page.record);
    ERP.recordAudit(
      page.module,
      page.record,
      'Updated from record workspace',
      originalTitle === updatedTitle ? 'Details changed' : `Renamed from ${originalTitle}`
    );
    workspace.clearPageDraft(page.module, page.record);
    await Promise.resolve(saveState());
    workspace.openRecord(page.module.key, page.record.id, { replace: true });
    toast(`${page.module.singular} updated.`);
  }

  function modalCard() {
    return sharedModal?.querySelector('.modal-card, form, [role="document"]') || null;
  }

  function isOutsideModalCard(event) {
    const card = modalCard();
    if (card && event.target instanceof Node && card.contains(event.target)) return false;
    const rect = card?.getBoundingClientRect();
    if (!rect) return true;
    return event.clientX < rect.left
      || event.clientX > rect.right
      || event.clientY < rect.top
      || event.clientY > rect.bottom;
  }

  function forceCloseSharedModal() {
    if (!sharedModal?.open) return;
    try {
      closeModal();
    } catch (error) {
      console.warn('The normal modal close path failed; using the safe fallback.', error);
    }
    if (!sharedModal.open) return;
    document.querySelectorAll('.workflow-confirm-dialog[open]').forEach(dialog => {
      try { dialog.close(); } catch {}
      dialog.remove();
    });
    try { sharedModal.close(); } catch {}
    const content = sharedModal.querySelector('[data-modal-content]');
    if (content) content.innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  function dismissSharedModal(event) {
    if (!sharedModal?.open || !isOutsideModalCard(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    forceCloseSharedModal();
  }

  document.addEventListener('pointerdown', dismissSharedModal, true);
  sharedModal?.addEventListener('click', event => {
    if (event.target !== sharedModal) return;
    dismissSharedModal(event);
  }, true);
  sharedModal?.addEventListener('cancel', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    forceCloseSharedModal();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !sharedModal?.open) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    forceCloseSharedModal();
  }, true);

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const page = context(target);
    if (!page) return;

    if (target.closest('[data-rw-edit]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      workspace.openEditor(page.module.key, page.record.id);
      return;
    }

    if (target.closest('[data-rw-back]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      workspace.closeRecord(page.module);
      return;
    }

    if (target.closest('[data-rw-save-return], [data-rw-cancel]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (page.form) workspace.savePageDraft(page.form, page.module, page.record);
      workspace.openRecord(page.module.key, page.record.id, { replace: true });
      toast('Draft saved. Published values were not changed.');
      return;
    }

    if (target.closest('[data-rw-discard]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      workspace.clearPageDraft(page.module, page.record);
      workspace.openEditor(page.module.key, page.record.id, { replace: true });
      toast('Recovered draft discarded.', 'warning');
      return;
    }

    const jump = target.closest('[data-rw-jump]');
    if (jump) {
      event.preventDefault();
      event.stopImmediatePropagation();
      page.root.querySelectorAll('[data-rw-jump]').forEach(item => item.classList.toggle('is-active', item === jump));
      document.getElementById(jump.dataset.rwJump)?.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
    }
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form?.matches('[data-rw-form]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const page = context(form);
    if (!page) return;
    publish(page).catch(error => toast(error.message || 'Record could not be saved.', 'error'));
  }, true);

  const updateDraftIndicator = event => {
    const form = event.target instanceof Element ? event.target.closest('[data-rw-form]') : null;
    if (form) showDraftState(form);
  };
  document.addEventListener('input', updateDraftIndicator, true);
  document.addEventListener('change', updateDraftIndicator, true);

  if (appRoot) {
    new MutationObserver(scheduleShellCompatibility).observe(appRoot, { childList: true, subtree: true });
  }
  window.addEventListener('resize', scheduleShellCompatibility);
  scheduleShellCompatibility();

  window.FormcraftRecordWorkspaceFixes = Object.freeze({
    version: VERSION,
    context,
    decorateRecordPage,
    syncSidebarControl,
    showDraftState,
    validate,
    publish,
    dismissSharedModal,
    isOutsideModalCard,
    forceCloseSharedModal
  });
})();
