'use strict';

(() => {
  function openWorkspaceSearchResult(button) {
    const route = button.dataset.workspaceSearchRoute;
    const id = button.dataset.workspaceSearchId;
    if (!route) return;

    closeModal();
    navigate(route);

    if (!id || id === route) return;
    requestAnimationFrame(() => {
      const actions = {
        projects: () => openProjectDetail(projectById(id)),
        tasks: () => openTaskForm(state.tasks.find(task => task.id === id)),
        team: () => openMemberForm(state.team.find(member => member.id === id || member.userId === id)),
        calendar: () => openEventForm(state.events.find(item => item.id === id)),
        invoices: () => openInvoiceDetail(state.invoices.find(item => item.id === id)),
        files: () => {
          const item = state.files.find(file => file.id === id);
          if (!item) return;
          if (item.kind === 'folder') {
            ui.fileFolder = item.id;
            renderShell();
            return;
          }
          $('[data-open-file]')?.focus();
        }
      };
      actions[route]?.();
    });
  }

  document.addEventListener('click', event => {
    const searchResult = event.target.closest('[data-workspace-search-route]');
    if (!searchResult) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openWorkspaceSearchResult(searchResult);
  }, true);

  window.FormcraftInteractions = Object.freeze({
    openWorkspaceSearchResult,
    audit(root = document) {
      const controls = [...root.querySelectorAll('button, a[href], input, select, textarea')];
      return {
        total: controls.length,
        unnamedButtons: controls
          .filter(control => control.tagName === 'BUTTON')
          .filter(control => !control.textContent.trim() && !control.getAttribute('aria-label') && !control.getAttribute('title'))
          .map(control => control.outerHTML.slice(0, 180))
      };
    }
  });
})();
