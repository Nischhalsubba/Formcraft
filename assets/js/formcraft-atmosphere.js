const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js';
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const atmosphereViewportQuery = window.matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)');
const saveData = Boolean(navigator.connection?.saveData);
const lowMemory = Number(navigator.deviceMemory || 8) <= 4;
const lowPower = saveData || lowMemory;

let cleanupScene = null;
let sceneGate = null;
let threePromise = null;
let scheduled = false;

function shouldUseAtmosphere(gate) {
  return gate instanceof HTMLElement
    && document.documentElement.dataset.backend === 'auth'
    && atmosphereViewportQuery.matches
    && !reduceMotionQuery.matches
    && !lowPower;
}

function loadThree() {
  if (!threePromise) {
    threePromise = import(THREE_MODULE_URL).catch(error => {
      threePromise = null;
      throw error;
    });
  }
  return threePromise;
}

function createAtmosphere(gate, THREE) {
  if (!(gate instanceof HTMLElement) || gate.querySelector('.fc-auth-atmosphere')) return () => {};

  const canvas = document.createElement('canvas');
  canvas.className = 'fc-auth-atmosphere';
  canvas.setAttribute('aria-hidden', 'true');
  gate.prepend(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !lowPower,
      powerPreference: lowPower ? 'default' : 'high-performance'
    });
  } catch {
    canvas.remove();
    return () => {};
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 50);
  camera.position.set(0, 0, 6.2);

  const group = new THREE.Group();
  scene.add(group);

  const pointCount = lowPower ? 90 : 180;
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const palette = [
    new THREE.Color(0x72d4bf),
    new THREE.Color(0x4cae99),
    new THREE.Color(0xf09a72)
  ];

  for (let index = 0; index < pointCount; index += 1) {
    const i = index * 3;
    const radius = 1.6 + Math.random() * 3.8;
    const angle = Math.random() * Math.PI * 2;
    const elevation = (Math.random() - 0.5) * 4.8;
    positions[i] = Math.cos(angle) * radius;
    positions[i + 1] = elevation;
    positions[i + 2] = (Math.random() - 0.5) * 4.5;

    const color = palette[index % palette.length];
    colors[i] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
  }

  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pointGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const pointMaterial = new THREE.PointsMaterial({
    size: lowPower ? 0.025 : 0.032,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.68,
    vertexColors: true,
    depthWrite: false
  });

  const points = new THREE.Points(pointGeometry, pointMaterial);
  group.add(points);

  const formGeometry = new THREE.IcosahedronGeometry(1.45, 1);
  const formMaterial = new THREE.MeshBasicMaterial({
    color: 0x8adbc9,
    wireframe: true,
    transparent: true,
    opacity: 0.06,
    depthWrite: false
  });
  const form = new THREE.Mesh(formGeometry, formMaterial);
  form.position.set(-1.8, 0.2, -0.8);
  group.add(form);

  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let currentX = 0;
  let currentY = 0;
  let lastTime = performance.now();
  let paused = document.hidden;

  function resize() {
    const rect = gate.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function tick(now) {
    frame = 0;
    if (paused || !gate.isConnected) return;

    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    currentX += (pointerX - currentX) * Math.min(1, delta * 3.2);
    currentY += (pointerY - currentY) * Math.min(1, delta * 3.2);

    group.rotation.y += delta * 0.028;
    group.rotation.x = currentY * 0.055;
    points.rotation.z += delta * 0.012;
    form.rotation.x += delta * 0.035;
    form.rotation.y += delta * 0.055;
    camera.position.x = currentX * 0.18;
    camera.position.y = -currentY * 0.12;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  }

  function start() {
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
    const rect = gate.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
    pointerY = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
  }

  function onVisibility() {
    paused = document.hidden;
    if (paused) stop();
    else start();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(gate);
  gate.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  resize();
  start();

  return () => {
    stop();
    resizeObserver.disconnect();
    gate.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('visibilitychange', onVisibility);
    pointGeometry.dispose();
    pointMaterial.dispose();
    formGeometry.dispose();
    formMaterial.dispose();
    renderer.dispose();
    canvas.remove();
  };
}

async function sync() {
  scheduled = false;
  const gate = document.querySelector('.backend-gate');

  if (!shouldUseAtmosphere(gate)) {
    if (cleanupScene) cleanupScene();
    cleanupScene = null;
    sceneGate = null;
    return;
  }

  if (cleanupScene && sceneGate === gate) return;
  if (cleanupScene) {
    cleanupScene();
    cleanupScene = null;
    sceneGate = null;
  }

  try {
    const THREE = await loadThree();
    if (!shouldUseAtmosphere(gate) || cleanupScene) return;
    cleanupScene = createAtmosphere(gate, THREE);
    sceneGate = gate;
  } catch {
    // The decorative atmosphere is optional. Authentication remains fully usable.
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
window.addEventListener('pagehide', () => cleanupScene?.(), { once: true });
reduceMotionQuery.addEventListener?.('change', schedule);
atmosphereViewportQuery.addEventListener?.('change', schedule);
schedule();
