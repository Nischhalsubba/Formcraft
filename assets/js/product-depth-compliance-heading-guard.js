'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-COMPLIANCE-HEADING-1.1';
  const expected = 'attendance & compliance center';
  let frame = 0;

  function reconcile() {
    frame = 0;
    const root = document.querySelector('[data-np-compliance-page]');
    const headings = [...document.querySelectorAll('h1')]
      .filter(node => node.textContent.trim().toLowerCase() === expected);

    if (!root) {
      headings.forEach(node => node.classList.remove('pd-duplicate-page-heading'));
      return;
    }

    const inRoot = headings.filter(node => root.contains(node));
    const canonical = inRoot[0] || headings[0] || null;
    headings.forEach(node => {
      node.classList.toggle('pd-duplicate-page-heading', Boolean(canonical && node !== canonical));
    });
    canonical?.classList.remove('pd-duplicate-page-heading');
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      reconcile();
      requestAnimationFrame(reconcile);
    });
  }

  if (typeof renderShell === 'function') {
    const renderShellBeforeHeadingGuard = renderShell;
    renderShell = function renderProductDepthHeadingGuard(...args) {
      const result = renderShellBeforeHeadingGuard.apply(this, args);
      reconcile();
      schedule();
      return result;
    };
  }

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', schedule, { passive: true });
  document.addEventListener('formcraft:workspace-ready', schedule);
  schedule();

  document.documentElement.dataset.formcraftProductDepthComplianceHeading = VERSION;
  window.FormcraftProductDepthComplianceHeading = Object.freeze({ version: VERSION, refresh: () => { reconcile(); schedule(); } });
})();
