# Deployment gate

Netlify must run `npm run build`.

The build performs these steps in order:

1. Generate the runtime Supabase configuration.
2. Check every JavaScript and test file for syntax errors.
3. Run static architecture, interaction, Nepal market, invoice, calendar, operations contract and operations model tests.

GitHub Actions additionally runs the authenticated Chromium test suite. A release must not be merged or deployed while either workflow is failing.

The production site should be smoke-tested after deployment before the release status changes from “ready to test” to “production ready.”
