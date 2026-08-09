'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-MODAL-OBSERVER-1.0';
  const modal = document.querySelector('[data-modal]');
  if (!modal) return;

  let frame = 0;
  function refresh() {
    frame = 0;
    window.FormcraftProductDepthTransactionsUI?.refresh?.();
    window.FormcraftProductDepthMobileUI?.refresh?.();
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
