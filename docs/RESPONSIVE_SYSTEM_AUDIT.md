# Formcraft responsive system audit

Status: **Implemented and ready for end-to-end verification**

Scope: dashboard, app launcher, module lists and boards, project/task records, forms, Nepal calendar, Nepal invoicing, navigation, popovers, dialogs, tablet overlays, mobile bottom navigation, landscape phones, and wide desktop layouts.

This audit records the defects found from designer, developer, and product-owner perspectives, the implemented correction, and the regression evidence added to the repository. It does not claim that software can become permanently bug-free merely because a table says so. Humanity has tried that strategy before.

## Designer review

| ID | Defect found | User impact | Resolution | Status |
|---|---|---|---|---|
| RDES-001 | The mobile top bar inherited desktop dimensions and could grow into a large blank card. | Valuable screen space disappeared before users reached content. | Forced a fixed, flat 58 px mobile control bar with one menu control, one search control, and one account control. | Resolved |
| RDES-002 | The dashboard project table was converted into cards without cell labels. | Project values appeared as disconnected text, bars, and pills. | Added a purpose-built mobile project card while retaining the semantic desktop table. | Resolved |
| RDES-003 | The project card placed owner, status, progress, due date, and actions in a tall unstructured column. | A single project consumed most of the viewport and was hard to scan. | Introduced title/status, two-column metadata, progress, and a labeled edit action. | Resolved |
| RDES-004 | Dashboard summary metrics became one full-width card each below 460 px. | Four small KPIs required excessive scrolling. | Retained a compact 2 x 2 grid down to 361 px and switches to one column only on very narrow devices. | Resolved |
| RDES-005 | Page headers could become visually blank or clipped on mobile. | Users lost page identity and context. | Added explicit visible mobile heading, description, spacing, and transparent surface rules. | Resolved |
| RDES-006 | Panel action links wrapped into awkward two-line blocks. | Headers looked broken and primary content lost width. | Added a compact two-column header layout with controlled action sizing and a stacked fallback on tiny phones. | Resolved |
| RDES-007 | Desktop tables were crushed into narrow phone columns. | Users could not understand record relationships. | Added labeled record cards for generic ERP tables and horizontal scrolling for genuinely dense operational tables. | Resolved |
| RDES-008 | Kanban columns attempted to shrink into the viewport. | Cards became unreadable and drag targets became too small. | Added horizontal, snap-aligned columns sized to the mobile viewport. | Resolved |
| RDES-009 | Module toolbars placed search, filters, view controls, and actions on one row. | Controls clipped or became too narrow on phones and tablets. | Added responsive one- and two-column toolbar layouts with full-width search and view controls. | Resolved |
| RDES-010 | Record headers and actions competed for the same horizontal line. | Long titles truncated and buttons overflowed. | Stacked record identity and actions on mobile and allowed action buttons to wrap evenly. | Resolved |
| RDES-011 | Tabs could overflow without an obvious usable interaction. | Later tabs were unreachable or visually clipped. | Added touch scrolling, scroll snapping, keyboard focus, and preserved non-wrapping tab labels. | Resolved |
| RDES-012 | Modal forms were based on layout viewport height rather than the visual viewport. | Mobile browser chrome and keyboards could hide fields or actions. | Added visual-viewport CSS variables and full-height mobile form layouts with independent body scrolling. | Resolved |
| RDES-013 | Form controls used small text on phones. | iOS could zoom unexpectedly and labels were harder to read. | Set mobile input, select, and textarea text to 16 px. | Resolved |
| RDES-014 | Calendar cells collapsed too tightly on phones. | Dates, BS equivalents, holidays, and events became illegible. | Preserved a scrollable minimum calendar width rather than compressing seven columns beyond usability. | Resolved |
| RDES-015 | Invoice item rows attempted to retain desktop columns. | Fields overflowed and removal controls became detached. | Converted each line item to a single-column form with a stable top-right remove action. | Resolved |
| RDES-016 | Mobile bottom navigation could cover the final content. | Users could not read or activate the last controls. | The runtime measures bottom-navigation height and applies a matching content inset. | Resolved |
| RDES-017 | App cards retained desktop density on small screens. | Titles, descriptions, counts, and favourites competed for space. | Added compact one-column cards with controlled icon, metadata, and favourite placement. | Resolved |
| RDES-018 | Tablet layouts behaved inconsistently between desktop and phone modes. | Navigation, topbar controls, and content widths changed unpredictably. | Defined an explicit 821-1100 px tablet mode with overlay navigation and reduced topbar controls. | Resolved |
| RDES-019 | Very narrow 320-360 px devices inherited layouts designed for 390 px. | Action headers, KPI grids, and forms still overflowed. | Added a compact breakpoint with one-column actions and summaries. | Resolved |
| RDES-020 | Landscape phones retained portrait spacing and oversized bottom navigation. | Too little vertical space remained for business records. | Added a short-landscape mode with reduced navigation and page-header height. | Resolved |

