'use strict';

(() => {
  const committingForms = new WeakSet();

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

  function setBusy(form, busy, folder) {
    form.querySelectorAll('button, input, select, textarea').forEach(control => {
      control.disabled = busy;
    });
    const label = form.querySelector('[data-compose-submit-label]');
    if (label) label.textContent = busy
      ? (folder === 'sent' ? 'Sending…' : 'Saving…')
      : 'Send message';
  }

  async function commit(form, folder) {
    if (!form || committingForms.has(form)) return;
    const requiredNames = folder === 'sent' ? null : ['to', 'subject'];
    if (!validateForm(form, requiredNames)) return;

    committingForms.add(form);
    setBusy(form, true, folder);

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
    const sendButton = event.target.closest('[data-send-message]');
    const draftButton = event.target.closest('[data-save-message-draft]');
    if (!sendButton && !draftButton) return;

    const form = event.target.closest('[data-enhanced-compose-form]');
    if (!form) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    commit(form, sendButton ? 'sent' : 'drafts');
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target.closest?.('[data-enhanced-compose-form]');
    if (!form) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    commit(form, 'sent');
  }, true);

  window.FormcraftEmailComposer = Object.freeze({
    commit,
    isCommitting(form) {
      return Boolean(form && committingForms.has(form));
    }
  });
})();