const BUILD = 'v10.0';
const EXPECTED_SPRITE_WIDTH = 1600;
const EXPECTED_SPRITE_HEIGHT = 4500;
const EXPECTED_BASE64_LENGTH = 223668;

const SCENES = [
  { id: 'camp', row: 0, hotspot: [34, 12, 58, 76], hint: 'The field route continues beyond the camp.' },
  { id: 'map', row: 1, hotspot: [18, 10, 66, 78], hint: 'The survey map marks a route deeper into the forest.' },
  { id: 'team', row: 2, hotspot: [34, 12, 58, 76], hint: 'Follow the expedition into the jungle.' },
  { id: 'entrance', row: 3, hotspot: [31, 15, 42, 70], hint: 'The buried opening is the only route forward.' },
  { id: 'lab', row: 4, hotspot: null, hint: 'End of the navigation V0.' }
];

const SPRITE_PARTS = [
  'scene-00.txt', 'scene-01.txt', 'scene-02.txt', 'scene-03.txt',
  'scene-04.txt', 'scene-05.txt', 'scene-06.txt', 'scene-07.txt'
];
const SCENE_09_PARTS = ['scene-09-0a.txt', 'scene-09-0b.txt', 'scene-09-0c.txt', 'scene-09-0d.txt'];
const SCENE_10_PARTS = ['scene-10-0a.txt', 'scene-10-0b.txt', 'scene-10-0c.txt', 'scene-10-0d.txt'];

const game = document.getElementById('game');
const stage = document.getElementById('stage');
const canvas = document.getElementById('sceneCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const hotspotLayer = document.getElementById('hotspotLayer');
const hintBtn = document.getElementById('hintBtn');
const backBtn = document.getElementById('backBtn');
const satchelBtn = document.getElementById('satchelBtn');
const satchelImage = document.getElementById('satchelImage');
const inventory = document.getElementById('inventory');
const hintToast = document.getElementById('hintToast');
const errorBox = document.getElementById('errorBox');
const echoLayer = document.getElementById('echoLayer');
const loading = document.getElementById('loading');

let currentIndex = 0;
let spriteImage = null;
let spriteUrl = null;
let satchelUrl = null;
let hintTimer = null;
let transitioning = false;

function normalizeBase64(value) {
  return value.replace(/\s+/g, '');
}

async function fetchText(name) {
  const response = await fetch(`./assets/v10/${name}?v=100`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return normalizeBase64(await response.text());
}

function base64ToBlobUrl(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function loadImage(url, label) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) reject(new Error(`${label}: zero dimensions`));
      else resolve(image);
    };
    image.onerror = () => reject(new Error(`${label}: decode failed`));
    image.src = url;
  });
}

async function loadSprite() {
  const firstEight = await Promise.all(SPRITE_PARTS.map(fetchText));
  firstEight[0] = firstEight[0].replace('FzDTncijagl/Vz1f', 'FzDTncijigl/Vz1f');

  const scene08Raw = await fetchText('scene-08.txt');
  const scene08 = scene08Raw.slice(0, 20000);
  const scene09 = (await Promise.all(SCENE_09_PARTS.map(fetchText))).join('');
  const scene10 = (await Promise.all(SCENE_10_PARTS.map(fetchText))).join('');
  const scene11 = await fetchText('scene-11-full.txt');

  const base64 = [...firstEight, scene08, scene09, scene10, scene11].join('');
  if (base64.length !== EXPECTED_BASE64_LENGTH) {
    throw new Error(`sprite payload ${base64.length}/${EXPECTED_BASE64_LENGTH}`);
  }

  spriteUrl = base64ToBlobUrl(base64, 'image/avif');
  const image = await loadImage(spriteUrl, 'scene sprite');
  if (image.naturalWidth !== EXPECTED_SPRITE_WIDTH || image.naturalHeight !== EXPECTED_SPRITE_HEIGHT) {
    throw new Error(`sprite dimensions ${image.naturalWidth}x${image.naturalHeight}`);
  }
  return image;
}

