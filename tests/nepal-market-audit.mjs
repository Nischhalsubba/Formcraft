import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, script, css] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/js/nepal-market.js', root), 'utf8'),
  readFile(new URL('assets/css/nepal-market.css', root), 'utf8')
]);

const requiredHtml = [
  'nepali-date-converter@3.4.0',
  'assets/css/nepal-market.css',
  'assets/js/nepal-market.js'
];
requiredHtml.forEach(token => assert.ok(html.includes(token), `Missing Nepal market asset: ${token}`));

const requiredScript = [
  "const MARKET_VERSION = 'NP-2083.1'",
  "const NEPAL_TIME_ZONE = 'Asia/Kathmandu'",
  'const DEFAULT_VAT_RATE = 13',
  "state.settings.currency = 'NPR'",
  "'tax-invoice': 'Tax Invoice'",
  "'credit-note': 'Credit Note'",
  "'debit-note': 'Debit Note'",
  'NRB exchange rate to NPR',
  'Issued fiscal documents cannot be deleted',
  'recordRetentionYears: 6',
  'OFFICIAL_HOLIDAYS_2083',
  "name: 'Saturday'",
  'eBillingApproved',
  'VAT Rules: invoice and record requirements',
  'Ministry of Home Affairs public holidays 2083',
  'window.FormcraftNepal'
];
requiredScript.forEach(token => assert.ok(script.includes(token), `Missing Nepal market contract: ${token}`));

assert.ok(css.includes('@media print'), 'Nepal invoice print stylesheet is missing.');
assert.ok(css.includes('A4 portrait'), 'Invoices must print on an A4 layout.');
assert.ok(css.includes('.nepal-calendar-day.is-nepal-weekend'), 'Saturday calendar treatment is missing.');
assert.ok(css.includes('.nepal-copy:not(:first-child)'), 'Tax invoice copy controls are missing.');

console.log('Nepal market invoice, calendar, tax, timezone and retention checks passed.');