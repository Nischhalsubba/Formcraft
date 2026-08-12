# Formcraft UX Architecture and Nepal ERP Roadmap

## Purpose

Formcraft should become a connected operating system for small and medium organisations in Nepal, not a collection of unrelated CRUD screens. The product may learn from mature ERP patterns, including Odoo's modular workflows, but must use Formcraft's own information architecture, interaction design, code, naming, and visual system.

This document defines:

- when to use record pages, drawers, dialogs, popovers, and inline editing;
- the current UX problems and their remedies;
- the shared operational data model connecting projects, tasks, time, calendar, files, billing, and reporting;
- a phased ERP roadmap for Nepal;
- boundaries for Odoo-inspired functionality without copying protected visual expression or source code.

## Product principle

A user should enter a business fact once and see it everywhere it matters.

Examples:

- Completing a task updates project progress and portfolio reporting.
- Logging billable time updates project hours, utilisation, profitability, and the amount available for time-based invoicing.
- Linking an invoice to a project updates project billing, outstanding balance, and organisation reports.
- Scheduling a project event makes it visible in the calendar and the project timeline.
- Uploading a file against a task makes it visible from the task, project, and file manager.
- Changing a project owner affects responsibility views, workload summaries, and notification routing.

Duplicated records that drift apart are not integration. They are merely organised disagreement.

## Interaction architecture

### Use a full record page

Use a persistent, navigable record page when the user needs context, history, linked records, or multiple follow-up actions.

| Record | Why it needs a page |
|---|---|
| Project | Tasks, milestones, time, events, files, invoices, health, budget, and activity must be visible together. |
| Task or issue | Description, acceptance criteria, subtasks, dependencies, comments, checklist, time, files, and history require durable context. |
| Invoice | Line items, payment ledger, adjustments, audit trail, print copies, and compliance status cannot be understood in a tiny popup. |
| Customer or organisation | Contacts, opportunities, quotations, orders, invoices, payments, support, and activity should share one record. |
| Sales order, purchase order, stock transfer | These are workflow records with state transitions and downstream documents. |
| Employee | Profile, attendance, leave, payroll, expenses, documents, and approvals form one connected record. |
| Helpdesk ticket | Conversation, SLA, linked customer, tasks, time, files, and resolution history need a stable workspace. |

Record pages should support deep linking in a later routing iteration. The current implementation uses a non-modal record surface inside the existing dialog element so that it can be introduced safely without breaking existing navigation and automated tests.

### Use a side drawer

Use a drawer for focused editing when the user benefits from seeing the underlying record while changing a limited set of fields.

Good candidates:

- Edit task fields from a task page.
- Edit customer address or payment terms.
- Add or edit an invoice line.
- Configure a report filter.
- Inspect a linked record without leaving a workflow.

A drawer should not contain an entire multi-module record.

### Use a modal dialog

Use a modal only when the user must make or cancel a bounded decision before continuing.

Good candidates:

- Confirm deletion, voiding, posting, payment, or destructive status changes.
- Add a short comment or checklist item.
- Log time.
- Select a dependency.
- Choose a file or create a small folder.
- Resolve a conflict.
- Pick an action from a compact create menu.

Forms with multiple sections, complex calculations, or more than one screen of information should not be forced into a modal.

### Use a popover

Use a popover for short, reversible, contextual actions:

- overflow actions;
- notification preview;
- account menu;
- simple status or assignee selection;
- date or filter selection.

Popovers must close without changing the underlying record.

### Use inline editing

Use inline editing for small, frequently changed values where context is already clear:

- task status;
- assignee;
- priority;
- checklist completion;
- table filters;
- quantities in draft documents.

Inline editing must show saving, success, conflict, and permission states.

## Current UX audit

### Critical issues

