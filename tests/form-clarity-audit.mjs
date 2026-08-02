import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, script, css] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/js/form-clarity-bs-calendar.js', root), 'utf8'),
  readFile(new URL('assets/css/form-clarity-fixes.css', root), 'utf8')
]);

[
  'assets/css/form-clarity-fixes.css',
  'assets/js/form-clarity-bs-calendar.js'
].forEach(token => assert.ok(html.includes(token), `Missing clarity asset: ${token}`));

[
  'renderBsFirstCalendar',
  "state.settings.dateSystem = 'bs'",
  'np-bs-picker-overlay',
  'data-bs-picker-day',
  'np-line-card-values',
  'np-line-card-tax',
  'Numbering and branch options',
  'Adjustments and withholding',
  "WEEKDAYS_NP = ['आइत'"
].forEach(token => assert.ok(script.includes(token), `Missing BS/form behavior: ${token}`));

[
  '.nepal-line-item-row.np-line-item-card',
  '.np-line-card-values',
  '.np-line-card-tax',
  '.np-bs-date-control',
  '.np-bs-picker-grid',
  '.bs-day-number',
  '.backend-card .backend-link',
  'color: var(--ink)'
].forEach(token => assert.ok(css.includes(token), `Missing clarity style: ${token}`));

assert.ok(html.indexOf('form-clarity-fixes.css') > html.indexOf('nepal-invoice-suite.css'), 'Clarity CSS must load after the invoice suite.');
assert.ok(html.indexOf('form-clarity-bs-calendar.js') > html.indexOf('nepal-invoice-settings.js'), 'BS calendar behavior must load after invoice enhancements.');

console.log('Form alignment, BS-first calendar, real BS picker, and neutral auth-action checks passed.');
