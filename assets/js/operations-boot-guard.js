'use strict';

(() => {
  const renderOperationsShell = renderShell;

  renderShell = function renderGuardedOperationsShell(...args) {
    const backendReady = document.documentElement.dataset.backend === 'ready';
    const authenticatedWorkspace = Boolean(window.FormcraftBackend?.workspace);
    if (!backendReady && !authenticatedWorkspace) return undefined;
    return renderOperationsShell.apply(this, args);
  };
})();
