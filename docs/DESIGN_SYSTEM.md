# Formcraft Design System

Formcraft is intentionally designed as a calm, capable operations product rather than a reskinned marketplace template. The visual language combines structured blue-green foundations with warm status accents.

## Brand palette

| Token | Hex | Primary role |
|---|---|---|
| Ink | `#264653` | Navigation, headings, dense structure, dark surfaces |
| Teal | `#2A9D8F` | Primary actions, active states, progress, success |
| Gold | `#E9C46A` | Attention, highlights, medium-priority information |
| Orange | `#F4A261` | Warnings, pending states, secondary data series |
| Coral | `#E76F51` | Errors, destructive actions, overdue and critical states |

The five colors are not interchangeable decoration. Each has a defined semantic role so users can learn the interface reliably.

## Semantic color rules

### Ink

Use for:

- Sidebar and navigation structure.
- Primary text in the light theme.
- Dense headers and data labels.
- Dark-theme foundation.

Do not use Ink for every card background. The product needs depth and separation rather than one enormous dark rectangle, a treasured dashboard tradition for reasons nobody can explain.

### Teal

Use for:

- Primary buttons.
- Active navigation.
- Focused controls.
- Success states.
- Progress bars.
- Selected table rows.
- Primary chart series.

Teal must not be used for destructive actions or warning messages.

### Gold

Use for:

- Medium-priority states.
- Review status.
- Important but non-blocking notices.
- Highlighted metrics.
- Secondary chart series.

Gold text on white requires a darker derived shade for contrast.

### Orange

Use for:

- Warning states.
- Pending and at-risk indicators.
- Time-sensitive notices.
- Tertiary chart series.

### Coral

Use for:

- Delete and destructive actions.
- Validation errors.
- Failed operations.
- Overdue records.
- Critical notifications.

Coral should remain scarce. If half the page is coral, the color no longer communicates urgency and the interface merely appears sunburned.

## Theme tokens

### Light theme

| Role | Value |
|---|---|
| Page background | `#F8F5EC` |
| Primary surface | `#FFFDF8` |
| Secondary surface | `#F4EFE3` |
| Tertiary surface | `#EBE3D3` |
| Primary text | `#264653` |
| Secondary text | `#5F7479` |
| Border | `#D8D6C9` |
| Primary action | `#238C80` |
| Primary soft | `#D9EFEB` |
| Warning text | `#BD8D25` |
| Danger text | `#C6533B` |

### Dark theme

| Role | Value |
|---|---|
| Page background | `#142D36` |
| Primary surface | `#1B3943` |
| Secondary surface | `#214650` |
| Tertiary surface | `#294F59` |
| Primary text | `#F8F4E9` |
| Secondary text | `#B8C9C9` |
| Border | `#365B64` |
| Primary action | `#2A9D8F` |
| Warning | `#E9C46A` |
| Info | `#F4A261` |
| Danger | `#E76F51` |

## Typography

Use a neutral interface sans-serif with clear numerals and strong small-size rendering.

Recommended stack:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Type scale

| Style | Size | Weight | Use |
|---|---:|---:|---|
| Display | 32-40px | 750-800 | Dashboard welcome and rare major states |
| Page title | 20-24px | 700-750 | Route title |
| Section title | 16-18px | 700 | Panels and cards |
| Body | 14px | 400-500 | Standard content |
| Small | 12px | 400-600 | Metadata and compact controls |
| Label | 10-11px | 700-800 | Uppercase navigation and table labels |

Avoid very light weights. Admin screens contain dense information and must remain readable under imperfect displays, glare, and the many other punishments inflicted upon office workers.

## Spacing

Use a 4px base unit.

```text
4, 8, 12, 16, 20, 24, 32, 40, 48, 64
```

Rules:

- 4-8px for icon and inline gaps.
- 12px for compact controls.
- 16-20px for card padding.
- 24-32px for page and section spacing.
- 40px or more only between major content groups.

## Radius

| Token | Value | Use |
|---|---:|---|
| Small | 8-10px | Inputs, chips, compact buttons |
| Medium | 12-14px | Cards, tables, panels |
| Large | 18-20px | Modals and major containers |
| Pill | 999px | Status chips and avatars only |

Avoid applying pill shapes to every button. A dashboard is not a collection of medicinal capsules.

## Elevation

Use borders for most separation. Shadows are reserved for floating layers.

- Cards: no shadow or a very subtle ambient shadow.
- Sticky header: subtle shadow only while content scrolls underneath.
- Dropdowns: medium shadow.
- Modals and command palette: strong shadow.
- Focus must never rely on shadow alone.

## Layout

