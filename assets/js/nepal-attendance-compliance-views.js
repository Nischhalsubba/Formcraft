'use strict';

(() => {
  const Core = window.FormcraftNepalComplianceCore;
  if (!Core) return;
  const {
    TIME_ZONE, ERP, LEGAL_RULES, LEAVE_REFERENCE, HOLIDAY_TYPES,
    number, escape, canManage, ensureState, bsParts, bsLabel, fiscalYear,
    complianceAudit, monthRegister
  } = Core;

  const empty = (title, copy) => `<div class="np-compliance-empty"><strong>${escape(title)}</strong><span>${escape(copy)}</span></div>`;
  const metric = (label, value, hint) => `<article><span>${escape(label)}</span><strong>${escape(value)}</strong><small>${escape(hint)}</small></article>`;

  function issuesMarkup(audit) {
    if (!audit.issues.length) return empty('No operational exceptions found', 'This is a readiness result, not legal certification.');
    return `<div class="np-compliance-issues">${audit.issues.slice(0, 30).map(item => `
      <article data-severity="${escape(item.severity)}">
        <span>${escape(item.severity)}</span>
        <div><strong>${escape(item.title)}</strong><p>${escape(item.detail)}</p></div>
        ${item.recordId ? `<button type="button" data-np-open-attendance="${escape(item.recordId)}">Open</button>` : ''}
      </article>`).join('')}</div>`;
  }

  function holidayMarkup() {
    const holidays = ensureState().holidays;
    if (!holidays.length) return empty('No holidays configured', 'Dates are intentionally not guessed. Add applicable public and organization holidays.');
    return `<div class="np-holiday-list">${holidays.slice(0, 40).map(holiday => `
      <article><div><span>${escape((HOLIDAY_TYPES.find(type => type[0] === holiday.type) || HOLIDAY_TYPES[4])[1])}</span>
      <strong>${escape(holiday.name)}</strong><small>${escape(holiday.dateAd)} / ${escape(holiday.dateBs)}</small></div>
      ${canManage() ? `<button class="icon-button" type="button" data-np-delete-holiday="${escape(holiday.id)}" aria-label="Delete ${escape(holiday.name)}">${icon('trash', 16)}</button>` : ''}</article>`).join('')}</div>`;
  }

  function compMarkup() {
    const items = ensureState().compensatoryLeave;
    if (!items.length) return empty('No substitute-leave obligations', 'Weekly-off or holiday work creates a 21-day tracker.');
    return `<div class="np-comp-list">${items.slice(0, 30).map(item => `
      <article data-status="${escape(item.status)}"><div><span>${escape(item.status)}</span>
      <strong>${escape(item.employeeName || item.employeeCode || 'Unmatched employee')}</strong>
      <small>${escape(item.reason)}. Worked ${escape(item.workedDate)}; due ${escape(item.dueDate)}.</small></div>
      ${item.status !== 'granted' && canManage() ? `<button class="button button-secondary button-small" type="button" data-np-grant-comp="${escape(item.id)}">Mark granted</button>` : `<em>${item.grantedDate ? `Granted ${escape(item.grantedDate)}` : 'Open'}</em>`}</article>`).join('')}</div>`;
  }

  function historyMarkup() {
    const imports = ensureState().imports;
    if (!imports.length) return empty('No attendance imports', 'Import CSV or JSON exported from a biometric or time-clock system.');
    return `<div class="np-import-history">${imports.slice(0, 20).map(item => `
      <article><div><strong>${escape(item.fileName)}</strong><small>${escape(new Date(item.importedAt).toLocaleString('en-NP', { timeZone: TIME_ZONE }))}</small></div>
      <span>${item.acceptedRows} accepted</span><span>${item.duplicateRows} duplicate</span><span>${item.errorRows} rejected</span></article>`).join('')}</div>`;
  }

  function fiscalMarkup() {
    const year = fiscalYear();
    const profile = ensureState().fiscalProfiles.find(item => item.fiscalYear === year);
    return `<div class="np-fiscal-status" data-state="${escape(profile?.status || 'missing')}">
      <div><span>Current Nepal fiscal year</span><strong>${escape(year || 'Conversion unavailable')}</strong>
      <p>Tax slabs and deductions are not copied or silently hardcoded. They require an enacted-source note and explicit confirmation.</p></div>
      <dl><div><dt>Profile</dt><dd>${escape(profile?.status || 'Missing')}</dd></div>
      <div><dt>Tax slabs</dt><dd>${profile?.taxSlabsConfirmed ? 'Confirmed' : 'Not confirmed'}</dd></div>
      <div><dt>Deductions</dt><dd>${profile?.deductionRulesConfirmed ? 'Confirmed' : 'Not confirmed'}</dd></div></dl>
      ${canManage() ? '<button class="button button-secondary" type="button" data-np-edit-fiscal>Configure fiscal profile</button>' : ''}
    </div>`;
  }

  function registerMarkup() {
    const data = monthRegister();
    if (!data.rows.length) return empty('No active employees', 'Add employees before generating Hajiri.');
    return `<div class="np-hajiri-scroll"><table class="np-hajiri-table"><thead><tr><th>Employee</th>
      ${data.days.map(date => `<th title="${escape(date)} / ${escape(bsLabel(date))}">${escape(bsParts(date)?.day || date.slice(-2))}<small>${escape(date.slice(8))}</small></th>`).join('')}
      <th>Present</th><th>Absent</th><th>Leave</th></tr></thead><tbody>
      ${data.rows.map(row => `<tr><th><strong>${escape(row.employee.name)}</strong><small>${escape(row.employee.employeeCode || '')}</small></th>
      ${row.cells.map(cell => `<td data-code="${escape(cell.code)}" title="${escape(cell.label)}">${escape(cell.display)}</td>`).join('')}
      <td>${row.present}</td><td>${row.absent}</td><td>${row.leave}</td></tr>`).join('')}</tbody></table></div>
      <p class="np-register-note">${escape(data.range.label)}: status priority is weekly off, holiday, present, approved leave, then absent.</p>`;
  }

  function policyMarkup() {
    const rules = `<div class="np-policy-grid">${LEGAL_RULES.map(rule => `
      <article><span>statutory</span><strong>${escape(rule[0])}</strong><p>${escape(rule[1])}</p><small>${escape(rule[2])}</small></article>`).join('')}</div>`;
    const leave = `<div class="np-leave-reference">${LEAVE_REFERENCE.map(item => `
      <article data-kind="${escape(item[0])}"><span>${escape(item[0])}</span><strong>${escape(item[1])}</strong><p>${escape(item[2])}</p>
      <dl><div><dt>Pay</dt><dd>${escape(item[3])}</dd></div><div><dt>Carry</dt><dd>${escape(item[4])}</dd></div></dl><small>${escape(item[5])}</small></article>`).join('')}</div>`;
    return `<section class="np-compliance-grid">
      <article class="np-panel np-panel-wide"><header><div><span>Statutory guardrails</span><h2>Working time and overtime</h2></div>${canManage() ? '<button class="button button-secondary button-small" type="button" data-np-edit-policy>Edit policy</button>' : ''}</header>${rules}</article>
      <article class="np-panel np-panel-wide"><header><div><span>Leave reference</span><h2>Statutory entitlement vs organization policy</h2><p>The reference project was not copied blindly. Home-leave accrual and maternity-pay treatment follow the Labour Act model.</p></div></header>${leave}</article>
    </section>`;
  }

  function evidenceMarkup() {
    const data = ensureState();
    const events = data.audit.length ? data.audit.slice(0, 100).map(item => `
      <article><time>${escape(new Date(item.at).toLocaleString('en-NP', { timeZone: TIME_ZONE }))}</time>
      <div><strong>${escape(item.action)}</strong><p>${escape(item.detail)}</p></div><span>${escape(item.actor)}</span></article>`).join('') : empty('No audit events', 'Policy, holiday and attendance actions appear here.');
    return `<section class="np-compliance-grid">
      <article class="np-panel np-panel-wide"><header><div><span>Audit evidence</span><h2>Who changed what and when</h2></div></header><div class="np-audit-list">${events}</div></article>
      <article class="np-panel np-panel-wide"><header><div><span>Clean-room adaptation</span><h2>Reference repository boundary</h2></div></header>
      <p class="np-copy np-evidence-note">Clean-room adaptation: the ZIP and public ZKTeco project informed NPT normalization, BS dates, deduplication, holiday-aware status, Hajiri reporting, Kaaj classification and audit evidence. This implementation does not copy that project's source code and does not treat it as a legal authority.</p></article>
    </section>`;
  }

  function renderCompliancePage() {
    const data = ensureState();
    const audit = complianceAudit();
    const openComp = data.compensatoryLeave.filter(item => item.status !== 'granted').length;
    const tabs = [['overview', 'Overview'], ['register', 'Hajiri register'], ['policies', 'Policy reference'], ['evidence', 'Evidence log']];
    let content = evidenceMarkup();
    if (data.activeView === 'register') content = `<section class="np-panel"><header><div><span>Nepali Hajiri view</span><h2>Current BS month attendance register</h2></div><div class="np-module-links"><button type="button" data-np-open-app="attendance">Attendance</button><button type="button" data-np-open-app="timeoff">Time off</button></div></header>${registerMarkup()}</section>`;
    if (data.activeView === 'policies') content = policyMarkup();
    if (data.activeView === 'overview') content = `<section class="np-compliance-grid">
      <article class="np-panel np-panel-wide"><header><div><span>Exceptions</span><h2>What needs attention</h2></div><button class="button button-secondary button-small" type="button" data-np-refresh>Re-evaluate</button></header>${issuesMarkup(audit)}</article>
      <article class="np-panel"><header><div><span>Calendar</span><h2>Holidays</h2></div>${canManage() ? '<button class="button button-secondary button-small" type="button" data-np-add-holiday>Add</button>' : ''}</header>${holidayMarkup()}</article>
      <article class="np-panel"><header><div><span>Substitute leave</span><h2>21-day tracker</h2></div></header>${compMarkup()}</article>
      <article class="np-panel np-panel-wide"><header><div><span>Biometric import</span><h2>Source and deduplication history</h2></div></header>${historyMarkup()}</article>
      <article class="np-panel np-panel-wide"><header><div><span>Payroll boundary</span><h2>Fiscal safeguards</h2></div></header>${fiscalMarkup()}</article>
    </section>`;
    return `<div class="content-shell page-stack np-compliance" data-np-compliance-page>
      <section class="np-compliance-hero"><div><p class="panel-kicker">Nepal operational controls</p><h1 data-route-heading>Attendance & compliance center</h1><p>Use Nepal-specific attendance, leave, holiday, overtime, fiscal safeguards and evidence without turning Formcraft into a full HRMS.</p></div>
      <div class="np-compliance-actions"><button class="button button-primary" type="button" data-np-import ${canManage() ? '' : 'disabled'}>Import attendance</button><button class="button button-secondary" type="button" data-np-manual ${canManage() ? '' : 'disabled'}>Manual entry</button><button class="button button-secondary" type="button" data-np-export>Export evidence</button></div></section>
      <section class="np-boundary"><strong>Scope boundary</strong><span>Direct ZKTeco polling, fingerprint storage, employee lifecycle management and salary processing are excluded. File import and evidence controls are included. Direct device sync requires a separate connector on the device network.</span></section>
      <section class="np-compliance-metrics">${metric('Readiness', `${audit.readiness}%`, 'Operational controls, not legal certification')}${metric('High-priority issues', audit.high, 'Policy, limits, matching and fiscal safeguards')}${metric('Attendance records', audit.attendanceRecords, `${audit.rawPunches} raw punches retained`)}${metric('Open substitute leave', openComp, 'Weekly-off or holiday work')}</section>
      <nav class="np-compliance-tabs" aria-label="Compliance views">${tabs.map(tab => `<button type="button" data-np-view="${tab[0]}" class="${data.activeView === tab[0] ? 'is-active' : ''}">${tab[1]}</button>`).join('')}</nav>
      ${content}
    </div>`;
  }


  window.FormcraftNepalComplianceViews = Object.freeze({ renderCompliancePage });
})();
