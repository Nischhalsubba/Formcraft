# Form modal E2E audit

## Scope

This audit covers the shared create/edit modal used by every metadata-driven ERP module, with the Sales Order form used as the primary reproduction case. It verifies layout, scrolling, accessibility, responsive behavior, and a real Sales Order creation flow.

The audit does not claim that every possible business rule in every module is complete. It verifies the shared form shell and the connected workflows exercised by the existing ERP regression suite.

## Root cause

The clipping shown in the Sales Order modal came from a CSS cascade conflict:

- `form-system-redesign.css` constrained generic form dialogs to `860px`.
- `erp-suite.css`, loaded later, assigned `.erp-record-form` a width of up to `980px`.
- The dialog hid horizontal overflow.
- The result was a form wider than its visible container, so the first column, labels, descriptions, and controls were cut off.

The same width conflict remained on mobile because the dialog became `100vw`, while the inner ERP form continued to use its separate width rule.

## Defects fixed

| ID | Severity | Defect | Resolution |
|---|---:|---|---|
| FM-001 | Critical | Desktop ERP forms could be wider than their dialog and become horizontally clipped. | The ERP form now follows the dialog width with a higher-specificity shared contract. |
| FM-002 | Critical | Mobile ERP forms did not reliably fill the full-screen dialog. | Phone and short-landscape forms now use `100vw` by `100dvh`, including safe-area padding. |
| FM-003 | High | Fieldsets could retain intrinsic minimum width and force overflow. | Shared fieldsets, grids, fields, and controls now use `min-width: 0` and `min-inline-size: 0`. |
| FM-004 | High | Long forms had weak scroll affordance and footer actions could feel detached from the scroll position. | The body is the only scroll region; header and action shadows reflect start, middle, and end states. |
| FM-005 | High | Mobile actions consumed excessive height and could become awkward at narrow widths. | Cancel and primary actions use a compact two-column footer with 48px touch targets. |
| FM-006 | Medium | Mobile forms retained desktop card-within-card spacing. | The nested fieldset chrome is removed on mobile and fields become one clear column. |
| FM-007 | Medium | Short landscape screens inherited a long single-column phone layout. | Short landscape uses a compact full-screen shell with a two-column field grid. |
| FM-008 | Medium | Create-form headings used lower-cased module names such as “Create sales order.” | Headings and create actions now use normalized module labels while preserving acronyms. |
| FM-009 | Medium | Modal descriptions were not consistently connected to the dialog for assistive technology. | The runtime assigns stable descriptions and section help through `aria-describedby`. |
| FM-010 | High | Previous browser tests opened only representative forms and did not measure the shared modal geometry. | The new regression opens every ERP form at desktop and phone widths and audits clipping, overflow, actions, and accessibility. |

## End-to-end coverage

The dedicated browser regression performs the following checks:

| Viewport | Coverage |
|---|---|
| 1440 × 960 desktop | Opens every ERP record form, verifies two-column layout, checks all horizontal bounds, scrolls a long Sales form, and creates a Sales Order through the real UI. |
| 1024 × 768 tablet | Audits representative Sales, Purchase, Employees, Payroll, and Helpdesk forms. |
| 390 × 844 phone | Opens every ERP record form, verifies a one-column full-screen layout, safe action sizing, and zero root overflow. |
| 320 × 568 compact phone | Audits narrow action buttons and form bounds for representative modules. |
| 844 × 390 short landscape | Verifies the mobile shell remains full-screen while using a practical two-column field grid. |

For every audited form, the runtime reports:

- dialog, form, header, body, and action bounding boxes;
- dialog, form, and body horizontal overflow;
- clipped interactive controls;
- computed grid column count;
- action-button dimensions;
- accessible title and description wiring;
- internal scroll state; and
- root-page overflow.

The existing suites continue to cover the app launcher, every module surface, representative record creation, CRM-to-Sales, Sales-to-Invoice and Accounting, Purchase-to-Vendor Bill, Employee-to-Attendance, Payroll, Helpdesk-to-Task, stable navigation, themes, Nepal invoicing, and responsive pages.

## Remaining product improvements

These are not release blockers for the clipping fix, but they are the strongest next improvements discovered during the form review.

### Priority 1

1. **Add schema-level form sections.** Most ERP forms still place every field inside one generic “Record details” section. Module metadata should support sections such as Customer, Commercial Terms, Fulfilment, Ownership, and Notes.
2. **Protect unsaved work.** Closing a dirty form should show an unsaved-changes confirmation. Long business forms currently disappear immediately when users press Escape, Cancel, or the close button.
3. **Use field-specific validation.** The generic message “Complete the required fields” is insufficient. Each invalid control should explain the exact requirement and the header should summarize all errors.
4. **Make calculated values authoritative.** Sales totals, discounts, taxes, and similar derived values should be calculated or explicitly marked as manual overrides. Editable quantity, price, discount, and total fields can otherwise contradict one another.
5. **Replace large relation selects with searchable comboboxes.** Customer, product, employee, and account lists will become unusable as datasets grow.
6. **Support draft recovery.** Long forms should preserve a local draft after an accidental refresh, expired session, or failed save.

### Priority 2

1. Add visual-regression screenshots for the modal at each viewport rather than relying only on geometry and interaction assertions.
2. Add `inputmode`, `autocomplete`, and domain-specific keyboard hints for phone, money, quantity, tax ID, email, and URL fields.
3. Display BS and AD dates consistently in modules that use Nepal-first date workflows.
4. Add loading, empty, and error states for asynchronously searched relation fields.
5. Allow module-specific primary actions such as “Save draft” and “Save and confirm” instead of one universal submit action.
6. Add a compact review summary before destructive or financially significant submissions.
7. Consolidate old overlapping modal and form CSS layers after the new contract has been stable for a release cycle.

### Priority 3

1. Add per-field help links for complex accounting, tax, payroll, and inventory concepts.
2. Let administrators configure field visibility and ordering without exposing arbitrary CSS or unsafe code.
3. Add analytics for validation failures, abandoned forms, and time-to-complete so future form changes are evidence-driven rather than decorative guesswork.

## Release criteria

The change is ready to merge only when all of the following pass on the same commit:

- static build and syntax checks;
- interaction audit;
- dynamic authenticated UI validation;
- ERP authenticated browser regression;
- workspace architecture regression;
- premium interface regression;
- responsive system regression;
- simplified workspace and theme-studio regression; and
- the new all-module form modal browser regression.

A deploy preview must also be built from that exact commit. Human acceptance should focus on the Sales Order form at desktop, phone portrait, and phone landscape sizes.
