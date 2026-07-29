import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/app.css', import.meta.url), 'utf8');
const js = ['app-core.js','app-pages.js','app-actions.js','app-modules.js'].map(name => fs.readFileSync(new URL(`../assets/js/${name}`, import.meta.url), 'utf8')).join('\n');

assert.equal((html.match(/rel="stylesheet"/g) || []).length, 2, 'Only the font and canonical app stylesheet should load');
assert.match(html, /assets\/css\/app\.css/);
for (const name of ['app-core.js','app-pages.js','app-actions.js','app-modules.js']) assert.ok(html.includes(`assets/js/${name}`), `${name} must load`);
assert.doesNotMatch(html, /planiq|flexxeriin|ui-scale-refinement|modules\.css/);
assert.match(css, /@media \(max-width: 700px\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.agenda-list/);
assert.match(css, /\.mobile-card-list/);
assert.match(js, /indexedDB\.open/);
assert.match(js, /systemTheme\.addEventListener/);
assert.match(js, /validateForm/);
assert.match(js, /confirmAction/);
assert.match(js, /aria-label=/);
assert.doesNotMatch(js, /window\.prompt|window\.confirm/);
assert.doesNotMatch(js, /2026-07-29/);
assert.doesNotMatch(js, /⌂|▦|◎|◷|⚙|⌫|✎/);

const cssOpen = (css.match(/{/g) || []).length;
const cssClose = (css.match(/}/g) || []).length;
assert.equal(cssOpen, cssClose, 'CSS braces must balance');

console.log('Static Formcraft remediation checks passed.');