1. **Project details were presented as a giant modal.** The user lost the surrounding workspace and treated the record as temporary. Project and task details now use record pages.
2. **Clicking the dialog backdrop closed complex content.** The shared backdrop handler could clear the dialog and expose an empty-looking canvas. Record pages no longer use a modal backdrop, and forms ignore accidental outside clicks.
3. **Task rows compressed multiple facts into unreadable text.** Project tasks now have stable keys, separate fields, filters, a list view, and a board view.
4. **Task editing was the only task-detail experience.** Reading a task should not require entering edit mode. A dedicated task record now provides context, subtasks, dependencies, comments, checklist, time, and linked records.
5. **Project progress could disagree with task completion.** Automatic progress is now calculated from completed task weights, using estimated hours where available.
6. **Billing was only visually adjacent to projects.** Invoices now have an explicit project relationship used by project and portfolio reporting.
7. **Time did not exist as a shared business fact.** Time entries now connect user, task, project, date, hours, description, and billable status.
8. **Statuses were inconsistent across old and new records.** Operational task statuses are normalised to Backlog, To do, In progress, In review, Blocked, and Done.
9. **Tasks had no stable human-readable identifier.** Tasks now receive project-scoped keys such as `FORM-001`.
10. **Subtasks and dependencies were absent.** Both are now represented explicitly rather than hidden in descriptions.

### High-priority issues still requiring future work

1. Browser history and deep URLs do not yet represent individual records.
2. The current backend persists an entire workspace JSON document, so high-volume ERP domains need relational normalisation.
3. Concurrent edits are detected only at workspace-state version level, not per record.
4. Permissions are workspace-wide; ERP modules need record, company, branch, field, and approval-level permissions.
5. Notifications are not yet generated from assignments, mentions, deadlines, approvals, or state transitions.
6. There is no general workflow engine for approvals, automations, scheduled actions, or server-side validation.
7. Search lacks indexed relational queries, saved filters, grouped views, and domain-specific facets.
8. Reports are calculated in the browser and will not scale to accounting, inventory, or audit-grade workloads.
9. Files need first-class links to records rather than only optional metadata.
10. Email is an internal mailbox rather than a complete communication thread connected to customers and records.
11. Data import, export, merge, deduplication, and archival rules remain incomplete.
12. Mobile workflows require task-focused navigation rather than simply shrinking desktop tables.
13. Empty, loading, offline, permission-denied, conflict, and partial-failure states need consistent component standards.
14. Draft versus posted/issued records need a universal lifecycle model.
15. Audit entries need structured before/after data and immutable server-side storage for sensitive business records.

## Operational model implemented in the current foundation

### Project

A project owns:

- code;
- customer or internal team;
- accountable owner;
- status and health;
- start and due dates;
- progress calculation mode;
- billing method;
- budget amount and budget hours;
- tasks, milestones, events, files, time, invoices, and activity.

### Task or issue

A task owns:

- stable project-scoped key;
- issue type: Story, Task, Bug, or Milestone;
- summary and detailed description;
- acceptance criteria;
- project and optional parent task;
- assignee and reporter;
- workflow status and priority;
- start and due dates;
- estimated hours and story points;
- billable flag;
- labels;
- subtasks;
- dependencies;
- checklist;
- comments;
- time entries;
- linked files, events, invoices, and activity.

### Time entry

A time entry connects:

- project;
- task;
- user;
- date;
- hours;
- description;
- billable status.

### Cross-module calculations

- Project progress is task-driven unless manual progress is selected.
- Project health considers blocked tasks, overdue tasks, project due date, and completion.
- Project financials aggregate linked invoices and payments.
- Project capacity compares estimated, logged, billable, and budgeted hours.
- Portfolio reporting aggregates progress, health, delivery, billing, and time across projects.

## Odoo-inspired module map

Official Odoo documentation describes an application suite that connects CRM, Sales, Accounting/Invoicing, Projects, Timesheets, Helpdesk, Purchase, Inventory, HR, and other applications. Formcraft should reproduce the useful business capabilities and interoperability patterns, not Odoo's interface, text, icons, templates, branding, or source code.

Reference documentation:

- Applications: <https://www.odoo.com/documentation/19.0/applications.html>
- Project: <https://www.odoo.com/documentation/19.0/applications/services/project.html>
- Timesheets: <https://www.odoo.com/documentation/19.0/applications/services/timesheets.html>
- Sales: <https://www.odoo.com/documentation/19.0/applications/sales/sales.html>
- Invoicing and Accounting: <https://www.odoo.com/documentation/19.0/applications/finance/accounting.html>
- CRM: <https://www.odoo.com/documentation/19.0/applications/sales/crm.html>
- Purchase: <https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/purchase.html>
- Helpdesk: <https://www.odoo.com/documentation/19.0/applications/services/helpdesk.html>
- Studio and automation: <https://www.odoo.com/documentation/19.0/applications/studio.html>