## Developer review

| ID | Defect found | Engineering risk | Resolution | Status |
|---|---|---|---|---|
| RDEV-001 | Responsive behavior was spread across several generations of CSS. | Later layers unintentionally revived obsolete mobile rules. | Added one final route-aware responsive system loaded after every existing UI layer. | Resolved |
| RDEV-002 | Generic mobile table CSS depended on missing `data-label` attributes. | Silent markup changes produced unlabeled cards. | Runtime derives labels from table headers and a static/mobile audit fails when required labels are absent. | Resolved |
| RDEV-003 | The project table had no dedicated phone markup. | A complex desktop row was vulnerable to generic CSS transformations. | Dashboard rendering now produces desktop table and mobile card representations from the same project data. | Resolved |
| RDEV-004 | The visual viewport was not observed. | Address bars, browser chrome, orientation changes, and keyboards could invalidate heights. | Runtime tracks `visualViewport` resize and updates width/height variables. | Resolved |
| RDEV-005 | Breakpoint identity was implicit. | Tests and future components could not reliably identify compact, phone, mobile, tablet, desktop, or wide modes. | Root receives a deterministic `data-formcraft-viewport` value. | Resolved |
| RDEV-006 | Horizontal scroll regions were not keyboard reachable. | Keyboard users could not access offscreen tabs, boards, or tables. | Runtime adds region semantics and focusability when horizontal scrolling is required. | Resolved |
| RDEV-007 | Bottom-navigation spacing was hard-coded. | Design changes could make content overlap return. | Runtime measures the actual rendered nav height and synchronizes the CSS inset. | Resolved |
| RDEV-008 | No shared audit detected root horizontal overflow. | A route could pass visual review while still expanding the document width. | Added `FormcraftResponsive.audit()` with overflow, clipping, header, table-label, and bottom-navigation checks. | Resolved |
| RDEV-009 | No test exercised the user-reported 390 px dashboard failure. | The exact production defect could recur. | Added a 390 x 844 authenticated dashboard regression. | Resolved |
| RDEV-010 | No tests covered 320 px phones or phone landscape. | Small-device failures remained invisible. | Added 320 px portrait and 844 x 390 landscape checks. | Resolved |
| RDEV-011 | Tablet navigation and content geometry were tested separately from business pages. | A shell could pass while a page overflowed. | Added route-level tablet checks for Apps, CRM, projects, tasks, calendar, and invoices. | Resolved |
| RDEV-012 | Dense operations tables and generic ERP tables need different responsive strategies. | One universal conversion damaged either readability or completeness. | Generic ERP tables become labeled cards; Jira-style task tables remain horizontally scrollable. | Resolved |
| RDEV-013 | Mutation-driven page rendering could bypass responsive decoration. | Newly rendered tables and boards could lack labels or semantics. | The responsive runtime observes the application root and re-decorates after renders. | Resolved |
| RDEV-014 | Existing build verification did not include responsive contracts. | Netlify could publish a broken mobile layout. | Added responsive syntax/static audit to `npm run verify` and browser regression to CI. | Resolved |
| RDEV-015 | Existing tests checked document width but not clipped interactive controls. | Buttons could sit outside the viewport without expanding the document. | Runtime audit and Playwright checks inspect interactive element bounds. | Resolved |
| RDEV-016 | Older body padding and the new bottom nav both reserved mobile space. | Pages could have duplicate spacing or inconsistent scrolling. | Final responsive CSS resets legacy body padding and reserves space only in the workspace content. | Resolved |
| RDEV-017 | Mobile popovers retained desktop absolute positioning. | Account and notification menus could render offscreen. | Popovers become viewport-fixed sheets below the mobile topbar. | Resolved |
| RDEV-018 | Long names relied on desktop truncation rules. | Mobile cards lost important context or overflowed. | Added wrapping where context matters and ellipsis only inside bounded labels. | Resolved |

