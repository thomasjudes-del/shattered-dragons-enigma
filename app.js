import trailA from './assets/trail-a.js';
import trailB from './assets/trail-b.js';
import anomalyData from './assets/anomaly.js';
import entranceData from './assets/entrance.js';
import labData from './assets/lab.js';

const BUILD = 'v9.3';
const dataUrl = value => value.startsWith('data:') ? value : `data:image/webp;base64,${value}`;

const SCENES = {
  camp: {
    image: './assets/scene-camp.webp?v=93',
    next: 'trail',
    back: null,
    hotspot: [44, 18, 46, 66],
    hint: 'The survey route continues beyond the field camp.'
  },
  trail: {
    image: dataUrl(trailA + trailB),
    next: 'anomaly',
    back: 'camp',
    hotspot: [34, 12, 38, 72],
    hint: 'Follow the survey markers deeper into the forest.'
  },
  anomaly: {
    image: dataUrl(anomalyData),
    next: 'entrance',
    back: 'trail',
    hotspot: [34, 18, 38, 62],
    hint: 'Something ahead does not belong in a biodiversity survey.'
  },
  entrance: {
    image: dataUrl(entranceData),
    next: 'lab',
    back: 'anomaly',
    hotspot: [31, 19, 42, 62],
    hint: 'The opening is the only visible route forward.'
  },
  lab: {
    image: dataUrl(labData),
    next: null,
    back: 'entrance',
    hotspot: null,
    hint: 'End of this navigation slice.'
  }
};

const game = document.getElementById('game');
const sceneFrame = document.getElementById('sceneFrame');
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
let transitionToken = 0;
let hintTimer = null;

function preload(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => img.naturalWidth && img.naturalHeight ? resolve(img) : reject(new Error('Image has no dimensions'));
    img.onerror = () => reject(new Error('Image failed to decode'));
    img.src = src;
  });
}

function echo(x, y) {
  const ripple = document.createElement('span');
  ripple.className = 'tap-echo';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  echoLayer.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
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
  hintTimer = setTimeout(() => hintToast.classList.remove('show'), 2800);
}

function renderHotspot(scene) {
  hotspotLayer.replaceChildren();
  if (!scene.next || !scene.hotspot) return;
  const [x, y, w, h] = scene.hotspot;
  const button = document.createElement('button');
  button.className = 'scene-hotspot';
  button.type = 'button';
  button.setAttribute('aria-label', 'Continue');
  Object.assign(button.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });
  button.addEventListener('pointerdown', e => echo(e.clientX, e.clientY));
  button.addEventListener('click', e => {
    e.stopPropagation();
    void goTo(scene.next);
  });
  hotspotLayer.appendChild(button);
}

async function goTo(id, initial = false) {
  const scene = SCENES[id];
  if (!scene) return;
  const token = ++transitionToken;
  errorBox.hidden = true;
  document.body.classList.add('loading');
  try {
    await preload(scene.image);
    if (token !== transitionToken) return;
    current = id;
    game.dataset.scene = id;
    sceneFrame.classList.remove('ready');
    sceneImage.src = scene.image;
    requestAnimationFrame(() => sceneFrame.classList.add('ready'));
    backBtn.hidden = !scene.back;
    renderHotspot(scene);
    setInventory(false);
    if (!initial) history.replaceState(null, '', `#${id}`);
  } catch (error) {
    console.error(`[${BUILD}]`, id, error);
    errorBox.textContent = 'Scene failed to load.';
    errorBox.hidden = false;
  } finally {
    if (token === transitionToken) document.body.classList.remove('loading');
  }
}

backBtn.addEventListener('pointerdown', e => echo(e.clientX, e.clientY));
backBtn.addEventListener('click', e => {
  e.stopPropagation();
  const previous = SCENES[current].back;
  if (previous) void goTo(previous);
});

hintBtn.addEventListener('click', e => {
  e.stopPropagation();
  showHint();
});

satchelBtn.addEventListener('click', e => {
  e.stopPropagation();
  setInventory(!inventory.classList.contains('open'));
});

document.addEventListener('pointerdown', e => {
  if (e.target.closest('button') || e.target.closest('#inventory')) return;
  echo(e.clientX, e.clientY);
}, { passive: true });

document.addEventListener('keydown', e => {
  if ((e.key === 'ArrowLeft' || e.key === 'Escape') && SCENES[current].back) void goTo(SCENES[current].back);
});

async function boot() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  } catch (e) {
    console.warn(`[${BUILD}] cache cleanup skipped`, e);
  }
  const hash = location.hash.slice(1);
  await goTo(SCENES[hash] ? hash : 'camp', true);
  Object.values(SCENES).forEach(scene => preload(scene.image).catch(() => {}));
}

void boot();
