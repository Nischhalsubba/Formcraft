import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const html = read('index.html');
const cssFiles = [
  'assets/css/app.css',
  'assets/css/final-ui-fixes.css',
  'assets/css/header-popover-fixes.css',
  'assets/css/dynamic-backend.css',
  'assets/css/formcraft-v2.css',
  'assets/css/formcraft-product-direction.css',
  'assets/css/formcraft-bright-dashboard.css',
  'assets/css/motion.css',
  'assets/css/workspace-enhancements.css'
];
const jsFiles = [
  'assets/js/locale-runtime.js',
  'assets/js/app-core.js',
  'assets/js/app-pages.js',
  'assets/js/app-actions.js',
  'assets/js/app-modules.js',
  'assets/js/final-ui-fixes.js',
  'assets/js/header-popover-fixes.js',
  'assets/js/formcraft-v2-shell.js',
  'assets/js/dynamic-backend.js',
  'assets/js/dynamic-workflows.js',
  'assets/js/auth-onboarding.js',
  'assets/js/formcraft-v2-runtime.js',
  'assets/js/formcraft-product-direction.js',
  'assets/js/formcraft-bright-dashboard.js',
  'assets/js/interaction-fixes.js',
  'assets/js/workspace-enhancements.js',
  'assets/js/motion.js',
  'assets/js/onboarding-tour.js'
];
const css = Object.fromEntries(cssFiles.map(path => [path, read(path)]));
const js = Object.fromEntries(jsFiles.map(path => [path, read(path)]));
const allJs = Object.values(js).join('\n');
const directionCss = css['assets/css/formcraft-product-direction.css'];
const dashboardCss = css['assets/css/formcraft-bright-dashboard.css'];
const motionCss = css['assets/css/motion.css'];
const enhancementCss = css['assets/css/workspace-enhancements.css'];
const backendJs = js['assets/js/dynamic-backend.js'];
const productRuntime = js['assets/js/formcraft-v2-runtime.js'];
const interactionJs = js['assets/js/interaction-fixes.js'];
const enhancementJs = js['assets/js/workspace-enhancements.js'];
const onboardingJs = js['assets/js/onboarding-tour.js'];
const headerJs = js['assets/js/header-popover-fixes.js'];
const motionJs = js['assets/js/motion.js'];

