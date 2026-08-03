import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const runtime = read('assets/js/nepal-attendance-compliance.js');
const styles = read('assets/css/nepal-attendance-compliance.css');
const index = read('index.html');
const docs = read('docs/NEPAL_ATTENDANCE_COMPLIANCE.md');
const packageJson = JSON.parse(read('package.json'));

assert.match(runtime, /FORMCRAFT-NP-WORKFORCE-COMPLIANCE-1\.0/, 'Compliance runtime must publish a versioned contract');
assert.match(runtime, /timeZone: TIME_ZONE/, 'Attendance policy must be pinned to Asia\/Kathmandu');
assert.match(runtime, /standardDayHours: 8/, 'Normal day guardrail must default to 8 hours');
assert.match(runtime, /standardWeekHours: 48/, 'Normal week guardrail must default to 48 hours');
assert.match(runtime, /breakAfterHours: 5/, 'Rest interval must be evaluated after 5 continuous hours');
assert.match(runtime, /minimumBreakMinutes: 30/, 'Minimum break must default to 30 minutes');
assert.match(runtime, /overtimeMaxPerDay: 4/, 'Daily overtime ceiling must default to 4 hours');
assert.match(runtime, /overtimeMaxPerWeek: 24/, 'Weekly overtime ceiling must default to 24 hours');
assert.match(runtime, /overtimeMultiplier: 1\.5/, 'Overtime premium floor must default to 1.5x');
assert.match(runtime, /compensatoryLeaveDeadlineDays: 21/, 'Substitute leave must be tracked against 21 days');
assert.match(runtime, /duplicateWindowSeconds: 60/, 'Biometric punch deduplication must default to 60 seconds');

assert.match(runtime, /1 day per 20 days worked/, 'Home leave must use Labour Act accrual rather than the reference repository default');
assert.match(runtime, /Up to 90 days/, 'Home leave carry-forward reference must use the statutory ceiling');
assert.match(runtime, /Up to 45 days/, 'Sick leave carry-forward reference must use the statutory ceiling');
assert.match(runtime, /14 weeks \/ 98 days total/, 'Maternity leave must preserve the statutory total-duration nuance');
assert.match(runtime, /13 paid days; 14 for women/, 'Public-holiday reference must preserve the statutory distinction');
assert.match(runtime, /Configure as organization policy/, 'Casual leave must not be falsely presented as a seeded statutory entitlement');

assert.match(runtime, /compareStored !== false/, 'Repeated imports must compare against previously stored punches');
assert.match(runtime, /duplicateStoredId/, 'Stored-punch duplicates must remain traceable');
assert.match(runtime, /manual-entry reason is required/, 'Manual attendance must require a reason');
assert.match(runtime, /approver is required/, 'Manual attendance must require an approver');
assert.match(runtime, /HOLIDAY_CALENDAR_EMPTY/, 'Holiday-calendar readiness must be auditable');
assert.match(runtime, /FISCAL_PROFILE_UNCONFIRMED/, 'Current fiscal profile must be explicitly confirmed');
assert.match(runtime, /WEEKLY_OT_LIMIT/, 'Weekly overtime exceptions must be audited');
assert.match(runtime, /specialDayWorkMinutes/, 'Weekly-off and holiday work must remain separate from ordinary overtime');
assert.match(runtime, /COMP_LEAVE_OVERDUE/, 'Overdue substitute leave must be audited');
assert.match(runtime, /Operational evidence export only/, 'Evidence export must not claim legal certification');

assert.match(runtime, /Direct ZKTeco polling, fingerprint storage, employee lifecycle management and salary processing are excluded/, 'The non-HRMS scope boundary must be visible');
assert.match(runtime, /browser does not connect directly to device UDP ports/, 'Direct device polling limitation must be explicit');
assert.doesNotMatch(runtime, /pyzk|zk\.connect|fingerprint template|set_user|delete_user/i, 'Browser runtime must not contain device-management or biometric-template implementation');
assert.match(runtime, /does not copy that project\\'s source code/, 'Reference repository must be treated as clean-room product research');

for (const contract of ['parseImportText', 'previewPunchRows', 'importPunchRows', 'addManualAttendance', 'addHoliday', 'savePolicy', 'saveFiscalProfile', 'audit: complianceAudit', 'monthRegister']) {
  assert.ok(runtime.includes(contract), `Public compliance API must expose ${contract}`);
}

assert.match(runtime, /routes\['nepal-compliance'\]/, 'Compliance center must have a stable route');
assert.match(runtime, /data-np-compliance-nav/, 'Compliance center must be injected into stable navigation');
assert.match(runtime, /Hajiri register/, 'Traditional Nepal attendance-register view must be available');
assert.match(runtime, /status priority is weekly off, holiday, present, approved leave, then absent/, 'Hajiri status priority must be documented in the UI');

assert.match(styles, /\.np-hajiri-table/, 'Hajiri table must have dedicated styling');
assert.match(styles, /position:\s*sticky/, 'Hajiri headers and employee column must remain readable while scrolling');
assert.match(styles, /@media \(max-width: 680px\)/, 'Compliance center must have a phone layout');
assert.match(styles, /@media print/, 'Hajiri register must have print behavior');
assert.match(styles, /min-height:\s*44px/, 'Primary actions must preserve mobile touch target height');

assert.match(index, /assets\/css\/nepal-attendance-compliance\.css/, 'Compliance stylesheet must be loaded');
assert.match(index, /assets\/js\/nepal-attendance-compliance\.js/, 'Compliance runtime must be loaded');
assert.ok(index.indexOf('assets/js/demo-data-system.js') < index.indexOf('assets/js/nepal-attendance-compliance.js'), 'Compliance runtime must wrap routes after the demo-data runtime');
assert.ok(index.indexOf('assets/js/nepal-attendance-compliance.js') < index.indexOf('assets/js/demo-data-navigation-bootstrap.js'), 'Navigation bootstrap must run after compliance navigation is registered');

assert.match(docs, /Not an HRMS/, 'Documentation must preserve the product boundary');
assert.match(docs, /Clean-room adaptation/, 'Documentation must explain the source-code boundary');
assert.match(docs, /Nepal Labour Act 2074/, 'Documentation must identify the statutory foundation');
assert.match(docs, /not legal advice/i, 'Documentation must contain a legal-review disclaimer');
assert.match(docs, /separate connector/i, 'Documentation must explain the device-network connector boundary');

assert.match(packageJson.scripts.test, /nepal-attendance-compliance-audit\.mjs/, 'Static compliance audit must run in the standard test chain');
assert.match(packageJson.scripts['test:syntax'], /nepal-attendance-compliance\.js/, 'Compliance runtime syntax must run in CI');
assert.match(packageJson.scripts['test:syntax'], /nepal-attendance-compliance-audit\.mjs/, 'Compliance audit syntax must run in CI');

console.log('Nepal attendance compliance contracts passed for statutory guardrails, clean-room scope, idempotent imports, manual controls, holidays, Hajiri, evidence, fiscal safeguards, responsive behavior and documentation.');
