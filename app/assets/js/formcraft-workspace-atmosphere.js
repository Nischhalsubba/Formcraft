const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const desktopFine = window.matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)');
const saveData = Boolean(navigator.connection?.saveData);
const lowMemory = Number(navigator.deviceMemory || 8) <= 4;
const disabledByDevice = saveData || lowMemory;

let currentHeader = null;
let cleanupCurrent = null;
let importPromise = null;
let scheduled = false;

function allowed(header) {
  return header instanceof HTMLElement
    && document.documentElement.dataset.backend === 'auth'
    && desktopFine.matches
    && !reducedMotion.matches
    && !disabledByDevice;
}

function loadThree() {
  if (!importPromise) {
    importPromise = import(THREE_MODULE_URL).catch(error => {
      importPromise = null;
      throw error;
    });
  }
  return importPromise;
}

function cssColor(variable, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

function createScene(header, THREE) {
  if (!allowed(header) || header.querySelector('.fc-workspace-atmosphere')) return () => {};

  const canvas = document.createElement('canvas');
  canvas.className = 'fc-workspace-atmosphere';
  canvas.setAttribute('aria-hidden', 'true');
  header.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
  } catch {
    canvas.remove();
    return () => {};
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
  camera.position.set(0, 0, 6.4);

  const group = new THREE.Group();
  scene.add(group);

  const primary = new THREE.Color();
  const secondary = new THREE.Color();
  try {
    primary.setStyle(cssColor('--primary', '#4f46e5'));
    secondary.setStyle(cssColor('--info', '#2563eb'));
  } catch {
    primary.setHex(0x4f46e5);
    secondary.setHex(0x2563eb);
  }

  const pointCount = 56;
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);

  for (let index = 0; index < pointCount; index += 1) {
    const offset = index * 3;
    const x = (Math.random() - 0.5) * 8.2;
    const y = (Math.random() - 0.5) * 2.4;
    const z = (Math.random() - 0.5) * 2.0;
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;

    const mix = index / Math.max(pointCount - 1, 1);
    const color = primary.clone().lerp(secondary, mix * 0.7);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }

  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pointGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const pointMaterial = new THREE.PointsMaterial({
    size: 0.045,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.48,
    vertexColors: true,
    depthWrite: false
  });
  const points = new THREE.Points(pointGeometry, pointMaterial);
  group.add(points);

  const linePositions = [];
  for (let index = 0; index < pointCount - 1; index += 3) {
    const a = index * 3;
    const b = (index + 1) * 3;
    linePositions.push(
      positions[a], positions[a + 1], positions[a + 2],
      positions[b], positions[b + 1], positions[b + 2]
    );
  }

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  const lineMaterial = new THREE.LineBasicMaterial({
    color: primary,
    transparent: true,
    opacity: 0.10,
    depthWrite: false
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  group.add(lines);

  let frame = 0;
  let activeUntil = performance.now() + 7000;
  let pointerX = 0;
  let pointerY = 0;
  let currentX = 0;
  let currentY = 0;
  let lastTime = performance.now();
  let paused = document.hidden;

  function resize() {
    const rect = header.getBoundingClientRect();
    const width = Math.max(1, Math.floor(Math.min(rect.width * 0.46, 660)));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function tick(now) {
    frame = 0;
    if (paused || !header.isConnected || now > activeUntil) return;

    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    currentX += (pointerX - currentX) * Math.min(1, delta * 4.2);
    currentY += (pointerY - currentY) * Math.min(1, delta * 4.2);

    group.rotation.y += delta * 0.022;
    group.rotation.z = currentX * 0.018;
    group.rotation.x = currentY * 0.028;
    points.position.x = currentX * 0.08;
    points.position.y = -currentY * 0.05;

    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  }

  function startFor(milliseconds = 1200) {
    activeUntil = Math.max(activeUntil, performance.now() + milliseconds);
    if (!frame && !paused) {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function onPointerMove(event) {
    const rect = header.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
    pointerY = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
    startFor(900);
  }

  function onVisibility() {
    paused = document.hidden;
    if (paused) stop();
    else startFor(900);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(header);
  header.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  resize();
  renderer.render(scene, camera);
  startFor(7000);

  return () => {
    stop();
    resizeObserver.disconnect();
    header.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('visibilitychange', onVisibility);
    pointGeometry.dispose();
    pointMaterial.dispose();
    lineGeometry.dispose();
    lineMaterial.dispose();
    renderer.dispose();
    canvas.remove();
  };
}

async function sync() {
  scheduled = false;
  const header = document.querySelector('.workspace-page-header');

  if (!allowed(header)) {
    cleanupCurrent?.();
    cleanupCurrent = null;
    currentHeader = null;
    return;
  }

  if (cleanupCurrent && currentHeader === header) return;
  cleanupCurrent?.();
  cleanupCurrent = null;
  currentHeader = null;

  try {
    const THREE = await loadThree();
    if (!allowed(header) || document.querySelector('.workspace-page-header') !== header) return;
    cleanupCurrent = createScene(header, THREE);
    currentHeader = header;
  } catch {
    // Decorative 3D is optional. The workspace remains fully usable without WebGL.
  }
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(sync);
}

const root = document.querySelector('#app') || document.body;
const observer = new MutationObserver(mutations => {
  if (mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length)) schedule();
});
observer.observe(root, { childList: true, subtree: true });

const backendObserver = new MutationObserver(schedule);
backendObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-backend'] });
reducedMotion.addEventListener?.('change', schedule);
desktopFine.addEventListener?.('change', schedule);
window.addEventListener('pagehide', () => cleanupCurrent?.(), { once: true });
schedule();
