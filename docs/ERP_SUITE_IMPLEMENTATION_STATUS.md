# Formcraft Nepal ERP suite implementation status

## Purpose

Formcraft now includes an Odoo-inspired application launcher and a metadata-driven ERP workspace that uses Formcraft's own information architecture, design language, code, and workflows.

This release is intentionally explicit about depth. It makes every current Odoo master application category discoverable and gives every listed app a usable record surface, search, filters, list/board views, CRUD, status lifecycle, company/branch context, activity, comments, audit history, and responsive behavior. It does not claim one-to-one parity with every mature Odoo sub-feature, accounting localization, connector, report, edge case, or configuration option.

## Experience architecture

- “Apps” is a first-class route rather than another oversized sidebar section.
- App search, categories, favorites, recent apps, company, and branch context are available from one launcher.
- Complex business records use full application pages.
- Create and edit operations use explicit form dialogs that do not disappear on accidental backdrop clicks.
- Short bounded actions use small workflow dialogs.
- Record pages include overview, activity/audit, and related-record tabs.
- All generic modules support list and kanban views, search, status filters, archived records, and drag-and-drop lifecycle changes where editing is allowed.

## Current app catalog

### Odoo essentials and platform

- Contacts
- Activities
- Approvals
- Automation
- Studio-like custom models
- Company and branch context
- Favorites, recent apps, global app search
- Shared comments, activities, followers, tags, and audit metadata

### Finance

- Nepal invoicing (existing dedicated module)
- Accounting journal entry foundation
- Expenses
- Payments
- Project and commercial reporting
- Nepal currency defaults and BS-aware date display
- Relational migration foundation for posting locks, approvals, idempotent jobs, record links, and immutable events

### Sales

- CRM
- Sales quotations and orders
- Point of Sale order foundation
- Subscriptions
- Rental

### Websites

- Website pages
- eCommerce orders
- eLearning courses
- Forum topics
- Blog posts
- Live chat conversations

### Supply chain

- Purchase
- Inventory
- Barcode operations
- Manufacturing
- Quality
- Maintenance
- PLM engineering changes
- Repairs

### Human resources

- Employees
- Attendance
- Time Off
- Recruitment
- Appraisals
- Payroll foundation
- Fleet
- Front Desk
- Referrals
- Lunch

### Marketing

- Email Marketing
- SMS Marketing
- Marketing Automation
- Events
- Marketing Cards
- Surveys

### Services

- Projects and Jira-style tasks (existing connected module)
- Timesheets
- Planning
- Field Service
- Helpdesk
- Appointments

### Productivity

- Files (existing secure module)
- Documents
- Sign
- Spreadsheet foundation
- Dashboards
- Knowledge
- Calendar (existing BS-first module)
- Discuss
- Data Cleaning
- Shared Mailbox

## Implemented cross-module workflows

- Contact → CRM opportunity
- Contact → Helpdesk ticket
- CRM opportunity → quotation
- Quotation → confirmed sale → stock delivery → invoice → accounting draft
- POS order → payment → stock movement → invoice
- Subscription → renewal invoice and next billing date
- Rental → reserve → pickup → return → invoice
- eCommerce order → payment → processing → shipment → delivery
- Purchase RFQ → approval → order → receipt → vendor bill → accounting draft
- Inventory low stock → replenishment RFQ
- Barcode operation → stock movement
- Manufacturing order → quality check → finished stock
- Repair order → completion → invoice
- Applicant → employee
- Employee → attendance, leave, and appraisal
- Payroll run → compute preview → approval → payment
- Approved timesheet → connected project time entry
- Helpdesk ticket → Jira-style project task
- Field service order → completion → invoice
- Live chat → opportunity or ticket
- Expense → approval → payment
- Accounting draft → post → reversal

## Nepal-specific behavior

- Default currency is NPR.
- Default timezone is Asia/Kathmandu.
- Existing Formcraft BS-first calendar and dual-date formatting are reused inside ERP record views.
- Company and branch context is built into generic business records.
- PAN/VAT, Nepal fiscal-year invoicing, TDS, NRB exchange rates, and CBMS preparation remain connected to the existing Nepal invoice suite.
- Payroll calculations in this release are workflow previews, not a claim of statutory payroll certification. Tax, SSF, PF, CIT, gratuity, leave, overtime, and statutory exports require maintained rule tables and professional validation.

## Backend architecture

The current production workspace still persists the integrated UI state in versioned `workspace_state` JSONB. A new migration adds the relational normalization foundation:

- `erp_companies`
- `erp_branches`
- `erp_records`
- `erp_record_links`
- `erp_record_events`
- `erp_approval_steps`
- `erp_automation_jobs`
- `erp_posting_locks`
- optimistic version checks
- posting-lock validation
- workspace RLS policies

The migration is intentionally additive. It does not silently migrate production business data or switch the frontend persistence contract without a controlled rollout and reconciliation plan.

## What “available” means in this release

Every app listed above has:

1. an app-launcher entry;
2. a responsive list and board surface;
3. create, edit, archive, restore, and delete behavior;
4. status lifecycle support;
5. company and branch context;
6. record overview, activity, and related-record pages;
7. comments, scheduled activities, and audit metadata;
8. search, status filtering, archived-record filtering, and favorites;
9. shared workflow actions where a meaningful cross-module flow exists;
10. automated static contracts and syntax checks.

## Remaining work before claiming full Odoo parity

The suite is much broader than the previous Formcraft release, but full Odoo parity still requires module-specific depth such as:

- production-grade double-entry ledgers, tax engines, reconciliation, consolidation, and financial statements;
- complete product variants, routes, procurement rules, valuation layers, lots, serials, packages, and landed costs;
- full POS sessions, offline operation, restaurant floors, kitchen orders, cash closing, and hardware integrations;
- manufacturing work-centre capacity, detailed bills of materials, by-products, scrap, subcontracting, and costing;
- a visual website builder, real storefront checkout, delivery integrations, payment gateways, public portals, and SEO publishing;
- statutory Nepal payroll rule tables, payslips, government returns, and professional compliance sign-off;
- full marketing delivery infrastructure, bounce handling, sender reputation, opt-out enforcement, and attribution;
- document OCR/extraction, electronic-signature evidence chains, spreadsheet formulas, collaborative editing, calls, and external calendar sync;
- a no-code Studio engine capable of safely generating relational models, migrations, permissions, views, reports, and automations.

Those are tracked under GitHub issue #35 and should be delivered as tested vertical slices rather than being mislabeled complete because a menu item exists.

## Release status

- Application launcher and all official Odoo master app categories: implemented.
- Generic ERP record platform: implemented.
- Cross-module foundation workflows listed above: implemented.
- Existing project/task/time/billing suite: implemented and retained.
- Relational ERP database foundation: added as an unapplied migration.
- One-to-one full Odoo feature parity: not yet a truthful production claim.
