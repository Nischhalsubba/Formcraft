# Formcraft

Formcraft is a Nepal-first business operations workspace covering ERP-style records, forms, invoicing, attendance, HRMS workflows, and connected Supabase-backed data flows. The application is intentionally delivered as a static web workspace with runtime configuration generated during the build.

## Project layout

The deployable project lives in this `app/` workspace. At repository root, GitHub automation remains in `.github/` and `netlify.toml` is retained only because Netlify reads it before entering the application base directory.

- `assets/` contains the browser runtime, styles, and interface modules.
- `device-bridge/` contains the optional attendance-device bridge and its Python dependencies.
- `docs/` contains architecture, product, deployment, design-system, compliance, and operational notes.
- `scripts/` contains the runtime-configuration and static-site build steps.
- `supabase/` contains database migrations and edge/function support.
- `tests/` contains static audits and browser regression suites.
- `index.html` is the application shell.

## Local verification

Use Node.js 22 from this directory.

```bash
npm run build
```

The build generates runtime configuration, runs the complete verification suite, and creates the deployable `dist/` output. Individual checks are also available through the `test:*` scripts in `package.json`.

The browser regression workflow additionally uses Python 3.12 and Playwright Chromium to exercise authenticated, responsive, HRMS, record-workspace, Nepal compliance, and device-bridge scenarios.

## Configuration

Copy `.env.example` only when local runtime configuration is required. Supabase credentials used by the browser must remain publishable/browser-safe values; production administration credentials belong in deployment or GitHub environment secrets and must never be committed.

The guarded HRMS production workflow requires the Supabase access token and database password from the protected `production` GitHub environment. Its `apply` mode also requires an explicit confirmation phrase before migrations can be pushed.

## Deployment

Netlify builds from this `app/` directory through the repository-level `netlify.toml`. The publish output is `dist/` relative to this workspace. Security and cache headers are defined in that Netlify configuration.

For implementation details, start with `docs/DYNAMIC_ARCHITECTURE.md`, `docs/FORMCRAFT_PRODUCT_DIRECTION.md`, `docs/DESIGN_SYSTEM.md`, and the deployment/compliance documents relevant to the feature being changed.
