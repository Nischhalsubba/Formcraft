# Flexxeriin Figma Pattern for Formcraft

## Source

- Figma file: `Flexxeriin - Dashboard Finance Management`
- File key: `neWhcZBv6Dgjvqk8KtkUiY`
- Reference node: `205:3407`

The source contains a single finance-dashboard frame. Formcraft adopts its layout grammar and visual tokens while retaining Formcraft branding, project-management content, and application functionality.

## Verified frame geometry

- Canvas background: `#F5F4F7`
- Canvas radius: `24px`
- Canvas inset: `12px`
- Hero radius: `20px`
- Hero height in the source frame: `508px`
- Desktop hero/content gutter: `80px`
- KPI card radius: `12px`
- KPI card width in the source frame: `402px`
- KPI card height in the source frame: `212px`
- Standard panel radius: `10-12px`
- Compact control radius: `10px`
- Internal card padding: `24px`
- Large grid gap: `24px`
- Compact content gap: `4-12px`

## Verified colors

| Role | Value |
|---|---|
| Canvas | `#F5F4F7` |
| Surface | `#FFFFFF` |
| Primary text | `#191919` |
| Secondary text | `#757575` |
| Faint label | `#BABABA` |
| Divider | `#E7E7E7` |
| Primary data/action | `#4D67EB` |
| Positive | `#29C930` |
| Negative | `#C92929` |
| Hero start | `#0C2D54` |
| Hero end | `#5F225C` |
| Hero overlay | `#120C0D` |

## Typography

The dashboard content uses Manrope. Navigation and the source wordmark use Montserrat. One status treatment uses Plus Jakarta Sans, but Formcraft standardizes status labels on Manrope for consistency.

### Application scale

| Purpose | Size | Weight |
|---|---:|---:|
| Hero/page greeting | `27-32px` | `700` |
| KPI label | `18-20px` | `600` |
| KPI value | `25-28px` | `600` |
| Panel title | `20-24px` | `600` |
| Standard body | `14px` | `500` |
| Supporting text | `12px` | `500` |
| Navigation | `13-16px` | `500-600` |
| Table header | `11-12px` | `500` |

Letter spacing is slightly negative throughout the frame, generally around `-2%` to `-3%`.

## Shared application shell

All Formcraft routes use the same composition:

1. Dark navy-to-plum route hero
2. Product navigation inside the hero
3. Breadcrumb or route context
4. Primary route title and concise supporting copy
5. White cards or modules beneath the hero
6. `24px` major layout gaps
7. `12px` card radii and `10px` control radii

The dashboard uses overlapping KPI cards. Secondary routes use the same header but begin their operational content directly below it.

## Dashboard mapping

| Figma area | Formcraft content |
|---|---|
| Total Balance card | Active projects |
| Total Income card | Open tasks |
| Total Expends card | Team members |
| Revenue Transaction chart | Project activity |
| Last Transaction table | Active projects table |
| Overview / Analytics / Events / Message tabs | Formcraft route navigation and dashboard context |

The source finance values are not copied. Formcraft metrics continue to be generated from its local project, task, and team dataset.

## Route mapping

### Projects

- Dark route hero
- Filter toolbar beneath hero
- White 12px project cards
- Blue-violet active and progress treatment
- Red restricted to deletion, failure, and overdue states

### Tasks

- Dark route hero
- Compact filter controls
- White transaction-style table
- Muted headers and 14px data rows
- Status labels use small rectangular pills

### Calendar

- Dark route hero
- White calendar shell
- `12px` frame radius
- `10px` event controls
- Primary blue-violet for selected dates and standard events

### Email

- Dark route hero
- White list/reader surfaces
- Thin gray row dividers
- Compact sender, subject, date hierarchy

### File Manager

- Dark route hero
- White file cards with 12px radii
- 24px panel padding
- Blue-violet icon containers

### Invoices

- Dark route hero
- Three or four compact summary cards
- Dense white invoice table
- Positive and negative amounts use green and red

### Reports

- Dark route hero
- White chart panels
- Blue-violet primary series
- Green positive series and red negative series

### Team, Activity, Settings

- Dark route hero
- White operational cards
- Consistent panel headings, controls, spacing, and radii

## Responsive translation

### Desktop

- Navigation remains horizontal inside the hero
- Dashboard KPI cards use three columns
- Chart and table use a two-column analytical layout
- Desktop gutters scale up to `80px`

### Tablet

- Navigation becomes the existing drawer
- KPI cards use two columns, then one full-width card
- Analytical panels stack when needed
- Gutter reduces to `20-36px`

### Mobile

- Single-column KPI cards
- Compact hero
- Drawer navigation
- Search and nonessential top actions collapse
- Tables remain horizontally scrollable
- Card padding reduces to `18px`

## Interaction requirements

- Existing project and task CRUD remains functional
- Route hashes continue to work
- Theme selection remains persistent
- Calendar, Email, Files, and Invoices continue to use their existing local persistence
- Keyboard focus remains visible
- Reduced-motion preferences are respected

## Boundary

Formcraft does not copy the Flexxeriin name, logo, sample finance records, marketing copy, or exact proprietary artwork. The dashboard frame is used as a layout and design-system reference for an original Formcraft implementation.
