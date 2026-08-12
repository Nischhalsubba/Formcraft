'use strict';

(() => {
  const originalBindSettings = bindSettings;

  bindSettings = function bindDynamicSettings() {
    originalBindSettings();
    const resetButton = $('[data-reset-data]');
    if (!resetButton) return;

    const cleanButton = resetButton.cloneNode(true);
    resetButton.replaceWith(cleanButton);
    cleanButton.addEventListener('click', () => confirmAction(
      'Reset workspace?',
      'This permanently removes all workspace records and uploaded file data. This cannot be undone.',
      async () => {
        cleanButton.disabled = true;
        try {
          await clearFileBlobs();
          const workspaceName = state.settings.workspaceName;
          const workspaceDescription = state.settings.workspaceDescription;
          const theme = state.settings.theme;
          const currency = state.settings.currency || 'USD';
          state = emptyState();
          Object.assign(state.settings, { workspaceName, workspaceDescription, theme, currency });
          logActivity('system', 'Workspace reset', 'All operational records were removed.');
          saveState();
          applyTheme();
          renderShell();
          toast('Workspace reset.', 'warning');
        } catch (error) {
          cleanButton.disabled = false;
          toast(error.message || 'Workspace reset failed.', 'error');
        }
      }
    ));
  };

  openComposeForm = function openDynamicComposeForm() {
    openFormModal(
      'Compose message',
      'Write a message from the authenticated workspace.',
      `<div class="field-grid">${field('To', 'to', '', { type: 'email', required: true, span: true })}${field('Subject', 'subject', '', { required: true, span: true, maxlength: 140 })}${field('Message', 'body', '', { textarea: true, required: true, span: true })}${field('Attachments', 'attachments', '', { type: 'file', span: true, multiple: true })}</div>`,
      async form => {
        const values = formValues(form);
        const messageId = uid();
        const files = [...form.elements.attachments.files];
        const attachmentNames = [];
        const attachmentPaths = [];
        const submit = form.querySelector('button[type="submit"]');
        if (submit) submit.disabled = true;

        try {
          for (const file of files) {
            const fileId = `${messageId}-${uid()}`;
            const path = await putFileBlob(fileId, file);
            attachmentNames.push(file.name);
            attachmentPaths.push(path);
          }

          state.messages.push({
            id: messageId,
            folder: 'sent',
            from: currentUserName(),
            to: values.to,
            subject: values.subject,
            body: values.body,
            date: new Date().toISOString(),
            unread: false,
            starred: false,
            attachments: attachmentNames,
            attachmentPaths
          });
          logActivity('email', 'Message sent', values.subject);
          saveState();
          closeModal();
          renderShell();
          toast('Message saved to the workspace mailbox.');
        } catch (error) {
          if (submit) submit.disabled = false;
          toast(error.message || 'Message could not be saved.', 'error');
        }
      },
      [{
        label: 'Save draft',
        tone: 'secondary',
        onClick: () => {
          const form = $('[data-modal-form]', modal);
          if (!validateForm(form, ['to', 'subject'])) return;
          const values = formValues(form);
          state.messages.push({
            id: uid(),
            folder: 'drafts',
            from: currentUserName(),
            to: values.to,
            subject: values.subject,
            body: values.body || '',
            date: new Date().toISOString(),
            unread: false,
            starred: false,
            attachments: [],
            attachmentPaths: []
          });
          logActivity('email', 'Draft saved', values.subject);
          saveState();
          closeModal();
          renderShell();
          toast('Draft saved.');
        }
      }]
    );
  };
})();
