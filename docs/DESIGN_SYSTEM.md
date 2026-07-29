# Formcraft Design System

This document is the canonical visual system for Formcraft. It is based on the user-supplied PlanIQ reference screens and replaces the earlier blue-green palette and Inter typography.

## Core identity

- Product type: full-featured SaaS administration and project-operations dashboard
- Visual character: minimal, modular, calm, dense, rounded, and highly functional
- Primary typeface: **Manrope**
- Primary accent: **Fresh green `#75FC96`**
- Destructive accent: **Red `#D13817`**
- Structural colors: **Black `#000000`**, **Gray `#ADADAD`**, **White `#FFFFFF`**

The product should feel like a serious work tool rather than a colorful marketplace template. Green is a signal, not wallpaper.

## Canonical palette

| Token | Value | Usage |
|---|---:|---|
| Primary green | `#75FC96` | Primary actions, active navigation, selected controls, progress, positive chart series |
| Red | `#D13817` | Destructive actions, validation errors, failed states, overdue records |
| Black | `#000000` | Primary text, strong utility cards, meeting and AI-assistant surfaces |
| Gray | `#ADADAD` | Supporting text, disabled states, secondary information |
| White | `#FFFFFF` | Cards, controls, content surfaces, text on black |
| App canvas | `#F6F6F6` | Default light-theme page background |
| Soft surface | `#FAFAFA` | Hover states and muted card sections |
| Border | `#E7E7E7` | Standard separators and component outlines |
| Green tint | `#EAFFEF` | Success backgrounds and selected secondary states |
| Red tint | `#FFF0EC` | Error and destructive backgrounds |

## Color rules

### Green

Use green for:

- the primary call to action;
- active navigation;
- progress and completion;
- selected filters;
- successful states;
- the dominant positive chart series.

Green buttons use black text. Small green text on white is avoided because contrast becomes unreliable.

### Red

Use red only for:

- delete and destructive confirmation;
- validation errors;
- failed operations;
- overdue or blocked items;
- critical notifications.

### Black

Black is used for primary text and one strong utility surface per dashboard viewport, such as meeting notes, active focus, an AI assistant, or an urgent work session.

### Gray and white

White is the normal working surface. Gray establishes hierarchy through supporting text, borders, disabled states, and neutral charts.

## Typography

```css
font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
```

Weights:

- Regular: `400`
- Medium: `500`
- Semibold: `600`
- Bold: `700`
- Extra-bold, reserved for exceptional metrics: `800`

### Responsive application scale

The reference presentation lists Heading 1 at 56px, subheading at 40px, and body at 24px. Those are showcase sizes, not appropriate defaults for a dense admin application. Formcraft preserves the ratio while adapting it:

| Style | Desktop size | Weight | Use |
|---|---:|---:|---|
| Display greeting | `28–40px` | `700` | Dashboard welcome and major empty states |
| Route title | `16–20px` | `700` | Page context |
| KPI value | `28px` | `700` | Primary dashboard metrics |
| Card heading | `14–16px` | `700` | Panels, dialogs and modules |
| Body | `12–14px` | `400–500` | Standard content |
| Navigation | `10–11px` | `600` | Product navigation |
| Table content | `10–12px` | `400–600` | Dense operational data |
| Metadata | `8–10px` | `600` | Labels, timestamps and table headers |

Headings use tight negative tracking. Body copy uses comfortable line height and avoids very light weights.

## Spacing

Use a 4px base grid:

```text
4, 8, 12, 16, 24, 32, 40, 48, 64
```

Application rules:

- Desktop page gutter: `24px`
- Tablet gutter: `14px`
- Mobile gutter: `10px`
- Standard grid gap: `12px`
- Card padding: `14–16px`
- Header-to-content gap: `16px`
- Compact control gap: `7–8px`
- Table row padding: approximately `10px`

## Geometry

| Component | Radius |
|---|---:|
| Floating product navigation | `18px` |
| Cards and major panels | `16px` |
| Dialogs and major containers | `20–22px` |
| Inputs and standard buttons | `10px` |
| Icon containers | `7–10px` |
| Navigation, filters and statuses | Fully rounded |

