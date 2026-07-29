# Formcraft

Formcraft is a full-featured admin dashboard and application workspace with an original design system, responsive layouts, browser-persisted data, and a growing set of operational modules.

> A focused operating system for projects, communication, files, billing, data, and administration.

## Current implementation

The current application is an original Formcraft build. The uploaded Greeva CodeIgniter package is being used as a feature reference, not as public source code or visual branding.

### Core workspace features

- Dashboard metrics and project activity visualization
- Project creation, editing, filtering, progress tracking, and deletion
- Task creation, editing, completion, filtering, and deletion
- Project-linked task data
- Team member overview and invitation flow
- Reports generated from live workspace data
- Workspace activity history
- Workspace and notification settings
- Light and dark themes with persistent preferences
- Global project and task search
- JSON workspace export and demo-data reset
- Responsive desktop, tablet, and mobile navigation

### Operations modules

- Functional month calendar with event create, edit, and delete flows
- Email inbox, sent, drafts, starred, archive, and trash folders
- Email reading, compose, draft, send, star, archive, and trash actions
- File manager with folders, uploads, search, rename, star, nested navigation, and deletion
- Invoice dashboard with totals, search, status filtering, create, edit, view, duplicate, mark-paid, print, and delete actions
- Persistent browser data for events, messages, files, and invoices

## Formcraft visual system

The product uses the following palette:

- `#264653` Ink
- `#2A9D8F` Teal
- `#E9C46A` Gold
- `#F4A261` Orange
- `#E76F51` Coral

The palette is mapped semantically across navigation, actions, status states, notifications, and charts. See [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

## Full feature-parity target

The uploaded package contains 104 top-level views covering applications, authentication, charts, forms, tables, maps, layouts, system pages, icons, and UI components. Every useful feature is included in the Formcraft implementation scope.

See [`docs/FEATURE_PARITY.md`](docs/FEATURE_PARITY.md) for the complete audited feature inventory, delivery phases, and definition of done.

## Persistence and backend direction

The current implementation uses `localStorage`, making the dashboard immediately usable without a server. File uploads currently persist metadata rather than binary file contents.

The production backend target is:

- CodeIgniter 4
- SQLite for local development and MySQL compatibility
- Explicit routes
- Session authentication and password hashing
- Database migrations and seeders
- Server-side validation and CSRF protection
- Role-based authorization
- File-storage abstraction
- Audit logging
- JSON endpoints for widgets, tables, and reports
- PHPUnit coverage for critical behavior

## Development

Open `index.html` directly, or serve the repository with any static file server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Useful direct routes:

```text
#dashboard
#projects
#tasks
#calendar
#email
#files
#invoices
#team
#reports
#activity
#settings
```

## Active branch

```text
agent/full-feature-formcraft
```

## Authorship

Product design and development by **Nischhal Raj Subba**.

Any third-party dependencies introduced later will retain the attribution and licensing required by their respective owners. The commercial source package and proprietary bundled assets will not be redistributed publicly unless their license explicitly permits it.
