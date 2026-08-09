import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const css = read('assets/css/layout-integrity.css');
const html = read('index.html');
const responsive = read('assets/css/responsive-system-v2.css');
const recordWorkspace = read('assets/js/erp-suite-record-workspace.js');

assert.match(recordWorkspace, /data-erp-add-note=/, 'Record workspace must expose the Add update action contract.');
assert.match(responsive, /overflow-wrap:\s*anywhere/, 'Responsive prose wrapping contract changed; review the interactive-control override.');

assert.match(css, /\.button[\s\S]*min-width:\s*max-content/, 'Text buttons must preserve their intrinsic label width.');
assert.match(css, /white-space:\s*nowrap/, 'Text action labels must stay on one line.');
assert.match(css, /flex-shrink:\s*0/, 'Text action controls must not be squeezed until labels wrap.');
assert.match(css, /overflow-wrap:\s*normal/, 'Interactive labels must override aggressive prose wrapping.');
assert.match(css, /\.rw-card\s*>\s*header[\s\S]*flex-wrap:\s*wrap/, 'Record card headers must wrap whole controls instead of button labels.');
assert.match(css, /@media\s*\(max-width:\s*340px\)/, 'Very narrow record headers need an explicit stacking fallback.');

const integrityLink = 'assets/css/layout-integrity.css';
const integrityIndex = html.indexOf(integrityLink);
const hardeningIndex = html.indexOf('assets/css/audit-hardening.css');
assert.ok(integrityIndex !== -1, 'Layout integrity stylesheet must be wired into the app.');
assert.ok(integrityIndex > hardeningIndex, 'Layout integrity guards must load after existing CSS layers.');

console.log('Layout integrity audit passed.');
