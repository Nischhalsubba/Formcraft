import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/app.css', import.meta.url), 'utf8');
const fixesCss = fs.readFileSync(new URL('../assets/css/final-ui-fixes.css', import.meta.url), 'utf8');
const headerCss = fs.readFileSync(new URL('../assets/css/header-popover-fixes.css', import.meta.url), 'utf8');
const mavenCss = fs.readFileSync(new URL('../assets/css/maven-system.css', import.meta.url), 'utf8');
const baseScripts = ['app-core.js', 'app-pages.js', 'app-actions.js', 'app-modules.js'];
const js = baseScripts.map(name => fs.readFileSync(new URL(`../assets/js/${name}`, import.meta.url), 'utf8')).join('\n');
const fixesJs = fs.readFileSync(new URL('../assets/js/final-ui-fixes.js', import.meta.url), 'utf8');
const headerJs = fs.readFileSync(new URL('../assets/js/header-popover-fixes.js', import.meta.url), 'utf8');
const mavenJs = fs.readFileSync(new URL('../assets/js/maven-system.js', import.meta.url), 'utf8');

assert.equal((html.match(/rel="stylesheet"/g) || []).length, 5, 'The font and four application stylesheets should load');
assert.match(html, /assets\/css\/app\.css/);
assert.match(html, /assets\/css\/final-ui-fixes\.css/);
assert.match(html, /assets\/css\/header-popover-fixes\.css/);
assert.match(html, /assets\/css\/maven-system\.css/);
for (const name of baseScripts) assert.ok(html.includes(`assets/js/${name}`), `${name} must load`);
assert.match(html, /assets\/js\/final-ui-fixes\.js/);
assert.match(html, /assets\/js\/header-popover-fixes\.js/);
assert.match(html, /assets\/js\/maven-system\.js/);
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

assert.match(fixesJs, /createdAt/);
assert.match(fixesJs, /completedAt/);
assert.match(fixesJs, /inTimestampRange/);
assert.match(fixesJs, /periodTasks/);
assert.match(fixesJs, /openWorkspaceSearch/);
assert.match(fixesJs, /data-workspace-search/);
assert.match(fixesJs, /aria-describedby/);
assert.match(fixesJs, /aria-errormessage/);
assert.match(fixesJs, /window\.addEventListener\('popstate'/);
assert.match(fixesCss, /\.notification-button \{ display: inline-grid; \}/);
assert.match(fixesCss, /\.focus-card/);
assert.match(fixesCss, /background: var\(--surface\)/);

assert.match(headerCss, /\.app-header \{\s*overflow: visible;/);
assert.match(headerCss, /\.dashboard-content \{\s*margin-top: 0;/);
assert.match(headerCss, /\.nav-utilities > \.utility-popover/);
assert.match(headerCss, /\.utility-popover-list > button/);
assert.match(headerJs, /mountHeaderPopovers/);
assert.match(headerJs, /host\.append\(popover\)/);
assert.match(headerJs, /details\.more-menu\[open\]/);
assert.match(headerJs, /aria-expanded/);

assert.match(mavenCss, /--maven-gradient/);
assert.match(mavenCss, /\.maven-overview-grid/);
assert.match(mavenCss, /\.maven-feature-card/);
assert.match(mavenCss, /\.maven-action-grid/);
assert.match(mavenCss, /\.maven-bottom-nav/);
assert.match(mavenCss, /border-radius: 28px 28px 0 0/);
assert.match(mavenCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(mavenJs, /workspaceSnapshot/);
assert.match(mavenJs, /mavenOverviewMarkup/);
assert.match(mavenJs, /bottomNavMarkup/);
assert.match(mavenJs, /data-maven-action/);
assert.match(mavenJs, /openCommandMenu/);
assert.match(mavenJs, /openInvoiceForm/);

for (const source of [css, fixesCss, headerCss, mavenCss]) {
  const open = (source.match(/{/g) || []).length;
  const close = (source.match(/}/g) || []).length;
  assert.equal(open, close, 'CSS braces must balance');
}

console.log('Static Formcraft remediation and Maven design-system checks passed.');