### Desktop

- Sidebar: 248-264px.
- Top bar: 72-88px.
- Content padding: 24-32px.
- 12-column content grid.
- Maximum readable form width: 760px.

### Tablet

- Sidebar becomes an overlay drawer.
- Two-column metric and card layouts collapse progressively.
- Tables preserve priority columns and allow horizontal scrolling where necessary.

### Mobile

- Single-column content.
- Sticky top bar.
- Primary actions remain reachable.
- Filter toolbars become horizontally scrollable or move into sheets.
- Minimum interactive target: 44x44px.

## Navigation

The sidebar uses Ink as its stable visual anchor. Active items use a Teal-tinted background and a narrow Teal indicator. Navigation groups are:

- Overview
- Operations
- Data
- Components
- System

Nested groups should open predictably and remember their expanded state. Icon-only mode must retain tooltips and accessible labels.

## Components

### Buttons

- Primary: Teal fill, white text.
- Secondary: surface background and border.
- Tertiary: text-only.
- Warning: Orange-tinted treatment.
- Destructive: Coral-tinted treatment, solid Coral only for final confirmation.

States required: hover, focus-visible, active, loading, disabled, and destructive confirmation.

### Inputs

- Labels remain visible; placeholders never replace labels.
- Focus uses Teal border plus a visible focus ring.
- Errors use Coral icon, border, and message.
- Warnings use Orange.
- Success confirmation uses Teal.
- Disabled controls must remain readable.

### Cards and panels

- Clear title and optional metadata.
- Actions aligned consistently in the header.
- Avoid decorative gradients inside data cards.
- Empty and loading states occupy the same basic footprint as loaded content to reduce layout shift.

### Tables

- Sticky headers for long datasets.
- Row hover uses a subtle Teal tint.
- Selected rows use a stronger Teal tint and visible checkbox state.
- Coral is reserved for destructive row actions.
- Column alignment follows data type: text left, numbers right, states centered only where useful.

### Status mapping

| State | Color |
|---|---|
| Active, complete, paid, online | Teal |
| Review, medium priority, highlighted | Gold |
| Pending, warning, due soon | Orange |
| Error, overdue, failed, destructive | Coral |
| Draft, inactive, neutral | Ink/neutral surface |

### Notifications

- Toasts appear in a consistent corner and do not block primary actions.
- Success toasts use Teal.
- Warning toasts use Orange.
- Error toasts use Coral.
- Persistent issues belong in inline alerts, not disappearing toasts.

## Charts

Recommended accessible series order:

1. `#2A9D8F`
2. `#E9C46A`
3. `#F4A261`
4. `#E76F51`
5. `#39717C`
6. `#7AB8AE`
7. `#B08B3B`
8. `#A94F3B`

Rules:

- Do not communicate meaning by color alone.
- Provide legends, labels, patterns, or direct annotations.
- Use Coral only when the series represents a negative or critical state, unless it is simply part of a categorical chart with explicit labels.
- Tooltips use the current surface color and accessible contrast.
- Every chart has loading, empty, and error states.

## Icons

Use one primary outline icon family throughout navigation and actions. A secondary filled family may be used for demonstrations in the icon browser, not randomly across production screens.

- Navigation: 18-20px.
- Inline actions: 16-18px.
- Empty states: 32-48px.
- Icons always receive text labels or accessible names when they perform actions.

## Motion

- Hover and focus transitions: 120-160ms.
- Drawer and modal transitions: 180-240ms.
- Charts: 250-400ms where motion improves understanding.
- Respect `prefers-reduced-motion`.
- Avoid continuous decorative animation in data-heavy screens.

## Accessibility

- Body text contrast targets WCAG AA, 4.5:1.
- Large text and non-text UI target at least 3:1.
- Focus indicators must remain visible on every theme and palette color.
- Every dialog traps focus and returns it to its trigger.
- Error summaries link to invalid fields.
- Tables include semantic headers and captions where needed.
- Charts expose a text summary or downloadable table.
- Color is never the sole carrier of meaning.

## Brand language

Formcraft copy should be:

- Direct.
- Calm.
- Specific.
- Task-oriented.
- Free of empty marketing language.

Use “Create invoice,” not “Unlock your financial journey.” The invoice has suffered enough.

## Anti-patterns

Do not:

- Copy the source dashboard layout screen-for-screen.
- Reuse its logo, product name, sample companies, or artwork.
- Apply all five palette colors to every component.
- Use gradients as a substitute for hierarchy.
- Hide labels in favor of placeholders.
- Remove focus outlines.
- make every card float with a large shadow.
- invent dashboard statistics presented as real data.
