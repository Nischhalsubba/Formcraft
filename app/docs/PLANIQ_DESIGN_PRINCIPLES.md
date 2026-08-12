# Formcraft dashboard direction

This document translates the product-design principles observed in the PlanIQ SaaS Project Management Dashboard reference into original Formcraft rules.

Reference: https://www.behance.net/gallery/251693759/PlanIQ-SaaS-Project-Management-Dashboard-UIUX

Formcraft must not copy PlanIQ artwork, screen compositions, logos, proprietary UI assets, or exact component styling. The reference is used to guide hierarchy, density, visual restraint, and task-focused interaction design.

## 1. Product character

Formcraft should feel:

- calm and operational
- compact without feeling cramped
- modern but not decorative
- friendly enough for daily use
- trustworthy around data and workflow state
- focused on the next useful action

The interface should look like a working SaaS product, not a marketplace demo page containing unrelated components.

## 2. Light-first visual system

The default experience is light.

- Use a soft neutral canvas instead of pure white across the whole viewport.
- Use white cards for primary working surfaces.
- Use thin neutral borders instead of large shadows.
- Reserve dark surfaces for one or two high-value utility cards.
- Continue supporting a complete dark theme, but design the light theme first.

Formcraft palette roles remain:

| Token | Value | Role |
|---|---:|---|
| Deep ink | `#264653` | primary text, dark utility cards, structural emphasis |
| Teal | `#2A9D8F` | primary actions, progress, active navigation, success |
| Gold | `#E9C46A` | review states and measured attention |
| Orange | `#F4A261` | warnings and pending items |
| Coral | `#E76F51` | errors, overdue states, destructive actions |

Warm colors are signals, not decoration. Most screens should be neutral with teal emphasis.

## 3. Dashboard hierarchy

Every dashboard page follows this order:

1. Context and greeting or page title
2. One clear primary action
3. Compact KPI cards
4. Primary analytical surface
5. Secondary utility or assistant surface
6. Detailed operational list or table
7. Supporting activity and guidance

A user should understand the page within five seconds:

- Where am I?
- What changed?
- What needs attention?
- What can I do next?

## 4. Compact modular grid

Use a modular grid with consistent card anatomy.

- Desktop content gaps: 12 to 16 pixels
- Card padding: 14 to 18 pixels
- Card radius: 14 to 18 pixels
- Metric cards: compact and number-led
- Main analytics: wide card
- Utility card: narrower companion card
- Tables: full-width operational surfaces

Avoid giant empty cards, oversized page titles, and ornamental spacing. Information density should support work, not punish it.

## 5. Card anatomy

Every analytical card should contain:

- a short category label
- a concise title
- an optional scoped control such as date range or filter
- one primary visual or metric
- optional explanation or comparison

Cards should not contain multiple unrelated goals.

Hover behavior is subtle:

- slight lift of no more than 2 pixels
- border emphasis
- small elevation increase

The layout must not shift when hovering.

## 6. Data visualization

Charts should prioritize comprehension.

- Neutral gray provides context.
- Teal highlights the important series or period.
- Gold, orange, and coral indicate specific states only.
- Legends remain visible and readable.
- Tooltips explain exact values.
- Every chart includes a non-color distinction where multiple series appear.
- Avoid rainbow series, gradients without meaning, and decorative 3D charts.

Use one strong chart per card. A card full of six tiny charts is not insight. It is a spreadsheet having a nervous breakdown.

## 7. Utility contrast card

PlanIQ uses a high-contrast dark card for an immediate action. Formcraft adopts this principle for:

- today’s focus
- an upcoming meeting
- urgent review
- an AI-assisted action
- a high-priority workspace notice

Rules:

- Use deep ink `#264653`.
- Limit it to one dominant card in a dashboard region.
- Use teal or bright green only for the primary action.
- Keep supporting text muted and concise.
- Do not turn every card dark.

## 8. Tables and lists

Operational lists should be calm and scannable.

- Use compact rows with generous click targets.
- Lead with the item name.
- Keep metadata lighter than the main label.
- Use short status chips.
- Show progress with both text and visual indication.
- Put row actions at the end.
- Reveal destructive actions deliberately.
- Provide empty, loading, filtered-empty, error, and permission states.

## 9. Navigation

Navigation should be quiet and predictable.

- Active state uses a soft teal surface and teal text.
- Inactive items use muted text.
- Navigation should not use loud gradients.
- Group related modules with clear labels.
- Keep icons visually consistent.
- The current page must remain obvious without relying only on color.

The existing sidebar remains because Formcraft contains substantially more modules than the PlanIQ reference. Its visual weight is reduced so content remains dominant.

## 10. Typography

- Page title: 25 to 34 pixels
- Card title: 14 to 17 pixels
- Body: 13 to 15 pixels
- Metadata: 10 to 12 pixels
- Numbers may be larger but should not overwhelm labels

Use strong weight differences rather than many font sizes.

## 11. Interaction principles

- Keep the primary action visible but not repeated unnecessarily.
- Prefer contextual actions near the affected content.
- Confirm destructive actions.
- Use optimistic updates only when rollback is possible.
- Preserve filters and view preferences.
- Provide keyboard navigation and visible focus.
- Respect reduced-motion preferences.

## 12. Responsive behavior

Desktop:

- four KPI cards when space permits
- wide primary chart and narrow utility card
- dense tables

Tablet:

- two KPI columns
- analytics cards stack
- toolbar controls may wrap

Mobile:

- single-column cards
- essential actions remain visible
- tables switch to horizontal scroll or responsive rows
- charts simplify labels rather than shrinking into illegibility
- sidebar becomes a drawer

## 13. Anti-patterns

Do not:

- copy PlanIQ screens pixel for pixel
- use every palette color in every card
- make all cards dark
- introduce decorative blobs behind data
- use large gradients as the primary identity
- use emoji as the final icon system
- show metrics without a clear label or time context
- create static examples that look interactive but do nothing
- sacrifice accessibility for visual similarity

## 14. Acceptance criteria

A Formcraft dashboard screen follows this direction when:

- the main task is visually obvious
- primary and secondary information are clearly separated
- color is semantic and restrained
- cards share consistent anatomy
- data visualization is readable without relying only on color
- light theme feels complete rather than secondary
- dark theme preserves hierarchy
- keyboard, focus, empty, loading, error, success, and disabled states are defined
- the result feels inspired by the reference but remains recognizably Formcraft
