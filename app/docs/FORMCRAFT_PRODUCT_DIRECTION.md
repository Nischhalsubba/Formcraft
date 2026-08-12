# Formcraft product direction

## Product pattern

Formcraft uses a bright, object-oriented productivity workspace. The product is organized around projects, tasks, people, calendar events, files, and invoices. Working views prioritize ownership, deadlines, status, relationships, and reliable persistence over decorative analytics.

The primary desktop pattern is:

- Fixed 248px workspace sidebar
- 64px contextual top bar
- Maximum 1440px working canvas
- Lists and tables as the default working surfaces
- Right-side drawers for quick create and edit flows
- Full-page record details for projects and invoices
- Centered dialogs only for confirmations and small actions

The mobile pattern is:

- Four primary bottom-navigation destinations
- A More destination for secondary tools
- A persistent context-aware create action
- Full-screen forms
- Stacked record lists instead of compressed desktop tables

## Visual language

- Bright canvas: `#F7F8FA`
- White working surfaces: `#FFFFFF`
- Secondary surface: `#F1F3F5`
- Graphite text: `#171A1F`
- Supporting text: `#667085`
- Subtle text: `#8A94A3`
- Border: `#E1E5EA`
- Strong border: `#C9D0D8`
- Cobalt primary: `#2563EB`
- Cobalt hover: `#1D4ED8`
- Cobalt selection: `#EFF6FF`
- Inter typography with tabular numerals for money, dates, percentages, and reports
- Borders instead of decorative shadows
- 8px controls, 12px cards, and 16px dialogs

Dark mode remains optional, but light mode is the default even when the operating system uses a dark appearance.

## Dashboard hierarchy

1. Today: overdue and near-term tasks
2. Upcoming: meetings, reviews, and deadlines
3. Active projects: owner, status, progress, and due date
4. Compact operational summary
5. Recent activity and focused quick actions

The dashboard does not begin with oversized KPI cards or decorative charts.

## Form system

- Labels above controls
- Visible required indicators
- 48px input and select controls
- Helpful text only when it clarifies behavior
- Sections grouped by user intent
- One-column mobile forms
- Two-column desktop layouts only for related fields
- Sticky action footer
- Visible validation and saving states
- Destructive actions separated from primary actions
- Date-order validation for project and invoice schedules

## Product scope

Primary modules:

- Dashboard
- Projects
- Tasks
- Calendar
- Team
- Files
- Invoices
- Activity
- Settings

Email and Reports are removed from navigation until they are backed by trustworthy workflows and meaningful data. Existing stored records remain untouched.

## Anti-patterns

- Purple or multicolor gradients
- Glassmorphism and glowing cards
- Oversized rounded containers
- Different accent colors for every module
- Giant hero areas inside the application
- Emoji interface icons
- Excessive pill buttons
- Fake analytics and decorative charts
- Empty metrics presented as the primary experience
- Cards nested repeatedly inside other cards
- Dark mode as the default
- Desktop tables squeezed unchanged onto mobile screens
- Fields that do not affect a real workflow
