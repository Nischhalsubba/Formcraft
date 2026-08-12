# Formcraft Dynamic Architecture

## Objective

Formcraft must contain no demo records, fake metrics, decorative controls, or browser-only business data in production. Every operational value is loaded from an authenticated workspace and every mutation is persisted to the backend.

The visual design system remains code-based, as all interfaces require stable layout and styling rules. “Zero static” refers to product data and behavior, not to eliminating CSS, labels, icons, or component definitions.

## Runtime architecture

- **Frontend:** Existing semantic HTML/CSS/JavaScript application on Netlify
- **Database:** Supabase Postgres
- **Authentication:** Supabase Auth with email/password and password recovery
- **Workspace tenancy:** `workspaces` and `workspace_members`
- **Application state:** versioned `workspace_state` JSONB document for immediate full feature parity
- **Files:** Supabase Storage private bucket
- **Realtime:** Postgres changes on `workspace_state`
- **Invitations:** `workspace_invitations` plus authenticated Edge Function
- **Audit:** append-only `activity_log`
- **Security:** Row-Level Security on every tenant table and Storage policy

## Source-of-truth rules

1. Supabase is the only source of business data.
2. `localStorage` may hold only non-sensitive transient UI preferences during startup.
3. No sample projects, tasks, members, messages, files, events, invoices, or activity are created automatically.
4. A new workspace begins empty and displays intentional empty states.
5. Dashboard metrics and reports are calculated from the authenticated workspace state.
6. File bytes are stored in the private Storage bucket, not IndexedDB.
7. Every save uses optimistic concurrency through the state version.
8. Realtime updates refresh other open sessions in the same workspace.
9. Every workspace query is protected by RLS membership checks.
10. Service-role credentials never enter the browser or repository.

## Environment variables

Netlify must provide:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

The build creates `assets/js/runtime-config.js`; that generated file is ignored by Git.

## Definition of done

- Signing out removes access to workspace data.
- Signing in on another browser loads the same workspace.
- All CRUD changes survive browser and device changes.
- A second session receives realtime updates.
- File bytes can be downloaded from another device.
- Deleting a file removes its Storage object.
- No demo records appear in a new workspace.
- No control is present without a working outcome.
- Network, permission, conflict, empty, loading, and error states are visible.
- Automated tests exercise authenticated data flows.
