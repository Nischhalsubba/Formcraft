'use strict';

(() => {
  const baseOpenInvoiceDetail = openInvoiceDetail;

  function openIssuedCorrectionPolicy(invoice) {
    openModal(`<form class="modal-card form-modal" data-modal-form novalidate>
      <div class="modal-head"><div><p class="modal-eyebrow">Issued fiscal document</p><h2 id="modal-title">Correction controls</h2><p>${escapeHtml(invoice.number)} is locked after issuance.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div>
      <div class="modal-body"><div class="nepal-form-alert"><strong>Direct editing is disabled</strong><span>Return to the document and create a linked credit note or debit note. This preserves the original invoice number, date, values and audit trail.</span></div></div>
      <div class="modal-actions"><div></div><div class="modal-actions-trailing"><button class="button button-primary" type="button" data-close-modal>Return to invoice</button></div></div>
    </form>`);
  }

  openInvoiceDetail = function openInvoiceDetailWithStableContracts(invoice) {
    const result = baseOpenInvoiceDetail(invoice);
    const detail = modal.querySelector('.nepal-invoice-detail');
    if (!detail) return result;

    detail.classList.add('bright-invoice-detail');
    const draftEdit = detail.querySelector('[data-edit-nepal-invoice]');
    if (draftEdit) {
      draftEdit.dataset.detailEditInvoice = '';
      draftEdit.addEventListener('click', () => {
        requestAnimationFrame(() => modal.querySelector('[data-nepal-invoice-form]')?.setAttribute('data-modal-form', ''));
      });
      return result;
    }

    const actions = detail.querySelector('.bright-detail-actions');
    if (actions && !actions.querySelector('[data-detail-edit-invoice]')) {
      const policy = document.createElement('button');
      policy.type = 'button';
      policy.className = 'button button-secondary';
      policy.dataset.detailEditInvoice = '';
      policy.textContent = 'Correction options';
      policy.addEventListener('click', () => openIssuedCorrectionPolicy(invoice));
      actions.insertBefore(policy, actions.querySelector('[data-close-modal]'));
    }
    return result;
  };
})();