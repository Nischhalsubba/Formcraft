# Formcraft UI Audit Remediation

This branch replaces the layered dashboard prototype with one canonical application shell and addresses the full 78-item UI/UX audit.

## Structural fixes

- One canonical stylesheet and a deliberate four-part application script load order
- Stable inline SVG icon system
- Consistent utility controls on every route
- Large dashboard hero and compact secondary route headers
- Responsive drawer before horizontal navigation becomes overcrowded
- Dynamic dates derived from the browser's local date
- Context-aware search and create actions

## Accessibility fixes

- Route focus and live announcements
- Accessible labels for row, card, task, calendar, and menu actions
- Semantic buttons for email rows and file cards
- 44px calendar date and primary control targets
- Text alternative for dashboard chart data
- Inline form errors and invalid states
- Complete reduced-motion override

## Route fixes

- Dashboard: four KPIs, structurally valid chart, contextual utilities, truthful export label, compact activity panel
- Projects: line-clamped descriptions, sorting, view controls, accessible overflow actions, details dialog
- Tasks: responsive card view, completed styling, accessible checkboxes and actions
- Team: real invitation form, role editing, member removal confirmation
- Reports: period selector, targets, proportions, dynamic overdue calculations
- Calendar: mobile agenda, event overflow, legend, full event labels
- Email: keyboard-accessible rows, persistent sender, unread marker, batch actions, wrapping reader actions
- Files: IndexedDB-backed uploads, custom rename/delete flows, complete breadcrumbs, consistent icons
- Invoices: correct overdue semantics, responsive cards, contextual KPI copy, overflow actions, custom confirmation
- Activity: filters, compact layout, clear-history confirmation
- Settings: persistent notification values, active theme states, live system-theme changes, branded workspace identity, confirmation before reset, switch controls

## Verification

Run:

```bash
npm test
node --check assets/js/app-core.js
node --check assets/js/app-pages.js
node --check assets/js/app-actions.js
node --check assets/js/app-modules.js
python3 tests/browser-smoke.py
```

Browser QA covers every route at 1440x1100 and 390x844 in the smoke script. Manual review should additionally cover 768px, 1024px, and 1280px widths in light and dark themes.
