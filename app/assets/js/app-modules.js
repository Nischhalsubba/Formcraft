'use strict';

function bindCalendar() {
    $('[data-calendar-prev]')?.addEventListener('click', () => { ui.calendarMonth.setMonth(ui.calendarMonth.getMonth() - 1); renderShell(); });
    $('[data-calendar-next]')?.addEventListener('click', () => { ui.calendarMonth.setMonth(ui.calendarMonth.getMonth() + 1); renderShell(); });
    $('[data-calendar-today]')?.addEventListener('click', () => { ui.calendarMonth = new Date(today().getFullYear(), today().getMonth(), 1); renderShell(); });
    $$('[data-new-event-date]').forEach(button => button.addEventListener('click', () => openEventForm(null, button.dataset.newEventDate)));
    $$('[data-event-id]').forEach(button => button.addEventListener('click', () => openEventForm(state.events.find(event => event.id === button.dataset.eventId))));
    $$('[data-show-day]').forEach(button => button.addEventListener('click', () => openDayEvents(button.dataset.showDay)));
  }

  function openDayEvents(date) {
    const events = state.events.filter(event => event.date === date).sort((a, b) => a.time.localeCompare(b.time));
    openModal(`<div class="modal-card"><div class="modal-head"><div><h2 id="modal-title">${formatDate(date)}</h2><p>${events.length} events</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div><div class="page-stack">${events.map(event => `<button class="agenda-event" type="button" data-modal-event="${event.id}"><span><strong>${escapeHtml(event.title)}</strong><br><small>${escapeHtml(event.category)}</small></span><time>${escapeHtml(event.time)}</time></button>`).join('')}</div></div>`);
    $$('[data-modal-event]', modal).forEach(button => button.addEventListener('click', () => { closeModal(); openEventForm(state.events.find(event => event.id === button.dataset.modalEvent)); }));
  }

  function openEventForm(event = null, presetDate = null) {
    const data = event || { title: '', date: presetDate || dateKey(today()), time: '09:00', category: 'meeting', notes: '' };
    openFormModal(event ? 'Edit event' : 'Create event', 'Schedule a meeting, review, deadline, or personal reminder.', `<div class="field-grid">${field('Title', 'title', data.title, { required: true, span: true, maxlength: 100 })}${field('Date', 'date', data.date, { type: 'date', required: true })}${field('Time', 'time', data.time, { type: 'time' })}${selectField('Category', 'category', ['meeting', 'review', 'deadline', 'personal'], data.category)}${field('Notes', 'notes', data.notes, { textarea: true, span: true, maxlength: 300 })}</div>`, form => {
      const values = formValues(form);
      if (event) Object.assign(event, values); else state.events.push({ ...values, id: uid() });
      logActivity('calendar', event ? 'Event updated' : 'Event created', values.title);
      saveState(); closeModal(); renderShell(); toast(event ? 'Event updated.' : 'Event created.');
    }, event ? [{ label: 'Delete event', tone: 'danger', onClick: () => { closeModal(); confirmAction('Delete event?', `Delete ${event.title}?`, () => { state.events = state.events.filter(item => item.id !== event.id); saveState(); renderShell(); toast('Event deleted.', 'warning'); }); } }] : []);
  }

  function bindEmail() {
    $$('[data-email-folder]').forEach(button => button.addEventListener('click', () => { ui.emailFolder = button.dataset.emailFolder; ui.selectedEmail = null; ui.selectedEmails.clear(); renderShell(); }));
    $$('[data-open-email]').forEach(button => button.addEventListener('click', () => { const message = state.messages.find(item => item.id === button.dataset.openEmail); message.unread = false; ui.selectedEmail = message.id; saveState(); renderShell(); }));
    $$('[data-star-email]').forEach(button => button.addEventListener('click', () => { const message = state.messages.find(item => item.id === button.dataset.starEmail); message.starred = !message.starred; saveState(); renderShell(); }));
    $$('[data-select-email]').forEach(input => input.addEventListener('change', () => { input.checked ? ui.selectedEmails.add(input.dataset.selectEmail) : ui.selectedEmails.delete(input.dataset.selectEmail); renderShell(); }));
    $('[data-email-back]')?.addEventListener('click', () => { ui.selectedEmail = null; renderShell(); });
    $$('[data-email-action]').forEach(button => button.addEventListener('click', () => emailAction(button.dataset.emailAction, [ui.selectedEmail])));
    $$('[data-email-batch]').forEach(button => button.addEventListener('click', () => emailAction(button.dataset.emailBatch, [...ui.selectedEmails])));
  }

  function emailAction(action, ids) {
    ids.filter(Boolean).forEach(id => {
      const message = state.messages.find(item => item.id === id);
      if (!message) return;
      if (action === 'unread') message.unread = true;
      if (action === 'archive') message.folder = 'archive';
      if (action === 'trash') message.folder = 'trash';
    });
    ui.selectedEmail = null; ui.selectedEmails.clear(); saveState(); renderShell(); toast(action === 'unread' ? 'Message marked unread.' : action === 'archive' ? 'Message archived.' : 'Message moved to trash.', action === 'trash' ? 'warning' : 'success');
  }

  function openComposeForm() {
    openFormModal('Compose message', 'Write and save a message in the local workspace.', `<div class="field-grid">${field('To', 'to', '', { type: 'email', required: true, span: true })}${field('Subject', 'subject', '', { required: true, span: true, maxlength: 140 })}${field('Message', 'body', '', { textarea: true, required: true, span: true })}${field('Attachments', 'attachments', '', { type: 'file', span: true, multiple: true })}</div>`, form => {
      const values = formValues(form);
      const attachments = [...form.elements.attachments.files].map(file => file.name);
      state.messages.push({ id: uid(), folder: 'sent', from: 'Nischhal Subba', to: values.to, subject: values.subject, body: values.body, date: new Date().toISOString(), unread: false, starred: false, attachments });
      logActivity('email', 'Message sent', values.subject); saveState(); closeModal(); renderShell(); toast('Message sent.');
    }, [{ label: 'Save draft', tone: 'secondary', onClick: () => {
      const form = $('[data-modal-form]', modal);
      if (!validateForm(form, ['to', 'subject'])) return;
      const values = formValues(form);
      state.messages.push({ id: uid(), folder: 'drafts', from: 'Nischhal Subba', to: values.to, subject: values.subject, body: values.body || '', date: new Date().toISOString(), unread: false, starred: false, attachments: [] });
      saveState(); closeModal(); renderShell(); toast('Draft saved.');
    } }]);
  }

  function bindFiles() {
    $('[data-file-root]')?.addEventListener('click', () => { ui.fileFolder = null; renderShell(); });
    $$('[data-file-folder]').forEach(button => button.addEventListener('click', () => { ui.fileFolder = button.dataset.fileFolder; renderShell(); }));
    $$('[data-open-file]').forEach(button => button.addEventListener('click', async () => {
      const item = state.files.find(file => file.id === button.dataset.openFile);
      if (item?.kind === 'folder') { ui.fileFolder = item.id; renderShell(); }
      else if (item?.persisted) await downloadFile(item.id);
      else toast('This sample item has metadata only. Upload a real file to persist and download it.', 'warning');
    }));
    $$('[data-star-file]').forEach(button => button.addEventListener('click', () => { const item = state.files.find(file => file.id === button.dataset.starFile); item.starred = !item.starred; saveState(); renderShell(); }));
    $$('[data-rename-file]').forEach(button => button.addEventListener('click', () => openRenameFile(state.files.find(file => file.id === button.dataset.renameFile))));
    $$('[data-delete-file]').forEach(button => button.addEventListener('click', () => confirmDelete('file', button.dataset.deleteFile)));
    $$('[data-download-file]').forEach(button => button.addEventListener('click', () => downloadFile(button.dataset.downloadFile)));
    $('[data-create-folder]')?.addEventListener('click', openFolderForm);
    $('[data-file-upload]')?.addEventListener('change', uploadFiles);
  }

  async function uploadFiles(event) {
    const files = [...event.target.files];
    if (!files.length) return;
    for (const file of files) {
      const id = uid();
      await putFileBlob(id, file);
      state.files.push({ id, parentId: ui.fileFolder, name: file.name, kind: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'document', size: file.size, modified: new Date().toISOString(), starred: false, persisted: true });
    }
    logActivity('file', 'Files uploaded', `${files.length} file${files.length === 1 ? '' : 's'}`);
    saveState(); event.target.value = ''; renderShell(); toast(`${files.length} file${files.length === 1 ? '' : 's'} uploaded and stored in this browser.`);
  }

  function openFolderForm() {
    openFormModal('Create folder', 'Add a folder inside the current location.', `<div class="field-grid">${field('Folder name', 'name', '', { required: true, span: true, maxlength: 80 })}</div>`, form => {
      const name = form.elements.name.value.trim();
      state.files.push({ id: uid(), parentId: ui.fileFolder, name, kind: 'folder', size: 0, modified: new Date().toISOString(), starred: false, persisted: true });
      logActivity('file', 'Folder created', name); saveState(); closeModal(); renderShell(); toast('Folder created.');
    });
  }

  function openRenameFile(item) {
    if (!item) return;
    openFormModal('Rename item', `Rename ${item.name}.`, `<div class="field-grid">${field('Name', 'name', item.name, { required: true, span: true, maxlength: 120 })}</div>`, form => {
      item.name = form.elements.name.value.trim(); item.modified = new Date().toISOString(); saveState(); closeModal(); renderShell(); toast('Item renamed.');
    });
  }

  function openFileDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(FILE_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function putFileBlob(id, file) {
    const db = await openFileDb();
    await new Promise((resolve, reject) => { const transaction = db.transaction('files', 'readwrite'); transaction.objectStore('files').put(file, id); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
    db.close();
  }

  async function getFileBlob(id) {
    const db = await openFileDb();
    const result = await new Promise((resolve, reject) => { const request = db.transaction('files').objectStore('files').get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close(); return result;
  }

  async function deleteFileBlob(id) {
    const db = await openFileDb();
    await new Promise((resolve, reject) => { const transaction = db.transaction('files', 'readwrite'); transaction.objectStore('files').delete(id); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
    db.close();
  }

  async function clearFileBlobs() {
    const db = await openFileDb();
    await new Promise((resolve, reject) => { const transaction = db.transaction('files', 'readwrite'); transaction.objectStore('files').clear(); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
    db.close();
  }

  async function downloadFile(id) {
    const item = state.files.find(file => file.id === id);
    const blob = await getFileBlob(id);
    if (!blob) { toast('The uploaded file data is unavailable in this browser.', 'warning'); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = item?.name || 'download'; link.click(); URL.revokeObjectURL(url);
  }

  function bindInvoices() {
    $('[data-invoice-filter]')?.addEventListener('change', event => { ui.invoiceFilter = event.target.value; renderShell(); });
    $$('[data-view-invoice]').forEach(button => button.addEventListener('click', () => openInvoiceDetail(state.invoices.find(invoice => invoice.id === button.dataset.viewInvoice))));
    $$('[data-edit-invoice]').forEach(button => button.addEventListener('click', () => openInvoiceForm(state.invoices.find(invoice => invoice.id === button.dataset.editInvoice))));
    $$('[data-pay-invoice]').forEach(button => button.addEventListener('click', () => markInvoicePaid(button.dataset.payInvoice)));
    $$('[data-duplicate-invoice]').forEach(button => button.addEventListener('click', () => duplicateInvoice(button.dataset.duplicateInvoice)));
    $$('[data-delete-invoice]').forEach(button => button.addEventListener('click', () => confirmDelete('invoice', button.dataset.deleteInvoice)));
  }

  function openInvoiceDetail(invoice) {
    if (!invoice) return;
    openModal(`<div class="modal-card"><div class="modal-head"><div><p class="panel-kicker">Invoice details</p><h2 id="modal-title">${escapeHtml(invoice.number)}</h2><p>${escapeHtml(invoice.client)}</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div><div class="summary-grid"><div class="summary-card"><strong>${money(invoice.amount)}</strong><span>Amount · USD</span></div><div class="summary-card"><strong>${titleCase(invoice.status)}</strong><span>Status</span></div><div class="summary-card"><strong>${formatShortDate(invoice.dueDate)}</strong><span>Due date</span></div><div class="summary-card"><strong>${escapeHtml(invoice.email)}</strong><span>Billing contact</span></div></div><p>${escapeHtml(invoice.notes || 'No notes.')}</p><div class="modal-actions"><button class="button button-secondary" type="button" data-print-invoice>${icon('download', 16)}Print</button><button class="button button-primary" type="button" data-modal-edit-invoice>Edit invoice</button></div></div>`);
    $('[data-modal-edit-invoice]', modal)?.addEventListener('click', () => { closeModal(); openInvoiceForm(invoice); });
    $('[data-print-invoice]', modal)?.addEventListener('click', () => window.print());
  }

  function openInvoiceForm(invoice = null) {
    const data = invoice || { number: `FC-${1000 + state.invoices.length + 1}`, client: '', email: '', amount: '', status: 'draft', dueDate: dateKey(addDays(14)), notes: '' };
    openFormModal(invoice ? 'Edit invoice' : 'Create invoice', 'Add billing details and a clear due date.', `<div class="field-grid">${field('Invoice number', 'number', data.number, { required: true, maxlength: 30 })}${selectField('Status', 'status', ['draft', 'sent', 'paid', 'overdue', 'void'], data.status)}${field('Client', 'client', data.client, { required: true })}${field('Email', 'email', data.email, { type: 'email', required: true })}${field('Amount', 'amount', data.amount, { type: 'number', required: true, min: 0, step: '.01' })}${field('Due date', 'dueDate', data.dueDate, { type: 'date', required: true })}${field('Notes', 'notes', data.notes, { textarea: true, span: true, maxlength: 400 })}</div>`, form => {
      const values = formValues(form);
      if (invoice) Object.assign(invoice, values, { amount: Number(values.amount) }); else state.invoices.push({ ...values, id: uid(), amount: Number(values.amount) });
      logActivity('invoice', invoice ? 'Invoice updated' : 'Invoice created', values.number); saveState(); closeModal(); renderShell(); toast(invoice ? 'Invoice updated.' : 'Invoice created.');
    });
  }

  function markInvoicePaid(id) {
    const invoice = state.invoices.find(item => item.id === id);
    if (!invoice) return;
    invoice.status = 'paid'; logActivity('invoice', 'Invoice paid', invoice.number); saveState(); renderShell(); toast('Invoice marked as paid.');
  }

  function duplicateInvoice(id) {
    const invoice = state.invoices.find(item => item.id === id);
    if (!invoice) return;
    state.invoices.push({ ...invoice, id: uid(), number: `${invoice.number}-COPY`, status: 'draft' });
    saveState(); renderShell(); toast('Invoice duplicated.');
  }

  function bindSettings() {
    $$('[data-settings-tab]').forEach(button => button.addEventListener('click', () => { ui.settingsTab = button.dataset.settingsTab; renderShell(); }));
    $('[data-settings-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      if (!validateForm(event.currentTarget)) return;
      Object.assign(state.settings, formValues(event.currentTarget));
      saveState(); renderShell(); toast('Workspace settings saved.');
    });
    $$('[data-theme-option]').forEach(button => button.addEventListener('click', () => { state.settings.theme = button.dataset.themeOption; saveState(); applyTheme(); renderShell(); toast('Theme preference saved.'); }));
    $('[data-notification-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      state.settings.notifications = { taskReminders: data.has('taskReminders'), projectUpdates: data.has('projectUpdates'), weeklySummary: data.has('weeklySummary') };
      saveState(); toast('Notification preferences saved.');
    });
    $('[data-reset-data]')?.addEventListener('click', () => confirmAction('Reset workspace?', 'This removes all local changes and uploaded file data. This cannot be undone.', async () => { await clearFileBlobs(); state = seedState(); saveState(); applyTheme(); renderShell(); toast('Workspace reset.', 'warning'); }));
  }

  function confirmDelete(type, id) {
    const record = type === 'project' ? projectById(id) : type === 'task' ? state.tasks.find(item => item.id === id) : type === 'member' ? state.team.find(item => item.id === id) : type === 'file' ? state.files.find(item => item.id === id) : state.invoices.find(item => item.id === id);
    const label = record?.name || record?.title || record?.number || 'this item';
    confirmAction(`Delete ${type}?`, `Delete ${label}? This action cannot be undone.`, async () => {
      if (type === 'project') { state.projects = state.projects.filter(item => item.id !== id); state.tasks = state.tasks.filter(task => task.projectId !== id); }
      if (type === 'task') state.tasks = state.tasks.filter(item => item.id !== id);
      if (type === 'member') state.team = state.team.filter(item => item.id !== id);
      if (type === 'invoice') state.invoices = state.invoices.filter(item => item.id !== id);
      if (type === 'file') {
        const descendants = new Set([id]);
        let changed = true;
        while (changed) { changed = false; state.files.forEach(item => { if (descendants.has(item.parentId) && !descendants.has(item.id)) { descendants.add(item.id); changed = true; } }); }
        for (const fileId of descendants) await deleteFileBlob(fileId).catch(() => {});
        state.files = state.files.filter(item => !descendants.has(item.id));
        if (descendants.has(ui.fileFolder)) ui.fileFolder = null;
      }
      logActivity(type, `${titleCase(type)} deleted`, label); saveState(); renderShell(); toast(`${titleCase(type)} deleted.`, 'warning');
    });
  }

  function confirmAction(title, copy, action) {
    openModal(`<div class="modal-card"><div class="modal-head"><div><p class="panel-kicker">Confirm action</p><h2 id="modal-title">${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div><div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-danger" type="button" data-confirm-action>Confirm</button></div></div>`);
    $('[data-confirm-action]', modal)?.addEventListener('click', async () => { closeModal(); await action(); });
  }

  function field(label, name, value, options = {}) {
    const attrs = [`name="${name}"`, options.type ? `type="${options.type}"` : '', options.required ? 'required' : '', options.maxlength ? `maxlength="${options.maxlength}"` : '', options.min !== undefined ? `min="${options.min}"` : '', options.max !== undefined ? `max="${options.max}"` : '', options.step ? `step="${options.step}"` : '', options.multiple ? 'multiple' : ''].filter(Boolean).join(' ');
    const control = options.textarea ? `<textarea ${attrs}>${escapeHtml(value)}</textarea>` : `<input ${attrs} value="${options.type === 'file' ? '' : escapeHtml(value)}">`;
    return `<label class="field ${options.span ? 'span-2' : ''}">${escapeHtml(label)}${control}<span class="field-error" data-error-for="${name}"></span></label>`;
  }

  function selectField(label, name, options, selected) { return customSelectField(label, name, options.map(option => [option, titleCase(option)]), selected); }
  function customSelectField(label, name, options, selected) { return `<label class="field">${escapeHtml(label)}<select name="${name}">${options.map(([value, copy]) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(copy)}</option>`).join('')}</select><span class="field-error" data-error-for="${name}"></span></label>`; }

  function openFormModal(title, copy, fields, onSubmit, extraActions = []) {
    openModal(`<form class="modal-card" data-modal-form novalidate><div class="modal-head"><div><h2 id="modal-title">${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div>${fields}<div class="modal-actions">${extraActions.map((action, index) => `<button class="button button-${action.tone || 'secondary'}" type="button" data-extra-action="${index}">${escapeHtml(action.label)}</button>`).join('')}<button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Save</button></div></form>`);
    const form = $('[data-modal-form]', modal);
    form.addEventListener('submit', event => { event.preventDefault(); if (!validateForm(form)) return; onSubmit(form); });
    extraActions.forEach((action, index) => $(`[data-extra-action="${index}"]`, modal)?.addEventListener('click', action.onClick));
  }

  function validateForm(form, requiredNames = null) {
    let valid = true;
    $$('[data-error-for]', form).forEach(error => { error.textContent = ''; });
    [...form.elements].filter(element => element.name && (!requiredNames || requiredNames.includes(element.name))).forEach(element => {
      element.removeAttribute('aria-invalid');
      let message = '';
      if ((element.required || requiredNames?.includes(element.name)) && !String(element.value).trim()) message = 'This field is required.';
      else if (element.type === 'email' && element.value && !/^\S+@\S+\.\S+$/.test(element.value)) message = 'Enter a valid email address.';
      else if (element.type === 'number' && element.value !== '' && element.min !== '' && Number(element.value) < Number(element.min)) message = `Enter ${element.min} or more.`;
      else if (element.type === 'number' && element.value !== '' && element.max !== '' && Number(element.value) > Number(element.max)) message = `Enter ${element.max} or less.`;
      if (message) { valid = false; element.setAttribute('aria-invalid', 'true'); const error = $(`[data-error-for="${element.name}"]`, form); if (error) error.textContent = message; }
    });
    if (!valid) form.querySelector('[aria-invalid="true"]')?.focus();
    return valid;
  }

  function formValues(form) {
    const result = {};
    new FormData(form).forEach((value, key) => { if (!(value instanceof File)) result[key] = String(value).trim(); });
    return result;
  }

  function openModal(markup) {
    modalContent.innerHTML = markup;
    modal.showModal();
    $$('[data-close-modal]', modal).forEach(button => button.addEventListener('click', closeModal));
  }
  function closeModal() { if (modal.open) modal.close(); modalContent.innerHTML = ''; }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'formcraft-workspace-data.json'; link.click(); URL.revokeObjectURL(url); toast('Workspace data exported.');
  }

  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('[data-page-search]')?.focus(); }
    if (event.key === 'Escape') { closeDrawer(); $('[data-notifications-popover]')?.setAttribute('hidden', ''); $('[data-account-popover]')?.setAttribute('hidden', ''); }
  });
  window.addEventListener('popstate', () => { ui.route = location.hash.slice(1) || 'dashboard'; ui.query = ''; renderShell(); });
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });

  applyTheme();
  ui.route = routes[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard';
  renderShell();
