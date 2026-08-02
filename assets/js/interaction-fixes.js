'use strict';

(() => {
  const committingForms = new WeakSet();

  function openWorkspaceSearchResult(button) {
    const route = button.dataset.workspaceSearchRoute;
    const id = button.dataset.workspaceSearchId;
    if (!route || !routes[route]) return;

    closeModal();
    navigate(route);

    if (!id || id === route) return;
    requestAnimationFrame(() => {
      const actions = {
        projects: () => openProjectDetail(projectById(id)),
        tasks: () => openTaskForm(state.tasks.find(task => task.id === id)),
        team: () => openMemberForm(state.team.find(member => member.id === id || member.userId === id)),
        calendar: () => openEventForm(state.events.find(item => item.id === id)),
        email: () => {
          const message = state.messages.find(item => item.id === id);
          if (!message) return;
          message.unread = false;
          ui.emailFolder = ['inbox', 'sent', 'drafts', 'archive', 'trash'].includes(message.folder) ? message.folder : 'inbox';
          ui.selectedEmail = message.id;
          saveState();
          renderShell();
        },
        invoices: () => openInvoiceDetail(state.invoices.find(item => item.id === id)),
        files: () => {
          const item = state.files.find(file => file.id === id);
          if (!item) return;
          if (item.kind === 'folder') {
            ui.fileFolder = item.id;
            renderShell();
            return;
          }
          const openControl = document.querySelector(`[data-open-file="${CSS.escape(id)}"]`);
          openControl?.click();
        }
      };
      actions[route]?.();
    });
  }

  function senderIdentity() {
    const user = window.FormcraftBackend?.session?.user;
    return user?.user_metadata?.full_name || currentUserName() || user?.email || 'Workspace member';
  }

  function buildMessage(form, folder) {
    const values = formValues(form);
    const attachmentInput = form.elements.attachments;
    return {
      id: uid(),
      folder,
      from: senderIdentity(),
      to: values.to,
      subject: values.subject,
      body: values.body || '',
      date: new Date().toISOString(),
      unread: false,
      starred: false,
      attachments: attachmentInput ? [...attachmentInput.files].map(file => file.name) : [],
      attachmentPaths: [],
      syncState: 'pending'
    };
  }

  function setComposeBusy(form, busy, folder) {
    form.querySelectorAll('button, input, select, textarea').forEach(control => {
      control.disabled = busy;
    });
    const label = form.querySelector('[data-compose-submit-label]');
    if (label) label.textContent = busy
      ? (folder === 'sent' ? 'Sending…' : 'Saving…')
      : 'Send message';
  }

  async function commitEmailMessage(form, folder) {
    if (!form || committingForms.has(form)) return;
    const requiredNames = folder === 'sent' ? null : ['to', 'subject'];
    if (!validateForm(form, requiredNames)) return;

    committingForms.add(form);
    setComposeBusy(form, true, folder);

    const record = buildMessage(form, folder);
    state.messages.unshift(record);
    logActivity('email', folder === 'sent' ? 'Message sent' : 'Draft saved', record.subject);
    ui.emailFolder = folder;
    ui.selectedEmail = null;

    closeModal();
    renderShell();

    try {
      await Promise.resolve(saveState());
      record.syncState = 'synced';
      toast(folder === 'sent' ? 'Message sent.' : 'Draft saved.');
    } catch (error) {
      record.syncState = 'retry';
      toast('The message is saved and will retry syncing with the workspace.', 'warning');
    }
  }

  document.addEventListener('click', event => {
    const searchResult = event.target.closest('[data-workspace-search-route]');
    if (searchResult) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openWorkspaceSearchResult(searchResult);
      return;
    }

    const sendButton = event.target.closest('[data-send-message]');
    const draftButton = event.target.closest('[data-save-message-draft]');
    if (!sendButton && !draftButton) return;

    const form = event.target.closest('[data-enhanced-compose-form]');
    if (!form) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    commitEmailMessage(form, sendButton ? 'sent' : 'drafts');
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target.closest?.('[data-enhanced-compose-form]');
    if (!form) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    commitEmailMessage(form, 'sent');
  }, true);

  window.FormcraftEmailComposer = Object.freeze({
    commit: commitEmailMessage,
    isCommitting(form) {
      return Boolean(form && committingForms.has(form));
    }
  });

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