'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-COMPLIANCE-HEADING-1.0';
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

    const canonical = root.querySelector('h1[data-route-heading]')
      || [...root.querySelectorAll('h1')].find(node => node.textContent.trim().toLowerCase() === expected)
      || headings[0]
      || null;

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

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', schedule, { passive: true });
  document.addEventListener('formcraft:workspace-ready', schedule);
  schedule();

  document.documentElement.dataset.formcraftProductDepthComplianceHeading = VERSION;
  window.FormcraftProductDepthComplianceHeading = Object.freeze({ version: VERSION, refresh: schedule });
})();
