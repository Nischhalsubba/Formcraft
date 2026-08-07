# Formcraft Design System — Worldclass 2026.2

## Product thesis

Formcraft is a Nepal-first business operating workspace. It should feel like a calm, high-trust control room: precise enough for finance and operations, warm enough for people and project work, and cohesive enough that a dropdown, table, dialog, dashboard, and record page unmistakably belong to the same product.

## Visual thesis

**Solid-color quiet authority + Nepal warmth + operational clarity.**

- Dark mineral green is the navigation anchor.
- Warm stone neutrals form the workspace canvas and surfaces.
- Teal-green is the functional primary for selection, focus, and primary action.
- Terracotta is a scarce accent for emphasis, never a competing primary.
- Manrope carries display hierarchy; Inter carries interface and body copy.
- A 4px base rhythm creates dense, deliberate spacing without crowding.
- Borders establish hierarchy first; restrained shadows communicate genuine elevation.
- Components use 8–20px radii according to scale, not arbitrary rounding.
- **All color gradients are forbidden.** Depth comes from solid surfaces, border contrast, spacing, elevation, and motion.

### Forbidden visual patterns

- No linear, radial, conic, mesh, rainbow, or simulated color gradients.
- No glowing neon borders or halos.
- No glassmorphism on product UI.
- No blur used as decorative styling. Backdrop blur is allowed only for a modal scrim when needed for separation.
- No decorative card-within-card nesting when a divider or spacing group is enough.
- No emoji as structural iconography.
- No hidden keyboard focus treatment.
- No page-specific popup styling that bypasses the floating-surface system.

## Interaction thesis

**Fast, anchored, calm, reversible.**

- Micro feedback: 120ms.
- Floating surface entry: 180ms, `power2.out`, opacity + 6px translation + 0.985 scale.
- Floating surface exit: 110ms, `power1.in`, opacity + 3px translation + 0.99 scale.
- Standard UI transition: 220ms.
- Page/section arrival: 420ms, `power3.out`, 12px maximum translation.
- Stagger: 35ms, capped to the first ten meaningful siblings.
- Hover displacement: 1–2px maximum and desktop-pointer only.
- No bounce, elastic overshoot, spinning menus, or decorative motion in daily workflows.
- All significant motion respects `prefers-reduced-motion` and degrades to direct state changes.
- User input is never blocked by animation.

## Core tokens

### Light theme

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#F2F4F1` | App background |
| `--surface` | `#FCFDFB` | Primary surfaces |
| `--surface-soft` | `#F6F8F5` | Grouped/hover surface |
| `--surface-raised` | `#FFFFFF` | Dialogs/popovers |
| `--surface-strong` | `#EDF1EE` | Tracks and stronger neutral fill |
| `--ink` | `#0D1715` | Primary text |
| `--muted` | `#58635F` | Secondary text |
| `--muted-2` | `#7A8681` | Tertiary labels |
| `--border` | `#DCE3DF` | Standard borders |
| `--border-strong` | `#C7D1CC` | Strong dividers |
| `--primary` | `#0F6B5F` | Primary actions/selection |
| `--primary-hover` | `#0B5A50` | Primary hover |
| `--primary-soft` | `#E7F3EF` | Selected/soft primary |
| `--fcw-accent` | `#C85F35` | Scarce warm accent |
| `--fcw-accent-soft` | `#FCECE4` | Accent background |
| `--success` | `#187A55` | Success |
| `--warning` | `#966112` | Warning |
| `--danger` | `#B43B45` | Destructive |
| `--info` | `#315FA8` | Informational |

### Dark theme

| Token | Value |
|---|---|
| `--canvas` | `#0B100F` |
| `--surface` | `#111917` |
| `--surface-soft` | `#16201D` |
| `--surface-raised` | `#1A2421` |
| `--surface-strong` | `#202D29` |
| `--ink` | `#F1F5F2` |
| `--muted` | `#A6B1AC` |
| `--muted-2` | `#7F8C87` |
| `--border` | `#27332F` |
| `--border-strong` | `#364740` |
| `--primary` | `#72D4BF` |
| `--primary-hover` | `#96E3D2` |
| `--primary-soft` | `#173A33` |
| `--fcw-accent` | `#F09A72` |
| `--fcw-accent-soft` | `#422A20` |

## Typography

- Display: `Manrope`, 650–800.
- Interface/body: `Inter`, 400–700.
- Data and money: tabular figures.
- Page title: `clamp(1.75rem, 2.4vw, 2.65rem)`, line-height 1.06.
- Section title: 1–1.25rem, line-height 1.25.
- Desktop body: 0.875rem, line-height 1.55.
- Mobile body: minimum 1rem where text input/zoom behavior matters.
- Labels: 0.75rem, 650.
- Navigation eyebrow: 0.5625rem–0.6875rem, uppercase, 0.09–0.11em tracking.

## Spacing

4px base unit: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

- Page gutter: `clamp(16px, 2.5vw, 36px)`.
- Card padding: 20–24px desktop, 16px mobile.
- Dense row: 48–56px.
- Standard control: 44px minimum; desktop toolbar icon controls may render at 40px only when surrounding spacing preserves the WCAG target area.
- Mobile tap targets: 44px minimum.

## Radius

