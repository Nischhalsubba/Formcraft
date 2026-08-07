# Formcraft HRMS and ZKTeco Integration

## Product rule: additive only

This integration follows Variant A. Existing Formcraft modules remain the source of truth and keep their existing Records pages and record-detail renderer.

- **Employees** remains the employee master. HR profile, organization, shift and device identity fields extend normal Employee records.
- **Attendance** remains the daily attendance record. Raw reader punches, imports, manual entries, Kaaj, holiday rules and reports materialize into or read from those records.
- **Time Off** remains the leave-request workflow. Leave catalogs, balances, half-days, holiday types and Kaaj extend it without creating a second leave application system.
- **Payroll** remains the payroll-run module. Advanced runs add persisted attendance, earnings, deduction and tax snapshots behind normal Payroll records.
- Existing Projects, Tasks, CRM, Sales, Files, Invoices, Finance, Operations and all other modules are not replaced or made dependent on the biometric bridge.

## Hosted app and LAN bridge

The Netlify-hosted browser never connects directly to a private ZKTeco IP address. Direct device work is performed by the optional `device-bridge/` service on a machine that can reach the office reader network.

```text
ZKTeco readers <-> Formcraft Device Bridge <-> Supabase <-> Netlify-hosted Formcraft
```

The hosted app keeps working if the bridge is stopped, the LAN is down, or a reader times out. Only device synchronization becomes unavailable.

### Security

- Supabase Auth remains the only Formcraft web login system. A second HRMS password database is not introduced.
- The bridge uses the Supabase publishable key plus a high-entropy, workspace-scoped bridge token.
- No service-role credential is used by the browser or bridge.
- ZKTeco Comm Keys stay in the bridge's local state and are never stored in the hosted workspace.
- Fingerprint templates used for backup and migration stay on the bridge machine and are not uploaded to Formcraft.
- Bridge tables use workspace Row-Level Security, while bridge RPCs validate the hashed bridge token.

## Variant A tabs

The first tab is always **Records**, which calls the existing Formcraft ERP renderer.

### Employees

Records, Organization, Device identities, Shifts.

### Attendance

Records, Overview, Devices, Daily, Raw punches, Monthly, Absent, Departments, Hajiri, Pull sessions, Schedule, Auto attendance, Audit.

### Time Off

Records, Balances, Leave types, Holidays, Holiday types, Kaaj / field duty.

### Payroll

Records, Attendance review, Payslips, Salary setup, Heads & deductions, Tax slabs, Fiscal years, Holiday OT, Annual summary.

## ZKTeco device capabilities

The local bridge supports reader testing, TCP/UDP, per-device timeout, Comm Key, pull, scheduled pulls, historical month/range pulls, user discovery, user push/update/delete, backup, fingerprint-aware device-to-device migration, pull diagnostics, local rotating logs, and source-tagged automatic-attendance rules.

Raw punch rows are deduplicated in the bridge tables. Hosted Formcraft then materializes them into existing Attendance records. Device-generated and automatic-attendance punches retain distinct source tags.

## Attendance and reporting

- Nepal time (`Asia/Kathmandu`)
- BS/AD display through the existing Formcraft Nepal date layer
- CSV, JSON and XLSX imports
- raw punch duplicate filtering
- controlled daily bulk imports with reason + approver
- manual attendance with reason + approver
- holiday and weekly-off evaluation
- Kaaj / field-duty classification
- attendance-day remarks
- shifts, grace periods, late-in and early-out
- daily report
- detailed monthly report
- monthly department summary
- absence report
- Hajiri cross-tab
- CSV / SpreadsheetML Excel export
- print/PDF-friendly report output

## Leave and holiday capability

Configured leave types support annual allocation, opening balance, earned days, carry-forward, accumulation limits, paid/unpaid status, half-day eligibility, display code/color, applicability, and policy notes. Existing Time Off requests gain half-day fields rather than being replaced.

Holiday types extend the shared Nepal compliance holiday calendar. Kaaj remains an operational field-duty classification rather than being silently converted into a leave entitlement.

## Payroll

Advanced payroll remains fiscal-year scoped and writes a normal Payroll record plus immutable HRMS snapshots:

- fiscal-year lifecycle
- configurable tax slab sets and bands with explicit confirmation/source note
- salary-head catalog and per-employee assignments
- deduction catalog and enrollment/overrides
- salary structures
- regular and holiday OT multipliers
- attendance snapshot per employee/run
- earnings and deductions snapshot per payslip
- cumulative projected annual TDS calculation
- payslip detail and formula transparency
- combined print/PDF view
- annual payroll summary and export

Historical advanced payroll snapshots are not rewritten when later catalogs or rates are edited.

## Deployment order

1. Merge/deploy the web assets. The hosted app remains safe even before the bridge schema exists and shows an isolated setup state on device-only tabs.
2. Apply `supabase/migrations/20260807170000_hrms_zkteco_bridge.sql` to the Formcraft Supabase project.
3. Create a bridge credential from Attendance > Devices.
4. Install `device-bridge/` on a LAN machine and add the one-time credential to its `.env`.
5. Add readers and set their Comm Keys from Formcraft.
6. Test and pull each device, then verify raw punches and materialized Attendance records before enabling schedules.

## Guarded production activation workflow

`.github/workflows/hrms-production-activation.yml` provides a manual production migration path. It never runs automatically on a push or Netlify deploy.

Configure the GitHub `production` environment with these encrypted secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID`

Run the workflow with **preflight** first. It links the Supabase CLI to the configured project, runs `supabase db push --dry-run`, prints the remote/local migration list, and uploads the evidence as an Actions artifact.

Only after reviewing that evidence should an operator run the workflow with **apply** and type the exact confirmation phrase `APPLY_HRMS_ZKTECO_PRODUCTION`. The apply path runs the same preflight first and then executes `supabase db push --yes`, followed by another migration-list verification.

This workflow deploys database migrations only. It does not deploy Netlify, create a bridge credential, store ZKTeco Comm Keys, or claim that a physical reader has passed acceptance testing.

## Production acceptance boundary

The repository CI now certifies the Variant A browser behavior and the installable Python bridge package without contacting a physical reader. Production acceptance still requires a LAN machine that can reach each target ZKTeco device.

For each real reader, verify at minimum:

1. Bridge heartbeat appears online in Attendance > Devices.
2. **Test** succeeds using the configured protocol, port, timeout, and Comm Key.
3. A manual **Pull** creates a pull session and raw punches without duplicates.
4. Device users can be compared with Employees without deleting or replacing Employee records.
5. **Backup** writes a local backup and does not upload fingerprint templates to Formcraft.
6. If migration is required, perform it first with a non-critical test user and verify the destination reader before migrating the remainder.
7. **Sync bridge punches** materializes the expected daily Attendance records and reports.
8. Payroll attendance review matches the same Attendance source of truth before any live payroll run is approved.
9. Scheduled pulls are enabled only after manual pulls are stable.
10. Stop the bridge service and confirm Projects, CRM, Finance, Employees, Time Off, Payroll records, and the rest of hosted Formcraft continue working normally.

Physical-reader behavior must be acceptance-tested against the actual reader models before an organization relies on it for payroll.
