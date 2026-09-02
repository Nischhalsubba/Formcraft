# CI expectations

A green change is not established by a successful static build alone. Formcraft uses layered verification so presentation checks cannot accidentally stand in for backend or security confidence.

## Required pull-request checks

### Quality

The Quality workflow runs the repository build and complete static/model verification suite. It must pass for application, test, build, Netlify, or quality-workflow changes.

### Browser regression

The Browser regression workflow builds the verified static site and runs authenticated/responsive browser suites, ERP and record-workspace flows, HRMS, attendance-compliance scenarios, and device-bridge coverage. Browser evidence is uploaded for failed and successful runs.

### Security

The Security workflow provides two independent gates:

- repository hygiene rejects tracked runtime environment files, generated runtime configuration, and committed private-key material;
- CodeQL analyzes the JavaScript/TypeScript source using read-only repository permissions plus the minimum `security-events: write` permission required for analysis results.

GitHub Actions used by these workflows must be pinned to immutable commit SHAs rather than floating major-version tags.

## Backend verification boundary

Current browser suites still include mocked Supabase coverage. Mock-backed tests remain useful for fast UI and workflow regression testing, but they are not sufficient proof of Auth, RLS, Storage, invitations, Realtime, recovery, or concurrency behavior.

Issue #62 tracks the disposable real-Supabase E2E suite. Once that suite is implemented and stable, it becomes a required production-promotion gate.

## Production release gate

Production release is separate from ordinary PR and `main` verification.

- `main` is the only production-eligible branch.
- Ordinary commits and merges do not authorize Netlify production deployment.
- The protected manual release workflow re-runs the production quality gate against the exact current `main` SHA.
- A release marker is created only after that gate succeeds.
- Do not add `[deploy]` markers to feature, security, maintenance, or documentation PR commits.
- Do not manually trigger a second Netlify deployment after the Git-authorized release.

## Architecture authority

`ADR-0001-CANONICAL-SUPABASE-ARCHITECTURE.md` is authoritative when legacy backlog or documentation conflicts with the current backend architecture.
