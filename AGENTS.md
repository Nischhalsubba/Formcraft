# Formcraft Repository Instructions

## Product intent

Formcraft is an original, authenticated admin workspace for projects, communication, files, billing, reporting, and administration. It must not resemble an off-the-shelf template or depend on fake demo data.

## Current architecture

- Frontend: semantic HTML, CSS, and dependency-light JavaScript
- Hosting: Netlify
- Backend: Supabase Postgres, Auth, Storage, Realtime, and Edge Functions
- State: authenticated versioned workspace state in Postgres
- Security: Row-Level Security and private Storage policies

## Non-negotiable dynamic-data rules

- Never add sample projects, tasks, people, messages, events, files, invoices, metrics, or activity to production startup code.
- Never use localStorage, sessionStorage, or IndexedDB as the source of business data.
- Local browser state may contain only transient interface state such as the selected tab during a session.
- Every visible metric must be calculated from the authenticated workspace.
- Every create, edit, delete, upload, invitation, and setting change must persist remotely.
- New workspaces must begin empty and use intentional empty states.
- Never expose service-role credentials in browser code, generated runtime config, commits, or logs.
- Every tenant table and Storage path must be protected by RLS or an equivalent server-side authorization check.

## Conventions

- Use semantic HTML and accessible labels.
- Use CSS custom properties for design tokens.
- Preserve the current Maven-inspired Formcraft design system.
- Use the shared remote state/repository functions rather than writing directly to browser storage.
- Handle loading, empty, success, error, offline, permission, and conflict states.
- Use optimistic concurrency for workspace updates.
- Keep authenticated identity and workspace content dynamic.
- Preserve third-party licenses and attribution.

## Environment

Netlify requires:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

The generated `assets/js/runtime-config.js` is ignored by Git.

## Commands

```bash
npm run build
npm run test:syntax
npm test
python tests/browser-smoke.py
```

## Verification before merging

1. Run JavaScript syntax checks.
2. Run static architecture checks.
3. Run authenticated Chromium tests at desktop and mobile widths.
4. Verify sign-in, sign-out, first-workspace onboarding, and password recovery.
5. Verify CRUD persistence after refresh and in a second browser session.
6. Verify realtime updates and conflict recovery.
7. Verify private file upload, download, rename, and deletion.
8. Verify owner/admin/editor/viewer restrictions.
9. Check Supabase security and performance advisors after schema changes.
10. Confirm browser console and backend logs contain no errors.

## Do not

- Do not restore `seedState()` or demo records.
- Do not introduce browser-only persistence for business data.
- Do not bypass RLS with client-side role checks alone.
- Do not commit `.env`, API secrets, service-role keys, private files, or generated runtime configuration.
- Do not publish purchased template assets unless their license permits redistribution.
