'use strict';

(() => {
  const Core = window.FormcraftNepalComplianceCore;
  if (!Core) return;
  const {
    VERSION, TIME_ZONE, ERP, HOLIDAY_TYPES, number, timestamp, escape, canManage,
    ensureState, auditEvent, nptDate, bsLabel, fiscalYear, parseImportText,
    previewPunchRows, importPunchRows, addManualAttendance, addHoliday,
    savePolicy, saveFiscalProfile, complianceAudit
  } = Core;

  function openImportDialog() {
    openModal(`<form class="modal-card form-modal np-import-form" data-np-import-form novalidate>
      <div class="modal-head"><div><p class="modal-eyebrow">Biometric or time-clock export</p><h2 id="modal-title">Import attendance punches</h2><p>CSV and JSON support employee ID/code/name, timestamp or date plus time, and device.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div>
      <div class="modal-body"><div class="np-boundary"><strong>No direct device connection</strong><span>The browser does not connect directly to device UDP ports. Import an export file; a connector is a separate deployment.</span></div>
      <label class="field">Attendance file<input type="file" name="file" accept=".csv,.json,.txt" required><span class="field-hint">Duplicates inside ${ensureState().policy.duplicateWindowSeconds} seconds are ignored.</span></label>
      <div class="np-import-preview" data-np-import-preview><p>Select a file to preview.</p></div><p class="field-error" data-np-import-error></p></div>
      <div class="modal-actions"><div></div><div class="modal-actions-trailing"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit" disabled>Import accepted rows</button></div></div>
    </form>`);
    const form = modal.querySelector('[data-np-import-form]');
    let rows = [];
    let fileName = '';
    form.elements.file.addEventListener('change', async () => {
      const file = form.elements.file.files?.[0];
      if (!file) return;
      fileName = file.name;
      try {
        rows = parseImportText(await file.text(), file.name);
        const preview = previewPunchRows(rows);
        form.querySelector('[data-np-import-preview]').innerHTML = `
          <div><strong>${preview.accepted.length}</strong><span>accepted</span></div>
          <div><strong>${preview.duplicates.length}</strong><span>duplicates</span></div>
          <div><strong>${preview.errors.length}</strong><span>rejected</span></div>
          <p>${preview.errors.slice(0, 4).map(error => `Row ${error.rowNumber}: ${escape(error.error)}`).join('<br>') || 'No blocking row errors.'}</p>`;
        form.querySelector('button[type="submit"]').disabled = !preview.accepted.length;
        form.querySelector('[data-np-import-error]').textContent = '';
      } catch (error) {
        form.querySelector('[data-np-import-error]').textContent = error.message || 'The file could not be parsed.';
        form.querySelector('button[type="submit"]').disabled = true;
      }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        const result = importPunchRows(rows, { fileName });
        saveState(); await window.FormcraftBackend?.flush?.(); closeModal(); renderShell();
        toast(`${result.acceptedRows} punches imported; ${result.duplicateRows} duplicates ignored.`);
      } catch (error) {
        form.querySelector('[data-np-import-error]').textContent = error.message || 'Attendance import failed.';
      }
    });
  }

  function openManualDialog() {
    const employees = ERP.collection('employees').filter(employee => employee.status !== 'inactive');
    openModal(`<form class="modal-card form-modal" data-np-manual-form novalidate>
      <div class="modal-head"><div><p class="modal-eyebrow">Controlled correction</p><h2 id="modal-title">Add manual attendance</h2><p>Reason and approver are mandatory.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div>
      <div class="modal-body"><div class="field-grid"><label class="field span-2">Employee<select name="employeeId" required><option value="">Select employee</option>${employees.map(employee => `<option value="${escape(employee.id)}">${escape(employee.name)}</option>`).join('')}</select></label>
      <label class="field">Date (AD)<input type="date" name="date" value="${escape(nptDate())}" required></label><label class="field">BS equivalent<input name="dateBs" value="${escape(bsLabel(nptDate()))}" readonly></label>
      <label class="field">Check-in<input type="time" name="checkIn" required></label><label class="field">Check-out<input type="time" name="checkOut" required></label>
      <label class="field span-2">Reason<textarea name="reason" required maxlength="300"></textarea></label><label class="field span-2">Approver<input name="approver" required maxlength="120" autocomplete="name"></label></div><p class="field-error" data-np-manual-error></p></div>
      <div class="modal-actions"><div></div><div class="modal-actions-trailing"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Save controlled entry</button></div></div>
    </form>`);
    const form = modal.querySelector('[data-np-manual-form]');
    form.elements.date.addEventListener('change', () => { form.elements.dateBs.value = bsLabel(form.elements.date.value); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        addManualAttendance(Object.fromEntries(new FormData(form)));
        saveState(); await window.FormcraftBackend?.flush?.(); closeModal(); renderShell(); toast('Manual attendance recorded with audit evidence.');
      } catch (error) {
        form.querySelector('[data-np-manual-error]').textContent = error.message || 'Manual attendance could not be saved.';
      }
    });
  }

  function openHolidayDialog() {
    openModal(`<form class="modal-card form-modal" data-np-holiday-form novalidate>
      <div class="modal-head"><div><p class="modal-eyebrow">Holiday calendar</p><h2 id="modal-title">Add applicable holiday</h2><p>Dates are not auto-guessed because calendars change.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div>
      <div class="modal-body"><div class="field-grid"><label class="field span-2">Holiday name<input name="name" required maxlength="160"></label><label class="field">AD date<input type="date" name="dateAd" required></label><label class="field">BS equivalent<input name="dateBs" readonly></label>
      <label class="field">Type<select name="type">${HOLIDAY_TYPES.map(item => `<option value="${item[0]}">${item[1]}</option>`).join('')}</select></label><label class="field">Source note<input name="source" value="Workspace holiday calendar" maxlength="200"></label></div><p class="field-error" data-np-holiday-error></p></div>
      <div class="modal-actions"><div></div><div class="modal-actions-trailing"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Add holiday</button></div></div>
    </form>`);
    const form = modal.querySelector('[data-np-holiday-form]');
    form.elements.dateAd.addEventListener('change', () => { form.elements.dateBs.value = bsLabel(form.elements.dateAd.value); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      try { addHoliday(Object.fromEntries(new FormData(form))); saveState(); await window.FormcraftBackend?.flush?.(); closeModal(); renderShell(); toast('Holiday added.'); }
      catch (error) { form.querySelector('[data-np-holiday-error]').textContent = error.message || 'Holiday could not be saved.'; }
    });
  }

  function openPolicyDialog() {
    const policy = ensureState().policy;
    const fields = [
      ['standardDayHours', 'Normal hours/day', 1, 8, '.25'], ['standardWeekHours', 'Normal hours/week', 1, 48, '.25'],
      ['breakAfterHours', 'Break after hours', 1, 5, '.25'], ['minimumBreakMinutes', 'Minimum break minutes', 30, 180, '5'],
      ['overtimeMaxPerDay', 'Max overtime/day', 0, 4, '.25'], ['overtimeMaxPerWeek', 'Max overtime/week', 0, 24, '.25'],
      ['overtimeMultiplier', 'Overtime multiplier', 1.5, 5, '.1'], ['compensatoryLeaveDeadlineDays', 'Substitute leave deadline', 1, 21, '1'],
      ['duplicateWindowSeconds', 'Punch duplicate window', 1, 600, '1']
    ];
    openModal(`<form class="modal-card form-modal" data-np-policy-form novalidate>
      <div class="modal-head"><div><p class="modal-eyebrow">Statutory guardrails</p><h2 id="modal-title">Review attendance policy</h2><p>More generous values are allowed; less-favourable values are blocked.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div>
      <div class="modal-body"><div class="field-grid">${fields.map(field => `<label class="field">${field[1]}<input type="number" name="${field[0]}" min="${field[2]}" max="${field[3]}" step="${field[4]}" value="${policy[field[0]]}"></label>`).join('')}
      <label class="field">Weekly off<select name="weeklyOffDay">${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => `<option value="${index}" ${Number(policy.weeklyOffDay) === index ? 'selected' : ''}>${day}</option>`).join('')}</select></label>
      <label class="field span-2">Source and review note<textarea name="sourceNote" required maxlength="500">${escape(policy.sourceNote)}</textarea></label>
      <label class="setting-row span-2"><span class="setting-copy"><strong>Confirm reviewed policy</strong><p>I checked active law, sector rules and agreements.</p></span><span class="switch"><input type="checkbox" name="confirmed"><span class="switch-track"></span></span></label></div><p class="field-error" data-np-policy-error></p></div>
      <div class="modal-actions"><div></div><div class="modal-actions-trailing"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Save policy</button></div></div>
    </form>`);
    const form = modal.querySelector('[data-np-policy-form]');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      for (const field of [...fields.map(item => item[0]), 'weeklyOffDay']) values[field] = Number(values[field]);
      values.confirmed = form.elements.confirmed.checked;
      try { savePolicy(values); saveState(); await window.FormcraftBackend?.flush?.(); closeModal(); renderShell(); toast('Attendance compliance policy saved.'); }
      catch (error) { form.querySelector('[data-np-policy-error]').textContent = error.message || 'Policy could not be saved.'; }
    });
  }

  function openFiscalDialog() {
    const year = fiscalYear();
    const current = ensureState().fiscalProfiles.find(item => item.fiscalYear === year) || {};
    openModal(`<form class="modal-card form-modal" data-np-fiscal-form novalidate>
      <div class="modal-head"><div><p class="modal-eyebrow">Payroll safeguard, not payroll engine</p><h2 id="modal-title">Confirm fiscal compliance profile</h2><p>Record enacted-source review without calculating salaries.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div>
      <div class="modal-body"><div class="field-grid"><label class="field">Fiscal year<input name="fiscalYear" value="${escape(year)}" required pattern="\\d{4}/\\d{2}"></label><label class="field span-2">Source note<textarea name="sourceNote" required maxlength="500">${escape(current.sourceNote || '')}</textarea></label>
      ${[['taxSlabsConfirmed', 'Tax slabs confirmed'], ['deductionRulesConfirmed', 'Deduction rules confirmed'], ['confirmed', 'Confirm profile']].map(item => `<label class="setting-row"><span class="setting-copy"><strong>${item[1]}</strong></span><span class="switch"><input type="checkbox" name="${item[0]}" ${current[item[0]] ? 'checked' : ''}><span class="switch-track"></span></span></label>`).join('')}</div><p class="field-error" data-np-fiscal-error></p></div>
      <div class="modal-actions"><div></div><div class="modal-actions-trailing"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Save fiscal profile</button></div></div>
    </form>`);
    const form = modal.querySelector('[data-np-fiscal-form]');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      for (const key of ['taxSlabsConfirmed', 'deductionRulesConfirmed', 'confirmed']) values[key] = form.elements[key].checked;
      try { saveFiscalProfile(values); saveState(); await window.FormcraftBackend?.flush?.(); closeModal(); renderShell(); toast('Fiscal compliance profile saved.'); }
      catch (error) { form.querySelector('[data-np-fiscal-error]').textContent = error.message || 'Fiscal profile could not be saved.'; }
    });
  }

  function exportEvidence() {
    const data = ensureState();
    const payload = {
      exportedAt: timestamp(),
      version: VERSION,
      disclaimer: 'Operational evidence export only. It is not a legal compliance certificate.',
      policy: data.policy,
      fiscalProfiles: data.fiscalProfiles,
      holidays: data.holidays,
      imports: data.imports,
      compensatoryLeave: data.compensatoryLeave,
      audit: data.audit,
      evaluation: complianceAudit(),
      attendance: ERP.collection('attendance').filter(item => item.complianceManaged)
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `formcraft-nepal-compliance-evidence-${nptDate()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    auditEvent('Compliance evidence exported', 'Policy, attendance, holiday, fiscal and audit evidence exported as JSON.');
    saveState();
  }


  window.FormcraftNepalComplianceDialogs = Object.freeze({
    openImportDialog, openManualDialog, openHolidayDialog, openPolicyDialog,
    openFiscalDialog, exportEvidence
  });
})();
