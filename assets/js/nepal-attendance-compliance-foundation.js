'use strict';

(() => {
  const VERSION = 'FORMCRAFT-NP-WORKFORCE-COMPLIANCE-1.0';
  const TIME_ZONE = 'Asia/Kathmandu';
  const ERP = window.FormcraftERP;
  if (!ERP) return;

  const list = value => Array.isArray(value) ? value : [];
  const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = value => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const timestamp = () => new Date().toISOString();
  const escape = value => typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '');
  const id = prefix => typeof uid === 'function'
    ? `${prefix}-${uid()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const canManage = () => ['owner', 'admin'].includes(window.FormcraftBackend?.role || 'viewer');

  const POLICY_DEFAULTS = Object.freeze({
    timeZone: TIME_ZONE,
    standardDayHours: 8,
    standardWeekHours: 48,
    breakAfterHours: 5,
    minimumBreakMinutes: 30,
    overtimeMaxPerDay: 4,
    overtimeMaxPerWeek: 24,
    overtimeMultiplier: 1.5,
    weeklyOffDay: 6,
    weeklyOffDaysRequired: 1,
    compensatoryLeaveDeadlineDays: 21,
    duplicateWindowSeconds: 60,
    confirmedAt: '',
    confirmedBy: '',
    sourceNote: 'Nepal Labour Act 2074 sections 28-31 and 40-49. Verify later amendments, sector rules and collective agreements.'
  });

  const LEGAL_RULES = Object.freeze([
    ['Normal work time', '8 hours/day and 48 hours/week', 'Labour Act 2074, section 28'],
    ['Rest interval', '30 minutes after 5 continuous hours', 'Labour Act 2074, section 28'],
    ['Overtime ceiling', 'Maximum 4 hours/day and 24 hours/week', 'Labour Act 2074, section 30'],
    ['Overtime premium', 'At least 1.5x basic remuneration', 'Labour Act 2074, section 31'],
    ['Weekly leave', 'At least 1 day each week', 'Labour Act 2074, section 40'],
    ['Substitute leave', 'Grant within 21 days after work on weekly/public holiday', 'Labour Act 2074, section 42']
  ]);

  const LEAVE_REFERENCE = Object.freeze([
    ['statutory', 'Home leave', '1 day per 20 days worked', 'Paid', 'Up to 90 days', 'Labour Act 2074, sections 43 and 49'],
    ['statutory', 'Sick leave', '12 days/year, proportionate for shorter service', 'Paid', 'Up to 45 days', 'Labour Act 2074, sections 44 and 49'],
    ['statutory', 'Maternity leave', '14 weeks / 98 days total', '60 days full remuneration; SSF rules may affect payer', 'Not carried', 'Labour Act 2074, sections 45 and 47'],
    ['statutory', 'Maternity care leave', '15 days', 'Paid', 'Not carried', 'Labour Act 2074, section 45(7)'],
    ['statutory', 'Mourning leave', '13 days when statutory conditions apply', 'Paid', 'Not carried', 'Labour Act 2074, section 48'],
    ['statutory', 'Public holidays', "13 paid days; 14 for women including International Women's Day", 'Paid', 'Calendar based', 'Labour Act 2074, section 41'],
    ['company-policy', 'Casual leave', 'Configure as organization policy', 'Policy defined', 'Policy defined', 'Not seeded as a statutory entitlement'],
    ['operational', 'Kaaj / field duty', 'Operational duty classification, not leave entitlement', 'Policy defined', 'Not applicable', 'Operational category adapted for Nepal workflows']
  ]);

  const HOLIDAY_TYPES = Object.freeze([
    ['public', 'Public holiday', 'PH', 'सा'],
    ['festival', 'Festival holiday', 'FH', 'उत्'],
    ['national', 'National holiday', 'NH', 'रा'],
    ['optional', 'Optional holiday', 'OH', 'वै'],
    ['other', 'Other closure', 'H', 'बि']
  ]);

  function ensureState() {
    ERP.ensureERPState();
    state.erp.nepalCompliance ||= {};
    const data = state.erp.nepalCompliance;
    data.version = VERSION;
    data.policy = { ...POLICY_DEFAULTS, ...record(data.policy), timeZone: TIME_ZONE };
    for (const key of ['holidays', 'punches', 'imports', 'compensatoryLeave', 'audit', 'fiscalProfiles']) {
      data[key] = list(data[key]);
    }
    data.activeView ||= 'overview';
    data.lastEvaluationAt ||= '';
    return data;
  }

  function auditEvent(action, detail, metadata = {}) {
    const data = ensureState();
    data.audit.unshift({
      id: id('np-audit'),
      action,
      detail,
      at: timestamp(),
      actor: window.FormcraftBackend?.user?.email || window.FormcraftBackend?.role || 'workspace user',
      ...metadata
    });
    data.audit = data.audit.slice(0, 500);
  }

  function nptParts(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).reduce((parts, part) => {
      if (part.type !== 'literal') parts[part.type] = part.value;
      return parts;
    }, {});
  }

  function nptDate(value = new Date()) {
    const parts = nptParts(value);
    return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
  }

  function nptTime(value) {
    const parts = nptParts(value);
    return parts ? `${parts.hour}:${parts.minute}` : '';
  }

  function parseTime(value, dateValue = '', timeValue = '') {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    let text = String(value || '').trim();
    if (!text && dateValue) text = `${String(dateValue).trim()}T${String(timeValue || '00:00:00').trim()}`;
    if (!text) return null;
    text = text.replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) text += ':00';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(text)) text += '+05:45';
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addDays(value, days) {
    const [year, month, day] = String(value).split('-').map(Number);
    if (![year, month, day].every(Number.isFinite)) return '';
    return new Date(Date.UTC(year, month - 1, day + days, 6, 0, 0)).toISOString().slice(0, 10);
  }

  function weekday(value) {
    const [year, month, day] = String(value).split('-').map(Number);
    if (![year, month, day].every(Number.isFinite)) return -1;
    return new Date(Date.UTC(year, month - 1, day, 6, 0, 0)).getUTCDay();
  }

  function weekStart(value) {
    const day = weekday(value);
    return day < 0 ? '' : addDays(value, -day);
  }

  function nepaliDateClass() {
    const candidate = globalThis.NepaliDate;
    return candidate?.default || candidate || null;
  }

  function bsParts(value) {
    const NepaliDate = nepaliDateClass();
    if (!NepaliDate) return null;
    try {
      const converted = new NepaliDate(value instanceof Date ? value : new Date(`${value}T12:00:00+05:45`));
      const formatted = converted.format?.('YYYY-MM-DD') || '';
      const match = String(formatted).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
      if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
      return { year: Number(converted.getYear?.()), month: Number(converted.getMonth?.()) + 1, day: Number(converted.getDate?.()) };
    } catch (error) {
      return null;
    }
  }

  function bsToAd(year, month, day) {
    const NepaliDate = nepaliDateClass();
    if (!NepaliDate) return '';
    try {
      const date = new NepaliDate(Number(year), Number(month) - 1, Number(day)).toJsDate?.();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? nptDate(date) : '';
    } catch (error) {
      return '';
    }
  }

  function bsLabel(value) {
    const bs = bsParts(value);
    return bs ? `${bs.year}-${String(bs.month).padStart(2, '0')}-${String(bs.day).padStart(2, '0')} BS` : '';
  }

  function fiscalYear() {
    const bs = bsParts(new Date());
    if (!bs) return state.settings?.compliance?.fiscalYear || '';
    const start = bs.month >= 4 ? bs.year : bs.year - 1;
    return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
  }

  function currentMonthRange() {
    const bs = bsParts(new Date());
    if (bs) {
      const start = bsToAd(bs.year, bs.month, 1);
      const next = bs.month === 12 ? bsToAd(bs.year + 1, 1, 1) : bsToAd(bs.year, bs.month + 1, 1);
      return { label: `${bs.year}-${String(bs.month).padStart(2, '0')} BS`, start, end: addDays(next, -1) };
    }
    const today = nptDate();
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const start = `${today.slice(0, 7)}-01`;
    const next = new Date(Date.UTC(year, month, 1, 6, 0, 0)).toISOString().slice(0, 10);
    return { label: today.slice(0, 7), start, end: addDays(next, -1) };
  }

  function csvLine(line) {
    const values = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
        else quoted = !quoted;
      } else if (character === ',' && !quoted) {
        values.push(value.trim()); value = '';
      } else value += character;
    }
    values.push(value.trim());
    return values;
  }

  function parseImportText(text, fileName = '') {
    const source = String(text || '').trim();
    if (!source) return [];
    if (fileName.toLowerCase().endsWith('.json') || source.startsWith('[')) {
      const data = JSON.parse(source);
      if (!Array.isArray(data)) throw new Error('JSON attendance import must be an array of punch records.');
      return data;
    }
    const lines = source.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV attendance import needs a header and at least one data row.');
    const headers = csvLine(lines[0]);
    return lines.slice(1).map(line => {
      const values = csvLine(line);
      return headers.reduce((row, header, index) => ({ ...row, [header]: values[index] ?? '' }), {});
    });
  }

  function pick(row, names) {
    const entries = Object.entries(record(row));
    for (const name of names) {
      const target = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = entries.find(([key]) => key.toLowerCase().replace(/[^a-z0-9]/g, '') === target);
      if (found && String(found[1] ?? '').trim()) return found[1];
    }
    return '';
  }

  function employeeFor(row) {
    const employees = ERP.collection('employees');
    const directId = String(pick(row, ['employeeId', 'employee_id', 'globalUserId'])).trim();
    const code = String(pick(row, ['employeeCode', 'attendanceId', 'attId', 'userId', 'uid'])).trim().toLowerCase();
    const name = String(pick(row, ['employeeName', 'name'])).trim().toLowerCase();
    return employees.find(employee => directId && String(employee.id) === directId)
      || employees.find(employee => code && [employee.employeeCode, employee.attendanceId, employee.userId, employee.id]
        .some(value => String(value || '').trim().toLowerCase() === code))
      || employees.find(employee => name && String(employee.name || '').trim().toLowerCase() === name)
      || null;
  }

  function normalizePunch(row, index) {
    const employee = employeeFor(row);
    const date = parseTime(
      pick(row, ['timestamp', 'punchTime', 'datetime', 'dateTime']),
      pick(row, ['date', 'workDate', 'adDate']),
      pick(row, ['time', 'punch'])
    );
    const employeeCode = String(pick(row, ['employeeCode', 'attendanceId', 'attId', 'userId', 'uid']) || employee?.employeeCode || '').trim();
    const employeeName = String(pick(row, ['employeeName', 'name']) || employee?.name || '').trim();
    return {
      rowNumber: index + 2,
      employeeId: employee?.id || '',
      employeeCode,
      employeeName,
      timestamp: date,
      device: String(pick(row, ['device', 'deviceName', 'terminal']) || 'Imported device').trim(),
      punchType: String(pick(row, ['punchType', 'status', 'state'])).trim(),
      error: !date ? 'Invalid or missing timestamp.' : (!employee && !employeeCode && !employeeName ? 'Employee identifier is missing.' : '')
    };
  }

  function previewPunchRows(rows, options = {}) {
    const data = ensureState();
    const windowSeconds = Math.max(1, number(options.duplicateWindowSeconds || data.policy.duplicateWindowSeconds));
    const normalized = list(rows).map(normalizePunch);
    const errors = normalized.filter(item => item.error);
    const candidates = normalized.filter(item => !item.error).sort((left, right) => left.timestamp - right.timestamp);
    const accepted = [];
    const duplicates = [];
    const history = new Map();
    if (options.compareStored !== false) {
      data.punches.forEach(stored => {
        const date = parseTime(stored.timestamp);
        const key = String(stored.employeeId || stored.employeeCode || stored.employeeName || '').trim().toLowerCase();
        if (!date || !key) return;
        const values = history.get(key) || [];
        values.push({ timestamp: date, rowNumber: 'stored', id: stored.id });
        history.set(key, values);
      });
    }
    candidates.forEach(item => {
      const key = String(item.employeeId || item.employeeCode || item.employeeName).trim().toLowerCase();
      const values = history.get(key) || [];
      const duplicate = values.find(previous => Math.abs(item.timestamp - previous.timestamp) <= windowSeconds * 1000);
      if (duplicate) duplicates.push({ ...item, duplicateOf: duplicate.rowNumber, duplicateStoredId: duplicate.id || '' });
      else { accepted.push(item); values.push(item); history.set(key, values); }
    });
    return { total: normalized.length, accepted, duplicates, errors, windowSeconds };
  }

  window.FormcraftNepalComplianceFoundation = Object.freeze({
    VERSION, TIME_ZONE, ERP, POLICY_DEFAULTS, LEGAL_RULES, LEAVE_REFERENCE, HOLIDAY_TYPES,
    list, record, number, round, timestamp, escape, id, canManage,
    ensureState, auditEvent, nptParts, nptDate, nptTime, parseTime, addDays, weekday, weekStart,
    nepaliDateClass, bsParts, bsToAd, bsLabel, fiscalYear, currentMonthRange,
    csvLine, parseImportText, pick, employeeFor, normalizePunch, previewPunchRows
  });
})();
