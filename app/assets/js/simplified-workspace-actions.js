'use strict';

(() => {
  const VERSION = 'FORMCRAFT-SIMPLE-ACTIONS-1.0';

  document.addEventListener('click', event => {
    const target = event.target instanceof Element
      ? event.target.closest('.fc3-mobile-bottom-nav [data-context-create]')
      : null;
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof handleContextCreate === 'function') handleContextCreate();
  }, true);

  window.FormcraftSimpleActions = Object.freeze({ version: VERSION });
})();
