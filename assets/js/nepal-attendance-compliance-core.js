'use strict';

(() => {
  const O = window.FormcraftNepalComplianceOperations;
  if (!O) return;
  const {
    VERSION, TIME_ZONE, ERP, POLICY_DEFAULTS, LEGAL_RULES, LEAVE_REFERENCE, HOLIDAY_TYPES,
    list, record, number, round, timestamp, escape, id, canManage,
    ensureState, auditEvent, nptDate, addDays, weekStart, bsParts, fiscalYear,
    currentMonthRange, holidayFor, leaveFor, attendanceStatus, materializePunches,
    importPunchRows, addManualAttendance, addHoliday, removeHoliday
  } = O;

  function savePolicy(input, options = {}) {
    if (!canManage() && options.enforcePermissions !== false) throw new Error('Owner or admin permission is required to change compliance policy.');
    const next = { ...ensureState().policy, ...input, timeZone: TIME_ZONE };
    const checks = [
      [next.standardDayHours > 0 && next.standardDayHours <= 8, 'Normal daily hours must be above 0 and cannot exceed 8.'],
      [next.standardWeekHours > 0 && next.standardWeekHours <= 48, 'Normal weekly hours must be above 0 and cannot exceed 48.'],
      [next.breakAfterHours > 0 && next.breakAfterHours <= 5, 'The break trigger must be above 0 and cannot be later than 5 continuous hours.'],
      [next.minimumBreakMinutes >= 30, 'The minimum rest interval cannot be below 30 minutes.'],
      [next.overtimeMaxPerDay >= 0 && next.overtimeMaxPerDay <= 4, 'Daily overtime ceiling must be between 0 and 4 hours.'],
      [next.overtimeMaxPerWeek >= 0 && next.overtimeMaxPerWeek <= 24, 'Weekly overtime ceiling must be between 0 and 24 hours.'],
      [next.overtimeMultiplier >= 1.5, 'Overtime multiplier cannot be below 1.5x.'],
      [Number.isInteger(Number(next.weeklyOffDay)) && next.weeklyOffDay >= 0 && next.weeklyOffDay <= 6, 'Weekly off day must be a valid weekday.'],
      [next.weeklyOffDaysRequired >= 1, 'At least one weekly off day is required.'],
      [next.compensatoryLeaveDeadlineDays > 0 && next.compensatoryLeaveDeadlineDays <= 21, 'Substitute leave deadline must be between 1 and 21 days.'],
      [next.duplicateWindowSeconds >= 1 && next.duplicateWindowSeconds <= 600, 'Duplicate-punch window must be between 1 and 600 seconds.']
    ];
    const failed = checks.find(check => !check[0]);
    if (failed) throw new Error(failed[1]);
    if (input.confirmed) {
      if (!String(next.sourceNote || '').trim()) throw new Error('A source and review note is required before confirming policy.');
      next.confirmedAt = timestamp();
      next.confirmedBy = window.FormcraftBackend?.user?.email || window.FormcraftBackend?.role || 'workspace admin';
    } else {
      next.confirmedAt = '';
      next.confirmedBy = '';
    }
    delete next.confirmed;
    ensureState().policy = next;
    auditEvent('Compliance policy updated', next.confirmedAt ? 'Statutory guardrails reviewed and confirmed.' : 'Policy changed without confirmation.');
    return next;
  }

  function saveFiscalProfile(input, options = {}) {
    if (!canManage() && options.enforcePermissions !== false) throw new Error('Owner or admin permission is required to manage fiscal profiles.');
    const data = ensureState();
    const year = String(input.fiscalYear || fiscalYear()).trim();
    if (!/^\d{4}\/\d{2}$/.test(year)) throw new Error('Fiscal year must use YYYY/YY format.');
    if (input.confirmed && (!input.taxSlabsConfirmed || !input.deductionRulesConfirmed || !String(input.sourceNote || '').trim())) {
      throw new Error('Confirm both controls and enter the enacted-source note before confirming the profile.');
    }
    const existing = data.fiscalProfiles.find(item => item.fiscalYear === year);
    const profile = {
      id: existing?.id || id('np-fiscal'),
      fiscalYear: year,
      status: input.confirmed ? 'confirmed' : 'draft',
      taxSlabsConfirmed: Boolean(input.taxSlabsConfirmed),
      deductionRulesConfirmed: Boolean(input.deductionRulesConfirmed),
      sourceNote: String(input.sourceNote || '').trim(),
      confirmedAt: input.confirmed ? timestamp() : '',
      confirmedBy: input.confirmed ? (window.FormcraftBackend?.user?.email || window.FormcraftBackend?.role || 'workspace admin') : '',
      createdAt: existing?.createdAt || timestamp(),
      updatedAt: timestamp()
    };
    if (existing) Object.assign(existing, profile); else data.fiscalProfiles.unshift(profile);
    auditEvent('Fiscal compliance profile updated', `${year}: ${profile.status}.`, { fiscalProfileId: profile.id });
    return profile;
  }

  function grantCompensatoryLeave(obligationId, date = nptDate(), options = {}) {
    if (!canManage() && options.enforcePermissions !== false) throw new Error('Owner or admin permission is required.');
    const item = ensureState().compensatoryLeave.find(entry => entry.id === obligationId);
    if (!item) throw new Error('Compensatory leave item was not found.');
    item.grantedDate = date;
    item.status = 'granted';
    item.updatedAt = timestamp();
    auditEvent('Compensatory leave granted', `${item.employeeName || item.employeeCode || 'Employee'} for work on ${item.workedDate}.`, { compensatoryLeaveId: obligationId });
    return item;
  }

  function complianceAudit() {
    const data = ensureState();
    const issues = [];
    const attendance = ERP.collection('attendance').filter(item => item.complianceManaged);
    if (!data.policy.confirmedAt) issues.push({ severity: 'high', code: 'POLICY_UNCONFIRMED', title: 'Statutory policy is not confirmed', detail: 'An owner or admin must review and confirm the active guardrails.' });
    if (!data.holidays.length) issues.push({ severity: 'medium', code: 'HOLIDAY_CALENDAR_EMPTY', title: 'Holiday calendar is empty', detail: 'Enter applicable holidays before absence and substitute-leave reports are relied on.' });
    const year = fiscalYear();
    const fiscal = data.fiscalProfiles.find(item => item.fiscalYear === year && item.status === 'confirmed');
    if (!fiscal || !fiscal.taxSlabsConfirmed || !fiscal.deductionRulesConfirmed) issues.push({ severity: 'high', code: 'FISCAL_PROFILE_UNCONFIRMED', title: `Fiscal profile ${year || 'current'} is not fully confirmed`, detail: 'Tax slabs and deduction rules must be checked against enacted sources.' });
    attendance.forEach(item => {
      const evidence = record(item.complianceData);
      if (!item.employeeId) issues.push({ severity: 'high', code: 'UNMATCHED_EMPLOYEE', title: 'Attendance has no matched employee', detail: item.reference, recordId: item.id });
      if (evidence.overtimeMinutes > data.policy.overtimeMaxPerDay * 60) issues.push({ severity: 'high', code: 'DAILY_OT_LIMIT', title: 'Daily overtime ceiling exceeded', detail: item.reference, recordId: item.id });
      if (evidence.workMinutes > data.policy.breakAfterHours * 60 && (evidence.breakMinutes === null || evidence.breakMinutes < data.policy.minimumBreakMinutes)) issues.push({ severity: 'medium', code: 'BREAK_EVIDENCE', title: 'Rest-break evidence missing or insufficient', detail: item.reference, recordId: item.id });
      if (item.complianceSource === 'manual' && (!evidence.manualReason || !evidence.approver)) issues.push({ severity: 'high', code: 'MANUAL_CONTROL_MISSING', title: 'Manual attendance lacks reason or approver', detail: item.reference, recordId: item.id });
    });
    const weeks = new Map();
    attendance.forEach(item => {
      const key = `${item.employeeId || item.employeeCode || 'unmatched'}|${weekStart(item.date)}`;
      const week = weeks.get(key) || { regular: 0, overtime: 0 };
      const evidence = record(item.complianceData);
      week.regular += evidence.weeklyOff || evidence.holidayId ? 0 : Math.min(number(evidence.workMinutes), data.policy.standardDayHours * 60);
      week.overtime += number(evidence.overtimeMinutes);
      weeks.set(key, week);
    });
    weeks.forEach((week, key) => {
      if (week.regular > data.policy.standardWeekHours * 60) issues.push({ severity: 'high', code: 'WEEKLY_HOURS_LIMIT', title: 'Weekly normal hours exceed configured limit', detail: `${key}: ${round(week.regular / 60)} hours.` });
      if (week.overtime > data.policy.overtimeMaxPerWeek * 60) issues.push({ severity: 'high', code: 'WEEKLY_OT_LIMIT', title: 'Weekly overtime ceiling exceeded', detail: `${key}: ${round(week.overtime / 60)} hours.` });
    });
    data.compensatoryLeave.forEach(item => {
      if (item.status !== 'granted' && item.dueDate < nptDate()) issues.push({ severity: 'high', code: 'COMP_LEAVE_OVERDUE', title: 'Substitute leave deadline passed', detail: `${item.employeeName || item.employeeCode || 'Employee'}: worked ${item.workedDate}, due ${item.dueDate}. Review overtime treatment because substitute leave was not granted in time.`, recordId: item.sourceAttendanceId });
    });
    const duplicateCount = data.imports.reduce((total, item) => total + number(item.duplicateRows), 0);
    if (duplicateCount) issues.push({ severity: 'low', code: 'DUPLICATES_FILTERED', title: `${duplicateCount} duplicate punches were filtered`, detail: `Active window: ${data.policy.duplicateWindowSeconds} seconds.` });
    data.lastEvaluationAt = timestamp();
    const high = issues.filter(item => item.severity === 'high').length;
    const medium = issues.filter(item => item.severity === 'medium').length;
    const controls = [data.policy.confirmedAt, data.holidays.length, fiscal?.taxSlabsConfirmed, fiscal?.deductionRulesConfirmed, high === 0, medium === 0];
    return {
      version: VERSION,
      evaluatedAt: data.lastEvaluationAt,
      readiness: Math.round(controls.filter(Boolean).length / controls.length * 100),
      high,
      medium,
      low: issues.filter(item => item.severity === 'low').length,
      issues,
      attendanceRecords: attendance.length,
      rawPunches: data.punches.length,
      fiscalYear: year
    };
  }

  function monthRegister() {
    const range = currentMonthRange();
    const employees = ERP.collection('employees').filter(employee => employee.status !== 'inactive');
    const attendance = ERP.collection('attendance').filter(item => item.date >= range.start && item.date <= range.end);
    const days = [];
    for (let date = range.start; date && date <= range.end; date = addDays(date, 1)) days.push(date);
    const rows = employees.map(employee => {
      const cells = days.map(date => attendanceStatus(employee.id, date, attendance.find(item => item.employeeId === employee.id && item.date === date)));
      const count = code => cells.filter(cell => cell.code === code).length;
      return {
        employee,
        cells,
        present: count('P'),
        absent: count('A'),
        leave: cells.filter(cell => !['P', 'A', 'SAT', 'PH', 'FH', 'NH', 'OH', 'H'].includes(cell.code)).length
      };
    });
    return { range, days, rows };
  }



  window.FormcraftNepalComplianceCore = Object.freeze({
    ...O,
    savePolicy, saveFiscalProfile, grantCompensatoryLeave, complianceAudit, monthRegister
  });
})();
