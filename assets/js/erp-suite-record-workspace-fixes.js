'use strict';

(() => {
  const VERSION = 'FORMCRAFT-RECORD-WORKSPACE-FIXES-1.0';
  const ERP = window.FormcraftERP;
  const workspace = window.FormcraftRecordWorkspace;
  if (!ERP || !workspace) return;

  function context(target) {
    const root = target?.closest?.('[data-record-workspace]');
    if (!root) return null;
    const module = ERP.modulesByKey.get(root.dataset.recordModule);
    const record = module ? ERP.collection(module).find(item => item.id === root.dataset.recordId) : null;
    const form = root.querySelector('[data-rw-form]');
    return module && record ? { root, module, record, form } : null;
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

  const updateDraftIndicator = event => {
    const form = event.target instanceof Element ? event.target.closest('[data-rw-form]') : null;
    if (form) showDraftState(form);
  };
  document.addEventListener('input', updateDraftIndicator, true);
  document.addEventListener('change', updateDraftIndicator, true);

  window.FormcraftRecordWorkspaceFixes = Object.freeze({ version: VERSION, context, showDraftState });
})();
