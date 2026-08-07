import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const html = read('index.html');
const css = read('assets/css/formcraft-alignment-system.css');
const tourCss = read('assets/css/workspace-enhancements.css');
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

assert.match(
  tourCss,
  /body\.fc4-simple-shell:has\(\.driver-active-element\[data-formcraft-tour-center\]\)[\s\S]*left:\s*calc\(50vw \+ \(var\(--fc4-sidebar-width\) \/ 2\)\)\s*!important[\s\S]*top:\s*50vh\s*!important[\s\S]*transform:\s*translate\(-50%, -50%\)\s*!important/,
  'desktop intro/final tour cards must be centered inside the workspace, not the viewport'
);
assert.match(
  tourCss,
  /\.formcraft-tour-popover \.driver-popover-footer\s*\{[\s\S]*display:\s*grid\s*!important[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto[\s\S]*padding:\s*14px 20px 16px\s*!important/,
  'tour footer must keep progress and navigation on one shared alignment grid'
);
assert.match(tourCss, /\.driver-popover-prev-btn:disabled\s*\{\s*display:\s*none\s*!important/);
assert.match(
  tourCss,
  /@media \(max-width:\s*820px\)[\s\S]*:has\(\.driver-active-element\[data-formcraft-tour-center\]\)[\s\S]*left:\s*50vw\s*!important/,
  'mobile intro/final cards must center on the mobile viewport because the sidebar is removed'
);

const open = (css.match(/{/g) || []).length;
const close = (css.match(/}/g) || []).length;
assert.equal(open, close, 'alignment CSS braces must balance');

const tourOpen = (tourCss.match(/{/g) || []).length;
const tourClose = (tourCss.match(/}/g) || []).length;
assert.equal(tourOpen, tourClose, 'tour CSS braces must balance');

console.log('Formcraft global alignment system audit passed.');