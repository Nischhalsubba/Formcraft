import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, script, css, docs] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/js/workspace-architecture-v3.js', root), 'utf8'),
  readFile(new URL('assets/css/workspace-architecture-v3.css', root), 'utf8'),
  readFile(new URL('docs/WORKSPACE_ARCHITECTURE_V3.md', root), 'utf8')
]);

for (const asset of [
  'assets/css/workspace-architecture-v3.css',
  'assets/js/workspace-architecture-v3.js'
]) assert.ok(html.includes(asset), `Missing workspace architecture asset: ${asset}`);

assert.ok(
  html.indexOf('assets/js/workspace-architecture-v3.js') > html.indexOf('assets/js/erp-suite-boot.js'),
  'Workspace architecture must load after the ERP boot integration.'
);
assert.ok(
  html.indexOf('assets/js/workspace-architecture-v3.js') < html.indexOf('assets/js/motion.js'),
  'Motion should wrap the final workspace shell.'
);

for (const token of [
  "const VERSION = 'WORKSPACE-ARCH-3.0'",
  'function globalRail',
  'function contextSidebar',
  'function topbar',
  'function pageHeader',
  'function mobileDrawer',
  'function mobileBottomNavigation',
  'renderShell = renderWorkspaceArchitecture',
  'window.FormcraftWorkspaceArchitecture',
  'data-fc3-toggle-sidebar',
  'data-fc3-sign-out',
  'data-erp-company',
  'data-erp-branch',
  'data-bright-more'
]) assert.ok(script.includes(token), `Missing architecture runtime contract: ${token}`);

for (const token of [
  '.fc3-app-rail',
  '.fc3-context-sidebar',
  '.fc3-topbar',
  '.fc3-page-header',
  '.fc3-page-surface',
  '.fc3-mobile-drawer',
  '.fc3-mobile-bottom-nav',
  'body.fc3-sidebar-collapsed',
  '@media (max-width: 820px)',
  '@media print'
]) assert.ok(css.includes(token), `Missing architecture style contract: ${token}`);

for (const statement of [
  'Global application rail',
  'Contextual navigation',
  'Page-level controls',
  'Use a full page for',
  'Use a dialog for',
  'Mobile uses a bottom navigation bar and contextual drawer'
]) assert.ok(docs.includes(statement), `Missing documented architecture principle: ${statement}`);

assert.ok(!`${script}${css}`.includes('odoo.com'), 'Runtime must not embed Odoo assets.');
console.log('Workspace architecture v3 contracts passed for global, contextual, page, record, and mobile navigation.');