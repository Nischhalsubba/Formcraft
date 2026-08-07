# Formcraft Design System — Worldclass 2026

## Product thesis

Formcraft is a Nepal-first business operating workspace. Its interface should feel like a calm, high-trust control room: precise enough for finance and operations, warm enough for people and project work, and distinctive without turning dense business software into decoration.

## Visual thesis

**Quiet authority + Nepal warmth + operational clarity.**

- A dark mineral-green navigation spine creates orientation and product identity.
- The workspace uses warm stone neutrals rather than clinical blue-gray.
- Terracotta is a scarce accent for emphasis, not a second primary color.
- Teal-green is the functional primary color for actions, focus, and selection.
- Surfaces are mostly solid. Glass/blur is reserved for the top bar, modal backdrop, and authentication presentation.
- Borders carry hierarchy before shadows. Shadows are shallow and used only where elevation is meaningful.
- Typography is Manrope for display hierarchy and Inter for interface/body text. Both already ship with the project.
- The layout is information-dense but never cramped. Whitespace groups related decisions rather than merely making pages look sparse.
- Module-specific accent colors may remain, but they sit inside this shared neutral system.

### Forbidden visual patterns

- No rainbow gradients across product surfaces.
- No glowing neon borders around routine cards.
- No glassmorphism on data tables, forms, or dense records.
- No decorative illustration that competes with business content.
- No emoji as interface iconography.
- No hidden focus rings.

## Interaction thesis

**Premium corporate motion: decisive, calm, reversible.**

Motion exists to explain state and hierarchy, not to prove animation exists.

- Quick feedback: 120ms.
- Standard UI transition: 220ms.
- Page/section arrival: 420ms.
- Signature entrance easing: `cubic-bezier(0.2, 0, 0, 1)` / GSAP `power3.out`.
- State movement easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
- Exit easing: `cubic-bezier(0.3, 0, 1, 1)`.
- Routine hover displacement: 1–2px maximum.
- Page entrance displacement: 12px maximum with opacity.
- Stagger: 35ms, capped to the first 10 meaningful siblings.
- No bounce or elastic overshoot in business workflows.
- Ambient animation is allowed only in the authentication presentation and pauses when hidden.
- `prefers-reduced-motion: reduce` removes spatial movement and continuous animation while preserving state clarity.

## Core tokens

### Light theme

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#F2F4F1` | App background |
| `--surface` | `#FCFDFB` | Primary surfaces |
| `--surface-soft` | `#F6F8F5` | Subtle grouped areas |
| `--surface-raised` | `#FFFFFF` | Popovers/dialogs |
| `--ink` | `#0D1715` | Primary text |
| `--muted` | `#58635F` | Secondary text |
| `--muted-2` | `#7A8681` | Tertiary labels |
| `--border` | `#DCE3DF` | Standard borders |
| `--border-strong` | `#C7D1CC` | Strong dividers |
| `--primary` | `#0F6B5F` | Primary actions/selection |
| `--primary-hover` | `#0B5A50` | Primary hover |
| `--primary-soft` | `#E7F3EF` | Selected/soft primary |
| `--accent` | `#C85F35` | Scarce warm accent |
| `--accent-soft` | `#FCECE4` | Accent background |
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
| `--ink` | `#F1F5F2` |
| `--muted` | `#A6B1AC` |
| `--muted-2` | `#7F8C87` |
| `--border` | `#27332F` |
| `--border-strong` | `#364740` |
| `--primary` | `#72D4BF` |
| `--primary-hover` | `#96E3D2` |
| `--primary-soft` | `#173A33` |
| `--accent` | `#F09A72` |
| `--accent-soft` | `#422A20` |

## Typography

- Display: `Manrope`, 650–800 weight.
- UI/body: `Inter`, 400–700 weight.
- Tabular figures: `font-variant-numeric: tabular-nums`.
- Page title: `clamp(1.75rem, 2.4vw, 2.65rem)`, line-height 1.06.
- Section title: 1.0–1.25rem, line-height 1.25.
- Body: 0.875rem, line-height 1.55.
- Labels: 0.75rem, 650 weight.
- Eyebrow/navigation section: 0.6875rem, uppercase, `0.09em` tracking.

