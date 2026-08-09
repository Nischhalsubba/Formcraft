import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const scripts = [
  'assets/js/product-depth-core.js',
  'assets/js/product-depth-workflow-bridge.js',
  'assets/js/product-depth-transactions-ui.js',
  'assets/js/product-depth-command-ui.js',
  'assets/js/product-depth-mobile-ui.js',
  'assets/js/product-depth-record-actions.js',
  'assets/js/product-depth-shell-ui.js'
].map(read).join('\n');
const css = [
  'assets/css/product-depth-shell-ui.css',
  'assets/css/product-depth-command-ui.css',
  'assets/css/product-depth-transactions-ui.css',
  'assets/css/product-depth-record-ui.css',
  'assets/css/product-depth-record-actions.css',
  'assets/css/product-depth-compliance-ui.css'
].map(read).join('\n');
const index = read('index.html');

assert(scripts.includes('FORMCRAFT-PRODUCT-DEPTH-1.0'), 'Product depth core marker missing');
assert(scripts.includes('FORMCRAFT-PRODUCT-DEPTH-WORKFLOW-BRIDGE-1.0'), 'Line-aware workflow bridge marker missing');
assert(scripts.includes('FORMCRAFT-PRODUCT-DEPTH-TRANSACTIONS-1.0'), 'Transaction UI marker missing');
assert(scripts.includes('FORMCRAFT-PRODUCT-DEPTH-COMMAND-1.0'), 'Command UI marker missing');
assert(scripts.includes('FORMCRAFT-PRODUCT-DEPTH-MOBILE-1.0'), 'Mobile UI marker missing');
assert(scripts.includes('FORMCRAFT-PRODUCT-DEPTH-RECORD-ACTIONS-1.0'), 'Mobile record actions marker missing');
assert(scripts.includes('FORMCRAFT-PRODUCT-DEPTH-SHELL-1.0'), 'Shell UI marker missing');
for (const asset of [
  'assets/js/product-depth-core.js',
  'assets/js/product-depth-workflow-bridge.js',
  'assets/js/product-depth-transactions-ui.js',
  'assets/js/product-depth-command-ui.js',
  'assets/js/product-depth-mobile-ui.js',
  'assets/js/product-depth-record-actions.js',
  'assets/js/product-depth-shell-ui.js',
  'assets/css/product-depth-shell-ui.css',
  'assets/css/product-depth-command-ui.css',
  'assets/css/product-depth-transactions-ui.css',
  'assets/css/product-depth-record-ui.css',
  'assets/css/product-depth-record-actions.css',
  'assets/css/product-depth-compliance-ui.css'
]) assert(index.includes(asset), `Missing index wiring: ${asset}`);
assert(index.includes('meta name="theme-color" content="#F5F7FB"'), 'Theme color must match the current Design DNA canvas');
assert(scripts.includes('data-pd-line-editor'), 'Multi-line transaction editor missing');
assert(scripts.includes('hydrateInvoice'), 'Line-aware invoice compatibility missing');
assert(scripts.includes('createAdditionalStockMove'), 'Multi-line stock move compatibility missing');
assert(scripts.includes('What needs your attention'), 'Work Inbox missing');
assert(scripts.includes('Quick find'), 'Command palette missing');
assert(scripts.includes('role="listbox"'), 'Command palette listbox semantics missing');
assert(scripts.includes("setAttribute('role', 'tablist')"), 'Mobile record tablist semantics missing');
assert(scripts.includes("setAttribute('aria-expanded'"), 'Disclosure aria-expanded behavior missing');
assert(scripts.includes('pd-record-more'), 'Compact mobile More actions missing');
assert(scripts.includes('Operational setup'), 'Compliance readiness rename missing');
assert(scripts.includes('pd-scope-details'), 'Collapsible scope boundary missing');
assert(scripts.includes('pd-hajiri-filters'), 'Hajiri status filters missing');
assert(scripts.includes('pd-day-total'), 'Hajiri daily totals missing');
assert(scripts.includes('Discard changes'), 'Record editor discard wording missing');
assert(scripts.includes('inputMode'), 'Mobile numeric input modes missing');
assert(scripts.includes('pd-relation-filter'), 'Searchable relation filtering missing');
assert(!scripts.includes('setInterval('), 'Product-depth UI must not use interval animation loops');
assert(!read('assets/js/product-depth-core.js').includes('localStorage'), 'Business-state foundation must not use localStorage');
assert(css.includes('min-height: 44px'), '44px mobile touch-target rule missing');
assert(css.includes('font-size: 16px'), '16px mobile form input rule missing');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'Reduced motion guard missing');
assert(css.includes('body.pd-editing-record .fc3-mobile-bottom-nav'), 'Editing mode must hide mobile bottom navigation');
assert(css.includes('position: sticky'), 'Sticky mobile section navigation / Hajiri headers missing');
assert(css.includes('.pd-tag-chip'), 'Tag chips missing');
assert(css.includes('.pd-operational-checklist'), 'Operational checklist styling missing');
assert(css.includes('.pd-command-card'), 'Command palette styling missing');
assert(css.includes('.pd-line-row'), 'Transaction-line styling missing');
assert(css.includes('.pd-record-more-menu'), 'Mobile record More menu styling missing');
assert(!/transition:[^;]*(width|height|top|left|right|bottom|margin|padding)/.test(css), 'Do not animate layout properties');

console.log('Product depth UI audit passed');
