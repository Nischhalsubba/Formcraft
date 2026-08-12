'use strict';

(() => {
  const ERP = window.FormcraftERP;
  const Compliance = window.FormcraftNepalComplianceCore;
  if (!ERP) return;

  const VERSION = 'FORMCRAFT-HRMS-1.0.0';
  const TIME_ZONE = 'Asia/Kathmandu';
  const arr = value => Array.isArray(value) ? value : [];
  const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = (value, precision = 2) => {
    const factor = 10 ** precision;
    return Math.round((num(value) + Number.EPSILON) * factor) / factor;
  };
  const stamp = () => new Date().toISOString();
  const makeId = prefix => typeof uid === 'function'
    ? `${prefix}-${uid()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const clone = value => value === undefined ? undefined : structuredClone(value);
  const canEdit = () => ['owner', 'admin', 'editor'].includes(window.FormcraftBackend?.role || 'viewer');
  const canManage = () => ['owner', 'admin'].includes(window.FormcraftBackend?.role || 'viewer');
  const currentActor = () => window.FormcraftBackend?.session?.user?.email
    || window.FormcraftBackend?.session?.user?.user_metadata?.full_name
    || window.FormcraftBackend?.role
    || 'workspace user';

  const SYSTEM_LEAVE_OPTIONS = Object.freeze([
    ['annual', 'Annual leave'],
    ['home', 'Home leave'],
    ['sick', 'Sick leave'],
    ['casual', 'Casual leave'],
    ['maternity', 'Maternity leave'],
    ['paternity', 'Paternity / maternity care leave'],
    ['mourning', 'Mourning leave'],
    ['study', 'Study leave'],
    ['unpaid', 'Unpaid leave'],
    ['other', 'Other leave']
  ]);

  const TABLES = Object.freeze([
    'directorates', 'departments', 'sections', 'units', 'shifts', 'shiftRules',
    'deviceProfiles', 'employeeDeviceLinks', 'leaveTypes', 'leaveBalances', 'kaajRecords',
    'dayRemarks', 'holidayTypes', 'autoAttendRules', 'fiscalYears', 'taxSlabSets', 'salaryHeads', 'employeeHeads',
    'deductionTypes', 'employeeDeductions', 'salaryStructures', 'holidayOtRules',
    'payrollItems', 'payrollAttendanceSnapshots', 'payrollItemHeads', 'payrollItemDeductions',
    'audit'
  ]);

  function ensureState() {
    ERP.ensureERPState();
    state.erp.hrms = obj(state.erp.hrms);
    const data = state.erp.hrms;
    data.version = VERSION;
    TABLES.forEach(key => { data[key] = arr(data[key]); });
    data.bridge = {
      bridgeId: '',
      bridgeName: '',
      scheduleTimes: [],
      lastSyncCursor: '',
      lastSyncAt: '',
      lastBridgeError: '',
      ...obj(data.bridge)
    };
    data.preferences = {
      employeeTab: 'records',
      attendanceTab: 'records',
      timeoffTab: 'records',
      payrollTab: 'records',
      reportDate: '',
      bsYear: '',
      bsMonth: '',
      ...obj(data.preferences)
    };
    return data;
  }

  function audit(tableName, recordId, action, before, after, detail = '') {
    const data = ensureState();
    const entry = {
      id: makeId('hr-audit'),
      tableName,
      recordId: String(recordId || ''),
      action,
      detail,
      changedBy: currentActor(),
      changedAt: stamp(),
      oldData: clone(before ?? null),
      newData: clone(after ?? null)
    };
    data.audit.unshift(entry);
    data.audit = data.audit.slice(0, 1500);
    if (typeof logActivity === 'function') {
      logActivity('hrms', `HRMS: ${action}`, detail || `${tableName} ${recordId || ''}`.trim());
    }
    return entry;
  }

  async function persist(options = {}) {
    if (typeof saveState === 'function') await Promise.resolve(saveState());
    if (options.flush !== false) await window.FormcraftBackend?.flush?.();
  }

  function assertEdit() {
    if (!canEdit()) throw new Error('Editor, admin or owner access is required.');
  }

  function assertManage() {
    if (!canManage()) throw new Error('Owner or admin access is required.');
  }

  function upsert(tableName, input, options = {}) {
    options.manageOnly ? assertManage() : assertEdit();
    const data = ensureState();
    if (!TABLES.includes(tableName) || tableName === 'audit') throw new Error('Unknown HRMS table.');
    const rows = data[tableName];
    const existing = input.id ? rows.find(item => item.id === input.id) : null;
    const before = clone(existing || null);
    const next = {
      id: existing?.id || input.id || makeId(`hr-${tableName.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`),
      createdAt: existing?.createdAt || stamp(),
      createdBy: existing?.createdBy || currentActor(),
      ...existing,
      ...clone(input),
      updatedAt: stamp(),
      updatedBy: currentActor()
    };
    if (existing) Object.assign(existing, next); else rows.unshift(next);
    audit(tableName, next.id, existing ? 'UPDATE' : 'INSERT', before, next, options.detail || '');
    return next;
  }

  function remove(tableName, id, options = {}) {
    options.manageOnly ? assertManage() : assertEdit();
    const data = ensureState();
    const rows = data[tableName];
    if (!Array.isArray(rows)) throw new Error('Unknown HRMS table.');
    const index = rows.findIndex(item => item.id === id);
    if (index < 0) return false;
    const [removed] = rows.splice(index, 1);
    audit(tableName, id, 'DELETE', removed, null, options.detail || '');
    return true;
  }

  function relationName(tableName, id, fallback = '') {
    if (!id) return fallback;
    return ensureState()[tableName]?.find(item => item.id === id)?.name || fallback || id;
  }

  function organizationPath(employee) {
    const org = obj(employee?.hrmsOrg);
    const names = [
      relationName('directorates', org.directorateId),
      relationName('departments', org.departmentId, employee?.department || ''),
      relationName('sections', org.sectionId),
      relationName('units', org.unitId)
    ].filter(Boolean);
    return names.join(' / ') || employee?.department || 'Unassigned';
  }

  function assignOrganization(employeeId, assignment) {
    assertEdit();
    const employee = ERP.collection('employees').find(item => item.id === employeeId);
    if (!employee) throw new Error('Employee not found.');
    const before = clone(employee.hrmsOrg || null);
    employee.hrmsOrg = { ...obj(employee.hrmsOrg), ...assignment };
    const departmentName = relationName('departments', employee.hrmsOrg.departmentId);
    if (departmentName) employee.department = departmentName;
    employee.updatedAt = stamp();
    ERP.recordAudit?.(ERP.modulesByKey.get('employees'), employee, 'Organization assignment updated', organizationPath(employee));
    audit('employees', employee.id, 'UPDATE_ORG', before, employee.hrmsOrg, organizationPath(employee));
    return employee;
  }

  function assignShift(employeeId, shiftId) {
    assertEdit();
    const employee = ERP.collection('employees').find(item => item.id === employeeId);
    if (!employee) throw new Error('Employee not found.');
    const before = employee.hrmsShiftId || '';
    employee.hrmsShiftId = shiftId || '';
    employee.updatedAt = stamp();
    audit('employees', employee.id, 'UPDATE_SHIFT', before, shiftId || '', relationName('shifts', shiftId, 'No shift'));
    return employee;
  }

  function extendEmployeeSchema() {
    const module = ERP.modulesByKey?.get('employees');
    if (!module?.fields) return;
    const additions = [
      { name: 'attendanceId', label: 'Attendance / device ID', type: 'text' },
      { name: 'bankNumber', label: 'Bank account number', type: 'text' },
      { name: 'employeeType', label: 'Employee type', type: 'select', options: [['permanent', 'Permanent'], ['contract', 'Contract'], ['temporary', 'Temporary'], ['probationary', 'Probationary'], ['other', 'Other']] },
      { name: 'appointmentDate', label: 'Appointment date', type: 'date' },
      { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
      { name: 'gender', label: 'Gender', type: 'select', options: [['', 'Not specified'], ['female', 'Female'], ['male', 'Male'], ['other', 'Other'], ['prefer-not-to-say', 'Prefer not to say']] },
      { name: 'levelGrade', label: 'Level / grade', type: 'text' },
      { name: 'designation', label: 'Designation', type: 'text' },
      { name: 'profilePicUrl', label: 'Profile image URL', type: 'url' },
      { name: 'hrDocumentRefs', label: 'HR document references', type: 'textarea', span: 2, hint: 'Links or references to records in Formcraft Documents / Files.' }
    ];
    const existing = new Set(module.fields.map(item => item.name));
    additions.filter(item => !existing.has(item.name)).forEach(item => module.fields.push(item));
  }

  function extendTimeOffSchema() {
    const module = ERP.modulesByKey?.get('timeoff');
    if (!module?.fields) return;
    const additions = [
      { name: 'isHalfDay', label: 'Half-day leave', type: 'boolean' },
      { name: 'halfDayPart', label: 'Half-day part', type: 'select', options: [['', 'Not applicable'], ['first-half', 'First half'], ['second-half', 'Second half']] }
    ];
    const existing = new Set(module.fields.map(item => item.name));
    additions.filter(item => !existing.has(item.name)).forEach(item => module.fields.push(item));
  }

  function refreshTimeOffOptions() {
    const module = ERP.modulesByKey?.get('timeoff');
    const field = module?.fields?.find(item => item.name === 'leaveType');
    if (!field) return;
    const configured = ensureState().leaveTypes
      .filter(item => item.active !== false)
      .map(item => [item.code || item.id, item.name]);
    const merged = new Map([...SYSTEM_LEAVE_OPTIONS, ...configured]);
    field.options = [...merged.entries()];
  }

  function leaveTypeFor(code) {
    return ensureState().leaveTypes.find(item => item.code === code || item.id === code) || null;
  }

  function dayRemarkFor(employeeId, date) {
    return ensureState().dayRemarks.find(item => item.employeeId === employeeId && item.adDate === date) || null;
  }

  function balanceFor(employeeId, leaveTypeId, bsYear) {
    return ensureState().leaveBalances.find(item => item.employeeId === employeeId
      && item.leaveTypeId === leaveTypeId
      && String(item.bsYear) === String(bsYear)) || null;
  }

  function leaveDaysTaken(employeeId, leaveTypeId, bsYear) {
    const type = leaveTypeFor(leaveTypeId);
    const code = type?.code || leaveTypeId;
    return ERP.collection('timeoff')
      .filter(item => item.employeeId === employeeId && item.status === 'approved')
      .filter(item => String(item.leaveType) === String(code) || String(item.leaveType) === String(leaveTypeId))
      .filter(item => !bsYear || String(Compliance?.bsParts?.(item.startDate)?.year || '').startsWith(String(bsYear)))
      .reduce((total, item) => total + Math.max(0, num(item.days) || dateDiffInclusive(item.startDate, item.endDate)), 0);
  }

  function resolvedLeaveBalance(employeeId, leaveTypeId, bsYear) {
    const row = balanceFor(employeeId, leaveTypeId, bsYear) || {};
    const opening = num(row.openingBalance);
    const earned = num(row.daysEarned) + num(row.annualAllocated) + num(row.carriedForward);
    const taken = row.daysTaken !== undefined ? num(row.daysTaken) : leaveDaysTaken(employeeId, leaveTypeId, bsYear);
    return { opening, earned, taken, available: round(opening + earned - taken) };
  }

  function dateDiffInclusive(from, to) {
    if (!from || !to) return 0;
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
    return Math.floor((end - start) / 86400000) + 1;
  }

  function addDays(date, days) {
    if (Compliance?.addDays) return Compliance.addDays(date, days);
    const base = new Date(`${date}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + days);
    return base.toISOString().slice(0, 10);
  }

  function daysInRange(start, end) {
    const output = [];
    for (let date = start; date && end && date <= end; date = addDays(date, 1)) output.push(date);
    return output;
  }

  function monthRange(bsYear, bsMonth) {
    if (Compliance?.bsToAd && bsYear && bsMonth) {
      const start = Compliance.bsToAd(Number(bsYear), Number(bsMonth), 1);
      const next = Number(bsMonth) === 12
        ? Compliance.bsToAd(Number(bsYear) + 1, 1, 1)
        : Compliance.bsToAd(Number(bsYear), Number(bsMonth) + 1, 1);
      if (start && next) return { start, end: addDays(next, -1), label: `${bsYear}-${String(bsMonth).padStart(2, '0')} BS` };
    }
    return Compliance?.currentMonthRange?.() || (() => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
      const start = `${today.slice(0, 7)}-01`;
      const next = new Date(`${start}T00:00:00Z`);
      next.setUTCMonth(next.getUTCMonth() + 1);
      return { start, end: addDays(next.toISOString().slice(0, 10), -1), label: today.slice(0, 7) };
    })();
  }

  function leaveForDate(employeeId, date) {
    return ERP.collection('timeoff').find(item => item.employeeId === employeeId
      && item.status === 'approved'
      && item.startDate <= date
      && item.endDate >= date) || null;
  }

  function kaajForDate(employeeId, date) {
    return ensureState().kaajRecords.find(item => item.employeeId === employeeId && item.adDate === date) || null;
  }

  function leaveFraction(leave) {
    if (!leave) return 0;
    return leave.isHalfDay ? 0.5 : 1;
  }

  function attendanceStatus(employee, date, attendanceRecord = null) {
    const kaaj = kaajForDate(employee.id, date);
    if (kaaj) return {
      code: kaaj.isPaid === false ? 'KAAJ_UNPAID' : 'KAAJ_PAID',
      display: kaaj.isPaid === false ? 'काX' : 'का',
      label: kaaj.isPaid === false ? 'Kaaj / field duty (unpaid)' : 'Kaaj / field duty',
      fraction: 1
    };
    if (!attendanceRecord) {
      const halfLeave = leaveForDate(employee.id, date);
      if (halfLeave?.isHalfDay) return {
        code: `${String(halfLeave.leaveType || 'L').toUpperCase()}-HALF`,
        display: '½L',
        label: `Half-day ${halfLeave.leaveType || 'leave'}`,
        fraction: 0.5
      };
    }
    if (Compliance?.attendanceStatus) {
      const base = Compliance.attendanceStatus(employee.id, date, attendanceRecord);
      const holiday = arr(state.erp?.nepalCompliance?.holidays).find(item => item.dateAd === date && item.holidayTypeId);
      const custom = holiday ? ensureState().holidayTypes.find(item => item.id === holiday.holidayTypeId) : null;
      if (custom && ['PH', 'FH', 'NH', 'OH', 'H'].includes(base?.code)) {
        return { ...base, code: custom.typeCode || base.code, display: custom.displayCode || custom.typeCode || base.display, label: custom.name || base.label };
      }
      return base;
    }
    if (attendanceRecord) return { code: 'P', display: 'P', label: 'Present' };
    const leave = leaveForDate(employee.id, date);
    return leave ? {
      code: `${String(leave.leaveType || 'L').toUpperCase()}${leave.isHalfDay ? '-HALF' : ''}`,
      display: leave.isHalfDay ? '½L' : 'L',
      label: leave.isHalfDay ? `Half-day ${leave.leaveType || 'leave'}` : 'Leave',
      fraction: leaveFraction(leave)
    } : { code: 'A', display: 'A', label: 'Absent', fraction: 0 };
  }

  function recordsForRange(start, end) {
    return ERP.collection('attendance').filter(item => item.date >= start && item.date <= end);
  }

  function minutesFromClock(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
  }

  function timingForRecord(employee, date, attendanceRecord) {
    const shift = shiftForEmployee(employee, date);
    if (!shift || !attendanceRecord) return { lateMinutes: 0, earlyMinutes: 0, shift };
    const start = minutesFromClock(shift.startTime);
    let end = minutesFromClock(shift.endTime);
    let checkIn = minutesFromClock(attendanceRecord.checkIn);
    let checkOut = minutesFromClock(attendanceRecord.checkOut);
    if ([start, end, checkIn].some(value => value === null)) return { lateMinutes: 0, earlyMinutes: 0, shift };
    if (end <= start) end += 1440;
    if (checkIn < start - 720) checkIn += 1440;
    if (checkOut !== null && checkOut < start - 720) checkOut += 1440;
    const lateMinutes = Math.max(0, Math.round(checkIn - (start + num(shift.graceLateIn))));
    const earlyMinutes = checkOut === null ? 0 : Math.max(0, Math.round((end - num(shift.graceEarlyOut)) - checkOut));
    return { lateMinutes, earlyMinutes, shift };
  }

  function dailyReport(date) {
    const employees = ERP.collection('employees').filter(item => item.status !== 'inactive' && !item.archived);
    const attendance = ERP.collection('attendance').filter(item => item.date === date);
    return employees.map(employee => {
      const record = attendance.find(item => item.employeeId === employee.id) || null;
      const status = attendanceStatus(employee, date, record);
      const data = obj(record?.complianceData);
      const timing = timingForRecord(employee, date, record);
      return {
        employee,
        record,
        status,
        checkIn: record?.checkIn || '',
        checkOut: record?.checkOut || '',
        hours: num(record?.hours),
        overtime: num(record?.overtime),
        lateMinutes: data.lateInMinutes !== undefined ? num(data.lateInMinutes) : timing.lateMinutes,
        earlyMinutes: data.earlyOutMinutes !== undefined ? num(data.earlyOutMinutes) : timing.earlyMinutes,
        shift: timing.shift,
        organization: organizationPath(employee)
      };
    });
  }

  function monthlyReport(bsYear, bsMonth) {
    const range = monthRange(bsYear, bsMonth);
    const dates = daysInRange(range.start, range.end);
    const records = recordsForRange(range.start, range.end);
    const employees = ERP.collection('employees').filter(item => item.status !== 'inactive' && !item.archived);
    const rows = employees.map(employee => {
      const cells = dates.map(date => {
        const record = records.find(item => item.employeeId === employee.id && item.date === date) || null;
        return { date, record, status: attendanceStatus(employee, date, record) };
      });
      const count = predicate => cells.filter(predicate).length;
      const present = count(cell => cell.status.code === 'P');
      const absent = cells.reduce((total, cell) => total + (cell.status.code === 'A' ? 1 : cell.status.fraction === 0.5 ? 0.5 : 0), 0);
      const weeklyOff = count(cell => cell.status.code === 'SAT');
      const holidayCodes = new Set(['PH', 'FH', 'NH', 'OH', 'H', ...ensureState().holidayTypes.map(item => item.typeCode).filter(Boolean)]);
      const holidays = count(cell => holidayCodes.has(cell.status.code));
      const kaaj = count(cell => ['KAAJ_PAID', 'KAAJ_UNPAID'].includes(cell.status.code));
      const leave = round(cells.reduce((total, cell) => {
        if (['P', 'A', 'SAT', 'KAAJ_PAID', 'KAAJ_UNPAID'].includes(cell.status.code) || holidayCodes.has(cell.status.code)) return total;
        return total + (cell.status.fraction || 1);
      }, 0));
      const overtimeHours = round(cells.reduce((total, cell) => total + num(cell.record?.overtime), 0));
      const workHours = round(cells.reduce((total, cell) => total + num(cell.record?.hours), 0));
      const timingRows = cells.map(cell => {
        const timing = timingForRecord(employee, cell.date, cell.record);
        return {
          lateMinutes: cell.record?.complianceData?.lateInMinutes !== undefined ? num(cell.record.complianceData.lateInMinutes) : timing.lateMinutes,
          earlyMinutes: cell.record?.complianceData?.earlyOutMinutes !== undefined ? num(cell.record.complianceData.earlyOutMinutes) : timing.earlyMinutes
        };
      });
      const lateMinutes = timingRows.reduce((total, item) => total + item.lateMinutes, 0);
      const earlyMinutes = timingRows.reduce((total, item) => total + item.earlyMinutes, 0);
      const lateDays = timingRows.filter(item => item.lateMinutes > 0).length;
      const earlyDays = timingRows.filter(item => item.earlyMinutes > 0).length;
      const plannedDays = Math.max(0, dates.length - weeklyOff - holidays);
      const actualDays = present + leave + kaaj;
      return { employee, cells, present, absent, weeklyOff, holidays, leave, kaaj, overtimeHours, workHours, lateMinutes, earlyMinutes, lateDays, earlyDays, plannedDays, actualDays, organization: organizationPath(employee) };
    });
    return { range, dates, rows };
  }

  function departmentSummary(bsYear, bsMonth) {
    const report = monthlyReport(bsYear, bsMonth);
    const groups = new Map();
    report.rows.forEach(row => {
      const key = row.employee.hrmsOrg?.departmentId || row.employee.department || 'unassigned';
      const current = groups.get(key) || {
        id: key,
        name: relationName('departments', row.employee.hrmsOrg?.departmentId, row.employee.department || 'Unassigned'),
        employees: 0, present: 0, absent: 0, leave: 0, kaaj: 0, overtimeHours: 0
      };
      current.employees += 1;
      current.present += row.present;
      current.absent += row.absent;
      current.leave += row.leave;
      current.kaaj += row.kaaj || 0;
      current.overtimeHours += row.overtimeHours;
      groups.set(key, current);
    });
    return [...groups.values()].map(item => ({ ...item, overtimeHours: round(item.overtimeHours) }));
  }

  function absentReport(bsYear, bsMonth) {
    const report = monthlyReport(bsYear, bsMonth);
    return report.rows.flatMap(row => row.cells
      .filter(cell => cell.status.code === 'A')
      .map(cell => ({ employee: row.employee, date: cell.date, organization: row.organization })));
  }

  function shiftForEmployee(employee, date = '') {
    const data = ensureState();
    const direct = employee.hrmsShiftId && data.shifts.find(item => item.id === employee.hrmsShiftId);
    if (direct) return direct;
    const org = obj(employee.hrmsOrg);
    const candidates = data.shiftRules.filter(rule => {
      if (rule.fromDate && date && date < rule.fromDate) return false;
      if (rule.toDate && date && date > rule.toDate) return false;
      return (rule.employeeId && rule.employeeId === employee.id)
        || (rule.unitId && rule.unitId === org.unitId)
        || (rule.sectionId && rule.sectionId === org.sectionId)
        || (rule.departmentId && rule.departmentId === org.departmentId)
        || (rule.directorateId && rule.directorateId === org.directorateId);
    });
    const rank = rule => rule.employeeId ? 5 : rule.unitId ? 4 : rule.sectionId ? 3 : rule.departmentId ? 2 : 1;
    candidates.sort((a, b) => rank(b) - rank(a));
    return data.shifts.find(item => item.id === candidates[0]?.shiftId) || null;
  }

  function attendanceSnapshot(employee, range) {
    const dates = daysInRange(range.start, range.end);
    const records = recordsForRange(range.start, range.end).filter(item => item.employeeId === employee.id);
    let presentDays = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let absentDays = 0;
    let weeklyOffDays = 0;
    let holidayDays = 0;
    let kaajPaidDays = 0;
    let kaajUnpaidDays = 0;
    let regularOtMinutes = 0;
    let holidayOtMinutes = 0;
    dates.forEach(date => {
      const record = records.find(item => item.date === date) || null;
      const status = attendanceStatus(employee, date, record);
      const holidayCodes = new Set(['PH', 'FH', 'NH', 'OH', 'H', ...ensureState().holidayTypes.map(item => item.typeCode).filter(Boolean)]);
      if (status.code === 'P') presentDays += 1;
      else if (status.code === 'A') absentDays += 1;
      else if (status.code === 'SAT') weeklyOffDays += 1;
      else if (holidayCodes.has(status.code)) holidayDays += 1;
      else if (status.code === 'KAAJ_PAID') kaajPaidDays += 1;
      else if (status.code === 'KAAJ_UNPAID') kaajUnpaidDays += 1;
      else {
        const leave = leaveForDate(employee.id, date);
        const type = leaveTypeFor(leave?.leaveType);
        const fraction = leaveFraction(leave) || 1;
        if (leave?.leaveType === 'unpaid' || type?.isPaid === false) unpaidLeaveDays += fraction;
        else paidLeaveDays += fraction;
        if (fraction < 1 && !record) absentDays += 1 - fraction;
      }
      regularOtMinutes += num(record?.complianceData?.overtimeMinutes) || Math.round(num(record?.overtime) * 60);
      holidayOtMinutes += num(record?.complianceData?.specialDayWorkMinutes);
    });
    const workingDays = Math.max(0, dates.length - weeklyOffDays - holidayDays);
    return {
      workingDays,
      presentDays,
      paidLeaveDays,
      unpaidLeaveDays,
      absentDays,
      weeklyOffDays,
      holidayDays,
      kaajPaidDays,
      kaajUnpaidDays,
      regularOtMinutes,
      holidayOtMinutes,
      payableDays: Math.max(0, presentDays + paidLeaveDays + kaajPaidDays)
    };
  }

  function normalizeBands(bands) {
    return arr(bands)
      .slice()
      .sort((a, b) => num(a.order) - num(b.order))
      .map(item => ({ width: item.width === null || item.width === '' || item.width === undefined ? null : Math.max(0, num(item.width)), rate: Math.max(0, num(item.rate)) }));
  }

  function annualTax(taxableAnnual, bands) {
    let remaining = Math.max(0, num(taxableAnnual));
    let tax = 0;
    normalizeBands(bands).forEach(band => {
      if (remaining <= 0) return;
      const width = band.width === null ? remaining : Math.min(remaining, band.width);
      tax += width * (band.rate / 100);
      remaining -= width;
    });
    return round(tax);
  }

  function slabBreakdown(taxableAnnual, bands) {
    let remaining = Math.max(0, num(taxableAnnual));
    let lower = 0;
    const rows = [];
    normalizeBands(bands).forEach(band => {
      if (remaining <= 0) return;
      const amount = band.width === null ? remaining : Math.min(remaining, band.width);
      rows.push({ from: round(lower), to: round(lower + amount), rate: band.rate, amount: round(amount), tax: round(amount * band.rate / 100) });
      lower += amount;
      remaining -= amount;
    });
    return rows;
  }

  function fiscalPeriodIndex(bsMonth, fiscalStartMonth = 4) {
    return ((Math.max(1, Math.min(12, num(bsMonth))) - Math.max(1, Math.min(12, num(fiscalStartMonth)))) % 12 + 12) % 12 + 1;
  }

  function monthlyTds({ periodIndex, taxableYtdInclCurrent, thisMonthTaxable, taxPaidBeforeCurrent, bands }) {
    const pi = Math.max(1, Math.min(12, num(periodIndex) || 1));
    const ytd = Math.max(0, num(taxableYtdInclCurrent));
    const current = Math.max(0, num(thisMonthTaxable));
    const paid = Math.max(0, num(taxPaidBeforeCurrent));
    const projectedAnnual = ytd + current * (12 - pi);
    const projectedAnnualTax = annualTax(projectedAnnual, bands);
    const taxDueThroughNow = round(projectedAnnualTax * pi / 12);
    return {
      projectedAnnualIncome: round(projectedAnnual),
      projectedAnnualTax,
      taxDueThroughNow,
      taxPaidBefore: round(paid),
      tdsThisMonth: round(Math.max(0, taxDueThroughNow - paid))
    };
  }

  function hourlyRate(basicSalary, workingDays, dailyHours) {
    return round(num(basicSalary) / (Math.max(1, num(workingDays)) * Math.max(0.25, num(dailyHours) || 8)));
  }

  function overtimeAmount(basicSalary, workingDays, dailyHours, otHours, multiplier) {
    return round(hourlyRate(basicSalary, workingDays, dailyHours) * Math.max(0, num(otHours)) * Math.max(0, num(multiplier) || 1.5));
  }

  function computePayslip(input) {
    if (!arr(input.taxBands).length) throw new Error('Confirmed tax slab bands are required before payroll can be generated.');
    const workingDays = Math.max(1, num(input.workingDays) || 1);
    const payableDays = Math.max(0, Math.min(workingDays, num(input.payableDays ?? workingDays)));
    const basic = Math.max(0, num(input.basicSalary));
    const allowances = Math.max(0, num(input.allowances));
    const prorate = payableDays / workingDays;
    const earnedBasic = round(basic * prorate);
    const earnedAllowance = round(allowances * prorate);
    const regularOtPay = overtimeAmount(basic, workingDays, input.dailyHours, input.regularOtHours, input.otMultiplier);
    const holidayOtPay = overtimeAmount(basic, workingDays, input.dailyHours, input.holidayOtHours, input.holidayOtMultiplier ?? input.otMultiplier);
    const otherEarnings = Math.max(0, num(input.otherEarnings));
    const gross = round(earnedBasic + earnedAllowance + regularOtPay + holidayOtPay + otherEarnings);
    const pretaxDeductions = arr(input.pretaxDeductions).map(item => ({ ...item, amount: round(Math.max(0, num(item.amount))) }));
    const pretaxTotal = round(pretaxDeductions.reduce((sum, item) => sum + item.amount, 0));
    const thisMonthTaxable = round(Math.max(0, gross - pretaxTotal));
    const taxableYtdInclCurrent = round(num(input.taxableYtdBefore) + thisMonthTaxable);
    const tax = monthlyTds({
      periodIndex: input.periodIndex,
      taxableYtdInclCurrent,
      thisMonthTaxable,
      taxPaidBeforeCurrent: input.taxPaidBefore,
      bands: input.taxBands
    });
    const otherDeductions = Math.max(0, num(input.otherDeductions));
    const postTaxDeductions = arr(input.postTaxDeductions).map(item => ({ ...item, amount: round(Math.max(0, num(item.amount))) }));
    const postTaxTotal = round(postTaxDeductions.reduce((sum, item) => sum + item.amount, 0));
    const totalDeductions = round(pretaxTotal + tax.tdsThisMonth + otherDeductions + postTaxTotal);
    return {
      workingDays,
      payableDays,
      prorate: round(prorate, 6),
      earnedBasic,
      earnedAllowance,
      regularOtPay,
      holidayOtPay,
      otherEarnings,
      gross,
      pretaxDeductions,
      pretaxTotal,
      thisMonthTaxable,
      taxableYtdInclCurrent,
      tax,
      otherDeductions,
      postTaxDeductions,
      postTaxTotal,
      totalDeductions,
      netPay: round(gross - totalDeductions),
      slabBreakdown: slabBreakdown(tax.projectedAnnualIncome, input.taxBands)
    };
  }

  function salaryStructure(employeeId) {
    return ensureState().salaryStructures.find(item => item.employeeId === employeeId) || {
      employeeId,
      dailyHours: 8,
      otMultiplier: num(ensureState().policy?.overtimeMultiplier) || num(state.erp?.nepalCompliance?.policy?.overtimeMultiplier) || 1.5,
      maritalStatus: 'ALL',
      otherDeductions: 0
    };
  }

  function headsForEmployee(employee, bsMonth) {
    const data = ensureState();
    const assignments = data.employeeHeads.filter(item => item.employeeId === employee.id && item.active !== false);
    if (!assignments.length && num(employee.salary) > 0) {
      return [{ code: 'BASIC', name: 'Basic salary', amount: num(employee.salary), frequency: 'monthly', implicit: true }];
    }
    return assignments.map(item => {
      const head = data.salaryHeads.find(candidate => candidate.id === item.headId) || {};
      const frequency = item.frequencyOverride || head.frequency || 'monthly';
      const due = frequency === 'monthly'
        || ((frequency === 'annual' || frequency === 'festival') && Number(item.payBsMonth || head.payBsMonth) === Number(bsMonth))
        || (frequency === 'onetime' && item.payBsMonth && Number(item.payBsMonth) === Number(bsMonth));
      let amount = num(item.amount);
      if (!amount && head.calcType === 'percent_of_basic') amount = num(employee.salary) * num(head.percentOfBasic) / 100;
      if (!amount) amount = num(head.defaultAmount);
      return { code: head.code || item.code || 'HEAD', name: head.name || item.name || 'Earning', amount: round(amount), frequency, due, headId: head.id || item.headId };
    }).filter(item => item.due !== false);
  }

  function deductionsForEmployee(employee, basicAmount) {
    const data = ensureState();
    return data.employeeDeductions
      .filter(item => item.employeeId === employee.id && item.isEnrolled !== false)
      .map(item => {
        const type = data.deductionTypes.find(candidate => candidate.id === item.deductionTypeId) || {};
        let amount = num(item.amount || type.defaultAmount);
        const percent = item.percentOverride !== undefined && item.percentOverride !== '' ? num(item.percentOverride) : num(type.percentOfBasic);
        if ((item.calcType || type.calcType) === 'percent_of_basic') amount = basicAmount * percent / 100;
        const capAmount = num(item.capAmount || type.capAmount);
        const capPercent = num(item.capPercentOfGross || type.capPercentOfGross);
        if (capAmount > 0) amount = Math.min(amount, capAmount);
        return {
          code: type.code || item.code || 'DED',
          name: type.name || item.name || 'Deduction',
          amount: round(Math.max(0, amount)),
          isPretax: item.isPretax !== undefined ? Boolean(item.isPretax) : Boolean(type.isPretax),
          capPercentOfGross: capPercent,
          deductionTypeId: type.id || item.deductionTypeId
        };
      });
  }

  function activeFiscalYear(id) {
    const data = ensureState();
    return id ? data.fiscalYears.find(item => item.id === id) : data.fiscalYears.find(item => item.status === 'active');
  }

  function taxBandsFor(fiscalYearId, maritalStatus) {
    const data = ensureState();
    const set = data.taxSlabSets.find(item => item.fiscalYearId === fiscalYearId
      && item.confirmed === true
      && [String(maritalStatus || 'ALL'), 'ALL'].includes(String(item.maritalStatus || 'ALL')));
    return { set, bands: arr(set?.bands) };
  }

  function previousPayrollTotals(employeeId, fiscalYearId) {
    return ensureState().payrollItems
      .filter(item => item.employeeId === employeeId && item.fiscalYearId === fiscalYearId)
      .reduce((totals, item) => ({
        taxable: totals.taxable + num(item.thisMonthTaxable),
        tax: totals.tax + num(item.tax)
      }), { taxable: 0, tax: 0 });
  }

  function generatePayroll(input) {
    assertManage();
    const data = ensureState();
    const fiscal = activeFiscalYear(input.fiscalYearId);
    if (!fiscal) throw new Error('Create and activate a fiscal year before generating payroll.');
    if (['closed', 'locked'].includes(fiscal.status)) throw new Error('The selected fiscal year is closed or locked.');
    const range = input.periodStart && input.periodEnd
      ? { start: input.periodStart, end: input.periodEnd, label: input.name || `${input.bsYear}-${input.bsMonth}` }
      : monthRange(input.bsYear, input.bsMonth);
    const employees = ERP.collection('employees').filter(item => item.status === 'active' || item.status === 'probation');
    if (!employees.length) throw new Error('No active employees are available for this payroll run.');
    const runId = input.runId || makeId('payrun');
    const items = [];
    const itemHeads = [];
    const itemDeductions = [];
    const snapshots = [];

    employees.forEach(employee => {
      const structure = salaryStructure(employee.id);
      const headRows = headsForEmployee(employee, input.bsMonth);
      if (!headRows.length) return;
      const basicHead = headRows.find(item => String(item.code).toUpperCase() === 'BASIC') || headRows[0];
      const basic = num(basicHead.amount);
      const allowances = headRows.filter(item => item !== basicHead && item.frequency === 'monthly').reduce((sum, item) => sum + num(item.amount), 0);
      const otherEarnings = headRows.filter(item => item !== basicHead && item.frequency !== 'monthly').reduce((sum, item) => sum + num(item.amount), 0);
      const attendance = attendanceSnapshot(employee, range);
      const { set, bands } = taxBandsFor(fiscal.id, structure.maritalStatus);
      if (!set || !bands.length) throw new Error(`Confirmed tax slabs are missing for ${employee.name}.`);
      const previous = previousPayrollTotals(employee.id, fiscal.id);
      const deductions = deductionsForEmployee(employee, basic);
      const regularOtHours = attendance.regularOtMinutes / 60;
      const holidayOtHours = attendance.holidayOtMinutes / 60;
      const holidayRule = data.holidayOtRules.find(rule => rule.employeeId === employee.id)
        || data.holidayOtRules.find(rule => rule.sectionId && rule.sectionId === employee.hrmsOrg?.sectionId)
        || data.holidayOtRules.find(rule => rule.departmentId && rule.departmentId === employee.hrmsOrg?.departmentId);
      const result = computePayslip({
        basicSalary: basic,
        allowances,
        workingDays: Math.max(1, attendance.workingDays),
        payableDays: Math.min(attendance.workingDays, attendance.payableDays),
        dailyHours: structure.dailyHours || 8,
        regularOtHours,
        holidayOtHours,
        otMultiplier: structure.otMultiplier || 1.5,
        holidayOtMultiplier: holidayRule?.multiplier || structure.otMultiplier || 1.5,
        otherEarnings,
        otherDeductions: structure.otherDeductions,
        pretaxDeductions: deductions.filter(item => item.isPretax),
        postTaxDeductions: deductions.filter(item => !item.isPretax),
        taxBands: bands,
        periodIndex: fiscalPeriodIndex(input.bsMonth, fiscal.startBsMonth || 4),
        taxableYtdBefore: previous.taxable,
        taxPaidBefore: previous.tax
      });
      const itemId = makeId('payitem');
      const item = {
        id: itemId,
        runId,
        fiscalYearId: fiscal.id,
        employeeId: employee.id,
        employeeCode: employee.employeeCode || '',
        employeeName: employee.name,
        bsYear: Number(input.bsYear),
        bsMonth: Number(input.bsMonth),
        periodStart: range.start,
        periodEnd: range.end,
        gross: result.gross,
        tax: result.tax.tdsThisMonth,
        pretaxDeductions: result.pretaxTotal,
        postTaxDeductions: result.postTaxTotal + result.otherDeductions,
        netPay: result.netPay,
        thisMonthTaxable: result.thisMonthTaxable,
        projectedAnnualIncome: result.tax.projectedAnnualIncome,
        projectedAnnualTax: result.tax.projectedAnnualTax,
        taxableYtd: result.taxableYtdInclCurrent,
        formula: result,
        generatedAt: stamp()
      };
      items.push(item);
      headRows.forEach(head => itemHeads.push({ id: makeId('payhead'), itemId, headCode: head.code, name: head.name, amount: round(head.amount), frequency: head.frequency, createdAt: stamp() }));
      deductions.forEach(deduction => itemDeductions.push({ id: makeId('payded'), itemId, deductionCode: deduction.code, name: deduction.name, amount: deduction.amount, isPretax: deduction.isPretax, createdAt: stamp() }));
      snapshots.push({ id: makeId('paysnap'), runId, employeeId: employee.id, ...attendance, createdAt: stamp() });
    });

    if (!items.length) throw new Error('No employee has a salary structure or base salary available for payroll.');
    const existingModule = ERP.modulesByKey.get('payroll');
    const runRecord = ERP.makeRecord(existingModule, {
      id: runId,
      name: input.name || `Payroll ${input.bsYear}-${String(input.bsMonth).padStart(2, '0')} BS`,
      periodStart: range.start,
      periodEnd: range.end,
      employeeCount: items.length,
      gross: round(items.reduce((sum, item) => sum + item.gross, 0)),
      tax: round(items.reduce((sum, item) => sum + item.tax, 0)),
      ssf: 0,
      pf: round(itemDeductions.filter(item => String(item.deductionCode).toUpperCase() === 'PF').reduce((sum, item) => sum + item.amount, 0)),
      cit: round(itemDeductions.filter(item => String(item.deductionCode).toUpperCase() === 'CIT').reduce((sum, item) => sum + item.amount, 0)),
      net: round(items.reduce((sum, item) => sum + item.netPay, 0)),
      status: 'computed',
      fiscalYearId: fiscal.id,
      bsYear: Number(input.bsYear),
      bsMonth: Number(input.bsMonth),
      hrmsManaged: true,
      generatedAt: stamp()
    });
    ERP.collection('payroll').unshift(runRecord);
    data.payrollItems.push(...items);
    data.payrollItemHeads.push(...itemHeads);
    data.payrollItemDeductions.push(...itemDeductions);
    data.payrollAttendanceSnapshots.push(...snapshots);
    audit('payrollRuns', runId, 'GENERATE', null, runRecord, `${items.length} payslips generated.`);
    return { run: runRecord, items, heads: itemHeads, deductions: itemDeductions, snapshots };
  }

  function payrollItemsForRun(runId) {
    return ensureState().payrollItems.filter(item => item.runId === runId);
  }

  function payslip(runId, employeeId) {
    const data = ensureState();
    const item = data.payrollItems.find(row => row.runId === runId && row.employeeId === employeeId);
    if (!item) return null;
    return {
      item,
      heads: data.payrollItemHeads.filter(row => row.itemId === item.id),
      deductions: data.payrollItemDeductions.filter(row => row.itemId === item.id),
      attendance: data.payrollAttendanceSnapshots.find(row => row.runId === runId && row.employeeId === employeeId) || null,
      run: ERP.collection('payroll').find(row => row.id === runId) || null,
      employee: ERP.collection('employees').find(row => row.id === employeeId) || null
    };
  }

  function annualPayrollSummary(fiscalYearId) {
    const rows = new Map();
    ensureState().payrollItems.filter(item => item.fiscalYearId === fiscalYearId).forEach(item => {
      const current = rows.get(item.employeeId) || {
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        employeeCode: item.employeeCode,
        months: 0,
        gross: 0,
        tax: 0,
        deductions: 0,
        netPay: 0,
        taxable: 0
      };
      current.months += 1;
      current.gross += num(item.gross);
      current.tax += num(item.tax);
      current.deductions += num(item.pretaxDeductions) + num(item.postTaxDeductions);
      current.netPay += num(item.netPay);
      current.taxable += num(item.thisMonthTaxable);
      rows.set(item.employeeId, current);
    });
    return [...rows.values()].map(item => ({ ...item, gross: round(item.gross), tax: round(item.tax), deductions: round(item.deductions), netPay: round(item.netPay), taxable: round(item.taxable) }));
  }

  function escapeCsv(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function csv(rows, columns) {
    return [columns.map(column => escapeCsv(column.label)).join(','), ...rows.map(row => columns.map(column => escapeCsv(typeof column.value === 'function' ? column.value(row) : row[column.value])).join(','))].join('\n');
  }

  function spreadsheetXml(rows, columns, title = 'Formcraft export') {
    const xmlEscape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const rowXml = values => `<Row>${values.map(value => `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`).join('')}</Row>`;
    return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${xmlEscape(title.slice(0, 31))}"><Table>${rowXml(columns.map(column => column.label))}${rows.map(row => rowXml(columns.map(column => typeof column.value === 'function' ? column.value(row) : row[column.value]))).join('')}</Table></Worksheet></Workbook>`;
  }

  function downloadText(filename, content, type = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportRows(filename, rows, columns, format = 'csv') {
    if (format === 'xls') return downloadText(`${filename}.xls`, spreadsheetXml(rows, columns, filename), 'application/vnd.ms-excel;charset=utf-8');
    return downloadText(`${filename}.csv`, csv(rows, columns), 'text/csv;charset=utf-8');
  }

  function isMissingTableError(error) {
    const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    return text.includes('42p01') || text.includes('pgrst205') || text.includes('does not exist') || text.includes('schema cache');
  }

  async function bridgeSnapshot() {
    const backend = window.FormcraftBackend;
    if (!backend?.client || !backend?.workspace?.id) return { configured: false, schemaMissing: false, bridge: null, devices: [], users: [], sessions: [], commands: [] };
    const client = backend.client;
    const workspaceId = backend.workspace.id;
    try {
      const [bridges, devices, users, sessions, commands] = await Promise.all([
        client.from('hrms_bridges').select('id,name,active,version,last_seen_at,hostname,platform,metadata,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
        client.from('hrms_devices').select('*').eq('workspace_id', workspaceId).order('name'),
        client.from('hrms_device_users').select('*').eq('workspace_id', workspaceId).order('name').limit(5000),
        client.from('hrms_pull_sessions').select('*').eq('workspace_id', workspaceId).order('started_at', { ascending: false }).limit(250),
        client.from('hrms_device_commands').select('*').eq('workspace_id', workspaceId).order('requested_at', { ascending: false }).limit(250)
      ]);
      const errors = [bridges.error, devices.error, users.error, sessions.error, commands.error].filter(Boolean);
      if (errors.length) throw errors[0];
      const bridge = bridges.data?.find(item => item.active) || bridges.data?.[0] || null;
      return { configured: Boolean(bridge), schemaMissing: false, bridge, devices: devices.data || [], users: users.data || [], sessions: sessions.data || [], commands: commands.data || [] };
    } catch (error) {
      if (isMissingTableError(error)) return { configured: false, schemaMissing: true, bridge: null, devices: [], users: [], sessions: [], commands: [], error };
      return { configured: false, schemaMissing: false, bridge: null, devices: [], users: [], sessions: [], commands: [], error };
    }
  }

  async function createBridge(name) {
    assertManage();
    const backend = window.FormcraftBackend;
    if (!backend?.client || !backend?.workspace?.id) throw new Error('The authenticated backend is not ready.');
    const { data, error } = await backend.client.rpc('hrms_create_bridge', { target_workspace: backend.workspace.id, bridge_name: String(name || 'Office bridge').trim() });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.bridge_id || !result?.bridge_token) throw new Error('Bridge credential creation returned an incomplete result.');
    ensureState().bridge.bridgeId = result.bridge_id;
    ensureState().bridge.bridgeName = String(name || 'Office bridge').trim();
    audit('bridge', result.bridge_id, 'CREATE', null, { bridgeId: result.bridge_id, name: ensureState().bridge.bridgeName }, 'Local device bridge credential created.');
    await persist();
    return result;
  }

  async function createDevice(input) {
    assertManage();
    const backend = window.FormcraftBackend;
    if (!backend?.client || !backend?.workspace?.id) throw new Error('The authenticated backend is not ready.');
    const snapshot = await bridgeSnapshot();
    const bridgeId = input.bridgeId || snapshot.bridge?.id;
    if (!bridgeId) throw new Error('Create a local bridge before registering a biometric device.');
    const payload = {
      workspace_id: backend.workspace.id,
      bridge_id: bridgeId,
      name: String(input.name || '').trim(),
      ip_address: String(input.ipAddress || '').trim(),
      port: Math.max(1, num(input.port) || 4370),
      model: String(input.model || '').trim(),
      force_udp: Boolean(input.forceUdp),
      connection_timeout: Math.max(3, Math.min(120, num(input.connectionTimeout) || 10)),
      active: input.active !== false,
      secret_configured: false,
      created_by: backend.session.user.id,
      updated_by: backend.session.user.id
    };
    if (!payload.name || !payload.ip_address) throw new Error('Device name and IP address are required.');
    const { data, error } = await backend.client.from('hrms_devices').insert(payload).select().single();
    if (error) throw error;
    audit('devices', data.id, 'INSERT', null, { ...data, ip_address: data.ip_address }, `Device ${data.name} registered.`);
    return data;
  }

  async function updateDevice(id, input) {
    assertManage();
    const backend = window.FormcraftBackend;
    const payload = {
      name: String(input.name || '').trim(),
      ip_address: String(input.ipAddress || '').trim(),
      port: Math.max(1, num(input.port) || 4370),
      model: String(input.model || '').trim(),
      force_udp: Boolean(input.forceUdp),
      connection_timeout: Math.max(3, Math.min(120, num(input.connectionTimeout) || 10)),
      active: input.active !== false,
      updated_by: backend.session.user.id,
      updated_at: stamp()
    };
    const { data, error } = await backend.client.from('hrms_devices').update(payload).eq('id', id).eq('workspace_id', backend.workspace.id).select().single();
    if (error) throw error;
    audit('devices', id, 'UPDATE', null, data, `Device ${data.name} updated.`);
    return data;
  }

  async function deleteDevice(id) {
    assertManage();
    const backend = window.FormcraftBackend;
    if (!backend?.client || !backend?.workspace?.id) throw new Error('The authenticated backend is not ready.');
    const snapshot = await bridgeSnapshot();
    const device = snapshot.devices.find(item => item.id === id);
    const { error } = await backend.client.from('hrms_devices').delete().eq('id', id).eq('workspace_id', backend.workspace.id);
    if (error) throw error;
    const data = ensureState();
    data.employeeDeviceLinks = data.employeeDeviceLinks.filter(item => item.deviceId !== id);
    audit('devices', id, 'DELETE', device || null, null, `Device ${device?.name || id} removed from the bridge configuration.`);
    await persist();
    return true;
  }

  async function queueDeviceCommand(command, options = {}) {
    assertManage();
    const backend = window.FormcraftBackend;
    if (!backend?.client || !backend?.workspace?.id) throw new Error('The authenticated backend is not ready.');
    const snapshot = await bridgeSnapshot();
    const bridgeId = options.bridgeId || snapshot.bridge?.id;
    if (!bridgeId) throw new Error('No active device bridge is configured.');
    const payload = {
      workspace_id: backend.workspace.id,
      bridge_id: bridgeId,
      device_id: options.deviceId || null,
      command,
      payload: obj(options.payload),
      status: 'queued',
      requested_by: backend.session.user.id,
      requested_at: stamp(),
      expires_at: new Date(Date.now() + (options.expiresMinutes || 30) * 60000).toISOString()
    };
    const { data, error } = await backend.client.from('hrms_device_commands').insert(payload).select().single();
    if (error) throw error;
    audit('deviceCommands', data.id, 'QUEUE', null, { command, deviceId: payload.device_id }, `Queued ${command}.`);
    return data;
  }

  async function bridgePunches(options = {}) {
    const backend = window.FormcraftBackend;
    if (!backend?.client || !backend?.workspace?.id) return { schemaMissing: false, rows: [] };
    try {
      let query = backend.client
        .from('hrms_attendance_punches')
        .select('id,device_id,device_uid,device_user_id,employee_name,punched_at,punch_code,punch_label,source,metadata,received_at,hrms_devices(name)')
        .eq('workspace_id', backend.workspace.id)
        .order('punched_at', { ascending: false })
        .limit(Math.max(1, Math.min(2000, num(options.limit) || 500)));
      if (options.deviceId) query = query.eq('device_id', options.deviceId);
      const { data, error } = await query;
      if (error) throw error;
      return { schemaMissing: false, rows: data || [] };
    } catch (error) {
      if (isMissingTableError(error)) return { schemaMissing: true, rows: [], error };
      return { schemaMissing: false, rows: [], error };
    }
  }

  async function syncBridgeAttendance(options = {}) {
    assertManage();
    const backend = window.FormcraftBackend;
    if (!backend?.client || !backend?.workspace?.id || !Compliance?.materializePunches) throw new Error('Attendance materialization is unavailable.');
    const data = ensureState();
    let query = backend.client
      .from('hrms_attendance_punches')
      .select('id,device_id,device_uid,device_user_id,employee_name,punched_at,punch_code,punch_label,source,metadata,received_at,hrms_devices(name)')
      .eq('workspace_id', backend.workspace.id)
      .order('received_at', { ascending: true })
      .limit(Math.max(1, Math.min(5000, num(options.limit) || 2000)));
    if (data.bridge.lastSyncCursor) query = query.gt('received_at', data.bridge.lastSyncCursor);
    const { data: punches, error } = await query;
    if (error) {
      if (isMissingTableError(error)) throw new Error('The HRMS device bridge database migration has not been applied yet.');
      throw error;
    }
    if (!punches?.length) {
      data.bridge.lastSyncAt = stamp();
      return { punches: 0, attendanceRecords: 0 };
    }
    const links = data.employeeDeviceLinks;
    const employees = ERP.collection('employees');
    const normalized = punches.map(row => {
      const link = links.find(item => item.deviceId === row.device_id && String(item.deviceUserId) === String(row.device_user_id))
        || links.find(item => String(item.deviceUserId) === String(row.device_user_id));
      const employee = employees.find(item => item.id === link?.employeeId)
        || employees.find(item => String(item.employeeCode || '') === String(row.device_user_id || ''));
      return {
        id: row.id,
        employeeId: employee?.id || '',
        employeeCode: employee?.employeeCode || row.device_user_id || '',
        employeeName: employee?.name || row.employee_name || '',
        timestamp: new Date(row.punched_at),
        device: row.hrms_devices?.name || row.device_id || 'ZKTeco',
        punchType: row.punch_label || String(row.punch_code ?? ''),
        source: row.source || 'device-bridge',
        metadata: obj(row.metadata)
      };
    }).filter(item => !Number.isNaN(item.timestamp.getTime()));
    const batchId = `bridge-${punches[0].received_at}-${punches.at(-1).received_at}`;
    const bySource = new Map();
    normalized.forEach(item => {
      const source = item.source === 'auto_attend' ? 'auto-attend' : 'device';
      const group = bySource.get(source) || [];
      group.push(item);
      bySource.set(source, group);
    });
    const records = [];
    bySource.forEach((group, source) => records.push(...Compliance.materializePunches(group, `${batchId}-${source}`, source)));
    data.bridge.lastSyncCursor = punches.at(-1).received_at;
    data.bridge.lastSyncAt = stamp();
    data.bridge.lastBridgeError = '';
    audit('attendanceBridge', batchId, 'MATERIALIZE', null, { punches: normalized.length, records: records.length, sources: [...bySource.keys()] }, 'Bridge punches materialized into existing Attendance records.');
    await persist();
    return { punches: normalized.length, attendanceRecords: records.length };
  }

  function linkDeviceUser(input) {
    const link = upsert('employeeDeviceLinks', {
      id: input.id,
      employeeId: input.employeeId,
      deviceId: input.deviceId,
      deviceUid: input.deviceUid,
      deviceUserId: String(input.deviceUserId || ''),
      deviceUserName: String(input.deviceUserName || ''),
      active: input.active !== false
    }, { manageOnly: true, detail: 'Device identity linked to employee.' });
    const employee = ERP.collection('employees').find(item => item.id === input.employeeId);
    if (employee && !employee.attendanceId && link.deviceUserId) employee.attendanceId = link.deviceUserId;
    return link;
  }

  function combinedAudit() {
    const data = ensureState();
    const complianceAudit = arr(state.erp?.nepalCompliance?.audit).map(item => ({
      id: item.id,
      tableName: 'nepalCompliance',
      recordId: item.recordId || item.batchId || '',
      action: item.action || 'EVENT',
      detail: item.detail || '',
      changedBy: item.actor || 'workspace user',
      changedAt: item.at || '',
      oldData: null,
      newData: item
    }));
    const moduleRows = ['employees', 'attendance', 'timeoff', 'payroll'].flatMap(moduleKey => ERP.collection(moduleKey).flatMap(record => arr(record.audit).map(item => ({
      id: item.id || `${record.id}-${item.at}`,
      tableName: moduleKey,
      recordId: record.id,
      action: item.action || 'UPDATE',
      detail: item.detail || '',
      changedBy: item.userName || 'workspace member',
      changedAt: item.at || '',
      oldData: null,
      newData: null
    }))));
    return [...data.audit, ...complianceAudit, ...moduleRows].sort((a, b) => String(b.changedAt || '').localeCompare(String(a.changedAt || '')));
  }

  ensureState();
  extendEmployeeSchema();
  extendTimeOffSchema();
  refreshTimeOffOptions();

  window.FormcraftHRMS = Object.freeze({
    VERSION,
    TIME_ZONE,
    SYSTEM_LEAVE_OPTIONS,
    ensureState,
    canEdit,
    canManage,
    audit,
    persist,
    upsert,
    remove,
    relationName,
    organizationPath,
    assignOrganization,
    assignShift,
    extendEmployeeSchema,
    extendTimeOffSchema,
    refreshTimeOffOptions,
    leaveTypeFor,
    leaveForDate,
    kaajForDate,
    leaveFraction,
    dayRemarkFor,
    balanceFor,
    resolvedLeaveBalance,
    leaveDaysTaken,
    dateDiffInclusive,
    monthRange,
    dailyReport,
    monthlyReport,
    departmentSummary,
    absentReport,
    shiftForEmployee,
    timingForRecord,
    attendanceSnapshot,
    annualTax,
    slabBreakdown,
    fiscalPeriodIndex,
    monthlyTds,
    computePayslip,
    generatePayroll,
    payrollItemsForRun,
    payslip,
    annualPayrollSummary,
    exportRows,
    spreadsheetXml,
    bridgeSnapshot,
    createBridge,
    createDevice,
    updateDevice,
    deleteDevice,
    queueDeviceCommand,
    bridgePunches,
    syncBridgeAttendance,
    linkDeviceUser,
    combinedAudit,
    arr,
    obj,
    num,
    round,
    stamp,
    makeId
  });
})();
