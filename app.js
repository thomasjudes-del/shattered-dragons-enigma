const BUILD = 'v8';

const SCENES = {
  camp: {
    name: 'Field camp',
    image: './assets/scenes/camp.avif?v=8',
    hint: 'The marked route leaves the camp through the vegetation ahead.',
    forward: 'trail',
    back: null,
    hotspot: [35, 12, 52, 74]
  },
  trail: {
    name: 'Survey trail',
    image: './assets/scenes/trail.avif?v=8',
    hint: 'Follow the survey route deeper into the forest.',
    forward: 'anomaly',
    back: 'camp',
    hotspot: [31, 12, 44, 76]
  },
  anomaly: {
    name: 'Survey anomaly',
    image: './assets/scenes/anomaly.avif?v=8',
    hint: 'The markers converge on something that does not belong here.',
    forward: 'entrance',
    back: 'trail',
    hotspot: [29, 15, 46, 68]
  },
  entrance: {
    name: 'Buried access',
    image: './assets/scenes/entrance.avif?v=8',
    hint: 'The opening is the only obvious way forward.',
    forward: 'lab',
    back: 'anomaly',
    hotspot: [30, 17, 43, 62]
  },
  lab: {
    name: 'Interior',
    image: './assets/scenes/lab.avif?v=8',
    hint: 'There is nothing else to open in this navigation test.',
    forward: null,
    back: 'entrance',
    hotspot: null
  }
};

const game = document.getElementById('game');
const sceneFrame = document.querySelector('.scene-frame');
const sceneImage = document.getElementById('sceneImage');
const backdropImage = document.getElementById('backdropImage');
const hotspotLayer = document.getElementById('hotspotLayer');
const sceneToast = document.getElementById('sceneToast');
const echoLayer = document.getElementById('echoLayer');
const backBtn = document.getElementById('backBtn');
const inventoryBtn = document.getElementById('inventoryBtn');
const inventoryTray = document.getElementById('inventoryTray');
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
        reject(new Error(`Image has no intrinsic dimensions: ${src}`));
        return;
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Image failed to decode: ${src}`));
    img.src = src;
  });
}

function echoAt(x, y) {
  const dot = document.createElement('span');
  dot.className = 'tap-echo';
  dot.style.left = `${x}px`;
  dot.style.top = `${y}px`;
  echoLayer.appendChild(dot);
  window.setTimeout(() => dot.remove(), 620);
}

function showSceneToast(text) {
  clearTimeout(toastTimer);
  sceneToast.textContent = text;
  sceneToast.classList.add('show');
  toastTimer = window.setTimeout(() => sceneToast.classList.remove('show'), 900);
}

function showHint() {
  clearTimeout(hintTimer);
  hintToast.textContent = SCENES[currentId].hint;
  hintToast.classList.add('show');
  hintTimer = window.setTimeout(() => hintToast.classList.remove('show'), 3000);
}

function setInventory(open) {
  inventoryTray.classList.toggle('open', open);
  inventoryTray.setAttribute('aria-hidden', String(!open));
  inventoryBtn.setAttribute('aria-expanded', String(open));
}

function renderBack(scene) {
  backBtn.hidden = !scene.back;
  if (scene.back) {
    backBtn.setAttribute('aria-label', `Go back to ${SCENES[scene.back].name}`);
  }
}

function renderHotspot(scene) {
  hotspotLayer.replaceChildren();
  if (!scene.hotspot || !scene.forward) return;

  const [x, y, w, h] = scene.hotspot;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'scene-hotspot';
  button.setAttribute('aria-label', `Explore ${SCENES[scene.forward].name}`);
  Object.assign(button.style, {
    left: `${x}%`,
    top: `${y}%`,
    width: `${w}%`,
    height: `${h}%`
  });
  button.addEventListener('pointerdown', event => echoAt(event.clientX, event.clientY));
  button.addEventListener('click', event => {
    event.stopPropagation();
    void goTo(scene.forward);
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
    game.dataset.scene = id;
    sceneImage.src = scene.image;
    backdropImage.src = scene.image;
    sceneImage.alt = '';
    backdropImage.alt = '';

    // Never enlarge a scene beyond its real pixel width on desktop.
    // This keeps navigation assets crisp until the final HD art pipeline is in place.
    sceneFrame.style.setProperty('--scene-max-width', `${Math.min(1600, decoded.naturalWidth)}px`);
    sceneFrame.dataset.ready = 'true';

    renderBack(scene);
    renderHotspot(scene);
    setInventory(false);
    showSceneToast(scene.name);

    if (!initial) history.replaceState(null, '', `#${id}`);
  } catch (error) {
    console.error(`[${BUILD}] scene asset error`, id, error);
    assetError.hidden = false;
    assetError.querySelector('strong').textContent = 'Scene image unavailable';
    assetError.querySelector('span').textContent = 'The scene asset could not be decoded.';
  } finally {
    if (token === transitionToken) document.body.classList.remove('is-loading');
  }
}

backBtn.addEventListener('pointerdown', event => echoAt(event.clientX, event.clientY));
backBtn.addEventListener('click', event => {
  event.stopPropagation();
  const target = SCENES[currentId].back;
  if (target) void goTo(target);
});

inventoryBtn.addEventListener('click', event => {
  event.stopPropagation();
  setInventory(!inventoryTray.classList.contains('open'));
});

hintBtn.addEventListener('click', event => {
  event.stopPropagation();
  showHint();
});

document.addEventListener('pointerdown', event => {
  const target = event.target;
  if (target.closest('button') || target.closest('#inventoryTray')) return;
  echoAt(event.clientX, event.clientY);
}, { passive: true });

document.addEventListener('keydown', event => {
  const scene = SCENES[currentId];
  if ((event.key === 'ArrowLeft' || event.key === 'Escape') && scene.back) void goTo(scene.back);
  if (event.key === 'Enter' && scene.forward) void goTo(scene.forward);
});

async function boot() {
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

  for (const [id, scene] of Object.entries(SCENES)) {
    loadImage(scene.image).catch(error => console.error(`[${BUILD}] preload failed`, id, error));
  }
}

void boot();
