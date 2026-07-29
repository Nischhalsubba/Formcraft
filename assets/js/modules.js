(() => {
  'use strict';

  const KEY = 'formcraft-operations-v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const clean = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const formatDate = value => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);

  function seed() {
    return {
      events: [
        { id: uid(), title: 'Formcraft design review', date: '2026-07-29', time: '10:00', category: 'review', notes: 'Review the operations module direction.' },
        { id: uid(), title: 'Invoice workflow deadline', date: '2026-07-31', time: '16:00', category: 'deadline', notes: 'Complete the invoice CRUD foundation.' },
        { id: uid(), title: 'Team planning', date: '2026-08-03', time: '09:30', category: 'meeting', notes: 'Plan the next feature-parity slice.' }
      ],
      messages: [
        { id: uid(), folder: 'inbox', from: 'Maya Thapa', to: 'owner@formcraft.local', subject: 'Review notes for Formcraft', body: 'I added review notes for the dashboard navigation and the calendar workflow. The new palette is working well.', date: '2026-07-29T08:40:00', unread: true, starred: true, attachments: [] },
        { id: uid(), folder: 'inbox', from: 'Aarav Sharma', to: 'owner@formcraft.local', subject: 'Operations module progress', body: 'Calendar and invoice data structures are ready for implementation. I also listed the remaining validation states.', date: '2026-07-28T16:15:00', unread: false, starred: false, attachments: ['module-notes.pdf'] },
        { id: uid(), folder: 'sent', from: 'Nischhal Subba', to: 'team@formcraft.local', subject: 'Formcraft feature parity plan', body: 'The source dashboard has been audited. We will rebuild each feature with original Formcraft components and explicit functionality.', date: '2026-07-28T11:20:00', unread: false, starred: false, attachments: [] },
        { id: uid(), folder: 'drafts', from: 'Nischhal Subba', to: 'client@example.com', subject: 'Invoice workflow update', body: 'Draft update for the invoice module.', date: '2026-07-27T14:00:00', unread: false, starred: false, attachments: [] }
      ],
      files: [
        { id: uid(), parentId: null, name: 'Design system', kind: 'folder', size: 0, modified: '2026-07-29T08:00:00', starred: true },
        { id: uid(), parentId: null, name: 'Invoices', kind: 'folder', size: 0, modified: '2026-07-28T15:30:00', starred: false },
        { id: uid(), parentId: null, name: 'feature-parity.md', kind: 'document', size: 18420, modified: '2026-07-29T09:10:00', starred: true },
        { id: uid(), parentId: null, name: 'dashboard-preview.png', kind: 'image', size: 485220, modified: '2026-07-28T12:45:00', starred: false }
      ],
      invoices: [
        { id: uid(), number: 'FC-1004', client: 'MAS DataHub', email: 'billing@masdatahub.test', amount: 2400, status: 'sent', dueDate: '2026-08-10', notes: 'Product design sprint and dashboard review.' },
        { id: uid(), number: 'FC-1003', client: 'Morajaa', email: 'accounts@morajaa.test', amount: 1650, status: 'paid', dueDate: '2026-07-25', notes: 'Mobile product design engagement.' },
        { id: uid(), number: 'FC-1002', client: 'Yarsha', email: 'finance@yarsha.test', amount: 980, status: 'overdue', dueDate: '2026-07-20', notes: 'Interface architecture consultation.' },
        { id: uid(), number: 'FC-1001', client: 'Internal', email: 'owner@formcraft.local', amount: 720, status: 'draft', dueDate: '2026-08-18', notes: 'Formcraft internal build record.' }
      ]
    };
  }

  let state;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    state = stored && typeof stored === 'object' ? { ...seed(), ...stored } : seed();
  } catch {
    state = seed();
  }

  let currentMonth = new Date(2026, 6, 1);
  let emailFolder = 'inbox';
  let emailQuery = '';
  let selectedMessageId = null;
  let currentFolderId = null;
  let fileQuery = '';
  let invoiceFilter = 'all';
  let invoiceQuery = '';

  const save = () => localStorage.setItem(KEY, JSON.stringify(state));

  function toast(message, tone = 'success') {
    const region = $('[data-toast-region]');
    if (!region) return;
    const node = document.createElement('div');
    node.className = 'toast';
    const icon = tone === 'danger' ? '!' : tone === 'warning' ? '△' : '✓';
    node.innerHTML = `<span class="toast-icon">${icon}</span><p>${clean(message)}</p><button aria-label="Dismiss">×</button>`;
    node.querySelector('button').addEventListener('click', () => node.remove());
    region.append(node);
    window.setTimeout(() => node.remove(), 3200);
  }

  function injectShell() {
    const systemLabel = $$('.nav-label').find(label => label.textContent.trim() === 'System');
    if (!systemLabel) return;

    const fragment = document.createDocumentFragment();
    const label = document.createElement('p');
    label.className = 'nav-label';
    label.textContent = 'Operations';
    fragment.append(label);

    [
      ['calendar', '□', 'Calendar'],
      ['email', '✉', 'Email'],
      ['files', '▤', 'File manager'],
      ['invoices', '▧', 'Invoices']
    ].forEach(([route, icon, name]) => {
      const link = document.createElement('a');
      link.className = 'nav-item';
      link.href = `#${route}`;
      link.dataset.moduleRoute = route;
      link.innerHTML = `<span class="nav-icon" aria-hidden="true">${icon}</span><span>${name}</span>`;
      fragment.append(link);
    });
    systemLabel.before(fragment);

    const main = $('#main-content');
    main.insertAdjacentHTML('beforeend', pagesMarkup());
    document.body.insertAdjacentHTML('beforeend', dialogsMarkup());
  }

  function pagesMarkup() {
    return `
      <section class="page" data-page="calendar">
        <div class="module-toolbar">
          <div class="module-toolbar-group">
            <button class="icon-button" type="button" data-calendar-prev aria-label="Previous month">‹</button>
            <button class="button button-secondary" type="button" data-calendar-today>Today</button>
            <button class="icon-button" type="button" data-calendar-next aria-label="Next month">›</button>
            <strong data-calendar-title></strong>
          </div>
          <button class="button button-primary" type="button" data-create-event>+ New event</button>
        </div>
        <div class="calendar-shell">
          <div class="calendar-head"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
          <div class="calendar-grid" data-calendar-grid></div>
        </div>
      </section>

      <section class="page" data-page="email">
        <div class="module-toolbar">
          <div class="module-toolbar-group"><input class="module-search" type="search" placeholder="Search mail" data-email-search></div>
          <button class="button button-primary" type="button" data-compose-email>+ Compose</button>
        </div>
        <div class="module-layout">
          <aside class="module-sidebar"><div class="module-menu" data-email-folders></div></aside>
          <section class="module-content" data-email-content></section>
        </div>
      </section>

      <section class="page" data-page="files">
        <div class="module-toolbar">
          <div class="module-toolbar-group">
            <div class="file-breadcrumbs" data-file-breadcrumbs></div>
            <input class="module-search" type="search" placeholder="Search files" data-file-search>
          </div>
          <div class="module-toolbar-group">
            <button class="button button-secondary" type="button" data-create-folder>+ Folder</button>
            <button class="button button-primary" type="button" data-upload-file>Upload files</button>
            <input type="file" multiple hidden data-file-input>
          </div>
        </div>
        <div class="file-summary" data-file-summary></div>
        <section class="module-content"><div class="file-grid" data-file-grid></div><div class="module-empty" data-file-empty hidden><strong>No files found</strong>Try another folder or search term.</div></section>
      </section>

      <section class="page" data-page="invoices">
        <div class="module-toolbar">
          <div class="module-toolbar-group">
            <input class="module-search" type="search" placeholder="Search invoices" data-invoice-search>
            <select class="select-control" data-invoice-filter><option value="all">All statuses</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="void">Void</option></select>
          </div>
          <button class="button button-primary" type="button" data-create-invoice>+ New invoice</button>
        </div>
        <div class="invoice-kpis" data-invoice-kpis></div>
        <section class="panel table-panel"><div class="table-wrap"><table class="invoice-table"><thead><tr><th>Invoice</th><th>Client</th><th>Status</th><th>Due</th><th style="text-align:right">Amount</th><th></th></tr></thead><tbody data-invoice-table></tbody></table></div></section>
      </section>`;
  }

  function dialogsMarkup() {
    return `
      <dialog class="modal" data-event-dialog>
        <form method="dialog" data-event-form>
          <div class="modal-head"><div><p class="panel-kicker">Calendar event</p><h2 data-event-title>New event</h2></div><button class="icon-button" value="cancel" aria-label="Close">×</button></div>
          <input type="hidden" name="id">
          <div class="form-grid"><label class="span-2">Title<input name="title" required maxlength="100"></label><label>Date<input type="date" name="date" required></label><label>Time<input type="time" name="time"></label><label>Category<select name="category"><option value="meeting">Meeting</option><option value="review">Review</option><option value="deadline">Deadline</option><option value="personal">Personal</option></select></label><label class="span-2">Notes<textarea name="notes" rows="3" maxlength="300"></textarea></label></div>
          <div class="modal-actions"><button class="button button-danger" type="button" data-delete-event hidden>Delete</button><button class="button button-secondary" value="cancel">Cancel</button><button class="button button-primary" type="submit" value="default">Save event</button></div>
        </form>
      </dialog>

      <dialog class="modal" data-compose-dialog>
        <form method="dialog" data-compose-form>
          <div class="modal-head"><div><p class="panel-kicker">Email</p><h2>Compose message</h2></div><button class="icon-button" value="cancel" aria-label="Close">×</button></div>
          <div class="form-grid"><label class="span-2">To<input type="email" name="to" required></label><label class="span-2">Subject<input name="subject" required maxlength="140"></label><label class="span-2">Message<textarea name="body" rows="8" required></textarea></label><label class="span-2">Attachments<input type="file" name="attachments" multiple></label></div>
          <div class="modal-actions"><button class="button button-secondary" type="button" data-save-draft>Save draft</button><button class="button button-secondary" value="cancel">Cancel</button><button class="button button-primary" type="submit" value="default">Send message</button></div>
        </form>
      </dialog>

      <dialog class="modal" data-invoice-dialog>
        <form method="dialog" data-invoice-form>
          <div class="modal-head"><div><p class="panel-kicker">Invoice</p><h2 data-invoice-title>New invoice</h2></div><button class="icon-button" value="cancel" aria-label="Close">×</button></div>
          <input type="hidden" name="id">
          <div class="form-grid"><label>Invoice number<input name="number" required maxlength="30"></label><label>Status<select name="status"><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="void">Void</option></select></label><label>Client<input name="client" required maxlength="100"></label><label>Email<input type="email" name="email" required></label><label>Amount<input type="number" name="amount" min="0" step="0.01" required></label><label>Due date<input type="date" name="dueDate" required></label><label class="span-2">Notes<textarea name="notes" rows="3" maxlength="400"></textarea></label></div>
          <div class="modal-actions"><button class="button button-secondary" value="cancel">Cancel</button><button class="button button-primary" type="submit" value="default">Save invoice</button></div>
        </form>
      </dialog>

      <dialog class="modal" data-invoice-detail-dialog><div class="invoice-detail" data-invoice-detail></div></dialog>`;
  }

  const moduleRoutes = {
    calendar: ['Calendar', 'Schedule and events'],
    email: ['Email', 'Mailbox'],
    files: ['File manager', 'Files and folders'],
    invoices: ['Invoices', 'Billing and payments']
  };

  function navigate(route) {
    if (!moduleRoutes[route]) return;
    $$('.page').forEach(page => page.classList.toggle('is-active', page.dataset.page === route));
    $$('.nav-item').forEach(item => item.classList.toggle('is-active', item.dataset.moduleRoute === route));
    $('[data-page-label]').textContent = moduleRoutes[route][0];
    $('[data-page-title]').textContent = moduleRoutes[route][1];
    history.replaceState(null, '', `#${route}`);
    document.body.classList.remove('sidebar-open');
    renderRoute(route);
  }

  function renderRoute(route) {
    if (route === 'calendar') renderCalendar();
    if (route === 'email') renderEmail();
    if (route === 'files') renderFiles();
    if (route === 'invoices') renderInvoices();
  }

  function openEvent(event = null, presetDate = null) {
    const form = $('[data-event-form]');
    form.reset();
    form.elements.id.value = event?.id || '';
    form.elements.title.value = event?.title || '';
    form.elements.date.value = event?.date || presetDate || dateKey(new Date());
    form.elements.time.value = event?.time || '09:00';
    form.elements.category.value = event?.category || 'meeting';
    form.elements.notes.value = event?.notes || '';
    $('[data-event-title]').textContent = event ? 'Edit event' : 'New event';
    $('[data-delete-event]').hidden = !event;
    $('[data-event-dialog]').showModal();
  }

  function renderCalendar() {
    const title = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentMonth);
    $('[data-calendar-title]').textContent = title;
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const start = new Date(year, month, 1 - new Date(year, month, 1).getDay());
    const today = dateKey(new Date(2026, 6, 29));
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const key = dateKey(day);
      const events = state.events.filter(event => event.date === key).sort((a, b) => a.time.localeCompare(b.time));
      cells.push(`<div class="calendar-day ${day.getMonth() !== month ? 'is-outside' : ''} ${key === today ? 'is-today' : ''}"><button class="calendar-day-number" type="button" data-new-event-date="${key}">${day.getDate()}</button>${events.map(event => `<button class="calendar-event" type="button" data-event-id="${event.id}" data-category="${clean(event.category)}">${clean(event.time || '')} ${clean(event.title)}</button>`).join('')}</div>`);
    }
    $('[data-calendar-grid]').innerHTML = cells.join('');
    $$('[data-new-event-date]').forEach(button => button.addEventListener('click', () => openEvent(null, button.dataset.newEventDate)));
    $$('[data-event-id]').forEach(button => button.addEventListener('click', () => openEvent(state.events.find(event => event.id === button.dataset.eventId))));
  }

  const folderLabels = { inbox: 'Inbox', sent: 'Sent', drafts: 'Drafts', starred: 'Starred', archive: 'Archive', trash: 'Trash' };

  function folderMessages(folder) {
    if (folder === 'starred') return state.messages.filter(message => message.starred && message.folder !== 'trash');
    return state.messages.filter(message => message.folder === folder);
  }

  function renderEmailFolders() {
    $('[data-email-folders]').innerHTML = Object.entries(folderLabels).map(([key, label]) => {
      const count = folderMessages(key).length;
      return `<button type="button" class="${emailFolder === key ? 'is-active' : ''}" data-email-folder="${key}"><span>${label}</span><small>${count}</small></button>`;
    }).join('');
    $$('[data-email-folder]').forEach(button => button.addEventListener('click', () => {
      emailFolder = button.dataset.emailFolder;
      selectedMessageId = null;
      renderEmail();
    }));
  }

  function renderEmail() {
    renderEmailFolders();
    const content = $('[data-email-content]');
    const selected = state.messages.find(message => message.id === selectedMessageId);
    if (selected) {
      content.innerHTML = `<article class="email-reader"><div class="email-reader-head"><div><button class="text-button" type="button" data-email-back>← Back</button><h3>${clean(selected.subject)}</h3><div class="email-reader-meta">From ${clean(selected.from)} · To ${clean(selected.to)} · ${new Date(selected.date).toLocaleString()}</div></div><div class="module-toolbar-group"><button class="button button-secondary" type="button" data-email-unread>Mark unread</button><button class="button button-secondary" type="button" data-email-archive>Archive</button><button class="button button-danger" type="button" data-email-trash>Trash</button></div></div><div class="email-reader-body">${clean(selected.body)}</div>${selected.attachments?.length ? `<p class="email-reader-meta">Attachments: ${selected.attachments.map(clean).join(', ')}</p>` : ''}</article>`;
      $('[data-email-back]').onclick = () => { selectedMessageId = null; renderEmail(); };
      $('[data-email-unread]').onclick = () => { selected.unread = true; selectedMessageId = null; save(); renderEmail(); toast('Message marked unread.'); };
      $('[data-email-archive]').onclick = () => { selected.folder = 'archive'; selectedMessageId = null; save(); renderEmail(); toast('Message archived.'); };
      $('[data-email-trash]').onclick = () => { selected.folder = 'trash'; selectedMessageId = null; save(); renderEmail(); toast('Message moved to trash.', 'warning'); };
      return;
    }

    const messages = folderMessages(emailFolder).filter(message => `${message.from} ${message.to} ${message.subject} ${message.body}`.toLowerCase().includes(emailQuery));
    content.innerHTML = messages.length ? `<div class="email-list">${messages.map(message => `<article class="email-row ${message.unread ? 'is-unread' : ''}" data-message-id="${message.id}"><input type="checkbox" aria-label="Select message"><button class="email-star ${message.starred ? 'is-starred' : ''}" type="button" data-star-message="${message.id}" aria-label="Toggle starred">★</button><span>${clean(emailFolder === 'sent' || emailFolder === 'drafts' ? message.to : message.from)}</span><span class="email-subject">${clean(message.subject)} <span>— ${clean(message.body.slice(0, 70))}</span></span><time>${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(message.date))}</time><span>${message.attachments?.length ? '⌕' : ''}</span></article>`).join('')}</div>` : '<div class="module-empty"><strong>No messages</strong>This folder has no matching messages.</div>';
    $$('[data-message-id]').forEach(row => row.addEventListener('click', event => {
      if (event.target.closest('button,input')) return;
      const message = state.messages.find(item => item.id === row.dataset.messageId);
      message.unread = false;
      selectedMessageId = message.id;
      save();
      renderEmail();
    }));
    $$('[data-star-message]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      const message = state.messages.find(item => item.id === button.dataset.starMessage);
      message.starred = !message.starred;
      save();
      renderEmail();
    }));
  }

  function fileIcon(item) {
    if (item.kind === 'folder') return '▰';
    if (item.kind === 'image') return '▧';
    if (item.kind === 'pdf') return 'PDF';
    return 'DOC';
  }

  function humanSize(size) {
    if (!size) return 'Folder';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderFiles() {
    const children = state.files.filter(item => item.parentId === currentFolderId && item.name.toLowerCase().includes(fileQuery));
    const allFiles = state.files.filter(item => item.kind !== 'folder');
    $('[data-file-summary]').innerHTML = [
      ['Items', state.files.length],
      ['Folders', state.files.filter(item => item.kind === 'folder').length],
      ['Files', allFiles.length],
      ['Storage', humanSize(allFiles.reduce((sum, item) => sum + item.size, 0))]
    ].map(([label, value]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join('');

    const current = state.files.find(item => item.id === currentFolderId);
    $('[data-file-breadcrumbs]').innerHTML = `<button type="button" data-folder-root>Files</button>${current ? `<span>/</span><strong>${clean(current.name)}</strong>` : ''}`;
    $('[data-folder-root]').onclick = () => { currentFolderId = null; renderFiles(); };

    $('[data-file-grid]').innerHTML = children.map(item => `<article class="file-card" data-file-open="${item.id}"><div class="file-actions"><button class="action-button" type="button" data-file-star="${item.id}" aria-label="Star">${item.starred ? '★' : '☆'}</button><button class="action-button" type="button" data-file-rename="${item.id}" aria-label="Rename">✎</button><button class="action-button" type="button" data-file-delete="${item.id}" aria-label="Delete">⌫</button></div><div class="file-icon">${fileIcon(item)}</div><h3>${clean(item.name)}</h3><p>${humanSize(item.size)} · ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(item.modified))}</p></article>`).join('');
    $('[data-file-empty]').hidden = children.length > 0;

    $$('[data-file-open]').forEach(card => card.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      const item = state.files.find(entry => entry.id === card.dataset.fileOpen);
      if (item?.kind === 'folder') { currentFolderId = item.id; renderFiles(); }
      else toast(`Selected ${item?.name || 'file'}.`);
    }));
    $$('[data-file-star]').forEach(button => button.addEventListener('click', () => {
      const item = state.files.find(entry => entry.id === button.dataset.fileStar);
      item.starred = !item.starred;
      save(); renderFiles();
    }));
    $$('[data-file-rename]').forEach(button => button.addEventListener('click', () => {
      const item = state.files.find(entry => entry.id === button.dataset.fileRename);
      const name = window.prompt('Rename item', item.name)?.trim();
      if (!name) return;
      item.name = name; item.modified = new Date().toISOString(); save(); renderFiles(); toast('Item renamed.');
    }));
    $$('[data-file-delete]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.fileDelete;
      const item = state.files.find(entry => entry.id === id);
      if (!window.confirm(`Delete ${item?.name || 'this item'}?`)) return;
      const descendants = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        state.files.forEach(entry => { if (descendants.has(entry.parentId) && !descendants.has(entry.id)) { descendants.add(entry.id); changed = true; } });
      }
      state.files = state.files.filter(entry => !descendants.has(entry.id));
      save(); renderFiles(); toast('Item deleted.', 'warning');
    }));
  }

  const invoiceStatus = status => `<span class="status-pill status-${status === 'paid' ? 'success' : status === 'overdue' ? 'review' : status}">${clean(status)}</span>`;

  function renderInvoices() {
    const items = state.invoices.filter(invoice => (invoiceFilter === 'all' || invoice.status === invoiceFilter) && `${invoice.number} ${invoice.client} ${invoice.email}`.toLowerCase().includes(invoiceQuery));
    const total = state.invoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const paid = state.invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const outstanding = state.invoices.filter(invoice => ['sent', 'overdue'].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    $('[data-invoice-kpis]').innerHTML = [['Total billed', money(total)], ['Paid', money(paid)], ['Outstanding', money(outstanding)], ['Invoices', state.invoices.length]].map(([label, value]) => `<article class="invoice-summary-card"><span>${label}</span><strong>${value}</strong></article>`).join('');
    $('[data-invoice-table]').innerHTML = items.length ? items.map(invoice => `<tr><td><button class="text-button invoice-number" type="button" data-view-invoice="${invoice.id}">${clean(invoice.number)}</button></td><td><strong>${clean(invoice.client)}</strong><small>${clean(invoice.email)}</small></td><td>${invoiceStatus(invoice.status)}</td><td>${formatDate(invoice.dueDate)}</td><td class="invoice-amount">${money(invoice.amount)}</td><td><div class="table-actions"><button class="action-button" type="button" data-edit-invoice="${invoice.id}" aria-label="Edit">✎</button><button class="action-button" type="button" data-paid-invoice="${invoice.id}" aria-label="Mark paid">✓</button><button class="action-button" type="button" data-duplicate-invoice="${invoice.id}" aria-label="Duplicate">⧉</button><button class="action-button" type="button" data-delete-invoice="${invoice.id}" aria-label="Delete">⌫</button></div></td></tr>`).join('') : '<tr><td colspan="6"><div class="module-empty"><strong>No invoices</strong>Create an invoice or change the filter.</div></td></tr>';

    $$('[data-view-invoice]').forEach(button => button.onclick = () => openInvoiceDetail(state.invoices.find(invoice => invoice.id === button.dataset.viewInvoice)));
    $$('[data-edit-invoice]').forEach(button => button.onclick = () => openInvoice(state.invoices.find(invoice => invoice.id === button.dataset.editInvoice)));
    $$('[data-paid-invoice]').forEach(button => button.onclick = () => {
      const invoice = state.invoices.find(item => item.id === button.dataset.paidInvoice);
      invoice.status = 'paid'; save(); renderInvoices(); toast('Invoice marked paid.');
    });
    $$('[data-duplicate-invoice]').forEach(button => button.onclick = () => {
      const source = state.invoices.find(item => item.id === button.dataset.duplicateInvoice);
      const copy = { ...source, id: uid(), number: nextInvoiceNumber(), status: 'draft' };
      state.invoices.unshift(copy); save(); renderInvoices(); toast('Invoice duplicated.');
    });
    $$('[data-delete-invoice]').forEach(button => button.onclick = () => {
      const invoice = state.invoices.find(item => item.id === button.dataset.deleteInvoice);
      if (!window.confirm(`Delete invoice ${invoice.number}?`)) return;
      state.invoices = state.invoices.filter(item => item.id !== invoice.id); save(); renderInvoices(); toast('Invoice deleted.', 'warning');
    });
  }

  function nextInvoiceNumber() {
    const max = state.invoices.reduce((value, invoice) => Math.max(value, Number(invoice.number.replace(/\D/g, '')) || 0), 1000);
    return `FC-${max + 1}`;
  }

  function openInvoice(invoice = null) {
    const form = $('[data-invoice-form]');
    form.reset();
    form.elements.id.value = invoice?.id || '';
    form.elements.number.value = invoice?.number || nextInvoiceNumber();
    form.elements.status.value = invoice?.status || 'draft';
    form.elements.client.value = invoice?.client || '';
    form.elements.email.value = invoice?.email || '';
    form.elements.amount.value = invoice?.amount || '';
    form.elements.dueDate.value = invoice?.dueDate || '2026-08-15';
    form.elements.notes.value = invoice?.notes || '';
    $('[data-invoice-title]').textContent = invoice ? 'Edit invoice' : 'New invoice';
    $('[data-invoice-dialog]').showModal();
  }

  function openInvoiceDetail(invoice) {
    if (!invoice) return;
    $('[data-invoice-detail]').innerHTML = `<div class="invoice-detail-head"><div><p class="panel-kicker">Invoice</p><h2>${clean(invoice.number)}</h2>${invoiceStatus(invoice.status)}</div><button class="icon-button" type="button" data-close-invoice-detail aria-label="Close">×</button></div><div class="invoice-detail-grid"><div class="invoice-detail-block"><small>Bill to</small><h3>${clean(invoice.client)}</h3><p>${clean(invoice.email)}</p></div><div class="invoice-detail-block"><small>Amount due</small><h3>${money(invoice.amount)}</h3><p>Due ${formatDate(invoice.dueDate)}</p></div></div><div class="invoice-detail-block"><small>Notes</small><p>${clean(invoice.notes || 'No notes.')}</p></div><div class="modal-actions"><button class="button button-secondary" type="button" data-print-invoice>Print</button><button class="button button-primary" type="button" data-edit-detail-invoice>Edit invoice</button></div>`;
    $('[data-close-invoice-detail]').onclick = () => $('[data-invoice-detail-dialog]').close();
    $('[data-print-invoice]').onclick = () => window.print();
    $('[data-edit-detail-invoice]').onclick = () => { $('[data-invoice-detail-dialog]').close(); openInvoice(invoice); };
    $('[data-invoice-detail-dialog]').showModal();
  }

  function bind() {
    $$('[data-module-route]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); navigate(link.dataset.moduleRoute); }));

    $('[data-calendar-prev]').onclick = () => { currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1); renderCalendar(); };
    $('[data-calendar-next]').onclick = () => { currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1); renderCalendar(); };
    $('[data-calendar-today]').onclick = () => { currentMonth = new Date(2026, 6, 1); renderCalendar(); };
    $('[data-create-event]').onclick = () => openEvent();
    $('[data-event-form]').onsubmit = event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const existing = state.events.find(item => item.id === data.id);
      if (existing) Object.assign(existing, data);
      else state.events.push({ ...data, id: uid() });
      save(); $('[data-event-dialog]').close(); renderCalendar(); toast(existing ? 'Event updated.' : 'Event created.');
    };
    $('[data-delete-event]').onclick = () => {
      const id = $('[data-event-form]').elements.id.value;
      state.events = state.events.filter(event => event.id !== id);
      save(); $('[data-event-dialog]').close(); renderCalendar(); toast('Event deleted.', 'warning');
    };

    $('[data-email-search]').oninput = event => { emailQuery = event.target.value.trim().toLowerCase(); selectedMessageId = null; renderEmail(); };
    $('[data-compose-email]').onclick = () => { $('[data-compose-form]').reset(); $('[data-compose-dialog]').showModal(); };
    $('[data-compose-form]').onsubmit = event => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form));
      data.attachments = [...form.elements.attachments.files].map(file => file.name);
      state.messages.unshift({ ...data, id: uid(), folder: 'sent', from: 'Nischhal Subba', date: new Date().toISOString(), unread: false, starred: false });
      save(); $('[data-compose-dialog]').close(); emailFolder = 'sent'; renderEmail(); toast('Message sent.');
    };
    $('[data-save-draft]').onclick = () => {
      const form = $('[data-compose-form]');
      const data = Object.fromEntries(new FormData(form));
      data.attachments = [...form.elements.attachments.files].map(file => file.name);
      state.messages.unshift({ ...data, id: uid(), folder: 'drafts', from: 'Nischhal Subba', date: new Date().toISOString(), unread: false, starred: false });
      save(); $('[data-compose-dialog]').close(); emailFolder = 'drafts'; renderEmail(); toast('Draft saved.');
    };

    $('[data-file-search]').oninput = event => { fileQuery = event.target.value.trim().toLowerCase(); renderFiles(); };
    $('[data-create-folder]').onclick = () => {
      const name = window.prompt('Folder name')?.trim();
      if (!name) return;
      state.files.push({ id: uid(), parentId: currentFolderId, name, kind: 'folder', size: 0, modified: new Date().toISOString(), starred: false });
      save(); renderFiles(); toast('Folder created.');
    };
    $('[data-upload-file]').onclick = () => $('[data-file-input]').click();
    $('[data-file-input]').onchange = event => {
      [...event.target.files].forEach(file => state.files.push({ id: uid(), parentId: currentFolderId, name: file.name, kind: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'document', size: file.size, modified: new Date().toISOString(), starred: false }));
      save(); renderFiles(); toast(`${event.target.files.length} file${event.target.files.length === 1 ? '' : 's'} added.`); event.target.value = '';
    };

    $('[data-invoice-search]').oninput = event => { invoiceQuery = event.target.value.trim().toLowerCase(); renderInvoices(); };
    $('[data-invoice-filter]').onchange = event => { invoiceFilter = event.target.value; renderInvoices(); };
    $('[data-create-invoice]').onclick = () => openInvoice();
    $('[data-invoice-form]').onsubmit = event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      data.amount = Number(data.amount);
      const existing = state.invoices.find(invoice => invoice.id === data.id);
      if (existing) Object.assign(existing, data);
      else state.invoices.unshift({ ...data, id: uid() });
      save(); $('[data-invoice-dialog]').close(); renderInvoices(); toast(existing ? 'Invoice updated.' : 'Invoice created.');
    };
  }

  injectShell();
  bind();
  renderCalendar();
  renderEmail();
  renderFiles();
  renderInvoices();

  const initial = location.hash.slice(1);
  if (moduleRoutes[initial]) navigate(initial);
})();
