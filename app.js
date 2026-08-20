import campImage from './assets/camp-b.js';
import trailImage from './assets/trail-b.js';
import anomalyImage from './assets/anomaly.js';
import entranceImage from './assets/entrance.js';
import labImage from './assets/lab.js';

const BUILD = 'v6.1';

const SCENES = {
  camp: {
    name: 'Camp perimeter',
    image: campImage,
    hint: 'The biodiversity team marked a route east of camp.',
    exits: { forward: 'trail' },
    hotspot: [38, 18, 46, 58]
  },
  trail: {
    name: 'Jungle approach',
    image: trailImage,
    hint: 'The survey markers continue deeper into the forest.',
    exits: { forward: 'anomaly', back: 'camp' },
    hotspot: [33, 16, 38, 60]
  },
  anomaly: {
    name: 'Marked clearing',
    image: anomalyImage,
    hint: 'The team flagged something beneath the roots ahead.',
    exits: { forward: 'entrance', back: 'trail' },
    hotspot: [31, 18, 42, 58]
  },
  entrance: {
    name: 'Buried access',
    image: entranceImage,
    hint: 'The geometry is artificial. The opening continues inward.',
    exits: { forward: 'lab', back: 'anomaly' },
    hotspot: [29, 20, 44, 56]
  },
  lab: {
    name: 'Containment hall',
    image: labImage,
    hint: 'This place was not built for a biodiversity survey.',
    exits: { back: 'entrance' },
    hotspot: null
  }
};

const sceneFrame = document.querySelector('.scene-frame');
const sceneImage = document.getElementById('sceneImage');
const backdropImage = document.getElementById('backdropImage');
const hotspotLayer = document.getElementById('hotspotLayer');
const nav = document.getElementById('nav');
const sceneToast = document.getElementById('sceneToast');
const echoLayer = document.getElementById('echoLayer');
const inventoryBtn = document.getElementById('inventoryBtn');
const inventoryDrawer = document.getElementById('inventoryDrawer');
const inventoryClose = document.getElementById('inventoryClose');
const hintBtn = document.getElementById('hintBtn');
const hintToast = document.getElementById('hintToast');
const assetError = document.getElementById('assetError');

let currentId = 'camp';
let transitionToken = 0;
let toastTimer = null;
let hintTimer = null;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('Image has no intrinsic dimensions'));
        return;
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error('Image failed to decode'));
    img.src = src;
  });
}

function showSceneToast(text) {
  clearTimeout(toastTimer);
  sceneToast.textContent = text;
  sceneToast.classList.add('show');
  toastTimer = window.setTimeout(() => sceneToast.classList.remove('show'), 1200);
}

function showHint() {
  clearTimeout(hintTimer);
  hintToast.textContent = SCENES[currentId].hint;
  hintToast.classList.add('show');
  hintTimer = window.setTimeout(() => hintToast.classList.remove('show'), 3200);
}

function echoAt(x, y) {
  const dot = document.createElement('span');
  dot.className = 'tap-echo';
  dot.style.left = `${x}px`;
  dot.style.top = `${y}px`;
  echoLayer.appendChild(dot);
  window.setTimeout(() => dot.remove(), 650);
}

function makeArrow(direction, to) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `nav-arrow nav-${direction}`;
  button.setAttribute('aria-label', `${direction === 'forward' ? 'Continue to' : 'Return to'} ${SCENES[to].name}`);
  button.innerHTML = '<span aria-hidden="true"></span>';
  button.addEventListener('pointerdown', event => echoAt(event.clientX, event.clientY));
  button.addEventListener('click', event => {
    event.stopPropagation();
    void goTo(to);
  });
  return button;
}

function renderNav(scene) {
  nav.replaceChildren();
  if (scene.exits.forward) nav.appendChild(makeArrow('forward', scene.exits.forward));
  if (scene.exits.back) nav.appendChild(makeArrow('back', scene.exits.back));
}

function renderHotspot(scene) {
  hotspotLayer.replaceChildren();
  if (!scene.hotspot || !scene.exits.forward) return;
  const [x, y, w, h] = scene.hotspot;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'scene-hotspot';
  button.setAttribute('aria-label', `Continue to ${SCENES[scene.exits.forward].name}`);
  Object.assign(button.style, {
    left: `${x}%`,
    top: `${y}%`,
    width: `${w}%`,
    height: `${h}%`
  });
  button.addEventListener('pointerdown', event => echoAt(event.clientX, event.clientY));
  button.addEventListener('click', event => {
    event.stopPropagation();
    void goTo(scene.exits.forward);
  });
  hotspotLayer.appendChild(button);
}

async function goTo(id, initial = false) {
  const scene = SCENES[id];
  if (!scene) return;
  const token = ++transitionToken;
  assetError.hidden = true;
  document.body.classList.add('is-loading');

  try {
    const decoded = await loadImage(scene.image);
    if (token !== transitionToken) return;

    currentId = id;
    document.getElementById('game').dataset.scene = id;
    sceneImage.src = scene.image;
    sceneImage.alt = '';
    backdropImage.src = scene.image;
    backdropImage.alt = '';

    const safeWidth = Math.max(720, Math.min(1180, decoded.naturalWidth));
    sceneFrame.style.setProperty('--scene-max-width', `${safeWidth}px`);
    sceneFrame.dataset.ready = 'true';

    renderNav(scene);
    renderHotspot(scene);
    showSceneToast(scene.name);
    if (!initial) history.replaceState(null, '', `#${id}`);
  } catch (error) {
    console.error(`[${BUILD}] scene asset error`, id, error);
    assetError.hidden = false;
    assetError.querySelector('strong').textContent = 'Scene image unavailable';
    assetError.querySelector('span').textContent = 'Reload the page. Navigation has been stopped rather than showing a blank scene.';
  } finally {
    if (token === transitionToken) document.body.classList.remove('is-loading');
  }
}

function setInventory(open) {
  inventoryDrawer.classList.toggle('open', open);
  inventoryDrawer.setAttribute('aria-hidden', String(!open));
  inventoryBtn.setAttribute('aria-expanded', String(open));
}

inventoryBtn.addEventListener('click', event => {
  event.stopPropagation();
  setInventory(!inventoryDrawer.classList.contains('open'));
});
inventoryClose.addEventListener('click', () => setInventory(false));
hintBtn.addEventListener('click', event => {
  event.stopPropagation();
  showHint();
});

document.addEventListener('pointerdown', event => {
  const target = event.target;
  if (target.closest('button') || target.closest('#inventoryDrawer')) return;
  echoAt(event.clientX, event.clientY);
}, { passive: true });

document.addEventListener('keydown', event => {
  const scene = SCENES[currentId];
  if ((event.key === 'ArrowUp' || event.key === 'ArrowRight') && scene.exits.forward) void goTo(scene.exits.forward);
  if ((event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'Escape') && scene.exits.back) void goTo(scene.exits.back);
});

async function boot() {
  // The previous prototype installed a cache-first service worker that can keep broken assets alive on iOS.
  // For this recovery build, remove all old registrations and caches. We can re-enable offline caching once the asset pipeline is proven.
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  } catch (error) {
    console.warn(`[${BUILD}] cache cleanup skipped`, error);
  }

  const hash = location.hash.replace('#', '');
  const start = SCENES[hash] ? hash : 'camp';
  await goTo(start, true);

  // Real preload validation. A decode error stays visible in the console and can fail CI.
  for (const [id, scene] of Object.entries(SCENES)) {
    loadImage(scene.image).catch(error => console.error(`[${BUILD}] preload failed`, id, error));
  }
}

void boot();