### Phase 1: Connected delivery foundation

Status: started in this implementation.

- Projects
- Jira-like tasks/issues
- subtasks, dependencies, comments, checklists
- time tracking
- project calendar
- project files
- project billing links
- project and portfolio reporting
- record-page interaction model

### Phase 2: Contacts, CRM, and sales

- organisations and contacts;
- leads and opportunities;
- activities, stages, probability, expected revenue;
- quotations and approvals;
- sales orders;
- products, services, price lists, taxes, and discounts;
- quotation-to-order-to-invoice-to-payment traceability;
- customer portal and communication timeline.

### Phase 3: Purchasing, inventory, and expenses

- suppliers;
- requests for quotation;
- purchase orders and approvals;
- receipts and vendor bills;
- products, units, warehouses, locations, lots/serials;
- stock movements and valuation;
- employee expenses and reimbursements;
- purchase-to-receipt-to-bill-to-payment traceability.

### Phase 4: Nepal finance and accounting

- chart of accounts;
- journals and double-entry ledger;
- accounts receivable and payable;
- bank and cash reconciliation;
- fixed assets and depreciation;
- cost centres/analytic accounts;
- VAT and PAN workflows;
- TDS/withholding records;
- Nepal fiscal years and BS dates;
- NRB exchange rates;
- IRD electronic billing and CBMS only after applicable approval and current technical validation;
- Nepal reporting exports and audit controls.

### Phase 5: HR and payroll

- employees, departments, positions, contracts;
- attendance, shifts, leave, holidays, and approvals;
- timesheet-to-payroll and project-cost links;
- Nepal payroll configuration, tax, provident fund, CIT, social security, and statutory reports after professional validation;
- recruitment, onboarding, appraisal, training, and documents.

### Phase 6: Service operations

- helpdesk tickets and SLAs;
- customer/project/task/time/invoice links;
- knowledge base;
- field service;
- maintenance;
- subscriptions and recurring billing;
- appointments;
- approvals and service reports.

### Phase 7: Platform capabilities

- configurable fields and views;
- workflow and approval engine;
- automation rules and scheduled jobs;
- webhooks and integrations;
- API and import/export framework;
- saved filters, grouping, pivot reports, dashboards;
- multi-company and multi-branch controls;
- granular roles and permissions;
- immutable audit logs;
- localization packages and upgrade-safe migrations.

## Architecture risks

### The JSON workspace-state limit

The current versioned `workspace_state` record is effective for early product integration because all modules share one remote state. It is not the final ERP storage architecture. Accounting entries, stock moves, payments, payroll, and audit records require relational tables, server-side constraints, transactions, idempotency, and immutable posting rules.

### Do not build every module at once

An Odoo-class suite represents years of product, accounting, legal, and operational work. Attempting to ship all modules in one frontend rewrite would produce a large demo with shallow records and unreliable reports. The correct strategy is to build one end-to-end operational spine, normalise it, then add modules around shared customers, products, money, people, and activities.

### Localization is not translation

A Nepal product needs more than Nepali labels. It needs BS dates, Nepal fiscal years, local tax identities, VAT/PAN rules, TDS treatment, NRB rates, IRD processes, local holidays, branch practices, payroll obligations, and audit expectations. Each regulated module needs current professional review.

## Definition of done for a new module

A module is not complete because its list and create form exist. It must include:

1. authoritative records and lifecycle states;
2. permissions and approvals;
3. links to related modules;
4. transactions and idempotent side effects;
5. search, filters, grouping, and saved views;
6. activity, comments, files, and audit history;
7. reporting and reconciliations;
8. empty, loading, offline, error, conflict, and permission states;
9. mobile and accessible workflows;
10. import/export and migration strategy;
11. automated tests;
12. Nepal localization and compliance review where applicable.

## Current implementation boundary

This iteration creates the connected project-delivery foundation and corrects the record-page/popup architecture. It does not claim full Odoo parity, general ledger accounting, inventory valuation, payroll, CRM, purchasing, helpdesk, or government-certified electronic billing. Those belong to the phased roadmap above.
