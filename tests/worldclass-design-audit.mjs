import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('index.html');
const css = read('assets/css/formcraft-worldclass.css');
const runtime = read('assets/js/formcraft-worldclass.js');
const atmosphere = read('assets/js/formcraft-atmosphere.js');

assert(index.includes('assets/css/formcraft-worldclass.css'), 'worldclass stylesheet must be loaded');
assert(index.indexOf('assets/css/formcraft-worldclass.css') > index.indexOf('assets/css/nepal-attendance-compliance.css'), 'worldclass stylesheet must load last');
assert(index.includes('assets/js/formcraft-worldclass.js'), 'worldclass runtime must be loaded');
assert(index.includes('type="module" src="assets/js/formcraft-atmosphere.js"'), 'Three.js atmosphere must load as a module');

assert(css.includes('@media (prefers-reduced-motion:reduce)'), 'CSS must include a reduced-motion mode');
assert(css.includes(':focus-visible'), 'visible keyboard focus styling must exist');
assert(css.includes('min-height:44px'), 'interactive controls must preserve 44px touch targets');
assert(css.includes('html[data-theme="dark"]'), 'dark theme tokens must exist');
assert(css.includes('@media (max-width:760px)'), 'mobile responsive rules must exist');
assert(css.includes('.fc4-nav-item.is-active'), 'active navigation state must be explicit');
assert(css.includes('.backend-gate'), 'authentication surface must be intentionally designed');

assert(runtime.includes("matchMedia('(prefers-reduced-motion: reduce)')"), 'GSAP runtime must respect reduced motion');
assert(runtime.includes("ease: 'power3.out'"), 'page choreography must use the approved easing');
assert(runtime.includes("duration: 0.42"), 'page choreography must stay within the motion budget');
assert(runtime.includes('MutationObserver'), 'presentation runtime must survive dynamic shell rendering');
assert(runtime.includes('requestAnimationFrame'), 'pointer polish must be frame-scheduled');

assert(atmosphere.includes("aria-hidden', 'true'"), 'decorative canvas must be hidden from assistive technology');
assert(atmosphere.includes('Math.min(window.devicePixelRatio'), 'Three.js pixel ratio must be clamped');
assert(atmosphere.includes('navigator.connection?.saveData'), 'Three.js must adapt for save-data users');
assert(atmosphere.includes('navigator.deviceMemory'), 'Three.js must adapt for lower-memory devices');
assert(atmosphere.includes('pointGeometry.dispose()'), 'Three.js geometry must be disposed');
assert(atmosphere.includes('renderer.dispose()'), 'Three.js renderer must be disposed');
assert(atmosphere.includes("document.addEventListener('visibilitychange'"), 'ambient rendering must pause while hidden');

console.log('Worldclass design audit passed.');
