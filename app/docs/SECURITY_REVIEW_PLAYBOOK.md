# Security review playbook for Formcraft

Formcraft includes ERP-style business records, authentication and Supabase-backed workflows. **A passing browser mock is not proof of production authorization.** This document complements, rather than replaces, the project's existing QA and deployment documents.

## Changes requiring enhanced review

- Authentication, invitations, password recovery, logout or session lifecycle
- Workspace membership, owner/admin/editor/viewer permissions or role transitions
- Tenant-scoped records, accounting, payroll, HRMS and attendance access
- Database migrations, RLS policies, privileged RPC/functions and backend secrets
- Offline saves, conflict resolution, exports, file uploads and webhooks

## Security acceptance matrix

| Boundary | Negative test |
| --- | --- |
| Tenant ownership | A user in workspace A cannot read or mutate workspace B's records |
| Role enforcement | Viewer cannot edit; editor cannot perform owner/admin-only operations |
| Invites | Unaccepted or expired invitations do not silently gain access |
| Privileged functions | Arbitrary caller-supplied user IDs cannot bypass permission checks |
| Concurrency | Failed save/conflict does not overwrite newer remote changes |
| Sensitive exports | HR/payroll and private records do not leak through logs or client bundles |
| Sessions | Signing out invalidates sensitive UI and prevents background writes under the old session |
| Config | Only publishable/browser-safe values reach built assets; service-role credentials remain server-side |

Do not rely only on disabled buttons or hidden navigation to prove server-side authorization. Test permitted and forbidden operations against a disposable or otherwise authorized backend environment.

## Local verification

From \`app/\`, on Node.js 22:

~~~bash
npm run verify
npm run build
~~~

The build generates runtime config, runs verification, and writes \`dist/\`. The project also has Python/Playwright browser suites and separate guarded production operations; review \`app/README.md\` and the matching existing docs before changing them. Mock-backed browser checks must be reported as **mock-backed**, not end-to-end proof of real Supabase RLS or Auth.

## Review and release record

Document the threat or user scenario, roles/workspaces involved, before/after access matrix, negative tests, environment used, audit/log redaction and rollback. Use only synthetic customer, employee and payroll fixtures. Keep keys, tokens and original employee data out of issues, screenshots and PRs.

## Recovery and risk

On an authorization regression, prioritize access restriction, rollback of the narrow code/migration change, and preservation of an audit trail. Database migrations need an independently reviewed reversal/data-preservation plan; this documentation does not authorize running any production migrations.
