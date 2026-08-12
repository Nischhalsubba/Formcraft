'use strict';

(() => {
  const ERP = window.FormcraftERP;
  const UI = window.FormcraftERPUI;
  if (!ERP || !UI) throw new Error('Formcraft ERP schema and UI must load before workflows.');

  const {
    modulesByKey, moduleMetrics, collection, makeRecord, nextSequence, titleFor, statusFor, recordAudit,
    canEdit, relatedTitle, num, round, now, arr, title
  } = ERP;

  const workflow = (key, label, icon = 'arrowRight', primary = false) => ({ key, label, icon, primary });
  const module = key => modulesByKey.get(key);
  const get = (moduleKey, id) => collection(moduleKey).find(record => record.id === id) || null;
  const escape = value => typeof escapeHtml === 'function' ? escapeHtml(value) : String(value || '');
  const todayKey = () => dateKey(today());

  function contactFor(record) {
    const id = record.contactId || record.partnerId || record.supplierId || record.recipientId;
    return id ? get('contacts', id) : null;
  }

  function productFor(record) {
    return record.productId ? get('inventory', record.productId) : null;
  }

  function amountFor(record) {
    return round(record.total ?? record.amount ?? record.expectedRevenue ?? record.ticketRevenue ?? record.gross ?? record.net ?? 0);
  }

  function updateStatus(moduleKey, record, status, detail = '') {
    const meta = module(moduleKey);
    if (!meta || !record) return;
    record[meta.statusField || 'status'] = status;
    record.updatedAt = now();
    recordAudit(meta, record, 'Status changed', detail || title(status));
  }

  function createInvoice(sourceModuleKey, sourceRecord, options = {}) {
    const partner = options.contact || contactFor(sourceRecord);
    const amount = round(options.amount ?? amountFor(sourceRecord));
    const issueDate = todayKey();
    const invoice = {
      id: uid(),
      number: nextSequence('invoice', 'INV-'),
      client: partner?.name || sourceRecord.customerName || sourceRecord.visitor || 'Customer',
      customerName: partner?.name || sourceRecord.customerName || sourceRecord.visitor || 'Customer',
      email: partner?.email || sourceRecord.email || '',
      amount,
      total: amount,
      subtotal: amount,
      status: 'sent',
      issueDate,
      dueDate: dateKey(addDays(14)),
      currency: 'NPR',
      projectId: options.projectId || sourceRecord.projectId || '',
      sourceModule: sourceModuleKey,
      sourceRecordId: sourceRecord.id,
      notes: options.notes || `${title(sourceModuleKey)} billing`,
      payments: [],
      createdAt: now(),
      updatedAt: now()
    };
    state.invoices.unshift(invoice);
    const accountingModule = module('accounting');
    collection('accounting').unshift(makeRecord(accountingModule, {
      reference: invoice.number,
      date: issueDate,
      status: 'draft',
      journal: 'sales',
      account: 'Accounts Receivable',
      counterAccount: 'Sales Revenue',
      debit: amount,
      credit: amount,
      invoiceId: invoice.id,
      sourceModule: sourceModuleKey,
      sourceRecordId: sourceRecord.id,
      notes: `Generated from ${title(sourceModuleKey)} ${titleFor(module(sourceModuleKey), sourceRecord)}.`
    }));
    sourceRecord.invoiceId = invoice.id;
    recordAudit(module(sourceModuleKey), sourceRecord, 'Invoice created', invoice.number);
    return invoice;
  }

  function createStockMove(product, quantity, direction, sourceModuleKey, sourceRecord) {
    if (!product) return null;
    const signed = direction === 'in' ? Math.abs(num(quantity)) : -Math.abs(num(quantity));
    product.onHand = round(num(product.onHand) + signed, 3);
    product.updatedAt = now();
    const move = {
      id: uid(),
      reference: nextSequence('stockMove', 'MOVE-'),
      productId: product.id,
      quantity: Math.abs(num(quantity)),
      direction,
      date: todayKey(),
      warehouseId: sourceRecord.warehouseId || product.warehouseId || 'warehouse-main',
      sourceModule: sourceModuleKey,
      sourceRecordId: sourceRecord.id,
      companyId: sourceRecord.companyId,
      branchId: sourceRecord.branchId,
      createdAt: now(),
      updatedAt: now()
    };
    collection('stockMoves').unshift(move);
    recordAudit(module('inventory'), product, 'Stock updated', `${signed > 0 ? '+' : ''}${signed}`);
    return move;
  }

  function createSalesOrderFromLead(lead) {
    const salesModule = module('sales');
    const order = makeRecord(salesModule, {
      number: nextSequence('salesOrder', 'SO-'),
      contactId: lead.contactId || '',
      orderDate: todayKey(),
      status: 'quotation',
      quantity: 1,
      unitPrice: num(lead.expectedRevenue),
      discount: 0,
      taxRate: 13,
      total: num(lead.expectedRevenue),
      ownerId: lead.ownerId,
      companyId: lead.companyId,
      branchId: lead.branchId,
      sourceLeadId: lead.id,
      notes: `Created from opportunity ${lead.name}.`
    });
    collection('sales').unshift(order);
    lead.salesOrderId = order.id;
    updateStatus('crm', lead, 'proposal', `Quotation ${order.number} created`);
    return order;
  }

  function createTaskFromTicket(ticket) {
    if (!state.projects?.length) {
      toast('Create a project before converting a helpdesk ticket to a task.', 'warning');
      return null;
    }
    const projectId = ticket.projectId || state.projects[0].id;
    const task = {
      id: uid(),
      projectId,
      title: ticket.subject,
      issueType: 'bug',
      status: 'todo',
      priority: ticket.priority || 'medium',
      assigneeId: ticket.assignedTo || '',
      reporterId: window.FormcraftBackend?.session?.user?.id || '',
      startDate: todayKey(),
      dueDate: ticket.slaDue || dateKey(addDays(3)),
      estimateHours: 0,
      storyPoints: 0,
      billable: false,
      labels: ['helpdesk'],
      description: ticket.description || ticket.notes || '',
      acceptanceCriteria: 'Customer issue is resolved and the ticket can be closed.',
      dependencyIds: [],
      checklist: [],
      comments: [],
      createdAt: now(),
      updatedAt: now(),
      sourceTicketId: ticket.id
    };
    if (window.FormcraftOpsCore?.nextTaskKey) task.key = window.FormcraftOpsCore.nextTaskKey(projectId);
    else task.key = `TASK-${String(state.tasks.length + 1).padStart(3, '0')}`;
    state.tasks.push(task);
    ticket.taskId = task.id;
    recordAudit(module('helpdesk'), ticket, 'Task created', task.key);
    return task;
  }

  function actionsFor(moduleKey, record) {
    if (!record || !canEdit()) return [];
    const status = statusFor(module(moduleKey), record);
    const actions = [];
    const add = (key, label, icon = 'arrowRight', primary = false) => actions.push(workflow(key, label, icon, primary));

    switch (moduleKey) {
      case 'contacts':
        add('contact-create-lead', 'Create opportunity', 'plus', true);
        add('contact-create-ticket', 'Create ticket', 'mail');
        break;
      case 'activities':
        if (status !== 'done') add('activity-done', 'Mark done', 'check', true);
        break;
      case 'approvals':
        if (status === 'draft') add('approval-submit', 'Submit', 'arrowRight', true);
        if (status === 'submitted') { add('approval-approve', 'Approve', 'check', true); add('approval-reject', 'Reject', 'close'); }
        break;
      case 'automations':
        if (status !== 'active') add('automation-activate', 'Activate', 'check', true);
        else add('automation-pause', 'Pause', 'close');
        add('automation-run', 'Run now', 'arrowRight');
        break;
      case 'studio':
        if (status !== 'active') add('studio-activate', 'Activate model', 'check', true);
        break;
      case 'accounting':
        if (status === 'draft') add('accounting-post', 'Post entry', 'check', true);
        if (status === 'posted') add('accounting-reverse', 'Reverse', 'archive');
        break;
      case 'expenses':
        if (status === 'draft') add('expense-submit', 'Submit', 'arrowRight', true);
        if (status === 'submitted') { add('expense-approve', 'Approve', 'check', true); add('expense-reject', 'Reject', 'close'); }
        if (status === 'approved') add('expense-pay', 'Mark paid', 'check', true);
        break;
      case 'payments':
        if (['draft', 'pending'].includes(status)) add('payment-complete', 'Complete payment', 'check', true);
        if (status === 'completed') add('payment-reverse', 'Reverse', 'archive');
        break;
      case 'crm':
        if (status === 'new') add('crm-qualify', 'Qualify', 'check', true);
        if (['new', 'qualified', 'proposal', 'negotiation'].includes(status)) add('crm-quotation', 'Create quotation', 'invoices', true);
        if (!['won', 'lost'].includes(status)) { add('crm-win', 'Mark won', 'check'); add('crm-lost', 'Mark lost', 'close'); }
        break;
      case 'sales':
        if (status === 'quotation') add('sales-send', 'Send quotation', 'mail', true);
        if (['quotation', 'sent'].includes(status)) add('sales-confirm', 'Confirm order', 'check', true);
        if (status === 'confirmed') add('sales-deliver', 'Deliver', 'arrowRight', true);
        if (['confirmed', 'delivered'].includes(status) && !record.invoiceId) add('sales-invoice', 'Create invoice', 'invoices', true);
        break;
      case 'pos':
        if (status === 'open') add('pos-pay', 'Take payment', 'check', true);
        if (status === 'paid') add('pos-refund', 'Refund', 'archive');
        break;
      case 'subscriptions':
        if (status === 'draft') add('subscription-activate', 'Activate', 'check', true);
        if (status === 'active') add('subscription-invoice', 'Create renewal invoice', 'invoices', true);
        if (status === 'active') add('subscription-pause', 'Pause', 'close');
        if (status === 'paused') add('subscription-resume', 'Resume', 'check');
        break;
      case 'rental':
        if (status === 'quotation') add('rental-reserve', 'Reserve', 'check', true);
        if (status === 'reserved') add('rental-pickup', 'Pick up', 'arrowRight', true);
        if (['picked-up', 'late'].includes(status)) add('rental-return', 'Return', 'check', true);
        if (status === 'returned' && !record.invoiceId) add('rental-invoice', 'Create invoice', 'invoices', true);
        break;
      case 'website':
        if (status !== 'published') add('website-publish', 'Publish', 'check', true);
        if (status === 'published') add('website-unpublish', 'Unpublish', 'archive');
        break;
      case 'ecommerce':
        if (['cart', 'checkout'].includes(status)) add('ecommerce-pay', 'Confirm payment', 'check', true);
        if (status === 'paid') add('ecommerce-process', 'Start processing', 'arrowRight', true);
        if (status === 'processing') add('ecommerce-ship', 'Ship', 'arrowRight', true);
        if (status === 'shipped') add('ecommerce-deliver', 'Mark delivered', 'check', true);
        break;
      case 'elearning':
        if (status !== 'published') add('elearning-publish', 'Publish course', 'check', true);
        break;
      case 'forum':
        if (status === 'open') add('forum-answer', 'Mark answered', 'check', true);
        if (!['closed', 'moderation'].includes(status)) add('forum-close', 'Close topic', 'archive');
        break;
      case 'blog':
        if (status !== 'published') add('blog-publish', 'Publish', 'check', true);
        break;
      case 'livechat':
        if (!['resolved', 'missed'].includes(status)) add('livechat-resolve', 'Resolve', 'check', true);
        add('livechat-lead', 'Create opportunity', 'team');
        add('livechat-ticket', 'Create ticket', 'mail');
        break;
      case 'purchase':
        if (status === 'rfq') add('purchase-send', 'Send RFQ', 'mail', true);
        if (['rfq', 'sent'].includes(status)) add('purchase-approve', 'Approve', 'check', true);
        if (status === 'approved') add('purchase-order', 'Confirm order', 'check', true);
        if (status === 'ordered') add('purchase-receive', 'Receive products', 'arrowRight', true);
        if (status === 'received') add('purchase-bill', 'Create vendor bill', 'invoices', true);
        break;
      case 'inventory':
        add('inventory-adjust', 'Adjust stock', 'edit', true);
        if (num(record.onHand) <= num(record.reorderPoint)) add('inventory-reorder', 'Create replenishment', 'plus', true);
        break;
      case 'barcode':
        if (status === 'ready') add('barcode-start', 'Start operation', 'arrowRight', true);
        if (status === 'in-progress') add('barcode-complete', 'Complete', 'check', true);
        break;
      case 'manufacturing':
        if (status === 'draft') add('manufacturing-confirm', 'Confirm', 'check', true);
        if (status === 'confirmed') add('manufacturing-start', 'Start production', 'arrowRight', true);
        if (status === 'in-progress') add('manufacturing-quality', 'Send to quality', 'check', true);
        if (status === 'quality') add('manufacturing-complete', 'Complete', 'check', true);
        break;
      case 'quality':
        if (status === 'pending') { add('quality-pass', 'Pass', 'check', true); add('quality-fail', 'Fail', 'close'); }
        if (status === 'failed') add('quality-corrective', 'Start corrective action', 'arrowRight', true);
        if (status === 'corrective-action') add('quality-close', 'Close', 'check', true);
        break;
      case 'maintenance':
        if (status === 'new') add('maintenance-schedule', 'Schedule', 'calendar', true);
        if (status === 'scheduled') add('maintenance-start', 'Start work', 'arrowRight', true);
        if (status === 'in-progress') add('maintenance-complete', 'Mark repaired', 'check', true);
        break;
      case 'plm':
        if (status === 'draft') add('plm-review', 'Send to review', 'arrowRight', true);
        if (status === 'review') add('plm-approve', 'Approve', 'check', true);
        if (status === 'approved') add('plm-apply', 'Apply change', 'check', true);
        break;
      case 'repairs':
        if (status === 'draft') add('repair-confirm', 'Confirm', 'check', true);
        if (status === 'confirmed') add('repair-start', 'Start repair', 'arrowRight', true);
        if (status === 'repairing') add('repair-ready', 'Mark ready', 'check', true);
        if (status === 'ready') add('repair-deliver', 'Deliver', 'check', true);
        if (status === 'delivered' && !record.invoiceId) add('repair-invoice', 'Create invoice', 'invoices', true);
        break;
      case 'employees':
        add('employee-attendance', 'Add attendance', 'calendar', true);
        add('employee-leave', 'Request leave', 'calendar');
        add('employee-appraisal', 'Create appraisal', 'reports');
        break;
      case 'attendance':
        if (status === 'open') add('attendance-complete', 'Complete entry', 'check', true);
        if (status === 'exception') add('attendance-approve', 'Approve exception', 'check', true);
        break;
      case 'timeoff':
        if (status === 'draft') add('leave-submit', 'Submit', 'arrowRight', true);
        if (status === 'submitted') { add('leave-approve', 'Approve', 'check', true); add('leave-reject', 'Reject', 'close'); }
        break;
      case 'recruitment':
        if (status === 'new') add('recruit-screen', 'Move to screening', 'arrowRight', true);
        if (status === 'screening') add('recruit-interview', 'Schedule interview', 'calendar', true);
        if (status === 'interview') add('recruit-offer', 'Create offer', 'invoices', true);
        if (status === 'offer') add('recruit-hire', 'Hire', 'check', true);
        break;
      case 'appraisals':
        if (status !== 'completed') add('appraisal-complete', 'Complete appraisal', 'check', true);
        break;
      case 'payroll':
        if (status === 'draft') add('payroll-compute', 'Compute payroll', 'reports', true);
        if (status === 'computed') add('payroll-approve', 'Approve', 'check', true);
        if (status === 'approved') add('payroll-pay', 'Mark paid', 'check', true);
        break;
      case 'fleet':
        if (status === 'active') add('fleet-maintenance', 'Create maintenance request', 'settings', true);
        break;
      case 'frontdesk':
        if (status === 'expected') add('visitor-checkin', 'Check in', 'check', true);
        if (status === 'checked-in') add('visitor-checkout', 'Check out', 'check', true);
        break;
      case 'referrals':
        if (status === 'submitted') add('referral-screen', 'Move to screening', 'arrowRight', true);
        if (status === 'hired') add('referral-reward', 'Mark rewarded', 'check', true);
        break;
      case 'lunch':
        if (status === 'ordered') add('lunch-confirm', 'Confirm', 'check', true);
        if (status === 'confirmed') add('lunch-deliver', 'Mark delivered', 'check', true);
        break;
      case 'emailmarketing':
      case 'smsmarketing':
        if (status === 'draft') add(`${moduleKey}-schedule`, 'Schedule', 'calendar', true);
        if (status === 'scheduled') add(`${moduleKey}-send`, 'Send now', 'mail', true);
        break;
      case 'marketingautomation':
        if (status !== 'active') add('journey-activate', 'Activate', 'check', true);
        if (status === 'active') add('journey-pause', 'Pause', 'close');
        break;
      case 'events':
        if (status === 'draft') add('event-publish', 'Publish', 'check', true);
        if (status === 'published') add('event-open', 'Open registration', 'arrowRight', true);
        if (status === 'registration-open') add('event-live', 'Start event', 'arrowRight', true);
        if (status === 'live') add('event-complete', 'Complete', 'check', true);
        break;
      case 'marketingcards':
        if (status === 'draft') add('cards-ready', 'Mark ready', 'check', true);
        if (status === 'ready') add('cards-generate', 'Generate cards', 'arrowRight', true);
        break;
      case 'surveys':
        if (status === 'draft') add('survey-open', 'Open survey', 'check', true);
        if (status === 'open') add('survey-close', 'Close survey', 'archive', true);
        break;
      case 'timesheets':
        if (status === 'draft') add('timesheet-submit', 'Submit', 'arrowRight', true);
        if (status === 'submitted') add('timesheet-approve', 'Approve', 'check', true);
        break;
      case 'planning':
        if (status === 'draft') add('planning-publish', 'Publish', 'check', true);
        if (status === 'confirmed') add('planning-complete', 'Complete', 'check', true);
        break;
      case 'fieldservice':
        if (status === 'new') add('fieldservice-schedule', 'Schedule', 'calendar', true);
        if (status === 'scheduled') add('fieldservice-enroute', 'En route', 'arrowRight', true);
        if (status === 'en-route') add('fieldservice-onsite', 'On site', 'arrowRight', true);
        if (status === 'on-site') add('fieldservice-complete', 'Complete', 'check', true);
        if (status === 'completed' && !record.invoiceId) add('fieldservice-invoice', 'Create invoice', 'invoices', true);
        break;
      case 'helpdesk':
        if (status === 'new') add('ticket-start', 'Start work', 'arrowRight', true);
        if (!record.taskId) add('ticket-task', 'Create project task', 'tasks');
        if (!['resolved', 'closed'].includes(status)) add('ticket-resolve', 'Resolve', 'check', true);
        if (status === 'resolved') add('ticket-close', 'Close', 'archive');
        break;
      case 'appointments':
        if (status === 'requested') add('appointment-confirm', 'Confirm', 'check', true);
        if (status === 'confirmed') add('appointment-complete', 'Complete', 'check', true);
        break;
      case 'documents':
        if (!['validated', 'archived'].includes(status)) add('document-validate', 'Validate', 'check', true);
        break;
      case 'sign':
        if (status === 'draft') add('sign-send', 'Send request', 'mail', true);
        if (['sent', 'viewed', 'partially-signed'].includes(status)) add('sign-complete', 'Mark completed', 'check', true);
        break;
      case 'spreadsheet':
      case 'dashboards':
      case 'knowledge':
        if (status !== 'published') add(`${moduleKey}-publish`, 'Publish', 'check', true);
        break;
      case 'discuss':
        if (status !== 'archived') add('discuss-archive', 'Archive channel', 'archive');
        break;
      case 'datacleaning':
        add('cleaning-run', 'Run cleaning', 'arrowRight', true);
        break;
      default:
        break;
    }
    return actions;
  }

  function openQuantityModal(titleText, copyText, defaultValue, onSubmit) {
    openModal(`<form class="modal-card erp-quick-form" data-erp-workflow-form novalidate><div class="modal-head"><div><h2 id="modal-title">${escape(titleText)}</h2><p>${escape(copyText)}</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div><div class="modal-body"><label class="erp-field"><span>Quantity *</span><input type="number" name="quantity" value="${escape(defaultValue)}" min="0" step="0.001" required><em data-erp-workflow-error></em></label></div><div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Continue</button></div></form>`);
    modal.dataset.surface = 'form';
    const form = modal.querySelector('[data-erp-workflow-form]');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const quantity = num(form.elements.quantity.value);
      if (quantity <= 0) {
        form.querySelector('[data-erp-workflow-error]').textContent = 'Enter a quantity greater than zero.';
        return;
      }
      await onSubmit(quantity);
      closeModal();
    });
  }

  async function persist(message = 'Workflow updated.') {
    await Promise.resolve(saveState());
    renderShell();
    toast(message);
  }

  async function run(actionKey, moduleKey, recordId) {
    if (!canEdit()) return toast('You have read-only access to this workspace.', 'warning');
    const meta = module(moduleKey);
    const record = get(moduleKey, recordId);
    if (!meta || !record) return;

    switch (actionKey) {
      case 'contact-create-lead': {
        const lead = makeRecord(module('crm'), { name: `Opportunity with ${record.name}`, contactId: record.id, stage: 'new', probability: 10, expectedRevenue: 0, ownerId: record.ownerId, companyId: record.companyId, branchId: record.branchId });
        collection('crm').unshift(lead);
        recordAudit(meta, record, 'Opportunity created', lead.name);
        await persist('Opportunity created.');
        UI.openERPRecord('crm', lead.id);
        return;
      }
      case 'contact-create-ticket': {
        const ticket = makeRecord(module('helpdesk'), { subject: `Support request for ${record.name}`, contactId: record.id, status: 'new', priority: 'medium', companyId: record.companyId, branchId: record.branchId });
        collection('helpdesk').unshift(ticket);
        recordAudit(meta, record, 'Ticket created', ticket.subject);
        await persist('Helpdesk ticket created.');
        UI.openERPRecord('helpdesk', ticket.id);
        return;
      }
      case 'activity-done': updateStatus(moduleKey, record, 'done'); break;
      case 'approval-submit': updateStatus(moduleKey, record, 'submitted'); break;
      case 'approval-approve': updateStatus(moduleKey, record, 'approved'); break;
      case 'approval-reject': updateStatus(moduleKey, record, 'rejected'); break;
      case 'automation-activate': updateStatus(moduleKey, record, 'active'); break;
      case 'automation-pause': updateStatus(moduleKey, record, 'paused'); break;
      case 'automation-run': record.lastRun = now(); record.runs = num(record.runs) + 1; recordAudit(meta, record, 'Automation executed'); break;
      case 'studio-activate': updateStatus(moduleKey, record, 'active'); break;
      case 'accounting-post': updateStatus(moduleKey, record, 'posted'); record.postedAt = now(); break;
      case 'accounting-reverse': {
        updateStatus(moduleKey, record, 'reversed');
        const reverse = makeRecord(meta, { reference: `${record.reference}-REV`, date: todayKey(), status: 'posted', journal: record.journal, account: record.counterAccount, counterAccount: record.account, debit: record.credit, credit: record.debit, reversalOf: record.id, notes: `Reversal of ${record.reference}` });
        collection(moduleKey).unshift(reverse);
        break;
      }
      case 'expense-submit': updateStatus(moduleKey, record, 'submitted'); break;
      case 'expense-approve': updateStatus(moduleKey, record, 'approved'); break;
      case 'expense-reject': updateStatus(moduleKey, record, 'rejected'); break;
      case 'expense-pay': {
        updateStatus(moduleKey, record, 'paid');
        const payment = makeRecord(module('payments'), { reference: nextSequence('payment', 'PAY-'), direction: 'outgoing', date: todayKey(), amount: record.amount, method: 'bank', status: 'completed', expenseId: record.id, companyId: record.companyId, branchId: record.branchId });
        collection('payments').unshift(payment);
        break;
      }
      case 'payment-complete': updateStatus(moduleKey, record, 'completed'); record.completedAt = now(); break;
      case 'payment-reverse': updateStatus(moduleKey, record, 'reversed'); break;
      case 'crm-qualify': updateStatus(moduleKey, record, 'qualified'); record.probability = Math.max(num(record.probability), 35); break;
      case 'crm-quotation': {
        const order = createSalesOrderFromLead(record);
        await persist('Quotation created.');
        UI.openERPRecord('sales', order.id);
        return;
      }
      case 'crm-win': updateStatus(moduleKey, record, 'won'); record.probability = 100; break;
      case 'crm-lost': updateStatus(moduleKey, record, 'lost'); record.probability = 0; break;
      case 'sales-send': updateStatus(moduleKey, record, 'sent'); break;
      case 'sales-confirm': updateStatus(moduleKey, record, 'confirmed'); break;
      case 'sales-deliver': {
        updateStatus(moduleKey, record, 'delivered');
        createStockMove(productFor(record), record.quantity || 1, 'out', moduleKey, record);
        break;
      }
      case 'sales-invoice': {
        const invoice = createInvoice(moduleKey, record);
        updateStatus(moduleKey, record, 'invoiced', invoice.number);
        break;
      }
      case 'pos-pay': {
        updateStatus(moduleKey, record, 'paid');
        createStockMove(productFor(record), record.quantity || 1, 'out', moduleKey, record);
        createInvoice(moduleKey, record, { amount: record.amount });
        break;
      }
      case 'pos-refund': {
        updateStatus(moduleKey, record, 'refunded');
        createStockMove(productFor(record), record.quantity || 1, 'in', moduleKey, record);
        break;
      }
      case 'subscription-activate': updateStatus(moduleKey, record, 'active'); break;
      case 'subscription-invoice': {
        const invoice = createInvoice(moduleKey, record, { amount: record.amount, notes: `Subscription renewal: ${record.name}` });
        record.lastInvoiceId = invoice.id;
        const next = new Date(`${record.nextInvoiceDate || todayKey()}T00:00:00`);
        if (record.interval === 'yearly') next.setFullYear(next.getFullYear() + 1);
        else if (record.interval === 'quarterly') next.setMonth(next.getMonth() + 3);
        else next.setMonth(next.getMonth() + 1);
        record.nextInvoiceDate = dateKey(next);
        break;
      }
      case 'subscription-pause': updateStatus(moduleKey, record, 'paused'); break;
      case 'subscription-resume': updateStatus(moduleKey, record, 'active'); break;
      case 'rental-reserve': updateStatus(moduleKey, record, 'reserved'); break;
      case 'rental-pickup': updateStatus(moduleKey, record, 'picked-up'); createStockMove(productFor(record), 1, 'out', moduleKey, record); break;
      case 'rental-return': updateStatus(moduleKey, record, 'returned'); createStockMove(productFor(record), 1, 'in', moduleKey, record); break;
      case 'rental-invoice': createInvoice(moduleKey, record, { amount: record.amount }); break;
      case 'website-publish': updateStatus(moduleKey, record, 'published'); record.publishedAt = now(); break;
      case 'website-unpublish': updateStatus(moduleKey, record, 'draft'); break;
      case 'ecommerce-pay': updateStatus(moduleKey, record, 'paid'); createInvoice(moduleKey, record, { amount: record.amount }); break;
      case 'ecommerce-process': updateStatus(moduleKey, record, 'processing'); break;
      case 'ecommerce-ship': updateStatus(moduleKey, record, 'shipped'); createStockMove(productFor(record), record.quantity || 1, 'out', moduleKey, record); break;
      case 'ecommerce-deliver': updateStatus(moduleKey, record, 'delivered'); break;
      case 'elearning-publish': updateStatus(moduleKey, record, 'published'); break;
      case 'forum-answer': updateStatus(moduleKey, record, 'answered'); break;
      case 'forum-close': updateStatus(moduleKey, record, 'closed'); break;
      case 'blog-publish': updateStatus(moduleKey, record, 'published'); record.publishDate ||= todayKey(); break;
      case 'livechat-resolve': updateStatus(moduleKey, record, 'resolved'); break;
      case 'livechat-lead': {
        const lead = makeRecord(module('crm'), { name: `Live chat with ${record.visitor}`, contactId: record.contactId || '', stage: 'new', probability: 10, expectedRevenue: 0, notes: record.transcript || record.notes || '' });
        collection('crm').unshift(lead);
        record.leadId = lead.id;
        break;
      }
      case 'livechat-ticket': {
        const ticket = makeRecord(module('helpdesk'), { subject: `Live chat request: ${record.visitor}`, contactId: record.contactId || '', status: 'new', priority: 'medium', description: record.transcript || record.notes || '' });
        collection('helpdesk').unshift(ticket);
        record.ticketId = ticket.id;
        break;
      }
      case 'purchase-send': updateStatus(moduleKey, record, 'sent'); break;
      case 'purchase-approve': updateStatus(moduleKey, record, 'approved'); break;
      case 'purchase-order': updateStatus(moduleKey, record, 'ordered'); break;
      case 'purchase-receive': {
        updateStatus(moduleKey, record, 'received');
        createStockMove(productFor(record), record.quantity || 0, 'in', moduleKey, record);
        break;
      }
      case 'purchase-bill': {
        updateStatus(moduleKey, record, 'billed');
        const bill = {
          id: uid(),
          number: nextSequence('vendorBill', 'BILL-'),
          supplierId: record.supplierId,
          purchaseOrderId: record.id,
          amount: amountFor(record),
          status: 'draft',
          date: todayKey(),
          dueDate: dateKey(addDays(30)),
          companyId: record.companyId,
          branchId: record.branchId,
          createdAt: now(), updatedAt: now()
        };
        collection('vendorBills').unshift(bill);
        collection('accounting').unshift(makeRecord(module('accounting'), { reference: bill.number, date: bill.date, status: 'draft', journal: 'purchase', account: 'Purchases / Inventory', counterAccount: 'Accounts Payable', debit: bill.amount, credit: bill.amount, vendorBillId: bill.id, notes: `Generated from ${record.number}.` }));
        record.vendorBillId = bill.id;
        break;
      }
      case 'inventory-adjust': {
        openQuantityModal('Adjust stock', `Set the new on-hand quantity for ${record.name}.`, record.onHand || 0, async quantity => {
          const difference = round(quantity - num(record.onHand), 3);
          record.onHand = quantity;
          recordAudit(meta, record, 'Stock adjusted', `${difference > 0 ? '+' : ''}${difference}`);
          collection('stockMoves').unshift({ id: uid(), reference: nextSequence('stockMove', 'ADJ-'), productId: record.id, quantity: Math.abs(difference), direction: difference >= 0 ? 'in' : 'out', date: todayKey(), warehouseId: record.warehouseId || 'warehouse-main', sourceModule: moduleKey, sourceRecordId: record.id, companyId: record.companyId, branchId: record.branchId, createdAt: now(), updatedAt: now() });
          await persist('Stock adjusted.');
        });
        return;
      }
      case 'inventory-reorder': {
        const quantity = Math.max(num(record.reorderPoint) * 2 - num(record.onHand), 1);
        const supplier = collection('contacts').find(contact => contact.status === 'supplier');
        const order = makeRecord(module('purchase'), { number: nextSequence('purchaseOrder', 'PO-'), supplierId: supplier?.id || '', orderDate: todayKey(), status: 'rfq', productId: record.id, quantity, unitCost: record.cost, total: round(quantity * num(record.cost)), warehouseId: record.warehouseId || 'warehouse-main', companyId: record.companyId, branchId: record.branchId, notes: `Automatic replenishment for ${record.name}.` });
        collection('purchase').unshift(order);
        record.replenishmentOrderId = order.id;
        recordAudit(meta, record, 'Replenishment created', order.number);
        await persist('Replenishment RFQ created.');
        UI.openERPRecord('purchase', order.id);
        return;
      }
      case 'barcode-start': updateStatus(moduleKey, record, 'in-progress'); break;
      case 'barcode-complete': {
        updateStatus(moduleKey, record, 'done');
        createStockMove(productFor(record), record.quantity || 0, record.operationType === 'receipt' ? 'in' : 'out', moduleKey, record);
        break;
      }
      case 'manufacturing-confirm': updateStatus(moduleKey, record, 'confirmed'); break;
      case 'manufacturing-start': updateStatus(moduleKey, record, 'in-progress'); record.startedAt = now(); break;
      case 'manufacturing-quality': {
        updateStatus(moduleKey, record, 'quality');
        const check = makeRecord(module('quality'), { name: `Final inspection ${record.number}`, productId: record.productId, operationReference: record.number, checkType: 'pass-fail', status: 'pending', responsibleId: record.ownerId });
        collection('quality').unshift(check);
        record.qualityCheckId = check.id;
        break;
      }
      case 'manufacturing-complete': {
        updateStatus(moduleKey, record, 'done');
        record.completedAt = now();
        createStockMove(productFor(record), record.quantity || 0, 'in', moduleKey, record);
        break;
      }
      case 'quality-pass': updateStatus(moduleKey, record, 'passed'); break;
      case 'quality-fail': updateStatus(moduleKey, record, 'failed'); break;
      case 'quality-corrective': updateStatus(moduleKey, record, 'corrective-action'); break;
      case 'quality-close': updateStatus(moduleKey, record, 'closed'); break;
      case 'maintenance-schedule': updateStatus(moduleKey, record, 'scheduled'); break;
      case 'maintenance-start': updateStatus(moduleKey, record, 'in-progress'); record.startedAt = now(); break;
      case 'maintenance-complete': updateStatus(moduleKey, record, 'repaired'); record.completedAt = now(); break;
      case 'plm-review': updateStatus(moduleKey, record, 'review'); break;
      case 'plm-approve': updateStatus(moduleKey, record, 'approved'); break;
      case 'plm-apply': updateStatus(moduleKey, record, 'applied'); break;
      case 'repair-confirm': updateStatus(moduleKey, record, 'confirmed'); break;
      case 'repair-start': updateStatus(moduleKey, record, 'repairing'); break;
      case 'repair-ready': updateStatus(moduleKey, record, 'ready'); break;
      case 'repair-deliver': updateStatus(moduleKey, record, 'delivered'); break;
      case 'repair-invoice': createInvoice(moduleKey, record, { amount: num(record.partsCost) + num(record.labourCost) }); break;
      case 'employee-attendance': {
        const attendance = makeRecord(module('attendance'), { reference: nextSequence('attendance', 'ATT-'), employeeId: record.id, date: todayKey(), status: 'open', branchId: record.branchId, companyId: record.companyId });
        collection('attendance').unshift(attendance);
        await persist('Attendance entry created.');
        UI.openERPRecord('attendance', attendance.id);
        return;
      }
      case 'employee-leave': {
        const leave = makeRecord(module('timeoff'), { name: `Leave request for ${record.name}`, employeeId: record.id, leaveType: 'annual', startDate: todayKey(), endDate: todayKey(), days: 1, status: 'draft', companyId: record.companyId, branchId: record.branchId });
        collection('timeoff').unshift(leave);
        await persist('Leave request created.');
        UI.openERPRecord('timeoff', leave.id);
        return;
      }
      case 'employee-appraisal': {
        const appraisal = makeRecord(module('appraisals'), { name: `${record.name} appraisal`, employeeId: record.id, reviewDate: dateKey(addDays(30)), status: 'draft', companyId: record.companyId, branchId: record.branchId });
        collection('appraisals').unshift(appraisal);
        await persist('Appraisal created.');
        UI.openERPRecord('appraisals', appraisal.id);
        return;
      }
      case 'attendance-complete': updateStatus(moduleKey, record, 'completed'); record.hours = record.hours || 8; break;
      case 'attendance-approve': updateStatus(moduleKey, record, 'approved'); break;
      case 'leave-submit': updateStatus(moduleKey, record, 'submitted'); break;
      case 'leave-approve': updateStatus(moduleKey, record, 'approved'); break;
      case 'leave-reject': updateStatus(moduleKey, record, 'rejected'); break;
      case 'recruit-screen': updateStatus(moduleKey, record, 'screening'); break;
      case 'recruit-interview': updateStatus(moduleKey, record, 'interview'); record.interviewDate ||= dateKey(addDays(3)); break;
      case 'recruit-offer': updateStatus(moduleKey, record, 'offer'); break;
      case 'recruit-hire': {
        updateStatus(moduleKey, record, 'hired');
        const employee = makeRecord(module('employees'), { name: record.name, email: record.email, phone: record.phone, employeeCode: nextSequence('employee', 'EMP-'), jobTitle: record.jobPosition, joinDate: dateKey(addDays(7)), salary: record.expectedSalary, status: 'probation' });
        collection('employees').unshift(employee);
        record.employeeId = employee.id;
        break;
      }
      case 'appraisal-complete': updateStatus(moduleKey, record, 'completed'); break;
      case 'payroll-compute': {
        const employees = collection('employees').filter(employee => ['active', 'probation'].includes(employee.status) && !employee.archived);
        const gross = round(employees.reduce((sum, employee) => sum + num(employee.salary), 0));
        record.employeeCount = employees.length;
        record.gross = gross;
        record.ssf = round(gross * 0.11);
        record.pf = round(gross * 0.1);
        record.cit = 0;
        record.tax = round(Math.max(gross - record.ssf - record.pf, 0) * 0.01);
        record.net = round(gross - record.ssf - record.pf - record.cit - record.tax);
        updateStatus(moduleKey, record, 'computed', `${employees.length} employees`);
        break;
      }
      case 'payroll-approve': updateStatus(moduleKey, record, 'approved'); break;
      case 'payroll-pay': {
        updateStatus(moduleKey, record, 'paid');
        collection('payments').unshift(makeRecord(module('payments'), { reference: nextSequence('payment', 'PAY-'), direction: 'outgoing', date: todayKey(), amount: record.net, method: 'bank', status: 'completed', payrollRunId: record.id, companyId: record.companyId, branchId: record.branchId }));
        break;
      }
      case 'fleet-maintenance': {
        const request = makeRecord(module('maintenance'), { name: `Service ${record.name}`, equipment: record.name, maintenanceType: 'preventive', scheduledDate: record.nextServiceDate || dateKey(addDays(7)), status: 'new', companyId: record.companyId, branchId: record.branchId });
        collection('maintenance').unshift(request);
        record.maintenanceRequestId = request.id;
        break;
      }
      case 'visitor-checkin': updateStatus(moduleKey, record, 'checked-in'); record.checkIn ||= new Date().toTimeString().slice(0, 5); break;
      case 'visitor-checkout': updateStatus(moduleKey, record, 'checked-out'); record.checkOut ||= new Date().toTimeString().slice(0, 5); break;
      case 'referral-screen': updateStatus(moduleKey, record, 'screening'); break;
      case 'referral-reward': updateStatus(moduleKey, record, 'rewarded'); break;
      case 'lunch-confirm': updateStatus(moduleKey, record, 'confirmed'); break;
      case 'lunch-deliver': updateStatus(moduleKey, record, 'delivered'); break;
      case 'emailmarketing-schedule':
      case 'smsmarketing-schedule': updateStatus(moduleKey, record, 'scheduled'); break;
      case 'emailmarketing-send':
      case 'smsmarketing-send': updateStatus(moduleKey, record, 'sent'); record.sentCount = Math.max(num(record.sentCount), 1); record.sentAt = now(); break;
      case 'journey-activate': updateStatus(moduleKey, record, 'active'); break;
      case 'journey-pause': updateStatus(moduleKey, record, 'paused'); break;
      case 'event-publish': updateStatus(moduleKey, record, 'published'); break;
      case 'event-open': updateStatus(moduleKey, record, 'registration-open'); break;
      case 'event-live': updateStatus(moduleKey, record, 'live'); break;
      case 'event-complete': updateStatus(moduleKey, record, 'completed'); break;
      case 'cards-ready': updateStatus(moduleKey, record, 'ready'); break;
      case 'cards-generate': updateStatus(moduleKey, record, 'generated'); record.generatedCount = Math.max(num(record.generatedCount), 1); break;
      case 'survey-open': updateStatus(moduleKey, record, 'open'); break;
      case 'survey-close': updateStatus(moduleKey, record, 'closed'); break;
      case 'timesheet-submit': updateStatus(moduleKey, record, 'submitted'); break;
      case 'timesheet-approve': {
        updateStatus(moduleKey, record, 'approved');
        if (record.projectId && record.hours) {
          state.timeEntries = arr(state.timeEntries);
          state.timeEntries.unshift({ id: uid(), projectId: record.projectId, taskId: record.taskId || '', userId: record.employeeId || '', date: record.date, hours: record.hours, description: record.description, billable: Boolean(record.billable), createdAt: now(), sourceTimesheetId: record.id });
          window.FormcraftOpsCore?.syncAll?.();
        }
        break;
      }
      case 'planning-publish': updateStatus(moduleKey, record, 'published'); break;
      case 'planning-complete': updateStatus(moduleKey, record, 'completed'); break;
      case 'fieldservice-schedule': updateStatus(moduleKey, record, 'scheduled'); break;
      case 'fieldservice-enroute': updateStatus(moduleKey, record, 'en-route'); break;
      case 'fieldservice-onsite': updateStatus(moduleKey, record, 'on-site'); break;
      case 'fieldservice-complete': updateStatus(moduleKey, record, 'completed'); break;
      case 'fieldservice-invoice': createInvoice(moduleKey, record, { amount: record.amount }); break;
      case 'ticket-start': updateStatus(moduleKey, record, 'in-progress'); break;
      case 'ticket-task': {
        const task = createTaskFromTicket(record);
        if (task) {
          await persist('Project task created.');
          window.FormcraftOpsCore?.openRecord?.('task', task.id);
          return;
        }
        return;
      }
      case 'ticket-resolve': updateStatus(moduleKey, record, 'resolved'); break;
      case 'ticket-close': updateStatus(moduleKey, record, 'closed'); break;
      case 'appointment-confirm': updateStatus(moduleKey, record, 'confirmed'); break;
      case 'appointment-complete': updateStatus(moduleKey, record, 'completed'); break;
      case 'document-validate': updateStatus(moduleKey, record, 'validated'); break;
      case 'sign-send': updateStatus(moduleKey, record, 'sent'); record.sentDate ||= todayKey(); break;
      case 'sign-complete': updateStatus(moduleKey, record, 'completed'); break;
      case 'spreadsheet-publish':
      case 'dashboards-publish':
      case 'knowledge-publish': updateStatus(moduleKey, record, 'published'); break;
      case 'discuss-archive': updateStatus(moduleKey, record, 'archived'); break;
      case 'cleaning-run': {
        updateStatus(moduleKey, record, 'completed');
        record.lastRun = todayKey();
        const target = module(record.targetModule);
        record.recordsAffected = target ? collection(target).filter(item => !item.archived).length : 0;
        break;
      }
      default:
        toast('This workflow action is not available.', 'warning');
        return;
    }

    await persist();
  }

  const relationIndex = [
    ['crm', 'leads'], ['sales', 'salesOrders'], ['purchase', 'purchaseOrders'], ['subscriptions', 'subscriptions'],
    ['rental', 'rentals'], ['ecommerce', 'ecommerceOrders'], ['livechat', 'liveChats'], ['helpdesk', 'tickets'],
    ['expenses', 'expenses'], ['payments', 'payments'], ['employees', 'employees'], ['attendance', 'attendances'],
    ['timeoff', 'leaveRequests'], ['recruitment', 'applicants'], ['appraisals', 'appraisals'], ['payroll', 'payrollRuns'],
    ['inventory', 'products'], ['manufacturing', 'manufacturingOrders'], ['quality', 'qualityChecks'], ['maintenance', 'maintenanceRequests'],
    ['repairs', 'repairOrders'], ['fieldservice', 'fieldServiceOrders'], ['appointments', 'appointments'], ['documents', 'documents'],
    ['sign', 'signatureRequests'], ['knowledge', 'knowledgeArticles']
  ];

  function relatedFor(moduleKey, record) {
    const links = [];
    const add = (targetModuleKey, item, meta = '') => {
      if (!item || targetModuleKey === moduleKey && item.id === record.id) return;
      const targetModule = module(targetModuleKey);
      links.push({ moduleKey: targetModuleKey, id: item.id, label: targetModule ? titleFor(targetModule, item) : item.name || item.id, meta });
    };

    if (moduleKey === 'contacts') {
      relationIndex.forEach(([targetModuleKey]) => {
        collection(targetModuleKey).filter(item => [item.contactId, item.partnerId, item.supplierId, item.recipientId].includes(record.id)).slice(0, 8).forEach(item => add(targetModuleKey, item, title(statusFor(module(targetModuleKey), item))));
      });
    }

    relationIndex.forEach(([targetModuleKey]) => {
      collection(targetModuleKey).forEach(item => {
        const refs = [item.sourceLeadId, item.salesOrderId, item.purchaseOrderId, item.sourceRecordId, item.employeeId, item.applicantId, item.ticketId, item.qualityCheckId, item.maintenanceRequestId, item.vendorBillId, item.invoiceId, item.documentId, item.productId, item.parentArticleId];
        if (refs.includes(record.id)) add(targetModuleKey, item, title(statusFor(module(targetModuleKey), item)));
      });
    });

    if (record.contactId) add('contacts', get('contacts', record.contactId), 'Contact');
    if (record.productId) add('inventory', get('inventory', record.productId), 'Product');
    if (record.employeeId) add('employees', get('employees', record.employeeId), 'Employee');
    if (record.sourceLeadId) add('crm', get('crm', record.sourceLeadId), 'Opportunity');
    if (record.salesOrderId) add('sales', get('sales', record.salesOrderId), 'Sales order');
    if (record.sourceTicketId) add('helpdesk', get('helpdesk', record.sourceTicketId), 'Ticket');
    return links.filter((link, index, values) => values.findIndex(item => item.moduleKey === link.moduleKey && item.id === link.id) === index).slice(0, 30);
  }

  function renderBusinessPulse() {
    ERP.ensureERPState();
    const sales = collection('sales');
    const crm = collection('crm');
    const products = collection('inventory');
    const employees = collection('employees');
    const tickets = collection('helpdesk');
    const revenue = sales.filter(order => ['confirmed', 'delivered', 'invoiced'].includes(order.status)).reduce((sum, order) => sum + amountFor(order), 0);
    const pipeline = crm.filter(lead => !['won', 'lost'].includes(lead.stage)).reduce((sum, lead) => sum + num(lead.expectedRevenue) * num(lead.probability) / 100, 0);
    const lowStock = products.filter(product => num(product.onHand) <= num(product.reorderPoint)).length;
    const openTickets = tickets.filter(ticket => !['resolved', 'closed'].includes(ticket.status)).length;
    return `<section class="content-shell page-stack erp-dashboard-pulse"><div class="erp-card-head"><div><p class="panel-kicker">Connected business</p><h2>ERP pulse</h2><p>Current totals from sales, CRM, inventory, people, and service records.</p></div><button class="button button-secondary button-small" type="button" data-erp-open-launcher>${icon('grid', 16)}Open apps</button></div><div class="erp-summary-grid"><article><span>Confirmed sales</span><strong>${escape(new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 }).format(revenue))}</strong><small>${sales.length} sales records</small></article><article><span>Weighted pipeline</span><strong>${escape(new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 }).format(pipeline))}</strong><small>${crm.length} opportunities</small></article><article><span>Low stock</span><strong>${lowStock}</strong><small>${products.length} products</small></article><article><span>People & service</span><strong>${employees.length} / ${openTickets}</strong><small>Employees / open tickets</small></article></div></section>`;
  }

  function renderERPReport() {
    const cards = [
      ['CRM pipeline', moduleMetrics(module('crm')).value, moduleMetrics(module('crm')).total, 'crm'],
      ['Sales orders', moduleMetrics(module('sales')).value, moduleMetrics(module('sales')).total, 'sales'],
      ['Purchase orders', moduleMetrics(module('purchase')).value, moduleMetrics(module('purchase')).total, 'purchase'],
      ['Expenses', moduleMetrics(module('expenses')).value, moduleMetrics(module('expenses')).total, 'expenses']
    ];
    const rows = GROUP_REPORTS.map(item => {
      const target = module(item.key);
      const metrics = moduleMetrics(target);
      return `<tr><td><button class="erp-record-link" type="button" data-erp-open-app="${escape(item.key)}"><strong>${escape(target.label)}</strong><small>${escape(target.description)}</small></button></td><td>${metrics.total}</td><td>${metrics.active}</td><td>${metrics.completed}</td><td>${escape(new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 }).format(metrics.value))}</td><td>${metrics.overdue}</td></tr>`;
    }).join('');
    return `<section class="content-shell page-stack erp-report"><div class="erp-card-head"><div><p class="panel-kicker">ERP report</p><h2>Cross-module operating report</h2><p>Drill into commercial, supply, people, and service records from one consolidated view.</p></div><button class="button button-secondary button-small" type="button" data-erp-open-launcher>${icon('grid', 16)}All apps</button></div><div class="erp-summary-grid">${cards.map(([label, value, count]) => `<article><span>${escape(label)}</span><strong>${escape(new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 }).format(value))}</strong><small>${count} records</small></article>`).join('')}</div><div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Module</th><th>Total</th><th>Active</th><th>Completed</th><th>Value</th><th>Overdue</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }

  const GROUP_REPORTS = ['crm', 'sales', 'purchase', 'inventory', 'expenses', 'employees', 'recruitment', 'helpdesk', 'fieldservice', 'manufacturing'].map(key => ({ key }));

  const baseDashboard = renderDashboard;
  renderDashboard = function renderDashboardWithERP() {
    return `${baseDashboard()}${renderBusinessPulse()}`;
  };

  const baseReports = renderReports;
  renderReports = function renderReportsWithERP() {
    return `${baseReports()}${renderERPReport()}`;
  };

  window.FormcraftERPWorkflows = Object.freeze({ actionsFor, run, relatedFor, createInvoice, createStockMove });
})();
