# First-owner setup fix

Formcraft now reads the installation owner state from Supabase instead of guessing from browser storage.

- Empty installations force the owner-account creation flow.
- Failed sign-in attempts do not mark the owner as created.
- Successful signup updates the installation state through an Auth trigger.
- Generated credentials remain browser-local and are never committed.
