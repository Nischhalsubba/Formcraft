# ERP suite browser acceptance contract

The authenticated browser regression must verify these behaviours before the Nepal ERP suite is merged:

1. The Apps entry appears in desktop and mobile navigation.
2. The app launcher renders all nine capability groups and supports search.
3. Opening a module shows summary metrics, list/board controls, filters and a create action.
4. Creating a contact persists the record and opens its record page.
5. A contact can create a CRM opportunity or helpdesk ticket.
6. A CRM opportunity can create a quotation, which can proceed through sales, invoice and payment records.
7. A purchase record can proceed through approval, receipt and vendor bill records.
8. A helpdesk ticket can create a connected project task.
9. An employee can create attendance, leave, appraisal and payroll records.
10. Company and branch context is available from the launcher.
11. Record pages remain full application pages rather than dimmed modal overlays.
12. Bounded actions use dialogs, while long records and reports use pages.
13. Existing projects, tasks, Nepal calendar and invoice workflows continue to pass.
14. No console error, page error, horizontal overflow or unnamed interactive control is allowed.
15. Mobile navigation can open the Apps launcher and at least one ERP module.

This document is a human-readable acceptance contract. Automated implementation contracts live in `tests/erp-suite-audit.mjs`; existing authenticated Chromium regression remains a mandatory repository check.
