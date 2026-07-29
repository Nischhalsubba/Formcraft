# Formcraft Full Feature Parity

This document is the source-of-truth scope for rebuilding every useful feature found in the uploaded Greeva CodeIgniter package as an original Formcraft admin dashboard.

The target is **functional parity without visual or branding duplication**. Formcraft will use its own information architecture, components, copy, icons, layout behavior, data model, and design system.

## Source audit

The uploaded package contains 104 top-level demonstration views:

| Category | Views |
|---|---:|
| Dashboard | 1 |
| Applications | 6 |
| Authentication | 8 |
| Charts | 17 |
| Error and system states | 7 |
| Extended UI | 4 |
| Forms | 10 |
| Icon browsers | 2 |
| Layout variants | 7 |
| Maps | 3 |
| General pages | 7 |
| Tables | 3 |
| Base UI | 28 |

The package also includes Bootstrap, ApexCharts, FullCalendar, DataTables, Grid.js, Dropzone, Flatpickr, Choices, Select2, Inputmask, Quill, Dragula, SweetAlert2, Leaflet, Google Maps support, jsVectorMap, SimpleBar, noUiSlider, and supporting utilities.

## Product architecture

Formcraft will be organized into five navigation groups rather than reproducing the source menu:

1. **Overview**: dashboard, analytics, activity, notifications.
2. **Operations**: calendar, email, files, invoices.
3. **Data**: tables, charts, maps, reports.
4. **Components**: forms, UI patterns, extended controls, icons.
5. **System**: authentication, users, permissions, settings, layouts, system pages.

## Functional application modules

### Dashboard

- Live KPI cards backed by stored records.
- Date-range filtering.
- Activity and completion charts.
- Recent records and workspace audit trail.
- Quick-create actions.
- Loading, empty, error, and partial-data states.
- Widget preferences saved per user.

### Calendar

Equivalent scope to `apps-calendar`:

- Month, week, day, and agenda views.
- Create, edit, delete, and duplicate events.
- Drag-and-drop rescheduling.
- Resize event duration.
- Calendar/category filters.
- All-day and recurring event support.
- Reminder settings.
- Project and task linking.
- Conflict and validation messages.

### Email

Equivalent scope to `apps-email`:

- Inbox, sent, drafts, starred, archive, spam, and trash folders.
- Read/unread and starred states.
- Compose, reply, reply-all, and forward.
- Recipient, CC, and BCC fields.
- Draft autosave.
- Attachments.
- Search, filtering, bulk selection, move, archive, and delete.
- Thread view.
- Local/demo adapter first, replaceable by a real email service later.

### File manager

Equivalent scope to `apps-file-manager`:

- Folder creation and nested navigation.
- File upload with progress, validation, and failure states.
- Grid and list views.
- Search, type filters, sorting, and selection.
- Rename, move, duplicate, download, and delete.
- Storage-usage summary.
- Recent and starred files.
- File details and metadata panel.
- Permission-aware actions.

### Invoices

Equivalent scope to `apps-invoices`, `apps-invoice-details`, and `apps-invoice-create`:

- Invoice list with status, client, amount, and due-date filters.
- Create and edit invoices.
- Customer and billing details.
- Dynamic line items.
- Quantity, unit price, tax, discount, subtotal, and total calculations.
- Draft, sent, viewed, paid, overdue, void, and refunded states.
- Invoice detail and print view.
- PDF-ready output.
- Duplicate, send, mark paid, void, and delete actions.
- Payment and status history.

## Authentication and account flows

Equivalent scope to all eight authentication views:

- Login with email/password.
- Registration.
- Logout.
- Forgot-password request.
- Create/reset password.
- Email confirmation.
- Lock screen and session re-entry.
- PIN login.
- Password hashing, rate limiting, CSRF protection, and secure sessions.
- Remember-me behavior.
- Validation, loading, success, invalid-token, expired-token, and locked-account states.

## General and system pages

Equivalent scope:

- Starter page template.
- Pricing page.
- FAQ page.
- Maintenance page.
- Timeline page.
- Coming-soon page.
- Terms and conditions page.
- 400, 401, 403, 404, alternate 404, 500, and service-unavailable pages.

These pages will use Formcraft content patterns and illustrations, not the source artwork.

## Layout system

Equivalent scope to the seven layout demonstrations:

- Default vertical sidebar.
- Horizontal navigation.
- Detached sidebar.
- Full-width content.
- Fullscreen mode.
- Hover-expand sidebar.
- Compact sidebar.
- Icon-only sidebar.

Layout choice will be a persisted user preference. Content and accessibility behavior must remain consistent across variants.

