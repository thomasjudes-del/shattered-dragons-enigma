const BUILD = 'v10.1';
const SPRITE_SHA256 = '0eaf8943b7a1dd81c25cd05f838ca0bbd5841235d6563446f581cba6f10f200b';
const SATCHEL_SHA256 = '10ea16fd311403b15341fce8adb72825a798456fc5f6145a27dc74b4948064d4';
const EXPECTED_BASE64_LENGTH = 223668;

const SCENES = [
  { id: 'camp', row: 0, hotspot: [34, 12, 58, 76], hint: 'The field route continues beyond the camp.' },
  { id: 'map', row: 1, hotspot: [18, 10, 66, 78], hint: 'The survey map marks a route deeper into the forest.' },
  { id: 'team', row: 2, hotspot: [34, 12, 58, 76], hint: 'Follow the expedition into the jungle.' },
  { id: 'entrance', row: 3, hotspot: [31, 15, 42, 70], hint: 'The buried opening is the only route forward.' },
  { id: 'lab', row: 4, hotspot: null, hint: 'End of the navigation V0.' }
];

const PARTS_00 = ['scene-00-0a.txt','scene-00-0b.txt','scene-00-0c.txt','scene-00-0d.txt'];
const PARTS_01_07 = ['scene-01.txt','scene-02.txt','scene-03.txt','scene-04.txt','scene-05.txt','scene-06.txt','scene-07.txt'];
const PARTS_09 = ['scene-09-0a.txt','scene-09-0b.txt','scene-09-0c.txt','scene-09-0d.txt'];
const PARTS_10 = ['scene-10-0a.txt','scene-10-0b.txt','scene-10-0c.txt','scene-10-0d.txt'];

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
let spriteImage;
let spriteUrl;
let satchelUrl;
let transitioning = false;
let hintTimer;

const clean = value => value.replace(/\s+/g, '');

async function fetchText(name) {
  const response = await fetch(`./assets/v10/${name}?v=101`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return clean(await response.text());
}

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function imageFromBytes(bytes, type, label) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${label}: decode failed`)); };
    image.src = url;
  });
}

async function join(names) {
  return (await Promise.all(names.map(fetchText))).join('');
}

async function loadSprite() {
  const [p00, p01to07, raw08, p09, p10, p11] = await Promise.all([
    join(PARTS_00), join(PARTS_01_07), fetchText('scene-08.txt'),
    join(PARTS_09), join(PARTS_10), fetchText('scene-11-full.txt')
  ]);
  const base64 = p00 + p01to07 + raw08.slice(0, 20000) + p09 + p10 + p11;
  if (base64.length !== EXPECTED_BASE64_LENGTH) throw new Error(`sprite payload ${base64.length}/${EXPECTED_BASE64_LENGTH}`);
  const bytes = decodeBase64(base64);
  const hash = await sha256(bytes);
  if (hash !== SPRITE_SHA256) throw new Error(`sprite checksum mismatch ${hash.slice(0, 12)}`);
  const loaded = await imageFromBytes(bytes, 'image/avif', 'scene sprite');
  if (loaded.image.naturalWidth !== 1600 || loaded.image.naturalHeight !== 4500) throw new Error(`sprite dimensions ${loaded.image.naturalWidth}x${loaded.image.naturalHeight}`);
  spriteUrl = loaded.url;
  return loaded.image;
}

async function loadSatchel() {
  const bytes = decodeBase64(await fetchText('satchel-q60.txt'));
  const hash = await sha256(bytes);
  if (hash !== SATCHEL_SHA256) throw new Error(`satchel checksum mismatch ${hash.slice(0, 12)}`);
  const loaded = await imageFromBytes(bytes, 'image/webp', 'satchel');
  if (loaded.image.naturalWidth < 300 || loaded.image.naturalHeight < 300) throw new Error('satchel dimensions invalid');
  satchelUrl = loaded.url;
  satchelImage.src = satchelUrl;
  game.dataset.satchelWidth = String(loaded.image.naturalWidth);
  game.dataset.satchelHeight = String(loaded.image.naturalHeight);
}

function drawScene(index) {
  const scene = SCENES[index];
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 1600, 900);
  ctx.drawImage(spriteImage, 0, scene.row * 900, 1600, 900, 0, 0, 1600, 900);
  game.dataset.scene = scene.id;
  backBtn.hidden = index === 0;
  hotspotLayer.replaceChildren();
  if (scene.hotspot && index < SCENES.length - 1) {
    const [left, top, width, height] = scene.hotspot;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'scene-hotspot';
    button.setAttribute('aria-label', 'Explore');
    Object.assign(button.style, { left:`${left}%`, top:`${top}%`, width:`${width}%`, height:`${height}%` });
    button.addEventListener('click', event => { event.stopPropagation(); echo(event.clientX, event.clientY); goTo(index + 1); });
    hotspotLayer.appendChild(button);
  }
}

function goTo(index) {
  if (transitioning || index < 0 || index >= SCENES.length) return;
  transitioning = true;
  setInventory(false);
  canvas.classList.add('changing');
  setTimeout(() => {
    currentIndex = index;
    drawScene(index);
    requestAnimationFrame(() => canvas.classList.remove('changing'));
    transitioning = false;
  }, 90);
}

function setInventory(open) {
  inventory.classList.toggle('open', open);
  inventory.setAttribute('aria-hidden', String(!open));
  satchelBtn.setAttribute('aria-expanded', String(open));
}

function showHint() {
  clearTimeout(hintTimer);
  hintToast.textContent = SCENES[currentIndex].hint;
  hintToast.classList.add('show');
  hintTimer = setTimeout(() => hintToast.classList.remove('show'), 2400);
}

function echo(x, y) {
  const ring = document.createElement('span');
  ring.className = 'tap-echo';
  ring.style.left = `${x}px`; ring.style.top = `${y}px`;
  echoLayer.appendChild(ring);
  setTimeout(() => ring.remove(), 500);
}

async function clearLegacyCaches() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
  }
}

function fail(error) {
  console.error('[SDE V10.1]', error);
  game.dataset.assetsReady = 'false'; game.dataset.qa = 'failed';
  loading.hidden = true; errorBox.hidden = false;
  errorBox.textContent = `Prototype failed to load. ${error.message}`;
}

backBtn.addEventListener('click', e => { e.stopPropagation(); if (currentIndex > 0) goTo(currentIndex - 1); });
hintBtn.addEventListener('click', e => { e.stopPropagation(); showHint(); });
satchelBtn.addEventListener('click', e => { e.stopPropagation(); setInventory(!inventory.classList.contains('open')); });
stage.addEventListener('pointerdown', e => { if (!e.target.closest('button')) echo(e.clientX, e.clientY); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setInventory(false); if (e.key === 'ArrowLeft' && currentIndex > 0) goTo(currentIndex - 1); });

async function boot() {
  game.dataset.build = BUILD;
  try {
    await clearLegacyCaches();
    [spriteImage] = await Promise.all([loadSprite(), loadSatchel()]);
    game.dataset.spriteWidth = String(spriteImage.naturalWidth);
    game.dataset.spriteHeight = String(spriteImage.naturalHeight);
    game.dataset.assetsReady = 'true'; game.dataset.qa = 'ready';
    loading.hidden = true; drawScene(0);
  } catch (error) { fail(error); }
}

window.addEventListener('beforeunload', () => { if (spriteUrl) URL.revokeObjectURL(spriteUrl); if (satchelUrl) URL.revokeObjectURL(satchelUrl); });
boot();
