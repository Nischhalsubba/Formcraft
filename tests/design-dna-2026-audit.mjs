import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const index = read('index.html');
const css = read('assets/css/formcraft-design-dna-2026.css');
const motion = read('assets/js/formcraft-motion-orchestra.js');
const atmosphere = read('assets/js/formcraft-workspace-atmosphere.js');

assert(index.includes('Plus+Jakarta+Sans'), 'Plus Jakarta Sans must be loaded');
assert(index.includes('assets/css/formcraft-design-dna-2026.css'), 'Design DNA stylesheet must be wired');
assert(index.includes('assets/js/formcraft-motion-orchestra.js'), 'GSAP motion orchestration must be wired');
assert(index.includes('assets/js/formcraft-workspace-atmosphere.js'), 'Three.js workspace atmosphere must be wired');

for (const existingAsset of [
  'assets/js/hrms-suite-core.js',
  'assets/js/hrms-suite-ui.js',
  'assets/js/erp-suite-ui.js',
  'assets/js/nepal-attendance-compliance.js',
  'assets/js/motion.js',
  'assets/js/onboarding-tour.js'
]) {
  assert(index.includes(existingAsset), `Existing asset removed from index: ${existingAsset}`);
}

assert(css.includes('--primary: #4f46e5'), 'New indigo primary token missing');
assert(css.includes('--fc-sidebar: #0b1220'), 'Dark navigation spine token missing');
assert(css.includes('font-family: var(--fc-font-sans)'), 'New typography system missing');
assert(css.includes('.hrms-tabs button.is-active'), 'Variant A HRMS tab styling missing');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'CSS reduced-motion fallback missing');
assert(css.includes('min-height: 44px'), '44px interaction target rule missing');

assert(motion.includes('window.gsap'), 'GSAP orchestration must use existing GSAP runtime');
assert(motion.includes('prefers-reduced-motion: reduce'), 'GSAP reduced-motion guard missing');
assert(motion.includes("ease: 'power3.out'"), 'Corporate/premium entrance easing missing');
assert(motion.includes('MutationObserver'), 'Dynamic route/card motion refresh missing');
assert(!motion.includes('setInterval('), 'Motion must not use setInterval loops');

assert(atmosphere.includes('three@0.185.1'), 'Three.js version must stay pinned');
assert(atmosphere.includes('renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))'), 'Three.js DPR cap missing');
assert(atmosphere.includes('prefers-reduced-motion: reduce'), 'Three.js reduced-motion guard missing');
assert(atmosphere.includes('navigator.connection?.saveData'), 'Three.js save-data guard missing');
assert(atmosphere.includes('pointGeometry.dispose()'), 'Three.js geometry cleanup missing');
assert(atmosphere.includes('renderer.dispose()'), 'Three.js renderer cleanup missing');

console.log('Formcraft Design DNA 2026 audit passed');