## Product-owner review

| ID | Product issue found | Business consequence | Resolution | Status |
|---|---|---|---|---|
| RPO-001 | The mobile dashboard looked unfinished despite desktop polish. | Mobile users would distrust the wider ERP product. | Rebuilt the mobile dashboard hierarchy around compact, labeled records and metrics. | Resolved |
| RPO-002 | A single project occupied almost an entire phone screen. | Routine review required too much scrolling. | Reduced project information to a compact, decision-oriented card. | Resolved |
| RPO-003 | Responsive behavior differed by module generation. | Users experienced Formcraft as several unrelated products. | Introduced shared shell, toolbar, record, table, board, form, and summary rules. | Resolved |
| RPO-004 | The product did not define which information should scroll and which should reflow. | Some pages hid data while others became excessively tall. | Defined card conversion for general records and horizontal preservation for calendars, Kanban, invoices, and dense task tables. | Resolved |
| RPO-005 | Mobile creation flows could be obscured by browser UI. | Users could abandon forms or submit incomplete records. | Visual-viewport forms keep fields and footer actions reachable. | Resolved |
| RPO-006 | Tablet users received neither a proper desktop nor mobile experience. | A common business-device segment remained unreliable. | Added explicit tablet navigation, topbar, gutters, toolbars, and content behavior. | Resolved |
| RPO-007 | “Responsive” had no measurable acceptance criteria. | Review could stop at screenshots of one page. | Added viewport matrix, overflow, clipping, table-label, route, modal, and navigation assertions. | Resolved |
| RPO-008 | Mobile navigation could obscure content and actions. | Users might believe records or controls were missing. | Dynamic bottom inset guarantees reachable final content. | Resolved |
| RPO-009 | Fixes risked breaking existing ERP, invoice, calendar, and project flows. | Cosmetic work could regress core operations. | Existing authenticated business-flow suites remain enabled beside the responsive suite. | Resolved |
| RPO-010 | There was no auditable list of responsive defects and decisions. | Stakeholders could not distinguish implemented fixes from future work. | This document and the PR map every identified defect to code and tests. | Resolved |

## Responsive acceptance matrix

| Viewport | Required checks |
|---|---|
| 320 x 800 | No root overflow, compact single-column summaries, reachable controls, usable top and bottom navigation. |
| 360 x 800 | Compact dashboard, project card structure, single-column toolbars where required. |
| 390 x 844 | User-reported dashboard defect fixed, 2 x 2 KPIs, page identity visible, bottom nav does not cover content. |
| 844 x 390 | Short landscape navigation, scrollable business content, no clipped actions. |
| 768 x 1024 | Tablet/mobile transition, usable forms, cards, calendar and app launcher. |
| 1024 x 768 | Tablet overlay navigation and business-page geometry. |
| 1280 x 800 | Narrow desktop topbar, contextual navigation, tables, and app cards. |
| 1536 x 960 | Wide desktop layout, no unnecessary stretching or control collision. |

## Definition of done

- No tested route expands the document beyond the viewport.
- No tested critical interactive control is clipped outside the viewport.
- The mobile topbar is one fixed-height row without a blank extension.
- The dashboard page heading is visible and contains meaningful text.
- Dashboard projects use purpose-built mobile cards.
- Mobile summary metrics remain compact.
- Generic ERP tables have labels before card conversion.
- Dense operations tables and calendars remain deliberately scrollable.
- Boards use viewport-sized horizontal columns.
- Forms remain usable with browser chrome and the on-screen keyboard.
- Final content remains reachable above the bottom navigation.
- Existing project, task, ERP, invoice, BS calendar, email, and authentication regressions remain passing.

## Release assessment

The implementation is **ready for end-to-end verification**. The acceptable release claim after CI and manual review is:

> No known release-blocking responsive defects remain in the tested mobile, tablet, narrow-desktop, wide-desktop, modal, navigation, dashboard, ERP, calendar, invoice, and project/task scope.

Residual risk remains for unusual browser extensions, extreme translated strings, third-party embedded content, and custom future modules that bypass the shared components. The responsive runtime audit and fail-closed tests exist to catch those regressions before deployment.
