import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };
const has = (text, needle, message = `Missing ${needle}`) => must(text.includes(needle), message);

const core = read('assets/js/hrms-suite-core.js');
const ui = read('assets/js/hrms-suite-ui.js');
const xlsx = read('assets/js/hrms-xlsx.js');
const css = read('assets/css/hrms-suite.css');
const index = read('index.html');
const schema = read('assets/js/erp-suite-schema.js');
const sql = read('supabase/migrations/20260807170000_hrms_zkteco_bridge.sql');
const bridge = read('device-bridge/formcraft_bridge.py');

// Variant A is intentionally non-destructive: original modules and record renderer remain authoritative.
for (const key of ['employees', 'attendance', 'timeoff', 'payroll']) {
  has(schema, `key: '${key}'`, `Existing ERP module ${key} must remain defined.`);
  has(ui, `${key}: [\n      ['records', 'Records']`, `${key} must keep Records as its first HRMS tab.`);
}
has(ui, 'window.FormcraftERPUI.renderModulePage(module)', 'Records tab must reuse the existing ERP renderer.');
has(ui, 'hasOpenRecord(module.key)) return previousRenderPage();', 'Existing record detail pages must bypass HRMS tabs.');
has(ui, 'Existing records stay unchanged.', 'Additive UI invariant copy missing.');

// Hosted app loads HRMS only after existing ERP + attendance foundations.
for (const asset of ['assets/js/hrms-xlsx.js', 'assets/js/hrms-suite-core.js', 'assets/js/hrms-suite-ui.js', 'assets/css/hrms-suite.css']) has(index, asset);
must(index.indexOf('assets/js/nepal-attendance-compliance.js') < index.indexOf('assets/js/hrms-suite-core.js'), 'HRMS core must load after the existing Nepal attendance core.');

// Feature parity surface.
for (const token of [
  'directorates', 'departments', 'sections', 'units', 'shifts', 'shiftRules',
  'employeeDeviceLinks', 'leaveTypes', 'leaveBalances', 'kaajRecords', 'dayRemarks', 'holidayTypes', 'autoAttendRules',
  'fiscalYears', 'taxSlabSets', 'salaryHeads', 'employeeHeads', 'deductionTypes',
  'employeeDeductions', 'salaryStructures', 'holidayOtRules', 'payrollAttendanceSnapshots',
  'dailyReport', 'bridgePunches', 'monthlyReport', 'departmentSummary', 'absentReport', 'extendTimeOffSchema', 'leaveForDate', 'kaajForDate', 'generatePayroll',
  'annualPayrollSummary', 'combinedAudit'
]) has(core, token, `HRMS core missing ${token}.`);
for (const token of [
  'Device identities', 'Device center', 'Historical', 'Pull sessions', 'Raw punches', 'Hajiri', 'Kaaj / field duty',
  'Attendance review', 'Payslips', 'Heads & deductions', 'Tax slabs', 'Fiscal years', 'Holiday OT',
  'Annual summary', 'Import CSV / XLSX', 'Sync employee directory', 'Auto attendance', 'Holiday types'
]) has(ui, token, `HRMS UI missing ${token}.`);
has(xlsx, "DecompressionStream('deflate-raw')", 'Modern XLSX decompression support missing.');
has(ui, "['__create__'", 'Device-user import must create a normal Employee record instead of a shadow HR user.');
has(ui, "HR.queueDeviceCommand('delete-user'", 'Device user deletion command missing.');
has(ui, "HR.queueDeviceCommand('sync-user'", 'Employee directory to device sync missing.');
has(ui, "HR.queueDeviceCommand('pull-month'", 'Historical device pull missing.');
has(ui, 'data-hrms-day-remark', 'Attendance day remarks UI missing.');
has(core, 'extendEmployeeSchema', 'Existing Employees module must be additively extended with HR fields.');
has(core, 'extendTimeOffSchema', 'Existing Time Off module must be additively extended with half-day fields.');
has(ui, 'validateDailyImport', 'Controlled bulk daily attendance import missing.');
has(ui, 'Default manual reason', 'Bulk daily attendance must collect manual-entry evidence.');
has(core, 'KAAJ_PAID', 'Kaaj must participate in shared attendance/payroll status calculations.');
has(core, 'deleteDevice', 'Device deletion integration missing.');

// Bridge is isolated and uses least-privilege public Supabase credentials plus bridge token.
for (const table of ['hrms_bridges', 'hrms_devices', 'hrms_device_users', 'hrms_attendance_punches', 'hrms_pull_sessions', 'hrms_device_commands']) has(sql, `public.${table}`, `Bridge migration missing ${table}.`);
for (const fn of ['hrms_create_bridge', 'hrms_bridge_pull_config', 'hrms_bridge_heartbeat', 'hrms_bridge_pull_commands', 'hrms_bridge_ack_command', 'hrms_bridge_ingest_users', 'hrms_bridge_ingest_punches']) has(sql, fn, `Bridge migration missing ${fn}.`);
has(sql, 'enable row level security', 'Bridge tables must use RLS.');
has(sql, 'digest(', 'Bridge tokens must be hashed server-side.');
has(bridge, 'FORMCRAFT_SUPABASE_PUBLISHABLE_KEY', 'Local bridge must use the public publishable key.');
has(bridge, 'FORMCRAFT_BRIDGE_TOKEN', 'Local bridge token missing.');
must(!bridge.includes('SERVICE_ROLE') && !core.includes('SERVICE_ROLE') && !ui.includes('SERVICE_ROLE'), 'Service-role credentials must never appear in HRMS browser/bridge code.');
has(bridge, 'Asia/Kathmandu', 'Bridge must operate in Nepal time.');
for (const name of ['pull-month', 'migrate-users', 'backup', 'sync-user', 'delete-user', 'set-secret', 'set-schedule', 'set-auto-attend-rules']) has(bridge, name, `Bridge command ${name} missing.`);

// Design/system safety.
has(css, 'var(--surface)', 'HRMS must use existing Formcraft surface tokens.');
has(css, 'var(--primary)', 'HRMS must use existing Formcraft primary token.');
has(css, '@media (prefers-reduced-motion: reduce)', 'Reduced motion support missing.');
has(css, 'min-height: 44px', 'Mobile touch target guard missing.');
must(!/linear-gradient|radial-gradient|backdrop-filter/.test(css), 'HRMS must not introduce gradients/glass that diverge from Formcraft.');

console.log('HRMS additive audit passed');
