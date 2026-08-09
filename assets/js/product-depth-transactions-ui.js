'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-TRANSACTIONS-1.0';
  const ERP = window.FormcraftERP;
  const Depth = window.FormcraftProductDepth;
  if (!ERP || !Depth) return;
  const enhanced = new WeakSet();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const escape = value => typeof window.escapeHtml === 'function'
    ? window.escapeHtml(value ?? '')
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const currency = value => {
    const code = state.erp?.settings?.currency || 'NPR';
    try { return new Intl.NumberFormat('en-NP', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(Number(value || 0)); }
    catch { return `${code} ${Number(value || 0).toFixed(2)}`; }
  };

  function animateIn(node, y = 8) {
    if (!node || reduceMotion.matches || !window.gsap) return;
    window.gsap.fromTo(node, { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power3.out', clearProps: 'opacity,transform,visibility' });
  }

  function patchTransactionSchemas() {
    for (const key of ['sales', 'purchase']) {
      const module = ERP.modulesByKey.get(key);
      if (!module || module.fields.some(field => field.name === 'lineItemsJson')) continue;
      module.fields.push({
        name: 'lineItemsJson',
        label: 'Line items data',
        type: 'textarea',
        span: 2,
        hint: 'Managed by the line-item editor.'
      });
    }
  }

  function productOptions(selected = '') {
    let options = [];
    try { options = ERP.relationOptions('products'); } catch {}
    if (!options.length) {
      try { options = ERP.relationOptions('inventory'); } catch {}
    }
    return `<option value="">Select product / service</option>${options.map(option => {
      const value = Array.isArray(option) ? option[0] : option?.value;
      const label = Array.isArray(option) ? option[1] : option?.label;
      return `<option value="${escape(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${escape(label)}</option>`;
    }).join('')}`;
  }

  function legacyLineFromForm(form) {
    const value = name => form.elements[name]?.value ?? '';
    const productId = value('productId');
    const quantity = Number(value('quantity') || 0);
    const unitPrice = Number(value('unitPrice') || 0);
    const total = Number(value('total') || 0);
    if (!productId && !quantity && !unitPrice && !total) return [];
    return [{
      productId,
      description: '',
      unit: 'unit',
      quantity: quantity || 1,
      unitPrice: unitPrice || total,
      discountRate: Number(value('discount') || 0),
      taxRate: Number(value('taxRate') || 0)
    }];
  }

  function rowMarkup(line, index) {
    const normalized = Depth.transaction.normalizeLine(line, index);
    return `<div class="pd-line-row" data-pd-line-row>
      <label class="pd-line-product"><span>Product / service</span><select data-pd-line="productId">${productOptions(normalized.productId)}</select></label>
      <label class="pd-line-description"><span>Description</span><input data-pd-line="description" value="${escape(normalized.description)}" placeholder="Line description"></label>
      <label><span>Qty</span><input data-pd-line="quantity" type="number" min="0" step=".001" inputmode="decimal" value="${normalized.quantity || 1}"></label>
      <label><span>Unit</span><input data-pd-line="unit" value="${escape(normalized.unit || 'unit')}" maxlength="20"></label>
      <label><span>Unit price</span><input data-pd-line="unitPrice" type="number" min="0" step=".01" inputmode="decimal" value="${normalized.unitPrice}"></label>
      <label><span>Discount %</span><input data-pd-line="discountRate" type="number" min="0" max="100" step=".01" inputmode="decimal" value="${normalized.discountRate}"></label>
      <label><span>VAT %</span><input data-pd-line="taxRate" type="number" min="0" max="100" step=".01" inputmode="decimal" value="${normalized.taxRate}"></label>
      <div class="pd-line-total"><span>Line total</span><strong data-pd-line-total>${escape(currency(normalized.total))}</strong></div>
      <button class="icon-button pd-line-remove" type="button" data-pd-remove-line aria-label="Remove line">${typeof icon === 'function' ? icon('trash', 16) : 'x'}</button>
    </div>`;
  }

  function readLineRow(row) {
    const read = key => row.querySelector(`[data-pd-line="${key}"]`)?.value ?? '';
    return {
      id: row.dataset.lineId || '',
      productId: read('productId'),
      description: read('description'),
      unit: read('unit'),
      quantity: read('quantity'),
      unitPrice: read('unitPrice'),
      discountRate: read('discountRate'),
      taxRate: read('taxRate')
    };
  }

  function syncLineEditor(form) {
    const editor = form.querySelector('[data-pd-line-editor]');
    if (!editor) return null;
    const lines = [...editor.querySelectorAll('[data-pd-line-row]')].map(readLineRow);
    const calculation = Depth.transaction.calculate(lines);
    const json = JSON.stringify(calculation.lines);
    if (form.elements.lineItemsJson) form.elements.lineItemsJson.value = json;
    const first = calculation.lines[0] || {};
    const values = {
      productId: first.productId || '',
      quantity: calculation.lines.reduce((sum, line) => sum + line.quantity, 0),
      unitPrice: first.unitPrice || 0,
      discount: first.discountRate || 0,
      taxRate: first.taxRate || 0,
      total: calculation.total
    };
    Object.entries(values).forEach(([name, value]) => {
      const control = form.elements[name];
      if (!control) return;
      control.value = String(value);
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    });
    editor.querySelectorAll('[data-pd-line-row]').forEach((row, index) => {
      const line = calculation.lines[index];
      const output = row.querySelector('[data-pd-line-total]');
      if (line && output) output.textContent = currency(line.total);
    });
    const summary = editor.querySelector('[data-pd-transaction-summary]');
    if (summary) summary.innerHTML = `<span>Subtotal <strong>${escape(currency(calculation.subtotal))}</strong></span><span>Discount <strong>${escape(currency(calculation.discount))}</strong></span><span>VAT <strong>${escape(currency(calculation.tax))}</strong></span><span class="is-total">Total <strong>${escape(currency(calculation.total))}</strong></span>`;
    return calculation;
  }

  function hideLegacyTransactionFields(form) {
    ['productId', 'quantity', 'unitPrice', 'discount', 'taxRate', 'total', 'lineItemsJson'].forEach(name => {
      const control = form.elements[name];
      control?.closest('label, .rw-field')?.classList.add('pd-legacy-transaction-field');
    });
  }

  function mountEditor(form, host) {
    const modalGrid = form.querySelector('.erp-form-grid');
    const editorMain = form.querySelector('.rw-editor-main');
    if (modalGrid) {
      const anchor = modalGrid.closest('fieldset') || modalGrid;
      anchor.insertAdjacentElement('afterend', host);
    } else if (editorMain) {
      editorMain.insertAdjacentElement('afterbegin', host);
    } else {
      const actions = form.querySelector('.modal-actions, .form-actions, [data-form-actions]');
      if (actions) actions.insertAdjacentElement('beforebegin', host);
      else form.append(host);
    }
    return host.isConnected && form.contains(host);
  }

  function enhanceTransactionForm(form) {
    if (!form || enhanced.has(form)) return;
    const moduleKey = form.dataset.erpModule || form.closest('[data-record-module]')?.dataset.recordModule;
    if (!['sales', 'purchase'].includes(moduleKey)) return;

    let lines = Depth.transaction.parseLines(form.elements.lineItemsJson?.value);
    if (!lines.length) lines = legacyLineFromForm(form);
    if (!lines.length) lines = [{ quantity: 1, taxRate: moduleKey === 'sales' ? 13 : 0 }];

    const host = document.createElement('section');
    host.className = 'pd-line-editor';
    host.dataset.pdLineEditor = moduleKey;
    host.innerHTML = `<header><div><span>Transaction lines</span><h3>${moduleKey === 'sales' ? 'Products and services' : 'Purchase items'}</h3><p>Add multiple lines with independent quantities, discounts and tax treatment.</p></div><button class="button button-secondary button-small" type="button" data-pd-add-line>${typeof icon === 'function' ? icon('plus', 15) : '+'}Add line</button></header><div class="pd-line-list" data-pd-line-list>${lines.map(rowMarkup).join('')}</div><footer data-pd-transaction-summary></footer>`;

    if (!mountEditor(form, host)) return;
    enhanced.add(form);
    hideLegacyTransactionFields(form);
    host.addEventListener('input', () => syncLineEditor(form));
    host.addEventListener('change', () => syncLineEditor(form));
    host.querySelector('[data-pd-add-line]')?.addEventListener('click', () => {
      host.querySelector('[data-pd-line-list]')?.insertAdjacentHTML('beforeend', rowMarkup({ quantity: 1, taxRate: moduleKey === 'sales' ? 13 : 0 }, host.querySelectorAll('[data-pd-line-row]').length));
      syncLineEditor(form);
      const row = host.querySelector('[data-pd-line-row]:last-child');
      animateIn(row, 4);
      row?.querySelector('select, input')?.focus();
    });
    host.addEventListener('click', event => {
      const remove = event.target.closest('[data-pd-remove-line]');
      if (!remove) return;
      const rows = host.querySelectorAll('[data-pd-line-row]');
      if (rows.length <= 1) {
        rows[0].querySelectorAll('input').forEach(input => { input.value = input.dataset.pdLine === 'quantity' ? '1' : input.dataset.pdLine === 'unit' ? 'unit' : ''; });
        rows[0].querySelectorAll('select').forEach(select => { select.value = ''; });
      } else {
        remove.closest('[data-pd-line-row]')?.remove();
      }
      syncLineEditor(form);
    });
    syncLineEditor(form);
  }

  function enhanceAll() {
    patchTransactionSchemas();
    document.querySelectorAll('form[data-erp-form], form[data-rw-form]').forEach(enhanceTransactionForm);
    document.documentElement.dataset.formcraftProductDepthTransactions = VERSION;
  }

  document.addEventListener('submit', event => {
    const form = event.target.closest?.('form[data-erp-form], form[data-rw-form]');
    if (form) syncLineEditor(form);
  }, true);
  new MutationObserver(() => requestAnimationFrame(enhanceAll)).observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
  document.addEventListener('formcraft:workspace-ready', enhanceAll);
  enhanceAll();

  window.FormcraftProductDepthTransactionsUI = Object.freeze({ version: VERSION, refresh: enhanceAll, syncLineEditor });
})();
