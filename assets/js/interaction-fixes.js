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

  function fieldValue(form, name) {
    return String(form.elements[name]?.value || '').trim();
  }

  function showFieldError(form, name, message) {
    const control = form.elements[name];
    const error = form.querySelector(`[data-error-for="${name}"]`);
    control?.setAttribute('aria-invalid', 'true');
    if (error) error.textContent = message;
  }

  function validateComposeForm(form, folder) {
    form.querySelectorAll('[data-error-for]').forEach(error => { error.textContent = ''; });
    form.querySelectorAll('[aria-invalid="true"]').forEach(control => control.removeAttribute('aria-invalid'));

    const to = fieldValue(form, 'to');
    const subject = fieldValue(form, 'subject');
    const body = fieldValue(form, 'body');
    let valid = true;

    if (!to) {
      showFieldError(form, 'to', 'This field is required.');
      valid = false;
    } else if (!/^\S+@\S+\.\S+$/.test(to)) {
      showFieldError(form, 'to', 'Enter a valid email address.');
      valid = false;
    }
    if (!subject) {
      showFieldError(form, 'subject', 'This field is required.');
      valid = false;
    }
    if (folder === 'sent' && !body) {
      showFieldError(form, 'body', 'This field is required.');
      valid = false;
    }

    if (!valid) form.querySelector('[aria-invalid="true"]')?.focus();
    return valid;
  }

  function buildMessage(form, folder) {
    const attachmentInput = form.elements.attachments;
    return {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      folder,
      from: senderIdentity(),
      to: fieldValue(form, 'to'),
      subject: fieldValue(form, 'subject'),
      body: fieldValue(form, 'body'),
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
    window.__FORMCRAFT_EMAIL_COMPOSE_STAGE__ = 'validating';
    if (!validateComposeForm(form, folder)) {
      window.__FORMCRAFT_EMAIL_COMPOSE_STAGE__ = 'invalid';
      return;
    }

    committingForms.add(form);
    setComposeBusy(form, true, folder);

    const record = buildMessage(form, folder);
    state.messages = [record, ...(Array.isArray(state.messages) ? state.messages : [])];
    logActivity('email', folder === 'sent' ? 'Message sent' : 'Draft saved', record.subject);
    ui.emailFolder = folder;
    ui.selectedEmail = null;
    window.__FORMCRAFT_EMAIL_COMPOSE_STAGE__ = 'committed';

    closeModal();
    renderShell();

    try {
      await Promise.resolve(saveState());
      record.syncState = 'synced';
      window.__FORMCRAFT_EMAIL_COMPOSE_STAGE__ = 'synced';
      toast(folder === 'sent' ? 'Message sent.' : 'Draft saved.');
    } catch (error) {
      record.syncState = 'retry';
      window.__FORMCRAFT_EMAIL_COMPOSE_STAGE__ = 'retry';
      toast('The message is saved and will retry syncing with the workspace.', 'warning');
    }
  }

  function composeAction(event) {
    const sendButton = event.target.closest('[data-send-message]');
    const draftButton = event.target.closest('[data-save-message-draft]');
    if (!sendButton && !draftButton) return false;

    const form = event.target.closest('[data-enhanced-compose-form]');
    if (!form) return false;

    event.preventDefault();
    event.stopImmediatePropagation();
    commitEmailMessage(form, sendButton ? 'sent' : 'drafts');
    return true;
  }

  document.addEventListener('pointerup', event => {
    composeAction(event);
  }, true);

  document.addEventListener('click', event => {
    const tourTrigger = event.target.closest('[data-start-product-tour]');
    if (tourTrigger) window.__FORMCRAFT_TOUR_RETURN_ROUTE__ = ui.route;

    const searchResult = event.target.closest('[data-workspace-search-route]');
    if (searchResult) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openWorkspaceSearchResult(searchResult);
      return;
    }

    composeAction(event);
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target.closest?.('[data-enhanced-compose-form]');
    if (!form) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    commitEmailMessage(form, 'sent');
  }, true);

  document.addEventListener('formcraft:product-tour-finished', () => {
    const returnRoute = window.__FORMCRAFT_TOUR_RETURN_ROUTE__;
    window.__FORMCRAFT_TOUR_RETURN_ROUTE__ = '';
    if (!returnRoute || !routes[returnRoute] || ui.route === returnRoute) return;
    navigate(returnRoute);
  });

  window.FormcraftEmailComposer = Object.freeze({
    commit: commitEmailMessage,
    isCommitting(form) {
      return Boolean(form && committingForms.has(form));
    },
    stage() {
      return window.__FORMCRAFT_EMAIL_COMPOSE_STAGE__ || 'idle';
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