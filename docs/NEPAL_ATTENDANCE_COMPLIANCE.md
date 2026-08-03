# Nepal attendance and compliance center

## Purpose

Formcraft uses selected attendance and Nepal-operating patterns identified in the public `sanamsitoula/ZKTecoAttendancePuller` repository and the uploaded project archive. It does **not** become an HRMS.

The feature adds an operational evidence layer for attendance, holidays, approved leave, overtime limits, substitute leave, current-fiscal-year safeguards and a Nepali Hajiri register. It remains connected to Formcraft's existing Employees, Attendance, Time Off, Payroll and audit surfaces instead of duplicating employee administration.

## Not an HRMS

Included:

- CSV or JSON attendance-punch import
- Asia/Kathmandu normalization
- AD and BS date display
- configurable weekly off
- configurable holiday calendar
- 60-second duplicate-punch protection
- daily and weekly working-time checks
- rest-break evidence checks
- overtime ceiling and multiplier guardrails
- substitute-leave deadline tracking
- approved-time-off-aware Hajiri status
- controlled manual attendance with reason and approver
- current fiscal profile confirmation for tax and deduction review
- audit evidence and JSON export

Excluded:

- employee recruitment, contracts, appraisal or lifecycle administration
- salary computation and payslip processing
- fingerprint or face-template storage
- ZKTeco user or fingerprint migration
- direct browser-to-device UDP polling
- device firmware or network administration

A browser deployed on Netlify cannot safely reach a private ZKTeco UDP endpoint. Direct device synchronization requires a **separate connector** deployed on the same network as the attendance device. That connector is not part of this release.

## Clean-room adaptation

The reference repository and ZIP were reviewed to understand useful product workflows such as NPT normalization, BS dates, duplicate-punch handling, holiday-aware reports, Hajiri presentation, Kaaj classification, manual corrections and audit history.

No source code from the reference repository is copied into Formcraft. The archive contains no detected license file, and the reference project is not treated as a legal authority. Formcraft reimplements the relevant concepts against its own architecture and official Nepal sources.

## Compliance authority and review boundary

The default policy guardrails are modeled from the Nepal Labour Act 2074:

| Control | Default |
|---|---:|
| Normal work | 8 hours/day, 48 hours/week |
| Rest interval | 30 minutes after 5 continuous hours |
| Overtime ceiling | 4 hours/day, 24 hours/week |
| Overtime premium | At least 1.5 times basic remuneration |
| Weekly leave | At least one day/week |
| Substitute leave | Within 21 days after work on a weekly or public holiday |

The leave reference distinguishes statutory entitlements from organization policy:

- Home leave: one day per 20 days worked; carry-forward reference up to 90 days
- Sick leave: 12 days per year, proportionate where applicable; carry-forward reference up to 45 days
- Maternity leave: 14 weeks / 98 days total, with the statutory pay-treatment nuance preserved
- Maternity-care / paternity leave: 15 days
- Mourning leave: 13 days where statutory conditions apply
- Public holidays: 13 paid days, 14 for women including International Women's Day
- Casual leave: organization policy, not silently represented as a seeded statutory entitlement
- Kaaj / field duty: an operational duty classification, not a leave entitlement

Primary references:

- Nepal Labour Act 2074: `https://repository.lawcommission.gov.np/np/category/documents/prevailing-law/statutes-acts/`
- Labour Rules 2075: `https://moless.gov.np/`
- Labour Audit Standard 2075: `https://moless.gov.np/`
- Inland Revenue Department: `https://ird.gov.np/`
- Social Security Fund: `https://ssf.gov.np/`

This implementation is operational software, **not legal advice** and not a legal compliance certificate. Owners must review later amendments, sector-specific rules, collective agreements and enacted fiscal-year sources before confirming production settings.

## Why tax and deduction rates are not copied

The reference project contains payroll rates and comments tied to a user-provided sheet, and explicitly notes that some figures were not independently verified. Formcraft therefore does not copy its tax slabs, SSF, PF, CIT or insurance assumptions.

