'use strict';

(() => {
  const C = window.FormcraftNepalInvoiceCore;
  if (!C) return;
  const { ensureState, safeCode, CBMS_THRESHOLD, ABBREVIATED_LIMIT } = C;

  function enhanceSettings() {
    if (ui.route !== 'settings') return;
    const nav = document.querySelector('.settings-nav');
    const host = document.querySelector('.settings-layout')?.lastElementChild;
    if (!nav || !host) return;
    if (!nav.querySelector('[data-settings-invoice-suite]')) nav.insertAdjacentHTML('beforeend', '<button type="button" data-settings-invoice-suite>Invoice compliance</button>');
    if (!host.querySelector('[data-invoice-suite-settings]')) host.insertAdjacentHTML('beforeend', `<form class="settings-panel ${ui.settingsTab === 'invoice-suite' ? 'is-active' : ''}" data-invoice-suite-settings><div class="settings-heading"><h2>Nepal invoice compliance</h2><p>Atomic numbering, abbreviated invoices and CBMS readiness.</p></div><div class="nepal-form-alert"><strong>Not IRD certification</strong><span>These controls do not approve or enlist the deployed software.</span></div><div class="field-grid"><label class="field">Branch code<input name="branchCode" value="${escapeHtml(state.settings.invoiceSuite.branchCode)}"></label><label class="field">Series<input name="seriesCode" value="${escapeHtml(state.settings.invoiceSuite.seriesCode)}"></label><label class="field">Annual turnover NPR<input name="annualTurnover" type="number" min="0" value="${escapeHtml(state.settings.invoiceSuite.annualTurnover)}"></label><label class="field">Abbreviated invoice limit<input name="abbreviatedLimit" type="number" min="0" value="${escapeHtml(state.settings.invoiceSuite.abbreviatedLimit)}"></label><label class="setting-row nepal-inline-check span-2"><span class="setting-copy"><strong>Enable abbreviated tax invoice</strong><p>Only after confirming the applicable approval.</p></span><span class="switch"><input name="abbreviatedEnabled" type="checkbox" ${state.settings.invoiceSuite.abbreviatedEnabled ? 'checked' : ''}><span class="switch-track"></span></span></label><label class="setting-row nepal-inline-check span-2"><span class="setting-copy"><strong>Queue issued documents for CBMS</strong><p>Creates an outbox; it does not submit without an approved adapter.</p></span><span class="switch"><input name="cbmsEnabled" type="checkbox" ${state.settings.invoiceSuite.cbmsEnabled ? 'checked' : ''}><span class="switch-track"></span></span></label><label class="setting-row nepal-inline-check span-2"><span class="setting-copy"><strong>Approved CBMS adapter configured</strong><p>Enable only after schema, endpoint, credentials and IRD approval are verified.</p></span><span class="switch"><input name="cbmsAdapterConfigured" type="checkbox" ${state.settings.invoiceSuite.cbmsAdapterConfigured ? 'checked' : ''}><span class="switch-track"></span></span></label><label class="field">NRB rate side<select name="nrbRateSide"><option value="sell">Selling rate</option><option value="buy" ${state.settings.invoiceSuite.nrbRateSide === 'buy' ? 'selected' : ''}>Buying rate</option></select></label><label class="field">Assessment<input readonly value="${Number(state.settings.invoiceSuite.annualTurnover) > CBMS_THRESHOLD ? 'Above configured CBMS threshold' : 'Below/equal configured threshold'}"></label></div><div class="form-actions"><button class="button button-primary" type="submit">Save invoice settings</button></div></form>`);
  }

  const previousSettingsRender = renderShell;
  renderShell = function renderInvoiceSettingsShell(...args) { ensureState(); const result = previousSettingsRender.apply(this, args); requestAnimationFrame(enhanceSettings); return result; };

  document.addEventListener('click', event => {
    if (!event.target.closest('[data-settings-invoice-suite]')) return;
    ui.settingsTab = 'invoice-suite';
    document.querySelectorAll('.settings-nav button').forEach(button => button.classList.remove('is-active'));
    event.target.closest('button').classList.add('is-active');
    document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.remove('is-active'));
    document.querySelector('[data-invoice-suite-settings]')?.classList.add('is-active');
  }, true);

  document.addEventListener('submit', event => {
    const form = event.target.closest?.('[data-invoice-suite-settings]');
    if (!form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const data = new FormData(form);
    Object.assign(state.settings.invoiceSuite, {
      branchCode: safeCode(data.get('branchCode'), 'HO'),
      seriesCode: safeCode(data.get('seriesCode'), 'A'),
      annualTurnover: Number(data.get('annualTurnover')) || 0,
      abbreviatedLimit: Number(data.get('abbreviatedLimit')) || ABBREVIATED_LIMIT,
      abbreviatedEnabled: data.has('abbreviatedEnabled'),
      cbmsEnabled: data.has('cbmsEnabled'),
      cbmsAdapterConfigured: data.has('cbmsAdapterConfigured'),
      nrbRateSide: String(data.get('nrbRateSide') || 'sell')
    });
    saveState();
    renderShell();
    toast('Invoice compliance settings saved.');
  }, true);

  ensureState();
})();