- XS: 8px.
- SM: 12px.
- MD: 16px.
- LG: 20px.
- XL: 26px.
- Pill: 999px only for status/tags, never as the default component shape.

## Elevation

- Level 0: border only.
- Level 1: `0 1px 2px rgb(13 23 21 / .03), 0 10px 28px rgb(13 23 21 / .05)`.
- Level 2: `0 18px 54px rgb(13 23 21 / .14)`.
- Dark theme uses stronger black alpha, never colored glow.

## Z-index system

| Layer | Token | Value |
|---|---|---:|
| Page content | normal flow | 0 |
| Sticky top bar | `--fcw-z-header` | 70 |
| Floating UI | `--fcw-z-floating` | 420 |
| Dialogs | `--fcw-z-dialog` | 600 |
| Toast/status | `--fcw-z-toast` | 700 |

No feature invents a private z-index above these layers without updating this document.

## Floating-surface system

Dropdowns, account menus, notifications, row action menus, selectors, and similar transient surfaces share one geometry and behavior.

### Positioning

- Default vertical relationship: 8px below the trigger.
- Account, notification, and row-action menus align their **right edge to the trigger right edge**.
- Company, branch, filter, and select menus align their **left edge to the trigger left edge**.
- Every floating surface stays at least 12px from the viewport edge.
- If there is insufficient room below, the surface flips above the trigger.
- Height clamps to available viewport space and scrolls internally when necessary.
- Floating surfaces use fixed viewport positioning so a transformed table/card/toolbar cannot create an accidental containing block.

### Behavior

- Trigger exposes `aria-expanded` and `aria-haspopup`.
- Escape closes the current surface and returns focus to its trigger.
- Pointer click outside closes it.
- Opening one sibling floating surface closes the previous one.
- Custom selects support Arrow Up/Down, Home, End, Enter/Space, Escape, and Tab.
- Native `<select>` remains the form/state source of truth; the custom selector dispatches its existing `change` event.
- No floating surface may open hundreds of pixels away from its trigger merely because the trigger is near the right viewport edge.

## Component rules

### Buttons

- Primary: solid mineral green, high-contrast text, 44px minimum where touch is expected.
- Secondary: solid raised surface + strong border.
- Tertiary: transparent resting state with explicit hover/focus state.
- Active: `scale(.985)` maximum.
- Disabled: semantic disabled attribute + ~48% opacity + no transform.

### Inputs and selects

- Solid raised surface, one-pixel strong border.
- Focus: primary border plus a 3px focus ring.
- Placeholder remains clearly secondary.
- Select menus use the floating-surface system rather than browser-colored popup chrome when enhanced by JavaScript.

### Cards

- Border + Level 0/1 elevation.
- Interactive cards may lift 2px on fine-pointer hover only.
- No decorative spotlight gradient.
- No nested shadow stacks.

### Tables

- Strongly readable header surface.
- 52px-ish rows.
- Subtle solid hover surface.
- Tabular numeric figures.
- Status never depends on color alone.

### Navigation

- Mineral sidebar is the strongest branded plane.
- Active item uses solid elevated-green selection, a 2px marker, and stronger icon/text contrast.
- Labels remain visible in normal desktop mode.
- Compact mode preserves accessible names and reliable targets.

### Dialogs

- Solid raised surface, Level 2 elevation, 20–26px radius.
- Scrim separates background from foreground.
- Entry/exit follows floating motion philosophy, no bounce.

## Authentication and Three.js

Authentication is the one surface allowed an ambient 3D layer. The visual field itself uses discrete solid point colors and a low-opacity wireframe form, not color gradients.

- Canvas is decorative and `aria-hidden`.
- DPR is clamped.
- Complexity decreases for save-data and lower-memory devices.
- Rendering pauses when hidden and stops when the auth gate unmounts.
- Geometry, materials, renderer, listeners, and observers are disposed during teardown.
- Reduced-motion users receive a static frame.

## Responsive behavior

- 1440+: full navigation and wide information density.
- 1024–1439: slightly tighter gutters, same hierarchy.
- 768–1023: existing responsive navigation rules take over; multi-column content collapses.
- 375–767: drawer/bottom navigation remains source of truth; floating surfaces clamp to 12px viewport margins; tap targets remain >=44px.
- No horizontal page scroll introduced by floating UI.

## Accessibility

- Normal text contrast >=4.5:1.
- Visible `:focus-visible` on all interactive controls.
- Icon-only controls retain accessible names.
- Form errors remain text-based and actionable.
- Reduced motion is honored in CSS and JavaScript.
- Decorative Three.js canvas is ignored by assistive technology.
- Status information includes text, not color alone.
- Route changes keep focus-management behavior already implemented by the application.

## Implementation contract

- `assets/css/formcraft-worldclass.css` is the final visual source of truth and explicitly neutralizes legacy gradient background images.
- `assets/js/header-popover-fixes.js` owns floating geometry and open/close behavior.
- `assets/js/formcraft-worldclass.js` owns presentation decoration, custom select enhancement, and page choreography.
- `assets/js/formcraft-atmosphere.js` owns the isolated Three.js auth atmosphere.
- Business state, Supabase persistence, permissions, localization, ERP workflows, and record logic remain owned by their existing modules.
- Tests must fail if the final visual layer reintroduces a CSS color gradient or removes floating positioning/accessibility contracts.
