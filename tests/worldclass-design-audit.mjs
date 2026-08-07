import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('index.html');
const css = read('assets/css/formcraft-worldclass.css');
const shellStability = read('assets/css/worldclass-shell-stability.css');
const runtime = read('assets/js/formcraft-worldclass.js');
const floating = read('assets/js/header-popover-fixes.js');
const atmosphere = read('assets/js/formcraft-atmosphere.js');
const authOnboarding = read('assets/js/auth-onboarding.js');
const master = read('MASTER.md');

assert(index.includes('assets/css/formcraft-worldclass.css'), 'worldclass stylesheet must be loaded');
assert(index.indexOf('assets/css/formcraft-worldclass.css') > index.indexOf('assets/css/nepal-attendance-compliance.css'), 'worldclass stylesheet must load after feature styles');
assert(index.includes('assets/css/worldclass-shell-stability.css'), 'shell stability stylesheet must be loaded');
assert(index.indexOf('assets/css/worldclass-shell-stability.css') > index.indexOf('assets/css/formcraft-worldclass.css'), 'shell stability stylesheet must load after the worldclass layer');
assert(index.includes('assets/js/formcraft-worldclass.js'), 'worldclass runtime must be loaded');
assert(index.includes('type="module" src="assets/js/formcraft-atmosphere.js"'), 'Three.js atmosphere must load as a module');

assert(css.includes('@media (prefers-reduced-motion:reduce)'), 'CSS must include a reduced-motion mode');
assert(css.includes(':focus-visible'), 'visible keyboard focus styling must exist');
assert(css.includes('min-height:44px'), 'interactive controls must preserve 44px touch targets');
assert(css.includes('html[data-theme="dark"]'), 'dark theme tokens must exist');
assert(css.includes('@media (max-width:760px)'), 'mobile responsive rules must exist');
assert(css.includes('.fc4-nav-item.is-active'), 'active navigation state must be explicit');
assert(css.includes('.backend-gate'), 'authentication surface must be intentionally designed');
assert(css.includes('.fc-floating-panel'), 'floating surfaces must share the final design layer');
assert(css.includes('.fc-context-select-trigger'), 'custom select trigger must be styled by the final design layer');
assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient/i, 'final design layer must not contain color gradients');
assert.match(master, /All color gradients are forbidden/);
assert.match(master, /Floating-surface system/);

assert(shellStability.includes('grid-template-columns: minmax(170px, 240px) minmax(260px, 1fr) max-content'), 'wide topbar must reserve a non-shrinking actions column');
assert(shellStability.includes('width: min(100%, 560px)'), 'desktop search must be capped instead of consuming the full control bar');
assert(shellStability.includes('min-width: max-content'), 'topbar business controls must not collapse below their content width');
assert(shellStability.includes('grid-template-areas:'), 'narrow desktop must use the deliberate two-level topbar layout');
assert(shellStability.includes('min-width: 164px'), 'company selector must retain a readable desktop width');
assert(shellStability.includes('html[data-backend="auth"] .backend-gate'), 'auth first-paint geometry must not depend on a later runtime body class');
assert(shellStability.includes('grid-column: 2'), 'auth card must occupy its final column before presentation decoration mounts');
assert.doesNotMatch(shellStability, /(?:linear|radial|conic)-gradient/i, 'shell stability layer must remain gradient-free');

assert(runtime.includes("matchMedia('(prefers-reduced-motion: reduce)')"), 'GSAP runtime must respect reduced motion');
assert(runtime.includes("ease: 'power3.out'"), 'page choreography must use the approved easing');
assert(runtime.includes('duration: 0.42'), 'page choreography must stay within the motion budget');
assert(runtime.includes('MutationObserver'), 'presentation runtime must survive dynamic shell rendering');
assert(runtime.includes("document.querySelectorAll('select:not([multiple])')"), 'select controls must receive unified enhancement');
assert(runtime.includes("aria-haspopup', 'listbox'"), 'custom selects must expose listbox semantics');
assert(runtime.includes("select.dispatchEvent(new Event('change', { bubbles: true }))"), 'custom selects must preserve existing change handlers');
assert(runtime.includes("event.key === 'ArrowDown'"), 'custom selects must support keyboard navigation');
assert.doesNotMatch(runtime, /pointerSpotlight|fcw-pointer/i, 'gradient pointer spotlight must not return');

assert(authOnboarding.includes('Keep the sign-in surface stable while installation state is checked'), 'auth onboarding must not speculatively switch modes before owner state resolves');
assert.doesNotMatch(authOnboarding, /if \(!clickMode\('signup'\)\)/, 'auth onboarding must not jump to signup before checking installation state');
assert.doesNotMatch(authOnboarding, /setTimeout\(\(\) => clickMode\('signin'\)/, 'existing owners must not see a signup-to-signin flash');

assert(floating.includes('triggerRect.right - desiredWidth'), 'end-aligned floating panels must stay anchored to the trigger edge');
assert(floating.includes("align: 'end'"), 'account and row menus must use end alignment');
assert(floating.includes("align: 'start'"), 'selector menus must support start alignment');
assert(floating.includes('VIEWPORT_MARGIN = 12'), 'floating surfaces must clamp to the viewport margin');
assert(floating.includes('placeAbove'), 'floating surfaces must flip above when needed');
assert(floating.includes('duration: 0.18'), 'floating entry must use the approved motion budget');
assert(floating.includes('duration: 0.11'), 'floating exit must be faster than entry');
assert(floating.includes("event.key !== 'Escape'"), 'floating surfaces must support Escape dismissal');
assert(floating.includes('FormcraftFloatingUI'), 'floating positioning must be exposed as a shared runtime');

assert(atmosphere.includes("aria-hidden', 'true'"), 'decorative canvas must be hidden from assistive technology');
assert(atmosphere.includes('Math.min(window.devicePixelRatio'), 'Three.js pixel ratio must be clamped');
assert(atmosphere.includes('navigator.connection?.saveData'), 'Three.js must adapt for save-data users');
assert(atmosphere.includes('navigator.deviceMemory'), 'Three.js must adapt for lower-memory devices');
assert(atmosphere.includes('pointGeometry.dispose()'), 'Three.js geometry must be disposed');
assert(atmosphere.includes('renderer.dispose()'), 'Three.js renderer must be disposed');
assert(atmosphere.includes("document.addEventListener('visibilitychange'"), 'ambient rendering must pause while hidden');
assert.doesNotMatch(atmosphere, /\.lerp\(/, 'Three.js atmosphere must use discrete palette colors rather than interpolated color fields');

console.log('Worldclass 2026.2 design, shell stability, floating UI, accessibility, motion, and Three.js audit passed.');
