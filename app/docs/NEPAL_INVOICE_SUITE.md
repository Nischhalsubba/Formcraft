# Nepal Invoice Suite

Formcraft extends its existing Nepal market module with production-oriented invoice controls for Nepal.

## Included

- AD canonical storage with BS entry/display support through `nepali-date-converter`.
- Nepal fiscal-year, branch and series based invoice numbering.
- Atomic server-side number reservation through `reserve_invoice_number`.
- Draft identifiers that do not consume statutory invoice numbers.
- PAN invoices, VAT tax invoices, abbreviated tax invoices, proforma invoices, credit notes and debit notes.
- Line-level taxable, exempt and zero-rated treatment.
- Tax-inclusive and tax-exclusive price calculation.
- Line discounts, invoice-level discounts, other charges and rounding adjustments.
- Foreign currency conversion using the Nepal Rastra Bank rates API.
- Append-only payment and refund ledger.
- Immutable issued documents and adjustment-note workflow.
- Durable CBMS preparation outbox with idempotency keys.

## Database rollout

Apply:

```text
supabase/migrations/20260802174000_nepal_invoice_sequence_and_outbox.sql
```

The migration creates:

- `public.invoice_sequences`
- `public.invoice_compliance_outbox`
- `public.reserve_invoice_number(...)`
- `public.enqueue_invoice_compliance_payload(...)`

Both RPCs verify workspace membership and editor-level permissions.

## CBMS boundary

The app creates a draft compliance payload and can queue it in a durable outbox. It does not claim to submit to IRD. Production submission still requires:

1. The exact current IRD CBMS schema and endpoint.
2. Approved taxpayer credentials.
3. IRD software enlistment or approval applicable to the deployment.
4. A server-side adapter, retries, reconciliation and security review.

Do not enable “Approved CBMS adapter configured” until those requirements are actually complete. A checkbox remains tragically incapable of granting regulatory approval.

## Verification

```bash
npm run test:syntax
npm test
```

The invoice contract test verifies the loaded assets, calculation controls, NRB integration, payment ledger, database sequence and compliance outbox.

## Official references

- IRD CBMS API technical document: https://ird.gov.np/content/9052/cbmsapitechnicaldocumentfor/
- IRD electronic billing notice: https://ird.gov.np/content/13488/cbms-notice-01-04/
- IRD invoice-format notice: https://ird.gov.np/content/13577/public-notice-regarding-format-of-invoice/
- Nepal Rastra Bank foreign-exchange API: https://www.nrb.org.np/api-docs-v1/
- Ministry of Home Affairs public holidays: https://moha.gov.np/en/page/government-and-public-holidays-in-2083