async function loadSatchel() {
  const base64 = await fetchText('satchel-q60.txt');
  satchelUrl = base64ToBlobUrl(base64, 'image/webp');
  const image = await loadImage(satchelUrl, 'satchel');
  if (image.naturalWidth < 300 || image.naturalHeight < 300) {
    throw new Error(`satchel dimensions ${image.naturalWidth}x${image.naturalHeight}`);
  }
  satchelImage.src = satchelUrl;
  game.dataset.satchelWidth = String(image.naturalWidth);
  game.dataset.satchelHeight = String(image.naturalHeight);
}

function drawScene(index) {
  const scene = SCENES[index];
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 1600, 900);
  ctx.drawImage(spriteImage, 0, scene.row * 900, 1600, 900, 0, 0, 1600, 900);
  ctx.restore();
  game.dataset.scene = scene.id;
  game.dataset.sceneRow = String(scene.row);
  backBtn.hidden = index === 0;
  renderHotspot(scene, index);
}

function renderHotspot(scene, index) {
  hotspotLayer.replaceChildren();
  if (!scene.hotspot || index >= SCENES.length - 1) return;
  const [left, top, width, height] = scene.hotspot;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'scene-hotspot';
  button.setAttribute('aria-label', 'Explore');
  Object.assign(button.style, {
    left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`
  });
  button.addEventListener('click', event => {
    event.stopPropagation();
    echo(event.clientX, event.clientY);
    goTo(index + 1);
  });
  hotspotLayer.appendChild(button);
}

function goTo(index) {
  if (transitioning || index < 0 || index >= SCENES.length) return;
  transitioning = true;
  closeInventory();
  canvas.classList.add('changing');
  window.setTimeout(() => {
    currentIndex = index;
    drawScene(currentIndex);
    requestAnimationFrame(() => canvas.classList.remove('changing'));
    transitioning = false;
  }, 90);
}

function setInventory(open) {
  inventory.classList.toggle('open', open);
  inventory.setAttribute('aria-hidden', String(!open));
  satchelBtn.setAttribute('aria-expanded', String(open));
}

function closeInventory() {
  setInventory(false);
}

function showHint() {
  clearTimeout(hintTimer);
  hintToast.textContent = SCENES[currentIndex].hint;
  hintToast.classList.add('show');
  hintTimer = window.setTimeout(() => hintToast.classList.remove('show'), 2400);
}

function echo(x, y) {
  const ring = document.createElement('span');
  ring.className = 'tap-echo';
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  echoLayer.appendChild(ring);
  window.setTimeout(() => ring.remove(), 500);
}

function fail(error) {
  console.error('[SDE V10]', error);
  game.dataset.assetsReady = 'false';
  game.dataset.qa = 'failed';
  loading.hidden = true;
  errorBox.textContent = `Prototype failed to load. ${error.message}`;
  errorBox.hidden = false;
}

async function clearLegacyCaches() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
  }
}

backBtn.addEventListener('click', event => {
  event.stopPropagation();
  if (currentIndex > 0) goTo(currentIndex - 1);
});
hintBtn.addEventListener('click', event => {
  event.stopPropagation();
  showHint();
});
satchelBtn.addEventListener('click', event => {
  event.stopPropagation();
  setInventory(!inventory.classList.contains('open'));
});
stage.addEventListener('pointerdown', event => {
  if (!event.target.closest('button')) echo(event.clientX, event.clientY);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeInventory();
  if (event.key === 'ArrowLeft' && currentIndex > 0) goTo(currentIndex - 1);
});

async function boot() {
  game.dataset.build = BUILD;
  try {
    await clearLegacyCaches();
    [spriteImage] = await Promise.all([loadSprite(), loadSatchel()]);
    game.dataset.spriteWidth = String(spriteImage.naturalWidth);
    game.dataset.spriteHeight = String(spriteImage.naturalHeight);
    game.dataset.assetsReady = 'true';
    game.dataset.qa = 'ready';
    loading.hidden = true;
    drawScene(0);
  } catch (error) {
    fail(error);
  }
}

window.addEventListener('beforeunload', () => {
  if (spriteUrl) URL.revokeObjectURL(spriteUrl);
  if (satchelUrl) URL.revokeObjectURL(satchelUrl);
});

boot();
