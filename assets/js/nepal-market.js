'use strict';

(() => {
  const MARKET_VERSION = 'NP-2083.1';
  const NEPAL_TIME_ZONE = 'Asia/Kathmandu';
  const NEPAL_LOCALE = 'en-NP';
  const DEFAULT_VAT_RATE = 13;
  const BS_MONTHS = ['Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashoj', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
  const DOCUMENT_LABELS = {
    invoice: 'Invoice',
    'tax-invoice': 'Tax Invoice',
    'credit-note': 'Credit Note',
    'debit-note': 'Debit Note',
    proforma: 'Proforma Invoice'
  };
  const ISSUED_STATUSES = new Set(['sent', 'paid', 'overdue']);
  const OFFICIAL_HOLIDAYS_2083 = [
    { month: 1, day: 1, name: 'Nepali New Year', scope: 'national' },
    { month: 1, day: 18, name: 'Buddha Jayanti / Labour Day', scope: 'national' },
    { month: 2, day: 15, name: 'Republic Day', scope: 'national' },
    { month: 5, day: 12, name: 'Raksha Bandhan', scope: 'national' },
    { month: 5, day: 19, name: 'Krishna Janmashtami', scope: 'national' },
    { month: 6, day: 3, name: 'Constitution Day', scope: 'national' },
    { month: 6, day: 25, name: 'Ghatasthapana', scope: 'national' },
    { month: 6, day: 31, name: 'Dashain holiday', scope: 'national' },
    { month: 7, day: 1, name: 'Dashain holiday', scope: 'national' },
    { month: 7, day: 2, name: 'Dashain holiday', scope: 'national' },
    { month: 7, day: 3, name: 'Dashain holiday', scope: 'national' },
    { month: 7, day: 4, name: 'Dashain holiday', scope: 'national' },
    { month: 7, day: 5, name: 'Dashain holiday', scope: 'national' },
    { month: 7, day: 6, name: 'Dashain holiday', scope: 'national' },
    { month: 7, day: 22, name: 'Tihar holiday', scope: 'national' },
    { month: 7, day: 23, name: 'Tihar holiday', scope: 'national' },
    { month: 7, day: 24, name: 'Tihar holiday', scope: 'national' },
    { month: 7, day: 25, name: 'Tihar holiday', scope: 'national' },
    { month: 7, day: 26, name: 'Tihar holiday', scope: 'national' },
    { month: 7, day: 29, name: 'Chhath', scope: 'national' },
    { month: 9, day: 9, name: 'Udhauli / Yomari Punhi', scope: 'national' },
    { month: 9, day: 10, name: 'Christmas Day', scope: 'national' },
    { month: 9, day: 15, name: 'Tamu Lhosar', scope: 'national' },
    { month: 9, day: 27, name: 'Prithvi Jayanti / National Unity Day', scope: 'observance' },
    { month: 10, day: 1, name: 'Maghe Sankranti / Maghi', scope: 'national' },
    { month: 10, day: 16, name: 'Martyrs Day', scope: 'national' },
    { month: 10, day: 24, name: 'Sonam Lhosar', scope: 'national' },
    { month: 11, day: 7, name: 'Democracy Day', scope: 'national' },
    { month: 11, day: 22, name: 'Maha Shivaratri', scope: 'national' },
    { month: 11, day: 24, name: "International Women's Day", scope: 'national' },
    { month: 11, day: 25, name: 'Gyalpo Lhosar', scope: 'national' },
    { month: 12, day: 23, name: 'Ghode Jatra', scope: 'Kathmandu Valley' }
  ];
  const LEGAL_SOURCES = [
    { label: 'VAT Act 2052, amended through Finance Act 2082', url: 'https://ird.gov.np/category/valueaddedtaxact/' },
    { label: 'VAT Rules: invoice and record requirements', url: 'https://repository.lawcommission.gov.np/np/category/documents/prevailing-law/rules-and-regulations/' },
    { label: 'IRD Electronic Billing Procedure 2074 and enlisted software', url: 'https://ird.gov.np/content/9368/notice-17599213073/' },
    { label: 'Ministry of Home Affairs public holidays 2083', url: 'https://moha.gov.np/en/page/government-and-public-holidays-in-2083' }
  ];

  const originalRenderShell = renderShell;
  const originalConfirmDelete = confirmDelete;
  let holidayCache = null;
  let marketEnhancementQueued = false;

  function nepaliDateConstructor() {
    const candidate = globalThis.NepaliDate;
    return candidate?.default || candidate || null;
  }

  function nepalNow() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: NEPAL_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date()).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
    return new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+05:45`);
  }

  function nepalDateKey(value = nepalNow()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: NEPAL_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(value).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function parseAdDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (!value) return nepalNow();
    const text = String(value);
    return new Date(text.includes('T') ? text : `${text}T12:00:00+05:45`);
  }

  function toBsParts(value) {
    const NepaliDate = nepaliDateConstructor();
    if (!NepaliDate) return null;
    try {
      const converted = new NepaliDate(parseAdDate(value));
      const formatted = typeof converted.format === 'function' ? converted.format('YYYY-MM-DD') : '';
      const match = String(formatted).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
      if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
      const year = Number(converted.getYear?.());
      const rawMonth = Number(converted.getMonth?.());
      const day = Number(converted.getDate?.());
      if (Number.isFinite(year) && Number.isFinite(rawMonth) && Number.isFinite(day)) return { year, month: rawMonth + 1, day };
    } catch (error) {
      console.warn('Unable to convert AD date to BS.', error);
    }
    return null;
  }

  function bsToAdKey(year, month, day) {
    const NepaliDate = nepaliDateConstructor();
    if (!NepaliDate) return null;
    try {
      const converted = new NepaliDate(year, month - 1, day);
      const jsDate = converted.toJsDate?.();
      if (!(jsDate instanceof Date) || Number.isNaN(jsDate.getTime())) return null;
      return dateKey(jsDate);
    } catch (error) {
      return null;
    }
  }

  function bsLabel(value, compact = false) {
    const bs = toBsParts(value);
    if (!bs) return '';
    if (compact) return `${bs.month}/${bs.day}`;
    return `${BS_MONTHS[bs.month - 1]} ${bs.day}, ${bs.year} BS`;
  }

  function dualDate(value, options = {}) {
    if (!value) return '-';
    const adDate = parseAdDate(value);
    const ad = new Intl.DateTimeFormat(NEPAL_LOCALE, {
      timeZone: NEPAL_TIME_ZONE,
      year: options.short ? undefined : 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(adDate);
    const system = state.settings?.dateSystem || 'dual';
    if (system === 'ad') return ad;
    const bs = bsLabel(adDate);
    if (!bs) return ad;
    return system === 'bs' ? bs : `${ad} / ${bs}`;
  }

  function fiscalYearFor(value = nepalNow()) {
    const bs = toBsParts(value);
    if (!bs) return state.settings?.compliance?.fiscalYear || '2083/84';
    const start = bs.month >= 4 ? bs.year : bs.year - 1;
    return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
  }

  function nprMoney(value, currency = 'NPR') {
    const amount = Number(value) || 0;
    try {
      return new Intl.NumberFormat(NEPAL_LOCALE, {
        style: 'currency',
        currency: currency || 'NPR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      return `NPR ${amount.toFixed(2)}`;
    }
  }

  function businessDefaults() {
    return {
      legalName: state.settings?.workspaceName || '',
      tradingName: '',
      address: '',
      municipality: '',
      district: '',
      province: 'Koshi',
      pan: '',
      vatRegistered: false,
      vatNumber: '',
      phone: '',
      email: '',
      invoicePrefix: 'INV',
      paymentTermsDays: 15,
      eBillingApproved: false,
      eBillingApprovalReference: '',
      bankName: '',
      bankAccountName: '',
      bankAccountNumber: '',
      paymentInstructions: ''
    };
  }

  function taxDefaults() {
    return { vatRate: DEFAULT_VAT_RATE, pricesIncludeVat: false, tdsEnabled: false, tdsRate: 0 };
  }

  function complianceDefaults() {
    return {
      marketVersion: MARKET_VERSION,
      jurisdiction: 'Nepal',
      fiscalYear: fiscalYearFor(),
      holidayYear: 2083,
      legalReviewDate: '2026-08-02',
      recordRetentionYears: 6,
      disclaimerAccepted: false
    };
  }

  function ensureNepalState() {
    if (!state || typeof state !== 'object') return;
    state.settings ||= {};
    const firstMigration = state.settings.compliance?.marketVersion !== MARKET_VERSION;
    if (firstMigration && (!state.settings.currency || state.settings.currency === 'USD')) state.settings.currency = 'NPR';
    state.settings.market = 'NP';
    state.settings.currency ||= 'NPR';
    state.settings.locale ||= NEPAL_LOCALE;
    state.settings.timeZone = NEPAL_TIME_ZONE;
    state.settings.dateSystem ||= 'dual';
    state.settings.weekStartsOn = 0;
    state.settings.weekendDays = [6];
    state.settings.business = { ...businessDefaults(), ...(state.settings.business || {}) };
    state.settings.tax = { ...taxDefaults(), ...(state.settings.tax || {}) };
    state.settings.compliance = { ...complianceDefaults(), ...(state.settings.compliance || {}), marketVersion: MARKET_VERSION };
    state.settings.compliance.fiscalYear = fiscalYearFor();
    state.holidays = Array.isArray(state.holidays) ? state.holidays : [];
    state.invoices = (state.invoices || []).map(normaliseInvoice);
  }

  function invoiceSequence(documentType = 'invoice', fiscalYear = fiscalYearFor()) {
    const prefixMap = { 'credit-note': 'CN', 'debit-note': 'DN', proforma: 'PRO', 'tax-invoice': state.settings.business.invoicePrefix || 'INV', invoice: state.settings.business.invoicePrefix || 'INV' };
    const prefix = prefixMap[documentType] || 'INV';
    const fiscalToken = fiscalYear.replace('/', '-');
    const expression = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-${fiscalToken}-(\\d+)$`, 'i');
    const maximum = state.invoices.reduce((max, invoice) => {
      const match = String(invoice.number || '').match(expression);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}-${fiscalToken}-${String(maximum + 1).padStart(4, '0')}`;
  }

  function defaultLineItems(invoice) {
    if (Array.isArray(invoice?.lineItems) && invoice.lineItems.length) {
      return invoice.lineItems.map(item => ({
        id: item.id || uid(),
        description: item.description || 'Professional services',
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'service',
        rate: Number(item.rate) || 0,
        discount: Number(item.discount) || 0
      }));
    }
    return [{
      id: uid(),
      description: invoice?.description || invoice?.notes || 'Professional services',
      quantity: 1,
      unit: 'service',
      rate: Number(invoice?.amount) || 0,
      discount: 0
    }];
  }

  function calculateInvoice(input) {
    const lineItems = defaultLineItems(input);
    const subtotal = lineItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.rate), 0);
    const discount = lineItems.reduce((sum, item) => sum + Number(item.discount || 0), 0);
    const taxableAmount = Math.max(0, subtotal - discount);
    const vatRate = input.applyVat === false ? 0 : Number(input.vatRate ?? state.settings.tax.vatRate ?? DEFAULT_VAT_RATE);
    const vatAmount = taxableAmount * vatRate / 100;
    const total = taxableAmount + vatAmount;
    const withholdingBase = Number(input.withholdingBase ?? taxableAmount) || 0;
    const tdsRate = Number(input.tdsRate ?? 0) || 0;
    const tdsAmount = withholdingBase * tdsRate / 100;
    return { lineItems, subtotal, discount, taxableAmount, vatRate, vatAmount, total, withholdingBase, tdsRate, tdsAmount, netReceivable: total - tdsAmount };
  }

  function normaliseInvoice(invoice) {
    const source = invoice || {};
    const issueDate = source.issueDate || source.createdAt?.slice(0, 10) || nepalDateKey();
    const documentType = source.documentType || (source.vatRate > 0 ? 'tax-invoice' : 'invoice');
    const fiscalYear = source.fiscalYear || fiscalYearFor(issueDate);
    const computed = calculateInvoice({
      ...source,
      lineItems: defaultLineItems(source),
      applyVat: source.applyVat ?? documentType === 'tax-invoice',
      vatRate: source.vatRate ?? (documentType === 'tax-invoice' ? state.settings?.tax?.vatRate ?? DEFAULT_VAT_RATE : 0)
    });
    return {
      id: source.id || uid(),
      number: source.number || invoiceSequence(documentType, fiscalYear),
      documentType,
      status: source.status || 'draft',
      fiscalYear,
      issueDate,
      dueDate: source.dueDate || dateKey(addDays(Number(state.settings?.business?.paymentTermsDays) || 15, parseAdDate(issueDate))),
      client: source.client || source.customerName || '',
      customerName: source.customerName || source.client || '',
      customerAddress: source.customerAddress || '',
      customerPan: source.customerPan || '',
      customerVatNumber: source.customerVatNumber || '',
      customerRegistered: Boolean(source.customerRegistered || source.customerVatNumber),
      email: source.email || '',
      currency: source.currency || state.settings?.currency || 'NPR',
      exchangeRate: Number(source.exchangeRate) || 1,
      nprEquivalent: Number(source.nprEquivalent) || computed.total * (Number(source.exchangeRate) || 1),
      applyVat: source.applyVat ?? documentType === 'tax-invoice',
      ...computed,
      amount: computed.total,
      notes: source.notes || '',
      paymentMethod: source.paymentMethod || 'bank-transfer',
      paymentReference: source.paymentReference || '',
      linkedInvoiceNumber: source.linkedInvoiceNumber || '',
      linkedInvoiceDate: source.linkedInvoiceDate || '',
      adjustmentReason: source.adjustmentReason || '',
      issuedAt: source.issuedAt || (ISSUED_STATUSES.has(source.status) ? source.updatedAt || source.createdAt || new Date().toISOString() : null),
      createdAt: source.createdAt || new Date().toISOString(),
      updatedAt: source.updatedAt || new Date().toISOString(),
      auditTrail: Array.isArray(source.auditTrail) ? source.auditTrail : []
    };
  }

  function isIssued(invoice) {
    return Boolean(invoice?.issuedAt || ISSUED_STATUSES.has(invoice?.status));
  }

  function holidayMap() {
    if (holidayCache) return holidayCache;
    holidayCache = new Map();
    OFFICIAL_HOLIDAYS_2083.forEach(holiday => {
      const key = bsToAdKey(2083, holiday.month, holiday.day);
      if (!key) return;
      const items = holidayCache.get(key) || [];
      items.push({ ...holiday, source: 'MOHA 2083' });
      holidayCache.set(key, items);
    });
    (state.holidays || []).forEach(holiday => {
      if (!holiday.date) return;
      const items = holidayCache.get(holiday.date) || [];
      items.push({ name: holiday.name || 'Local holiday', scope: holiday.scope || 'custom', source: 'Workspace' });
      holidayCache.set(holiday.date, items);
    });
    return holidayCache;
  }

  function holidaysForDate(key, date) {
    const items = [...(holidayMap().get(key) || [])];
    if (date.getDay() === 6) items.unshift({ name: 'Saturday', scope: 'weekly', source: 'MOHA 2083' });
    return items;
  }

  function renderNepalCalendar() {
    ensureNepalState();
    holidayCache = null;
    const year = ui.calendarMonth.getFullYear();
    const month = ui.calendarMonth.getMonth();
    const start = new Date(year, month, 1 - new Date(year, month, 1).getDay());
    const cells = [];
    const monthHolidayEntries = [];
    for (let index = 0; index < 42; index += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const key = dateKey(day);
      const events = state.events.filter(event => event.date === key).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
      const holidays = holidaysForDate(key, day);
      if (day.getMonth() === month && holidays.some(item => item.name !== 'Saturday')) holidays.filter(item => item.name !== 'Saturday').forEach(item => monthHolidayEntries.push({ date: key, ...item }));
      const visible = events.slice(0, 2);
      const bs = toBsParts(day);
      cells.push(`<div class="calendar-day nepal-calendar-day ${day.getMonth() !== month ? 'is-outside' : ''} ${key === nepalDateKey() ? 'is-today' : ''} ${day.getDay() === 6 ? 'is-nepal-weekend' : ''} ${holidays.length ? 'has-nepal-holiday' : ''}">
        <button class="calendar-date-button nepal-date-button" type="button" data-new-event-date="${key}" aria-label="Create event on ${escapeHtml(dualDate(key))}">
          <span>${day.getDate()}</span>${bs ? `<small>${bs.month}/${bs.day} BS</small>` : ''}
        </button>
        ${holidays.slice(0, 1).map(item => `<span class="nepal-holiday-chip" title="${escapeHtml(`${item.name} - ${item.scope}`)}">${escapeHtml(item.name)}</span>`).join('')}
        ${visible.map(event => eventButton(event)).join('')}
        ${events.length > 2 ? `<button class="calendar-more" type="button" data-show-day="${key}">+${events.length - 2} more</button>` : ''}
      </div>`);
    }
    const monthEvents = state.events.filter(event => {
      const parsed = parseAdDate(event.date);
      return parsed.getMonth() === month && parsed.getFullYear() === year;
    }).sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
    const grouped = Object.groupBy ? Object.groupBy(monthEvents, event => event.date) : monthEvents.reduce((groups, event) => ((groups[event.date] ||= []).push(event), groups), {});
    const monthTitle = new Intl.DateTimeFormat(NEPAL_LOCALE, { month: 'long', year: 'numeric', timeZone: NEPAL_TIME_ZONE }).format(ui.calendarMonth);
    const bsStart = bsLabel(new Date(year, month, 1));
    const bsEnd = bsLabel(new Date(year, month + 1, 0));
    return `<div class="content-shell page-stack nepal-calendar-page">
      <div class="nepal-market-banner"><div><span class="nepal-market-kicker">Nepal calendar</span><strong>${escapeHtml(fiscalYearFor())} fiscal year</strong><p>Dates are stored in AD and shown with BS conversion in Nepal Standard Time (UTC+05:45).</p></div><span class="nepal-compliance-badge">2083 holiday baseline</span></div>
      <div class="toolbar calendar-toolbar"><div><p class="panel-kicker">Month view</p><h2 class="calendar-title">${escapeHtml(monthTitle)}</h2><p class="nepal-bs-range">${escapeHtml(bsStart)} - ${escapeHtml(bsEnd)}</p></div><div class="toolbar-group"><button class="icon-button" type="button" data-calendar-prev aria-label="Previous month">${icon('chevronLeft', 18)}</button><button class="button button-secondary" type="button" data-calendar-today>Today</button><button class="icon-button" type="button" data-calendar-next aria-label="Next month">${icon('chevronRight', 18)}</button></div></div>
      <div class="calendar-legend"><span><i style="background:var(--danger)"></i>Saturday / holiday</span><span><i style="background:var(--primary)"></i>Meeting</span><span><i style="background:var(--warning)"></i>Review</span><span><i style="background:var(--info)"></i>Personal</span></div>
      <div class="calendar-shell"><div class="calendar-head">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<span class="${day === 'Sat' ? 'is-nepal-weekend' : ''}">${day}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div></div>
      <div class="nepal-calendar-lower">
        <section class="panel"><div class="panel-head"><div><p class="panel-kicker">Official baseline</p><h2>Public holidays this month</h2><p class="panel-description">National dates from the Ministry of Home Affairs 2083 notice. Provincial, local, sector-specific and moon-sighting dates still require the applicable notice.</p></div></div>${monthHolidayEntries.length ? `<div class="nepal-holiday-list">${monthHolidayEntries.map(item => `<div><time>${escapeHtml(dualDate(item.date))}</time><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.scope)}</small></span></div>`).join('')}</div>` : '<p class="panel-description">No fixed national holiday is listed for this AD month.</p>'}</section>
        <section class="panel"><div class="panel-head"><div><p class="panel-kicker">Agenda</p><h2>Workspace events</h2></div></div><div class="agenda-list">${Object.entries(grouped).length ? Object.entries(grouped).map(([date, events]) => `<section class="agenda-day"><h3>${escapeHtml(dualDate(date))}</h3>${events.map(event => `<button class="agenda-event" type="button" data-event-id="${event.id}"><span><strong>${escapeHtml(event.title)}</strong><br><small>${escapeHtml(event.category)}</small></span><time>${escapeHtml(event.time || '')}</time></button>`).join('')}</section>`).join('') : emptyState('calendar', 'No events this month', 'Create an event to begin planning.')}</div></section>
      </div>
    </div>`;
  }

  function documentBadge(invoice) {
    return `<span class="nepal-document-badge" data-type="${escapeHtml(invoice.documentType)}">${escapeHtml(DOCUMENT_LABELS[invoice.documentType] || 'Invoice')}</span>`;
  }

  function renderNepalInvoices() {
    ensureNepalState();
    const invoices = state.invoices.filter(invoice => (ui.invoiceFilter === 'all' || invoice.status === ui.invoiceFilter) && (!ui.query || `${invoice.number} ${invoice.client} ${invoice.email} ${invoice.customerPan}`.toLowerCase().includes(ui.query.toLowerCase())));
    const totals = state.invoices.reduce((result, invoice) => {
      const npr = invoice.currency === 'NPR' ? invoice.total : invoice.nprEquivalent;
      result.total += Number(npr) || 0;
      if (invoice.status === 'paid') result.paid += Number(npr) || 0;
      if (['sent', 'overdue'].includes(invoice.status)) result.outstanding += Number(npr) || 0;
      result.vat += Number(invoice.vatAmount) * (invoice.currency === 'NPR' ? 1 : Number(invoice.exchangeRate) || 1);
      return result;
    }, { total: 0, paid: 0, outstanding: 0, vat: 0 });
    return `<div class="content-shell page-stack nepal-invoice-page">
      <div class="nepal-market-banner"><div><span class="nepal-market-kicker">Nepal billing</span><strong>NPR ledger - FY ${escapeHtml(fiscalYearFor())}</strong><p>Tax invoices, adjustments, dual dates, VAT calculation and six-year retention guidance are built into this workspace.</p></div>${state.settings.business.eBillingApproved ? '<span class="nepal-compliance-badge is-approved">IRD e-billing configured</span>' : '<span class="nepal-compliance-badge is-warning">Not IRD-enlisted by default</span>'}</div>
      <div class="toolbar"><div class="toolbar-group">${searchToolbar('Search invoices, clients or PAN')}<select class="select-control" data-invoice-filter aria-label="Filter invoice status"><option value="all">All statuses</option>${['draft', 'sent', 'paid', 'overdue', 'void'].map(status => `<option value="${status}" ${ui.invoiceFilter === status ? 'selected' : ''}>${status === 'sent' ? 'Issued' : titleCase(status)}</option>`).join('')}</select></div><p class="toolbar-summary">${invoices.length} document${invoices.length === 1 ? '' : 's'}</p></div>
      <div class="invoice-kpi-grid"><article class="invoice-kpi"><span>Total billed</span><strong>${nprMoney(totals.total)}</strong><small>NPR equivalent</small></article><article class="invoice-kpi"><span>Paid</span><strong>${nprMoney(totals.paid)}</strong><small>All fiscal periods</small></article><article class="invoice-kpi"><span>Outstanding</span><strong>${nprMoney(totals.outstanding)}</strong><small>Issued and overdue</small></article><article class="invoice-kpi"><span>Output VAT</span><strong>${nprMoney(totals.vat)}</strong><small>Calculated, not filed</small></article></div>
      ${invoices.length ? `<section class="panel desktop-table"><div class="table-container"><div class="table-scroll"><table><thead><tr><th>Document</th><th>Customer</th><th>Type</th><th>Status</th><th>Issue / due</th><th style="text-align:right">Total</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${invoices.map(invoice => `<tr><td><button class="text-button" type="button" data-view-invoice="${invoice.id}">${escapeHtml(invoice.number)}</button><small>FY ${escapeHtml(invoice.fiscalYear)}</small></td><td><strong>${escapeHtml(invoice.customerName || invoice.client)}</strong><small>${escapeHtml(invoice.customerPan ? `PAN ${invoice.customerPan}` : invoice.email || 'No PAN recorded')}</small></td><td>${documentBadge(invoice)}</td><td>${statusPill(invoice.status === 'sent' ? 'issued' : invoice.status)}</td><td><span>${escapeHtml(dualDate(invoice.issueDate, { short: true }))}</span><small>Due ${escapeHtml(dualDate(invoice.dueDate, { short: true }))}</small></td><td style="text-align:right"><strong>${escapeHtml(nprMoney(invoice.total, invoice.currency))}</strong>${invoice.currency !== 'NPR' ? `<small>NPR ${escapeHtml(nprMoney(invoice.nprEquivalent).replace(/^NPR\s?/, ''))}</small>` : ''}</td><td>${overflowMenu([{ label: 'View / print', icon: 'eye', action: 'view-invoice', id: invoice.id }, ...(!isIssued(invoice) ? [{ label: 'Edit draft', icon: 'edit', action: 'edit-invoice', id: invoice.id }] : []), ...(invoice.status !== 'paid' && invoice.documentType !== 'proforma' ? [{ label: 'Mark as paid', icon: 'check', action: 'pay-invoice', id: invoice.id }] : []), { label: 'Duplicate as draft', icon: 'duplicate', action: 'duplicate-invoice', id: invoice.id }, ...(!isIssued(invoice) ? [{ label: 'Delete draft', icon: 'trash', action: 'delete-invoice', id: invoice.id, danger: true }] : [])], `Actions for ${invoice.number}`)}</td></tr>`).join('')}</tbody></table></div></div></section><div class="mobile-card-list">${invoices.map(invoice => `<article class="invoice-card"><div class="invoice-card-head"><div><h3>${escapeHtml(invoice.number)}</h3><p class="panel-description">${escapeHtml(invoice.customerName || invoice.client)}</p></div>${statusPill(invoice.status === 'sent' ? 'issued' : invoice.status)}</div><div class="invoice-card-meta">${documentBadge(invoice)}<span>${escapeHtml(nprMoney(invoice.total, invoice.currency))}</span><span>${escapeHtml(dualDate(invoice.issueDate))}</span><span>Due ${escapeHtml(dualDate(invoice.dueDate))}</span></div><div class="invoice-card-actions"><button class="button button-secondary button-small" type="button" data-view-invoice="${invoice.id}">${icon('eye', 15)}View</button>${!isIssued(invoice) ? `<button class="button button-secondary button-small" type="button" data-edit-invoice="${invoice.id}">${icon('edit', 15)}Edit draft</button>` : ''}</div></article>`).join('')}</div>` : emptyState('invoices', 'No fiscal documents found', 'Create a Nepal-ready invoice or adjustment note.')}
    </div>`;
  }

  function lineItemRow(item = {}) {
    return `<div class="nepal-line-item-row" data-line-item-row>
      <label class="field nepal-line-description">Description<input name="lineDescription" required maxlength="180" value="${escapeHtml(item.description || '')}"><span class="field-error"></span></label>
      <label class="field">Qty<input name="lineQuantity" type="number" required min="0.001" step="0.001" value="${escapeHtml(item.quantity ?? 1)}"></label>
      <label class="field">Unit<input name="lineUnit" maxlength="30" value="${escapeHtml(item.unit || 'service')}"></label>
      <label class="field">Rate<input name="lineRate" type="number" required min="0" step="0.01" value="${escapeHtml(item.rate ?? 0)}"></label>
      <label class="field">Discount<input name="lineDiscount" type="number" min="0" step="0.01" value="${escapeHtml(item.discount ?? 0)}"></label>
      <button class="icon-button nepal-remove-line" type="button" data-remove-invoice-line aria-label="Remove line item">${icon('trash', 16)}</button>
    </div>`;
  }

  function collectLineItems(form) {
    return [...form.querySelectorAll('[data-line-item-row]')].map(row => ({
      id: row.dataset.lineItemId || uid(),
      description: row.querySelector('[name="lineDescription"]')?.value.trim() || '',
      quantity: Number(row.querySelector('[name="lineQuantity"]')?.value) || 0,
      unit: row.querySelector('[name="lineUnit"]')?.value.trim() || 'unit',
      rate: Number(row.querySelector('[name="lineRate"]')?.value) || 0,
      discount: Number(row.querySelector('[name="lineDiscount"]')?.value) || 0
    }));
  }

  function invoiceDraftFromForm(form, invoice = null) {
    const data = new FormData(form);
    const documentType = String(data.get('documentType') || 'invoice');
    const currency = String(data.get('currency') || 'NPR');
    const applyVat = data.has('applyVat') && documentType !== 'proforma';
    const lineItems = collectLineItems(form);
    const draft = {
      ...(invoice || {}),
      id: invoice?.id || uid(),
      number: String(data.get('number') || '').trim(),
      documentType,
      status: String(data.get('status') || 'draft'),
      fiscalYear: fiscalYearFor(String(data.get('issueDate') || nepalDateKey())),
      issueDate: String(data.get('issueDate') || nepalDateKey()),
      dueDate: String(data.get('dueDate') || ''),
      customerName: String(data.get('customerName') || '').trim(),
      client: String(data.get('customerName') || '').trim(),
      customerAddress: String(data.get('customerAddress') || '').trim(),
      customerPan: String(data.get('customerPan') || '').trim(),
      customerVatNumber: String(data.get('customerVatNumber') || '').trim(),
      customerRegistered: data.has('customerRegistered'),
      email: String(data.get('email') || '').trim(),
      currency,
      exchangeRate: Number(data.get('exchangeRate')) || 1,
      applyVat,
      vatRate: applyVat ? Number(data.get('vatRate')) || 0 : 0,
      tdsRate: data.has('applyTds') ? Number(data.get('tdsRate')) || 0 : 0,
      withholdingBase: Number(data.get('withholdingBase')) || 0,
      paymentMethod: String(data.get('paymentMethod') || 'bank-transfer'),
      paymentReference: String(data.get('paymentReference') || '').trim(),
      linkedInvoiceNumber: String(data.get('linkedInvoiceNumber') || '').trim(),
      linkedInvoiceDate: String(data.get('linkedInvoiceDate') || '').trim(),
      adjustmentReason: String(data.get('adjustmentReason') || '').trim(),
      notes: String(data.get('notes') || '').trim(),
      lineItems,
      createdAt: invoice?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auditTrail: [...(invoice?.auditTrail || [])]
    };
    const computed = calculateInvoice(draft);
    Object.assign(draft, computed, { amount: computed.total, nprEquivalent: currency === 'NPR' ? computed.total : computed.total * draft.exchangeRate });
    if (ISSUED_STATUSES.has(draft.status) && !draft.issuedAt) draft.issuedAt = new Date().toISOString();
    draft.auditTrail.push({ at: new Date().toISOString(), action: invoice ? 'updated' : (draft.status === 'draft' ? 'draft-created' : 'issued'), by: currentUserName() });
    return draft;
  }

  function validateNepalInvoiceForm(form, draft, currentInvoice = null) {
    form.querySelectorAll('[aria-invalid="true"]').forEach(element => element.removeAttribute('aria-invalid'));
    form.querySelectorAll('[data-nepal-form-error]').forEach(element => { element.textContent = ''; });
    const errors = [];
    const required = [['number', 'Invoice number is required.'], ['issueDate', 'Issue date is required.'], ['dueDate', 'Due date is required.'], ['customerName', 'Customer name is required.'], ['customerAddress', 'Customer address is required.']];
    required.forEach(([name, message]) => {
      const element = form.elements[name];
      if (!element?.value.trim()) errors.push({ element, message });
    });
    if (!draft.lineItems.length || draft.lineItems.some(item => !item.description || item.quantity <= 0 || item.rate < 0)) errors.push({ element: form.querySelector('[name="lineDescription"]'), message: 'Every line needs a description, positive quantity and valid rate.' });
    if (state.invoices.some(item => item.id !== currentInvoice?.id && String(item.number).toLowerCase() === draft.number.toLowerCase())) errors.push({ element: form.elements.number, message: 'Invoice number must be unique.' });
    if (draft.documentType === 'tax-invoice') {
      if (!state.settings.business.vatRegistered || !state.settings.business.vatNumber) errors.push({ element: form.elements.documentType, message: 'Configure the supplier VAT registration number before issuing a tax invoice.' });
      if (!draft.applyVat) errors.push({ element: form.elements.applyVat, message: 'A tax invoice must include the applicable VAT treatment.' });
    }
    if (['credit-note', 'debit-note'].includes(draft.documentType) && (!draft.linkedInvoiceNumber || !draft.linkedInvoiceDate || !draft.adjustmentReason)) errors.push({ element: form.elements.linkedInvoiceNumber, message: 'Adjustment notes require the original invoice number, date and reason.' });
    if (draft.customerRegistered && !draft.customerPan && !draft.customerVatNumber) errors.push({ element: form.elements.customerPan, message: 'Record the registered customer PAN or VAT number.' });
    if (draft.currency !== 'NPR' && (!draft.exchangeRate || draft.exchangeRate <= 0)) errors.push({ element: form.elements.exchangeRate, message: 'Enter the Nepal Rastra Bank exchange rate for the transaction date.' });
    if (draft.status !== 'draft' && !state.settings.business.legalName) errors.push({ element: form.elements.number, message: 'Complete Nepal market business settings before issuing a document.' });
    if (errors.length) {
      errors.forEach(({ element, message }) => {
        element?.setAttribute('aria-invalid', 'true');
        const fieldNode = element?.closest('.field');
        const target = fieldNode?.querySelector('.field-error') || form.querySelector('[data-nepal-form-error]');
        if (target && !target.textContent) target.textContent = message;
      });
      errors[0].element?.focus();
      return false;
    }
    return true;
  }

  function updateInvoiceCalculation(form) {
    const lineItems = collectLineItems(form);
    const documentType = form.elements.documentType?.value || 'invoice';
    const applyVat = Boolean(form.elements.applyVat?.checked) && documentType !== 'proforma';
    const calculation = calculateInvoice({
      lineItems,
      applyVat,
      vatRate: Number(form.elements.vatRate?.value) || 0,
      tdsRate: form.elements.applyTds?.checked ? Number(form.elements.tdsRate?.value) || 0 : 0,
      withholdingBase: Number(form.elements.withholdingBase?.value) || undefined
    });
    if (form.elements.withholdingBase && !form.elements.withholdingBase.dataset.touched) form.elements.withholdingBase.value = calculation.taxableAmount.toFixed(2);
    const summary = form.querySelector('[data-invoice-live-summary]');
    if (summary) summary.innerHTML = `<div><span>Subtotal</span><strong>${escapeHtml(nprMoney(calculation.subtotal, form.elements.currency?.value || 'NPR'))}</strong></div><div><span>Discount</span><strong>${escapeHtml(nprMoney(calculation.discount, form.elements.currency?.value || 'NPR'))}</strong></div><div><span>Taxable amount</span><strong>${escapeHtml(nprMoney(calculation.taxableAmount, form.elements.currency?.value || 'NPR'))}</strong></div><div><span>VAT</span><strong>${escapeHtml(nprMoney(calculation.vatAmount, form.elements.currency?.value || 'NPR'))}</strong></div><div class="is-total"><span>Grand total</span><strong>${escapeHtml(nprMoney(calculation.total, form.elements.currency?.value || 'NPR'))}</strong></div><div><span>TDS / withholding estimate</span><strong>${escapeHtml(nprMoney(calculation.tdsAmount, form.elements.currency?.value || 'NPR'))}</strong></div><div class="is-total"><span>Net receivable</span><strong>${escapeHtml(nprMoney(calculation.netReceivable, form.elements.currency?.value || 'NPR'))}</strong></div>`;
    const adjustment = form.querySelector('[data-adjustment-fields]');
    if (adjustment) adjustment.hidden = !['credit-note', 'debit-note'].includes(documentType);
    const foreign = form.querySelector('[data-foreign-currency-fields]');
    if (foreign) foreign.hidden = (form.elements.currency?.value || 'NPR') === 'NPR';
    const vatFields = form.querySelector('[data-vat-fields]');
    if (vatFields) vatFields.hidden = !applyVat;
  }

  function openNepalInvoiceForm(invoice = null, presetType = null) {
    ensureNepalState();
    if (invoice && !invoice.__newDraft && isIssued(invoice)) {
      toast('Issued fiscal documents are locked. Use a credit or debit note for corrections.', 'warning');
      openNepalInvoiceDetail(invoice);
      return;
    }
    const issueDate = invoice?.issueDate || nepalDateKey();
    const isNewDocument = !invoice || Boolean(invoice.__newDraft);
    const data = normaliseInvoice(invoice || {
      documentType: presetType || (state.settings.business.vatRegistered ? 'tax-invoice' : 'invoice'),
      status: 'draft',
      issueDate,
      dueDate: dateKey(addDays(Number(state.settings.business.paymentTermsDays) || 15, parseAdDate(issueDate))),
      lineItems: [{ description: '', quantity: 1, unit: 'service', rate: 0, discount: 0 }],
      applyVat: state.settings.business.vatRegistered,
      vatRate: state.settings.tax.vatRate,
      tdsRate: state.settings.tax.tdsEnabled ? state.settings.tax.tdsRate : 0
    });
    if (!invoice) data.number = invoiceSequence(data.documentType, data.fiscalYear);
    const documentOptions = Object.entries(DOCUMENT_LABELS).map(([value, label]) => `<option value="${value}" ${data.documentType === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
    openModal(`<form class="modal-card form-modal nepal-invoice-form" data-nepal-invoice-form novalidate>
      <div class="modal-head"><div><p class="modal-eyebrow">Nepal fiscal document</p><h2 id="modal-title">${isNewDocument ? 'Create invoice' : 'Edit invoice draft'}</h2><p>Store AD dates, display BS equivalents, and issue a document with Nepal tax fields.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div>
      <div class="modal-body bright-form-sections">
        <div class="nepal-form-alert"><strong>Compliance boundary</strong><span>This creates a Nepal-ready record and print layout. It is not IRD-approved electronic billing unless your deployed software and business approval are configured.</span></div>
        <fieldset class="bright-form-section"><legend>Document identity</legend><div class="field-grid">
          <label class="field">Document type<select name="documentType">${documentOptions}</select><span class="field-error"></span></label>
          <label class="field">Status<select name="status"><option value="draft" ${data.status === 'draft' ? 'selected' : ''}>Draft</option><option value="sent" ${data.status === 'sent' ? 'selected' : ''}>Issue document</option></select><span class="field-error"></span></label>
          ${field('Invoice / note number', 'number', data.number, { required: true, maxlength: 40 })}
          <label class="field">Fiscal year<input value="${escapeHtml(data.fiscalYear)}" readonly aria-label="Nepal fiscal year"></label>
          ${field('Issue date (AD)', 'issueDate', data.issueDate, { type: 'date', required: true })}
          ${field('Due date (AD)', 'dueDate', data.dueDate, { type: 'date', required: true })}
        </div><p class="nepal-date-preview" data-invoice-date-preview>Issue: ${escapeHtml(dualDate(data.issueDate))}</p></fieldset>
        <fieldset class="bright-form-section"><legend>Customer</legend><div class="field-grid">
          ${field('Customer legal name', 'customerName', data.customerName, { required: true, span: true, maxlength: 120 })}
          ${field('Customer address', 'customerAddress', data.customerAddress, { required: true, span: true, maxlength: 180 })}
          ${field('Customer PAN', 'customerPan', data.customerPan, { maxlength: 20 })}
          ${field('Customer VAT number', 'customerVatNumber', data.customerVatNumber, { maxlength: 20 })}
          ${field('Billing email', 'email', data.email, { type: 'email', span: true, maxlength: 120 })}
          <label class="setting-row nepal-inline-check span-2"><span class="setting-copy"><strong>Registered customer</strong><p>Require a PAN or VAT number before issuing.</p></span><span class="switch"><input type="checkbox" name="customerRegistered" ${data.customerRegistered ? 'checked' : ''}><span class="switch-track"></span></span></label>
        </div></fieldset>
        <fieldset class="bright-form-section"><legend>Goods and services</legend><p class="bright-form-section-copy">Describe type, size, model or brand where those details apply.</p><div class="nepal-line-items" data-invoice-line-items>${data.lineItems.map(lineItemRow).join('')}</div><button class="button button-secondary button-small" type="button" data-add-invoice-line>${icon('plus', 15)}Add line</button></fieldset>
        <fieldset class="bright-form-section"><legend>Tax and currency</legend><div class="field-grid">
          <label class="field">Currency<select name="currency">${['NPR', 'USD', 'EUR', 'GBP', 'INR'].map(currency => `<option value="${currency}" ${data.currency === currency ? 'selected' : ''}>${currency}</option>`).join('')}</select></label>
          <label class="setting-row nepal-inline-check"><span class="setting-copy"><strong>Apply VAT</strong><p>Default rate comes from Nepal settings.</p></span><span class="switch"><input type="checkbox" name="applyVat" ${data.applyVat ? 'checked' : ''}><span class="switch-track"></span></span></label>
          <div class="field-grid span-2" data-vat-fields ${data.applyVat ? '' : 'hidden'}>${field('VAT rate (%)', 'vatRate', data.vatRate, { type: 'number', min: 0, max: 100, step: '.01' })}</div>
          <div class="field-grid span-2" data-foreign-currency-fields ${data.currency === 'NPR' ? 'hidden' : ''}>${field('NRB exchange rate to NPR', 'exchangeRate', data.exchangeRate, { type: 'number', min: 0.000001, step: '.000001' })}<label class="field">NPR equivalent basis<span class="field-hint">Use the Nepal Rastra Bank rate for the transaction date.</span></label></div>
          <label class="setting-row nepal-inline-check"><span class="setting-copy"><strong>Record TDS / withholding</strong><p>Rate and base depend on the payment and payee. Verify separately.</p></span><span class="switch"><input type="checkbox" name="applyTds" ${data.tdsRate > 0 ? 'checked' : ''}><span class="switch-track"></span></span></label>
          ${field('TDS rate (%)', 'tdsRate', data.tdsRate, { type: 'number', min: 0, max: 100, step: '.01' })}
          ${field('Withholding base', 'withholdingBase', data.withholdingBase || data.taxableAmount, { type: 'number', min: 0, step: '.01' })}
        </div></fieldset>
        <fieldset class="bright-form-section" data-adjustment-fields ${['credit-note', 'debit-note'].includes(data.documentType) ? '' : 'hidden'}><legend>Credit / debit note linkage</legend><div class="field-grid">${field('Original invoice number', 'linkedInvoiceNumber', data.linkedInvoiceNumber, { required: false })}${field('Original invoice date', 'linkedInvoiceDate', data.linkedInvoiceDate, { type: 'date' })}${field('Reason for adjustment', 'adjustmentReason', data.adjustmentReason, { textarea: true, span: true, maxlength: 300 })}</div></fieldset>
        <fieldset class="bright-form-section"><legend>Payment and notes</legend><div class="field-grid"><label class="field">Payment method<select name="paymentMethod">${[['bank-transfer', 'Bank transfer'], ['cash', 'Cash'], ['cheque', 'Cheque'], ['digital-wallet', 'Digital wallet'], ['other', 'Other']].map(([value, label]) => `<option value="${value}" ${data.paymentMethod === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>${field('Payment reference', 'paymentReference', data.paymentReference, { maxlength: 100 })}${field('Terms / notes', 'notes', data.notes, { textarea: true, span: true, maxlength: 600 })}</div></fieldset>
        <section class="nepal-invoice-live-summary" data-invoice-live-summary aria-live="polite"></section>
        <p class="field-error nepal-form-error" data-nepal-form-error></p>
      </div>
      <div class="modal-actions"><div class="modal-actions-leading"><span class="nepal-retention-note">Issued records are retained and corrected through adjustment notes.</span></div><div class="modal-actions-trailing"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">${data.status === 'draft' ? 'Save draft' : 'Save'}</button></div></div>
    </form>`);
    const form = modal.querySelector('[data-nepal-invoice-form]');
    form.querySelector('[data-add-invoice-line]')?.addEventListener('click', () => {
      form.querySelector('[data-invoice-line-items]')?.insertAdjacentHTML('beforeend', lineItemRow({ quantity: 1, unit: 'unit', rate: 0, discount: 0 }));
      updateInvoiceCalculation(form);
    });
    form.addEventListener('click', event => {
      const remove = event.target.closest('[data-remove-invoice-line]');
      if (!remove) return;
      const rows = form.querySelectorAll('[data-line-item-row]');
      if (rows.length === 1) { toast('An invoice needs at least one line item.', 'warning'); return; }
      remove.closest('[data-line-item-row]')?.remove();
      updateInvoiceCalculation(form);
    });
    form.addEventListener('input', event => {
      if (event.target.name === 'withholdingBase') event.target.dataset.touched = 'true';
      if (event.target.name === 'issueDate') {
        form.querySelector('[data-invoice-date-preview]').textContent = `Issue: ${dualDate(event.target.value)}`;
        if (!invoice) form.elements.number.value = invoiceSequence(form.elements.documentType.value, fiscalYearFor(event.target.value));
      }
      updateInvoiceCalculation(form);
    });
    form.addEventListener('change', event => {
      if (event.target.name === 'documentType' && !invoice) form.elements.number.value = invoiceSequence(event.target.value, fiscalYearFor(form.elements.issueDate.value));
      updateInvoiceCalculation(form);
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const draft = invoiceDraftFromForm(form, isNewDocument ? null : invoice);
      if (!validateNepalInvoiceForm(form, draft, isNewDocument ? null : invoice)) return;
      if (isNewDocument) state.invoices.unshift(draft);
      else Object.assign(invoice, draft);
      logActivity('invoice', isNewDocument ? (draft.status === 'draft' ? 'Invoice draft created' : 'Fiscal document issued') : 'Invoice draft updated', draft.number);
      saveState();
      closeModal();
      renderShell();
      toast(draft.status === 'draft' ? 'Invoice draft saved.' : 'Fiscal document issued and locked.');
    });
    updateInvoiceCalculation(form);
  }

  function invoiceCopyMarkup(invoice, copyLabel) {
    const business = state.settings.business;
    const title = invoice.documentType === 'tax-invoice' ? '\u0915\u0930 \u092c\u093f\u091c\u0915 / TAX INVOICE' : (DOCUMENT_LABELS[invoice.documentType] || 'INVOICE').toUpperCase();
    return `<article class="nepal-legal-invoice nepal-copy">
      <header class="nepal-invoice-header"><div><p class="nepal-invoice-copy-label">${escapeHtml(copyLabel)}</p><h2>${escapeHtml(title)}</h2><strong>${escapeHtml(business.legalName || state.settings.workspaceName || 'Business name required')}</strong><p>${escapeHtml([business.address, business.municipality, business.district, business.province].filter(Boolean).join(', '))}</p><p>PAN: ${escapeHtml(business.pan || '-')} ${business.vatRegistered ? `| VAT: ${escapeHtml(business.vatNumber || '-')}` : ''}</p></div><div class="nepal-invoice-id"><strong>${escapeHtml(invoice.number)}</strong><span>FY ${escapeHtml(invoice.fiscalYear)}</span><span>Issue: ${escapeHtml(dualDate(invoice.issueDate))}</span><span>Due: ${escapeHtml(dualDate(invoice.dueDate))}</span></div></header>
      ${invoice.documentType === 'tax-invoice' && !business.eBillingApproved ? '<div class="nepal-print-warning">This print layout is not represented as IRD-enlisted electronic billing software.</div>' : ''}
      <section class="nepal-invoice-parties"><div><span>Supplier</span><strong>${escapeHtml(business.legalName || '-')}</strong><p>${escapeHtml(business.email || business.phone || '')}</p></div><div><span>Recipient</span><strong>${escapeHtml(invoice.customerName || invoice.client)}</strong><p>${escapeHtml(invoice.customerAddress || '-')}</p><p>PAN: ${escapeHtml(invoice.customerPan || '-')} ${invoice.customerVatNumber ? `| VAT: ${escapeHtml(invoice.customerVatNumber)}` : ''}</p><p>${escapeHtml(invoice.email || '')}</p></div></section>
      ${['credit-note', 'debit-note'].includes(invoice.documentType) ? `<section class="nepal-adjustment-reference"><strong>Original tax invoice</strong><span>${escapeHtml(invoice.linkedInvoiceNumber)} dated ${escapeHtml(dualDate(invoice.linkedInvoiceDate))}</span><p>${escapeHtml(invoice.adjustmentReason)}</p></section>` : ''}
      <table class="nepal-invoice-table"><thead><tr><th>#</th><th>Description of goods / services</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Discount</th><th>Taxable</th></tr></thead><tbody>${invoice.lineItems.map((item, index) => { const taxable = Math.max(0, Number(item.quantity) * Number(item.rate) - Number(item.discount || 0)); return `<tr><td>${index + 1}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.unit)}</td><td>${escapeHtml(nprMoney(item.rate, invoice.currency))}</td><td>${escapeHtml(nprMoney(item.discount, invoice.currency))}</td><td>${escapeHtml(nprMoney(taxable, invoice.currency))}</td></tr>`; }).join('')}</tbody></table>
      <section class="nepal-invoice-totals"><div><span>Subtotal</span><strong>${escapeHtml(nprMoney(invoice.subtotal, invoice.currency))}</strong></div><div><span>Discount</span><strong>${escapeHtml(nprMoney(invoice.discount, invoice.currency))}</strong></div><div><span>Taxable amount</span><strong>${escapeHtml(nprMoney(invoice.taxableAmount, invoice.currency))}</strong></div><div><span>VAT (${escapeHtml(invoice.vatRate)}%)</span><strong>${escapeHtml(nprMoney(invoice.vatAmount, invoice.currency))}</strong></div><div class="is-grand"><span>Grand total</span><strong>${escapeHtml(nprMoney(invoice.total, invoice.currency))}</strong></div>${invoice.currency !== 'NPR' ? `<div><span>NRB rate</span><strong>${escapeHtml(invoice.exchangeRate)}</strong></div><div class="is-grand"><span>NPR equivalent</span><strong>${escapeHtml(nprMoney(invoice.nprEquivalent))}</strong></div>` : ''}${invoice.tdsAmount > 0 ? `<div><span>TDS / withholding</span><strong>(${escapeHtml(nprMoney(invoice.tdsAmount, invoice.currency))})</strong></div><div class="is-grand"><span>Net receivable</span><strong>${escapeHtml(nprMoney(invoice.netReceivable, invoice.currency))}</strong></div>` : ''}</section>
      <section class="nepal-invoice-footer"><div><strong>Payment</strong><p>${escapeHtml(titleCase(invoice.paymentMethod))}${invoice.paymentReference ? ` - ${escapeHtml(invoice.paymentReference)}` : ''}</p><p>${escapeHtml(invoice.notes || business.paymentInstructions || '')}</p></div><div class="nepal-signature"><span>Authorised signature / stamp</span></div></section>
    </article>`;
  }

  function openNepalInvoiceDetail(invoice) {
    if (!invoice) return;
    invoice = normaliseInvoice(invoice);
    const copies = invoice.documentType === 'tax-invoice' ? ['ORIGINAL - Recipient', 'DUPLICATE - Tax office copy', 'TRIPLICATE - Supplier copy'] : ['CUSTOMER COPY'];
    openModal(`<div class="modal-card full-detail-view nepal-invoice-detail"><div class="bright-detail-header"><div><p class="modal-eyebrow">Nepal fiscal document</p><h2 id="modal-title">${escapeHtml(invoice.number)}</h2><p>${escapeHtml(DOCUMENT_LABELS[invoice.documentType] || 'Invoice')} - ${escapeHtml(titleCase(invoice.status === 'sent' ? 'issued' : invoice.status))}</p></div><div class="bright-detail-actions"><button class="button button-secondary" type="button" data-print-nepal-invoice>${icon('download', 16)}Print ${copies.length > 1 ? '3 copies' : 'invoice'}</button>${!isIssued(invoice) ? `<button class="button button-primary" type="button" data-edit-nepal-invoice>Edit draft</button>` : ''}<button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div></div><div class="bright-detail-body"><div class="nepal-invoice-screen-summary"><span>${escapeHtml(dualDate(invoice.issueDate))}</span><span>${escapeHtml(nprMoney(invoice.total, invoice.currency))}</span><span>FY ${escapeHtml(invoice.fiscalYear)}</span>${isIssued(invoice) ? '<span class="nepal-compliance-badge is-approved">Locked record</span>' : '<span class="nepal-compliance-badge">Draft</span>'}</div><div class="nepal-invoice-print-stack">${copies.map(copy => invoiceCopyMarkup(invoice, copy)).join('')}</div>${isIssued(invoice) ? `<div class="nepal-issued-actions"><p>Issued documents are not edited or deleted. Record a legally traceable adjustment instead.</p><button class="button button-secondary" type="button" data-create-credit-note="${invoice.id}">Create credit note</button><button class="button button-secondary" type="button" data-create-debit-note="${invoice.id}">Create debit note</button></div>` : ''}<details class="nepal-audit-trail"><summary>Document audit trail</summary><div>${invoice.auditTrail.length ? invoice.auditTrail.map(item => `<p><time>${escapeHtml(new Intl.DateTimeFormat(NEPAL_LOCALE, { timeZone: NEPAL_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.at)))}</time><span>${escapeHtml(titleCase(item.action))} by ${escapeHtml(item.by || 'Workspace member')}</span></p>`).join('') : '<p>No audit entries.</p>'}</div></details></div></div>`);
    modal.querySelector('[data-print-nepal-invoice]')?.addEventListener('click', () => window.print());
    modal.querySelector('[data-edit-nepal-invoice]')?.addEventListener('click', () => { closeModal(); openNepalInvoiceForm(invoice); });
    modal.querySelector('[data-create-credit-note]')?.addEventListener('click', () => createAdjustmentDraft(invoice, 'credit-note'));
    modal.querySelector('[data-create-debit-note]')?.addEventListener('click', () => createAdjustmentDraft(invoice, 'debit-note'));
  }

  function createAdjustmentDraft(original, type) {
    closeModal();
    const adjustment = normaliseInvoice({
      documentType: type,
      status: 'draft',
      issueDate: nepalDateKey(),
      dueDate: nepalDateKey(),
      customerName: original.customerName,
      customerAddress: original.customerAddress,
      customerPan: original.customerPan,
      customerVatNumber: original.customerVatNumber,
      customerRegistered: original.customerRegistered,
      email: original.email,
      currency: original.currency,
      exchangeRate: original.exchangeRate,
      lineItems: original.lineItems.map(item => ({ ...item, id: uid() })),
      applyVat: original.applyVat,
      vatRate: original.vatRate,
      linkedInvoiceNumber: original.number,
      linkedInvoiceDate: original.issueDate,
      adjustmentReason: '',
      notes: `Adjustment for ${original.number}`
    });
    adjustment.number = invoiceSequence(type, adjustment.fiscalYear);
    adjustment.__newDraft = true;
    openNepalInvoiceForm(adjustment, type);
  }

  function duplicateNepalInvoice(id) {
    const source = state.invoices.find(item => item.id === id);
    if (!source) return;
    const duplicate = normaliseInvoice({
      ...source,
      id: uid(),
      number: invoiceSequence(source.documentType, fiscalYearFor()),
      status: 'draft',
      issueDate: nepalDateKey(),
      dueDate: dateKey(addDays(Number(state.settings.business.paymentTermsDays) || 15, nepalNow())),
      issuedAt: null,
      auditTrail: [{ at: new Date().toISOString(), action: 'duplicated-as-draft', by: currentUserName() }]
    });
    state.invoices.unshift(duplicate);
    saveState();
    renderShell();
    toast('Invoice duplicated as a new draft.');
  }

  function settingsPanelMarkup() {
    const business = state.settings.business;
    const tax = state.settings.tax;
    const compliance = state.settings.compliance;
    return `<form class="settings-panel nepal-market-settings ${ui.settingsTab === 'nepal-market' ? 'is-active' : ''}" data-nepal-market-form novalidate>
      <div class="settings-heading"><h2>Nepal market and compliance</h2><p>Configure the legal identity and defaults used by invoices, calendars and reports.</p></div>
      <div class="nepal-form-alert"><strong>Not legal certification</strong><span>Formcraft enforces useful controls, but your registration status, IRD e-billing approval, sector rules and current Finance Act still require professional verification.</span></div>
      <fieldset class="bright-form-section"><legend>Business identity</legend><div class="field-grid">${field('Legal business name', 'legalName', business.legalName, { required: true, span: true, maxlength: 120 })}${field('Trading name', 'tradingName', business.tradingName, { span: true, maxlength: 120 })}${field('Registered address', 'address', business.address, { required: true, span: true, maxlength: 180 })}${field('Municipality / rural municipality', 'municipality', business.municipality, { maxlength: 80 })}${field('District', 'district', business.district, { maxlength: 80 })}<label class="field">Province<select name="province">${['Koshi', 'Madhesh', 'Bagmati', 'Gandaki', 'Lumbini', 'Karnali', 'Sudurpashchim'].map(value => `<option value="${value}" ${business.province === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>${field('PAN', 'pan', business.pan, { maxlength: 20 })}${field('VAT number', 'vatNumber', business.vatNumber, { maxlength: 20 })}${field('Phone', 'phone', business.phone, { maxlength: 40 })}${field('Business email', 'businessEmail', business.email, { type: 'email', maxlength: 120 })}<label class="setting-row nepal-inline-check span-2"><span class="setting-copy"><strong>VAT registered</strong><p>Allows Tax Invoice documents and applies the configured VAT rate.</p></span><span class="switch"><input type="checkbox" name="vatRegistered" ${business.vatRegistered ? 'checked' : ''}><span class="switch-track"></span></span></label></div></fieldset>
      <fieldset class="bright-form-section"><legend>Invoice controls</legend><div class="field-grid">${field('Invoice prefix', 'invoicePrefix', business.invoicePrefix, { required: true, maxlength: 10 })}${field('Default payment terms (days)', 'paymentTermsDays', business.paymentTermsDays, { type: 'number', min: 0, max: 365 })}${field('Default VAT rate (%)', 'vatRate', tax.vatRate, { type: 'number', min: 0, max: 100, step: '.01' })}${field('Default TDS rate (%)', 'tdsRate', tax.tdsRate, { type: 'number', min: 0, max: 100, step: '.01' })}<label class="setting-row nepal-inline-check span-2"><span class="setting-copy"><strong>Enable TDS fields by default</strong><p>TDS remains an estimate because the applicable rate and base depend on the transaction.</p></span><span class="switch"><input type="checkbox" name="tdsEnabled" ${tax.tdsEnabled ? 'checked' : ''}><span class="switch-track"></span></span></label><label class="setting-row nepal-inline-check span-2"><span class="setting-copy"><strong>IRD electronic billing approval configured</strong><p>Only enable this after your exact deployed software and business approval are verified.</p></span><span class="switch"><input type="checkbox" name="eBillingApproved" ${business.eBillingApproved ? 'checked' : ''}><span class="switch-track"></span></span></label>${field('IRD approval / enlistment reference', 'eBillingApprovalReference', business.eBillingApprovalReference, { span: true, maxlength: 120 })}</div></fieldset>
      <fieldset class="bright-form-section"><legend>Bank and payment details</legend><div class="field-grid">${field('Bank name', 'bankName', business.bankName, { maxlength: 100 })}${field('Account name', 'bankAccountName', business.bankAccountName, { maxlength: 100 })}${field('Account number', 'bankAccountNumber', business.bankAccountNumber, { maxlength: 80 })}${field('Payment instructions', 'paymentInstructions', business.paymentInstructions, { textarea: true, span: true, maxlength: 400 })}</div></fieldset>
      <fieldset class="bright-form-section"><legend>Calendar and records</legend><div class="field-grid"><label class="field">Date display<select name="dateSystem"><option value="dual" ${state.settings.dateSystem === 'dual' ? 'selected' : ''}>AD and BS</option><option value="bs" ${state.settings.dateSystem === 'bs' ? 'selected' : ''}>BS primary</option><option value="ad" ${state.settings.dateSystem === 'ad' ? 'selected' : ''}>AD only</option></select></label><label class="field">Time zone<input value="Asia/Kathmandu (UTC+05:45)" readonly></label><label class="field">Currency<input value="NPR" readonly></label><label class="field">Fiscal year<input value="${escapeHtml(compliance.fiscalYear)}" readonly></label><label class="field">Record retention guidance<input value="${escapeHtml(compliance.recordRetentionYears)} years" readonly></label><label class="field">Holiday baseline<input value="2083 MOHA notice" readonly></label></div></fieldset>
      <section class="bright-form-section"><div class="settings-heading"><h3>Local and sector holidays</h3><p>Add dates that apply to your province, municipality, sector or organisation.</p></div><div class="nepal-custom-holidays">${state.holidays.length ? state.holidays.map((holiday, index) => `<div><span><strong>${escapeHtml(holiday.name)}</strong><small>${escapeHtml(dualDate(holiday.date))} - ${escapeHtml(holiday.scope || 'custom')}</small></span><button class="icon-button" type="button" data-remove-local-holiday="${index}" aria-label="Remove ${escapeHtml(holiday.name)}">${icon('trash', 15)}</button></div>`).join('') : '<p class="panel-description">No local holidays added.</p>'}</div><button class="button button-secondary button-small" type="button" data-add-local-holiday>${icon('plus', 15)}Add local holiday</button></section>
      <section class="bright-form-section"><div class="settings-heading"><h3>Reference baseline</h3><p>Legal and policy sources used for these product controls.</p></div><div class="nepal-source-list">${LEGAL_SOURCES.map(source => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}${icon('external', 14)}</a>`).join('')}</div><p class="panel-description">Reviewed ${escapeHtml(compliance.legalReviewDate)}. Tax rates, thresholds, holidays and procedures can change.</p></section>
      <p class="field-error nepal-form-error" data-nepal-settings-error></p><div class="form-actions"><button class="button button-primary" type="submit">Save Nepal settings</button></div>
    </form>`;
  }

  function enhanceNepalSettings() {
    if (ui.route !== 'settings') return;
    const nav = document.querySelector('.settings-nav');
    const layout = document.querySelector('.settings-layout');
    if (!nav || !layout) return;
    if (!nav.querySelector('[data-settings-nepal-market]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.settingsNepalMarket = '';
      button.textContent = 'Nepal market';
      if (ui.settingsTab === 'nepal-market') button.classList.add('is-active');
      nav.append(button);
    }
    if (!layout.querySelector('[data-nepal-market-form]')) layout.lastElementChild?.insertAdjacentHTML('beforeend', settingsPanelMarkup());
  }

  function enhanceMarketShell() {
    marketEnhancementQueued = false;
    if (!document.querySelector('.workspace-shell')) return;
    enhanceNepalSettings();
    const topbar = document.querySelector('.workspace-topbar .nav-utilities, .navbar .nav-utilities');
    if (topbar && !topbar.querySelector('[data-nepal-market-chip]')) {
      const chip = document.createElement('span');
      chip.className = 'nepal-market-chip';
      chip.dataset.nepalMarketChip = '';
      chip.textContent = `NPR | FY ${fiscalYearFor()}`;
      topbar.prepend(chip);
    }
  }

  function queueMarketEnhancement() {
    if (marketEnhancementQueued) return;
    marketEnhancementQueued = true;
    requestAnimationFrame(enhanceMarketShell);
  }

  function activateNepalSettings() {
    ui.settingsTab = 'nepal-market';
    document.querySelectorAll('.settings-nav button').forEach(button => button.classList.remove('is-active'));
    document.querySelector('[data-settings-nepal-market]')?.classList.add('is-active');
    document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.remove('is-active'));
    document.querySelector('[data-nepal-market-form]')?.classList.add('is-active');
  }

  function saveNepalSettings(form) {
    const data = new FormData(form);
    const error = form.querySelector('[data-nepal-settings-error]');
    if (error) error.textContent = '';
    const vatRegistered = data.has('vatRegistered');
    const eBillingApproved = data.has('eBillingApproved');
    const vatNumber = String(data.get('vatNumber') || '').trim();
    const reference = String(data.get('eBillingApprovalReference') || '').trim();
    if (vatRegistered && !vatNumber) {
      if (error) error.textContent = 'A VAT-registered business must record its VAT registration number.';
      form.elements.vatNumber?.focus();
      return;
    }
    if (eBillingApproved && !reference) {
      if (error) error.textContent = 'Record the IRD approval or enlistment reference before marking e-billing as approved.';
      form.elements.eBillingApprovalReference?.focus();
      return;
    }
    Object.assign(state.settings.business, {
      legalName: String(data.get('legalName') || '').trim(),
      tradingName: String(data.get('tradingName') || '').trim(),
      address: String(data.get('address') || '').trim(),
      municipality: String(data.get('municipality') || '').trim(),
      district: String(data.get('district') || '').trim(),
      province: String(data.get('province') || 'Koshi'),
      pan: String(data.get('pan') || '').trim(),
      vatRegistered,
      vatNumber,
      phone: String(data.get('phone') || '').trim(),
      email: String(data.get('businessEmail') || '').trim(),
      invoicePrefix: String(data.get('invoicePrefix') || 'INV').trim().toUpperCase(),
      paymentTermsDays: Number(data.get('paymentTermsDays')) || 0,
      eBillingApproved,
      eBillingApprovalReference: reference,
      bankName: String(data.get('bankName') || '').trim(),
      bankAccountName: String(data.get('bankAccountName') || '').trim(),
      bankAccountNumber: String(data.get('bankAccountNumber') || '').trim(),
      paymentInstructions: String(data.get('paymentInstructions') || '').trim()
    });
    Object.assign(state.settings.tax, {
      vatRate: Number(data.get('vatRate')) || 0,
      tdsEnabled: data.has('tdsEnabled'),
      tdsRate: Number(data.get('tdsRate')) || 0
    });
    state.settings.dateSystem = String(data.get('dateSystem') || 'dual');
    state.settings.currency = 'NPR';
    state.settings.timeZone = NEPAL_TIME_ZONE;
    state.settings.compliance = { ...state.settings.compliance, marketVersion: MARKET_VERSION, fiscalYear: fiscalYearFor(), legalReviewDate: '2026-08-02' };
    saveState();
    renderShell();
    toast('Nepal market settings saved.');
  }

  function openLocalHolidayForm() {
    openFormModal('Add local holiday', 'Add a provincial, municipal, sector or company holiday.', `<div class="field-grid">${field('Holiday name', 'name', '', { required: true, span: true, maxlength: 100 })}${field('Date (AD)', 'date', nepalDateKey(), { type: 'date', required: true })}${field('Scope', 'scope', 'Local', { required: true, maxlength: 80 })}</div>`, form => {
      const values = formValues(form);
      state.holidays.push(values);
      holidayCache = null;
      saveState();
      closeModal();
      renderShell();
      toast('Local holiday added.');
    });
  }

  routes.calendar.description = 'Plan in Nepal Standard Time with AD/BS dates, Saturdays and the official 2083 holiday baseline.';
  routes.invoices.description = 'Create Nepal-ready invoices, tax invoices and adjustment notes in NPR.';

  renderCalendar = renderNepalCalendar;
  renderInvoices = renderNepalInvoices;
  openInvoiceForm = openNepalInvoiceForm;
  openInvoiceDetail = openNepalInvoiceDetail;
  duplicateInvoice = duplicateNepalInvoice;
  confirmDelete = function confirmDeleteWithFiscalLock(type, id) {
    if (type === 'invoice') {
      const invoice = state.invoices.find(item => item.id === id);
      if (invoice && !invoice.__newDraft && isIssued(invoice)) {
        toast('Issued fiscal documents cannot be deleted. Create a credit or debit note instead.', 'warning');
        return;
      }
    }
    return originalConfirmDelete(type, id);
  };

  renderShell = function renderNepalMarket(...args) {
    ensureNepalState();
    const result = originalRenderShell.apply(this, args);
    enhanceMarketShell();
    return result;
  };

  document.addEventListener('click', event => {
    const tab = event.target.closest('[data-settings-nepal-market]');
    if (tab) {
      event.preventDefault();
      event.stopImmediatePropagation();
      activateNepalSettings();
      return;
    }
    const addHoliday = event.target.closest('[data-add-local-holiday]');
    if (addHoliday) {
      event.preventDefault();
      openLocalHolidayForm();
      return;
    }
    const removeHoliday = event.target.closest('[data-remove-local-holiday]');
    if (removeHoliday) {
      event.preventDefault();
      const index = Number(removeHoliday.dataset.removeLocalHoliday);
      if (Number.isInteger(index)) {
        state.holidays.splice(index, 1);
        holidayCache = null;
        saveState();
        renderShell();
        toast('Local holiday removed.', 'warning');
      }
    }
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target.closest?.('[data-nepal-market-form]');
    if (!form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    saveNepalSettings(form);
  }, true);

  const observer = new MutationObserver(queueMarketEnhancement);
  observer.observe(document.querySelector('#app'), { childList: true, subtree: true });

  ensureNepalState();
  if (document.querySelector('.workspace-shell')) renderShell();

  window.FormcraftNepal = Object.freeze({
    version: MARKET_VERSION,
    timeZone: NEPAL_TIME_ZONE,
    toBsParts,
    bsToAdKey,
    dualDate,
    fiscalYearFor,
    calculateInvoice,
    normaliseInvoice,
    holidays2083: OFFICIAL_HOLIDAYS_2083.map(item => ({ ...item })),
    audit() {
      return {
        currency: state.settings.currency,
        timeZone: state.settings.timeZone,
        fiscalYear: fiscalYearFor(),
        vatRate: state.settings.tax.vatRate,
        missingBusinessFields: ['legalName', 'address', 'pan'].filter(key => !state.settings.business[key]),
        issuedInvoices: state.invoices.filter(isIssued).length,
        editableIssuedInvoices: state.invoices.filter(invoice => isIssued(invoice) && !invoice.issuedAt).length,
        eBillingApproved: state.settings.business.eBillingApproved
      };
    }
  });
})();