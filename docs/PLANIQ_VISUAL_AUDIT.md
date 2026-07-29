# PlanIQ Visual Audit for Formcraft

This document records the detailed visual analysis of the PlanIQ dashboard reference and how its visible system is translated into Formcraft.

## Reference

- Behance project: `https://www.behance.net/gallery/251693759/PlanIQ-SaaS-Project-Management-Dashboard-UIUX`
- Related PlanIQ dashboard shots published by the same design team on Dribbble

Formcraft uses the reference as a design-system study. It does not copy the PlanIQ logo, proprietary artwork, product copy, exact page compositions, or downloadable Figma assets.

## Confidence levels

- **Verified** means the value is publicly exposed in the related PlanIQ project metadata.
- **Measured** means the value was estimated from the published dashboard imagery.
- **Adapted** means the value was adjusted so the much larger Formcraft application remains usable and accessible.

## Color system

### Verified public colors

| Token | Value | Formcraft role |
|---|---:|---|
| Canvas | `#F6F6F6` | Default application background |
| Alternate canvas | `#EFF0F1` | Muted panels and progress tracks |
| Ink | `#040404` | Primary text and dark utility surfaces |
| Electric green | `#95F221` | Primary actions and selected navigation |
| Strong green | `#4DD265` | Progress, active chart data and notification signals |
| Deep green | `#53A964` | Links, success text and secondary positive states |
| Mint | `#74D288` | Soft positive data visualization |
| Muted green-gray | `#4A5F59` | Secondary information |
| Cool gray | `#BCC3CA` | Strong dividers and disabled controls |
| Warm brown | `#C17131` | Review, warning and attention states |

### Usage rule

Electric green is scarce. It marks the current navigation item, primary action, selected control, active progress, or the most important chart series. It is not used as a large decorative background.

Black is used for text and one high-contrast utility surface, such as meeting notes, an AI assistant, urgent focus, or the current work session.

## Typography

The public Behance and Dribbble pages do not identify the font family. The visible letterforms are closest to a modern neutral grotesk.

Formcraft therefore uses:

```css
font-family: Inter, ui-sans-serif, system-ui, sans-serif;
```

This is an informed implementation choice, not a verified claim about the original Figma file.

### Type scale

| Purpose | Size | Weight | Line height |
|---|---:|---:|---:|
| Main greeting | `26–34px` | `700` | `1.08` |
| Page title | `16px` | `650` | `1.2` |
| KPI value | `28px` | `700` | `1.05` |
| Card title | `14px` | `650` | `1.25` |
| Body | `11–13px` | `400–500` | `1.45` |
| Navigation | `11px` | `600` | `1` |
| Table content | `10px` | `400–600` | `1.35` |
| Eyebrow and metadata | `8–9px` | `600` | `1.3` |

Headlines use tight negative tracking. Body copy remains neutral and compact.

## Spacing

The interface follows a measured 4/8-point rhythm.

```text
4, 8, 12, 16, 24, 32, 40, 48
```

### Application spacing

- Page gutter: `24px` desktop, `14px` tablet, `10px` mobile
- Grid gap: `12px`
- Card padding: `14–15px`
- Compact control gap: `7–8px`
- Header-to-content gap: `16px`
- Table row padding: `10px`
- Navigation item horizontal padding: `11px`

Large empty areas are avoided. The dashboard is information-dense but not cramped.

## Geometry

| Component | Radius |
|---|---:|
| Floating top navigation | `18px` |
| Main cards | `16px` |
| Inputs and buttons | `10px` |
| Small icon containers | `7–10px` |
| Status and navigation pills | Fully rounded |

Borders are generally `1px` and low contrast. Shadows are reserved for the floating navigation, dialogs and hover elevation.

## Navigation

The desktop default uses a floating horizontal product navigation:

1. Brand
2. Primary product areas
3. Current item shown as an electric-green pill
4. Search and account utilities

Because Formcraft contains far more modules than the reference, the navigation supports horizontal overflow. Mobile continues to use an accessible drawer rather than shrinking every destination into microscopic confetti.

## Dashboard composition

The reference uses a modular grid rather than one monolithic analytics canvas.

Formcraft follows this hierarchy:

1. Greeting and concise page context
2. Three compact KPI cards
3. Large project-overview chart
4. One dark focus/utility card
5. Dense task or project list
6. Supporting activity panel

The fourth metric remains available at tablet and mobile widths but is hidden on wide desktop because progress is already communicated by the focus card.

## Card anatomy

A normal card contains:

1. Small muted label or eyebrow
2. Clear title or numeric value
3. One supporting line
4. Optional compact control

Cards use white surfaces, a thin neutral border and almost no default shadow. Hover changes the border and adds a very soft shadow without moving content.

## Dark utility card

One black card is permitted per primary dashboard viewport.

It may represent:

- Current meeting
- AI assistant
- Today’s focus
- Urgent workflow
- Active timer

It uses white text, cool-gray secondary text and electric-green progress or action elements.

## Charts

- Neutral gray provides historical or contextual data.
- Electric or strong green marks the active series.
- Warm brown is used only for warning or review data.
- Chart grids are thin and low contrast.
- Bars are compact with `4px` top radii.
- Legends are small and secondary.
- Values cannot rely on color alone in the production chart components.

## Tables and lists

- Header labels are `8px`, semibold and muted.
- Rows use approximately `10px` vertical padding.
- Status values are pills rather than full-cell color blocks.
- Row hover uses a nearly invisible neutral background.
- Actions remain compact and appear consistently at the row end.

## Icons

The reference uses small, simple line icons. Formcraft’s production component system should standardize on one line-icon family, preferably Lucide, at `16–18px` with a `1.75–2px` stroke.

Emoji must not be used as permanent interface icons.

## Motion

Motion is subtle:

- `120–180ms` for hover and selected-state transitions
- No bouncing cards
- No decorative looping animations
- No layout movement during hover
- Reduced-motion preferences are respected

## Responsive behavior

### Desktop

- Floating horizontal navigation
- Three KPI cards
- Two-column analytical grid
- Dense tables

### Tablet

- Navigation becomes a drawer
- KPI cards use two columns
- Analytical panels stack
- Table containers scroll when necessary

### Mobile

- Single-column cards
- Simplified controls
- Drawer navigation
- Tables become horizontally scrollable or purpose-built card lists
- Primary action remains reachable without covering content

## Accessibility requirements

- Body text must meet WCAG AA contrast.
- Electric green cannot be used for small text on white without a darker text color.
- Green buttons use near-black text.
- Focus rings use a green-and-white mixed outline.
- Charts require labels, tooltips and non-color cues.
- The navigation must remain keyboard-scrollable when it overflows.

## Implementation status

The current Formcraft branch applies:

- The verified public PlanIQ palette
- Inter as the documented closest font match
- Floating horizontal desktop navigation
- Measured spacing and radius system
- Three-card desktop KPI row
- Black focus utility card
- Compact chart, table and status styling
- Matching Calendar, Email, File Manager and Invoice surfaces
- Responsive drawer behavior

Further page-by-page work must reuse these tokens rather than inventing local colors, spacing or component shapes.
