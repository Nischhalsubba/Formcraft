'use strict';

(() => {
  const VERSION = 'NP-INVOICE-2.0';
  const TIME_ZONE = 'Asia/Kathmandu';
  const CBMS_THRESHOLD = 200000000;
  const ABBREVIATED_LIMIT = 10000;
  const ISSUED = new Set(['sent', 'issued', 'paid', 'partially-paid', 'overdue']);
  const previousOpenInvoiceForm = openInvoiceForm;
  const previousOpenInvoiceDetail = openInvoiceDetail;
  const previousRenderShell = renderShell;

  const settingsDefaults = {
    version: VERSION,
    branchCode: 'HO',
    seriesCode: 'A',
    sequenceDigits: 6,
    pricesIncludeVat: false,
    abbreviatedEnabled: false,
    abbreviatedLimit: ABBREVIATED_LIMIT,
    annualTurnover: 0,
    cbmsEnabled: false,
    cbmsAdapterConfigured: false,
    nrbRateSide: 'sell'
  };

  function ensureState() {
    state.settings ||= {};
    state.settings.invoiceSuite = { ...settingsDefaults, ...(state.settings.invoiceSuite || {}), version: VERSION };
    state.invoiceSequences ||= {};
    state.complianceOutbox = Array.isArray(state.complianceOutbox) ? state.complianceOutbox : [];
    state.invoices = Array.isArray(state.invoices) ? state.invoices : [];
    state.invoices.forEach(invoice => {
      invoice.payments = Array.isArray(invoice.payments) ? invoice.payments : [];
      invoice.auditTrail = Array.isArray(invoice.auditTrail) ? invoice.auditTrail : [];
      invoice.cbms ||= { status: 'not-queued', outboxId: null };
      invoice.branchCode ||= state.settings.invoiceSuite.branchCode;
      invoice.seriesCode ||= state.settings.invoiceSuite.seriesCode;
      invoice.priceMode ||= state.settings.invoiceSuite.pricesIncludeVat ? 'inclusive' : 'exclusive';
      invoice.invoiceDiscount = Number(invoice.invoiceDiscount) || 0;
      invoice.otherCharges = Number(invoice.otherCharges) || 0;
      invoice.roundingAdjustment = Number(invoice.roundingAdjustment) || 0;
      invoice.lineItems = (invoice.lineItems || []).map(line => ({
        ...line,
        taxCategory: line.taxCategory || (invoice.applyVat ? 'taxable' : 'exempt'),
        taxRate: Number(line.taxRate ?? invoice.vatRate ?? 13) || 0
      }));
      recalculate(invoice);
    });
  }

  function nowIso() { return new Date().toISOString(); }
  function isIssued(invoice) { return Boolean(invoice?.issuedAt || ISSUED.has(invoice?.status)); }
  function round(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
  function money(value, currency = 'NPR') {
    try { return new Intl.NumberFormat('en-NP', { style: 'currency', currency }).format(Number(value) || 0); }
    catch { return `${currency} ${round(value).toFixed(2)}`; }
  }
  function todayKey() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function safeCode(value, fallback) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || fallback;
  }
  function toBs(value) { return window.FormcraftNepal?.toBsParts?.(value) || null; }
  function bsToAd(year, month, day) { return window.FormcraftNepal?.bsToAdKey?.(Number(year), Number(month), Number(day)) || null; }
  function fiscalYear(value) { return window.FormcraftNepal?.fiscalYearFor?.(value) || state.settings.compliance?.fiscalYear || '2083/84'; }

  function paymentTotal(invoice) {
    return (invoice.payments || []).reduce((sum, item) => sum + (item.type === 'refund' ? -Number(item.amount) : Number(item.amount)), 0);
  }

  function recalculate(invoice) {
    const lines = invoice.lineItems || [];
    const lineBase = lines.map(line => Math.max(0, Number(line.quantity) * Number(line.rate) - Number(line.discount || 0)));
    const baseTotal = lineBase.reduce((sum, value) => sum + value, 0);
    const invoiceDiscount = Math.min(Math.max(0, Number(invoice.invoiceDiscount) || 0), baseTotal);
    let taxableAmount = 0;
    let exemptAmount = 0;
    let zeroRatedAmount = 0;
    let vatAmount = 0;
    invoice.lineItems = lines.map((line, index) => {
      const category = line.taxCategory || (invoice.applyVat ? 'taxable' : 'exempt');
      const rate = category === 'taxable' ? Number(line.taxRate ?? invoice.vatRate ?? 13) || 0 : 0;
      const allocation = baseTotal ? invoiceDiscount * lineBase[index] / baseTotal : 0;
      const adjusted = Math.max(0, lineBase[index] - allocation);
      let net = adjusted;
      let vat = 0;
      let gross = adjusted;
      if (category === 'taxable' && rate > 0 && invoice.priceMode === 'inclusive') {
        net = adjusted / (1 + rate / 100);
        vat = adjusted - net;
      } else if (category === 'taxable' && rate > 0) {
        vat = adjusted * rate / 100;
        gross = adjusted + vat;
      }
      if (category === 'taxable') taxableAmount += net;
      if (category === 'exempt') exemptAmount += net;
      if (category === 'zero-rated') zeroRatedAmount += net;
      vatAmount += vat;
      return { ...line, taxCategory: category, taxRate: rate, invoiceDiscountAllocation: round(allocation), netAmount: round(net), taxAmount: round(vat), grossAmount: round(gross) };
    });
    invoice.subtotal = round(lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.rate), 0));
    invoice.discount = round(lines.reduce((sum, line) => sum + Number(line.discount || 0), 0));
    invoice.invoiceDiscount = round(invoiceDiscount);
    invoice.taxableAmount = round(taxableAmount);
    invoice.exemptAmount = round(exemptAmount);
    invoice.zeroRatedAmount = round(zeroRatedAmount);
    invoice.vatAmount = round(vatAmount);
    invoice.total = round(invoice.lineItems.reduce((sum, line) => sum + line.grossAmount, 0) + Number(invoice.otherCharges || 0) + Number(invoice.roundingAdjustment || 0));
    invoice.amount = invoice.total;
    invoice.paidAmount = round(paymentTotal(invoice));
    invoice.balanceDue = round(Math.max(0, invoice.total - invoice.paidAmount));
    invoice.nprEquivalent = invoice.currency === 'NPR' ? invoice.total : round(invoice.total * Number(invoice.exchangeRate || 0));
    if (isIssued(invoice)) invoice.status = invoice.balanceDue <= 0 ? 'paid' : invoice.paidAmount > 0 ? 'partially-paid' : invoice.dueDate < todayKey() ? 'overdue' : 'issued';
    return invoice;
  }

  function localNumber(invoice) {
    const key = [invoice.fiscalYear, invoice.branchCode, invoice.documentType, invoice.seriesCode].join('|');
    const current = Number(state.invoiceSequences[key]) || 0;
    const next = current + 1;
    state.invoiceSequences[key] = next;
    const prefix = invoice.documentType === 'credit-note' ? 'CN' : invoice.documentType === 'debit-note' ? 'DN' : invoice.documentType === 'proforma' ? 'PRO' : invoice.documentType === 'abbreviated-tax-invoice' ? 'ATI' : state.settings.business?.invoicePrefix || 'INV';
    return `${safeCode(prefix, 'INV')}-${safeCode(invoice.branchCode, 'HO')}-${String(invoice.fiscalYear).replace('/', '-')}-${safeCode(invoice.seriesCode, 'A')}-${String(next).padStart(state.settings.invoiceSuite.sequenceDigits, '0')}`;
  }

  async function reserveNumber(invoice) {
    const backend = window.FormcraftBackend;
    if (backend?.client && backend.workspace?.id) {
      const { data, error } = await backend.client.rpc('reserve_invoice_number', {
        target_workspace: backend.workspace.id,
        fiscal_year: invoice.fiscalYear,
        branch_code: invoice.branchCode,
        document_type: invoice.documentType,
        series_code: invoice.seriesCode,
        number_prefix: invoice.documentType === 'credit-note' ? 'CN' : invoice.documentType === 'debit-note' ? 'DN' : invoice.documentType === 'abbreviated-tax-invoice' ? 'ATI' : state.settings.business?.invoicePrefix || 'INV'
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (!error && row?.invoice_number) return row.invoice_number;
      console.warn('Server invoice sequence unavailable.', error);
    }
    toast('Server numbering is unavailable. A workspace-local number was assigned; avoid simultaneous issuance until the migration is applied.', 'warning');
    return localNumber(invoice);
  }

  function cbmsPayload(invoice) {
    return {
      schemaVersion: 'formcraft-cbms-draft-1',
      submissionReady: false,
      invoiceNumber: invoice.number,
      fiscalYear: invoice.fiscalYear,
      documentType: invoice.documentType,
      issueDateAd: invoice.issueDate,
      issueDateBs: toBs(invoice.issueDate),
      seller: state.settings.business,
      buyer: { name: invoice.customerName || invoice.client, address: invoice.customerAddress, pan: invoice.customerPan, vatNumber: invoice.customerVatNumber },
      currency: invoice.currency,
      exchangeRate: invoice.exchangeRate,
      taxableAmount: invoice.taxableAmount,
      exemptAmount: invoice.exemptAmount,
      zeroRatedAmount: invoice.zeroRatedAmount,
      vatAmount: invoice.vatAmount,
      grandTotal: invoice.total,
      nprEquivalent: invoice.nprEquivalent,
      items: invoice.lineItems
    };
  }

  async function queueCbms(invoice) {
    if (!state.settings.invoiceSuite.cbmsEnabled || invoice.documentType === 'proforma') return;
    const payload = cbmsPayload(invoice);
    const idempotencyKey = `${invoice.id}:${invoice.number}:${invoice.updatedAt}`;
    const backend = window.FormcraftBackend;
    if (backend?.client && backend.workspace?.id) {
      const { data, error } = await backend.client.rpc('enqueue_invoice_compliance_payload', {
        target_workspace: backend.workspace.id,
        target_invoice_id: invoice.id,
        target_idempotency_key: idempotencyKey,
        target_payload: payload
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (!error && row?.outbox_id) {
        invoice.cbms = { status: state.settings.invoiceSuite.cbmsAdapterConfigured ? 'ready' : 'pending-adapter', outboxId: row.outbox_id };
        return;
      }
    }
    const item = { id: uid(), invoiceId: invoice.id, idempotencyKey, payload, status: 'pending-adapter', attempts: 0, createdAt: nowIso() };
    state.complianceOutbox.push(item);
    invoice.cbms = { status: item.status, outboxId: item.id };
  }

  window.FormcraftNepalInvoiceCore = Object.freeze({ VERSION, CBMS_THRESHOLD, ABBREVIATED_LIMIT, previousOpenInvoiceForm, previousOpenInvoiceDetail, previousRenderShell, ensureState, nowIso, isIssued, round, money, todayKey, safeCode, toBs, bsToAd, fiscalYear, recalculate, reserveNumber, cbmsPayload, queueCbms });
})();
