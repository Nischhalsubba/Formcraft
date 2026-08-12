# Maven-inspired Formcraft design system

## Purpose

This document translates the publicly visible design principles from the Maven finance-management case study into an original Formcraft admin-dashboard system.

The implementation does **not** copy Maven branding, product copy, artwork, financial content, or exact screen compositions. The original source does not publicly disclose its Figma tokens, font specification, or exact color values, so Formcraft uses measured and adapted values suitable for a responsive project-operations dashboard.

## Product translation

| Maven finance pattern | Formcraft adaptation |
|---|---|
| Total-balance feature card | Workspace-health feature card |
| Send/request/transfer shortcuts | Project/task/event/invoice quick actions |
| Financial KPI cards | Project-delivery KPI cards |
| Transaction rows | Operational tables and activity rows |
| Virtual-card carousel | Featured project and workspace surfaces |
| Mobile banking tab bar | Mobile Formcraft bottom navigation |
| Mobile action sheets | Responsive create/edit dialogs |
| Spending progress | Delivery and task-completion progress |

## Design principles

1. Lead with the most important operational number.
2. Place actions beside the information they affect.
3. Use large rounded cards to group decisions, not to decorate empty space.
4. Reserve gradients for feature surfaces and primary creation moments.
5. Keep ordinary working surfaces white or neutral.
6. Reveal secondary complexity through menus, dialogs, and details.
7. Use one component language across every module.
8. Maintain semantic status colors and accessible text contrast.
9. Preserve large touch targets and predictable keyboard behavior.
10. Use motion only as quiet interaction feedback.

## Core tokens

### Light

- Canvas: `#F5F6FA`
- Surface: `#FFFFFF`
- Primary text: `#171823`
- Supporting text: `#747681`
- Border: `#E8E9EF`
- Accent start: `#5B8CFF`
- Accent end: `#916CFF`
- Cyan highlight: `#6EE7EF`
- Positive: `#26A86B`
- Negative: `#E16060`
- Pending: `#E2A84F`

### Dark

- Canvas: `#111218`
- Surface: `#191A22`
- Primary text: `#F5F5F8`
- Supporting text: `#A3A4AE`
- Border: `#2B2C36`

## Typography

Formcraft retains **Manrope** because the Maven source does not publicly name its font. Manrope provides the neutral, rounded, numerical character required by the reference while keeping existing application typography stable.

- Hero title: `34–58px`
- Featured value: `46–68px`
- KPI value: `34–44px`
- Panel title: `22px`
- Body: `14–15px`
- Metadata: `10–12px`

## Geometry

- Application header: `30px` radius
- Primary feature cards: `28px` radius
- Working cards: `24px` radius
- Controls: `14px` radius
- Compact internal cards: `16–18px` radius
- Pills: fully rounded
- Minimum interactive target: `42–48px`

## Dashboard composition

1. Soft gradient application header
2. Strong greeting and contextual actions
3. Four delivery KPI cards
4. Workspace-health feature card
5. Contextual quick-action card
6. Analytics and delivery-focus panels
7. Active projects and recent activity

## Mobile behavior

- Fixed blurred bottom navigation
- Central gradient create action
- Dashboard, Projects, Tasks, and More access
- Full navigation remains available through the drawer
- Dialogs become bottom sheets
- Feature and metric cards stack vertically
- Content receives safe bottom padding for navigation

## Components

### Feature card

A high-emphasis gradient card that contains:

- Dominant operational value
- Supporting explanation
- Three compact statistics
- Next-due information
- Contextual action

Only one primary feature card should appear in the first dashboard viewport.

### Quick-action card

A neutral surface containing four common creation actions. Each action uses:

- Rounded icon container
- Short action label
- One-line supporting text
- Clear hover and keyboard states

### KPI cards

- One gradient KPI may lead the group.
- Remaining cards use neutral surfaces.
- Values lead, labels support.
- Decorative charts must represent real data or be omitted.

### Operational surfaces

Projects, tasks, files, members, reports, calendar events, email rows, and invoices share:

- `24px` outer radius
- Subtle border
- Restrained elevation
- Pill statuses
- Larger numerical hierarchy
- Quiet hover feedback

### Dialogs

- Desktop: centered rounded modal
- Mobile: bottom sheet with rounded top corners
- Darkened blurred backdrop
- Persistent close affordance
- Existing validation and focus-management behavior retained

## Accessibility

- WCAG AA body-text contrast target
- 44px-class touch targets
- Semantic navigation and dialogs
- Visible focus rings
- Reduced-motion support
- No color-only status communication
- Bottom navigation uses `aria-current`
- Existing route announcements and form-error relationships remain intact

## Anti-patterns

- Copying Maven product names, financial figures, artwork, or layouts
- Applying gradients to every card
- Decorative fake charts
- Hiding important actions in unrelated settings screens
- Multiple competing accent colors in one component
- Hover movement without reduced-motion handling
- Replacing desktop information density with oversized mobile typography
