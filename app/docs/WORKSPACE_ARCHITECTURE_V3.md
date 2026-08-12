# Formcraft Workspace Architecture V3

## Purpose

Formcraft now contains a broad business application catalogue. The previous shell still treated the product as a small project workspace: one permanent sidebar, a long list of unrelated routes, and a separate Apps page grafted onto the old navigation. That structure does not scale to an ERP.

Architecture V3 replaces that shell with a three-level navigation model:

1. **Global application rail** for home, the Apps launcher, favourites, recent apps, and settings.
2. **Contextual navigation** that changes with the current application or app family.
3. **Page-level controls** for the current list, board, report, form, or record.

The implementation preserves Formcraft’s visual identity and does not copy Odoo’s layouts, source code, branding, icons, or component styling.

## Information architecture

### Global level

The narrow global rail answers: “Where in the product am I?”

- Dashboard
- Apps launcher
- Pinned and recently used applications
- Settings

The rail remains stable while the contextual sidebar changes. This prevents the main navigation from becoming a sixty-link directory that users must repeatedly scan.

### Application level

The contextual sidebar answers: “What can I do inside this business area?”

- The Apps launcher shows application categories.
- CRM shows the Sales family: CRM, Sales, POS, Subscriptions, and Rental.
- Inventory shows the Supply Chain family.
- Employees shows the Human Resources family.
- Projects and Tasks show the connected delivery family.
- Workspace tools remain available in a separated section.

### Page level

The page header and module control bar answer: “What can I do with this view?”

- The page header contains title, context, and at most one contextual primary action.
- List and board pages retain search, status filters, archives, and view switching.
- Long-lived records use full record pages.
- Bounded create/edit actions use dialogs.
- Global quick create remains available in the top bar without competing with the page action.

## Workspace shell

### Desktop

- 68 px global app rail
- 264 px contextual sidebar
- Sticky top bar
- Full-width content surface
- Collapse control for users who need more horizontal space
- Company and branch context in the top bar

### Tablet

- Global rail remains available
- Context sidebar becomes optional or overlay-based
- Search remains central
- Page tools remain reachable without squeezing the content

### Mobile

- Rail and desktop context sidebar are removed
- Bottom navigation provides Home, Apps, current app, Create, and More
- More opens a full-height contextual drawer
- The drawer preserves app-family navigation and workspace tools
- Page actions stack rather than shrink into unreadable controls

## Navigation and flow rules

1. Opening an app changes the contextual sidebar to that app family.
2. Opening a module does not return users to a universal sidebar.
3. Record pages preserve application context and breadcrumbs.
4. The app launcher is always one action away.
5. Global search and quick create are always available.
6. Company and branch context are visible before users create transactional records.
7. Only one contextual primary action should dominate a page.
8. Secondary actions are neutral controls, not blue text scattered across the screen.
9. Mobile users receive purpose-built navigation rather than a compressed desktop sidebar.
10. Browser Back and Forward continue to preserve module and record routes.

## UX decisions

### Use a full page for

- Customers and suppliers
- Opportunities
- Sales and purchase orders
- Products and inventory records
- Employees and payroll runs
- Helpdesk tickets
- Projects and tasks
- Accounting and manufacturing records
- Any record with history, relations, workflow, or reporting context

### Use a dialog for

- Creating or editing a bounded record
- Adding a comment
- Scheduling an activity
- Confirming a destructive action
- Entering a small workflow-specific value

### Use inline controls for

- Status and stage changes
- View switching
- Search and filters
- Company and branch context
- Favourites

## Visual system

- Neutral canvas and surfaces carry most of the interface.
- Teal remains the Formcraft accent and is reserved for active navigation, focus, and primary actions.
- The app rail uses a dark neutral background to separate global navigation from work content.
- Contextual links use restrained active indicators instead of filling the interface with blue buttons.
- Cards, tables, boards, records, and forms continue to use the existing Formcraft design tokens.

## Compatibility

Architecture V3 retains existing interaction contracts:

- `data-route`
- `data-erp-open-app`
- `data-erp-apps-nav`
- `data-context-create`
- `data-command-menu`
- `data-search-focus`
- `data-toggle-notifications`
- `data-toggle-account`
- mobile drawer controls

Existing project, task, invoice, calendar, ERP module, and record-page logic is not duplicated. The new shell calls the existing page renderer and binding layer.

## Acceptance criteria

- The global rail and contextual sidebar are visible on desktop.
- The contextual sidebar changes when the user switches application families.
- Apps, Dashboard, Settings, and favourites are globally reachable.
- ERP module pages do not display a duplicate module introduction.
- Record pages use their own record header without a duplicate workspace header.
- Context navigation can be collapsed and restored.
- Mobile uses a bottom navigation bar and contextual drawer.
- Desktop and mobile pages do not create horizontal document overflow.
- Search, create, notifications, account, theme, company, and branch controls remain functional.
- Existing static and browser regression suites remain green.