Borders are normally 1px and low contrast. Shadows are reserved for the floating navigation, dialogs, menus, and subtle hover elevation.

## Layout

### Desktop

- Floating horizontal product navigation
- Brand, primary modules, search, notifications and account in one compact bar
- Three-column KPI row
- Two-column analytical grid
- Dense project and task tables
- One black utility card
- Maximum content width around 1460px

Formcraft has more modules than the reference, so desktop navigation may scroll horizontally while remaining keyboard accessible.

### Tablet

- Navigation becomes an overlay drawer below 861px
- KPI cards use two columns
- Analytical panels stack
- Tables scroll horizontally when necessary

### Mobile

- Single-column cards
- Drawer navigation
- Primary actions remain reachable
- Dense tables may use horizontal scrolling or purpose-built cards
- Interactive targets remain at least 44px where touch use is expected

## Dashboard hierarchy

1. Navigation
2. Greeting and concise context
3. Compact KPI cards
4. Primary project or operational chart
5. One black focus, meeting or assistant card
6. Detailed table or list
7. Supporting activity and guidance

Avoid repeated page titles, oversized hero areas, decorative gradients, or multiple competing dark cards.

## Components

### Buttons

- Primary: green fill with black text
- Secondary: white or current surface with gray border
- Tertiary: text-only
- Destructive: pale red surface, becoming solid red only for final confirmation
- Top-level actions may use pill geometry; normal form buttons use 10px radius

Required states: hover, focus-visible, active, loading, disabled, and destructive confirmation.

### Inputs

- Labels remain visible
- Placeholder text never replaces the label
- Focus uses a green ring
- Errors use red border, icon and message
- Disabled controls remain readable

### Cards

- White surface
- Thin gray border
- 16px radius
- No decorative gradient
- Little or no default shadow
- Clear title, value, supporting line and optional compact action

### Black utility card

Only one prominent black card should appear in a dashboard viewport. It may represent:

- current meeting;
- AI assistant;
- today’s focus;
- active timer;
- urgent workflow.

It uses white text, gray secondary text and green actions or progress.

### Tables

- Muted compact headers
- Consistent row height
- Subtle neutral hover
- Status pills rather than colored cells
- Row actions aligned to the end
- Text left aligned, numbers right aligned

### Status mapping

| State | Treatment |
|---|---|
| Active, completed, paid, online | Green tint with dark-green text |
| Draft, review, inactive, neutral | Gray surface and text |
| Error, blocked, overdue, destructive | Red tint with red text |

## Charts

- Gray represents context or inactive data
- Green marks the active or most important positive series
- Red is reserved for negative or critical data
- Grid lines remain thin and low contrast
- Legends are small and secondary
- Charts never rely on color alone; labels and tooltips remain required

## Icons

Use one consistent outline icon family, preferably Lucide:

- Navigation: `16–18px`
- Inline actions: `16px`
- Empty states: `32–48px`
- Stroke: approximately `1.75–2px`

Emoji are not permanent production icons.

## Motion

- Hover and selection: `120–180ms`
- Drawer and modal: `180–240ms`
- No bouncing cards
- No decorative looping animation
- No content movement on hover
- Respect `prefers-reduced-motion`

## Accessibility

- Body text targets WCAG AA contrast
- Green buttons use black text
- Focus indicators remain visible on every surface
- Dialogs trap focus and return it to their triggers
- Forms associate errors with fields
- Tables use semantic headers
- Charts expose labels and non-color cues
- Color is never the only carrier of meaning

## Anti-patterns

Do not:

- reintroduce the former teal, gold, orange and coral palette;
- use Inter instead of Manrope;
- apply green to large decorative areas inside the application;
- create several black feature cards on one screen;
- use the 56/40/24 presentation scale for every admin component;
- copy PlanIQ branding, logo, product copy or exact page compositions;
- remove labels or focus indicators;
- invent dashboard statistics presented as real data.
