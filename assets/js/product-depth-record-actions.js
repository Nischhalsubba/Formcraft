'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-RECORD-ACTIONS-1.0';
  const mobileQuery = matchMedia('(max-width: 820px)');

  function compact(root) {
    if (!mobileQuery.matches || !root || root.dataset.pdActionsCompact) return;
    const actions = root.querySelector('.rw-hero-actions');
    if (!actions) return;
    const candidates = [...actions.children].filter(node => node instanceof HTMLElement && !node.hidden);
    if (candidates.length <= 2) return;
    root.dataset.pdActionsCompact = 'true';
    const primary = candidates.find(node => node.classList.contains('button-primary')) || candidates[0];
    const secondary = candidates.filter(node => node !== primary);
    const more = document.createElement('details');
    more.className = 'pd-record-more';
    more.innerHTML = `<summary aria-label="More record actions">${typeof icon === 'function' ? icon('more', 18) : '...'}<span>More</span></summary><div class="pd-record-more-menu"></div>`;
    const menu = more.querySelector('.pd-record-more-menu');
    secondary.forEach(node => menu.append(node));
    actions.append(more);
    menu.addEventListener('click', event => {
      if (event.target.closest('button, a')) more.open = false;
    });
  }

  function enhance() {
    document.querySelectorAll('[data-record-workspace][data-record-mode="view"]').forEach(compact);
    document.documentElement.dataset.formcraftProductDepthRecordActions = VERSION;
  }

  new MutationObserver(() => requestAnimationFrame(enhance)).observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
  mobileQuery.addEventListener?.('change', enhance);
  enhance();
  window.FormcraftProductDepthRecordActions = Object.freeze({ version: VERSION, refresh: enhance });
})();
