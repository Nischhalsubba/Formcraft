# Operational bug-prevention rules

- Never merge with failing syntax or browser checks.
- Never use issued invoice totals as mutable payment balances.
- Never allow duplicate project codes or task keys.
- Never allow circular task parent or dependency relationships.
- Never dismiss a multi-section form from an outside click.
- Never present a route-level record as a temporary modal.
- Never let a viewer mutate operational state.
- Never calculate project progress independently in several screens.
- Never derive commercial totals from unlinked invoices.
- Never label a roadmap module as implemented.

These rules are enforced where practical through runtime normalization, permission guards, relationship validation and automated release checks.
