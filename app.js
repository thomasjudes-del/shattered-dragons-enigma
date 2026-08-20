const BUILD = 'v9.5';

const SCENES = {
  camp: {
    src: './assets/scenes/camp.avif?v=95',
    next: 'trail',
    back: null,
    hotspot: [42, 14, 52, 76],
    hint: 'The survey route continues into the forest.'
  },
  trail: {
    src: './assets/scenes/trail.avif?v=95',
    next: 'anomaly',
    back: 'camp',
    hotspot: [30, 10, 48, 78],
    hint: 'Follow the route deeper into the jungle.'
  },
  anomaly: {
    src: './assets/scenes/anomaly.avif?v=95',
    next: 'entrance',
    back: 'trail',
    hotspot: [28, 14, 48, 72],
    hint: 'Something ahead does not belong here.'
  },
  entrance: {
    src: './assets/scenes/entrance.avif?v=95',
    next: 'lab',
    back: 'anomaly',
    hotspot: [27, 16, 50, 72],
    hint: 'The opening is the only visible way forward.'
  },
  lab: {
    src: './assets/scenes/lab.avif?v=95',
    next: null,
    back: 'entrance',
    hotspot: null,
    hint: 'End of the navigation slice.'
  }
};

const game = document.getElementById('game');
const sceneImage = document.getElementById('sceneImage');
const hotspotLayer = document.getElementById('hotspotLayer');
const hintBtn = document.getElementById('hintBtn');
const backBtn = document.getElementById('backBtn');
const satchelBtn = document.getElementById('satchelBtn');
const inventory = document.getElementById('inventory');
const hintToast = document.getElementById('hintToast');
const errorBox = document.getElementById('errorBox');
const echoLayer = document.getElementById('echoLayer');

let current = 'camp';
let busy = false;
let hintTimer = null;

function setInventory(open) {
  inventory.classList.toggle('open', open);
  inventory.setAttribute('aria-hidden', String(!open));
  satchelBtn.setAttribute('aria-expanded', String(open));
}

function showHint() {
  clearTimeout(hintTimer);
  hintToast.textContent = SCENES[current].hint;
  hintToast.classList.add('show');
  hintTimer = setTimeout(() => hintToast.classList.remove('show'), 2400);
}

function echo(x, y) {
  const ripple = document.createElement('span');
  ripple.className = 'tap-echo';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  echoLayer.appendChild(ripple);
  setTimeout(() => ripple.remove(), 450);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => img.naturalWidth > 0 && img.naturalHeight > 0 ? resolve(img) : reject(new Error('zero-size image'));
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

async function validateAssets() {
  for (const scene of Object.values(SCENES)) await loadImage(scene.src);
}

function renderHotspot(scene) {
  hotspotLayer.replaceChildren();
  if (!scene.hotspot || !scene.next) return;
  const [left, top, width, height] = scene.hotspot;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'advance-hotspot';
  button.setAttribute('aria-label', 'Explore scene');
  button.style.left = `${left}%`;
  button.style.top = `${top}%`;
  button.style.width = `${width}%`;
  button.style.height = `${height}%`;
  button.addEventListener('click', (event) => {
    echo(event.clientX, event.clientY);
    go(scene.next);
  });
  hotspotLayer.appendChild(button);
}

async function go(name) {
  if (busy || !SCENES[name]) return;
  busy = true;
  const scene = SCENES[name];
  setInventory(false);
  errorBox.hidden = true;
  sceneImage.classList.add('changing');
  try {
    await loadImage(scene.src);
    current = name;
    game.dataset.scene = name;
    sceneImage.src = scene.src;
    sceneImage.alt = `${name} scene`;
    backBtn.hidden = !scene.back;
    renderHotspot(scene);
    requestAnimationFrame(() => sceneImage.classList.remove('changing'));
  } catch (error) {
    console.error('[SDE scene]', error);
    errorBox.textContent = 'Scene failed to load.';
    errorBox.hidden = false;
  } finally {
    busy = false;
  }
}

backBtn.addEventListener('click', () => {
  const back = SCENES[current].back;
  if (back) go(back);
});

hintBtn.addEventListener('click', showHint);
satchelBtn.addEventListener('click', () => setInventory(!inventory.classList.contains('open')));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setInventory(false);
  if (event.key === 'ArrowLeft' && SCENES[current].back) go(SCENES[current].back);
});

async function boot() {
  game.dataset.build = BUILD;
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    await validateAssets();
    game.dataset.assetsReady = 'true';
    await go('camp');
  } catch (error) {
    console.error('[SDE boot]', error);
    errorBox.textContent = 'Scene assets failed to load.';
    errorBox.hidden = false;
    game.dataset.assetsReady = 'false';
  }
}

boot();