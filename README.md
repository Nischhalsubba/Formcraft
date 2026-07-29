# Formcraft

Formcraft is a functional admin dashboard for managing projects, tasks, team members, reports, activity, and workspace settings.

> A focused operating system for product work.

## Current implementation

The current branch contains an original, responsive admin application with browser-persisted data. It is intentionally independent from the purchased Greeva source while the public redistribution terms for that package are being confirmed.

### Working features

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
- Keyboard search shortcut and accessible focus behavior

Data currently persists in `localStorage`, making the prototype immediately usable without a server. The next backend milestone will move the same domain model into CodeIgniter 4 with SQLite, authenticated sessions, migrations, validation, and role-aware authorization.

## Planned backend architecture

- CodeIgniter 4
- SQLite for local development, with MySQL-compatible models
- Session authentication and password hashing
- Project, task, user, activity, and setting models
- Database migrations and seed data
- Server-side validation and CSRF protection
- Role-based workspace access
- JSON endpoints for dashboard charts and reports

## Development

Open `index.html` directly, or serve the repository with any static file server.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Branches

- `main`: stable reviewed work
- `feat/functional-admin-dashboard`: active functional dashboard implementation

## Authorship

Product design and development by **Nischhal Raj Subba**.

Any third-party code or assets introduced later will retain the attribution and licensing required by their respective owners.
