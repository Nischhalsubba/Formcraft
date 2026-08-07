import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync(new URL('../assets/css/workspace-enhancements.css', import.meta.url), 'utf8');
const tour = fs.readFileSync(new URL('../assets/js/onboarding-tour.js', import.meta.url), 'utf8');

assert.match(css, /\.driver-active-element\s*\{[\s\S]*outline:\s*3px solid #fff !important/);
assert.match(css, /outline-offset:\s*3px/);
assert.match(css, /box-shadow:[\s\S]*0 0 0 7px var\(--primary\)/);
assert.match(css, /filter:\s*brightness\(1\.16\)/);
assert.match(tour, /progressText:\s*'Step \{\{current\}\} of \{\{total\}\}'/);
assert.match(tour, /title:\s*'Projects'/);
assert.doesNotMatch(tour, /Plan delivery with projects/);

console.log('Product tour focus visibility audit passed.');
