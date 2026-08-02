# Formcraft production-readiness checklist

This checklist is a release gate, not a decorative list of reassuring words.

## Release status meanings

- **Implemented**: the workflow exists in the application and is connected to persisted workspace data.
- **Ready to test**: syntax, contract, model, and authenticated browser tests pass for the workflow.
- **Production ready**: the ready-to-test workflow has also passed manual acceptance, permission, data migration, rollback, monitoring, and deployment checks.

No feature should be labelled production ready merely because its button renders.

## Connected operations acceptance

### Projects

- [x] Stable unique project code
- [x] Owner, customer/team, schedule, progress mode, budget and billing method
- [x] Automatic weighted progress from task estimates
- [x] Health derived from blocked and overdue work
- [x] Normal record page with deep-linkable URL
- [x] Overview, work, financials, and activity/files views
- [x] Linked events, files, time and invoices

### Tasks and issues

- [x] Stable project-scoped key
- [x] Story, task, bug and milestone types
- [x] Backlog, to do, in progress, in review, blocked and done workflow
- [x] Assignee, reporter, priority, dates, estimate, story points and billable flag
- [x] Normal record page with deep-linkable URL
- [x] List and board views
- [x] Board drag-and-drop status change
- [x] Description and acceptance criteria
- [x] Subtasks and protected parent hierarchy
- [x] Dependencies with circular-link protection
- [x] Checklist with add, toggle and remove
- [x] Comments
- [x] Time logging and deletion
- [x] Linked project files

### Cross-module calculations

- [x] Task completion updates project progress
- [x] Task status affects project health
- [x] Time entries update task and project totals
- [x] Billable time updates project commercial reporting
- [x] Invoice-project relationship updates billed, paid and outstanding totals
- [x] Project activity aggregates related task, time, event, file and invoice context
- [x] Portfolio report combines delivery and commercial information

### Interaction architecture

- [x] Project and task details use application record pages rather than modal overlays
- [x] Browser back/forward and deep links preserve record context
- [x] Multi-section forms ignore accidental backdrop and Escape dismissal
- [x] Short bounded actions use dialogs
- [x] Frequent task properties support inline changes
- [x] Viewer role is read-only for operational mutations
- [x] Desktop and mobile record layouts

## Automated release gates

- [x] JavaScript syntax checks
- [x] Static architecture and interaction contracts
- [x] Nepal invoice/calendar contracts
- [x] Integrated operations contract audit
- [x] Integrated operations model and relationship tests
- [x] Authenticated Chromium workflow tests
- [x] Netlify build command runs verification and fails closed

## Manual acceptance required before a production label

- [ ] Owner tests the complete project-to-task-to-time-to-invoice workflow with real sample data
- [ ] Viewer and editor permissions are tested with separate accounts
- [ ] Existing workspace data is backed up and migration results are reviewed
- [ ] Netlify production deployment and Supabase logs show no errors
- [ ] Mobile testing is completed on at least one Android device and one iOS-sized viewport
- [ ] Invoice and Nepal compliance behaviour is reviewed against the business's actual registration and IRD requirements
- [ ] Rollback procedure is confirmed

## Remaining product boundary

The connected delivery foundation is not the same as full Odoo parity. CRM, sales orders, purchasing, inventory valuation, double-entry accounting, HR/payroll, helpdesk and a general automation engine remain separate product phases. They require relational domain models, transactions, stronger permissions and Nepal-specific professional validation before they can truthfully be called production ready.
