import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const js = fs.readFileSync(path.join(root, 'assets/js/erp-suite-record-workspace.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/erp-suite-record-workspace.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

assert.match(js, /FORMCRAFT-RECORD-WORKSPACE-5\.0/, 'Record workspace must expose a versioned runtime contract');
assert.match(js, /function renderView\(/, 'Record viewing must use a dedicated full-page renderer');
assert.match(js, /function renderEditor\(/, 'Record editing must use a dedicated full-page renderer');
assert.match(js, /data-record-workspace-editor/, 'The editor must expose a stable page-level selector');
assert.match(js, /data-rw-form/, 'The full-page editor must expose a stable form selector');
assert.match(js, /recordMode.*edit/, 'Edit mode must be represented in route state');
assert.match(js, /history\[replace \? 'replaceState' : 'pushState'\]/, 'Record mode changes must support browser history');
assert.match(js, /savePageDraft/, 'Page editing must persist local drafts');
assert.match(js, /beforeunload/, 'Page drafts must be preserved before the document unloads');
assert.match(js, /closeModalWithAutomaticDraft/, 'Modal closing must automatically preserve dirty values');
assert.match(js, /form\.dataset\.formCommitting = 'draft-close'/, 'ERP modal drafts must bypass the old discard confirmation after saving');
assert.match(js, /enhanceGenericModal/, 'Non-ERP modal forms must also receive draft recovery');
assert.match(js, /\.fc3-desktop-sidebar-toggle/, 'The redundant desktop hamburger must be explicitly managed');
assert.match(js, /button\.hidden = true/, 'The redundant desktop hamburger must be removed from the accessibility tree');
assert.match(css, /\.fc3-desktop-sidebar-toggle\s*\{[^}]*display:\s*none\s*!important/s, 'The redundant desktop hamburger must not remain visible');
assert.match(css, /\.rw-view-layout/, 'The viewing experience must have its own layout system');
assert.match(css, /\.rw-editor-layout/, 'The editing experience must have its own layout system');
assert.match(css, /@media \(max-width: 560px\)/, 'The record workspace must support compact phones');
assert.match(css, /@media print/, 'The record view must remain printable');
assert.match(index, /assets\/css\/erp-suite-record-workspace\.css/, 'The record workspace stylesheet must load');
assert.match(index, /assets\/js\/erp-suite-record-workspace\.js/, 'The record workspace runtime must load');
assert.match(pkg, /record-workspace-audit\.mjs/, 'The record workspace audit must run in the standard test suite');

console.log('Record workspace contracts passed for the single desktop sidebar control, full-page viewing/editing, automatic modal draft recovery, route history, mobile layout and print behavior.');
