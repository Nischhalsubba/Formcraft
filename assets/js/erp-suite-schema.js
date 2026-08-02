'use strict';

(() => {
  const VERSION = 'ERP-NP-0.1.0';
  const now = () => new Date().toISOString();
  const arr = value => Array.isArray(value) ? value : [];
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = (value, precision = 2) => {
    const factor = 10 ** precision;
    return Math.round((num(value) + Number.EPSILON) * factor) / factor;
  };
  const slug = value => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'record';
  const title = value => String(value || '')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());

  const GROUPS = [
    { key: 'essentials', label: 'Essentials', description: 'Shared data, activities, approvals, automation, and configuration.' },
    { key: 'finance', label: 'Finance', description: 'Accounting, payments, expenses, assets, budgets, and Nepal compliance foundations.' },
    { key: 'sales', label: 'Sales', description: 'CRM, quotations, sales, subscriptions, rentals, and point of sale.' },
    { key: 'websites', label: 'Websites', description: 'Website, commerce, learning, publishing, community, and live chat.' },
    { key: 'supply', label: 'Supply chain', description: 'Purchase, inventory, manufacturing, barcode, quality, maintenance, PLM, and repairs.' },
    { key: 'hr', label: 'Human resources', description: 'Employees, attendance, leave, recruitment, appraisal, payroll, fleet, and visitors.' },
    { key: 'marketing', label: 'Marketing', description: 'Campaigns, automation, events, surveys, SMS, and personalized cards.' },
    { key: 'services', label: 'Services', description: 'Projects, timesheets, planning, field service, helpdesk, and appointments.' },
    { key: 'productivity', label: 'Productivity', description: 'Documents, signatures, analytics, knowledge, discuss, and data quality.' }
  ];

  const option = (value, label = title(value)) => [value, label];
  const field = (name, label, type = 'text', extra = {}) => ({ name, label, type, ...extra });
  const common = {
    status: values => field('status', 'Status', 'select', { options: values.map(value => option(value)) }),
    owner: () => field('ownerId', 'Owner', 'member'),
    company: () => field('companyId', 'Company', 'company'),
    branch: () => field('branchId', 'Branch', 'branch'),
    notes: () => field('notes', 'Notes', 'textarea', { span: 2 }),
    tags: () => field('tags', 'Tags', 'tags', { span: 2 })
  };

  const MODULES = [
    {
      key: 'contacts', group: 'essentials', label: 'Contacts', singular: 'Contact', icon: 'team', collection: 'contacts',
      description: 'One shared customer, supplier, employee, and partner directory.',
      titleField: 'name', statusField: 'status', statuses: ['active', 'prospect', 'customer', 'supplier', 'archived'],
      fields: [
        field('name', 'Name', 'text', { required: true, span: 2 }),
        field('kind', 'Contact type', 'select', { options: [option('person'), option('organization')] }),
        common.status(['active', 'prospect', 'customer', 'supplier', 'archived']),
        field('email', 'Email', 'email'), field('phone', 'Phone', 'tel'),
        field('panVat', 'PAN / VAT number', 'text'), field('address', 'Address', 'textarea', { span: 2 }),
        common.company(), common.branch(), common.owner(), common.tags(), common.notes()
      ]
    },
    {
      key: 'activities', group: 'essentials', label: 'Activities', singular: 'Activity', icon: 'activity', collection: 'activities',
      description: 'Calls, meetings, reminders, follow-ups, and record-linked work.',
      titleField: 'summary', statusField: 'status', statuses: ['planned', 'today', 'overdue', 'done', 'cancelled'],
      fields: [field('summary', 'Summary', 'text', { required: true, span: 2 }), field('activityType', 'Type', 'select', { options: [option('call'), option('meeting'), option('email'), option('task'), option('follow-up')] }), common.status(['planned', 'today', 'overdue', 'done', 'cancelled']), field('dueDate', 'Due date', 'date'), common.owner(), field('relatedModule', 'Related app', 'module'), field('relatedRecordId', 'Related record', 'text'), common.notes()]
    },
    {
      key: 'approvals', group: 'essentials', label: 'Approvals', singular: 'Approval request', icon: 'check', collection: 'approvalRequests',
      description: 'Controlled decisions for purchases, expenses, leave, discounts, and custom requests.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'submitted', 'approved', 'rejected', 'cancelled'],
      fields: [field('name', 'Request', 'text', { required: true, span: 2 }), field('category', 'Category', 'select', { options: [option('purchase'), option('expense'), option('leave'), option('discount'), option('custom')] }), common.status(['draft', 'submitted', 'approved', 'rejected', 'cancelled']), field('amount', 'Amount', 'money'), common.owner(), field('approverId', 'Approver', 'member'), common.company(), common.branch(), common.notes()]
    },
    {
      key: 'automations', group: 'essentials', label: 'Automation', singular: 'Automation rule', icon: 'settings', collection: 'automationRules',
      description: 'Rules, scheduled actions, webhooks, and workflow triggers.',
      titleField: 'name', statusField: 'status', statuses: ['active', 'paused', 'error', 'archived'],
      fields: [field('name', 'Rule name', 'text', { required: true, span: 2 }), field('trigger', 'Trigger', 'select', { options: [option('record-created'), option('record-updated'), option('status-changed'), option('date-reached'), option('scheduled'), option('webhook')] }), field('targetModule', 'Target app', 'module'), field('action', 'Action', 'select', { options: [option('notify'), option('create-record'), option('update-record'), option('request-approval'), option('send-webhook')] }), common.status(['active', 'paused', 'error', 'archived']), field('schedule', 'Schedule / condition', 'text', { span: 2 }), field('webhookUrl', 'Webhook URL', 'url', { span: 2 }), common.notes()]
    },
    {
      key: 'studio', group: 'essentials', label: 'Studio', singular: 'Custom model', icon: 'grid', collection: 'customModels',
      description: 'Configure custom models, fields, views, approval rules, and reports.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'active', 'archived'],
      fields: [field('name', 'Model name', 'text', { required: true }), field('technicalName', 'Technical name', 'text', { required: true }), common.status(['draft', 'active', 'archived']), field('viewType', 'Default view', 'select', { options: [option('list'), option('kanban'), option('calendar'), option('form')] }), field('fieldDefinitions', 'Field definitions', 'textarea', { span: 2, hint: 'One field per line: name | label | type.' }), field('approvalRequired', 'Approval required', 'boolean'), common.notes()]
    },
    {
      key: 'accounting', group: 'finance', label: 'Accounting', singular: 'Journal entry', icon: 'invoices', collection: 'journalEntries',
      description: 'Double-entry journals, posting, lock-aware audit history, and financial reporting foundation.',
      titleField: 'reference', statusField: 'status', statuses: ['draft', 'posted', 'reversed'],
      fields: [field('reference', 'Reference', 'text', { required: true }), field('date', 'Entry date', 'date', { required: true }), common.status(['draft', 'posted', 'reversed']), field('journal', 'Journal', 'select', { options: [option('sales'), option('purchase'), option('bank'), option('cash'), option('general')] }), field('account', 'Account', 'text', { required: true }), field('counterAccount', 'Counter account', 'text', { required: true }), field('debit', 'Debit', 'money'), field('credit', 'Credit', 'money'), common.company(), common.branch(), common.notes()]
    },
    {
      key: 'expenses', group: 'finance', label: 'Expenses', singular: 'Expense', icon: 'invoices', collection: 'expenses',
      description: 'Employee expenses, receipts, approvals, reimbursement, and project costing.',
      titleField: 'description', statusField: 'status', statuses: ['draft', 'submitted', 'approved', 'paid', 'rejected'],
      fields: [field('description', 'Expense', 'text', { required: true, span: 2 }), field('employeeId', 'Employee', 'relation', { relation: 'employees' }), field('date', 'Expense date', 'date'), field('category', 'Category', 'select', { options: [option('travel'), option('meal'), option('supplies'), option('lodging'), option('other')] }), field('amount', 'Amount', 'money', { required: true }), common.status(['draft', 'submitted', 'approved', 'paid', 'rejected']), field('projectId', 'Project', 'project'), common.company(), common.branch(), common.notes()]
    },
    {
      key: 'payments', group: 'finance', label: 'Payments', singular: 'Payment', icon: 'check', collection: 'payments',
      description: 'Customer receipts, supplier payments, allocation, reconciliation, and gateway references.',
      titleField: 'reference', statusField: 'status', statuses: ['draft', 'pending', 'completed', 'failed', 'reversed'],
      fields: [field('reference', 'Payment reference', 'text', { required: true }), field('direction', 'Direction', 'select', { options: [option('incoming'), option('outgoing')] }), field('partnerId', 'Partner', 'relation', { relation: 'contacts' }), field('date', 'Payment date', 'date'), field('amount', 'Amount', 'money', { required: true }), field('method', 'Method', 'select', { options: [option('cash'), option('bank'), option('card'), option('wallet'), option('connectips'), option('qr')] }), common.status(['draft', 'pending', 'completed', 'failed', 'reversed']), field('invoiceId', 'Invoice ID', 'text'), common.company(), common.branch(), common.notes()]
    },
    {
      key: 'crm', group: 'sales', label: 'CRM', singular: 'Opportunity', icon: 'team', collection: 'leads',
      description: 'Leads, opportunities, stages, activities, probability, expected revenue, and conversion.',
      titleField: 'name', statusField: 'stage', statuses: ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
      fields: [field('name', 'Opportunity', 'text', { required: true, span: 2 }), field('contactId', 'Customer', 'relation', { relation: 'contacts' }), field('stage', 'Stage', 'select', { options: ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'].map(value => option(value)) }), field('probability', 'Probability %', 'number', { min: 0, max: 100 }), field('expectedRevenue', 'Expected revenue', 'money'), field('expectedClose', 'Expected close', 'date'), common.owner(), common.company(), common.branch(), common.tags(), common.notes()]
    },
    {
      key: 'sales', group: 'sales', label: 'Sales', singular: 'Sales order', icon: 'invoices', collection: 'salesOrders',
      description: 'Quotations, approvals, sales orders, deliveries, invoices, returns, and margins.',
      titleField: 'number', statusField: 'status', statuses: ['quotation', 'sent', 'confirmed', 'delivered', 'invoiced', 'cancelled'],
      fields: [field('number', 'Order number', 'text', { required: true }), field('contactId', 'Customer', 'relation', { relation: 'contacts', required: true }), field('orderDate', 'Order date', 'date'), common.status(['quotation', 'sent', 'confirmed', 'delivered', 'invoiced', 'cancelled']), field('productId', 'Product / service', 'relation', { relation: 'products' }), field('quantity', 'Quantity', 'number', { min: 0, step: 1 }), field('unitPrice', 'Unit price', 'money'), field('discount', 'Discount %', 'number', { min: 0, max: 100 }), field('taxRate', 'VAT %', 'number', { min: 0, max: 100, default: 13 }), field('total', 'Total', 'money'), common.owner(), common.company(), common.branch(), common.notes()]
    },
    {
      key: 'pos', group: 'sales', label: 'Point of Sale', singular: 'POS order', icon: 'grid', collection: 'posOrders',
      description: 'Retail and restaurant orders, sessions, payments, receipts, stock, and cash control.',
      titleField: 'number', statusField: 'status', statuses: ['open', 'paid', 'refunded', 'cancelled'],
      fields: [field('number', 'Receipt number', 'text', { required: true }), field('session', 'Session', 'text'), field('contactId', 'Customer', 'relation', { relation: 'contacts' }), field('productId', 'Product', 'relation', { relation: 'products' }), field('quantity', 'Quantity', 'number', { min: 1, default: 1 }), field('amount', 'Amount', 'money'), field('paymentMethod', 'Payment method', 'select', { options: [option('cash'), option('card'), option('wallet'), option('qr')] }), common.status(['open', 'paid', 'refunded', 'cancelled']), common.branch(), common.notes()]
    },
    {
      key: 'subscriptions', group: 'sales', label: 'Subscriptions', singular: 'Subscription', icon: 'calendar', collection: 'subscriptions',
      description: 'Recurring plans, renewals, invoices, churn, recurring revenue, and customer lifecycle.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'active', 'paused', 'churned', 'closed'],
      fields: [field('name', 'Subscription', 'text', { required: true }), field('contactId', 'Customer', 'relation', { relation: 'contacts' }), field('plan', 'Plan', 'text'), field('interval', 'Billing interval', 'select', { options: [option('monthly'), option('quarterly'), option('yearly')] }), field('amount', 'Recurring amount', 'money'), field('nextInvoiceDate', 'Next invoice date', 'date'), common.status(['draft', 'active', 'paused', 'churned', 'closed']), common.owner(), common.company(), common.notes()]
    },
    {
      key: 'rental', group: 'sales', label: 'Rental', singular: 'Rental order', icon: 'calendar', collection: 'rentals',
      description: 'Reservations, pickup, return, late handling, deposits, and rental billing.',
      titleField: 'number', statusField: 'status', statuses: ['quotation', 'reserved', 'picked-up', 'returned', 'late', 'cancelled'],
      fields: [field('number', 'Rental number', 'text', { required: true }), field('contactId', 'Customer', 'relation', { relation: 'contacts' }), field('productId', 'Rental product', 'relation', { relation: 'products' }), field('startDate', 'Start date', 'date'), field('endDate', 'End date', 'date'), field('deposit', 'Deposit', 'money'), field('amount', 'Rental amount', 'money'), common.status(['quotation', 'reserved', 'picked-up', 'returned', 'late', 'cancelled']), common.branch(), common.notes()]
    },
    {
      key: 'website', group: 'websites', label: 'Website', singular: 'Web page', icon: 'external', collection: 'websitePages',
      description: 'Pages, reusable blocks, menus, publishing, SEO, forms, consent, and multi-site foundation.',
      titleField: 'title', statusField: 'status', statuses: ['draft', 'published', 'scheduled', 'archived'],
      fields: [field('title', 'Page title', 'text', { required: true }), field('slug', 'URL slug', 'text', { required: true }), field('site', 'Website', 'text'), common.status(['draft', 'published', 'scheduled', 'archived']), field('seoTitle', 'SEO title', 'text'), field('seoDescription', 'SEO description', 'textarea', { span: 2 }), field('content', 'Page content', 'textarea', { span: 2 }), common.notes()]
    },
    {
      key: 'ecommerce', group: 'websites', label: 'eCommerce', singular: 'Online order', icon: 'grid', collection: 'ecommerceOrders',
      description: 'Catalog, cart, checkout, delivery, payments, customer accounts, returns, and performance.',
      titleField: 'number', statusField: 'status', statuses: ['cart', 'checkout', 'paid', 'processing', 'shipped', 'delivered', 'returned', 'cancelled'],
      fields: [field('number', 'Order number', 'text', { required: true }), field('contactId', 'Customer', 'relation', { relation: 'contacts' }), field('productId', 'Product', 'relation', { relation: 'products' }), field('quantity', 'Quantity', 'number', { min: 1, default: 1 }), field('amount', 'Amount', 'money'), field('shippingAddress', 'Shipping address', 'textarea', { span: 2 }), common.status(['cart', 'checkout', 'paid', 'processing', 'shipped', 'delivered', 'returned', 'cancelled']), common.notes()]
    },
    {
      key: 'elearning', group: 'websites', label: 'eLearning', singular: 'Course', icon: 'files', collection: 'courses',
      description: 'Courses, lessons, enrolment, quizzes, certification, progress, and completion.',
      titleField: 'title', statusField: 'status', statuses: ['draft', 'published', 'archived'],
      fields: [field('title', 'Course title', 'text', { required: true, span: 2 }), field('instructorId', 'Instructor', 'member'), common.status(['draft', 'published', 'archived']), field('lessonCount', 'Lessons', 'number', { min: 0 }), field('enrolmentCount', 'Enrolments', 'number', { min: 0 }), field('certificate', 'Certificate enabled', 'boolean'), field('description', 'Description', 'textarea', { span: 2 }), common.notes()]
    },
    {
      key: 'forum', group: 'websites', label: 'Forum', singular: 'Forum topic', icon: 'activity', collection: 'forumTopics',
      description: 'Community questions, answers, moderation, tags, reputation, and accepted solutions.',
      titleField: 'title', statusField: 'status', statuses: ['open', 'answered', 'closed', 'moderation'],
      fields: [field('title', 'Topic title', 'text', { required: true, span: 2 }), field('authorId', 'Author', 'relation', { relation: 'contacts' }), common.status(['open', 'answered', 'closed', 'moderation']), common.tags(), field('body', 'Question / discussion', 'textarea', { span: 2 }), common.notes()]
    },
    {
      key: 'blog', group: 'websites', label: 'Blog', singular: 'Blog post', icon: 'files', collection: 'blogPosts',
      description: 'Editorial drafts, publishing, categories, authors, SEO, and engagement.',
      titleField: 'title', statusField: 'status', statuses: ['draft', 'review', 'scheduled', 'published', 'archived'],
      fields: [field('title', 'Post title', 'text', { required: true, span: 2 }), field('authorId', 'Author', 'member'), common.status(['draft', 'review', 'scheduled', 'published', 'archived']), field('publishDate', 'Publish date', 'date'), common.tags(), field('body', 'Article', 'textarea', { span: 2 }), field('seoDescription', 'SEO description', 'textarea', { span: 2 })]
    },
    {
      key: 'livechat', group: 'websites', label: 'Live Chat', singular: 'Conversation', icon: 'mail', collection: 'liveChats',
      description: 'Website conversations, operators, routing, ratings, lead conversion, and ticket conversion.',
      titleField: 'visitor', statusField: 'status', statuses: ['waiting', 'active', 'resolved', 'missed'],
      fields: [field('visitor', 'Visitor / customer', 'text', { required: true }), field('contactId', 'Contact', 'relation', { relation: 'contacts' }), common.status(['waiting', 'active', 'resolved', 'missed']), field('operatorId', 'Operator', 'member'), field('sourcePage', 'Source page', 'url'), field('rating', 'Rating', 'number', { min: 0, max: 5 }), field('transcript', 'Transcript', 'textarea', { span: 2 }), common.notes()]
    },
    {
      key: 'purchase', group: 'supply', label: 'Purchase', singular: 'Purchase order', icon: 'files', collection: 'purchaseOrders',
      description: 'RFQs, purchase orders, approvals, receipts, vendor bills, returns, and landed cost.',
      titleField: 'number', statusField: 'status', statuses: ['rfq', 'sent', 'approved', 'ordered', 'received', 'billed', 'cancelled'],
      fields: [field('number', 'PO number', 'text', { required: true }), field('supplierId', 'Supplier', 'relation', { relation: 'contacts' }), field('orderDate', 'Order date', 'date'), common.status(['rfq', 'sent', 'approved', 'ordered', 'received', 'billed', 'cancelled']), field('productId', 'Product', 'relation', { relation: 'products' }), field('quantity', 'Quantity', 'number', { min: 0 }), field('unitCost', 'Unit cost', 'money'), field('total', 'Total', 'money'), field('warehouseId', 'Destination warehouse', 'relation', { relation: 'warehouses' }), common.company(), common.branch(), common.notes()]
    },
    {
      key: 'inventory', group: 'supply', label: 'Inventory', singular: 'Product', icon: 'folder', collection: 'products',
      description: 'Products, variants, warehouses, locations, replenishment, lots, serials, and valuation.',
      titleField: 'name', statusField: 'status', statuses: ['active', 'discontinued', 'archived'],
      fields: [field('name', 'Product / service', 'text', { required: true, span: 2 }), field('sku', 'SKU', 'text', { required: true }), field('type', 'Product type', 'select', { options: [option('stockable'), option('consumable'), option('service'), option('rental')] }), common.status(['active', 'discontinued', 'archived']), field('category', 'Category', 'text'), field('unit', 'Unit', 'text', { default: 'unit' }), field('salePrice', 'Sales price', 'money'), field('cost', 'Cost', 'money'), field('onHand', 'On hand', 'number'), field('reserved', 'Reserved', 'number'), field('reorderPoint', 'Reorder point', 'number'), field('warehouseId', 'Warehouse', 'relation', { relation: 'warehouses' }), common.company(), common.branch(), common.tags(), common.notes()]
    },
    {
      key: 'barcode', group: 'supply', label: 'Barcode', singular: 'Barcode operation', icon: 'grid', collection: 'barcodeOperations',
      description: 'Scan-driven receipts, deliveries, transfers, counts, lots, and package operations.',
      titleField: 'reference', statusField: 'status', statuses: ['ready', 'in-progress', 'done', 'exception'],
      fields: [field('reference', 'Operation reference', 'text', { required: true }), field('operationType', 'Operation', 'select', { options: [option('receipt'), option('delivery'), option('transfer'), option('inventory-count')] }), field('barcode', 'Barcode', 'text'), field('productId', 'Product', 'relation', { relation: 'products' }), field('quantity', 'Quantity', 'number'), common.status(['ready', 'in-progress', 'done', 'exception']), field('warehouseId', 'Warehouse', 'relation', { relation: 'warehouses' }), common.notes()]
    },
    {
      key: 'manufacturing', group: 'supply', label: 'Manufacturing', singular: 'Manufacturing order', icon: 'settings', collection: 'manufacturingOrders',
      description: 'Bills of materials, production orders, work centres, work orders, scrap, by-products, and cost.',
      titleField: 'number', statusField: 'status', statuses: ['draft', 'confirmed', 'in-progress', 'quality', 'done', 'cancelled'],
      fields: [field('number', 'MO number', 'text', { required: true }), field('productId', 'Finished product', 'relation', { relation: 'products' }), field('bomReference', 'Bill of materials', 'text'), field('quantity', 'Quantity', 'number', { min: 0 }), field('plannedDate', 'Planned date', 'date'), field('workCenter', 'Work centre', 'text'), field('estimatedCost', 'Estimated cost', 'money'), field('actualCost', 'Actual cost', 'money'), common.status(['draft', 'confirmed', 'in-progress', 'quality', 'done', 'cancelled']), common.company(), common.branch(), common.notes()]
    },
    {
      key: 'quality', group: 'supply', label: 'Quality', singular: 'Quality check', icon: 'check', collection: 'qualityChecks',
      description: 'Control points, checks, alerts, pass/fail evidence, corrective actions, and reporting.',
      titleField: 'name', statusField: 'status', statuses: ['pending', 'passed', 'failed', 'corrective-action', 'closed'],
      fields: [field('name', 'Quality check', 'text', { required: true }), field('productId', 'Product', 'relation', { relation: 'products' }), field('operationReference', 'Operation reference', 'text'), field('checkType', 'Check type', 'select', { options: [option('pass-fail'), option('measure'), option('photo'), option('instructions')] }), common.status(['pending', 'passed', 'failed', 'corrective-action', 'closed']), field('measuredValue', 'Measured value', 'text'), field('responsibleId', 'Responsible', 'member'), common.notes()]
    },
    {
      key: 'maintenance', group: 'supply', label: 'Maintenance', singular: 'Maintenance request', icon: 'settings', collection: 'maintenanceRequests',
      description: 'Equipment, preventive schedules, corrective work, downtime, parts, and maintenance cost.',
      titleField: 'name', statusField: 'status', statuses: ['new', 'scheduled', 'in-progress', 'repaired', 'scrapped', 'cancelled'],
      fields: [field('name', 'Request', 'text', { required: true, span: 2 }), field('equipment', 'Equipment', 'text'), field('maintenanceType', 'Type', 'select', { options: [option('preventive'), option('corrective')] }), field('scheduledDate', 'Scheduled date', 'date'), field('technicianId', 'Technician', 'member'), field('cost', 'Cost', 'money'), common.status(['new', 'scheduled', 'in-progress', 'repaired', 'scrapped', 'cancelled']), common.notes()]
    },
    {
      key: 'plm', group: 'supply', label: 'PLM', singular: 'Engineering change', icon: 'settings', collection: 'engineeringChanges',
      description: 'Engineering changes, versions, document control, approvals, and product lifecycle traceability.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'review', 'approved', 'applied', 'rejected'],
      fields: [field('name', 'Engineering change', 'text', { required: true, span: 2 }), field('productId', 'Product', 'relation', { relation: 'products' }), field('currentVersion', 'Current version', 'text'), field('newVersion', 'New version', 'text'), common.status(['draft', 'review', 'approved', 'applied', 'rejected']), field('effectiveDate', 'Effective date', 'date'), field('approverId', 'Approver', 'member'), common.notes()]
    },
    {
      key: 'repairs', group: 'supply', label: 'Repairs', singular: 'Repair order', icon: 'settings', collection: 'repairOrders',
      description: 'Repair intake, parts, labour, warranty, returns, customer approval, and billing.',
      titleField: 'number', statusField: 'status', statuses: ['draft', 'confirmed', 'repairing', 'ready', 'delivered', 'cancelled'],
      fields: [field('number', 'Repair number', 'text', { required: true }), field('contactId', 'Customer', 'relation', { relation: 'contacts' }), field('productId', 'Product', 'relation', { relation: 'products' }), field('serialNumber', 'Serial number', 'text'), field('warranty', 'Warranty', 'boolean'), field('partsCost', 'Parts cost', 'money'), field('labourCost', 'Labour cost', 'money'), common.status(['draft', 'confirmed', 'repairing', 'ready', 'delivered', 'cancelled']), common.notes()]
    },
    {
      key: 'employees', group: 'hr', label: 'Employees', singular: 'Employee', icon: 'team', collection: 'employees',
      description: 'Employee master data, departments, jobs, contracts, documents, skills, and organization structure.',
      titleField: 'name', statusField: 'status', statuses: ['active', 'probation', 'notice', 'inactive'],
      fields: [field('name', 'Employee name', 'text', { required: true, span: 2 }), field('employeeCode', 'Employee code', 'text'), field('email', 'Work email', 'email'), field('phone', 'Phone', 'tel'), field('department', 'Department', 'text'), field('jobTitle', 'Job title', 'text'), field('managerId', 'Manager', 'relation', { relation: 'employees' }), field('joinDate', 'Join date', 'date'), field('salary', 'Base salary', 'money'), common.status(['active', 'probation', 'notice', 'inactive']), common.company(), common.branch(), common.tags(), common.notes()]
    },
    {
      key: 'attendance', group: 'hr', label: 'Attendance', singular: 'Attendance entry', icon: 'calendar', collection: 'attendances',
      description: 'Check-in, check-out, shifts, overtime, kiosks, and attendance exceptions.',
      titleField: 'reference', statusField: 'status', statuses: ['open', 'completed', 'exception', 'approved'],
      fields: [field('reference', 'Reference', 'text', { required: true }), field('employeeId', 'Employee', 'relation', { relation: 'employees' }), field('date', 'Date', 'date'), field('checkIn', 'Check in', 'time'), field('checkOut', 'Check out', 'time'), field('hours', 'Hours', 'number'), field('overtime', 'Overtime hours', 'number'), common.status(['open', 'completed', 'exception', 'approved']), common.branch(), common.notes()]
    },
    {
      key: 'timeoff', group: 'hr', label: 'Time Off', singular: 'Leave request', icon: 'calendar', collection: 'leaveRequests',
      description: 'Leave types, accruals, requests, approvals, holidays, calendars, and balances.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'submitted', 'approved', 'rejected', 'cancelled'],
      fields: [field('name', 'Leave request', 'text', { required: true }), field('employeeId', 'Employee', 'relation', { relation: 'employees' }), field('leaveType', 'Leave type', 'select', { options: [option('annual'), option('sick'), option('maternity'), option('paternity'), option('unpaid'), option('other')] }), field('startDate', 'Start date', 'date'), field('endDate', 'End date', 'date'), field('days', 'Days', 'number'), common.status(['draft', 'submitted', 'approved', 'rejected', 'cancelled']), field('approverId', 'Approver', 'member'), common.notes()]
    },
    {
      key: 'recruitment', group: 'hr', label: 'Recruitment', singular: 'Applicant', icon: 'team', collection: 'applicants',
      description: 'Job positions, applicants, stages, interviews, offers, onboarding, and referrals.',
      titleField: 'name', statusField: 'stage', statuses: ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'],
      fields: [field('name', 'Candidate name', 'text', { required: true }), field('email', 'Email', 'email'), field('phone', 'Phone', 'tel'), field('jobPosition', 'Job position', 'text'), field('stage', 'Stage', 'select', { options: ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'].map(value => option(value)) }), field('source', 'Source', 'text'), field('expectedSalary', 'Expected salary', 'money'), field('interviewerId', 'Interviewer', 'member'), field('interviewDate', 'Interview date', 'date'), common.tags(), common.notes()]
    },
    {
      key: 'appraisals', group: 'hr', label: 'Appraisals', singular: 'Appraisal', icon: 'reports', collection: 'appraisals',
      description: 'Goals, feedback, skills, review cycles, ratings, and development plans.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'employee-input', 'manager-review', 'completed', 'cancelled'],
      fields: [field('name', 'Appraisal', 'text', { required: true }), field('employeeId', 'Employee', 'relation', { relation: 'employees' }), field('reviewerId', 'Reviewer', 'member'), field('reviewDate', 'Review date', 'date'), field('rating', 'Rating', 'number', { min: 0, max: 5 }), common.status(['draft', 'employee-input', 'manager-review', 'completed', 'cancelled']), field('goals', 'Goals and outcomes', 'textarea', { span: 2 }), field('developmentPlan', 'Development plan', 'textarea', { span: 2 })]
    },
    {
      key: 'payroll', group: 'hr', label: 'Payroll', singular: 'Payroll run', icon: 'invoices', collection: 'payrollRuns',
      description: 'Salary structures, payslips, deductions, benefits, loans, accounting, and Nepal statutory foundations.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'computed', 'approved', 'paid', 'cancelled'],
      fields: [field('name', 'Payroll run', 'text', { required: true }), field('periodStart', 'Period start', 'date'), field('periodEnd', 'Period end', 'date'), field('employeeCount', 'Employees', 'number'), field('gross', 'Gross payroll', 'money'), field('tax', 'Income tax', 'money'), field('ssf', 'SSF', 'money'), field('pf', 'Provident fund', 'money'), field('cit', 'CIT', 'money'), field('net', 'Net payroll', 'money'), common.status(['draft', 'computed', 'approved', 'paid', 'cancelled']), common.company(), common.branch(), common.notes()]
    },
    {
      key: 'fleet', group: 'hr', label: 'Fleet', singular: 'Vehicle', icon: 'projects', collection: 'vehicles',
      description: 'Vehicles, drivers, contracts, odometers, fuel, service, insurance, and cost.',
      titleField: 'name', statusField: 'status', statuses: ['active', 'maintenance', 'inactive', 'sold'],
      fields: [field('name', 'Vehicle', 'text', { required: true }), field('plateNumber', 'Plate number', 'text'), field('driverId', 'Driver', 'relation', { relation: 'employees' }), field('model', 'Model', 'text'), field('odometer', 'Odometer', 'number'), field('nextServiceDate', 'Next service', 'date'), field('monthlyCost', 'Monthly cost', 'money'), common.status(['active', 'maintenance', 'inactive', 'sold']), common.company(), common.branch(), common.notes()]
    },
    {
      key: 'frontdesk', group: 'hr', label: 'Front Desk', singular: 'Visitor', icon: 'team', collection: 'visitors',
      description: 'Visitor registration, host notifications, badges, check-in, check-out, and visit history.',
      titleField: 'name', statusField: 'status', statuses: ['expected', 'checked-in', 'checked-out', 'cancelled'],
      fields: [field('name', 'Visitor name', 'text', { required: true }), field('organization', 'Organization', 'text'), field('hostId', 'Host', 'relation', { relation: 'employees' }), field('visitDate', 'Visit date', 'date'), field('checkIn', 'Check in', 'time'), field('checkOut', 'Check out', 'time'), field('purpose', 'Purpose', 'text'), common.status(['expected', 'checked-in', 'checked-out', 'cancelled']), common.branch(), common.notes()]
    },
    {
      key: 'referrals', group: 'hr', label: 'Referrals', singular: 'Referral', icon: 'team', collection: 'referrals',
      description: 'Employee referrals, campaigns, rewards, applicant links, and referral status.',
      titleField: 'candidateName', statusField: 'status', statuses: ['submitted', 'screening', 'interview', 'hired', 'rejected', 'rewarded'],
      fields: [field('candidateName', 'Candidate', 'text', { required: true }), field('referrerId', 'Referrer', 'relation', { relation: 'employees' }), field('jobPosition', 'Job position', 'text'), field('applicantId', 'Applicant', 'relation', { relation: 'applicants' }), field('reward', 'Reward', 'money'), common.status(['submitted', 'screening', 'interview', 'hired', 'rejected', 'rewarded']), common.notes()]
    },
    {
      key: 'lunch', group: 'hr', label: 'Lunch', singular: 'Lunch order', icon: 'calendar', collection: 'lunchOrders',
      description: 'Menus, orders, vendors, delivery, employee deductions, and simple cafeteria reporting.',
      titleField: 'name', statusField: 'status', statuses: ['ordered', 'confirmed', 'delivered', 'cancelled'],
      fields: [field('name', 'Meal', 'text', { required: true }), field('employeeId', 'Employee', 'relation', { relation: 'employees' }), field('vendor', 'Vendor', 'text'), field('date', 'Date', 'date'), field('amount', 'Amount', 'money'), field('salaryDeduction', 'Salary deduction', 'boolean'), common.status(['ordered', 'confirmed', 'delivered', 'cancelled']), common.notes()]
    },
    {
      key: 'emailmarketing', group: 'marketing', label: 'Email Marketing', singular: 'Email campaign', icon: 'mail', collection: 'emailCampaigns',
      description: 'Campaigns, templates, lists, delivery, bounce, unsubscribe, attribution, and reporting.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'],
      fields: [field('name', 'Campaign', 'text', { required: true }), field('subject', 'Subject', 'text'), field('audience', 'Audience / segment', 'text'), field('scheduledDate', 'Scheduled date', 'date'), field('sentCount', 'Sent', 'number'), field('openRate', 'Open rate %', 'number'), field('clickRate', 'Click rate %', 'number'), common.status(['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled']), field('content', 'Email content', 'textarea', { span: 2 }), common.notes()]
    },
    {
      key: 'smsmarketing', group: 'marketing', label: 'SMS Marketing', singular: 'SMS campaign', icon: 'mail', collection: 'smsCampaigns',
      description: 'SMS campaigns, segments, scheduling, delivery, opt-out, cost, and attribution.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'],
      fields: [field('name', 'Campaign', 'text', { required: true }), field('audience', 'Audience / segment', 'text'), field('scheduledDate', 'Scheduled date', 'date'), field('sentCount', 'Sent', 'number'), field('deliveryRate', 'Delivery rate %', 'number'), field('cost', 'Cost', 'money'), common.status(['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled']), field('message', 'Message', 'textarea', { span: 2 })]
    },
    {
      key: 'marketingautomation', group: 'marketing', label: 'Marketing Automation', singular: 'Journey', icon: 'settings', collection: 'marketingJourneys',
      description: 'Segments, triggers, journeys, scoring, branching, campaigns, and attribution.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'active', 'paused', 'completed', 'archived'],
      fields: [field('name', 'Journey', 'text', { required: true }), field('segment', 'Target segment', 'text'), field('trigger', 'Entry trigger', 'text'), field('steps', 'Journey steps', 'textarea', { span: 2 }), field('enrolled', 'Enrolled', 'number'), field('converted', 'Converted', 'number'), common.status(['draft', 'active', 'paused', 'completed', 'archived']), common.notes()]
    },
    {
      key: 'events', group: 'marketing', label: 'Events', singular: 'Event', icon: 'calendar', collection: 'marketingEvents',
      description: 'Registration, tickets, attendees, sponsors, booths, check-in, communication, and reporting.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'published', 'registration-open', 'live', 'completed', 'cancelled'],
      fields: [field('name', 'Event name', 'text', { required: true, span: 2 }), field('startDate', 'Start date', 'date'), field('endDate', 'End date', 'date'), field('venue', 'Venue', 'text'), field('capacity', 'Capacity', 'number'), field('registered', 'Registered', 'number'), field('ticketRevenue', 'Ticket revenue', 'money'), common.status(['draft', 'published', 'registration-open', 'live', 'completed', 'cancelled']), common.notes()]
    },
    {
      key: 'marketingcards', group: 'marketing', label: 'Marketing Cards', singular: 'Marketing card', icon: 'image', collection: 'marketingCards',
      description: 'Personalized visual campaigns, templates, recipient data, previews, and export.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'ready', 'generated', 'archived'],
      fields: [field('name', 'Card campaign', 'text', { required: true }), field('template', 'Template', 'text'), field('audience', 'Audience', 'text'), field('personalizationFields', 'Personalization fields', 'textarea', { span: 2 }), field('generatedCount', 'Generated cards', 'number'), common.status(['draft', 'ready', 'generated', 'archived']), common.notes()]
    },
    {
      key: 'surveys', group: 'marketing', label: 'Surveys', singular: 'Survey', icon: 'check', collection: 'surveys',
      description: 'Questions, scoring, certification, invitations, responses, and analysis.',
      titleField: 'title', statusField: 'status', statuses: ['draft', 'open', 'closed', 'archived'],
      fields: [field('title', 'Survey title', 'text', { required: true, span: 2 }), field('surveyType', 'Survey type', 'select', { options: [option('survey'), option('quiz'), option('certification'), option('feedback')] }), field('questionCount', 'Questions', 'number'), field('responseCount', 'Responses', 'number'), field('averageScore', 'Average score', 'number'), common.status(['draft', 'open', 'closed', 'archived']), field('instructions', 'Instructions', 'textarea', { span: 2 }), common.notes()]
    },
    {
      key: 'timesheets', group: 'services', label: 'Timesheets', singular: 'Timesheet entry', icon: 'calendar', collection: 'timesheetEntries',
      description: 'Time entries, approval, billing, utilisation, project cost, and employee reporting.',
      titleField: 'description', statusField: 'status', statuses: ['draft', 'submitted', 'approved', 'rejected'],
      fields: [field('description', 'Work description', 'text', { required: true, span: 2 }), field('employeeId', 'Employee', 'relation', { relation: 'employees' }), field('projectId', 'Project', 'project'), field('taskId', 'Task ID', 'text'), field('date', 'Date', 'date'), field('hours', 'Hours', 'number', { min: 0, step: .25 }), field('billable', 'Billable', 'boolean'), common.status(['draft', 'submitted', 'approved', 'rejected']), common.notes()]
    },
    {
      key: 'planning', group: 'services', label: 'Planning', singular: 'Planning slot', icon: 'calendar', collection: 'planningSlots',
      description: 'Resource allocation, shifts, capacity, conflicts, availability, and forecasting.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'published', 'confirmed', 'completed', 'cancelled'],
      fields: [field('name', 'Allocation', 'text', { required: true }), field('employeeId', 'Resource', 'relation', { relation: 'employees' }), field('projectId', 'Project', 'project'), field('startDate', 'Start date', 'date'), field('endDate', 'End date', 'date'), field('hours', 'Allocated hours', 'number'), field('role', 'Role', 'text'), common.status(['draft', 'published', 'confirmed', 'completed', 'cancelled']), common.notes()]
    },
    {
      key: 'fieldservice', group: 'services', label: 'Field Service', singular: 'Field service order', icon: 'projects', collection: 'fieldServiceOrders',
      description: 'Scheduling, route planning, worksheets, products, signatures, time, and invoicing.',
      titleField: 'number', statusField: 'status', statuses: ['new', 'scheduled', 'en-route', 'on-site', 'completed', 'cancelled'],
      fields: [field('number', 'Service order', 'text', { required: true }), field('contactId', 'Customer', 'relation', { relation: 'contacts' }), field('technicianId', 'Technician', 'relation', { relation: 'employees' }), field('scheduledDate', 'Scheduled date', 'date'), field('address', 'Service address', 'textarea', { span: 2 }), field('productId', 'Product / part', 'relation', { relation: 'products' }), field('amount', 'Billable amount', 'money'), common.status(['new', 'scheduled', 'en-route', 'on-site', 'completed', 'cancelled']), common.notes()]
    },
    {
      key: 'helpdesk', group: 'services', label: 'Helpdesk', singular: 'Ticket', icon: 'mail', collection: 'tickets',
      description: 'Tickets, teams, channels, SLAs, escalation, customer rating, knowledge, and billing.',
      titleField: 'subject', statusField: 'status', statuses: ['new', 'in-progress', 'waiting', 'escalated', 'resolved', 'closed'],
      fields: [field('subject', 'Ticket subject', 'text', { required: true, span: 2 }), field('contactId', 'Customer', 'relation', { relation: 'contacts' }), field('team', 'Team', 'text'), field('priority', 'Priority', 'select', { options: [option('low'), option('medium'), option('high'), option('urgent')] }), field('assignedTo', 'Assigned to', 'member'), field('slaDue', 'SLA due', 'date'), field('rating', 'Rating', 'number', { min: 0, max: 5 }), common.status(['new', 'in-progress', 'waiting', 'escalated', 'resolved', 'closed']), field('description', 'Description', 'textarea', { span: 2 }), common.notes()]
    },
    {
      key: 'appointments', group: 'services', label: 'Appointments', singular: 'Appointment', icon: 'calendar', collection: 'appointments',
      description: 'Availability, booking, resources, reminders, payments, and customer self-service.',
      titleField: 'name', statusField: 'status', statuses: ['requested', 'confirmed', 'completed', 'no-show', 'cancelled'],
      fields: [field('name', 'Appointment', 'text', { required: true }), field('contactId', 'Customer', 'relation', { relation: 'contacts' }), field('resourceId', 'Resource', 'relation', { relation: 'employees' }), field('date', 'Date', 'date'), field('time', 'Time', 'time'), field('duration', 'Duration minutes', 'number'), field('amount', 'Payment amount', 'money'), common.status(['requested', 'confirmed', 'completed', 'no-show', 'cancelled']), common.notes()]
    },
    {
      key: 'documents', group: 'productivity', label: 'Documents', singular: 'Document', icon: 'files', collection: 'documents',
      description: 'Enterprise document workspaces, tags, requests, workflows, extraction, and record links.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'requested', 'received', 'validated', 'archived'],
      fields: [field('name', 'Document name', 'text', { required: true }), field('documentType', 'Document type', 'text'), field('workspace', 'Workspace / folder', 'text'), field('relatedModule', 'Related app', 'module'), field('relatedRecordId', 'Related record', 'text'), field('expiryDate', 'Expiry date', 'date'), common.status(['draft', 'requested', 'received', 'validated', 'archived']), common.tags(), common.notes()]
    },
    {
      key: 'sign', group: 'productivity', label: 'Sign', singular: 'Signature request', icon: 'check', collection: 'signatureRequests',
      description: 'Templates, recipients, authentication, reminders, signatures, evidence, and completion.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'sent', 'viewed', 'partially-signed', 'completed', 'declined', 'expired'],
      fields: [field('name', 'Request name', 'text', { required: true }), field('documentId', 'Document', 'relation', { relation: 'documents' }), field('recipientId', 'Recipient', 'relation', { relation: 'contacts' }), field('sentDate', 'Sent date', 'date'), field('expiryDate', 'Expiry date', 'date'), field('authentication', 'Authentication', 'select', { options: [option('email'), option('sms'), option('otp'), option('in-person')] }), common.status(['draft', 'sent', 'viewed', 'partially-signed', 'completed', 'declined', 'expired']), common.notes()]
    },
    {
      key: 'spreadsheet', group: 'productivity', label: 'Spreadsheet', singular: 'Spreadsheet', icon: 'reports', collection: 'spreadsheets',
      description: 'Linked business data, formulas, pivots, charts, global filters, and collaborative analysis.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'shared', 'published', 'archived'],
      fields: [field('name', 'Spreadsheet name', 'text', { required: true }), field('sourceModule', 'Source app', 'module'), field('viewType', 'Analysis type', 'select', { options: [option('table'), option('pivot'), option('chart'), option('dashboard')] }), field('filters', 'Global filters', 'textarea', { span: 2 }), field('formulaNotes', 'Formula / model notes', 'textarea', { span: 2 }), common.status(['draft', 'shared', 'published', 'archived']), common.notes()]
    },
    {
      key: 'dashboards', group: 'productivity', label: 'Dashboards', singular: 'Dashboard', icon: 'dashboard', collection: 'customDashboards',
      description: 'Configurable KPIs, drill-downs, charts, filters, sharing, and executive reporting.',
      titleField: 'name', statusField: 'status', statuses: ['draft', 'published', 'archived'],
      fields: [field('name', 'Dashboard name', 'text', { required: true }), field('audience', 'Audience', 'text'), field('widgets', 'Widgets / KPIs', 'textarea', { span: 2 }), field('filters', 'Global filters', 'textarea', { span: 2 }), common.status(['draft', 'published', 'archived']), common.notes()]
    },
    {
      key: 'knowledge', group: 'productivity', label: 'Knowledge', singular: 'Article', icon: 'files', collection: 'knowledgeArticles',
      description: 'Collaborative articles, hierarchy, permissions, templates, backlinks, and record context.',
      titleField: 'title', statusField: 'status', statuses: ['draft', 'review', 'published', 'archived'],
      fields: [field('title', 'Article title', 'text', { required: true, span: 2 }), field('parentArticleId', 'Parent article', 'relation', { relation: 'knowledgeArticles' }), field('authorId', 'Author', 'member'), field('visibility', 'Visibility', 'select', { options: [option('workspace'), option('team'), option('private'), option('public')] }), common.status(['draft', 'review', 'published', 'archived']), common.tags(), field('content', 'Article content', 'textarea', { span: 2 }), common.notes()]
    },
    {
      key: 'discuss', group: 'productivity', label: 'Discuss', singular: 'Channel', icon: 'mail', collection: 'channels',
      description: 'Channels, direct messages, mentions, record conversations, calls, and team coordination.',
      titleField: 'name', statusField: 'status', statuses: ['active', 'muted', 'archived'],
      fields: [field('name', 'Channel name', 'text', { required: true }), field('channelType', 'Channel type', 'select', { options: [option('team'), option('project'), option('topic'), option('direct')] }), field('memberIds', 'Members', 'tags', { span: 2 }), common.status(['active', 'muted', 'archived']), field('description', 'Description', 'textarea', { span: 2 }), common.notes()]
    },
    {
      key: 'datacleaning', group: 'productivity', label: 'Data Cleaning', singular: 'Cleaning rule', icon: 'check', collection: 'cleaningRules',
      description: 'Deduplication, merge, normalization, validation, archival, and data quality monitoring.',
      titleField: 'name', statusField: 'status', statuses: ['active', 'paused', 'completed', 'error'],
      fields: [field('name', 'Rule name', 'text', { required: true }), field('targetModule', 'Target app', 'module'), field('matchFields', 'Match fields', 'text'), field('action', 'Action', 'select', { options: [option('flag'), option('merge'), option('normalize'), option('archive')] }), field('lastRun', 'Last run', 'date'), field('recordsAffected', 'Records affected', 'number'), common.status(['active', 'paused', 'completed', 'error']), common.notes()]
    }
  ];

  const NATIVE_APPS = [
    { key: 'projects', group: 'services', label: 'Projects', icon: 'projects', nativeRoute: 'projects', description: 'Connected project delivery with Jira-style work, time, billing, files, and reporting.' },
    { key: 'calendar', group: 'productivity', label: 'Calendar', icon: 'calendar', nativeRoute: 'calendar', description: 'BS-first scheduling, events, reviews, deadlines, and reminders.' },
    { key: 'files', group: 'productivity', label: 'Files', icon: 'files', nativeRoute: 'files', description: 'Secure workspace files and folders.' },
    { key: 'invoices', group: 'finance', label: 'Nepal Invoicing', icon: 'invoices', nativeRoute: 'invoices', description: 'PAN, VAT, Nepal fiscal year, BS dates, payments, and compliance-ready invoice workflows.' },
    { key: 'team', group: 'hr', label: 'Workspace Access', icon: 'team', nativeRoute: 'team', description: 'Workspace membership and access roles.' },
    { key: 'email', group: 'productivity', label: 'Mailbox', icon: 'mail', nativeRoute: 'email', description: 'Shared workspace messages, drafts, folders, and attachments.' }
  ];

  const modulesByKey = new Map(MODULES.map(module => [module.key, module]));
  const allApps = [...NATIVE_APPS, ...MODULES];
  const appByKey = key => allApps.find(app => app.key === key) || null;
  const moduleByRoute = route => MODULES.find(module => `erp-${module.key}` === route) || null;

  function defaultCompany() {
    return {
      id: 'company-default',
      name: state?.settings?.workspaceName || 'Primary company',
      legalName: state?.settings?.workspaceName || 'Primary company',
      panVat: '',
      currency: 'NPR',
      country: 'NP',
      timezone: 'Asia/Kathmandu',
      active: true,
      createdAt: now()
    };
  }

  function defaultBranch(companyId = 'company-default') {
    return {
      id: 'branch-main',
      companyId,
      name: 'Main branch',
      code: 'MAIN',
      address: '',
      active: true,
      createdAt: now()
    };
  }

  function ensureERPState() {
    if (!state || typeof state !== 'object') return null;
    state.erp = object(state.erp);
    state.erp.version = VERSION;
    state.erp.records = object(state.erp.records);
    state.erp.settings = object(state.erp.settings);
    state.erp.settings.companies = arr(state.erp.settings.companies);
    if (!state.erp.settings.companies.length) state.erp.settings.companies.push(defaultCompany());
    state.erp.settings.branches = arr(state.erp.settings.branches);
    if (!state.erp.settings.branches.length) state.erp.settings.branches.push(defaultBranch(state.erp.settings.companies[0].id));
    state.erp.settings.activeCompanyId = state.erp.settings.activeCompanyId || state.erp.settings.companies[0].id;
    state.erp.settings.activeBranchId = state.erp.settings.activeBranchId || state.erp.settings.branches[0].id;
    state.erp.settings.favorites = arr(state.erp.settings.favorites);
    state.erp.settings.recentApps = arr(state.erp.settings.recentApps);
    state.erp.settings.savedViews = object(state.erp.settings.savedViews);
    state.erp.settings.sequence = object(state.erp.settings.sequence);
    state.erp.settings.currency = state.erp.settings.currency || 'NPR';
    state.erp.settings.locale = state.erp.settings.locale || 'en-NP';
    MODULES.forEach(module => {
      state.erp.records[module.collection] = arr(state.erp.records[module.collection]);
    });
    state.erp.records.warehouses = arr(state.erp.records.warehouses);
    if (!state.erp.records.warehouses.length) {
      state.erp.records.warehouses.push({
        id: 'warehouse-main',
        name: 'Main warehouse',
        code: 'WH',
        companyId: state.erp.settings.activeCompanyId,
        branchId: state.erp.settings.activeBranchId,
        status: 'active',
        createdAt: now(), updatedAt: now(), archived: false, notes: '', tags: [], comments: [], activities: []
      });
    }
    state.erp.records.stockMoves = arr(state.erp.records.stockMoves);
    state.erp.records.vendorBills = arr(state.erp.records.vendorBills);
    state.erp.records.assets = arr(state.erp.records.assets);
    state.erp.records.budgets = arr(state.erp.records.budgets);
    state.erp.records.priceLists = arr(state.erp.records.priceLists);
    state.erp.records.lots = arr(state.erp.records.lots);
    state.erp.records.boms = arr(state.erp.records.boms);
    state.erp.records.customRecords = object(state.erp.records.customRecords);
    if (!ui.erp || typeof ui.erp !== 'object') {
      ui.erp = {
        launcherQuery: '',
        launcherGroup: 'all',
        moduleQuery: '',
        status: 'all',
        view: 'list',
        archived: false,
        record: null,
        tab: 'overview'
      };
    }
    return state.erp;
  }

  function collection(nameOrModule) {
    ensureERPState();
    const name = typeof nameOrModule === 'string'
      ? modulesByKey.get(nameOrModule)?.collection || nameOrModule
      : nameOrModule?.collection;
    if (!name) return [];
    state.erp.records[name] = arr(state.erp.records[name]);
    return state.erp.records[name];
  }

  function nextSequence(key, prefix = '') {
    ensureERPState();
    const current = num(state.erp.settings.sequence[key]);
    const next = current + 1;
    state.erp.settings.sequence[key] = next;
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  function makeRecord(module, values = {}) {
    ensureERPState();
    const companyId = values.companyId || state.erp.settings.activeCompanyId;
    const branchId = values.branchId || state.erp.settings.activeBranchId;
    const result = {
      id: values.id || uid(),
      module: module.key,
      companyId,
      branchId,
      archived: false,
      tags: [],
      comments: [],
      activities: [],
      followers: [],
      createdAt: now(),
      updatedAt: now(),
      createdBy: window.FormcraftBackend?.session?.user?.id || '',
      ...values
    };
    if (!result[module.statusField || 'status']) {
      result[module.statusField || 'status'] = module.statuses?.[0] || 'draft';
    }
    module.fields.forEach(schema => {
      if (result[schema.name] === undefined && schema.default !== undefined) result[schema.name] = schema.default;
      if (schema.type === 'tags') result[schema.name] = arr(result[schema.name]);
      if (schema.type === 'boolean') result[schema.name] = Boolean(result[schema.name]);
      if (['number', 'money'].includes(schema.type)) result[schema.name] = num(result[schema.name]);
    });
    return result;
  }

  function companyName(id) {
    ensureERPState();
    return state.erp.settings.companies.find(item => item.id === id)?.name || 'Company';
  }

  function branchName(id) {
    ensureERPState();
    return state.erp.settings.branches.find(item => item.id === id)?.name || 'Branch';
  }

  function memberName(id) {
    return state.team?.find(member => member.id === id || member.userId === id)?.name || 'Unassigned';
  }

  function relatedTitle(collectionName, id) {
    if (!id) return '—';
    const relatedModule = MODULES.find(module => module.collection === collectionName);
    const item = collection(collectionName).find(record => record.id === id);
    if (!item) return 'Unknown';
    const titleField = relatedModule?.titleField || 'name';
    return item[titleField] || item.name || item.title || item.number || item.reference || id;
  }

  function fieldValue(module, record, schema) {
    const value = record?.[schema.name];
    if (value === null || value === undefined || value === '') return '—';
    if (schema.type === 'money') {
      const currency = record.currency || state.erp?.settings?.currency || 'NPR';
      try { return new Intl.NumberFormat('en-NP', { style: 'currency', currency, maximumFractionDigits: 2 }).format(num(value)); }
      catch { return `${currency} ${round(value).toFixed(2)}`; }
    }
    if (schema.type === 'number') return String(value);
    if (schema.type === 'date') {
      if (typeof dualDate === 'function') return dualDate(value, { short: true });
      return typeof formatDate === 'function' ? formatDate(value) : value;
    }
    if (schema.type === 'boolean') return value ? 'Yes' : 'No';
    if (schema.type === 'member') return memberName(value);
    if (schema.type === 'company') return companyName(value);
    if (schema.type === 'branch') return branchName(value);
    if (schema.type === 'project') return state.projects?.find(project => project.id === value)?.name || '—';
    if (schema.type === 'relation') return relatedTitle(schema.relation, value);
    if (schema.type === 'module') return appByKey(value)?.label || title(value);
    if (schema.type === 'tags') return arr(value).join(', ') || '—';
    return String(value);
  }

  function titleFor(module, record) {
    return record?.[module.titleField] || record?.name || record?.title || record?.number || record?.reference || module.singular;
  }

  function statusFor(module, record) {
    return record?.[module.statusField || 'status'] || module.statuses?.[0] || 'draft';
  }

  function canEdit() {
    if (window.FormcraftOpsCore?.canEdit) return window.FormcraftOpsCore.canEdit();
    return ['owner', 'admin', 'editor'].includes(window.FormcraftBackend?.role || 'viewer');
  }

  function recordAudit(module, record, action, detail = '') {
    const entry = {
      id: uid(),
      action,
      detail,
      at: now(),
      userId: window.FormcraftBackend?.session?.user?.id || '',
      userName: typeof currentUserName === 'function' ? currentUserName() : 'Workspace member'
    };
    record.audit = arr(record.audit);
    record.audit.unshift(entry);
    record.updatedAt = entry.at;
    if (typeof logActivity === 'function') {
      logActivity(`erp-${module.key}`, `${module.singular}: ${action}`, `${titleFor(module, record)}${detail ? ` · ${detail}` : ''}`);
    }
    return entry;
  }

  function rememberApp(key) {
    ensureERPState();
    state.erp.settings.recentApps = [key, ...state.erp.settings.recentApps.filter(item => item !== key)].slice(0, 8);
  }

  function toggleFavorite(key) {
    ensureERPState();
    const favorites = new Set(state.erp.settings.favorites);
    favorites.has(key) ? favorites.delete(key) : favorites.add(key);
    state.erp.settings.favorites = [...favorites];
    return favorites.has(key);
  }

  function sum(collectionName, selector) {
    return collection(collectionName).reduce((total, item) => total + num(selector(item)), 0);
  }

  function moduleMetrics(module) {
    const records = collection(module).filter(record => !record.archived);
    const statusField = module.statusField || 'status';
    const completedStatuses = new Set(['done', 'completed', 'closed', 'won', 'paid', 'posted', 'approved', 'delivered', 'received', 'billed', 'published', 'resolved', 'returned', 'hired', 'generated']);
    const completed = records.filter(record => completedStatuses.has(record[statusField])).length;
    const value = records.reduce((total, record) => total + num(record.total ?? record.amount ?? record.expectedRevenue ?? record.ticketRevenue ?? record.gross ?? record.net ?? record.cost), 0);
    const overdue = records.filter(record => {
      const date = record.dueDate || record.expectedClose || record.slaDue || record.nextInvoiceDate || record.expiryDate || record.endDate;
      return date && !completedStatuses.has(record[statusField]) && date < dateKey(today());
    }).length;
    return { total: records.length, completed, active: records.length - completed, value: round(value), overdue };
  }

  function relationOptions(collectionName) {
    const relatedModule = MODULES.find(module => module.collection === collectionName);
    return collection(collectionName)
      .filter(record => !record.archived)
      .map(record => [record.id, titleFor(relatedModule || { titleField: 'name', singular: 'Record' }, record)]);
  }

  function moduleOptions() {
    return allApps.map(app => [app.key, app.label]);
  }

  window.FormcraftERP = Object.freeze({
    VERSION,
    GROUPS,
    MODULES,
    NATIVE_APPS,
    allApps,
    modulesByKey,
    appByKey,
    moduleByRoute,
    ensureERPState,
    collection,
    nextSequence,
    makeRecord,
    companyName,
    branchName,
    memberName,
    relatedTitle,
    fieldValue,
    titleFor,
    statusFor,
    canEdit,
    recordAudit,
    rememberApp,
    toggleFavorite,
    moduleMetrics,
    relationOptions,
    moduleOptions,
    arr,
    object,
    num,
    round,
    slug,
    title,
    now,
    sum
  });
})();
