import expeditionData from './assets/expedition.js';
import trailA from './assets/trail-a.js';
import trailB from './assets/trail-b.js';
import entranceData from './assets/entrance.js';
import labData from './assets/lab.js';

const BUILD = 'v9.4';
const dataUrl = (value) => value.startsWith('data:') ? value : `data:image/webp;base64,${value}`;

const SCENES = {
  camp: {
    src: null,
    next: 'expedition',
    back: null,
    hotspot: [49, 18, 48, 70],
    hint: 'The survey team is waiting beyond the camp.'
  },
  expedition: {
    src: dataUrl(expeditionData),
    next: 'trail',
    back: 'camp',
    hotspot: [52, 12, 46, 78],
    hint: 'Follow the expedition route into the forest.'
  },
  trail: {
    src: dataUrl(trailA + trailB),
    next: 'entrance',
    back: 'expedition',
    hotspot: [38, 18, 36, 68],
    hint: 'The route ends at something that should not be here.'
  },
  entrance: {
    src: dataUrl(entranceData),
    next: 'lab',
    back: 'trail',
    hotspot: [34, 24, 38, 64],
    hint: 'The buried entrance is the only way forward.'
  },
  lab: {
    src: dataUrl(labData),
    next: null,
    back: 'entrance',
    hotspot: null,
    hint: 'End of the V0 navigation slice.'
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
const decoded = new Map();

function fatal(message) {
  game.dataset.assetsReady = 'false';
  errorBox.textContent = message;
  errorBox.hidden = false;
  sceneImage.removeAttribute('src');
  hotspotLayer.replaceChildren();
}

async function loadCampText() {
  const response = await fetch(`./assets/scene-camp.webp?v=94`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`camp asset HTTP ${response.status}`);
  const text = (await response.text()).trim();
  if (!/^UklG[A-Za-z0-9+/=]+$/.test(text) || text.length < 10000) {
    throw new Error('camp asset is not valid base64 WebP text');
  }
  return dataUrl(text);
}

function decodeImage(name, src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (image.naturalWidth < 900 || image.naturalHeight < 500) {
        reject(new Error(`${name} decoded at only ${image.naturalWidth}x${image.naturalHeight}`));
        return;
      }
      decoded.set(name, { width: image.naturalWidth, height: image.naturalHeight });
      resolve();
    };
    image.onerror = () => reject(new Error(`${name} failed to decode`));
    image.src = src;
  });
}

async function validateAllAssets() {
  SCENES.camp.src = await loadCampText();
  for (const [name, scene] of Object.entries(SCENES)) {
    await decodeImage(name, scene.src);
  }
}

function setInventory(open) {
  inventory.classList.toggle('open', open);
  inventory.setAttribute('aria-hidden', String(!open));
  satchelBtn.setAttribute('aria-expanded', String(open));
}

function showHint() {
  clearTimeout(hintTimer);
  hintToast.textContent = SCENES[current].hint;
  hintToast.classList.add('show');
  hintTimer = setTimeout(() => hintToast.classList.remove('show'), 2600);
}

function echo(x, y) {
  const ripple = document.createElement('span');
  ripple.className = 'tap-echo';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  echoLayer.appendChild(ripple);
  setTimeout(() => ripple.remove(), 450);
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
    const preload = new Image();
    await new Promise((resolve, reject) => {
      preload.onload = resolve;
      preload.onerror = reject;
      preload.src = scene.src;
    });
    current = name;
    game.dataset.scene = name;
    sceneImage.src = scene.src;
    sceneImage.alt = `${name} scene`;
    backBtn.hidden = !scene.back;
    renderHotspot(scene);
    requestAnimationFrame(() => sceneImage.classList.remove('changing'));
  } catch {
    fatal(`Scene failed to load: ${name}`);
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

inventory.addEventListener('click', (event) => {
  if (event.target === inventory) setInventory(false);
});

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
    await validateAllAssets();
    game.dataset.assetsReady = 'true';
    game.dataset.assetDimensions = JSON.stringify(Object.fromEntries(decoded));
    await go('camp');
  } catch (error) {
    console.error('[SDE boot]', error);
    fatal(`Asset validation failed: ${error.message}`);
  }
}

boot();