## Spacing

4px base unit.

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

- Page gutter: `clamp(16px, 2.5vw, 36px)`.
- Card padding: 20–24px desktop, 16px mobile.
- Dense row height: 48–56px.
- Standard control height: 44px minimum; primary forms use 48px.

## Radius

- `--fcw-radius-xs: 8px`
- `--fcw-radius-sm: 12px`
- `--fcw-radius-md: 16px`
- `--fcw-radius-lg: 20px`
- `--fcw-radius-xl: 26px`
- Pill: `999px`

## Elevation

- Level 0: border only.
- Level 1: `0 1px 2px rgb(13 23 21 / .03), 0 10px 30px rgb(13 23 21 / .045)`.
- Level 2: `0 18px 56px rgb(13 23 21 / .11)`.
- Dark theme uses stronger black alpha, never glow.

## Component rules

### Buttons

- Primary: mineral green fill, white text, 44px minimum height.
- Secondary: solid surface, strong border.
- Tertiary/text: no persistent container, but visible hover/focus target.
- Active state compresses to `scale(.985)` only.
- Disabled state uses opacity plus `cursor: not-allowed`; it must remain recognizable.

### Inputs

- 48px default height for auth/forms, 44px dense filters.
- Solid surface, one-pixel border, no inset shadows.
- Focus uses primary border plus a 3px translucent ring.
- Placeholder contrast remains clearly secondary.

### Cards

- Default cards use border + Level 0/1 elevation.
- Only interactive cards lift on hover, maximum `translateY(-2px)`.
- Cards do not nest shadows inside shadows.
- Pointer spotlight is an optional low-opacity highlight and must not reduce contrast.

### Tables

- Sticky or visually distinct headers where existing flow supports it.
- 52px-ish rows with subtle row hover.
- Numeric values use tabular figures.
- Status must never be communicated by color alone.

### Navigation

- Sidebar is the strongest branded surface.
- Active destination gets a luminous-but-flat soft fill, a 2px inset marker, and stronger text/icon contrast.
- Section labels are quiet; labels, not icon guessing, carry navigation meaning.
- Compact mode preserves 44px targets and tooltips/accessible names.

### Dialogs

- Elevated solid surface, 20–26px radius.
- Backdrop uses dimming + restrained blur.
- Entry: 220ms, 8px vertical shift, no bounce.
- Destructive actions remain visually distinct from primary actions.

## Authentication presentation

Desktop authentication becomes a two-column presentation:

1. Brand story / product promise.
2. Existing authentication card and flows unchanged.

A low-cost Three.js atmospheric field may sit behind this area only. It uses point geometry plus a wireframe form, clamps device pixel ratio, reduces complexity on low-power/save-data devices, stops when the auth gate unmounts, and renders a static frame for reduced-motion users.

## Responsive behavior

- 1440+: full navigation and maximum content width.
- 1024–1439: full navigation, slightly tighter gutters.
- 768–1023: compact workspace navigation where existing responsive runtime requests it; multi-column dashboard sections collapse intelligently.
- 375–767: drawer/bottom navigation remains the source of truth; cards become full width; summary metrics become 2×2 then 1×4 as needed.
- Touch targets remain at least 44×44 CSS px.

## Accessibility

- Normal text contrast >= 4.5:1.
- Visible `:focus-visible` treatment on every control.
- Icon-only controls require accessible names from existing runtime.
- Reduced motion is respected in both CSS and JavaScript.
- Decorative Three.js canvas is `aria-hidden="true"` and `pointer-events: none`.
- Status information keeps text labels; color is supplementary.

## Implementation notes

- This redesign is an override layer. Domain state, routing, CRUD, Supabase, localization, permissions, and business workflows are not rewritten.
- Existing module accent variables remain compatible.
- `assets/css/formcraft-worldclass.css` is loaded last so it becomes the visual source of truth without destabilizing existing feature code.
- `assets/js/formcraft-worldclass.js` adds presentational decoration, GSAP entrance choreography, and lifecycle-safe pointer polish only.
- `assets/js/formcraft-atmosphere.js` is an ES module that imports Three.js only for the auth/onboarding atmosphere.
