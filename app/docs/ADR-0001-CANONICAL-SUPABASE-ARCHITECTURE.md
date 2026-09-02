# ADR-0001: Canonical Supabase Architecture

- Status: Accepted
- Date: 2026-09-02
- Scope: Production Formcraft application

## Context

Formcraft has accumulated legacy backlog items that describe a CodeIgniter 4 application shell while the current production application, documentation, migrations, workflows, and runtime are built around a static JavaScript application on Netlify with Supabase as the backend.

Maintaining both as active architectural targets creates contradictory implementation work, duplicate authentication and authorization paths, and avoidable security risk.

## Decision

The canonical Formcraft architecture is:

- Frontend: semantic HTML/CSS/JavaScript application deployed as a static site
- Hosting: Netlify
- Database: Supabase Postgres
- Authentication: Supabase Auth
- Authorization: server-enforced Supabase RLS plus reviewed RPC/Edge Function boundaries for privileged operations
- File storage: private Supabase Storage buckets with tenant-aware policies
- Realtime: Supabase/Postgres realtime only where conflict-safe
- Audit: durable append-only audit records for security-sensitive and business-critical mutations
- Deployment: main-only, explicitly authorized production release using the repository deployment policy

CodeIgniter is not an active production target. Legacy CodeIgniter-specific backlog items are superseded as implementation instructions. Their useful product requirements, such as secure authentication, throttling, validation, auditing, and real server-side workflows, remain requirements but must be implemented in the canonical Supabase architecture.

## Security boundaries

1. Browser code is untrusted.
2. UI hiding never grants or denies authorization.
3. Every tenant table and private storage path must be protected by server-enforced policy.
4. Service-role credentials and production administration credentials must never enter browser bundles, committed files, or client-readable runtime configuration.
5. Privileged role, ownership, invitation, payroll, accounting, and destructive operations must use server-enforced authorization.
6. Cross-workspace, cross-company, and cross-branch access is denied by default.
7. Security-sensitive mutations require durable audit records with sensitive values redacted.

## Data architecture direction

The versioned `workspace_state` JSONB document is transitional infrastructure, not the final authoritative model for transactional ERP domains.

As modules mature, authoritative records for accounting, inventory, payroll, attendance, sales, purchasing, and other transactional domains must move to relational tables with:

- primary and foreign keys;
- tenant/company/branch ownership;
- database constraints;
- transactional mutations;
- record-level optimistic versions where concurrent editing is possible;
- immutable ledger/audit records where history must not be rewritten;
- idempotency for retryable side effects.

This migration is tracked by architecture issue #61 and the ERP platform prerequisites in #35.

## Reliability direction

Saving must move from debounce-only whole-workspace persistence toward durable, idempotent operations with explicit Saving, Saved, Offline, Failed, and Conflict states. Acknowledged edits must not silently disappear after reconnect, duplicate retry, tab closure, or version conflict. This is tracked by #66.

## Verification direction

Mock-backed browser tests remain useful for fast regression coverage, but production authorization and backend behavior must also be tested against a disposable real Supabase environment. Real-backend E2E becomes a production gate when #62 is complete.

## Consequences

- New CodeIgniter-specific implementation work must not be started.
- Existing CodeIgniter-specific issues should be closed or rewritten as stack-agnostic requirements.
- New backend behavior must use Supabase migrations, RLS, RPCs, Edge Functions, Storage policies, or another explicitly approved server-side Supabase boundary.
- Major transactional modules cannot be declared production-complete while their authoritative data remains only in the monolithic workspace JSON document.
- Architecture, security, and reliability work takes priority over broad visual expansion.

## Related work

- #35 ERP parity program
- #61 multi-workspace switching and record-level concurrency
- #62 real Supabase E2E and deployment gate
- #63 observability and failed-save telemetry
- #64 frontend consolidation
- #65 granular ERP RBAC and invitation lifecycle
- #66 durable save queue and offline recovery
