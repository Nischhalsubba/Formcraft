'use strict';

(() => {
  const Core = window.FormcraftNepalComplianceCore;
  const Views = window.FormcraftNepalComplianceViews;
  const Dialogs = window.FormcraftNepalComplianceDialogs;
  if (!Core || !Views || !Dialogs) return;
  if (typeof globalThis.bsLabel !== 'function') globalThis.bsLabel = Core.bsLabel;
  const {
    VERSION, ERP, LEGAL_RULES, LEAVE_REFERENCE, ensureState, parseImportText,
    previewPunchRows, importPunchRows, addManualAttendance, addHoliday, removeHoliday,
    savePolicy, saveFiscalProfile, grantCompensatoryLeave, complianceAudit,
    monthRegister, attendanceStatus
  } = Core;
  const { renderCompliancePage } = Views;
  const { openImportDialog, openManualDialog, openHolidayDialog, openPolicyDialog, openFiscalDialog, exportEvidence } = Dialogs;

  function bindCompliancePage() {
    const root = document.querySelector('[data-np-compliance-page]');
    if (!root || root.dataset.bound) return;
    root.dataset.bound = 'true';
    root.querySelector('[data-np-import]')?.addEventListener('click', openImportDialog);
    root.querySelector('[data-np-manual]')?.addEventListener('click', openManualDialog);
    root.querySelector('[data-np-export]')?.addEventListener('click', exportEvidence);
    root.querySelector('[data-np-refresh]')?.addEventListener('click', () => { complianceAudit(); saveState(); renderShell(); toast('Compliance evaluation refreshed.'); });
    root.querySelector('[data-np-add-holiday]')?.addEventListener('click', openHolidayDialog);
    root.querySelector('[data-np-edit-policy]')?.addEventListener('click', openPolicyDialog);
    root.querySelector('[data-np-edit-fiscal]')?.addEventListener('click', openFiscalDialog);
    root.querySelectorAll('[data-np-view]').forEach(button => button.addEventListener('click', () => { ensureState().activeView = button.dataset.npView; renderShell(); }));
    root.querySelectorAll('[data-np-open-app]').forEach(button => button.addEventListener('click', () => { const app = ERP.appByKey?.(button.dataset.npOpenApp); if (app) window.FormcraftERPUI?.goToApp?.(app); }));
    root.querySelectorAll('[data-np-open-attendance]').forEach(button => button.addEventListener('click', () => window.FormcraftERPUI?.openERPRecord?.('attendance', button.dataset.npOpenAttendance)));
    root.querySelectorAll('[data-np-delete-holiday]').forEach(button => button.addEventListener('click', () => confirmAction('Delete this holiday?', 'Attendance and substitute-leave evaluation will change.', async () => { removeHoliday(button.dataset.npDeleteHoliday); saveState(); await window.FormcraftBackend?.flush?.(); renderShell(); toast('Holiday removed.', 'warning'); })));
    root.querySelectorAll('[data-np-grant-comp]').forEach(button => button.addEventListener('click', async () => { grantCompensatoryLeave(button.dataset.npGrantComp); saveState(); await window.FormcraftBackend?.flush?.(); renderShell(); toast('Substitute leave marked as granted.'); }));
  }

  function injectNavigation() {
    const add = root => {
      if (!root || root.querySelector('[data-np-compliance-nav]')) return;
      const link = document.createElement('a');
      link.href = '#nepal-compliance';
      link.dataset.route = 'nepal-compliance';
      link.dataset.npComplianceNav = '';
      link.dataset.navState = ui.route === 'nepal-compliance' ? 'active' : 'inactive';
      link.className = `fc4-nav-item ${ui.route === 'nepal-compliance' ? 'is-active' : ''}`;
      link.innerHTML = `<span class="fc4-nav-icon">${icon('check', 18)}</span><span class="fc4-nav-label">Nepal compliance</span>`;
      link.addEventListener('click', event => { event.preventDefault(); navigate('nepal-compliance'); document.body.classList.remove('drawer-open', 'fc3-context-open'); });
      const anchor = root.querySelector('[data-demo-data-nav]') || root.querySelector('[data-nav-key="settings"]');
      if (anchor) anchor.before(link); else root.append(link);
    };
    add(document.querySelector('.fc4-sidebar [data-nav-section="tools"] .fc4-nav-list'));
    add(document.querySelector('.fc4-mobile-nav [data-nav-section="tools"] .fc4-nav-list'));
  }

  routes['nepal-compliance'] = {
    label: 'Nepal compliance',
    title: 'Attendance & compliance center',
    description: 'Nepal attendance controls, holiday-aware status, evidence and fiscal safeguards.',
    icon: 'check'
  };
  const renderPageBeforeCompliance = renderPage;
  renderPage = function renderNepalComplianceRoute() {
    return ui.route === 'nepal-compliance' ? renderCompliancePage() : renderPageBeforeCompliance();
  };
  const bindPageBeforeCompliance = bindPage;
  bindPage = function bindNepalComplianceRoute() {
    bindPageBeforeCompliance();
    if (ui.route === 'nepal-compliance') requestAnimationFrame(bindCompliancePage);
  };
  const renderShellBeforeCompliance = renderShell;
  renderShell = function renderNepalComplianceShell(...args) {
    const result = renderShellBeforeCompliance.apply(this, args);
    requestAnimationFrame(() => { injectNavigation(); if (ui.route === 'nepal-compliance') bindCompliancePage(); });
    return result;
  };



  ensureState();
  window.FormcraftNepalCompliance = Object.freeze({
    version: VERSION,
    ensureState,
    parseImportText,
    previewPunchRows,
    importPunchRows,
    addManualAttendance,
    addHoliday,
    removeHoliday,
    savePolicy,
    saveFiscalProfile,
    grantCompensatoryLeave,
    audit: complianceAudit,
    monthRegister,
    attendanceStatus,
    renderPage: renderCompliancePage,
    legalRules: LEGAL_RULES,
    leaveReference: LEAVE_REFERENCE
  });
})();
