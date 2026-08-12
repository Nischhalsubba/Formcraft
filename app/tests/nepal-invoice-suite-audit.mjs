import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, core, ui, settings, css, migration] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/js/nepal-invoice-core.js', root), 'utf8'),
  readFile(new URL('assets/js/nepal-invoice-ui.js', root), 'utf8'),
  readFile(new URL('assets/js/nepal-invoice-settings.js', root), 'utf8'),
  readFile(new URL('assets/css/nepal-invoice-suite.css', root), 'utf8'),
  readFile(new URL('supabase/migrations/20260802174000_nepal_invoice_sequence_and_outbox.sql', root), 'utf8')
]);

[
  'assets/css/nepal-invoice-suite.css',
  'assets/js/nepal-invoice-core.js',
  'assets/js/nepal-invoice-ui.js',
  'assets/js/nepal-invoice-settings.js'
].forEach(asset => assert.ok(html.includes(asset), `Missing asset: ${asset}`));

[
  "const VERSION = 'NP-INVOICE-2.0'",
  'const CBMS_THRESHOLD = 200000000',
  'const ABBREVIATED_LIMIT = 10000',
  "taxCategory: line.taxCategory",
  "invoice.priceMode === 'inclusive'",
  "backend.client.rpc('reserve_invoice_number'",
  "backend.client.rpc('enqueue_invoice_compliance_payload'",
  'submissionReady: false'
].forEach(token => assert.ok(core.includes(token), `Missing core contract: ${token}`));

[
  'Abbreviated Tax Invoice',
  'VAT treatment',
  'Tax inclusive',
  'Choose BS date',
  'www.nrb.org.np/api/forex/v1/rates',
  'Draft saved without consuming a statutory number',
  'Payment ledger'
].forEach(token => assert.ok(ui.includes(token), `Missing UI contract: ${token}`));

assert.ok(settings.includes('Not IRD certification'), 'Compliance disclaimer missing.');
assert.ok(settings.includes('Queue issued documents for CBMS'), 'CBMS outbox control missing.');
assert.ok(css.includes('.np-payment-ledger'), 'Payment ledger styles missing.');
assert.ok(css.includes('@media print'), 'Print treatment missing.');
assert.ok(migration.includes('create table if not exists public.invoice_sequences'), 'Invoice sequence table missing.');
assert.ok(migration.includes('create table if not exists public.invoice_compliance_outbox'), 'Compliance outbox table missing.');
assert.ok(migration.includes('public.has_workspace_role'), 'RPC authorization check missing.');

console.log('Nepal invoice suite contracts passed.');
