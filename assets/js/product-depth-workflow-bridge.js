'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-WORKFLOW-BRIDGE-1.0';
  const ERP = window.FormcraftERP;
  const Depth = window.FormcraftProductDepth;
  if (!ERP || !Depth) return;

  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = (value, precision = 3) => {
    const factor = 10 ** precision;
    return Math.round((num(value) + Number.EPSILON) * factor) / factor;
  };
  const now = () => new Date().toISOString();
  const today = () => now().slice(0, 10);
  const uidValue = () => typeof window.uid === 'function'
    ? window.uid()
    : `pd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  function recordFor(button) {
    const moduleKey = button?.dataset.erpModule || '';
    const recordId = button?.dataset.erpRecord || '';
    const record = moduleKey && recordId ? ERP.collection(moduleKey).find(item => item.id === recordId) : null;
    return { moduleKey, recordId, record };
  }

  function inventoryFor(productId) {
    if (!productId) return null;
    const inventory = ERP.collection('inventory');
    return inventory.find(item => item.id === productId || item.productId === productId || item.catalogProductId === productId) || null;
  }

  function createAdditionalStockMove(line, direction, moduleKey, record) {
    const product = inventoryFor(line.productId);
    if (!product || line.quantity <= 0) return null;
    const signed = direction === 'in' ? Math.abs(num(line.quantity)) : -Math.abs(num(line.quantity));
    product.onHand = round(num(product.onHand) + signed);
    product.updatedAt = now();
    const move = {
      id: uidValue(),
      reference: typeof ERP.nextSequence === 'function' ? ERP.nextSequence('stockMove', 'MOVE-') : `MOVE-${Date.now()}`,
      productId: product.id,
      quantity: Math.abs(num(line.quantity)),
      direction,
      date: today(),
      warehouseId: record.warehouseId || product.warehouseId || 'warehouse-main',
      sourceModule: moduleKey,
      sourceRecordId: record.id,
      sourceLineId: line.id,
      companyId: record.companyId,
      branchId: record.branchId,
      createdAt: now(),
      updatedAt: now()
    };
    ERP.collection('stockMoves').unshift(move);
    ERP.recordAudit?.(ERP.modulesByKey.get('inventory'), product, 'Stock updated', `${signed > 0 ? '+' : ''}${signed} from line ${line.id}`);
    return move;
  }

  function hydrateInvoice(record, lines) {
    const invoice = state.invoices?.find(item => item.id === record.invoiceId);
    if (!invoice) return null;
    const payload = Depth.transaction.invoicePayloadFrom({ ...record, lineItems: lines });
    Object.assign(invoice, payload, { updatedAt: now() });
    const nextLines = lines.map(line => ({ ...line, invoicedQuantity: line.quantity }));
    Depth.transaction.apply(record, nextLines);
    return invoice;
  }

  function hydrateVendorBill(record, lines) {
    const bill = ERP.collection('vendorBills').find(item => item.id === record.vendorBillId);
    if (!bill) return null;
    const payload = Depth.transaction.invoicePayloadFrom({ ...record, lineItems: lines });
    Object.assign(bill, payload, { amount: payload.total, updatedAt: now() });
    return bill;
  }

  function restoreAggregate(record, original, lines, action) {
    if (!record) return;
    record.productId = original.productId;
    record.quantity = original.quantity;
    const next = lines.map(line => ({
      ...line,
      deliveredQuantity: action === 'sales-deliver' || action === 'purchase-receive' ? line.quantity : line.deliveredQuantity
    }));
    Depth.transaction.apply(record, next);
  }

  function persistAndRefresh() {
    Promise.resolve(typeof saveState === 'function' ? saveState() : undefined)
      .then(() => window.FormcraftBackend?.flush?.())
      .catch(() => {});
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-erp-workflow]');
    if (!button) return;
    const action = button.dataset.erpWorkflow;
    if (!['sales-deliver', 'sales-invoice', 'purchase-receive', 'purchase-bill', 'crm-quotation'].includes(action)) return;
    const { moduleKey, record } = recordFor(button);
    if (!record) return;

    if (action === 'crm-quotation') {
      setTimeout(() => {
        const order = record.salesOrderId ? ERP.collection('sales').find(item => item.id === record.salesOrderId) : null;
        if (!order) return;
        const lines = Depth.transaction.linesForRecord(order);
        if (lines.length) Depth.transaction.apply(order, lines);
        persistAndRefresh();
      }, 0);
      return;
    }

    const lines = Depth.transaction.linesForRecord(record);
    if (!lines.length) return;

    if (action === 'sales-invoice' || action === 'purchase-bill') {
      setTimeout(() => {
        if (action === 'sales-invoice') hydrateInvoice(record, lines);
        else hydrateVendorBill(record, lines);
        persistAndRefresh();
      }, 0);
      return;
    }

    if (lines.length <= 1) {
      setTimeout(() => {
        const next = lines.map(line => ({ ...line, deliveredQuantity: line.quantity }));
        Depth.transaction.apply(record, next);
        persistAndRefresh();
      }, 0);
      return;
    }

    const first = lines[0];
    const original = { productId: record.productId, quantity: record.quantity };
    record.productId = first.productId;
    record.quantity = first.quantity;

    setTimeout(() => {
      const direction = action === 'purchase-receive' ? 'in' : 'out';
      lines.slice(1).forEach(line => createAdditionalStockMove(line, direction, moduleKey, record));
      restoreAggregate(record, original, lines, action);
      persistAndRefresh();
    }, 0);
  }, true);

  document.documentElement.dataset.formcraftProductDepthWorkflowBridge = VERSION;
  window.FormcraftProductDepthWorkflowBridge = Object.freeze({ version: VERSION, inventoryFor, hydrateInvoice, hydrateVendorBill });
})();
