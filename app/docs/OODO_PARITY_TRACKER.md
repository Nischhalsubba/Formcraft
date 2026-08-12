# Formcraft Nepal ERP parity tracker

This tracker maps the broad business capabilities in Odoo's current master application catalogue to Formcraft's Nepal-first implementation. Functional patterns are used as requirements; no Odoo source code, branded UI, templates, icons, or copyrighted visual expression are copied.

## Status vocabulary

- **Implemented foundation**: usable records, lifecycle states, responsive UI, activity and cross-module links exist in Formcraft.
- **Specialist depth pending**: the module surface exists, but regulated, industry-specific, or advanced edge-case depth still requires a dedicated release and domain validation.
- **Regulatory approval required**: Formcraft must not claim government or statutory certification until the relevant authority and professional reviewers approve it.

## Implemented application foundation

The ERP app launcher and shared record engine now cover these groups:

1. Essentials and platform
2. Finance
3. Sales
4. Websites and commerce
5. Supply chain and manufacturing
6. Human resources
7. Marketing
8. Services
9. Productivity

The suite provides shared search, list and board views, record pages, create/edit forms, stages, comments, activities, archive controls, companies, branches, saved user preferences, related-record navigation, reports, and cross-module workflow actions.

## Module matrix

| Group | Applications now available in Formcraft | Status |
|---|---|---|
| Essentials | Contacts, Activities, Approvals, Automations, Studio-like configuration | Implemented foundation |
| Finance | Accounting, Expenses, Payments, Nepal invoicing | Implemented foundation; ledger and statutory depth pending |
| Sales | CRM, Sales, POS, Subscriptions, Rental | Implemented foundation |
| Websites | Website, eCommerce, eLearning, Forum, Blog, Live Chat | Implemented foundation; public publishing runtime pending |
| Supply chain | Purchase, Inventory, Barcode, Manufacturing, Quality, Maintenance, PLM, Repairs | Implemented foundation; valuation and production depth pending |
| Human resources | Employees, Attendance, Time Off, Recruitment, Appraisals, Payroll, Fleet, Front Desk, Referrals, Lunch | Implemented foundation; Nepal payroll validation pending |
| Marketing | Email Marketing, SMS Marketing, Marketing Automation, Events, Marketing Cards, Surveys | Implemented foundation; provider delivery integrations pending |
| Services | Projects, Timesheets, Planning, Field Service, Helpdesk, Appointments | Implemented foundation |
| Productivity | Documents, Sign, Spreadsheet, Dashboards, Knowledge, Discuss, Data Cleaning, Calendar | Implemented foundation; collaborative editing depth pending |

## Connected workflow coverage

- Contact to CRM opportunity, quotation, sales order, invoice, payment and accounting record
- Purchase request/RFQ to approval, purchase order, receipt, vendor bill and accounting record
- Product and inventory movements to replenishment, purchase and stock reporting
- Manufacturing order to quality checks and finished stock
- Project/task to time, invoice and profitability reporting
- Helpdesk and field service to project task, time and invoice
- Employee to attendance, time off, appraisal and payroll preview
- Website live chat to CRM opportunity or helpdesk ticket
- Subscription renewal and rental return to invoice creation
- Expense approval to payment record

## Nepal-specific baseline

- Bikram Sambat date presentation and Nepal fiscal-year awareness
- PAN/VAT invoice foundation
- NPR-first commercial reporting
- company and branch context
- Nepal payroll fields for PAN, SSF, PF and CIT
- additive relational migration for ERP companies, branches, records, links, events, approvals, automation jobs and posting locks

## Specialist depth still required

The presence of an application does not mean Formcraft has reproduced every edge case accumulated by a mature ERP over many years. Dedicated releases remain necessary for:

- complete double-entry posting, reconciliation, consolidation, lock periods and statutory financial statements
- perpetual stock valuation, landed costs, costing methods and manufacturing variance accounting
- restaurant POS hardware, fiscal devices, payment terminals and offline transaction recovery
- website hosting, theme editing, public checkout, shipping-carrier and payment-provider integrations
- electronic signature evidence packages and jurisdiction-specific identity verification
- collaborative spreadsheet and document editing engines
- email/SMS deliverability infrastructure and consent management
- Nepal payroll tax tables, labour-law interpretation and professional sign-off
- IRD electronic billing/CBMS certification and production credentials
- advanced workflow builder, custom schema designer and unrestricted server actions

## Release rule

A module may be presented as an **implemented foundation** when its records, UI, lifecycle and connected workflow are usable and tested. It may only be presented as **fully compliant**, **certified**, or **feature complete against Odoo** after specialist acceptance tests and, where required, legal or regulatory approval.
