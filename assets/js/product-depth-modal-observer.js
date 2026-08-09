'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-MODAL-OBSERVER-1.1';
  const modal = document.querySelector('[data-modal]');
  if (!modal) return;

  const compatibleForms = new WeakSet();
  let frame = 0;

  function firstLineRow(form) {
    return form.querySelector('[data-pd-line-editor] [data-pd-line-row]');
  }

  function readLegacy(form, name) {
    return form.elements[name]?.value ?? '';
  }

  function writeLine(row, key, value) {
    const control = row?.querySelector(`[data-pd-line="${key}"]`);
    if (control) control.value = String(value ?? '');
  }

  function syncLegacyToEditor(form, changedName = '') {
    const editor = form.querySelector('[data-pd-line-editor]');
    const row = firstLineRow(form);
    if (!editor || !row || editor.dataset.pdDirty === 'true' || form.dataset.pdCompatSync === 'true') return;
    form.dataset.pdCompatSync = 'true';
    try {
      const moduleKey = form.dataset.erpModule || '';
      const map = {
        productId: readLegacy(form, 'productId'),
        quantity: readLegacy(form, 'quantity'),
        unitPrice: moduleKey === 'purchase' ? readLegacy(form, 'unitCost') : readLegacy(form, 'unitPrice'),
        discountRate: readLegacy(form, 'discount'),
        taxRate: readLegacy(form, 'taxRate')
      };
      if (changedName in map) writeLine(row, changedName === 'unitCost' ? 'unitPrice' : changedName === 'discount' ? 'discountRate' : changedName, map[changedName]);
      else Object.entries(map).forEach(([key, value]) => writeLine(row, key, value));
      window.FormcraftProductDepthTransactionsUI?.syncLineEditor?.(form);
      if (moduleKey === 'purchase' && form.elements.unitCost) {
        const linePrice = row.querySelector('[data-pd-line="unitPrice"]')?.value ?? '';
        form.elements.unitCost.value = linePrice;
      }
    } finally {
      delete form.dataset.pdCompatSync;
    }
  }

  function syncEditorToPurchaseLegacy(form) {
    if (form.dataset.erpModule !== 'purchase' || !form.elements.unitCost) return;
    const row = firstLineRow(form);
    if (!row) return;
    form.elements.unitCost.value = row.querySelector('[data-pd-line="unitPrice"]')?.value ?? '';
  }

  function enhanceCompatibility(form) {
    if (!form || compatibleForms.has(form)) return;
    const moduleKey = form.dataset.erpModule || '';
    if (!['sales', 'purchase'].includes(moduleKey) || !form.querySelector('[data-pd-line-editor]')) return;
    compatibleForms.add(form);

    const legacyNames = new Set(['productId', 'quantity', 'unitPrice', 'unitCost', 'discount', 'taxRate', 'total']);
    const onLegacyInput = event => {
      const editor = form.querySelector('[data-pd-line-editor]');
      if (!editor) return;
      if (event.target.closest?.('[data-pd-line-editor]')) {
        editor.dataset.pdDirty = 'true';
        queueMicrotask(() => syncEditorToPurchaseLegacy(form));
        return;
      }
      const name = event.target?.name || '';
      if (!legacyNames.has(name) || form.dataset.pdCompatSync === 'true') return;
      if (name === 'total') return;
      syncLegacyToEditor(form, name);
    };

    form.addEventListener('input', onLegacyInput, true);
    form.addEventListener('change', onLegacyInput, true);
    syncLegacyToEditor(form);
  }

  function refresh() {
    frame = 0;
    window.FormcraftProductDepthTransactionsUI?.refresh?.();
    window.FormcraftProductDepthMobileUI?.refresh?.();
    modal.querySelectorAll('form[data-erp-form]').forEach(enhanceCompatibility);
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(refresh);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(modal, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['open', 'data-erp-module', 'data-workflow-enhanced']
  });

  modal.addEventListener('close', schedule);
  document.addEventListener('formcraft:workspace-ready', schedule);
  schedule();

  document.documentElement.dataset.formcraftProductDepthModalObserver = VERSION;
  window.FormcraftProductDepthModalObserver = Object.freeze({ version: VERSION, refresh: schedule });
})();
