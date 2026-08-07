'use strict';

(() => {
  const HR = window.FormcraftHRMS;
  const ERP = window.FormcraftERP;
  const XLSX = window.FormcraftXLSX;
  const NP = window.FormcraftNepalComplianceCore;
  if (!HR || !ERP || !window.FormcraftERPUI) return;

  const MODULE_TABS = Object.freeze({
    employees: [
      ['records', 'Records'],
      ['organization', 'Organization'],
      ['device-identities', 'Device identities'],
      ['shifts', 'Shifts']
    ],
    attendance: [
      ['records', 'Records'],
      ['overview', 'Overview'],
      ['devices', 'Devices'],
      ['daily', 'Daily'],
      ['raw-punches', 'Raw punches'],
      ['monthly', 'Monthly'],
      ['absent', 'Absent'],
      ['departments', 'Departments'],
      ['hajiri', 'Hajiri'],
      ['pull-sessions', 'Pull sessions'],
      ['schedule', 'Schedule'],
      ['auto-attendance', 'Auto attendance'],
      ['audit', 'Audit']
    ],
    timeoff: [
      ['records', 'Records'],
      ['balances', 'Balances'],
      ['leave-types', 'Leave types'],
      ['holidays', 'Holidays'],
      ['holiday-types', 'Holiday types'],
      ['kaaj', 'Kaaj / field duty']
    ],
    payroll: [
      ['records', 'Records'],
      ['attendance-review', 'Attendance review'],
      ['payslips', 'Payslips'],
      ['salary-setup', 'Salary setup'],
      ['heads-deductions', 'Heads & deductions'],
      ['tax-slabs', 'Tax slabs'],
      ['fiscal-years', 'Fiscal years'],
      ['holiday-ot', 'Holiday OT'],
      ['annual-summary', 'Annual summary']
    ]
  });

  const esc = value => typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '');
  const money = value => {
    try { return new Intl.NumberFormat('en-NP', { style: 'currency', currency: state.erp?.settings?.currency || 'NPR', maximumFractionDigits: 2 }).format(HR.num(value)); }
    catch { return `NPR ${HR.round(value).toFixed(2)}`; }
  };
  const dateLabel = value => value ? (typeof dualDate === 'function' ? dualDate(value, { short: true }) : value) : '-';
  const status = value => `<span class="erp-status" data-status="${esc(String(value || 'draft').toLowerCase())}">${esc(String(value || 'draft').replaceAll('-', ' '))}</span>`;

  function uiState() {
    ui.hrms ||= {
      tabs: { employees: 'records', attendance: 'records', timeoff: 'records', payroll: 'records' },
      bridge: null,
      bridgeLoading: false,
      bridgeLoadedAt: 0,
      rawPunches: null,
      rawPunchesLoading: false,
      rawPunchesLoadedAt: 0,
      date: new Date().toLocaleDateString('en-CA', { timeZone: HR.TIME_ZONE }),
      bsYear: NP?.bsParts?.(new Date())?.year || '',
      bsMonth: NP?.bsParts?.(new Date())?.month || '',
      payrollRunId: '',
      fiscalYearId: '',
      auditQuery: ''
    };
    return ui.hrms;
  }

  function activeTab(moduleKey) {
    return uiState().tabs[moduleKey] || 'records';
  }

  function setTab(moduleKey, tab) {
    if (!MODULE_TABS[moduleKey]?.some(([key]) => key === tab)) return;
    uiState().tabs[moduleKey] = tab;
    renderShell();
  }

  function hasOpenRecord(moduleKey) {
    const params = new URLSearchParams(location.search);
    return (params.get('erp') === moduleKey && Boolean(params.get('record')))
      || ui.erp?.record?.moduleKey === moduleKey;
  }

  function tabsMarkup(moduleKey) {
    const active = activeTab(moduleKey);
    return `<nav class="hrms-tabs" aria-label="${esc(ERP.modulesByKey.get(moduleKey)?.label || moduleKey)} sections">
      ${MODULE_TABS[moduleKey].map(([key, label]) => `<button type="button" class="${active === key ? 'is-active' : ''}" data-hrms-tab="${esc(key)}" data-hrms-module="${esc(moduleKey)}" ${active === key ? 'aria-current="page"' : ''}>${esc(label)}</button>`).join('')}
    </nav>`;
  }

  function pageShell(moduleKey, content, options = {}) {
    const module = ERP.modulesByKey.get(moduleKey);
    return `<div class="content-shell page-stack hrms-shell" data-hrms-shell="${esc(moduleKey)}">
      <section class="hrms-extension-head">
        <div><p class="panel-kicker">Formcraft ${esc(module?.label || 'HRMS')}</p><h2>${esc(options.title || module?.label || 'HRMS')}</h2><p>${esc(options.description || 'Existing records stay unchanged. Advanced workforce capabilities are available in the additional tabs.')}</p></div>
        ${options.actions || ''}
      </section>
      ${tabsMarkup(moduleKey)}
      <div class="hrms-tab-panel" data-hrms-panel="${esc(activeTab(moduleKey))}">${content}</div>
    </div>`;
  }

  function recordsPage(moduleKey) {
    const module = ERP.modulesByKey.get(moduleKey);
    const original = window.FormcraftERPUI.renderModulePage(module);
    return `<div class="content-shell page-stack hrms-shell hrms-records-shell" data-hrms-shell="${esc(moduleKey)}">${tabsMarkup(moduleKey)}<div class="hrms-records-host">${original}</div></div>`;
  }

  function empty(title, copy, action = '') {
    return `<div class="erp-empty hrms-empty"><strong>${esc(title)}</strong><span>${esc(copy)}</span>${action}</div>`;
  }

  function metric(label, value, copy = '') {
    return `<article><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(copy)}</small></article>`;
  }

  function card(title, copy, body, actions = '') {
    return `<section class="erp-card hrms-card"><div class="erp-card-head"><div><p class="panel-kicker">${esc(copy)}</p><h2>${esc(title)}</h2></div>${actions}</div>${body}</section>`;
  }

  function hierarchyRows(tableName, parentName = '', parentKey = '') {
    const rows = HR.ensureState()[tableName];
    if (!rows.length) return empty(`No ${tableName.replace(/[A-Z]/g, m => ` ${m.toLowerCase()}`)} yet`, 'Create the hierarchy only as deeply as your organization needs.');
    return `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Name</th>${parentName ? `<th>${esc(parentName)}</th>` : ''}<th>Code</th><th>Updated</th><th></th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${esc(row.name)}</strong></td>${parentName ? `<td>${esc(HR.relationName(parentKey, row[parentKey.slice(0, -1) + 'Id'] || row[`${parentKey.replace(/s$/, '')}Id`], '-'))}</td>` : ''}<td>${esc(row.code || '-')}</td><td>${esc(dateLabel(row.updatedAt?.slice(0, 10)))}</td><td><button class="action-button" type="button" data-hrms-edit-hierarchy="${esc(tableName)}" data-id="${esc(row.id)}" aria-label="Edit ${esc(row.name)}">${icon('edit', 16)}</button></td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderOrganization() {
    const data = HR.ensureState();
    const employees = ERP.collection('employees').filter(item => !item.archived);
    const hierarchy = `<div class="hrms-grid hrms-grid-2">
      ${card('Directorates', 'Organization', hierarchyRows('directorates'), `<button class="button button-secondary button-small" type="button" data-hrms-add-hierarchy="directorates">${icon('plus', 15)}Add</button>`)}
      ${card('Departments', 'Organization', hierarchyRows('departments'), `<button class="button button-secondary button-small" type="button" data-hrms-add-hierarchy="departments">${icon('plus', 15)}Add</button>`)}
      ${card('Sections', 'Organization', hierarchyRows('sections'), `<button class="button button-secondary button-small" type="button" data-hrms-add-hierarchy="sections">${icon('plus', 15)}Add</button>`)}
      ${card('Units', 'Organization', hierarchyRows('units'), `<button class="button button-secondary button-small" type="button" data-hrms-add-hierarchy="units">${icon('plus', 15)}Add</button>`)}
    </div>`;
    const assignment = employees.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Employee</th><th>Current organization</th><th>Shift</th><th></th></tr></thead><tbody>${employees.map(employee => `<tr><td><strong>${esc(employee.name)}</strong><small>${esc(employee.employeeCode || '')}</small></td><td>${esc(HR.organizationPath(employee))}</td><td>${esc(HR.relationName('shifts', employee.hrmsShiftId, 'Unassigned'))}</td><td><button class="button button-secondary button-small" type="button" data-hrms-assign-org="${esc(employee.id)}">Assign</button></td></tr>`).join('')}</tbody></table></div>` : empty('No employees yet', 'Existing Employees records will appear here for organization assignment.');
    return pageShell('employees', `${hierarchy}${card('Employee assignments', `${employees.length} employees`, assignment)}`, { title: 'Organization structure', description: 'Extend existing employee records with directorate, department, section, unit, and shift context. No employee record is replaced.' });
  }

  function renderDeviceIdentities() {
    const snapshot = uiState().bridge;
    const links = HR.ensureState().employeeDeviceLinks;
    const employees = ERP.collection('employees');
    const body = !snapshot
      ? empty('Loading device identities', 'Formcraft is checking the optional local device bridge.')
      : snapshot.schemaMissing
        ? empty('Device bridge database is not installed yet', 'Existing employee records are unaffected. Apply the additive HRMS migration before connecting ZKTeco hardware.')
        : !snapshot.users?.length
          ? empty('No device users yet', 'Run a device pull from Attendance > Devices. Existing Employees remains your HR master directory.')
          : `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Device user</th><th>Device</th><th>Linked employee</th><th>Fingerprints</th><th></th></tr></thead><tbody>${snapshot.users.map(user => {
              const link = links.find(item => item.deviceId === user.device_id && String(item.deviceUserId) === String(user.device_user_id));
              const employee = employees.find(item => item.id === link?.employeeId);
              const device = snapshot.devices.find(item => item.id === user.device_id);
              return `<tr><td><strong>${esc(user.name || user.device_user_id)}</strong><small>ID ${esc(user.device_user_id || user.device_uid)}</small></td><td>${esc(device?.name || 'Device')}</td><td>${employee ? `<strong>${esc(employee.name)}</strong><small>${esc(employee.employeeCode || '')}</small>` : '<span class="hrms-muted">Unlinked</span>'}</td><td>${esc(user.fingerprint_count ?? 0)}</td><td><div class="hrms-row-actions"><button class="button button-secondary button-small" type="button" data-hrms-link-device-user="${esc(user.id)}">${employee ? 'Change link' : 'Link / import'}</button>${HR.canManage() ? `<button class="action-button" type="button" data-hrms-delete-device-user="${esc(user.id)}" aria-label="Delete device user ${esc(user.name || user.device_user_id)}">${icon('trash', 16)}</button>` : ''}</div></td></tr>`;
            }).join('')}</tbody></table></div>`;
    const actions = HR.canManage() && snapshot?.devices?.length ? `<div class="hrms-head-actions"><button class="button button-secondary" type="button" data-hrms-import-device-users>Import unlinked users</button><button class="button button-primary" type="button" data-hrms-sync-directory>Sync employee directory</button></div>` : '';
    return pageShell('employees', card('Device identities', 'ZKTeco mapping', body), { title: 'Device identities', description: 'Map biometric device IDs to the existing Employees directory. Device-side users never become a competing HR master record.', actions });
  }

  function renderShifts() {
    const data = HR.ensureState();
    const shifts = data.shifts.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Shift</th><th>Window</th><th>Grace</th><th>Break</th><th></th></tr></thead><tbody>${data.shifts.map(item => `<tr><td><strong>${esc(item.name)}</strong><small>${esc(item.code || '')}</small></td><td>${esc(item.startTime || '-')} - ${esc(item.endTime || '-')}</td><td>Late ${esc(item.graceLateIn || 0)}m / Early ${esc(item.graceEarlyOut || 0)}m</td><td>${esc(item.breakMinutes || 0)}m</td><td><button class="action-button" type="button" data-hrms-edit-shift="${esc(item.id)}">${icon('edit', 16)}</button></td></tr>`).join('')}</tbody></table></div>` : empty('No shifts configured', 'Add shifts, then assign them directly to employees or through organization rules.');
    const rules = data.shiftRules.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Shift</th><th>Scope</th><th>Effective dates</th><th></th></tr></thead><tbody>${data.shiftRules.map(rule => {
      const scope = rule.employeeId ? ERP.collection('employees').find(item => item.id === rule.employeeId)?.name
        : rule.unitId ? HR.relationName('units', rule.unitId)
          : rule.sectionId ? HR.relationName('sections', rule.sectionId)
            : rule.departmentId ? HR.relationName('departments', rule.departmentId)
              : rule.directorateId ? HR.relationName('directorates', rule.directorateId) : 'All employees';
      return `<tr><td>${esc(HR.relationName('shifts', rule.shiftId, '-'))}</td><td>${esc(scope || 'Unknown scope')}</td><td>${esc(rule.fromDate || 'Any')} - ${esc(rule.toDate || 'Open')}</td><td><button class="action-button" type="button" data-hrms-delete-record="shiftRules" data-id="${esc(rule.id)}">${icon('trash', 16)}</button></td></tr>`;
    }).join('')}</tbody></table></div>` : empty('No shift rules', 'Direct employee shift assignments work without rules. Rules are useful for departments, sections, and units.');
    return pageShell('employees', `<div class="hrms-grid hrms-grid-2">${card('Shifts', 'Working windows', shifts, `<button class="button button-secondary button-small" type="button" data-hrms-add-shift>${icon('plus', 15)}Add shift</button>`)}${card('Assignment rules', 'Scope and dates', rules, `<button class="button button-secondary button-small" type="button" data-hrms-add-shift-rule>${icon('plus', 15)}Add rule</button>`)}</div>`, { title: 'Shifts & rules', description: 'Reusable shift windows and organization-aware assignment rules extend existing employee and attendance records.' });
  }

  function todaySummary() {
    const date = uiState().date;
    const rows = HR.dailyReport(date);
    const present = rows.filter(item => item.status.code === 'P').length;
    const absent = rows.filter(item => item.status.code === 'A').length;
    const leave = rows.length - present - absent - rows.filter(item => ['SAT', 'PH', 'FH', 'NH', 'OH', 'H'].includes(item.status.code)).length;
    return { total: rows.length, present, absent, leave };
  }

  function renderAttendanceOverview() {
    const summary = todaySummary();
    const bridge = uiState().bridge;
    const bridgeStatus = bridge?.bridge ? (bridge.bridge.last_seen_at && Date.now() - new Date(bridge.bridge.last_seen_at).getTime() < 180000 ? 'Online' : 'Offline') : 'Not configured';
    const issues = window.FormcraftNepalCompliance?.audit?.()?.issues || [];
    const actions = HR.canManage() ? `<div class="hrms-head-actions"><button class="button button-secondary" type="button" data-hrms-manual-attendance>${icon('edit', 16)}Manual entry</button><button class="button button-secondary" type="button" data-hrms-import-attendance>${icon('plus', 16)}Import CSV / XLSX</button><button class="button button-primary" type="button" data-hrms-sync-bridge>${icon('activity', 16)}Sync bridge punches</button></div>` : '';
    return pageShell('attendance', `<section class="erp-summary-grid">${metric('Employees', summary.total, 'Active directory records')}${metric('Present today', summary.present, uiState().date)}${metric('Absent today', summary.absent, 'After leave and holiday rules')}${metric('Bridge', bridgeStatus, bridge?.bridge?.name || 'Optional LAN service')}</section><div class="hrms-grid hrms-grid-2">${card('Attendance pipeline', 'One source of truth', `<div class="hrms-process-list"><div><span>1</span><p><strong>Collect</strong><small>Device bridge, CSV, XLSX, or controlled manual entry.</small></p></div><div><span>2</span><p><strong>Normalize</strong><small>Nepal time, duplicate window, employee mapping, and device evidence.</small></p></div><div><span>3</span><p><strong>Materialize</strong><small>Existing Attendance records are updated rather than creating a second attendance app.</small></p></div><div><span>4</span><p><strong>Use</strong><small>Reports, leave, compliance, and payroll read the same daily records.</small></p></div></div>`)}${card('Current controls', 'Compliance status', issues.length ? `<div class="hrms-issue-list">${issues.slice(0, 8).map(item => `<article data-severity="${esc(item.severity)}"><strong>${esc(item.title)}</strong><span>${esc(item.detail)}</span></article>`).join('')}</div>` : '<div class="hrms-good-state">No current compliance findings.</div>')}</div>`, { title: 'Attendance overview', description: 'All advanced attendance features feed the existing Attendance module. The LAN bridge is optional and isolated from the rest of Formcraft.', actions });
  }

  function deviceCard(device, snapshot
  const live = device.last_seen_at && Date.now() - new Date(device.last_seen_at).getTime() < 300000;
    return `<article class="hrms-device-card">
      <header><span class="hrms-device-state ${blive ? 'is-online' : 'is-offline'}"></span><div><strong>${esc(device.name)}</strong><small>${esc(device.ip_address)}:${esc(device.port)} ${device.force_udp ? 'UDP' : 'TCP'}</small></div>${status(device.active ? (blive ? 'online' : 'offline') : 'inactive')}</header>
      <dl><div><dt>Model</dt><dd>${esc(device.model || '-')}</dd></div><div><dt>Last pull</dt><dd>${esc(device.last_pull_at ? new Date(device.last_pull_at).toLocaleString() : 'Never')}</dd></div><div><dt>Connection secret</dt><dd>${device.secret_configured ? 'Configured locally' : 'Not configured'}</dd></div><div><dt>Users</dt><dd>${snapshot.users.filter(item => item.device_id === device.id).length}</dd></div></dl>
      ${device.last_error ? `<p class="hrms-device-error">${esc(device.last_error)}</p>` : ''}
      ${HR.canManage() ? `<footer><button class="button button-secondary button-small" type="button" data-hrms-device-command="test" data-device-id="${esc(device.id)}">Test</button><button class="button button-secondary button-small" type="button" data-hrms-device-command="pull" data-device-id="${esc(device.id)}">Pull</button><button class="button button-secondary button-small" type="button" data-hrms-historical-pull="${esc(device.id)}">Historical</button><button class="button button-secondary button-small" type="button" data-hrms-device-command="backup" data-device-id="${esc(device.id)}">Backup</button><button class="action-button" type="button" data-hrms-set-device-secret="${esc(device.id)}" aria-label="Set connection secret">${icon('settings', 16)}</button><button class="action-button" type="button" data-hrms-edit-device="${esc(device.id)}" aria-label="Edit device">${icon('edit', 16)}</button><button class="action-button danger" type="button" data-hrms-delete-device="${esc(device.id)}" aria-label="Remove device">${icon('trash', 16)}</button></footer>` : ''}
    </article>`;
  }

  function renderDevices() {
    const snapshot = uiState().bridge;
    let body;
    if (!snapshot
 body = empty('Checking device bridge', 'This does not block attendance records or any other Formcraft module.');
    else if (snapshot.schemaMissing
 body = `<div class="hrms-setup-callout"><strong>Apply the additive HRMS bridge migration</strong><p>The hosted app is healthy, but direct ZKTeco connectivity needs the new isolated Supabase tables and bridge RPCs. Existing modules are untouched.</p></div>`;
    else if (!snapshot.bridge
 body = `<div class="hrms-setup-callout"><strong>No local bridge configured</strong><p>Formcraft canablready use imported and manual attendance. Create a bridge credential when you are ready to connect office ZKTeco devices.</p>${HR.canManage() ? '<button class="button button-primary" type="button" data-hrms-create-bridge>Create bridge credential</button>' : ''}</div>`;
    else body = `<section class="erp-summary-grid">${metric('Bridge', snapshot.bridge.name, snapshot.bridge.last_seen_at ? `Last seen ${new Date(snapshot.bridge.last_seen_at).toLocaleString()}` : 'Never connected')}${metric('Devices', snapshot.devices.length, `${snapshot.devices.filter(item => item.active).length} active`)}${metric('Device users', snapshot.users.length, 'Mapped separately from HR master')}${metric('Pull sessions', snapshot.sessions.length, 'Recent history loaded')}</section>${snapshot.devices.length ? `<div class="hrms-device-grid">${snapshot.devices.map(device => deviceCard(device, snapshot
).join('')}</div>` : empty('No devices registered', 'Add your first ZKTeco reader. Its communication secret stays on the local bridge, not in browser code.')}`;
    const actions = HR.canManage() && snapshot?.bridge && !snapshot.schemaMissing ? `<div class="hrms-head-actions"><button class="button button-secondary" type="button" data-hrms-migrate-device-users>${icon('team', 16)}Migrate users</button><button class="button button-primary" type="button" data-hrms-add-device>${icon('plus', 16)}Add device</button></div>` : '';
    return pageShell('attendance', body, { title: 'Device center', description: 'Manage ZKTeco readers through the optional local Formcraft bridge. Device failures degrade only biometric sync, never the hosted ERP.', actions });
  }

  function renderDaily() {
    const rows = HR.dailyReport(uiState().date);
    const body = rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Employee</th><th>Organization</th><th>Shift</th><th>Status</th><th>Check in</th><th>Check out</th><th>Hours</th><th>OT</th><th>Late</th><th>Early out</th><th>Remark</th><th></th></tr></thead><tbody>${rows.map(row => { const remark = HR.dayRemarkFor(row.employee.id, uiState().date); return `<tr><td><strong>${esc(row.employee.name)}</strong><small>${esc(row.employee.employeeCode || '')}</small></td><td>${esc(row.organization)}</td><td>${esc(row.shift?.name || '-')}</td><td>${status(row.status.label)}</td><td>${esc(row.checkIn || '-')}</td><td>${esc(row.checkOut || '-')}</td><td>${esc(row.hours)}</td><td>${esc(row.overtime)}</td><td>${esc(row.lateMinutes)}m</td><td>${esc(row.earlyMinutes)}m</td><td>${esc(remark?.remarkText || '-')}</td><td>${HR.canEdit() ? `<button class="action-button" type="button" data-hrms-day-remark="${esc(row.employee.id)}" data-date="${esc(uiState().date)}" aria-label="Add attendance remark for ${esc(row.employee.name)}">${icon('edit', 16)}</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>` : empty('No employees', 'Existing Employees records are needed before a daily attendance report canabe produced.');
    const actions = `<div class="hrms-head-actions"><label class="hrms-inline-field"><span>Date</span><input type="date" data-hrms-report-date value="${esc(uiState().date)}"></label><button class="button button-secondary" type="button" data-hrms-export="daily" data-format="csv">CSV</button><button class="button button-secondary" type="button" data-hrms-export="daily" data-format="xls">Excel</button><button class="button button-secondary" type="button" data-hrms-print="daily">Print / PDF</button></div>`;
    return pageShell('attendance', card('Daily attendance', dateLabel(uiState().date), body), { title: 'Daily attendance report', description: 'Present, absent, leave, punches, working time, and overtime for one Nepal-time work date.', actions });
  }

  function renderRawPunches() {
    const snapshot = uiState().rawPunches;
    let body;
    if (!snapshot
 body = empty('Loading raw punches', 'The reader event log is loaded separately from the existing Attendance records.');
    else if (snapshot.schemaMissing
 body = empty('Device bridge schema is not installed', 'Existing Attendance continues to work. Apply the additive bridge migration to use raw biometric logs.');
    else if (snapshot.error) body = `<div class="hrms-setup-callout"><strong>Raw punches could not be loaded</strong><p>${esc(snapshot.error.message || String(snapshot.error))}</p></div>`;
    else if (!snapshot.rows.length) body = empty('No raw biometric punches', 'Pull a device or import attendance. Existing manual and file-imported Attendance records remain under Records.');
    else body = `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Time</th><th>BS date</th><th>Employee</th><th>Device</th><th>UID</th><th>Punch</th><th>Source</th><th>Received</th></tr></thead><tbody>${snapshot.rows.map(row => `<tr><td><strong>${esc(new Date(row.punched_at).toLocaleString())}</strong></td><td>${esc(NP?.bsLabel?.(row.punched_at) || '-')}</td><td>${esc(row.employee_name || row.device_user_id || '-')}</td><td>${esc(row.hrms_devices?.name || row.device_id || '-')}</td><td>${esc(row.device_user_id || row.device_uid || '-')}</td><td>${esc(row.punch_label || (row.punch_code ?? '-'))}</td><td>${status(row.source || 'device')}</td><td>${esc(row.received_at ? new Date(row.received_at).toLocaleString() : '-')}</td></tr>`).join('')}</tbody></table></div>`;
    const actions = `<div class="hrms-head-actions"><button class="button button-secondary" type="button" data-hrms-refresh-punches>${icon('activity', 16)}Refresh</button>${HR.canManage() ? `<button class="button button-primary" type="button" data-hrms-sync-bridge>${icon('check', 16)}Materialize to Attendance</button>` : ''}</div>`;
    return pageShell('attendance', card('Raw punch log', snapshot?.rows?.length ? `${snapshot.rows.length} latest events` : 'Device evidence', body), { title: 'Raw punches', description: 'Immutable reader events remain distinct from daily Attendance records. Physical and automatic-attendance sources are clearly tagged.', actions });
  }

  function monthControls() {
    return `<div class="hrms-head-actions"><label class="hrms-inline-field"><span>BS year</span><input type="number" min="2000" max="2200" data-hrms-bs-year value="${esc(uiState().bsYear)}"></label><label class="hrms-inline-field"><span>BS month</span><select data-hrms-bs-month>${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}" ${Number(uiState().bsMonth) === index + 1 ? 'selected' : ''}>${index + 1}</option>`).join('')}</select></label></div>`;
  }

  function renderMonthly() {
    const report = HR.monthlyReport(uiState().bsYear, uiState().bsMonth);
    const departments = HR.departmentSummary(uiState().bsYear, uiState().bsMonth);
    const body = `<section class="erp-summary-grid">${metric('Employees', report.rows.length, report.range.label)}${metric('Present days', report.rows.reduce((sum, row) => sum + row.present, 0), 'All employees')}${metric('Absent days', report.rows.reduce((sum, row) => sum + row.absent, 0), 'After leave and holidays')}${metric('Overtime', `${HR.round(report.rows.reduce((sum, row) => sum + row.overtimeHours, 0))} h`, 'Recorded overtime')}</section>${card('Employee detail', report.range.label, report.rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Employee</th><th>Emp ID</th><th>Department</th><th>Shift</th><th>Planned</th><th>Actual</th><th>Present</th><th>Leave</th><th>Kaaj</th><th>Absent</th><th>Weekly off</th><th>Holiday</th><th>Work hours</th><th>OT hours</th><th>Late days</th><th>Late min</th><th>Early days</th><th>Early min</th></tr></thead><tbody>${report.rows.map(row => `<tr><td><strong>${esc(row.employee.name)}</strong></td><td>${esc(row.employee.employeeCode || '')}</td><td>${esc(row.organization)}</td><td>${esc(HR.shiftForEmployee(row.employee, report.range.start)?.name || 'Unassigned')}</td><td>${row.plannedDays}</td><td>${row.actualDays}</td><td>${row.present}</td><td>${row.leave}</td><td>${row.kaaj || 0}</td><td>${row.absent}</td><td>${row.weeklyOff}</td><td>${row.holidays}</td><td>${esc(row.workHours)}</td><td>${esc(row.overtimeHours)}</td><td>${row.lateDays}</td><td>${row.lateMinutes}</td><td>${row.earlyDays}</td><td>${row.earlyMinutes}</td></tr>`).join('')}</tbody></table></div>` : empty('No monthly rows', 'Add employees to build this report.'))}${card('Department summary', `${departments.length} groups`, departments.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Department</th><th>Employees</th><th>Present</th><th>Leave</th><th>Kaaj</th><th>Absent</th><th>OT</th></tr></thead><tbody>${departments.map(row => `<tr><td><strong>${esc(row.name)}</strong></td><td>${row.employees}</td><td>${row.present}</td><td>${row.leave}</td><td>${row.kaaj || 0}</td><td>${row.absent}</td><td>${row.overtimeHours} h</td></tr>`).join('')}</tbody></table></div>` : empty('No departments', 'Department summary appears after employee organization data is available.'))}`;
    const actions = `${monthControls()}<div class="hrms-head-actions"><button class="button button-secondary" type="button" data-hrms-export="monthly" data-format="csv">CSV</button><button class="button button-secondary" type="button" data-hrms-export="monthly" data-format="xls">Excel</button><button class="button button-secondary" type="button" data-hrms-print="monthly">Print / PDF</button></div>`;
    return pageShell('attendance', body, { title: 'Monthly attendance', description: 'Monthly present, leave, absence, weekly-off, holiday, overtime, late and early-out summaries from the same Attendance records.', actions });
  }

  function renderAbsent() {
    const rows = HR.absentReport(uiState().bsYear, uiState().bsMonth);
    const body = rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Date</th><th>Employee</th><th>Organization</th><th>BS date</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.date)}</td><td><strong>${esc(row.employee.name)}</strong><small>${esc(row.employee.employeeCode || '')}</small></td><td>${esc(row.organization)}</td><td>${esc(NP?.bsLabel?.(row.date) || '-')}</td></tr>`).join('')}</tbody></table></div>` : empty('No absences in this month', 'Absence is evaluated after approved leave, weekly off and holiday rules.');
    const actions = `${monthControls()}<div class="hrms-head-actions"><button class="button button-secondary" type="button" data-hrms-export="absent" data-format="csv">CSV</button><button class="button button-secondary" type="button" data-hrms-export="absent" data-format="xls">Excel</button></div>`;
    return pageShell('attendance', card('Absent report', `${rows.length} absent day${rows.length === 1 ? '' : 's'}`, body), { title: 'Absent report', description: 'Day-wise absence after leave, holidays and weekly-off rules have been applied.', actions });
  }

  function renderDepartments() {
    const rows = HR.departmentSummary(uiState().bsYear, uiState().bsMonth);
    const body = rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Department</th><th>Employees</th><th>Present</th><th>Leave</th><th>Absent</th><th>OT hours</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${esc(row.name)}</strong></td><td>${row.employees}</td><td>${row.present}</td><td>${row.leave}</td><td>${row.absent}</td><td>${row.overtimeHours}</td></tr>`).join('')}</tbody></table></div>` : empty('No department attendance yet', 'Assign employees to departments to build the department drill-down report.');
    const actions = `${monthControls()}<div class="hrms-head-actions"><button class="button button-secondary" type="button" data-hrms-export="departments" data-format="csv">CSV</button><button class="button button-secondary" type="button" data-hrms-export="departments" data-format="xls">Excel</button></div>`;
    return pageShell('attendance', card('Department attendance', `${rows.length} department${rows.length === 1 ? '' : 's'}`, body), { title: 'Department attendance', description: 'Monthly presence, leave, absence and overtime aggregated by the employee organization structure.', actions });
  }

  function renderHajiri() {
    const report = HR.monthlyReport(uiState().bsYear, uiState().bsMonth);
    const head = report.dates.map(date => `<th title="${esc(dateLabel(date))}">${esc(NP?.bsParts?.(date)?.day || date.slice(-2))}</th>`).join('');
    const body = report.rows.length ? `<div class="hrms-hajiri-wrap"><table class="hrms-hajiri"><thead><tr><th class="is-sticky">Employee</th>${head}<th>P</th><th>L</th><th>A</th><th>OT</th></tr></thead><tbody>${report.rows.map(row => `<tr><th class="is-sticky"><strong>${esc(row.employee.name)}</strong><small>${esc(row.employee.employeeCode || '')}</small></th>${row.cells.map(cell => `<td title="${esc(`${cell.date}: ${cell.status.label}`)}" data-code="${esc(cell.status.code)}">${esc(cell.status.display || cell.status.code)}</td>`).join('')}<td>${row.present}</td><td>${row.leave}</td><td>${row.absent}</td><td>${row.overtimeHours}</td></tr>`).join('')}</tbody></table></div>` : empty('No Hajiri rows', 'Existing employee records will form the rows of the register.');
    const actions = `${monthControls()}<div class="hrms-head-actions"><button class="button button-secondary" type="button" data-hrms-export="hajiri" data-format="csv">CSV</button><button class="button button-secondary" type="button" data-hrms-export="hajiri" data-format="xls">Excel</button><button class="button button-primary" type="button" data-hrms-print="hajiri">Print A3 / PDF</button></div>`;
    return pageShell('attendance', card('Hajiri register', report.range.label, body), { title: 'Hajiri register', description: 'Traditional cross-tab attendance register with present, leave, absence, holiday and weekly-off codes.', actions });
  }

  function renderPullSessions() {
    const snapshot = uiState().bridge;
    const sessions = snapshot?.sessions || [];
    const body = !snapshot ? empty('Loading pull history', 'Checking the device bridge.') : snapshot.schemaMissing ? empty('Bridge schema not installed', 'Pull history becomes available after the additive bridge migration is applied.') : sessions.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Started</th><th>Device</th><th>Status</th><th>Rows</th><th>New</th><th>Duration</th><th>Error</th></tr></thead><tbody>${sessions.map(item => {
      const device = snapshot.devices.find(device => device.id === item.device_id);
      const duration = item.completed_at ? Math.max(0, Math.round((new Date(item.completed_at) - new Date(item.started_at)) / 1000)) : '-';
      return `<tr><td>${esc(new Date(item.started_at).toLocaleString())}</td><td>${esc(device?.name || 'Device')}</td><td>${status(item.status)}</td><td>${esc(item.records_pulled || 0)}</td><td>${esc(item.new_inserts || 0)}</td><td>${esc(duration)}${duration === '-' ? '' : 's'}</td><td>${item.error_message ? `<details><summary>${esc(item.error_message)}</summary><pre>${esc(item.error_detail || '')}</pre></details>` : '-'}</td></tr>`;
    }).join('')}</tbody></table></div>` : empty('No pull sessions yet', 'Scheduled and manual device pulls will appear here with full diagnostics.');
    return pageShell('attendance', card('Pull sessions', 'Device diagnostics', body), { title: 'Pull sessions', description: 'Every device pull records timing, row counts, inserts, status, and diagnostic errors without affecting unrelated modules.' });
  }

  function renderSchedule() {
    const times = HR.arr(HR.ensureState().bridge.scheduleTimes);
    const snapshot = uiState().bridge;
    const body = `<div class="hrms-schedule-card"><div><strong>Asia/Kathmandu schedule</strong><p>The local bridge runs these pull times. Changes are queued to the bridge and do not change Netlify or other Formcraft jobs.</p></div><div class="hrms-time-chips">${times.length ? times.map(time => `<span>${esc(time)}<button type="button" data-hrms-remove-schedule="${esc(time)}" aria-label="Remove ${esc(time)}">${icon('close', 14)}</button></span>`).join('') : '<span class="is-empty">No scheduled pulls</span>'}</div>${HR.canManage() ? `<div class="hrms-head-actions"><input type="time" data-hrms-new-schedule-time><button class="button button-primary" type="button" data-hrms-add-schedule>Add time</button></div>` : ''}<small>Bridge status: ${esc(snapshot?.bridge?.last_seen_at ? `last seen ${new Date(snapshot.bridge.last_seen_at).toLocaleString()}` : 'not connected')}</small></div>`;
    return pageShell('attendance', card('Automatic pulls', `${times.length} scheduled time${times.length === 1 ? '' : 's'}`, body), { title: 'Pull schedule', description: 'Multiple Nepal-time device pulls per day, applied by the LAN bridge without restarting the hosted application.' });
  }

  function renderAudit() {
    const query = String(uiState().auditQuery || '').toLowerCase();
    const rows = HR.combinedAudit().filter(item => !query || `${item.tableName} ${item.action} ${item.detail} ${item.changedBy} ${item.recordId}`.toLowerCase().includes(query)).slice(0, 1000);
    const body = rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>When</th><th>Area</th><th>Action</th><th>Record</th><th>User</th><th>Change</th></tr></thead><tbody>${rows.map(item => `<tr><td>${esc(item.changedAt ? new Date(item.changedAt).toLocaleString() : '-')}</td><td>${esc(item.tableName)}</td><td>${esc(item.action)}</td><td>${esc(item.recordId || '-')}</td><td>${esc(item.changedBy || '-')}</td><td><details><summary>${esc(item.detail || 'View details')}</summary><div class="hrms-audit-diff"><pre>${esc(JSON.stringify(item.oldData, null, 2))}</pre><pre>${esc(JSON.stringify(item.newData, null, 2))}</pre></div></details></td></tr>`).join('')}</tbody></table></div>` : empty('No audit entries match', 'HRMS configuration changes, attendance controls, and record audit events appear here.');
    const actions = `<label class="search-control hrms-audit-search">${icon('search', 16)}<input type="search" data-hrms-audit-search value="${esc(uiState().auditQuery || '')}" placeholder="Filter table, action, user or record"></label>`;
    return pageShell('attendance', card('HRMS audit log', `${rows.length} entries shown`, body), { title: 'Audit log', description: 'Combined before/after HRMS configuration history plus existing Attendance, Employees, Time Off and Payroll record audit events.', actions });
  }

  function renderLeaveBalances() {
    const data = HR.ensureState();
    const employees = ERP.collection('employees').filter(item => item.status !== 'inactive' && !item.archived);
    const types = data.leaveTypes.filter(item => item.active !== false);
    const year = uiState().bsYear || NP?.bsParts?.(new Date())?.year || '';
    if (!types.length) return pageShell('timeoff', empty('No leave types configured', 'Add leave types first. Existing Time Off records remain available under Records.', '<button class="button button-primary" type="button" data-hrms-tab="leave-types" data-hrms-module="timeoff">Configure leave types</button>'), { title: 'Leave balances', description: 'Opening balance, earned days, taken days and available balance by employee and BS year.' });
    const rows = employees.flatMap(employee => types.map(type => ({ employee, type, balance: HR.resolvedLeaveBalance(employee.id, type.id, year), saved: HR.balanceFor(employee.id, type.id, year) })));
    const body = rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Employee</th><th>Leave type</th><th>BS year</th><th>Opening</th><th>Earned / allocated</th><th>Taken</th><th>Available</th><th></th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${esc(row.employee.name)}</strong><small>${esc(row.employee.employeeCode || '')}</small></td><td>${esc(row.type.name)}</td><td>${esc(year)}</td><td>${row.balance.opening}</td><td>${row.balance.earned}</td><td>${row.balance.taken}</td><td><strong>${row.balance.available}</strong></td><td>${HR.canEdit() ? `<button class="action-button" type="button" data-hrms-edit-leave-balance data-employee-id="${esc(row.employee.id)}" data-leave-type-id="${esc(row.type.id)}">${icon('edit', 16)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('No employees', 'Leave balances become available when Employees records exist.');
    return pageShell('timeoff', card('Employee balances', `BS ${year}`, body), { title: 'Leave balances', description: 'Opening balances and annual allocations extend the existing Time Off requests without creating a parallel leave workflow.', actions: `<label class="hrms-inline-field"><span>BS year</span><input type="number" data-hrms-bs-year value="${esc(year)}"></label>` });
  }

  function renderLeaveTypes() {
    const rows = HR.ensureState().leaveTypes;
    const body = rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Type</th><th>Code</th><th>Applies to</th><th>Days / year</th><th>Carry forward</th><th>Max accumulate</th><th>Paid</th><th>Half day</th><th></th></tr></thead><tbody>${rows.map(item => `<tr><td><strong>${esc(item.name)}</strong><small>${esc(item.displayCode || '')}</small></td><td>${esc(item.code || '-')}</td><td>${esc(item.appliesTo || 'ALL')}</td><td>${esc(item.daysPerYear ?? 0)}</td><td>${item.carryForward ? 'Yes' : 'No'}</td><td>${esc(item.maxAccumulate ?? 0)}</td><td>${item.isPaid === false ? 'No' : 'Yes'}</td><td>${item.halfDayAllowed ? 'Yes' : 'No'}</td><td>${HR.canManage() ? `<button class="action-button" type="button" data-hrms-edit-leave-type="${esc(item.id)}">${icon('edit', 16)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('No leave types configured', 'Create organization policy types. Nothing is auto-allocated or silently treated as a statutory entitlement.');
    return pageShell('timeoff', card('Leave type catalog', `${rows.length} configured`, body, HR.canManage() ? `<button class="button button-primary button-small" type="button" data-hrms-add-leave-type>${icon('plus', 15)}Add type</button>` : ''), { title: 'Leave types', description: 'Configurable leave categories, display codes, annual allocation, carry-forward, paid status and half-day rules.' });
  }

  function renderHolidays() {
    const rows = HR.arr(state.erp?.nepalCompliance?.holidays);
    const types = HR.ensureState().holidayTypes;
    const typeName = item => types.find(type => type.id === item.holidayTypeId)?.name || item.type || 'public';
    const body = rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Date</th><th>BS date</th><th>Holiday</th><th>Type</th><th>Paid</th><th>Source</th><th></th></tr></thead><tbody>${rows.map(item => `<tr><td>${esc(item.dateAd)}</td><td>${esc(item.dateBs || NP?.bsLabel?.(item.dateAd) || '-')}</td><td><strong>${esc(item.name)}</strong></td><td>${esc(typeName(item))}</td><td>${item.paid === false ? 'No' : 'Yes'}</td><td>${esc(item.source || '-')}</td><td>${HR.canManage() ? `<button class="action-button" type="button" data-hrms-delete-holiday="${esc(item.id)}">${icon('trash', 16)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('Holiday calendar is empty', 'Add applicable holidays before relying on absence, payroll or substitute-leave calculations.');
    return pageShell('timeoff', card('Holiday calendar', `${rows.length} dates`, body, HR.canManage() ? `<button class="button button-primary button-small" type="button" data-hrms-add-holiday>${icon('plus', 15)}Add holiday</button>` : ''), { title: 'Holidays', description: 'The same holiday calendar is used by attendance, Hajiri, leave evaluation, compensatory leave and payroll.' });
  }

  function renderHolidayTypes() {
    const rows = HR.ensureState().holidayTypes;
    const body = rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Name</th><th>Code</th><th>Display color</th><th>Sort</th><th></th></tr></thead><tbody>${rows.map(item => `<tr><td><strong>${esc(item.name)}</strong></td><td>${esc(item.typeCode || '')}</td><td><span class="hrms-color-chip" style="--chip:${esc(item.colorCode || '#64748b')}"></span>${esc(item.colorCode || '')}</td><td>${esc(item.sortOrder ?? 0)}</td><td>${HR.canManage() ? `<button class="action-button" type="button" data-hrms-edit-holiday-type="${esc(item.id)}">${icon('edit', 16)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('No custom holiday types', 'Built-in public, festival, national, optional and other categories continue to work. Add organization-specific types only when needed.');
    return pageShell('timeoff', card('Holiday type catalog', `${rows.length} custom type${rows.length === 1 ? '' : 's'}`, body, HR.canManage() ? `<button class="button button-primary button-small" type="button" data-hrms-add-holiday-type>${icon('plus', 15)}Add holiday type</button>` : ''), { title: 'Holiday types', description: 'Optional organization-specific holiday classifications extend the existing shared holiday calendar.' });
  }

  function renderAutoAttendance() {
    const rows = HR.ensureState().autoAttendRules;
    const devices = uiState().bridge?.devices || [];
    const body = rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Employee</th><th>Devices</th><th>Check in</th><th>Check out</th><th>Days</th><th>Source</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(rule => { const employee = ERP.collection('employees').find(item => item.id === rule.employeeId); const names = HR.arr(rule.deviceIds).map(id => devices.find(item => item.id === id)?.name || id).join(', '); return `<tr><td><strong>${esc(employee?.name || 'Unknown employee')}</strong><small>${esc(employee?.employeeCode || employee?.attendanceId || '')}</small></td><td>${esc(names || 'No device')}</td><td>${esc(rule.checkinStart || '-')}-${esc(rule.checkinEnd || '-')}<small>Run ${esc(rule.checkinSchedule || '-')}</small></td><td>${esc(rule.checkoutStart || '-')}-${esc(rule.checkoutEnd || '-')}<small>Run ${esc(rule.checkoutSchedule || '-')}</small></td><td>${esc(HR.arr(rule.days).join(', '))}</td><td>${esc(rule.sourceTag || 'auto_attend')}</td><td>${status(rule.active === false ? 'inactive' : 'active')}</td><td>${HR.canManage() ? `<button class="action-button" type="button" data-hrms-edit-auto-attend="${esc(rule.id)}">${icon('edit', 16)}</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>` : empty('No automatic-attendance rules', 'Create explicit, audited rules only for approved use cases. Generated punches are source-tagged and never masquerade as reader punches.');
    const actions = HR.canManage() ? `<div class="hrms-head-actions"><button class="button button-secondary" type="button" data-hrms-push-auto-attend>Push rules to bridge</button><button class="button button-primary" type="button" data-hrms-add-auto-attend>${icon('plus',16)}Add rule</button></div>` : '';
    return pageShell('attendance', card('Automatic attendance rules', `${rows.length} rule${rows.length === 1 ? '' : 's'}`, body), { title: 'Automatic attendance', description: 'Scheduled, source-tagged attendance generation for explicitly approved rules. Every generated punch remains distinguishable from physical-reader evidence.', actions });
  }

  function renderKaaj() {
    const data = HR.ensureState();
    const rows = data.kaajRecords;
    const body = rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Date</th><th>Employee</th><th>Paid</th><th>Reason</th><th>Approved by</th><th></th></tr></thead><tbody>${rows.map(item => `<tr><td>${esc(item.adDate)}<small>${esc(item.bsDate || NP?.bsLabel?.(item.adDate) || '')}</small></td><td>${esc(ERP.collection('employees').find(employee => employee.id === item.employeeId)?.name || 'Unknown employee')}</td><td>${item.isPaid === false ? 'No' : 'Yes'}</td><td>${esc(item.reason || '-')}</td><td>${esc(item.approvedBy || '-')}</td><td>${HR.canEdit() ? `<button class="action-button" type="button" data-hrms-edit-kaaj="${esc(item.id)}">${icon('edit', 16)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('No Kaaj / field duty records', 'Create paid or unpaid field-duty classifications without turning them into leave entitlements.');
    return pageShell('timeoff', card('Kaaj / field duty', `${rows.length} records`, body, HR.canEdit() ? `<button class="button button-primary button-small" type="button" data-hrms-add-kaaj>${icon('plus', 15)}Add Kaaj</button>` : ''), { title: 'Kaaj / field duty', description: 'Operational duty classification linked to existing employees and attendance, separate from leave entitlement.' });
  }

  function payrollMonthReport() {
    return HR.monthlyReport(uiState().bsYear, uiState().bsMonth);
  }

  function renderPayrollAttendance() {
    const report = payrollMonthReport();
    const rows = report.rows.map(row => {
      const snap = HR.attendanceSnapshot(row.employee, report.range);
      return { ...row, snap };
    });
    const body = rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Employee</th><th>Working</th><th>Present</th><th>Paid leave</th><th>Unpaid leave</th><th>Paid Kaaj</th><th>Unpaid Kaaj</th><th>Absent</th><th>Regular OT</th><th>Holiday OT</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${esc(row.employee.name)}</strong><small>${esc(row.employee.employeeCode || '')}</small></td><td>${row.snap.workingDays}</td><td>${row.snap.presentDays}</td><td>${row.snap.paidLeaveDays}</td><td>${row.snap.unpaidLeaveDays}</td><td>${row.snap.kaajPaidDays || 0}</td><td>${row.snap.kaajUnpaidDays || 0}</td><td>${row.snap.absentDays}</td><td>${HR.round(row.snap.regularOtMinutes / 60)}h</td><td>${HR.round(row.snap.holidayOtMinutes / 60)}h</td></tr>`).join('')}</tbody></table></div>` : empty('No employees available', 'Attendance review uses the existing employee and attendance records.');
    const actions = `${monthControls()}${HR.canManage() ? '<button class="button button-primary" type="button" data-hrms-generate-payroll>Generate payroll</button>' : ''}`;
    return pageShell('payroll', card('Pre-generation attendance', report.range.label, body), { title: 'Attendance for payroll', description: 'Review the exact attendance snapshot that payroll will persist before a run is generated.', actions });
  }

  function renderPayslips() {
    const data = HR.ensureState();
    const runs = ERP.collection('payroll').filter(item => item.hrmsManaged || HR.payrollItemsForRun(item.id).length);
    const selected = uiState().payrollRunId || runs[0]?.id || '';
    const items = selected ? HR.payrollItemsForRun(selected) : [];
    const body = !runs.length ? empty('No generated HRMS payroll runs', 'Use Attendance review to generate a run. Existing simple Payroll records remain under Records.') : `<div class="hrms-payroll-run-select"><label class="hrms-field"><span>Payroll run</span><select data-hrms-payroll-run>${runs.map(run => `<option value="${esc(run.id)}" ${run.id === selected ? 'selected' : ''}>${esc(run.name)}</option>`).join('')}</select></label></div>${items.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Employee</th><th>Gross</th><th>Tax</th><th>Deductions</th><th>Net</th><th></th></tr></thead><tbody>${items.map(item => `<tr><td><strong>${esc(item.employeeName)}</strong><small>${esc(item.employeeCode || '')}</small></td><td>${esc(money(item.gross))}</td><td>${esc(money(item.tax))}</td><td>${esc(money(HR.num(item.pretaxDeductions) + HR.num(item.postTaxDeductions)))}</td><td><strong>${esc(money(item.netPay))}</strong></td><td><button class="button button-secondary button-small" type="button" data-hrms-open-payslip data-run-id="${esc(item.runId)}" data-employee-id="${esc(item.employeeId)}">Payslip</button></td></tr>`).join('')}</tbody></table></div>` : empty('No payslips in this run', 'The selected run has no persisted employee items.')}`;
    return pageShell('payroll', card('Payslips', `${items.length} employees`, body, items.length ? `<button class="button button-secondary button-small" type="button" data-hrms-print-run="${esc(selected)}">Print all / PDF</button>` : ''), { title: 'Payslips', description: 'Immutable per-employee earnings, deductions, attendance snapshot and tax formula transparency for generated runs.' });
  }

  function renderSalarySetup() {
    const data = HR.ensureState();
    const employees = ERP.collection('employees').filter(item => item.status !== 'inactive' && !item.archived);
    const body = employees.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Employee</th><th>Base salary</th><th>Daily hours</th><th>OT multiplier</th><th>Marital tax set</th><th>Heads</th><th>Deductions</th><th></th></tr></thead><tbody>${employees.map(employee => {
      const structure = data.salaryStructures.find(item => item.employeeId === employee.id) || {};
      const heads = data.employeeHeads.filter(item => item.employeeId === employee.id && item.active !== false).length;
      const deductions = data.employeeDeductions.filter(item => item.employeeId === employee.id && item.isEnrolled !== false).length;
      return `<tr><td><strong>${esc(employee.name)}</strong><small>${esc(employee.employeeCode || '')}</small></td><td>${esc(money(employee.salary || 0))}</td><td>${esc(structure.dailyHours || 8)}</td><td>${esc(structure.otMultiplier || 1.5)}x</td><td>${esc(structure.maritalStatus || 'ALL')}</td><td>${heads || (employee.salary ? 'Base fallback' : 0)}</td><td>${deductions}</td><td>${HR.canManage() ? `<button class="button button-secondary button-small" type="button" data-hrms-edit-salary="${esc(employee.id)}">Configure</button>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div>` : empty('No employees', 'Existing Employees records provide payroll identities and base salary fallback.');
    return pageShell('payroll', card('Employee salary setup', `${employees.length} employees`, body), { title: 'Salary structures', description: 'Extend existing employee base salary with daily hours, OT policy, earnings heads and statutory deduction enrollment.' });
  }

  function renderHeadsDeductions() {
    const data = HR.ensureState();
    const heads = data.salaryHeads.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Code</th><th>Name</th><th>Calculation</th><th>Frequency</th><th>Default</th><th></th></tr></thead><tbody>${data.salaryHeads.map(item => `<tr><td>${esc(item.code)}</td><td><strong>${esc(item.name)}</strong></td><td>${esc(item.calcType || 'fixed')}${item.calcType === 'percent_of_basic' ? ` ${esc(item.percentOfBasic || 0)}%` : ''}</td><td>${esc(item.frequency || 'monthly')}</td><td>${esc(money(item.defaultAmount || 0))}</td><td>${HR.canManage() ? `<button class="action-button" type="button" data-hrms-edit-salary-head="${esc(item.id)}">${icon('edit', 16)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('No salary heads', 'Employee base salary canastill act as Basic. Add configurable earning heads for allowances, annual, festival or one-time pay.');
    const deductions = data.deductionTypes.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Code</th><th>Name</th><th>Calculation</th><th>Pre-tax</th><th>Default</th><th></th></tr></thead><tbody>${data.deductionTypes.map(item => `<tr><td>${esc(item.code)}</td><td><strong>${esc(item.name)}</strong></td><td>${esc(item.calcType || 'fixed')}${item.calcType === 'percent_of_basic' ? ` ${esc(item.percentOfBasic || 0)}%` : ''}</td><td>${item.isPretax ? 'Yes' : 'No'}</td><td>${esc(money(item.defaultAmount || 0))}</td><td>${HR.canManage() ? `<button class="action-button" type="button" data-hrms-edit-deduction-type="${esc(item.id)}">${icon('edit', 16)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('No deduction types', 'Add PF, CIT, insurance or organization-specific deductions as configurable catalog rows.');
    return pageShell('payroll', `<div class="hrms-grid hrms-grid-2">${card('Salary heads', `${data.salaryHeads.length} catalog rows`, heads, HR.canManage() ? '<button class="button button-secondary button-small" type="button" data-hrms-add-salary-head>Add head</button>' : '')}${card('Deduction types', `${data.deductionTypes.length} catalog rows`, deductions, HR.canManage() ? '<button class="button button-secondary button-small" type="button" data-hrms-add-deduction-type>Add deduction</button>' : '')}</div>`, { title: 'Heads & deductions', description: 'Catalog-driven earnings and deductions. New types are configuration rows, not schema changes.' });
  }

  function renderTaxSlabs() {
    const data = HR.ensureState();
    const years = data.fiscalYears;
    const body = data.taxSlabSets.length ? `<div class="hrms-tax-set-list">${data.taxSlabSets.map(set => {
      const year = years.find(item => item.id === set.fiscalYearId);
      return `<article class="hrms-tax-set"><header><div><strong>${esc(year?.name || year?.fiscalYearBs || 'Fiscal year')}</strong><small>${esc(set.maritalStatus || 'ALL')} ${set.confirmed ? 'Confirmed' : 'Draft'}</small></div>${HR.canManage() ? `<button class="action-button" type="button" data-hrms-edit-tax-set="${esc(set.id)}">${icon('edit', 16)}</button>` : ''}</header><table><thead><tr><th>Band</th><th>Width</th><th>Rate</th></tr></thead><tbody>${HR.arr(set.bands).sort((a, b) => HR.num(a.order) - HR.num(b.order)).map((band, index) => `<tr><td>${index + 1}</td><td>${band.width === null || band.width === '' ? 'Remainder' : esc(money(band.width))}</td><td>${esc(band.rate)}%</td></tr>`).join('')}</tbody></table>${set.sourceNote ? `<p>${esc(set.sourceNote)}</p>` : ''}</article>`;
    }).join('')}</div>` : empty('No tax slab sets', 'Create fiscal-year tax bands and explicitly confirm them against the enacted source before payroll generation.');
    return pageShell('payroll', card('Tax slab sets', `${data.taxSlabSets.length} sets`, body, HR.canManage() ? '<button class="button button-primary button-small" type="button" data-hrms-add-tax-set>Add slab set</button>' : ''), { title: 'Tax slabs', description: 'Fiscal-year and marital-status scoped tax bands. Unconfirmed slabs deliberately block payroll generation.' });
  }

  function renderFiscalYears() {
    const data = HR.ensureState();
    const body = data.fiscalYears.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Fiscal year</th><th>BS range</th><th>AD range</th><th>Start month</th><th>Status</th><th></th></tr></thead><tbody>${data.fiscalYears.map(item => `<tr><td><strong>${esc(item.name || item.fiscalYearBs)}</strong></td><td>${esc(item.startBs || '-')} - ${esc(item.endBs || '-')}</td><td>${esc(item.startAd || '-')} - ${esc(item.endAd || '-')}</td><td>${esc(item.startBsMonth || 4)}</td><td>${status(item.status || 'upcoming')}</td><td>${HR.canManage() ? `<button class="action-button" type="button" data-hrms-edit-fiscal="${esc(item.id)}">${icon('edit', 16)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('No fiscal years configured', 'Create a fiscal year and mark it Active before generating advanced payroll.');
    return pageShell('payroll', card('Fiscal-year lifecycle', `${data.fiscalYears.length} years`, body, HR.canManage() ? '<button class="button button-primary button-small" type="button" data-hrms-add-fiscal>Add fiscal year</button>' : ''), { title: 'Fiscal years', description: 'Upcoming, active, closed and locked fiscal-year states protect historical payroll from accidental recalculation.' });
  }

  function renderHolidayOT() {
    const data = HR.ensureState();
    const rows = data.holidayOtRules;
    const body = rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Scope</th><th>Multiplier</th><th>Updated</th><th></th></tr></thead><tbody>${rows.map(rule => {
      const scope = rule.employeeId ? ERP.collection('employees').find(item => item.id === rule.employeeId)?.name
        : rule.sectionId ? HR.relationName('sections', rule.sectionId)
          : rule.departmentId ? HR.relationName('departments', rule.departmentId) : 'All employees';
      return `<tr><td><strong>${esc(scope || 'Unknown scope')}</strong></td><td>${esc(rule.multiplier || 1.5)}x</td><td>${esc(rule.updatedAt ? new Date(rule.updatedAt).toLocaleString() : '-')}</td><td>${HR.canManage() ? `<button class="action-button" type="button" data-hrms-edit-holiday-ot="${esc(rule.id)}">${icon('edit', 16)}</button>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div>` : empty('No holiday OT rules', 'Payroll falls back to the employee OT multiplier until an employee, section or department premium is configured.');
    return pageShell('payroll', card('Holiday OT rules', `${rows.length} rule${rows.length === 1 ? '' : 's'}`, body, HR.canManage() ? '<button class="button button-primary button-small" type="button" data-hrms-add-holiday-ot>Add rule</button>' : ''), { title: 'Holiday OT rules', description: 'Premium overtime multiplier for work on weekly-off or holiday dates, scoped by employee, section or department.' });
  }

  function renderAnnualSummary() {
    const data = HR.ensureState();
    const fiscalId = uiState().fiscalYearId || data.fiscalYears.find(item => item.status === 'active')?.id || data.fiscalYears[0]?.id || '';
    const rows = fiscalId ? HR.annualPayrollSummary(fiscalId) : [];
    const body = rows.length ? `<div class="erp-table-wrap"><table class="erp-table"><thead><tr><th>Employee</th><th>Months</th><th>Gross</th><th>Taxable</th><th>Tax</th><th>Deductions</th><th>Net</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${esc(row.employeeName)}</strong><small>${esc(row.employeeCode || '')}</small></td><td>${row.months}</td><td>${esc(money(row.gross))}</td><td>${esc(money(row.taxable))}</td><td>${esc(money(row.tax))}</td><td>${esc(money(row.deductions))}</td><td><strong>${esc(money(row.netPay))}</strong></td></tr>`).join('')}</tbody></table></div>` : empty('No annual payroll data', 'Generate payroll runs for the selected fiscal year to build the annual summary.');
    const actions = `<label class="hrms-inline-field"><span>Fiscal year</span><select data-hrms-annual-fiscal><option value="">Select</option>${data.fiscalYears.map(item => `<option value="${esc(item.id)}" ${item.id === fiscalId ? 'selected' : ''}>${esc(item.name || item.fiscalYearBs)}</option>`).join('')}</select></label>${rows.length ? '<button class="button button-secondary" type="button" data-hrms-export="annual" data-format="xls">Excel</button><button class="button button-secondary" type="button" data-hrms-print="annual">Print / PDF</button>' : ''}`;
    return pageShell('payroll', card('Annual payroll summary', `${rows.length} employees`, body), { title: 'Annual summary', description: 'Fiscal-year gross, taxable income, tax reconciliation, deductions and net pay aggregated from immutable monthly items.', actions });
  }

  function renderAdvanced(moduleKey, tab) {
    if (moduleKey === 'employees') {
      if (tab === 'organization') return renderOrganization();
      if (tab === 'device-identities') return renderDeviceIdentities();
      if (tab === 'shifts') return renderShifts();
    }
    if (moduleKey === 'attendance') {
      if (tab === 'overview') return renderAttendanceOverview();
      if (tab === 'devices') return renderDevices();
      if (tab === 'daily') return renderDaily();
      if (tab === 'raw-punches') return renderRawPunches();
      if (tab === 'monthly') return renderMonthly();
      if (tab === 'absent') return renderAbsent();
      if (tab === 'departments') return renderDepartments();
      if (tab === 'hajiri') return renderHajiri();
      if (tab === 'pull-sessions') return renderPullSessions();
      if (tab === 'schedule') return renderSchedule();
      if (tab === 'auto-attendance') return renderAutoAttendance();
      if (tab === 'audit') return renderAudit();
    }
    if (moduleKey === 'timeoff') {
      if (tab === 'balances') return renderLeaveBalances();
      if (tab === 'leave-types') return renderLeaveTypes();
      if (tab === 'holidays') return renderHolidays();
      if (tab === 'holiday-types') return renderHolidayTypes();
      if (tab === 'kaaj') return renderKaaj();
    }
    if (moduleKey === 'payroll') {
      if (tab === 'attendance-review') return renderPayrollAttendance();
      if (tab === 'payslips') return renderPayslips();
      if (tab === 'salary-setup') return renderSalarySetup();
      if (tab === 'heads-deductions') return renderHeadsDeductions();
      if (tab === 'tax-slabs') return renderTaxSlabs();
      if (tab === 'fiscal-years') return renderFiscalYears();
      if (tab === 'holiday-ot') return renderHolidayOT();
      if (tab === 'annual-summary') return renderAnnualSummary();
    }
    return recordsPage(moduleKey);
  }

  function needsBridge(tab, moduleKey) {
    return (moduleKey === 'attendance' && ['overview', 'devices', 'pull-sessions', 'schedule'].includes(tab))
      || (moduleKey === 'employees' && tab === 'device-identities');
  }

  async function loadBridge(force = false) {
    const view = uiState();
    if (view.bridgeLoading) return;
    if (!force && view.bridge && Date.now() - view.bridgeLoadedAt < 30000) return;
    view.bridgeLoading = true;
    try {
      view.bridge = await HR.bridgeSnapshot();
      view.bridgeLoadedAt = Date.now();
    } finally {
      view.bridgeLoading = false;
      if (MODULE_TABS[ERP.moduleByRoute?.(ui.route)?.key]) renderShell();
    }
  }

  async function loadRawPunches(force = false) {
    const view = uiState();
    if (view.rawPunchesLoading) return;
    if (!force && view.rawPunches && Date.now() - view.rawPunchesLoadedAt < 30000) return;
    view.rawPunchesLoading = true;
    try {
      view.rawPunches = await HR.bridgePunches({ limit: 500 });
      view.rawPunchesLoadedAt = Date.now();
    } finally {
      view.rawPunchesLoading = false;
      if (activeTab('attendance') === 'raw-punches') renderShell();
    }
  }

  function afterRender(moduleKey, tab) {
    if (needsBridge(tab, moduleKey)) loadBridge(false);
    if (moduleKey === 'attendance' && tab === 'raw-punches') loadRawPunches(false);
  }

  const previousRenderPage = renderPage;
  renderPage = function renderHRMSExtension() {
    const module = ERP.moduleByRoute?.(ui.route);
    if (!module || !MODULE_TABS[module.key] || hasOpenRecord(module.key)) return previousRenderPage();
    const tab = activeTab(module.key);
    const result = tab === 'records' ? recordsPage(module.key) : renderAdvanced(module.key, tab);
    requestAnimationFrame(() => afterRender(module.key, tab));
    return result;
  };

  function modalForm({ title, copy = '', body, submit = 'Save', onSubmit }) {
    const id = `hrms-form-${Date.now()}`;
    openModal(`<div class="modal-card hrms-modal"><div class="modal-head"><div><p class="modal-eyebrow">Formcraft HRMS</p><h2 id="modal-title">${esc(title)}</h2>${copy ? `<p>${esc(copy)}</p>` : ''}</div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div><form id="${id}"><div class="modal-body hrms-form-grid">${body}</div><div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">${esc(submit)}</button></div></form></div>`);
    requestAnimationFrame(() => {
      const form = document.getElementById(id);
      form?.addEventListener('submit', async event => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        if (button) button.disabled = true;
        try {
          await onSubmit(new FormData(form), form);
          closeModal();
          renderShell();
        } catch (error) {
          if (button) button.disabled = false;
          toast(error.message || 'HRMS change could not be saved.', 'error');
        }
      });
    });
  }

  const field = (label, name, value = '', type = 'text', extra = '') => `<label class="hrms-field"><span>${esc(label)}</span><input name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${extra}></label>`;
  const select = (label, name, options, value = '', extra = '') => `<label class="hrms-field"><span>${esc(label)}</span><select name="${esc(name)}" ${extra}>${options.map(([key, text]) => `<option value="${esc(key)}" ${String(key) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
  const checkbox = (label, name, checked = false) => `<label class="hrms-check"><input type="checkbox" name="${esc(name)}" ${checked ? 'checked' : ''}><span>${esc(label)}</span></label>`;
  const val = (form, key) => form.get(key) ?? '';
  const bool = (form, key) => form.get(key) !== null;

  function hierarchyModal(tableName, id = '') {
    const data = HR.ensureState();
    const row = data[tableName].find(item => item.id === id) || {};
    let parent = '';
    if (tableName === 'departments') parent = select('Directorate', 'directorateId', [['', 'No directorate'], ...data.directorates.map(item => [item.id, item.name])], row.directorateId);
    if (tableName === 'sections') parent = select('Department', 'departmentId', [['', 'No department'], ...data.departments.map(item => [item.id, item.name])], row.departmentId);
    if (tableName === 'units') parent = select('Section', 'sectionId', [['', 'No section'], ...data.sections.map(item => [item.id, item.name])], row.sectionId);
    modalForm({ title: `${id ? 'Edit' : 'Add'} ${tableName.replace(/s$/, '')}`, body: `${field('Name', 'name', row.name, 'text', 'required maxlength="120"')}${field('Code', 'code', row.code, 'text', 'maxlength="24"')}${parent}`, onSubmit: async form => {
      const input = { id: row.id, name: String(val(form, 'name')).trim(), code: String(val(form, 'code')).trim() };
      if (tableName === 'departments') input.directorateId = val(form, 'directorateId');
      if (tableName === 'sections') input.departmentId = val(form, 'departmentId');
      if (tableName === 'units') input.sectionId = val(form, 'sectionId');
      HR.upsert(tableName, input, { manageOnly: true });
      await HR.persist();
    } });
  }

  function organizationAssignmentModal(employeeId) {
    const data = HR.ensureState();
    const employee = ERP.collection('employees').find(item => item.id === employeeId);
    if (!employee) return;
    const org = HR.obj(employee.hrmsOrg);
    modalForm({ title: `Assign ${employee.name}`, body: `${select('Directorate', 'directorateId', [['', 'Unassigned'], ...data.directorates.map(item => [item.id, item.name])], org.directorateId)}${select('Department', 'departmentId', [['', 'Unassigned'], ...data.departments.map(item => [item.id, item.name])], org.departmentId)}${select('Section', 'sectionId', [['', 'Unassigned'], ...data.sections.map(item => [item.id, item.name])], org.sectionId)}${select('Unit', 'unitId', [['', 'Unassigned'], ...data.units.map(item => [item.id, item.name])], org.unitId)}${select('Shift', 'shiftId', [['', 'Unassigned'], ...data.shifts.map(item => [item.id, item.name])], employee.hrmsShiftId)}`, onSubmit: async form => {
      HR.assignOrganization(employeeId, { directorateId: val(form, 'directorateId'), departmentId: val(form, 'departmentId'), sectionId: val(form, 'sectionId'), unitId: val(form, 'unitId') });
      HR.assignShift(employeeId, val(form, 'shiftId'));
      await HR.persist();
    } });
  }

  function shiftModal(id = '') {
    const data = HR.ensureState();
    const row = data.shifts.find(item => item.id === id) || {};
    modalForm({ title: `${id ? 'Edit' : 'Add'} shift`, body: `${field('Shift name', 'name', row.name, 'text', 'required')}${field('Code', 'code', row.code)}${field('Start time', 'startTime', row.startTime || '09:00', 'time', 'required')}${field('End time', 'endTime', row.endTime || '17:00', 'time', 'required')}${field('Late grace (minutes)', 'graceLateIn', row.graceLateIn ?? 0, 'number', 'min="0"')}${field('Early-out grace (minutes)', 'graceEarlyOut', row.graceEarlyOut ?? 0, 'number', 'min="0"')}${field('Break minutes', 'breakMinutes', row.breakMinutes ?? 0, 'number', 'min="0"')}`, onSubmit: async form => {
      HR.upsert('shifts', { id: row.id, name: String(val(form, 'name')).trim(), code: String(val(form, 'code')).trim(), startTime: val(form, 'startTime'), endTime: val(form, 'endTime'), graceLateIn: HR.num(val(form, 'graceLateIn')), graceEarlyOut: HR.num(val(form, 'graceEarlyOut')), breakMinutes: HR.num(val(form, 'breakMinutes')) }, { manageOnly: true });
      await HR.persist();
    } });
  }

  function shiftRuleModal() {
    const data = HR.ensureState();
    const employees = ERP.collection('employees');
    modalForm({ title: 'Add shift rule', copy: 'Choose one scope. Employee rules take precedence over unit, section, department and directorate rules.', body: `${select('Shift', 'shiftId', [['', 'Select shift'], ...data.shifts.map(item => [item.id, item.name])], '', 'required')}${select('Employee', 'employeeId', [['', 'Any employee'], ...employees.map(item => [item.id, item.name])])}${select('Directorate', 'directorateId', [['', 'Any'], ...data.directorates.map(item => [item.id, item.name])])}${select('Department', 'departmentId', [['', 'Any'], ...data.departments.map(item => [item.id, item.name])])}${select('Section', 'sectionId', [['', 'Any'], ...data.sections.map(item => [item.id, item.name])])}${select('Unit', 'unitId', [['', 'Any'], ...data.units.map(item => [item.id, item.name])])}${field('From date', 'fromDate', '', 'date')}${field('To date', 'toDate', '', 'date')}`, onSubmit: async form => {
      HR.upsert('shiftRules', { shiftId: val(form, 'shiftId'), employeeId: val(form, 'employeeId'), directorateId: val(form, 'directorateId'), departmentId: val(form, 'departmentId'), sectionId: val(form, 'sectionId'), unitId: val(form, 'unitId'), fromDate: val(form, 'fromDate'), toDate: val(form, 'toDate') }, { manageOnly: true });
      await HR.persist();
    } });
  }

  function bridgeCredentialModal(result) {
    openModal(`<div class="modal-card hrms-modal"><div class="modal-head"><div><p class="modal-eyebrow">One-time credential</p><h2 id="modal-title">Local device bridge</h2><p>Copy these values to the bridge .env file. The secret is not shown again.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div><div class="modal-body"><div class="hrms-secret"><span>FORMCRAFT_BRIDGE_ID</span><code>${esc(result.bridge_id)}</code></div><div class="hrms-secret"><span>FORMCRAFT_BRIDGE_TOKEN</span><code>${esc(result.bridge_token)}</code></div><p class="hrms-security-note">The bridge also needs the public Supabase URL and publishable key used by the hosted app. It never needs a service-role key.</p></div><div class="modal-actions"><button class="button button-primary" type="button" data-close-modal>Done</button></div></div>`);
  }

  function deviceModal(device = null) {
    const item = device || {};
    modalForm({ title: device ? 'Edit biometric device' : 'Add biometric device', body: `${field('Device name', 'name', item.name, 'text', 'required')}${field('IP address', 'ipAddress', item.ip_address, 'text', 'required placeholder="192.168.1.201"')}${field('Port', 'port', item.port || 4370, 'number', 'min="1" max="65535"')}${field('Model', 'model', item.model || '')}${field('Connection timeout seconds', 'connectionTimeout', item.connection_timeout || 10, 'number', 'min="3" max="120"')}${checkbox('Force UDP for older readers', 'forceUdp', Boolean(item.force_udp))}${checkbox('Device active', 'active', item.active !== false)}`, onSubmit: async form => {
      const input = { name: val(form, 'name'), ipAddress: val(form, 'ipAddress'), port: val(form, 'port'), model: val(form, 'model'), connectionTimeout: val(form, 'connectionTimeout'), forceUdp: bool(form, 'forceUdp'), active: bool(form, 'active') };
      if (device) await HR.updateDevice(device.id, input); else await HR.createDevice(input);
      await loadBridge(true);
    } });
  }

  function historicalPullModal(deviceId) {
    const range = HR.monthRange(uiState().bsYear, uiState().bsMonth);
    modalForm({ title: 'Historical device pull', copy: 'The bridge reads the reader, filters punches to this date range in Nepal time, and inserts only new raw punches.', body: `${field('From date', 'fromDate', range.start, 'date', 'required')}${field('To date', 'toDate', range.end, 'date', 'required')}`, submit: 'Queue historical pull', onSubmit: async form => {
      const fromDate = val(form, 'fromDate');
      const toDate = val(form, 'toDate');
      if (toDate < fromDate) throw new Error('To date must be on or after from date.');
      await HR.queueDeviceCommand('pull-month', { deviceId, payload: { fromDate, toDate }, expiresMinutes: 60 });
      toast('Historical pull queued.');
      await loadBridge(true);
    } });
  }

  function deviceSecretModal(deviceId) {
    modalForm({ title: 'Set device communication key', copy: 'This secret is sent once in a short-lived command and stored only on the local bridge. It is not written into Formcraft workspace state.', body: `${field('Communication key', 'secret', '', 'password', 'autocomplete="new-password"')}`, submit: 'Send to bridge', onSubmit: async form => {
      await HR.queueDeviceCommand('set-secret', { deviceId, payload: { secret: String(val(form, 'secret')) }, expiresMinutes: 10 });
      toast('Secret update queued for the local bridge.');
      await loadBridge(true);
    } });
  }

  function migrateModal() {
    const snapshot = uiState().bridge;
    const devices = snapshot?.devices || [];
    modalForm({ title: 'Migrate device users', copy: 'The bridge copies selected users and fingerprint templates directly between readers on the LAN. Templates do not pass through the hosted browser.', body: `${select('Source device', 'sourceDeviceId', devices.map(item => [item.id, item.name]), '', 'required')}${select('Target device', 'targetDeviceId', devices.map(item => [item.id, item.name]), '', 'required')}${field('Device UIDs (optional)', 'uids', '', 'text', 'placeholder="12, 18, 25"')}`, submit: 'Queue migration', onSubmit: async form => {
      const uids = String(val(form, 'uids')).split(',').map(value => Number(value.trim())).filter(Number.isFinite);
      await HR.queueDeviceCommand('migrate-users', { payload: { sourceDeviceId: val(form, 'sourceDeviceId'), targetDeviceId: val(form, 'targetDeviceId'), uids } });
      toast('Device migration queued.');
    } });
  }

  function linkDeviceUserModal(userId) {
    const snapshot = uiState().bridge;
    const user = snapshot?.users.find(item => item.id === userId);
    if (!user) return;
    const employees = ERP.collection('employees').filter(item => !item.archived);
    const options = [['', 'Select employee'], ['__create__', `Create Employee from ${user.name || user.device_user_id || 'device user'}`], ...employees.map(item => [item.id, `${item.name}${item.employeeCode ? ` (${item.employeeCode})` : ''}`])];
    modalForm({ title: `Link ${user.name || user.device_user_id}`, copy: 'Employees remains the HR master. You canamap this biometric identity to an existing employee or create a normal Employee record from it.', body: `${select('Employee', 'employeeId', options, '', 'required')}`, onSubmit: async form => {
      let employeeId = val(form, 'employeeId');
      if (employeeId === '__create__') {
        const module = ERP.modulesByKey.get('employees');
        const deviceCode = String(user.device_user_id || user.device_uid || '').trim();
        const existing = ERP.collection('employees').find(item => deviceCode && [item.employeeCode, item.attendanceId].some(value => String(value || '').trim() === deviceCode));
        if (existing) employeeId = existing.id;
        else {
          const employee = ERP.makeRecord(module, {
            name: String(user.name || `Device user ${deviceCode || user.device_uid || ''}`).trim(),
            employeeCode: deviceCode,
            attendanceId: deviceCode,
            status: 'active'
          });
          ERP.collection('employees').unshift(employee);
          ERP.recordAudit?.(module, employee, 'Created from biometric identity', `Device ${snapshot.devices.find(item => item.id === user.device_id)?.name || 'reader'} · ID ${deviceCode || user.device_uid}`);
          employeeId = employee.id;
        }
      }
      if (!employeeId) throw new Error('Select or create an Employee record.');
      HR.linkDeviceUser({ employeeId, deviceId: user.device_id, deviceUid: user.device_uid, deviceUserId: user.device_user_id, deviceUserName: user.name });
      await HR.persist();
      toast('Device identity linked to the existing Employees directory.');
    } });
  }

  function syncDirectoryModal() {
    const snapshot = uiState().bridge;
    const devices = snapshot?.devices || [];
    if (!devices.length) return toast('Add an active biometric device first.', 'warning');
    modalForm({
      title: 'Sync employee directory to a device',
      copy: 'Only employees with an Employee code or Attendance ID are considered. Existing matching users are left alone; missing or renamed users are queued as idempotent device updates.',
      body: `${select('Target device', 'deviceId', devices.filter(item => item.active !== false).map(item => [item.id, item.name]), devices.find(item => item.active !== false)?.id || '', 'required')}`,
      submit: 'Queue directory sync',
      onSubmit: async form => {
        const deviceId = val(form, 'deviceId');
        const activeEmployees = ERP.collection('employees').filter(item => !item.archived && item.status !== 'inactive');
        const deviceUsers = (snapshot.users || []).filter(item => item.device_id === deviceId);
        const jobs = [];
        activeEmployees.forEach(employee => {
          const userId = String(employee.attendanceId || employee.employeeCode || '').trim();
          if (!userId) return;
          const current = deviceUsers.find(item => String(item.device_user_id || '') === userId);
          const desiredName = String(employee.name || '').trim();
          if (current && String(current.name || '').trim() === desiredName) return;
          jobs.push({ employee, userId });
        });
        if (!jobs.length) {
          toast('The selected device already matches the current employee directory.');
          return;
        }
        for (const job of jobs) {
          await HR.queueDeviceCommand('sync-user', {
            deviceId,
            payload: { user_id: job.userId, name: job.employee.name || job.userId, privilege: 0, card: 0 },
            expiresMinutes: 60
          });
        }
        toast(`${jobs.length} employee ${jobs.length === 1 ? 'identity' : 'identities'} queued for device synchronization.`);
        await loadBridge(true);
      }
    });
  }

  async function deleteDeviceUser(userId) {
    const snapshot = uiState().bridge;
    const user = snapshot?.users.find(item => item.id === userId);
    if (!user || !HR.canManage()) return;
    const device = snapshot.devices.find(item => item.id === user.device_id);
    confirmAction(
      `Delete ${user.name || user.device_user_id || 'this user'} from ${device?.name || 'the biometric device'}?`,
      'This queues a device-side deletion only. The existing Formcraft Employee record is never deleted.',
      async () => {
        try {
          await HR.queueDeviceCommand('delete-user', {
            deviceId: user.device_id,
            payload: { uid: user.device_uid, user_id: user.device_user_id },
            expiresMinutes: 30
          });
          toast('Device-user deletion queued. The Employee record remains unchanged.', 'warning');
          await loadBridge(true);
        } catch (error) {
          toast(error.message || 'Device-user deletion could not be queued.', 'error');
        }
      }
    );
  }

  function importUnlinkedDeviceUsers() {
    const snapshot = uiState().bridge;
    if (!snapshot?.users?.length) return toast('No device users are available to import.', 'warning');
    confirmAction('Import unlinked biometric users into Employees?', 'Existing Employees are matched by Attendance ID or Employee code first. Only truly unmatched device users create new Employee records.', async () => {
      const module = ERP.modulesByKey.get('employees');
      const employees = ERP.collection('employees');
      const links = HR.ensureState().employeeDeviceLinks;
      let created = 0;
      let linked = 0;
      snapshot.users.forEach(user => {
        const already = links.find(item => item.deviceId === user.device_id && String(item.deviceUserId) === String(user.device_user_id));
        if (already) return;
        const code = String(user.device_user_id || user.device_uid || '').trim();
        let employee = employees.find(item => code && [item.attendanceId, item.employeeCode].some(value => String(value || '').trim() === code));
        if (!employee) {
          employee = ERP.makeRecord(module, { name: String(user.name || `Device user ${code}`).trim(), employeeCode: code, attendanceId: code, status: 'active' });
          employees.unshift(employee);
          ERP.recordAudit?.(module, employee, 'Created from biometric identity', `Bulk import from ${snapshot.devices.find(item => item.id === user.device_id)?.name || 'device'}`);
          created += 1;
        }
        HR.linkDeviceUser({ employeeId: employee.id, deviceId: user.device_id, deviceUid: user.device_uid, deviceUserId: user.device_user_id, deviceUserName: user.name });
        linked += 1;
      });
      await HR.persist();
      renderShell();
      toast(`${linked} device identities linked; ${created} new Employee ${created === 1 ? 'record' : 'records'} created.`);
    });
  }

  function deleteDevice(deviceId) {
    const snapshot = uiState().bridge;
    const device = snapshot?.devices.find(item => item.id === deviceId);
    if (!device || !HR.canManage()) return;
    confirmAction(`Remove ${device.name} from Formcraft?`, 'This removes the bridge configuration and its cloud-side device history by cascade. Existing Employees, Attendance records and every unrelated module remain untouched.', async () => {
      try {
        await HR.deleteDevice(device.id);
        await loadBridge(true);
        renderShell();
        toast('Biometric device removed. Existing Formcraft business records were not changed.', 'warning');
      } catch (error) { toast(error.message || 'Device could not be removed.', 'error'); }
    });
  }

  function dayRemarkModal(employeeId, date) {
    const employee = ERP.collection('employees').find(item => item.id === employeeId);
    const existing = HR.dayRemarkFor(employeeId, date) || {};
    modalForm({ title: `Attendance remark - ${employee?.name || 'Employee'}`, copy: `${date}${NP?.bsLabel?.(date) ? ` · ${NP.bsLabel(date)}` : ''}`, body: `<label class="hrms-field hrms-span-2"><span>Remark</span><textarea name="remarkText" rows="4" required>${esc(existing.remarkText || '')}</textarea></label>`, onSubmit: async form => {
      HR.upsert('dayRemarks', { id: existing.id, employeeId, adDate: date, bsDate: NP?.bsLabel?.(date) || '', remarkText: String(val(form, 'remarkText')).trim() }, { detail: 'Attendance day remark saved.' });
      await HR.persist();
    } });
  }

  function holidayTypeModal(id = '') {
    const row = HR.ensureState().holidayTypes.find(item => item.id === id) || {};
    modalForm({ title: `${id ? 'Edit' : 'Add'} holiday type`, body: `${field('Name', 'name', row.name || '', 'text', 'required')}${field('Type code', 'typeCode', row.typeCode || '', 'text', 'required maxlength="12"')}${field('Display color', 'colorCode', row.colorCode || '#64748b', 'color')}${field('Sort order', 'sortOrder', row.sortOrder ?? 0, 'number', 'step="1"')}`, onSubmit: async form => {
      HR.upsert('holidayTypes', { id: row.id, name: String(val(form, 'name')).trim(), typeCode: String(val(form, 'typeCode')).trim().toUpperCase(), colorCode: String(val(form, 'colorCode') || '#64748b'), sortOrder: Number(val(form, 'sortOrder')) || 0 }, { manageOnly: true });
      await HR.persist();
    } });
  }

  function autoAttendRuleModal(id = '') {
    const data = HR.ensureState();
    const row = data.autoAttendRules.find(item => item.id === id) || {};
    const employees = ERP.collection('employees').filter(item => !item.archived && item.status !== 'inactive');
    const devices = uiState().bridge?.devices || [];
    const selected = new Set(HR.arr(row.deviceIds));
    const deviceChecks = devices.length ? devices.map(device => `<label class="hrms-check"><input type="checkbox" name="device:${esc(device.id)}" ${selected.has(device.id) ? 'checked' : ''}><span>${esc(device.name)}</span></label>`).join('') : '<p class="hrms-muted">No devices are registered yet. Save the rule after the bridge/device setup is available.</p>';
    modalForm({ title: `${id ? 'Edit' : 'Add'} automatic attendance rule`, copy: 'Generated punches are explicitly tagged auto_attend and remain auditable. Weekdays use Monday=0 through Sunday=6.', body: `${select('Employee', 'employeeId', [['', 'Select employee'], ...employees.map(item => [item.id, `${item.name}${item.employeeCode ? ` (${item.employeeCode})` : ''}`])], row.employeeId, 'required')}<div class="hrms-span-2"><h3>Devices</h3><div class="hrms-check-grid">${deviceChecks}</div></div>${field('Check-in window start', 'checkinStart', row.checkinStart || '08:57', 'time', 'required')}${field('Check-in window end', 'checkinEnd', row.checkinEnd || '08:59', 'time', 'required')}${field('Check-in scheduler time', 'checkinSchedule', row.checkinSchedule || '08:56', 'time', 'required')}${field('Check-out window start', 'checkoutStart', row.checkoutStart || '17:19', 'time', 'required')}${field('Check-out window end', 'checkoutEnd', row.checkoutEnd || '17:27', 'time', 'required')}${field('Check-out scheduler time', 'checkoutSchedule', row.checkoutSchedule || '17:18', 'time', 'required')}${field('Weekdays', 'days', HR.arr(row.days).length ? HR.arr(row.days).join(',') : '0,1,2,3,4', 'text', 'required placeholder="0,1,2,3,4"')}${field('Source tag', 'sourceTag', row.sourceTag || 'auto_attend', 'text', 'required')}${checkbox('Rule active', 'active', row.active !== false)}`, onSubmit: async form => {
      const days = String(val(form, 'days')).split(',').map(value => Number(value.trim())).filter(value => Number.isInteger(value) && value >= 0 && value <= 6);
      if (!days.length) throw new Error('Enter at least one weekday from 0 to 6.');
      const deviceIds = devices.filter(device => form.get(`device:${device.id}`) !== null).map(device => device.id);
      HR.upsert('autoAttendRules', { id: row.id, employeeId: val(form, 'employeeId'), deviceIds, checkinStart: val(form, 'checkinStart'), checkinEnd: val(form, 'checkinEnd'), checkinSchedule: val(form, 'checkinSchedule'), checkoutStart: val(form, 'checkoutStart'), checkoutEnd: val(form, 'checkoutEnd'), checkoutSchedule: val(form, 'checkoutSchedule'), days, sourceTag: String(val(form, 'sourceTag') || 'auto_attend').trim(), active: bool(form, 'active') }, { manageOnly: true, detail: 'Automatic attendance rule updated.' });
      await HR.persist();
    } });
  }

  async function pushAutoAttendRules() {
    const snapshot = uiState().bridge || await HR.bridgeSnapshot();
    if (!snapshot?.bridge) return toast('Configure and connect the local bridge before pushing automatic attendance rules.', 'warning');
    const employees = ERP.collection('employees');
    const links = HR.ensureState().employeeDeviceLinks;
    const rules = HR.ensureState().autoAttendRules.map(rule => {
      const employee = employees.find(item => item.id === rule.employeeId);
      const userId = String(employee?.attendanceId || employee?.employeeCode || '').trim();
      return {
        id: rule.id,
        active: rule.active !== false,
        employeeId: rule.employeeId,
        employeeName: employee?.name || '',
        userId,
        deviceIds: HR.arr(rule.deviceIds),
        deviceUids: Object.fromEntries(links.filter(link => link.employeeId === rule.employeeId && link.deviceUid !== undefined && link.deviceUid !== null).map(link => [link.deviceId, link.deviceUid])),
        checkinStart: rule.checkinStart,
        checkinEnd: rule.checkinEnd,
        checkinSchedule: rule.checkinSchedule,
        checkoutStart: rule.checkoutStart,
        checkoutEnd: rule.checkoutEnd,
        checkoutSchedule: rule.checkoutSchedule,
        days: HR.arr(rule.days),
        sourceTag: rule.sourceTag || 'auto_attend'
      };
    }).filter(rule => rule.userId && rule.deviceIds.length);
    await HR.queueDeviceCommand('set-auto-attend-rules', { payload: { rules, timezone: HR.TIME_ZONE }, expiresMinutes: 60 });
    toast(`${rules.length} automatic attendance ${rules.length === 1 ? 'rule' : 'rules'} queued for the local bridge.`);
  }

  function importValue(row, names) {
    if (NP?.pick) return NP.pick(row, names);
    const entries = Object.entries(HR.obj(row));
    for (const name of names) {
      const key = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = entries.find(([candidate]) => String(candidate).toLowerCase().replace(/[^a-z0-9]/g, '') === key);
      if (match && String(match[1] ?? '').trim()) return match[1];
    }
    return '';
  }

  function spreadsheetDate(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const numeric = Number(text);
    if (Number.isFinite(numeric) && numeric >= 20000 && numeric <= 100000) {
      const epoch = Date.UTC(1899, 11, 30);
      return new Date(epoch + Math.floor(numeric) * 86400000).toISOString().slice(0, 10);
    }
    const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const slash = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (slash) {
      const first = Number(slash[1]);
      const second = Number(slash[2]);
      const year = Number(slash[3]);
      const day = first > 12 ? first : second > 12 ? second : first;
      const month = first > 12 ? second : second > 12 ? first : second;
      const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (!Number.isNaN(new Date(`${candidate}T00:00:00Z`).getTime())) return candidate;
    }
    return text;
  }

  function spreadsheetTime(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const numeric = Number(text);
    if (Number.isFinite(numeric) && numeric >= 0 && numeric < 1) {
      const minutes = Math.round(numeric * 24 * 60) % (24 * 60);
      return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    }
    const fraction = Number.isFinite(numeric) && numeric >= 1 ? numeric % 1 : NaN;
    if (Number.isFinite(fraction) && fraction > 0) return spreadsheetTime(fraction);
    const clock = text.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
    return clock ? `${String(Number(clock[1])).padStart(2, '0')}:${clock[2]}` : text;
  }

  function dailyImportCandidate(row) {
    const date = importValue(row, ['date', 'workDate', 'adDate', 'attendanceDate']);
    const checkIn = importValue(row, ['checkIn', 'check_in', 'inTime', 'firstIn', 'timeIn']);
    const checkOut = importValue(row, ['checkOut', 'check_out', 'outTime', 'lastOut', 'timeOut']);
    return Boolean(String(date || '').trim() && String(checkIn || '').trim() && String(checkOut || '').trim());
  }

  function validateDailyImport(rows, defaults) {
    const output = [];
    const errors = [];
    HR.arr(rows).forEach((row, index) => {
      const employee = NP?.employeeFor?.(row) || null;
      const date = spreadsheetDate(importValue(row, ['date', 'workDate', 'adDate', 'attendanceDate']));
      const checkIn = spreadsheetTime(importValue(row, ['checkIn', 'check_in', 'inTime', 'firstIn', 'timeIn']));
      const checkOut = spreadsheetTime(importValue(row, ['checkOut', 'check_out', 'outTime', 'lastOut', 'timeOut']));
      const reason = String(importValue(row, ['manualReason', 'reason', 'note']) || defaults.reason || '').trim();
      const approver = String(importValue(row, ['approver', 'approvedBy', 'approved_by']) || defaults.approver || '').trim();
      if (!employee) errors.push(`row ${index + 2}: employee could not be matched`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`row ${index + 2}: invalid AD date`);
      if (!/^\d{2}:\d{2}$/.test(checkIn) || !/^\d{2}:\d{2}$/.test(checkOut)) errors.push(`row ${index + 2}: check-in/check-out must be valid times`);
      if (!reason) errors.push(`row ${index + 2}: manual-entry reason is required`);
      if (!approver) errors.push(`row ${index + 2}: approver is required`);
      output.push({ employeeId: employee?.id || '', date, checkIn, checkOut, reason, approver });
    });
    if (errors.length) throw new Error(`Daily attendance import was not applied. ${errors.slice(0, 6).join('; ')}${errors.length > 6 ? `; plus ${errors.length - 6} more` : ''}.`);
    return output;
  }

  function attendanceImportModal() {
    const id = `hrms-import-${Date.now()}`;
    const approver = typeof currentUserName === 'function' ? currentUserName() : '';
    openModal(`<div class="modal-card hrms-modal"><div class="modal-head"><div><p class="modal-eyebrow">Attendance import</p><h2 id="modal-title">Import CSV, JSON or XLSX</h2><p>Raw punch files use the existing duplicate controls. Daily rows with Date, Check In and Check Out are treated as controlled manual attendance and require a reason and approver.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div><form id="${id}"><div class="modal-body hrms-form-grid"><label class="hrms-file-field hrms-span-2"><span>Attendance file</span><input type="file" name="file" accept=".csv,.json,.xlsx" required></label>${field('Default manual reason', 'reason', 'Bulk attendance import', 'text', 'required')}${field('Default approver', 'approver', approver, 'text', 'required')}</div><div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Import</button></div></form></div>`);
    requestAnimationFrame(() => document.getElementById(id)?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const file = form.elements.file.files?.[0];
      if (!file) return;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        let rows;
        if (file.name.toLowerCase().endsWith('.xlsx')) rows = await XLSX.parse(file);
        else rows = NP.parseImportText(await file.text(), file.name);
        const dailyFlags = HR.arr(rows).map(dailyImportCandidate);
        const dailyCount = dailyFlags.filter(Boolean).length;
        if (dailyCount && dailyCount !== dailyFlags.length) throw new Error('Do not mix raw-punch rows and daily Check In / Check Out rows in the same import file.');
        if (dailyCount) {
          const validated = validateDailyImport(rows, { reason: form.elements.reason.value, approver: form.elements.approver.value });
          validated.forEach(input => NP.addManualAttendance(input));
          await HR.persist();
          closeModal();
          renderShell();
          toast(`${validated.length} daily attendance ${validated.length === 1 ? 'record' : 'records'} imported with reason and approver evidence.`);
          return;
        }
        const result = NP.importPunchRows(rows, { fileName: file.name, source: file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx-import' : 'file-import' });
        await HR.persist();
        closeModal();
        renderShell();
        toast(`${result.acceptedRows} punches imported; ${result.duplicateRows} duplicates filtered.`);
      } catch (error) {
        button.disabled = false;
        toast(error.message || 'Attendance import failed.', 'error');
      }
    }));
  }

  function manualAttendanceModal() {
    const employees = ERP.collection('employees').filter(item => !item.archived);
    modalForm({ title: 'Manual attendance', copy: 'Manual entries require a reason and approver. They are written through the existing Nepal attendance pipeline.', body: `${select('Employee', 'employeeId', [['', 'Select employee'], ...employees.map(item => [item.id, item.name])], '', 'required')}${field('Date', 'date', uiState().date, 'date', 'required')}${field('Check in', 'checkIn', '09:00', 'time', 'required')}${field('Check out', 'checkOut', '17:00', 'time', 'required')}${field('Reason', 'reason', '', 'text', 'required')}${field('Approver', 'approver', typeof currentUserName === 'function' ? currentUserName() : '', 'text', 'required')}`, submit: 'Add attendance', onSubmit: async form => {
      NP.addManualAttendance({ employeeId: val(form, 'employeeId'), date: val(form, 'date'), checkIn: val(form, 'checkIn'), checkOut: val(form, 'checkOut'), reason: val(form, 'reason'), approver: val(form, 'approver') });
      await HR.persist();
      toast('Manual attendance added with control evidence.');
    } });
  }

  function holidayOtModal(id = '') {
    const data = HR.ensureState();
    const row = data.holidayOtRules.find(item => item.id === id) || {};
    const employees = ERP.collection('employees').filter(item => !item.archived);
    modalForm({ title: `${id ? 'Edit' : 'Add'} holiday OT rule`, copy: 'Use one scope. Employee rules take precedence over section and department rules.', body: `${select('Employee', 'employeeId', [['', 'Any employee'], ...employees.map(item => [item.id, item.name])], row.employeeId)}${select('Department', 'departmentId', [['', 'Any department'], ...data.departments.map(item => [item.id, item.name])], row.departmentId)}${select('Section', 'sectionId', [['', 'Any section'], ...data.sections.map(item => [item.id, item.name])], row.sectionId)}${field('Multiplier', 'multiplier', row.multiplier || 1.5, 'number', 'required min="1" step="0.05"')}`, onSubmit: async form => {
      HR.upsert('holidayOtRules', { id: row.id, employeeId: val(form, 'employeeId'), departmentId: val(form, 'departmentId'), sectionId: val(form, 'sectionId'), multiplier: HR.num(val(form, 'multiplier')) || 1.5 }, { manageOnly: true });
      await HR.persist();
    } });
  }

  function leaveTypeModal(id = '') {
    const row = HR.ensureState().leaveTypes.find(item => item.id === id) || {};
    modalForm({ title: `${id ? 'Edit' : 'Add'} leave type`, body: `${field('Name', 'name', row.name, 'text', 'required')}${field('Code', 'code', row.code, 'text', 'required maxlength="32"')}${field('Display code', 'displayCode', row.displayCode || '')}${field('Display color', 'colorCode', row.colorCode || '#64748b', 'color')}${field('Sort order', 'sortOrder', row.sortOrder ?? 0, 'number', 'step="1"')}${select('Applies to', 'appliesTo', [['ALL', 'All employees'], ['FEMALE', 'Female employees'], ['MALE', 'Male employees'], ['POLICY', 'Policy / manually eligible']], row.appliesTo || 'ALL')}${field('Days per year', 'daysPerYear', row.daysPerYear ?? 0, 'number', 'min="0" step="0.5"')}${field('Maximum accumulation', 'maxAccumulate', row.maxAccumulate ?? 0, 'number', 'min="0" step="0.5"')}${checkbox('Carry forward', 'carryForward', Boolean(row.carryForward))}${checkbox('Paid leave', 'isPaid', row.isPaid !== false)}${checkbox('Half day allowed', 'halfDayAllowed', row.halfDayAllowed !== false)}<label class="hrms-field hrms-span-2"><span>Description / policy note</span><textarea name="description" rows="3">${esc(row.description || '')}</textarea></label>`, onSubmit: async form => {
      HR.upsert('leaveTypes', { id: row.id, name: String(val(form, 'name')).trim(), code: String(val(form, 'code')).trim().toLowerCase(), displayCode: String(val(form, 'displayCode')).trim(), colorCode: String(val(form, 'colorCode') || '#64748b'), sortOrder: Number(val(form, 'sortOrder')) || 0, appliesTo: String(val(form, 'appliesTo') || 'ALL'), daysPerYear: HR.num(val(form, 'daysPerYear')), maxAccumulate: HR.num(val(form, 'maxAccumulate')), carryForward: bool(form, 'carryForward'), isPaid: bool(form, 'isPaid'), halfDayAllowed: bool(form, 'halfDayAllowed'), description: String(val(form, 'description')).trim(), active: true }, { manageOnly: true });
      HR.refreshTimeOffOptions();
      await HR.persist();
    } });
  }

  function leaveBalanceModal(employeeId, leaveTypeId) {
    const year = uiState().bsYear || NP?.bsParts?.(new Date())?.year || '';
    const saved = HR.balanceFor(employeeId, leaveTypeId, year) || {};
    const employee = ERP.collection('employees').find(item => item.id === employeeId);
    const type = HR.ensureState().leaveTypes.find(item => item.id === leaveTypeId);
    modalForm({ title: `${employee?.name || 'Employee'} - ${type?.name || 'leave'}`, body: `${field('BS year', 'bsYear', year, 'number', 'required')}${field('Opening balance', 'openingBalance', saved.openingBalance ?? 0, 'number', 'step="0.5"')}${field('Days earned', 'daysEarned', saved.daysEarned ?? 0, 'number', 'step="0.5"')}${field('Annual allocated', 'annualAllocated', saved.annualAllocated ?? type?.daysPerYear ?? 0, 'number', 'step="0.5"')}${field('Carried forward', 'carriedForward', saved.carriedForward ?? 0, 'number', 'step="0.5"')}`, onSubmit: async form => {
      HR.upsert('leaveBalances', { id: saved.id, employeeId, leaveTypeId, bsYear: Number(val(form, 'bsYear')), openingBalance: HR.num(val(form, 'openingBalance')), daysEarned: HR.num(val(form, 'daysEarned')), annualAllocated: HR.num(val(form, 'annualAllocated')), carriedForward: HR.num(val(form, 'carriedForward')) }, { manageOnly: true });
      await HR.persist();
    } });
  }

  function holidayModal() {
    const custom = HR.ensureState().holidayTypes;
    const options = [['public', 'Public'], ['festival', 'Festival'], ['national', 'National'], ['optional', 'Optional'], ['other', 'Other'], ...custom.map(item => [`custom:${item.id}`, item.name])];
    modalForm({ title: 'Add holiday', body: `${field('Holiday name', 'name', '', 'text', 'required')}${field('AD date', 'dateAd', '', 'date', 'required')}${select('Type', 'type', options, 'public')}${field('Source / note', 'source', '')}${checkbox('Paid holiday', 'paid', true)}`, onSubmit: async form => {
      const choice = String(val(form, 'type'));
      const customId = choice.startsWith('custom:') ? choice.slice(7) : '';
      const holiday = NP.addHoliday({ name: val(form, 'name'), dateAd: val(form, 'dateAd'), type: customId ? 'other' : choice, source: val(form, 'source'), paid: bool(form, 'paid') });
      if (holiday && customId) {
        holiday.holidayTypeId = customId;
        holiday.hrmsHolidayTypeCode = custom.find(item => item.id === customId)?.typeCode || '';
      }
      await HR.persist();
    } });
  }

  function kaajModal(id = '') {
    const row = HR.ensureState().kaajRecords.find(item => item.id === id) || {};
    const employees = ERP.collection('employees').filter(item => !item.archived);
    modalForm({ title: `${id ? 'Edit' : 'Add'} Kaaj / field duty`, body: `${select('Employee', 'employeeId', [['', 'Select employee'], ...employees.map(item => [item.id, item.name])], row.employeeId, 'required')}${field('AD date', 'adDate', row.adDate || uiState().date, 'date', 'required')}${checkbox('Paid duty', 'isPaid', row.isPaid !== false)}${field('Reason', 'reason', row.reason || '', 'text', 'required')}${field('Approved by', 'approvedBy', row.approvedBy || (typeof currentUserName === 'function' ? currentUserName() : ''))}`, onSubmit: async form => {
      const adDate = val(form, 'adDate');
      HR.upsert('kaajRecords', { id: row.id, employeeId: val(form, 'employeeId'), adDate, bsDate: NP?.bsLabel?.(adDate) || '', isPaid: bool(form, 'isPaid'), reason: String(val(form, 'reason')).trim(), approvedBy: String(val(form, 'approvedBy')).trim() });
      await HR.persist();
    } });
  }

  function salaryModal(employeeId) {
    const data = HR.ensureState();
    const employee = ERP.collection('employees').find(item => item.id === employeeId);
    const structure = data.salaryStructures.find(item => item.employeeId === employeeId) || {};
    const currentHeads = new Map(data.employeeHeads.filter(item => item.employeeId === employeeId).map(item => [item.headId, item]));
    const currentDeductions = new Map(data.employeeDeductions.filter(item => item.employeeId === employeeId).map(item => [item.deductionTypeId, item]));
    const headControls = data.salaryHeads.map(head => {
      const assigned = currentHeads.get(head.id);
      return `<div class="hrms-assignment-row"><label><input type="checkbox" name="head:${esc(head.id)}" ${assigned?.active !== false && assigned ? 'checked' : ''}><span>${esc(head.name)} (${esc(head.code)})</span></label><input type="number" step="0.01" name="headAmount:${esc(head.id)}" value="${esc(assigned?.amount ?? head.defaultAmount ?? 0)}" aria-label="${esc(head.name)} amount"></div>`;
    }).join('') || '<p class="hrms-muted">No salary-head catalog entries. Existing base salary will be treated as Basic.</p>';
    const deductionControls = data.deductionTypes.map(type => {
      const assigned = currentDeductions.get(type.id);
      return `<div class="hrms-assignment-row"><label><input type="checkbox" name="ded:${esc(type.id)}" ${assigned?.isEnrolled !== false && assigned ? 'checked' : ''}><span>${esc(type.name)} (${esc(type.code)})</span></label><input type="number" step="0.01" name="dedAmount:${esc(type.id)}" value="${esc(assigned?.amount ?? type.defaultAmount ?? 0)}" aria-label="${esc(type.name)} amount"></div>`;
    }).join('') || '<p class="hrms-muted">No deduction catalog entries.</p>';
    modalForm({ title: `Salary setup - ${employee?.name || 'Employee'}`, body: `${field('Daily hours', 'dailyHours', structure.dailyHours || 8, 'number', 'min="1" max="24" step="0.25"')}${field('OT multiplier', 'otMultiplier', structure.otMultiplier || 1.5, 'number', 'min="1" step="0.05"')}${select('Tax slab group', 'maritalStatus', [['ALL', 'Unified / all'], ['single', 'Single'], ['married', 'Married']], structure.maritalStatus || 'ALL')}${field('Other deductions', 'otherDeductions', structure.otherDeductions || 0, 'number', 'min="0" step="0.01"')}<div class="hrms-span-2"><h3>Earning heads</h3>${headControls}</div><div class="hrms-span-2"><h3>Deduction enrollment</h3>${deductionControls}</div>`, onSubmit: async form => {
      HR.upsert('salaryStructures', { id: structure.id, employeeId, dailyHours: HR.num(val(form, 'dailyHours')), otMultiplier: HR.num(val(form, 'otMultiplier')), maritalStatus: val(form, 'maritalStatus'), otherDeductions: HR.num(val(form, 'otherDeductions')) }, { manageOnly: true });
      data.salaryHeads.forEach(head => {
        const assigned = currentHeads.get(head.id);
        const enabled = form.get(`head:${head.id}`) !== null;
        if (enabled) HR.upsert('employeeHeads', { id: assigned?.id, employeeId, headId: head.id, amount: HR.num(form.get(`headAmount:${head.id}`)), active: true }, { manageOnly: true });
        else if (assigned) { assigned.active = false; HR.audit('employeeHeads', assigned.id, 'UPDATE', null, assigned, 'Salary head disabled.'); }
      });
      data.deductionTypes.forEach(type => {
        const assigned = currentDeductions.get(type.id);
        const enabled = form.get(`ded:${type.id}`) !== null;
        if (enabled) HR.upsert('employeeDeductions', { id: assigned?.id, employeeId, deductionTypeId: type.id, amount: HR.num(form.get(`dedAmount:${type.id}`)), isEnrolled: true }, { manageOnly: true });
        else if (assigned) { assigned.isEnrolled = false; HR.audit('employeeDeductions', assigned.id, 'UPDATE', null, assigned, 'Deduction disabled.'); }
      });
      await HR.persist();
    } });
  }

  function salaryHeadModal(id = '') {
    const row = HR.ensureState().salaryHeads.find(item => item.id === id) || {};
    modalForm({ title: `${id ? 'Edit' : 'Add'} salary head`, body: `${field('Code', 'code', row.code || '', 'text', 'required')}${field('Name', 'name', row.name || '', 'text', 'required')}${select('Calculation', 'calcType', [['fixed', 'Fixed'], ['percent_of_basic', 'Percent of basic']], row.calcType || 'fixed')}${field('Default amount', 'defaultAmount', row.defaultAmount || 0, 'number', 'min="0" step="0.01"')}${field('Percent of basic', 'percentOfBasic', row.percentOfBasic || 0, 'number', 'min="0" step="0.01"')}${select('Frequency', 'frequency', [['monthly', 'Monthly'], ['annual', 'Annual'], ['festival', 'Festival'], ['onetime', 'One time']], row.frequency || 'monthly')}${field('Pay BS month (optional)', 'payBsMonth', row.payBsMonth || '', 'number', 'min="1" max="12"')}`, onSubmit: async form => {
      HR.upsert('salaryHeads', { id: row.id, code: String(val(form, 'code')).trim().toUpperCase(), name: String(val(form, 'name')).trim(), calcType: val(form, 'calcType'), defaultAmount: HR.num(val(form, 'defaultAmount')), percentOfBasic: HR.num(val(form, 'percentOfBasic')), frequency: val(form, 'frequency'), payBsMonth: val(form, 'payBsMonth') ? Number(val(form, 'payBsMonth')) : '' }, { manageOnly: true });
      await HR.persist();
    } });
  }

  function deductionTypeModal(id = '') {
    const row = HR.ensureState().deductionTypes.find(item => item.id === id) || {};
    modalForm({ title: `${id ? 'Edit' : 'Add'} deduction type`, body: `${field('Code', 'code', row.code || '', 'text', 'required')}${field('Name', 'name', row.name || '', 'text', 'required')}${select('Calculation', 'calcType', [['fixed', 'Fixed'], ['percent_of_basic', 'Percent of basic']], row.calcType || 'fixed')}${field('Default amount', 'defaultAmount', row.defaultAmount || 0, 'number', 'min="0" step="0.01"')}${field('Percent of basic', 'percentOfBasic', row.percentOfBasic || 0, 'number', 'min="0" step="0.01"')}${field('Cap amount', 'capAmount', row.capAmount || 0, 'number', 'min="0" step="0.01"')}${checkbox('Pre-tax deduction', 'isPretax', Boolean(row.isPretax))}`, onSubmit: async form => {
      HR.upsert('deductionTypes', { id: row.id, code: String(val(form, 'code')).trim().toUpperCase(), name: String(val(form, 'name')).trim(), calcType: val(form, 'calcType'), defaultAmount: HR.num(val(form, 'defaultAmount')), percentOfBasic: HR.num(val(form, 'percentOfBasic')), capAmount: HR.num(val(form, 'capAmount')), isPretax: bool(form, 'isPretax') }, { manageOnly: true });
      await HR.persist();
    } });
  }

  function fiscalModal(id = '') {
    const data = HR.ensureState();
    const row = data.fiscalYears.find(item => item.id === id) || {};
    modalForm({ title: `${id ? 'Edit' : 'Add'} fiscal year`, body: `${field('Name / FY label', 'name', row.name || row.fiscalYearBs || '', 'text', 'required placeholder="2083/84"')}${field('BS start', 'startBs', row.startBs || '', 'text', 'placeholder="2083-04-01"')}${field('BS end', 'endBs', row.endBs || '', 'text', 'placeholder="2084-03-32"')}${field('AD start', 'startAd', row.startAd || '', 'date')}${field('AD end', 'endAd', row.endAd || '', 'date')}${field('Fiscal start BS month', 'startBsMonth', row.startBsMonth || 4, 'number', 'min="1" max="12"')}${select('Status', 'status', [['upcoming', 'Upcoming'], ['active', 'Active'], ['closed', 'Closed'], ['locked', 'Locked']], row.status || 'upcoming')}`, onSubmit: async form => {
      const nextStatus = val(form, 'status');
      if (nextStatus === 'active') data.fiscalYears.filter(item => item.id !== row.id && item.status === 'active').forEach(item => { item.status = 'closed'; item.updatedAt = HR.stamp(); });
      HR.upsert('fiscalYears', { id: row.id, name: String(val(form, 'name')).trim(), fiscalYearBs: String(val(form, 'name')).trim(), startBs: val(form, 'startBs'), endBs: val(form, 'endBs'), startAd: val(form, 'startAd'), endAd: val(form, 'endAd'), startBsMonth: Number(val(form, 'startBsMonth')) || 4, status: nextStatus }, { manageOnly: true });
      await HR.persist();
    } });
  }

  function taxSetModal(id = '') {
    const data = HR.ensureState();
    const row = data.taxSlabSets.find(item => item.id === id) || {};
    const bandsText = HR.arr(row.bands).sort((a, b) => HR.num(a.order) - HR.num(b.order)).map(item => `${item.width === null || item.width === '' ? '*' : item.width}|${item.rate}`).join('\n');
    modalForm({ title: `${id ? 'Edit' : 'Add'} tax slab set`, copy: 'Enter one band per line as width|rate. Use * for the final remainder band, for example 500000|1 then *|20.', body: `${select('Fiscal year', 'fiscalYearId', [['', 'Select fiscal year'], ...data.fiscalYears.map(item => [item.id, item.name || item.fiscalYearBs])], row.fiscalYearId, 'required')}${select('Tax group', 'maritalStatus', [['ALL', 'Unified / all'], ['single', 'Single'], ['married', 'Married']], row.maritalStatus || 'ALL')}<label class="hrms-field hrms-span-2"><span>Bands</span><textarea name="bands" rows="8" required>${esc(bandsText)}</textarea></label><label class="hrms-field hrms-span-2"><span>Enacted source / review note</span><textarea name="sourceNote" rows="3">${esc(row.sourceNote || '')}</textarea></label>${checkbox('Confirmed against enacted source', 'confirmed', Boolean(row.confirmed))}`, onSubmit: async form => {
      const bands = String(val(form, 'bands')).split(/\r?\n/).filter(Boolean).map((line, index) => {
        const [widthText, rateText] = line.split('|').map(value => value.trim());
        if (!rateText || !Number.isFinite(Number(rateText))) throw new Error(`Invalid rate on band ${index + 1}.`);
        return { order: index + 1, width: widthText === '*' ? null : Number(widthText), rate: Number(rateText) };
      });
      if (!bands.length || bands.at(-1).width !== null) throw new Error('The final tax band must use * for the remainder.');
      const confirmed = bool(form, 'confirmed');
      if (confirmed && !String(val(form, 'sourceNote')).trim()) throw new Error('A source/review note is required before confirmation.');
      HR.upsert('taxSlabSets', { id: row.id, fiscalYearId: val(form, 'fiscalYearId'), maritalStatus: val(form, 'maritalStatus'), bands, sourceNote: String(val(form, 'sourceNote')).trim(), confirmed, confirmedAt: confirmed ? HR.stamp() : '', confirmedBy: confirmed ? (window.FormcraftBackend?.session?.user?.email || 'workspace admin') : '' }, { manageOnly: true });
      await HR.persist();
    } });
  }

  function generatePayrollModal() {
    const data = HR.ensureState();
    const active = data.fiscalYears.find(item => item.status === 'active');
    modalForm({ title: 'Generate payroll', copy: 'Generation persists an attendance snapshot and per-head/per-deduction detail. Later configuration changes do not rewrite this run.', body: `${select('Fiscal year', 'fiscalYearId', data.fiscalYears.map(item => [item.id, `${item.name || item.fiscalYearBs} - ${item.status}`]), active?.id || '', 'required')}${field('BS year', 'bsYear', uiState().bsYear, 'number', 'required min="2000" max="2200"')}${field('BS month', 'bsMonth', uiState().bsMonth, 'number', 'required min="1" max="12"')}${field('Run name (optional)', 'name', '')}`, submit: 'Generate', onSubmit: async form => {
      const result = HR.generatePayroll({ fiscalYearId: val(form, 'fiscalYearId'), bsYear: Number(val(form, 'bsYear')), bsMonth: Number(val(form, 'bsMonth')), name: String(val(form, 'name')).trim() });
      await HR.persist();
      uiState().payrollRunId = result.run.id;
      uiState().tabs.payroll = 'payslips';
      toast(`${result.items.length} payslips generated.`);
    } });
  }

  function payslipMarkup(data) {
    if (!data) return '';
    const { item, heads, deductions, attendance, run, employee } = data;
    return `<article class="hrms-payslip"><header><div><p>Formcraft payroll</p><h1>${esc(run?.name || 'Payslip')}</h1><span>${esc(dateLabel(item.periodStart))} - ${esc(dateLabel(item.periodEnd))}</span></div><div class="hrms-payslip-employee"><strong>${esc(employee?.name || item.employeeName)}</strong><span>${esc(employee?.employeeCode || item.employeeCode || '')}</span></div></header><section class="hrms-payslip-summary"><div><span>Gross</span><strong>${esc(money(item.gross))}</strong></div><div><span>Tax</span><strong>${esc(money(item.tax))}</strong></div><div><span>Total deductions</span><strong>${esc(money(HR.num(item.pretaxDeductions) + HR.num(item.postTaxDeductions) + HR.num(item.tax)))}</strong></div><div><span>Net pay</span><strong>${esc(money(item.netPay))}</strong></div></section><div class="hrms-grid hrms-grid-2"><section><h2>Earnings</h2><table><tbody>${heads.map(head => `<tr><td>${esc(head.name)}</td><td>${esc(money(head.amount))}</td></tr>`).join('')}<tr><th>Overtime</th><th>${esc(money(HR.num(item.formula?.regularOtPay) + HR.num(item.formula?.holidayOtPay)))}</th></tr></tbody></table></section><section><h2>Deductions</h2><table><tbody>${deductions.map(row => `<tr><td>${esc(row.name)}${row.isPretax ? ' (pre-tax)' : ''}</td><td>${esc(money(row.amount))}</td></tr>`).join('')}<tr><td>Income tax</td><td>${esc(money(item.tax))}</td></tr></tbody></table></section></div><section><h2>Attendance snapshot</h2><div class="hrms-payslip-attendance"><span>Working ${attendance?.workingDays ?? 0}</span><span>Present ${attendance?.presentDays ?? 0}</span><span>Paid leave ${attendance?.paidLeaveDays ?? 0}</span><span>Unpaid leave ${attendance?.unpaidLeaveDays ?? 0}</span><span>Paid Kaaj ${attendance?.kaajPaidDays ?? 0}</span><span>Unpaid Kaaj ${attendance?.kaajUnpaidDays ?? 0}</span><span>Absent ${attendance?.absentDays ?? 0}</span><span>OT ${HR.round((HR.num(attendance?.regularOtMinutes) + HR.num(attendance?.holidayOtMinutes)) / 60)}h</span></div></section><section><h2>Tax calculation</h2><p>Projected annual taxable income: <strong>${esc(money(item.projectedAnnualIncome))}</strong>. Projected annual tax: <strong>${esc(money(item.projectedAnnualTax))}</strong>. Tax withheld this month: <strong>${esc(money(item.tax))}</strong>.</p><table><thead><tr><th>Band</th><th>Rate</th><th>Taxable</th><th>Tax</th></tr></thead><tbody>${HR.arr(item.formula?.slabBreakdown).map(row => `<tr><td>${esc(money(row.from))} - ${esc(money(row.to))}</td><td>${esc(row.rate)}%</td><td>${esc(money(row.amount))}</td><td>${esc(money(row.tax))}</td></tr>`).join('')}</tbody></table></section></article>`;
  }

  function openPayslip(runId, employeeId) {
    const data = HR.payslip(runId, employeeId);
    if (!data) return toast('Payslip not found.', 'error');
    openModal(`<div class="modal-card hrms-modal hrms-payslip-modal"><div class="modal-head"><div><p class="modal-eyebrow">Payroll</p><h2 id="modal-title">Payslip</h2></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div><div class="modal-body">${payslipMarkup(data)}</div><div class="modal-actions"><button class="button button-secondary" type="button" data-hrms-print-payslip data-run-id="${esc(runId)}" data-employee-id="${esc(employeeId)}">Print / PDF</button><button class="button button-primary" type="button" data-close-modal>Done</button></div></div>`);
  }

  function printDocument(title, html, landscape = false) {
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return toast('Allow popups to print this report.', 'warning');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:${landscape ? 'A3 landscape' : 'A4 portrait'};margin:12mm}body{font-family:Arial,sans-serif;color:#111;font-size:11px}h1,h2{margin:0 0 10px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:5px;text-align:left}small{display:block;color:#555}.hrms-payslip-summary,.hrms-payslip-attendance{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}.hrms-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.hrms-hajiri{font-size:8px}.hrms-hajiri th,.hrms-hajiri td{padding:3px;text-align:center}</style></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 150);
  }

  function exportReport(kind, format) {
    const year = uiState().bsYear;
    const month = uiState().bsMonth;
    if (kind === 'daily') {
      const rows = HR.dailyReport(uiState().date);
      return HR.exportRows(`attendance-daily-${uiState().date}`, rows, [
        { label: 'Employee code', value: row => row.employee.employeeCode || '' }, { label: 'Employee', value: row => row.employee.name }, { label: 'Organization', value: 'organization' }, { label: 'Shift', value: row => row.shift?.name || '' }, { label: 'Status', value: row => row.status.label }, { label: 'Check in', value: 'checkIn' }, { label: 'Check out', value: 'checkOut' }, { label: 'Hours', value: 'hours' }, { label: 'Overtime', value: 'overtime' }, { label: 'Late minutes', value: 'lateMinutes' }, { label: 'Early out minutes', value: 'earlyMinutes' }
      ], format);
    }
    if (kind === 'monthly') {
      const report = HR.monthlyReport(year, month);
      return HR.exportRows(`attendance-monthly-${year}-${month}`, report.rows, [
        { label: 'Employee code', value: row => row.employee.employeeCode || '' }, { label: 'Employee', value: row => row.employee.name }, { label: 'Organization', value: 'organization' }, { label: 'Shift', value: row => HR.shiftForEmployee(row.employee)?.name || '' }, { label: 'Planned days', value: 'plannedDays' }, { label: 'Actual days', value: 'actualDays' }, { label: 'Present', value: 'present' }, { label: 'Leave', value: 'leave' }, { label: 'Kaaj', value: 'kaaj' }, { label: 'Absent', value: 'absent' }, { label: 'Weekly off', value: 'weeklyOff' }, { label: 'Holidays', value: 'holidays' }, { label: 'Work hours', value: 'workHours' }, { label: 'OT hours', value: 'overtimeHours' }, { label: 'Late days', value: 'lateDays' }, { label: 'Late minutes', value: 'lateMinutes' }, { label: 'Early days', value: 'earlyDays' }, { label: 'Early out minutes', value: 'earlyMinutes' }
      ], format);
    }
    if (kind === 'absent') {
      const rows = HR.absentReport(year, month);
      return HR.exportRows(`attendance-absent-${year}-${month}`, rows, [
        { label: 'Date', value: 'date' }, { label: 'BS date', value: row => NP?.bsLabel?.(row.date) || '' }, { label: 'Employee code', value: row => row.employee.employeeCode || '' }, { label: 'Employee', value: row => row.employee.name }, { label: 'Organization', value: 'organization' }
      ], format);
    }
    if (kind === 'departments') {
      const rows = HR.departmentSummary(year, month);
      return HR.exportRows(`attendance-departments-${year}-${month}`, rows, [
        { label: 'Department', value: 'name' }, { label: 'Employees', value: 'employees' }, { label: 'Present', value: 'present' }, { label: 'Leave', value: 'leave' }, { label: 'Kaaj', value: 'kaaj' }, { label: 'Absent', value: 'absent' }, { label: 'OT hours', value: 'overtimeHours' }
      ], format);
    }
    if (kind === 'hajiri') {
      const report = HR.monthlyReport(year, month);
      const columns = [{ label: 'Employee code', value: row => row.employee.employeeCode || '' }, { label: 'Employee', value: row => row.employee.name }, ...report.dates.map((date, index) => ({ label: NP?.bsParts?.(date)?.day || date, value: row => row.cells[index]?.status?.code || '' })), { label: 'Present', value: 'present' }, { label: 'Leave', value: 'leave' }, { label: 'Kaaj', value: 'kaaj' }, { label: 'Absent', value: 'absent' }, { label: 'OT hours', value: 'overtimeHours' }];
      return HR.exportRows(`hajiri-${year}-${month}`, report.rows, columns, format);
    }
    if (kind === 'annual') {
      const rows = HR.annualPayrollSummary(uiState().fiscalYearId || HR.ensureState().fiscalYears.find(item => item.status === 'active')?.id);
      return HR.exportRows('payroll-annual-summary', rows, [{ label: 'Employee code', value: 'employeeCode' }, { label: 'Employee', value: 'employeeName' }, { label: 'Months', value: 'months' }, { label: 'Gross', value: 'gross' }, { label: 'Taxable', value: 'taxable' }, { label: 'Tax', value: 'tax' }, { label: 'Deductions', value: 'deductions' }, { label: 'Net pay', value: 'netPay' }], format);
    }
  }

  function printReport(kind) {
    if (kind === 'daily') {
      const rows = HR.dailyReport(uiState().date);
      return printDocument(`Daily attendance ${uiState().date}`, `<h1>Daily attendance - ${esc(dateLabel(uiState().date))}</h1><table><thead><tr><th>Employee</th><th>Status</th><th>In</th><th>Out</th><th>Hours</th><th>OT</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.employee.name)}</td><td>${esc(row.status.label)}</td><td>${esc(row.checkIn)}</td><td>${esc(row.checkOut)}</td><td>${row.hours}</td><td>${row.overtime}</td></tr>`).join('')}</tbody></table>`);
    }
    if (kind === 'monthly') {
      const report = HR.monthlyReport(uiState().bsYear, uiState().bsMonth);
      return printDocument(`Monthly attendance ${report.range.label}`, `<h1>Monthly attendance - ${esc(report.range.label)}</h1><table><thead><tr><th>Employee</th><th>Present</th><th>Leave</th><th>Kaaj</th><th>Absent</th><th>Weekly off</th><th>Holiday</th><th>OT</th></tr></thead><tbody>${report.rows.map(row => `<tr><td>${esc(row.employee.name)}</td><td>${row.present}</td><td>${row.leave}</td><td>${row.kaaj || 0}</td><td>${row.absent}</td><td>${row.weeklyOff}</td><td>${row.holidays}</td><td>${row.overtimeHours}</td></tr>`).join('')}</tbody></table>`);
    }
    if (kind === 'hajiri') {
      const report = HR.monthlyReport(uiState().bsYear, uiState().bsMonth);
      return printDocument(`Hajiri ${report.range.label}`, `<h1>Hajiri - ${esc(report.range.label)}</h1><table class="hrms-hajiri"><thead><tr><th>Employee</th>${report.dates.map(date => `<th>${esc(NP?.bsParts?.(date)?.day || date.slice(-2))}</th>`).join('')}<th>P</th><th>L</th><th>A</th></tr></thead><tbody>${report.rows.map(row => `<tr><td>${esc(row.employee.name)}</td>${row.cells.map(cell => `<td>${esc(cell.status.display || cell.status.code)}</td>`).join('')}<td>${row.present}</td><td>${row.leave}</td><td>${row.absent}</td></tr>`).join('')}</tbody></table>`, true);
    }
    if (kind === 'annual') {
      const rows = HR.annualPayrollSummary(uiState().fiscalYearId || HR.ensureState().fiscalYears.find(item => item.status === 'active')?.id);
      return printDocument('Annual payroll summary', `<h1>Annual payroll summary</h1><table><thead><tr><th>Employee</th><th>Gross</th><th>Taxable</th><th>Tax</th><th>Deductions</th><th>Net</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.employeeName)}</td><td>${esc(money(row.gross))}</td><td>${esc(money(row.taxable))}</td><td>${esc(money(row.tax))}</td><td>${esc(money(row.deductions))}</td><td>${esc(money(row.netPay))}</td></tr>`).join('')}</tbody></table>`);
    }
  }

  document.addEventListener('click', async event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const tab = target.closest('[data-hrms-tab]');
    if (tab) { event.preventDefault(); setTab(tab.dataset.hrmsModule, tab.dataset.hrmsTab); return; }
    if (target.closest('[data-hrms-add-hierarchy]')) return hierarchyModal(target.closest('[data-hrms-add-hierarchy]').dataset.hrmsAddHierarchy);
    if (target.closest('[data-hrms-edit-hierarchy]')) { const button = target.closest('[data-hrms-edit-hierarchy]'); return hierarchyModal(button.dataset.hrmsEditHierarchy, button.dataset.id); }
    if (target.closest('[data-hrms-assign-org]')) return organizationAssignmentModal(target.closest('[data-hrms-assign-org]').dataset.hrmsAssignOrg);
    if (target.closest('[data-hrms-add-shift]')) return shiftModal();
    if (target.closest('[data-hrms-edit-shift]')) return shiftModal(target.closest('[data-hrms-edit-shift]').dataset.hrmsEditShift);
    if (target.closest('[data-hrms-add-shift-rule]')) return shiftRuleModal();
    if (target.closest('[data-hrms-link-device-user]')) return linkDeviceUserModal(target.closest('[data-hrms-link-device-user]').dataset.hrmsLinkDeviceUser);
    if (target.closest('[data-hrms-sync-directory]')) return syncDirectoryModal();
    if (target.closest('[data-hrms-delete-device-user]')) return deleteDeviceUser(target.closest('[data-hrms-delete-device-user]').dataset.hrmsDeleteDeviceUser);
    if (target.closest('[data-hrms-import-device-users]')) return importUnlinkedDeviceUsers();
    if (target.closest('[data-hrms-delete-device]')) return deleteDevice(target.closest('[data-hrms-delete-device]').dataset.hrmsDeleteDevice);
    const remarkButton = target.closest('[data-hrms-day-remark]');
    if (remarkButton) return dayRemarkModal(remarkButton.dataset.hrmsDayRemark, remarkButton.dataset.date);
    if (target.closest('[data-hrms-add-auto-attend]')) return autoAttendRuleModal();
    if (target.closest('[data-hrms-edit-auto-attend]')) return autoAttendRuleModal(target.closest('[data-hrms-edit-auto-attend]').dataset.hrmsEditAutoAttend);
    if (target.closest('[data-hrms-push-auto-attend]')) { try { await pushAutoAttendRules(); } catch (error) { toast(error.message || 'Automatic-attendance rules could not be queued.', 'error'); } return; }
    if (target.closest('[data-hrms-manual-attendance]')) return manualAttendanceModal();
    if (target.closest('[data-hrms-import-attendance]')) return attendanceImportModal();
    if (target.closest('[data-hrms-refresh-punches]')) { await loadRawPunches(true); return; }
    if (target.closest('[data-hrms-create-bridge]')) {
      try { const result = await HR.createBridge('Office bridge'); bridgeCredentialModal(result); await loadBridge(true); } catch (error) { toast(error.message || 'Bridge credential could not be created.', 'error'); }
      return;
    }
    if (target.closest('[data-hrms-add-device]')) return deviceModal();
    if (target.closest('[data-hrms-edit-device]')) { const id = target.closest('[data-hrms-edit-device]').dataset.hrmsEditDevice; return deviceModal(uiState().bridge?.devices.find(item => item.id === id)); }
    if (target.closest('[data-hrms-historical-pull]')) return historicalPullModal(target.closest('[data-hrms-historical-pull]').dataset.hrmsHistoricalPull);
    if (target.closest('[data-hrms-set-device-secret]')) return deviceSecretModal(target.closest('[data-hrms-set-device-secret]').dataset.hrmsSetDeviceSecret);
    if (target.closest('[data-hrms-migrate-device-users]')) return migrateModal();
    const command = target.closest('[data-hrms-device-command]');
    if (command) {
      try { await HR.queueDeviceCommand(command.dataset.hrmsDeviceCommand, { deviceId: command.dataset.deviceId }); toast(`${command.dataset.hrmsDeviceCommand} queued.`); await loadBridge(true); } catch (error) { toast(error.message || 'Device command failed.', 'error'); }
      return;
    }
    if (target.closest('[data-hrms-sync-bridge]')) {
      try { const result = await HR.syncBridgeAttendance(); toast(`${result.punches} bridge punches synchronized into ${result.attendanceRecords} Attendance records.`); renderShell(); } catch (error) { toast(error.message || 'Bridge sync failed.', 'error'); }
      return;
    }
    if (target.closest('[data-hrms-add-schedule]')) {
      const input = document.querySelector('[data-hrms-new-schedule-time]');
      const time = input?.value;
      if (!time) return toast('Choose a pull time.', 'warning');
      const times = new Set(HR.ensureState().bridge.scheduleTimes); times.add(time); HR.ensureState().bridge.scheduleTimes = [...times].sort();
      try { await HR.persist(); await HR.queueDeviceCommand('set-schedule', { payload: { times: HR.ensureState().bridge.scheduleTimes, timezone: HR.TIME_ZONE } }); toast('Pull schedule queued.'); renderShell(); } catch (error) { toast(error.message || 'Schedule could not be saved.', 'error'); }
      return;
    }
    const removeTime = target.closest('[data-hrms-remove-schedule]');
    if (removeTime) {
      HR.ensureState().bridge.scheduleTimes = HR.ensureState().bridge.scheduleTimes.filter(item => item !== removeTime.dataset.hrmsRemoveSchedule);
      try { await HR.persist(); await HR.queueDeviceCommand('set-schedule', { payload: { times: HR.ensureState().bridge.scheduleTimes, timezone: HR.TIME_ZONE } }); renderShell(); } catch (error) { toast(error.message || 'Schedule could not be updated.', 'error'); }
      return;
    }
    if (target.closest('[data-hrms-add-leave-type]')) return leaveTypeModal();
    if (target.closest('[data-hrms-edit-leave-type]')) return leaveTypeModal(target.closest('[data-hrms-edit-leave-type]').dataset.hrmsEditLeaveType);
    const bal = target.closest('[data-hrms-edit-leave-balance]');
    if (bal) return leaveBalanceModal(bal.dataset.employeeId, bal.dataset.leaveTypeId);
    if (target.closest('[data-hrms-add-holiday]')) return holidayModal();
    if (target.closest('[data-hrms-add-holiday-type]')) return holidayTypeModal();
    if (target.closest('[data-hrms-edit-holiday-type]')) return holidayTypeModal(target.closest('[data-hrms-edit-holiday-type]').dataset.hrmsEditHolidayType);
    const deleteHoliday = target.closest('[data-hrms-delete-holiday]');
    if (deleteHoliday) {
      if (!HR.canManage()) return;
      NP.removeHoliday(deleteHoliday.dataset.hrmsDeleteHoliday); await HR.persist(); renderShell(); toast('Holiday removed.'); return;
    }
    if (target.closest('[data-hrms-add-kaaj]')) return kaajModal();
    if (target.closest('[data-hrms-edit-kaaj]')) return kaajModal(target.closest('[data-hrms-edit-kaaj]').dataset.hrmsEditKaaj);
    if (target.closest('[data-hrms-edit-salary]')) return salaryModal(target.closest('[data-hrms-edit-salary]').dataset.hrmsEditSalary);
    if (target.closest('[data-hrms-add-salary-head]')) return salaryHeadModal();
    if (target.closest('[data-hrms-edit-salary-head]')) return salaryHeadModal(target.closest('[data-hrms-edit-salary-head]').dataset.hrmsEditSalaryHead);
    if (target.closest('[data-hrms-add-deduction-type]')) return deductionTypeModal();
    if (target.closest('[data-hrms-edit-deduction-type]')) return deductionTypeModal(target.closest('[data-hrms-edit-deduction-type]').dataset.hrmsEditDeductionType);
    if (target.closest('[data-hrms-add-fiscal]')) return fiscalModal();
    if (target.closest('[data-hrms-edit-fiscal]')) return fiscalModal(target.closest('[data-hrms-edit-fiscal]').dataset.hrmsEditFiscal);
    if (target.closest('[data-hrms-add-holiday-ot]')) return holidayOtModal();
    if (target.closest('[data-hrms-edit-holiday-ot]')) return holidayOtModal(target.closest('[data-hrms-edit-holiday-ot]').dataset.hrmsEditHolidayOt);
    if (target.closest('[data-hrms-add-tax-set]')) return taxSetModal();
    if (target.closest('[data-hrms-edit-tax-set]')) return taxSetModal(target.closest('[data-hrms-edit-tax-set]').dataset.hrmsEditTaxSet);
    if (target.closest('[data-hrms-generate-payroll]')) return generatePayrollModal();
    const payslipButton = target.closest('[data-hrms-open-payslip]');
    if (payslipButton) return openPayslip(payslipButton.dataset.runId, payslipButton.dataset.employeeId);
    const printPayslip = target.closest('[data-hrms-print-payslip]');
    if (printPayslip) { const data = HR.payslip(printPayslip.dataset.runId, printPayslip.dataset.employeeId); if (data) printDocument('Payslip', payslipMarkup(data)); return; }
    const printRun = target.closest('[data-hrms-print-run]');
    if (printRun) { const items = HR.payrollItemsForRun(printRun.dataset.hrmsPrintRun); printDocument('Payroll run payslips', items.map(item => payslipMarkup(HR.payslip(item.runId, item.employeeId))).join('<div style="page-break-after:always"></div>')); return; }
    const exportButton = target.closest('[data-hrms-export]');
    if (exportButton) return exportReport(exportButton.dataset.hrmsExport, exportButton.dataset.format || 'csv');
    const printButton = target.closest('[data-hrms-print]');
    if (printButton) return printReport(printButton.dataset.hrmsPrint);
    const deleteRecord = target.closest('[data-hrms-delete-record]');
    if (deleteRecord && HR.canManage()) { HR.remove(deleteRecord.dataset.hrmsDeleteRecord, deleteRecord.dataset.id, { manageOnly: true }); await HR.persist(); renderShell(); return; }
  }, true);

  document.addEventListener('change', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.matches('[data-hrms-report-date]')) { uiState().date = target.value; renderShell(); return; }
    if (target.matches('[data-hrms-bs-year]')) { uiState().bsYear = Number(target.value) || ''; renderShell(); return; }
    if (target.matches('[data-hrms-bs-month]')) { uiState().bsMonth = Number(target.value) || ''; renderShell(); return; }
    if (target.matches('[data-hrms-payroll-run]')) { uiState().payrollRunId = target.value; renderShell(); return; }
    if (target.matches('[data-hrms-annual-fiscal]')) { uiState().fiscalYearId = target.value; renderShell(); }
  });

  document.addEventListener('input', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.matches('[data-hrms-audit-search]')) {
      uiState().auditQuery = target.value;
      clearTimeout(uiState().auditTimer);
      uiState().auditTimer = setTimeout(() => { renderShell(); requestAnimationFrame(() => { const input = document.querySelector('[data-hrms-audit-search]'); input?.focus(); input?.setSelectionRange(input.value.length, input.value.length); }); }, 150);
    }
  });

  const priorShell = renderShell;
  renderShell = function renderShellWithHRMS(...args) {
    HR.ensureState();
    HR.extendEmployeeSchema?.();
    HR.extendTimeOffSchema?.();
    HR.refreshTimeOffOptions();
    return priorShell.apply(this, args);
  };

  window.FormcraftHRMSUI = Object.freeze({ MODULE_TABS, setTab, loadBridge, loadRawPunches, renderAdvanced, payslipMarkup });
})();
