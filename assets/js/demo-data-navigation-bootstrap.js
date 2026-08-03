'use strict';

(() => {
  const VERSION = 'FORMCRAFT-DEMO-NAV-BOOTSTRAP-1.0';
  let booted = false;

  function boot() {
    if (booted || !window.FormcraftDemoData || typeof renderShell !== 'function') return;
    if (document.documentElement.dataset.backend !== 'ready') return;
    booted = true;
    renderShell();
    document.documentElement.dataset.demoNavigationBootstrap = VERSION;
  }

  if (document.documentElement.dataset.backend === 'ready') requestAnimationFrame(boot);
  else document.addEventListener('formcraft:workspace-ready', () => requestAnimationFrame(boot), { once: true });

  window.FormcraftDemoNavigationBootstrap = Object.freeze({ version: VERSION, boot });
})();
