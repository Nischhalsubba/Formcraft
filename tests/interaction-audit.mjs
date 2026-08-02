import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsDirectory = path.join(root, 'assets', 'js');
const sources = fs.readdirSync(jsDirectory)
  .filter(name => name.endsWith('.js'))
  .sort()
  .map(name => ({ name, content: fs.readFileSync(path.join(jsDirectory, name), 'utf8') }));
const combined = sources.map(source => source.content).join('\n');

const actionAttributes = new Map();
const interactiveMarkup = /<(?:a|button|input|select|form|summary)\b[^>]*?\bdata-([a-z0-9-]+)(?=[\s=>])/gi;
for (const source of sources) {
  let match;
  while ((match = interactiveMarkup.exec(source.content))) {
    const locations = actionAttributes.get(match[1]) || [];
    locations.push(source.name);
    actionAttributes.set(match[1], locations);
  }
}

function camelCase(value) {
  return value.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

const intentionallyNative = new Set(['mode', 'submit-label']);
const missingBindings = [];
for (const [attribute, files] of actionAttributes) {
  if (intentionallyNative.has(attribute)) continue;
  const camel = camelCase(attribute);
  const selectorNeedle = `[data-${attribute}`;
  const datasetPatterns = [
    `.dataset.${camel}`,
    `dataset.${camel}`,
    `dataset['${camel}']`,
    `dataset["${camel}"]`
  ];
  const handled = combined.includes(selectorNeedle)
    || datasetPatterns.some(pattern => combined.includes(pattern));
  if (!handled) missingBindings.push(`${attribute} emitted by ${[...new Set(files)].join(', ')}`);
}

assert.deepEqual(
  missingBindings,
  [],
  `Interactive data attributes without a selector or dataset handler:\n${missingBindings.join('\n')}`
);

const criticalContracts = [
  ['sidebar account trigger', /data-toggle-account/, /togglePopover\('account'\)/],
  ['sidebar account placement', /data-account-popover/, /positionAccountPopover/],
  ['notification trigger', /data-toggle-notifications/, /togglePopover\('notifications'\)/],
  ['primary navigation', /data-route=/, /navigate\(link\.dataset\.route\)/],
  ['restored source navigation', /data-source-route=/, /restoreSourceNavigation/],
  ['mobile navigation', /data-bright-route=/, /navigate\(link\.dataset\.brightRoute\)/],
  ['workspace search', /data-search-focus/, /openWorkspaceSearch/],
  ['workspace search result target', /data-workspace-search-id=/, /openWorkspaceSearchResult/],
  ['project actions', /data-edit-project/, /openProjectForm/],
  ['task actions', /data-edit-task/, /openTaskForm/],
  ['calendar actions', /data-event-id/, /openEventForm/],
  ['email actions', /data-email-folder/, /openComposeForm/],
  ['report actions', /data-report-period/, /renderReports/],
  ['file actions', /data-open-file/, /bindFiles/],
  ['invoice actions', /data-view-invoice/, /openInvoiceDetail/],
  ['settings actions', /data-settings-form/, /bindSettings/],
  ['onboarding trigger', /data-start-product-tour/, /FormcraftOnboarding/],
  ['onboarding completion', /data-complete-product-tour/, /complete\('completed'\)/],
  ['modal close', /data-close-modal/, /closeModal/],
  ['authenticated sign out', /data-dynamic-sign-out/, /signOut/]
];

for (const [label, emitted, handled] of criticalContracts) {
  assert.match(combined, emitted, `${label} must be rendered`);
  assert.match(combined, handled, `${label} must have an implementation`);
}

const headerFix = fs.readFileSync(path.join(jsDirectory, 'header-popover-fixes.js'), 'utf8');
assert.match(headerFix, /document\.body\.append\(account\)/, 'The sidebar account popover must be mounted at document level');
assert.match(headerFix, /positionAccountPopover/, 'The sidebar account popover must use viewport positioning');
assert.match(headerFix, /popover\?\.contains\(event\.target\)/, 'Clicks inside a popover must not close it before its action runs');

const interactionFix = fs.readFileSync(path.join(jsDirectory, 'interaction-fixes.js'), 'utf8');
assert.match(interactionFix, /stopImmediatePropagation/, 'Search result fallback must prevent the old route-only handler');
assert.match(interactionFix, /openProjectDetail/, 'Project search results must open the matched record');
assert.match(interactionFix, /openInvoiceDetail/, 'Invoice search results must open the matched record');
assert.match(interactionFix, /ui\.selectedEmail = message\.id/, 'Email search results must open the matched message');

const featureEnhancement = fs.readFileSync(path.join(jsDirectory, 'workspace-enhancements.js'), 'utf8');
assert.match(featureEnhancement, /secondaryRoutes = \['reports', 'email', 'files', 'invoices', 'activity', 'settings'\]/, 'Every source tool must be represented in navigation');
assert.match(featureEnhancement, /missingDesktop/, 'Desktop navigation completeness must be auditable');
assert.match(featureEnhancement, /missingMobile/, 'Mobile navigation completeness must be auditable');

const onboarding = fs.readFileSync(path.join(jsDirectory, 'onboarding-tour.js'), 'utf8');
assert.match(onboarding, /window\.driver\?\.js\?\.driver/, 'The product tour must use Driver.js when it is available');
assert.match(onboarding, /navigator\.webdriver/, 'Automated browser checks must not be blocked by automatic onboarding');
assert.match(onboarding, /prefers-reduced-motion: reduce/, 'The product tour must respect reduced-motion preferences');

console.log(`Interaction audit passed for ${actionAttributes.size} interactive data attributes.`);