## Base UI component library

All source UI demonstrations remain in scope as reusable Formcraft components:

- Accordions
- Alerts
- Avatars
- Badges
- Breadcrumbs
- Buttons
- Cards
- Carousel
- Collapse
- Dropdowns
- Embedded video
- Grid
- Links
- List groups
- Modals
- Notifications and toasts
- Off-canvas panels
- Pagination
- Placeholders and skeletons
- Popovers
- Progress indicators
- Aspect ratios
- Scrollspy
- Spinners
- Tabs
- Tooltips
- Typography
- Utility demonstrations

Every component requires default, hover, focus, active, selected, loading, disabled, empty, error, success, and responsive states where applicable.

## Extended controls

Equivalent scope:

- Drag-and-drop lists and boards.
- Sweet-alert style confirmation and feedback dialogs.
- Rating input and display.
- Custom scroll containers.

## Forms

Equivalent scope to all ten form views:

- Basic controls.
- Input masks.
- Date, time, and color pickers.
- Native and enhanced select controls.
- Range sliders.
- Client and server validation.
- Multi-step wizard.
- File upload and drag/drop upload.
- Rich text editor.
- Horizontal, vertical, inline, floating-label, and grid layouts.

Form behavior must include labels, help text, required markers, validation timing, accessible error summaries, keyboard use, disabled/read-only states, loading, success, and unsaved-change protection.

## Tables

Equivalent scope:

- Basic responsive tables.
- Grid.js data grid.
- DataTables-style advanced table.
- Sorting, filtering, search, pagination, selection, responsive columns, sticky headers, fixed columns, row actions, bulk actions, export, empty states, and loading states.

## Charts

All seventeen ApexCharts demonstrations remain in scope:

- Area
- Bar
- Box plot
- Bubble
- Candlestick
- Column
- Heatmap
- Line
- Mixed
- Pie
- Polar area
- Radar
- Radial bar
- Scatter
- Sparklines
- Timeline/range bar
- Treemap

Charts will share one Formcraft theme, accessible labels, palette-safe series colors, tooltips, no-data states, responsive behavior, and downloadable data where useful.

## Maps

Equivalent scope:

- Google Maps adapter.
- Leaflet maps.
- Vector maps.
- Markers, popups, layers, zoom, fit-to-data, loading, error, and missing-key states.
- Map providers will be isolated behind adapters so the product is not coupled to one service.

## Icons

- Searchable Tabler icon browser.
- Searchable Solar icon browser or a license-compatible equivalent.
- Copy-name and copy-markup actions.
- Size, stroke, fill, and color demonstrations.

## Data and backend target

The final application target is CodeIgniter 4 with:

- Explicit routes instead of the source wildcard view route.
- SQLite for local development and MySQL compatibility.
- Migrations and seeders.
- Models, services, controllers, policies, and form requests/validation.
- Session authentication and role-based authorization.
- CSRF protection.
- File-storage abstraction.
- Audit logging.
- JSON endpoints for asynchronous widgets.
- PHPUnit coverage for critical domain behavior.

## Delivery phases

### Phase 1: Foundation and visual system

- Formcraft palette and identity.
- Application shell and navigation model.
- Design tokens and reusable components.
- Light/dark themes and layout preference system.
- Feature manifest and explicit route plan.

### Phase 2: Core operations

- Authentication.
- Dashboard.
- Calendar.
- Email.
- File manager.
- Invoices.

### Phase 3: Data tools

- Tables.
- Charts.
- Maps.
- Reports and exports.

### Phase 4: Component suite

- Forms.
- Base UI.
- Extended UI.
- Icon browsers.
- Layout variants.

### Phase 5: System hardening

- Roles and permissions.
- Error/system pages.
- Accessibility review.
- Security review.
- Automated tests.
- Performance optimization.
- Deployment documentation.

## Definition of complete

A feature is not complete merely because a page resembles the source demonstration. It is complete only when:

- The route is explicit and protected appropriately.
- The interface uses Formcraft tokens and components.
- Primary actions work and data persists.
- Input is validated on client and server where applicable.
- Loading, empty, error, success, and permission-denied states exist.
- Keyboard and screen-reader use are supported.
- Responsive behavior is verified.
- Critical behavior has automated tests.
- No source branding, sample copy, logos, or proprietary artwork remains.

## Licensing boundary

The uploaded package is used as a feature reference. Its commercial source files and bundled proprietary assets must not be copied into the public repository unless their redistribution license is confirmed. Formcraft will independently implement equivalent functionality with original design and code or license-compatible dependencies.