Instead, the compliance center stores a fiscal-year profile with:

- fiscal year
- enacted-source note
- tax-slab confirmation
- statutory-deduction confirmation
- confirming user and timestamp

The profile is a release safeguard for Formcraft's existing Payroll module. It does not calculate payroll.

## Attendance import

Accepted file types:

- `.csv`
- `.json`
- `.txt` containing CSV

Recognized column aliases include:

- employee: `employeeId`, `employeeCode`, `attendanceId`, `attId`, `userId`, `uid`, `name`
- time: `timestamp`, `punchTime`, `datetime`, or `date` plus `time`
- source: `device`, `deviceName`, `terminal`
- optional event type: `punchType`, `status`, `state`

Example CSV:

```csv
employeeId,timestamp,device,punchType
employee-001,2026-08-03 09:00:00,Main gate,check-in
employee-001,2026-08-03 17:30:00,Main gate,check-out
```

Timestamps without an offset are interpreted as Nepal time. The import compares punches both within the uploaded file and against stored punch evidence. Re-importing the same export does not create duplicate attendance records.

## Daily materialization

Accepted punches are grouped by employee and Nepal calendar date. Formcraft stores:

- first punch as check-in
- last punch as check-out
- total span as recorded work time
- break evidence where a four-punch sequence is available
- overtime against the configured normal day
- weekly-off or holiday work as separate `specialDayWorkMinutes` evidence
- source devices, source batch and punch count
- operational issues and evaluation timestamp

The source punches remain available as evidence. Attendance records created by the feature are marked `complianceManaged` and remain in the existing Attendance collection.

## Status priority

Hajiri and day-level status use this order:

1. Configured weekly off
2. Configured holiday
3. Present attendance record
4. Approved Time Off request
5. Absent

This keeps status computation deterministic. Holiday dates are not guessed because government, sector and organization calendars can change.

## Substitute leave

Work recorded on a configured weekly off or holiday creates a substitute-leave obligation. The default deadline is 21 days. Special-day hours are not immediately duplicated as ordinary overtime; if substitute leave is not granted by the deadline, the audit raises a high-priority item to review overtime treatment under section 30(2). Owners and admins can mark the item as granted, preserving:

- employee
- source attendance record
- worked date
- due date
- granted date
- reason
- audit history

## Manual attendance

Manual attendance is intentionally controlled. It requires:

- employee
- AD date with BS preview
- check-in and check-out
- reason
- approver

The reason and approver are stored in the attendance evidence and audit log. A manually created record missing either control is raised as a high-priority exception.

## Hajiri register

The current BS-month register is computed from live data:

```text
Employees
  + Attendance
  + Approved Time Off
  + Weekly Off
  + Holiday Calendar
  = Current BS Month Hajiri Register
```

It includes sticky employee and day headers, Nepal status symbols, totals, horizontal scrolling and print behavior. It is a view over existing operational records, not a separate attendance settlement database.

## Readiness score

The score is based on explicit controls:

- confirmed attendance policy
- configured holiday calendar
- confirmed current fiscal tax review
- confirmed current fiscal deduction review
- no high-priority exceptions
- no medium-priority exceptions

The score is a product readiness indicator. It must never be presented as legal certification.

## Evidence export

The JSON evidence export contains:

- active policy
- fiscal profiles
- holidays
- import summaries
- substitute-leave obligations
- audit events
- latest exception evaluation
- compliance-managed attendance records

It intentionally excludes biometric templates and does not export a payroll calculation.

## Validation contracts

Automated tests verify:

- Labour Act default guardrails
- less-favourable policy values are rejected
- stored and within-file duplicate punches are filtered
- employee matching and NPT date grouping
- manual reason and approver enforcement
- holiday-aware substitute leave
- current fiscal profile confirmation
- exception detection and readiness
- Hajiri generation
- route and stable navigation integration
- desktop and mobile layouts
- no direct device or fingerprint implementation
- clean-room documentation and source boundary
