'use strict';

(() => {
  const F = window.FormcraftNepalComplianceFoundation;
  if (!F) return;
  const {
    ERP, POLICY_DEFAULTS, list, record, number, round, timestamp, id, canManage,
    ensureState, auditEvent, nptDate, nptTime, parseTime, addDays, weekday,
    parseImportText, employeeFor, normalizePunch, previewPunchRows
  } = F;

  function holidayFor(date) {
    return ensureState().holidays.find(holiday => holiday.dateAd === date) || null;
  }

  function leaveFor(employeeId, date) {
    return ERP.collection('timeoff').find(item => item.employeeId === employeeId
      && item.status === 'approved'
      && item.startDate <= date
      && item.endDate >= date) || null;
  }

  function attendanceStatus(employeeId, date, attendance = null) {
    const policy = ensureState().policy;
    const holiday = holidayFor(date);
    if (weekday(date) === Number(policy.weeklyOffDay)) return { code: 'SAT', display: 'शनि', label: 'Weekly off' };
    if (holiday) {
      const type = HOLIDAY_TYPES.find(item => item[0] === holiday.type) || HOLIDAY_TYPES[4];
      return { code: type[2], display: type[3], label: holiday.name };
    }
    if (attendance) return { code: 'P', display: '√', label: 'Present' };
    const leave = leaveFor(employeeId, date);
    if (leave) {
      const symbols = { annual: 'घ', sick: 'बि', maternity: 'म', paternity: 'पि', unpaid: 'अ', other: 'बि' };
      return { code: String(leave.leaveType || 'leave').toUpperCase(), display: symbols[leave.leaveType] || 'बि', label: leave.leaveType || 'Leave' };
    }
    return { code: 'A', display: 'X', label: 'Absent' };
  }

  function materializePunches(punches, batchId, source) {
    const data = ensureState();
    const grouped = new Map();
    punches.forEach(punch => {
      const date = nptDate(punch.timestamp);
      const employeeKey = punch.employeeId || punch.employeeCode || punch.employeeName || 'unmatched';
      const key = `${employeeKey}|${date}`;
      const group = grouped.get(key) || { date, employeeId: punch.employeeId, employeeCode: punch.employeeCode, employeeName: punch.employeeName, punches: [] };
      group.punches.push(punch);
      grouped.set(key, group);
    });

    const attendance = ERP.collection('attendance');
    const output = [];
    grouped.forEach(group => {
      group.punches.sort((left, right) => left.timestamp - right.timestamp);
      const first = group.punches[0];
      const last = group.punches.at(-1);
      const workMinutes = group.punches.length > 1 ? Math.max(0, Math.round((last.timestamp - first.timestamp) / 60000)) : 0;
      const breakMinutes = group.punches.length >= 4 ? Math.max(0, Math.round((group.punches[2].timestamp - group.punches[1].timestamp) / 60000)) : null;
      const holiday = holidayFor(group.date);
      const weeklyOff = weekday(group.date) === Number(data.policy.weeklyOffDay);
      const specialDayWorkMinutes = weeklyOff || holiday ? workMinutes : 0;
      const overtimeMinutes = weeklyOff || holiday ? 0 : Math.max(0, workMinutes - data.policy.standardDayHours * 60);
      const issues = [];
      if (overtimeMinutes > data.policy.overtimeMaxPerDay * 60) issues.push('Overtime exceeds the configured daily statutory ceiling.');
      if (workMinutes > data.policy.breakAfterHours * 60 && (breakMinutes === null || breakMinutes < data.policy.minimumBreakMinutes)) issues.push('Rest-break evidence is missing or insufficient.');
      if (!group.employeeId) issues.push('Employee could not be matched to the employee directory.');
      const recordId = `np-att-${String(group.employeeId || group.employeeCode || group.employeeName).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${group.date}`;
      const existing = attendance.find(item => item.id === recordId)
        || attendance.find(item => group.employeeId && item.complianceManaged && item.employeeId === group.employeeId && item.date === group.date);
      const item = {
        id: existing?.id || recordId,
        reference: existing?.reference || `ATT-${group.date}-${String(group.employeeCode || group.employeeId || 'UNMATCHED').toUpperCase()}`,
        employeeId: group.employeeId,
        employeeCode: group.employeeCode,
        employeeName: group.employeeName,
        date: group.date,
        checkIn: nptTime(first.timestamp),
        checkOut: group.punches.length > 1 ? nptTime(last.timestamp) : '',
        hours: round(workMinutes / 60),
        overtime: round(overtimeMinutes / 60),
        status: issues.length ? 'exception' : 'completed',
        branchId: existing?.branchId || '',
        notes: `${source === 'manual' ? 'Manual attendance' : 'Imported attendance'}; source batch ${batchId}.${issues.length ? ` ${issues.join(' ')}` : ''}`,
        complianceManaged: true,
        complianceSource: source,
        complianceBatchId: batchId,
        complianceData: {
          punchCount: group.punches.length,
          devices: [...new Set(group.punches.map(punch => punch.device).filter(Boolean))],
          workMinutes,
          overtimeMinutes,
          specialDayWorkMinutes,
          breakMinutes,
          weeklyOff,
          holidayId: holiday?.id || '',
          holidayName: holiday?.name || '',
          issues,
          evaluatedAt: timestamp()
        },
        createdAt: existing?.createdAt || timestamp(),
        updatedAt: timestamp()
      };
      if (existing) Object.assign(existing, item); else attendance.unshift(item);
      output.push(item);
      if ((weeklyOff || holiday) && workMinutes > 0) {
        const obligationId = `np-comp-${item.id}`;
        const current = data.compensatoryLeave.find(entry => entry.id === obligationId);
        const obligation = {
          id: obligationId,
          employeeId: group.employeeId,
          employeeCode: group.employeeCode,
          employeeName: group.employeeName,
          sourceAttendanceId: item.id,
          workedDate: group.date,
          dueDate: addDays(group.date, data.policy.compensatoryLeaveDeadlineDays),
          grantedDate: current?.grantedDate || '',
          status: current?.grantedDate ? 'granted' : 'open',
          reason: weeklyOff ? 'Worked on configured weekly off' : `Worked on holiday: ${holiday.name}`,
          createdAt: current?.createdAt || timestamp(),
          updatedAt: timestamp()
        };
        if (current) Object.assign(current, obligation); else data.compensatoryLeave.unshift(obligation);
      }
    });
    return output;
  }

  function importPunchRows(rows, options = {}) {
    if (!canManage() && options.enforcePermissions !== false) throw new Error('Owner or admin permission is required to import attendance.');
    const data = ensureState();
    const preview = previewPunchRows(rows, options);
    const batchId = options.batchId || id('np-import');
    const accepted = preview.accepted.map(punch => ({
      id: id('np-punch'),
      employeeId: punch.employeeId,
      employeeCode: punch.employeeCode,
      employeeName: punch.employeeName,
      timestamp: punch.timestamp.toISOString(),
      device: punch.device,
      punchType: punch.punchType,
      source: options.source || 'file-import',
      batchId,
      importedAt: timestamp(),
      rawRowNumber: punch.rowNumber
    }));
    data.punches.push(...accepted);
    const materialized = materializePunches(accepted.map(punch => ({ ...punch, timestamp: new Date(punch.timestamp) })), batchId, options.source || 'import');
    const summary = {
      id: batchId,
      fileName: options.fileName || 'Attendance import',
      importedAt: timestamp(),
      totalRows: preview.total,
      acceptedRows: accepted.length,
      duplicateRows: preview.duplicates.length,
      errorRows: preview.errors.length,
      attendanceRecords: materialized.length,
      duplicateWindowSeconds: preview.windowSeconds,
      source: options.source || 'file-import'
    };
    data.imports.unshift(summary);
    auditEvent('Attendance imported', `${summary.acceptedRows} punches accepted, ${summary.duplicateRows} duplicates ignored and ${summary.errorRows} rows rejected.`, { batchId });
    return { ...summary, preview, records: materialized };
  }

  function addManualAttendance(input, options = {}) {
    if (!canManage() && options.enforcePermissions !== false) throw new Error('Owner or admin permission is required to add manual attendance.');
    const employee = ERP.collection('employees').find(item => item.id === input.employeeId);
    if (!employee) throw new Error('Select an employee.');
    if (!input.date || !input.checkIn || !input.checkOut) throw new Error('Date, check-in and check-out are required.');
    if (!String(input.reason || '').trim()) throw new Error('A manual-entry reason is required.');
    if (!String(input.approver || '').trim()) throw new Error('An approver is required for manual attendance.');
    const start = parseTime(`${input.date}T${input.checkIn}`);
    const end = parseTime(`${input.date}T${input.checkOut}`);
    if (!start || !end || end <= start) throw new Error('Check-out must be later than check-in.');
    const batchId = id('np-manual');
    const punches = [start, end].map((date, index) => ({
      id: id('np-punch'),
      employeeId: employee.id,
      employeeCode: employee.employeeCode || '',
      employeeName: employee.name,
      timestamp: date,
      device: 'Manual entry',
      punchType: index ? 'check-out' : 'check-in',
      source: 'manual',
      batchId,
      importedAt: timestamp()
    }));
    const data = ensureState();
    data.punches.push(...punches.map(punch => ({ ...punch, timestamp: punch.timestamp.toISOString() })));
    const output = materializePunches(punches, batchId, 'manual');
    output.forEach(item => {
      item.complianceData.manualReason = String(input.reason).trim();
      item.complianceData.approver = String(input.approver).trim();
      item.notes += ` Reason: ${String(input.reason).trim()} Approver: ${String(input.approver).trim()}.`;
    });
    data.imports.unshift({ id: batchId, fileName: 'Manual attendance', importedAt: timestamp(), totalRows: 2, acceptedRows: 2, duplicateRows: 0, errorRows: 0, attendanceRecords: output.length, source: 'manual' });
    auditEvent('Manual attendance added', `${employee.name} on ${input.date}. Reason and approver recorded.`, { batchId, employeeId: employee.id });
    return output[0];
  }

  function addHoliday(input, options = {}) {
    if (!canManage() && options.enforcePermissions !== false) throw new Error('Owner or admin permission is required to manage holidays.');
    if (!String(input.name || '').trim() || !input.dateAd) throw new Error('Holiday name and AD date are required.');
    const data = ensureState();
    const existing = data.holidays.find(item => item.dateAd === input.dateAd);
    const holiday = {
      id: existing?.id || id('np-holiday'),
      name: String(input.name).trim(),
      dateAd: input.dateAd,
      dateBs: input.dateBs || bsLabel(input.dateAd),
      type: HOLIDAY_TYPES.some(item => item[0] === input.type) ? input.type : 'public',
      paid: input.paid !== false,
      source: String(input.source || 'Workspace holiday calendar').trim(),
      createdAt: existing?.createdAt || timestamp(),
      updatedAt: timestamp()
    };
    if (existing) Object.assign(existing, holiday); else data.holidays.push(holiday);
    data.holidays.sort((left, right) => left.dateAd.localeCompare(right.dateAd));
    auditEvent(existing ? 'Holiday updated' : 'Holiday added', `${holiday.name} on ${holiday.dateAd}.`, { holidayId: holiday.id });
    return holiday;
  }

  function removeHoliday(holidayId, options = {}) {
    if (!canManage() && options.enforcePermissions !== false) throw new Error('Owner or admin permission is required to manage holidays.');
    const data = ensureState();
    const holiday = data.holidays.find(item => item.id === holidayId);
    data.holidays = data.holidays.filter(item => item.id !== holidayId);
    if (holiday) auditEvent('Holiday removed', `${holiday.name} on ${holiday.dateAd}.`, { holidayId });
    return Boolean(holiday);
  }


  window.FormcraftNepalComplianceOperations = Object.freeze({
    ...F,
    holidayFor, leaveFor, attendanceStatus, materializePunches, importPunchRows,
    addManualAttendance, addHoliday, removeHoliday
  });
})();
