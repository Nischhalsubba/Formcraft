import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const css = read('assets/css/layout-integrity.css');
const html = read('index.html');
const responsive = read('assets/css/responsive-system-v2.css');
const recordWorkspace = read('assets/js/erp-suite-record-workspace.js');
const erpUi = read('assets/js/erp-suite-ui.js');

assert.match(recordWorkspace, /data-erp-add-note=/, 'Record workspace must expose the Add update action contract.');
assert.match(erpUi, /class=\"modal-card erp-quick-form\"/, 'Quick ERP popups must remain covered by the modal geometry guard.');
assert.match(erpUi, /modal\.dataset\.surface\s*=\s*['\"]form['\"]/, 'Quick ERP popups must identify themselves as form surfaces.');
assert.match(responsive, /overflow-wrap:\s*anywhere/, 'Responsive prose wrapping contract changed; review the interactive-control override.');

assert.match(css, /\.button[\s\S]*min-width:\s*max-content/, 'Text buttons must preserve their intrinsic label width.');
assert.match(css, /white-space:\s*nowrap/, 'Text action labels must stay on one line.');
assert.match(css, /flex-shrink:\s*0/, 'Text action controls must not be squeezed until labels wrap.');
assert.match(css, /overflow-wrap:\s*normal/, 'Interactive labels must override aggressive prose wrapping.');
assert.match(css, /\.rw-card\s*>\s*header[\s\S]*flex-wrap:\s*wrap/, 'Record card headers must wrap whole controls instead of button labels.');
assert.match(css, /dialog\.modal[\s\S]*overflow-x:\s*hidden/, 'Shared dialogs must never expose a horizontal scrollbar.');
assert.match(css, /\[data-modal-content\][\s\S]*max-width:\s*100%[\s\S]*min-width:\s*0/, 'Dialog content must be constrained to its owning dialog.');
assert.match(css, /:has\(\.erp-quick-form\)[\s\S]*width:\s*min\(680px,\s*calc\(100vw\s*-\s*40px\)\)/, 'Desktop quick ERP popups need explicit viewport-owned geometry.');
assert.match(css, /\.erp-quick-form\.modal-card[\s\S]*width:\s*100%[\s\S]*overflow:\s*hidden/, 'Quick ERP form cards must fill the dialog without creating a second scroll region.');
assert.match(css, /\.modal-actions-trailing[\s\S]*flex-wrap:\s*wrap/, 'Dialog trailing actions must wrap as whole controls when space is constrained.');
assert.match(css, /@media\s*\(max-width:\s*340px\)/, 'Very narrow record headers need an explicit stacking fallback.');

const integrityLink = 'assets/css/layout-integrity.css';
const integrityIndex = html.indexOf(integrityLink);
const hardeningIndex = html.indexOf('assets/css/audit-hardening.css');
assert.ok(integrityIndex !== -1, 'Layout integrity stylesheet must be wired into the app.');
assert.ok(integrityIndex > hardeningIndex, 'Layout integrity guards must load after existing CSS layers.');

console.log('Layout integrity audit passed.');
