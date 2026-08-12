'use strict';

(() => {
  const C = window.FormcraftNepalInvoiceCore;
  if (!C) throw new Error('Nepal invoice core is required.');
  const { previousOpenInvoiceForm, previousOpenInvoiceDetail, previousRenderShell, ensureState, nowIso, isIssued, round, money, todayKey, safeCode, toBs, bsToAd, fiscalYear, recalculate, reserveNumber, queueCbms } = C;

  function appendSuiteFields(form, invoice) {
    if (!form || form.dataset.invoiceSuiteEnhanced) return;
    form.dataset.invoiceSuiteEnhanced = 'true';
    const documentSelect = form.elements.documentType;
    if (documentSelect && !documentSelect.querySelector('[value="abbreviated-tax-invoice"]')) documentSelect.insertAdjacentHTML('beforeend', '<option value="abbreviated-tax-invoice">Abbreviated Tax Invoice</option>');
    const identity = form.querySelector('fieldset');
    identity?.querySelector('.field-grid')?.insertAdjacentHTML('beforeend', `<label class="field">Branch code<input name="branchCode" maxlength="10" value="${escapeHtml(invoice?.branchCode || state.settings.invoiceSuite.branchCode)}"></label><label class="field">Series<input name="seriesCode" maxlength="10" value="${escapeHtml(invoice?.seriesCode || state.settings.invoiceSuite.seriesCode)}"></label>`);
    const taxFieldset = [...form.querySelectorAll('fieldset')].find(node => node.textContent.includes('Tax and currency'));
    taxFieldset?.querySelector('.field-grid')?.insertAdjacentHTML('afterbegin', `<label class="field">Price mode<select name="priceMode"><option value="exclusive">Tax exclusive</option><option value="inclusive" ${invoice?.priceMode === 'inclusive' ? 'selected' : ''}>Tax inclusive</option></select></label><label class="field">Invoice discount<input name="invoiceDiscount" type="number" min="0" step="0.01" value="${escapeHtml(invoice?.invoiceDiscount || 0)}"></label><label class="field">Other charges<input name="otherCharges" type="number" min="0" step="0.01" value="${escapeHtml(invoice?.otherCharges || 0)}"></label><label class="field">Rounding adjustment<input name="roundingAdjustment" type="number" step="0.01" value="${escapeHtml(invoice?.roundingAdjustment || 0)}"></label>`);
    form.querySelectorAll('[data-line-item-row]').forEach((row, index) => addLineTaxControls(row, invoice?.lineItems?.[index]));
    form.querySelectorAll('input[type="date"]').forEach(input => addBsButton(input));
    form.querySelector('[data-foreign-currency-fields]')?.insertAdjacentHTML('beforeend', '<button class="button button-secondary button-small" type="button" data-fetch-nrb-rate>Load NRB rate</button>');
  }

  function addLineTaxControls(row, line = {}) {
    if (!row || row.querySelector('[name="lineTaxCategory"]')) return;
    row.insertAdjacentHTML('beforeend', `<label class="field np-line-tax">VAT treatment<select name="lineTaxCategory"><option value="taxable" ${line.taxCategory === 'taxable' ? 'selected' : ''}>Taxable</option><option value="exempt" ${line.taxCategory === 'exempt' ? 'selected' : ''}>Exempt</option><option value="zero-rated" ${line.taxCategory === 'zero-rated' ? 'selected' : ''}>Zero-rated</option></select></label><label class="field np-line-tax">Rate %<input name="lineTaxRate" type="number" min="0" max="100" step="0.01" value="${escapeHtml(line.taxRate ?? 13)}"></label>`);
  }

  function addBsButton(input) {
    if (input.nextElementSibling?.matches('[data-bs-date-button]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button-secondary button-small np-bs-date-button';
    button.dataset.bsDateButton = input.name;
    const bs = toBs(input.value);
    button.textContent = bs ? `${bs.year}-${String(bs.month).padStart(2, '0')}-${String(bs.day).padStart(2, '0')} BS` : 'Choose BS date';
    input.insertAdjacentElement('afterend', button);
  }

  function openBsPrompt(form, name) {
    const input = form.elements[name];
    const current = toBs(input?.value || todayKey());
    const value = prompt('Enter Nepali date as YYYY-MM-DD (BS)', current ? `${current.year}-${String(current.month).padStart(2, '0')}-${String(current.day).padStart(2, '0')}` : '2083-04-17');
    if (!value) return;
    const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const ad = match && bsToAd(match[1], match[2], match[3]);
    if (!ad) { toast('That BS date could not be converted.', 'error'); return; }
    input.value = ad;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const button = form.querySelector(`[data-bs-date-button="${CSS.escape(name)}"]`);
    if (button) button.textContent = `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')} BS`;
  }

  async function fetchNrbRate(form) {
    const currency = form.elements.currency?.value;
    const date = form.elements.issueDate?.value || todayKey();
    if (!currency || currency === 'NPR') { toast('Choose a foreign currency first.', 'warning'); return; }
    try {
      const response = await fetch(`https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=10&from=${date}&to=${date}`);
      if (!response.ok) throw new Error(`NRB returned HTTP ${response.status}`);
      const body = await response.json();
      const day = body?.data?.payload?.[0];
      const rate = day?.rates?.find(item => String(item.currency?.ISO3 || '').toUpperCase() === currency);
      if (!rate) throw new Error(`No ${currency} rate was published for ${date}.`);
      const side = state.settings.invoiceSuite.nrbRateSide;
      const unit = Number(rate.currency?.unit) || 1;
      form.elements.exchangeRate.value = (Number(side === 'buy' ? rate.buy : rate.sell) / unit).toFixed(6);
      form.elements.exchangeRate.dispatchEvent(new Event('input', { bubbles: true }));
      toast(`NRB ${side} rate loaded for ${currency}.`);
    } catch (error) { toast(error.message || 'NRB rate could not be loaded.', 'error'); }
  }

  function collectEnrichment(form, draft) {
    draft.branchCode = safeCode(form.elements.branchCode?.value, 'HO');
    draft.seriesCode = safeCode(form.elements.seriesCode?.value, 'A');
    draft.priceMode = form.elements.priceMode?.value || 'exclusive';
    draft.invoiceDiscount = Number(form.elements.invoiceDiscount?.value) || 0;
    draft.otherCharges = Number(form.elements.otherCharges?.value) || 0;
    draft.roundingAdjustment = Number(form.elements.roundingAdjustment?.value) || 0;
    draft.fiscalYear = fiscalYear(draft.issueDate);
    [...form.querySelectorAll('[data-line-item-row]')].forEach((row, index) => {
      if (!draft.lineItems[index]) return;
      draft.lineItems[index].taxCategory = row.querySelector('[name="lineTaxCategory"]')?.value || (draft.applyVat ? 'taxable' : 'exempt');
      draft.lineItems[index].taxRate = Number(row.querySelector('[name="lineTaxRate"]')?.value) || 0;
    });
    if (draft.documentType === 'abbreviated-tax-invoice') {
      draft.priceMode = 'inclusive';
      draft.lineItems.forEach(line => { line.taxCategory = 'taxable'; line.taxRate ||= state.settings.tax?.vatRate || 13; });
    }
    return recalculate(draft);
  }

  function installSubmitInterceptor(form, editingInvoice) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const data = new FormData(form);
      const existing = editingInvoice || null;
      const lineItems = [...form.querySelectorAll('[data-line-item-row]')].map(row => ({
        id: row.dataset.lineItemId || uid(), description: row.querySelector('[name="lineDescription"]')?.value.trim() || '', quantity: Number(row.querySelector('[name="lineQuantity"]')?.value) || 0, unit: row.querySelector('[name="lineUnit"]')?.value.trim() || 'unit', rate: Number(row.querySelector('[name="lineRate"]')?.value) || 0, discount: Number(row.querySelector('[name="lineDiscount"]')?.value) || 0
      }));
      const draft = collectEnrichment(form, {
        ...(existing || {}), id: existing?.id || uid(), number: existing?.number || '', documentType: String(data.get('documentType') || 'invoice'), status: String(data.get('status') || 'draft'), issueDate: String(data.get('issueDate') || todayKey()), dueDate: String(data.get('dueDate') || todayKey()), customerName: String(data.get('customerName') || '').trim(), client: String(data.get('customerName') || '').trim(), customerAddress: String(data.get('customerAddress') || '').trim(), customerPan: String(data.get('customerPan') || '').trim(), customerVatNumber: String(data.get('customerVatNumber') || '').trim(), email: String(data.get('email') || '').trim(), currency: String(data.get('currency') || 'NPR'), exchangeRate: Number(data.get('exchangeRate')) || 1, applyVat: data.has('applyVat'), vatRate: Number(data.get('vatRate')) || 0, tdsRate: data.has('applyTds') ? Number(data.get('tdsRate')) || 0 : 0, withholdingBase: Number(data.get('withholdingBase')) || 0, paymentMethod: String(data.get('paymentMethod') || 'bank-transfer'), paymentReference: String(data.get('paymentReference') || '').trim(), linkedInvoiceNumber: String(data.get('linkedInvoiceNumber') || '').trim(), linkedInvoiceDate: String(data.get('linkedInvoiceDate') || '').trim(), adjustmentReason: String(data.get('adjustmentReason') || '').trim(), notes: String(data.get('notes') || '').trim(), lineItems, payments: existing?.payments || [], auditTrail: [...(existing?.auditTrail || [])], createdAt: existing?.createdAt || nowIso(), updatedAt: nowIso(), cbms: existing?.cbms || { status: 'not-queued', outboxId: null }
      });
      if (!draft.customerName || !draft.customerAddress || draft.lineItems.some(line => !line.description || line.quantity <= 0)) { toast('Complete the customer, address and every line item.', 'error'); return; }
      if (draft.documentType === 'abbreviated-tax-invoice' && (!state.settings.invoiceSuite.abbreviatedEnabled || draft.total > state.settings.invoiceSuite.abbreviatedLimit)) { toast('Abbreviated invoice approval is disabled or the NPR limit is exceeded.', 'error'); return; }
      if (draft.status !== 'draft') {
        if (!state.settings.business?.legalName || !state.settings.business?.pan) { toast('Complete the legal business name and PAN before issuing.', 'error'); return; }
        draft.number = await reserveNumber(draft);
        draft.issuedAt ||= nowIso();
        draft.status = 'issued';
        draft.auditTrail.push({ at: nowIso(), action: 'issued-and-locked', by: currentUserName() });
        await queueCbms(draft);
      } else {
        draft.number ||= `DRAFT-${String(draft.id).slice(-8).toUpperCase()}`;
        draft.auditTrail.push({ at: nowIso(), action: existing ? 'draft-updated' : 'draft-created', by: currentUserName() });
      }
      if (existing) Object.assign(existing, draft); else state.invoices.unshift(draft);
      logActivity('invoice', draft.status === 'draft' ? 'Invoice draft saved' : 'Fiscal document issued', draft.number);
      saveState(); closeModal(); renderShell(); toast(draft.status === 'draft' ? 'Draft saved without consuming a statutory number.' : 'Document issued, numbered and locked.');
    }, true);
  }

  function enhanceInvoiceForm(invoice) {
    const form = modal.querySelector('[data-nepal-invoice-form]');
    if (!form) return;
    appendSuiteFields(form, invoice);
    installSubmitInterceptor(form, invoice?.__newDraft ? null : invoice);
    form.addEventListener('click', event => {
      const bs = event.target.closest('[data-bs-date-button]');
      if (bs) openBsPrompt(form, bs.dataset.bsDateButton);
      if (event.target.closest('[data-fetch-nrb-rate]')) fetchNrbRate(form);
      if (event.target.closest('[data-add-invoice-line]')) requestAnimationFrame(() => { const rows = form.querySelectorAll('[data-line-item-row]'); addLineTaxControls(rows[rows.length - 1]); });
    });
  }

  function addPaymentPanel(invoice) {
    if (!isIssued(invoice) || invoice.documentType === 'proforma') return;
    const body = modal.querySelector('.bright-detail-body');
    if (!body || body.querySelector('[data-payment-ledger]')) return;
    const ledger = invoice.payments.length ? invoice.payments.map(item => `<div><span><strong>${escapeHtml(item.type === 'refund' ? 'Refund' : 'Payment')}</strong><small>${escapeHtml(item.date)} · ${escapeHtml(item.method)}${item.reference ? ` · ${escapeHtml(item.reference)}` : ''}</small></span><strong>${item.type === 'refund' ? '-' : '+'}${escapeHtml(money(item.amount, invoice.currency))}</strong></div>`).join('') : '<p class="panel-description">No payments recorded.</p>';
    body.insertAdjacentHTML('beforeend', `<section class="panel np-payment-panel" data-payment-ledger><div class="panel-head"><div><p class="panel-kicker">Payment ledger</p><h3>Payments and refunds</h3><p class="panel-description">Settlement events do not modify the statutory invoice total.</p></div><div class="toolbar-group"><button class="button button-secondary button-small" type="button" data-add-refund>Refund</button><button class="button button-primary button-small" type="button" data-add-payment>Payment</button></div></div><div class="np-payment-ledger">${ledger}</div><div class="np-payment-totals"><span>Paid ${escapeHtml(money(invoice.paidAmount, invoice.currency))}</span><strong>Balance ${escapeHtml(money(invoice.balanceDue, invoice.currency))}</strong></div><p class="panel-description">CBMS: ${escapeHtml(invoice.cbms?.status || 'not queued')}</p></section>`);
    body.querySelector('[data-add-payment]')?.addEventListener('click', () => recordPayment(invoice, 'payment'));
    body.querySelector('[data-add-refund]')?.addEventListener('click', () => recordPayment(invoice, 'refund'));
  }

  function recordPayment(invoice, type) {
    const maximum = type === 'refund' ? invoice.paidAmount : invoice.balanceDue;
    if (maximum <= 0) { toast(type === 'refund' ? 'Nothing is available to refund.' : 'This invoice has no balance.', 'warning'); return; }
    const amount = Number(prompt(`${type === 'refund' ? 'Refund' : 'Payment'} amount in ${invoice.currency}`, String(maximum)));
    if (!amount || amount <= 0 || amount > maximum) { toast('Enter an amount within the available balance.', 'error'); return; }
    const reference = prompt('Payment reference (optional)', '') || '';
    invoice.payments.push({ id: uid(), type, amount: round(amount), date: todayKey(), method: invoice.paymentMethod || 'other', reference, createdAt: nowIso(), createdBy: currentUserName() });
    invoice.auditTrail.push({ at: nowIso(), action: `${type}-recorded`, by: currentUserName(), amount: round(amount) });
    recalculate(invoice); saveState(); closeModal(); renderShell(); openInvoiceDetail(invoice); toast(`${titleCase(type)} recorded.`);
  }

  openInvoiceForm = function openInvoiceSuiteForm(invoice = null, preset = null) { ensureState(); previousOpenInvoiceForm(invoice, preset); enhanceInvoiceForm(invoice); };
  openInvoiceDetail = function openInvoiceSuiteDetail(invoice) { ensureState(); recalculate(invoice); previousOpenInvoiceDetail(invoice); addPaymentPanel(invoice); };
  renderShell = function renderInvoiceSuiteShell(...args) { ensureState(); return previousRenderShell.apply(this, args); };
  ensureState();
  window.FormcraftNepalInvoice = Object.freeze({ version: C.VERSION, recalculate, cbmsPayload: C.cbmsPayload, reserveNumber, audit: () => ({ issued: state.invoices.filter(isIssued).length, cbmsPending: state.complianceOutbox.filter(item => item.status !== 'submitted').length, serverBackendAvailable: Boolean(window.FormcraftBackend?.client) }) });
})();
