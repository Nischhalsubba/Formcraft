# PlanIQ Visual Audit for Formcraft

This audit records the details visible in the user-supplied PlanIQ presentation and how they are translated into Formcraft.

## Reference evidence

The supplied presentation explicitly shows:

- Typeface: **Manrope**
- Weights: Regular, Medium, Semibold, Bold
- Presentation scale: Heading 1 `56px`, subheading `40px`, body `24px`
- Primary color: `#75FC96`
- Red: `#D13817`
- Black: `#000000`
- Gray: `#ADADAD`
- White: `#FFFFFF`

It also shows a light project-management dashboard, horizontal pill navigation, compact KPI cards, green and neutral charts, a black meeting card, an AI-assistant surface, calendar views, export dialogs, responsive mobile layouts, and rounded white cards on a soft-gray canvas.

## Translation boundary

Formcraft follows the design system, not the PlanIQ brand. It does not reuse the PlanIQ logo, name, product copy, exact screen compositions, photographs, mockups, decorative artwork, or client identity.

## Color system

| Token | Value | Formcraft role |
|---|---:|---|
| Primary green | `#75FC96` | Primary actions, active navigation, selection, progress and positive data |
| Red | `#D13817` | Destructive actions, validation errors, failed and overdue states |
| Black | `#000000` | Primary text and one strong meeting/AI/focus surface |
| Gray | `#ADADAD` | Supporting text, disabled states, neutral chart context |
| White | `#FFFFFF` | Cards, forms, navigation and content surfaces |
| Adapted canvas | `#F6F6F6` | Application background derived from the visible presentation canvas |
| Adapted border | `#E7E7E7` | Quiet card and control separation |
| Adapted green tint | `#EAFFEF` | Positive secondary states |
| Adapted red tint | `#FFF0EC` | Error and destructive secondary states |

### Usage rules

- Green is scarce and purposeful.
- Black is used for text and one high-contrast utility card.
- Red remains reserved for negative states.
- Gray provides hierarchy without adding more brand colors.
- White remains the dominant working surface.

## Typography

The supplied image identifies Manrope directly, so Formcraft uses:

```css
font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
```

### Presentation scale versus application scale

The 56px, 40px and 24px values belong to the portfolio presentation. Applying 24px body copy to dense tables and forms would make the dashboard unusable. Formcraft preserves the visual ratio through a responsive product scale:

| Purpose | Formcraft size | Weight |
|---|---:|---:|
| Main greeting | `28–40px` | `700` |
| Route title | `16–20px` | `700` |
| KPI value | `28px` | `700` |
| Card title | `14–16px` | `700` |
| Body | `12–14px` | `400–500` |
| Navigation | `10–11px` | `600` |
| Table content | `10–12px` | `400–600` |
| Metadata | `8–10px` | `600` |

Headings use tight tracking. Body copy uses a comfortable line height and no ultra-light weights.

## Spacing

The visible interface uses a compact 4px rhythm:

```text
4, 8, 12, 16, 24, 32, 40, 48, 64
```

Applied rules:

- Desktop page gutter: `24px`
- Tablet gutter: `14px`
- Mobile gutter: `10px`
- Card and grid gap: `12px`
- Card padding: `14–16px`
- Table row padding: approximately `10px`
- Compact control gap: `7–8px`
- Major section separation: `24–32px`

## Geometry

| Component | Radius |
|---|---:|
| Floating horizontal navigation | `18px` |
| Main cards | `16px` |
| Inputs and standard buttons | `10px` |
| Dialogs and major containers | `20–22px` |
| Navigation, filters and statuses | Fully rounded |

Borders are thin and neutral. Shadows are reserved for floating navigation, dialogs, menus, and restrained hover feedback.

## Navigation

The reference uses a horizontal navigation bar with:

1. compact brand mark;
2. product destinations;
3. an active green pill;
4. search and utilities;
5. user profile.

Formcraft follows that desktop pattern. Because it contains substantially more modules, navigation supports horizontal overflow. Tablet and mobile use a drawer rather than shrinking labels into decorative dust.

## Dashboard composition

The supplied dashboard establishes this order:

1. horizontal product navigation;
2. greeting and brief context;
3. three compact KPI cards;
4. main project overview chart;
5. task statistics;
6. one black meeting card;
7. AI-assistant card;
8. task list and detailed operations.

Formcraft adapts this into:

1. navigation;
2. greeting;
3. KPI row;
4. primary analysis panel;
5. one black focus, meeting or assistant card;
6. operational table;
7. supporting activity.

## Card anatomy

Normal cards contain:

- a small label;
- one clear value or heading;
- a supporting line;
- an optional compact action.

They use white, a quiet border, 16px radius, and almost no default shadow.

## Black utility surface

The presentation repeatedly uses black for a current meeting or high-value assistant interaction. Formcraft allows one prominent black card per main dashboard viewport.

It uses:

- white primary text;
- gray supporting text;
- green progress and actions;
- minimal decoration.

## Charts

- Gray represents contextual or inactive data.
- Green marks active, selected or positive data.
- Red represents critical or negative data only.
- Grid lines stay thin and low contrast.
- Bars remain compact.
- Legends and controls remain secondary.
- Production charts require labels and non-color cues.

## Tables and lists

- Headers are small, muted and semibold.
- Rows remain compact.
- Statuses use pills rather than colored cells.
- Hover uses a nearly invisible neutral surface.
- Actions stay aligned at the row end.

## Calendar

The reference calendar combines:

- horizontal project cards;
- day, week and month controls;
- compact filter and date controls;
- a spacious weekly time grid;
- green event emphasis;
- avatars and small supporting metadata.

Formcraft calendar views inherit the same color, typography, spacing and card geometry while retaining their own domain model and interactions.

## AI assistant

The reference assistant uses:

- white or green conversation surfaces;
- a strong greeting;
- compact workspace filters;
- large quick-action cards;
- simple composer controls;
- green as the action signal.

Formcraft can use this pattern for a future assistant module without copying PlanIQ copy or artwork.

## Responsive behavior

### Desktop

- Floating horizontal navigation
- Three KPI cards
- Two-column analytical grid
- Dense tables

### Tablet

- Drawer navigation
- Two-column KPI cards
- Stacked analytical panels
- Scrollable tables

### Mobile

- Single-column layout
- Compact controls
- Touch-friendly navigation drawer
- Operational lists simplified or made horizontally scrollable

## Accessibility requirements

- Body text targets WCAG AA contrast.
- Green buttons use black text.
- Focus rings remain visible on white and black surfaces.
- Charts include labels and non-color cues.
- Navigation remains keyboard accessible.
- Touch targets reach 44px when practical.
- Reduced-motion preferences are honored.

## Implementation status

The current Formcraft branch applies:

- Manrope at weights 400–800;
- the exact five-color reference palette;
- a soft-gray canvas and white surfaces;
- horizontal desktop navigation;
- adapted application typography;
- compact modular spacing;
- black focus utility card;
- matching Calendar, Email, File Manager and Invoice surfaces;
- responsive drawer behavior;
- reduced-motion support.

Future pages must reuse the canonical tokens in `docs/DESIGN_SYSTEM.md` rather than reintroducing old palettes or local one-off component rules.
