import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const html = read('index.html');
const geometry = read('assets/css/formcraft-alignment-system.css');
const tourCss = read('assets/css/formcraft-tour.css');
const tour = read('assets/js/onboarding-tour.js');

assert.match(html, /assets\/css\/formcraft-alignment-system\.css/);
assert.match(html, /assets\/css\/formcraft-tour\.css/);
assert.ok(
  html.indexOf('assets/css/formcraft-tour.css') > html.indexOf('assets/css/formcraft-alignment-system.css'),
  'tour geometry must load after the global alignment system'
);

assert.match(geometry, /Formcraft Geometry System 2026\.3/);
assert.match(geometry, /--fc-align-page-max:\s*1540px/);
assert.match(geometry, /--fc-align-gutter:/);
assert.match(geometry, /--fc-align-control-h:\s*44px/);
assert.match(geometry, /--fc-layer-popover:\s*420/);
assert.match(geometry, /--fc-layer-tour:\s*900/);
assert.match(geometry, /\.fc3-page-header\.workspace-page-header,[\s\S]*\.fc3-page-surface/);
assert.match(geometry, /margin-inline:\s*auto\s*!important/);
assert.match(geometry, /\.fc-floating-panel,[\s\S]*\.fc-context-select-popover/);
assert.match(geometry, /dialog\.modal:not\(:has\(\.form-modal\)\)/);
assert.match(geometry, /@media \(max-width:\s*820px\)/);
assert.match(geometry, /@media \(max-width:\s*520px\)/);
assert.doesNotMatch(geometry, /linear-gradient|radial-gradient|conic-gradient/i);

assert.match(tour, /TOUR_VERSION = '2026\.08\.07\.5'/);
assert.match(tour, /function workspaceRect\(/);
assert.match(tour, /function stageRectForTarget\(/);
assert.match(tour, /function cardPosition\(/);
assert.match(tour, /function placementOrder\(/);
assert.match(tour, /requestAnimationFrame\(layoutStep\)/);
assert.match(tour, /scrollIntoView\(\{ block: 'nearest', inline: 'nearest', behavior: 'auto' \}\)/);
assert.match(tour, /role=\"dialog\" aria-modal=\"true\"/);
assert.doesNotMatch(tour, /Driver\.js|DRIVER_VERSION|window\.driver/);

assert.match(tourCss, /\.fc-tour__stage\[data-targeted=\"true\"\]/);
assert.match(tourCss, /box-shadow:\s*0 0 0 100vmax/);
assert.match(tourCss, /\.fc-tour__card\s*\{[\s\S]*width:\s*min\(360px, calc\(100vw - 28px\)\)/);
assert.match(tourCss, /\.fc-tour__footer\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto/);
assert.match(tourCss, /\.fc-tour__progress-track\s*\{[\s\S]*width:\s*96px/);
assert.match(tourCss, /\.fc-tour__button\s*\{[\s\S]*min-height:\s*40px/);
assert.match(tourCss, /@media \(max-width:\s*820px\)[\s\S]*\.fc-tour__button\s*\{[\s\S]*min-height:\s*44px/);
assert.match(tourCss, /@media \(max-width:\s*390px\)/);
assert.doesNotMatch(tourCss, /linear-gradient|radial-gradient|conic-gradient/i);

for (const [label, source] of [['geometry', geometry], ['tour', tourCss]]) {
  const open = (source.match(/{/g) || []).length;
  const close = (source.match(/}/g) || []).length;
  assert.equal(open, close, `${label} CSS braces must balance`);
}

console.log('Formcraft global alignment and native tour audit passed.');