for (const path of cssFiles) assert.ok(html.includes(path), `${path} must load`);
for (const path of jsFiles) assert.ok(html.includes(path), `${path} must load`);
assert.match(html, /@supabase\/supabase-js@2/);
assert.match(html, /gsap@3\.15\.0\/dist\/gsap\.min\.js/);
assert.match(html, /driver\.js@1\.8\.0\/dist\/driver\.css/);
assert.match(html, /driver\.js@1\.8\.0\/dist\/driver\.js\.iife\.js/);
assert.match(html, /__FORMCRAFT_INITIAL_ROUTE__/);
assert.ok(html.indexOf('assets/js/workspace-enhancements.js') > html.indexOf('assets/js/interaction-fixes.js'), 'workspace enhancements must load after interaction fixes');
assert.ok(html.indexOf('assets/js/motion.js') > html.indexOf('assets/js/workspace-enhancements.js'), 'motion runtime must wrap the enhanced application');
assert.ok(html.indexOf('assets/js/onboarding-tour.js') > html.indexOf('assets/js/motion.js'), 'onboarding must load after application and motion runtimes');
assert.match(html, /data-backend="loading"/);
assert.match(html, /theme-color" content="#F7F8FA"/);
assert.doesNotMatch(html, /maven-system|formcraft-components/);

assert.match(directionCss, /--canvas: #f7f8fa/);
assert.match(directionCss, /--surface: #ffffff/);
assert.match(directionCss, /--ink: #171a1f/);
assert.match(directionCss, /--primary: #2563eb/);
assert.match(directionCss, /--primary-hover: #1d4ed8/);
assert.match(directionCss, /--primary-soft: #eff6ff/);
assert.match(directionCss, /min-height: 48px/);
assert.match(directionCss, /\.form-modal/);
assert.match(directionCss, /\.bright-bottom-nav/);
assert.match(directionCss, /dialog\.modal:has\(\.full-detail-view\)/);
assert.match(directionCss, /@media \(max-width: 760px\)/);
assert.match(directionCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.doesNotMatch(directionCss, /linear-gradient|radial-gradient|glassmorphism|#7c3aed|#8b5cf6/i);

assert.match(dashboardCss, /\.product-today-grid/);
assert.match(dashboardCss, /\.product-summary-strip/);
assert.match(dashboardCss, /\.product-dashboard-bottom/);
assert.match(dashboardCss, /\.product-project-table/);

assert.match(motionCss, /\.calendar-day\s*\{[\s\S]*position: relative/);
assert.match(motionCss, /\.calendar-date-button\s*\{[\s\S]*position: absolute/);
assert.match(motionCss, /inset: 0/);
assert.match(motionCss, /\.calendar-event,[\s\S]*\.calendar-more[\s\S]*z-index: 2/);
assert.match(motionCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(motionJs, /window\.gsap/);
assert.match(motionJs, /prefers-reduced-motion: reduce/);
assert.match(motionJs, /openModalWithMotion/);
assert.match(motionJs, /animateDrawerIn/);
assert.match(motionJs, /animateCalendar/);
assert.match(motionJs, /FormcraftMotion/);

assert.match(enhancementCss, /data-route="email"/);
assert.match(enhancementCss, /data-route="reports"/);
assert.match(enhancementCss, /display: flex !important/);
assert.match(enhancementCss, /formcraft-tour-popover/);
assert.match(enhancementCss, /onboarding-feature-grid/);
assert.match(enhancementJs, /primaryRoutes = \['dashboard', 'projects', 'tasks', 'calendar', 'team'\]/);
assert.match(enhancementJs, /secondaryRoutes = \['reports', 'email', 'files', 'invoices', 'activity', 'settings'\]/);
assert.match(enhancementJs, /restoreSourceNavigation/);
assert.match(enhancementJs, /startProductTour/);
assert.match(enhancementJs, /openComposeForm/);
assert.match(enhancementJs, /FormcraftFeatures/);
assert.match(enhancementJs, /missingDesktop/);
assert.match(enhancementJs, /missingMobile/);

assert.match(onboardingJs, /TOUR_VERSION/);
assert.match(onboardingJs, /window\.driver\?\.js\?\.driver/);
assert.match(onboardingJs, /showProgress: true/);
assert.match(onboardingJs, /skipMissingElement: true/);
assert.match(onboardingJs, /waitForElement: 1600/);
assert.match(onboardingJs, /navigator\.webdriver/);
assert.match(onboardingJs, /prefers-reduced-motion: reduce/);
assert.match(onboardingJs, /localStorage\.setItem/);
assert.match(onboardingJs, /FormcraftOnboarding/);
assert.match(onboardingJs, /data-complete-product-tour/);
assert.match(onboardingJs, /data-dismiss-product-tour/);

assert.match(productRuntime, /persistDynamicWorkspace/);
assert.match(productRuntime, /FormcraftBackend\?\.flush/);
assert.match(productRuntime, /Automatic from tasks/);
assert.match(productRuntime, /createStarterWorkspace/);

assert.match(backendJs, /createClient/);
assert.match(backendJs, /signInWithPassword/);
assert.match(backendJs, /create_workspace/);
assert.match(backendJs, /update_workspace_state/);
assert.match(backendJs, /postgres_changes/);
assert.match(backendJs, /formcraft-files/);
assert.match(backendJs, /invite-member/);
assert.match(backendJs, /reloadWorkspaceState/);
assert.doesNotMatch(backendJs, /sb_publishable_[a-zA-Z0-9_-]{20,}/);
assert.doesNotMatch(backendJs, /https:\/\/[a-z0-9]+\.supabase\.co/);

assert.match(headerJs, /positionAccountPopover/);
assert.match(headerJs, /document\.body\.append\(account\)/);
assert.match(interactionJs, /openWorkspaceSearchResult/);
assert.match(interactionJs, /stopImmediatePropagation/);
assert.match(interactionJs, /openProjectDetail/);
assert.match(interactionJs, /openInvoiceDetail/);
assert.match(interactionJs, /ui\.selectedEmail = message\.id/);
assert.doesNotMatch(interactionJs, /deferredRoutes|removeDeferredSearchResults/);

assert.match(allJs, /validateForm/);
assert.match(allJs, /confirmAction/);
assert.match(allJs, /aria-label=/);
assert.doesNotMatch(allJs, /window\.prompt|window\.confirm/);
assert.doesNotMatch(js['assets/js/app-core.js'], /function seedState/);
assert.doesNotMatch(js['assets/js/app-core.js'], /localStorage\.setItem/);
assert.doesNotMatch(js['assets/js/dynamic-workflows.js'], /seedState/);

for (const [path, source] of Object.entries(css)) {
  const open = (source.match(/{/g) || []).length;
  const close = (source.match(/}/g) || []).length;
  assert.equal(open, close, `${path} CSS braces must balance`);
}

console.log('Static Formcraft navigation, onboarding, backend, motion, calendar, and interaction checks passed.');