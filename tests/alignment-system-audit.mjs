import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const html = read('index.html');
const css = read('assets/css/formcraft-alignment-system.css');
const tour = read('assets/js/onboarding-tour.js');

assert.match(html, /assets\/css\/formcraft-alignment-system\.css/);
assert.ok(
  html.indexOf('assets/css/formcraft-alignment-system.css') > html.indexOf('assets/css/worldclass-shell-stability.css'),
  'alignment system must load after prior shell geometry layers'
);

assert.match(css, /--fc-align-page-max:\s*1540px/);
assert.match(css, /--fc-align-gutter:/);
assert.match(css, /\.fc3-page-header\.workspace-page-header,[\s\S]*\.fc3-page-surface/);
assert.match(css, /margin-inline:\s*auto\s*!important/);
assert.match(css, /--fc-align-control-h:\s*44px/);
assert.match(css, /dialog\.modal:not\(:has\(\.form-modal\)\)/);
assert.match(css, /@media \(max-width:\s*820px\)/);
assert.match(css, /@media \(max-width:\s*520px\)/);
assert.match(css, /driver-active-element\[data-formcraft-tour-center\]/);
assert.doesNotMatch(css, /linear-gradient|radial-gradient|conic-gradient/i);

assert.match(tour, /TOUR_VERSION = '2026\.08\.07\.4'/);
assert.match(tour, /function ensureTourCenterAnchor\(/);
assert.match(tour, /\.fc3-main\.workspace-main/);
assert.match(tour, /element:\s*'\[data-formcraft-tour-center\]'/);
assert.match(tour, /removeTourCenterAnchor/);
assert.match(tour, /window\.addEventListener\('resize'/);
assert.doesNotMatch(tour, /observe\(document\.body,\s*\{\s*childList:\s*true,\s*subtree:\s*true/);

const open = (css.match(/{/g) || []).length;
const close = (css.match(/}/g) || []).length;
assert.equal(open, close, 'alignment CSS braces must balance');

console.log('Formcraft global alignment system audit passed.');
