# Formcraft design schema v2

The production and deploy-preview builds now share the same canonical Worldclass 2026.2 baseline.

## Migration behavior

- Legacy workspaces without `settings.uiDesignSchemaVersion >= 2` are migrated once to the Worldclass 2026.2 design tokens.
- The current light/dark/system theme preference is preserved.
- The migration is persisted after the authenticated workspace finishes loading.
- Future design changes made after schema v2 remain user-controlled because the migration marker prevents repeated resets.
- The Interface Studio reset control now returns to the Worldclass baseline rather than the pre-redesign defaults.
- Exact dark/light semantic tokens are reapplied for the canonical baseline so the legacy Theme Studio cannot accidentally override the final design layer with stale derived values.

This avoids using production Supabase credentials in Netlify deploy previews merely to make the UI look consistent.
