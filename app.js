const VERSION = '175';
const STORAGE_KEY = 'sde-inventory-v2';
const R2_BASE = 'https://shattered-dragons-enigma.thomas-judes.workers.dev/assets/shattered-dragons';
const MAP_SOURCES = {
  both: `${R2_BASE}/map/map-both.png`,
  flashlightOnly: `${R2_BASE}/map/map-flashlight-only.png`,
  compassOnly: `${R2_BASE}/map/map-compass-only.png`,
  none: `${R2_BASE}/map/map-none.png`
};
const MAP_SOURCE = MAP_SOURCES.both;
const MAP_DETAIL_SOURCE = `${R2_BASE}/map/map-detail.png`;

function applyRequestedReset() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('reset') !== '1') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('sde-inventory-v1');
  } catch {}
  url.searchParams.delete('reset');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

applyRequestedReset();

const scenes = [
  {
    id: 'camp',
    src: `./assets/scenes/camp-hd.avif?v=${VERSION}`,
    pos: 'center center',
    hint: 'The biodiversity survey camp is the last normal place on the route.',
    hotspots: [
      { id: 'camp-next', action: 'goto', target: 'team', area: [52, 18, 38, 70], label: 'Follow the expedition route' }
    ]
  },
  {
    id: 'team',
    src: `./assets/scenes/team-hd.png?v=${VERSION}`,
    pos: 'center center',
    hint: 'The team found a route that should not be here.',
    hotspots: [
      { id: 'team-next', action: 'goto', target: 'map', area: [34, 18, 36, 68], label: 'Examine the field table' }
    ]
  },
  {
    id: 'map',
    src: MAP_SOURCE,
    pos: 'center center',
    hint: 'The map can be inspected. Useful expedition gear can be packed.',
    hotspots: [
      { id: 'map-paper', action: 'goto', target: 'map-detail', area: [20, 42, 68, 38], label: 'Examine the map', z: 2 },
      { id: 'compass', action: 'collect', item: 'compass', area: [1, 65, 27, 19], label: 'Take the compass', z: 5 },
      { id: 'flashlight', action: 'collect', item: 'flashlight', area: [0, 78, 43, 18], label: 'Take the flashlight', z: 5 }
    ]
  },
  {
    id: 'map-detail',
    src: MAP_DETAIL_SOURCE,
    pos: 'center center',
    hint: 'A marked route converges on the red X near the lost citadel.',
    hotspots: [
      { id: 'route-mark', action: 'goto', target: 'entrance', area: [49, 42, 12, 14], label: 'Follow the marked route', z: 3 }
    ]
  },
  {
    id: 'entrance',
    src: `./assets/scenes/entrance-hd.png?v=${VERSION}`,
    pos: 'center center',
    hint: 'The buried entrance is the only obvious way forward.',
    hotspots: [
      { id: 'entrance-next', action: 'goto', target: 'lab', area: [34, 30, 34, 50], label: 'Enter the buried structure' }
    ]
  },
  {
    id: 'lab',
    src: `./assets/scenes/lab-hd.png?v=${VERSION}`,
    pos: 'center center',
    hint: 'End of the navigation V0.',
    hotspots: []
  }
];

const ITEM_DEFS = {
  compass: { label: 'Compass' },
  flashlight: { label: 'Flashlight' }
};

const sceneIndex = new Map(scenes.map((scene, i) => [scene.id, i]));
const game = document.getElementById('game');
const stage = document.querySelector('.stage');
const image = document.getElementById('scene');
const sceneProps = document.getElementById('sceneProps');
const hotspots = document.getElementById('hotspots');
const back = document.getElementById('back');
const hint = document.getElementById('hint');
const reset = document.getElementById('reset');
const satchel = document.getElementById('satchel');
const inventory = document.getElementById('inventory');
const inventorySlots = [...inventory.querySelectorAll('.inventory-slot')];
const toast = document.getElementById('toast');
const echoes = document.getElementById('echoes');
const loading = document.getElementById('loading');
const errorBox = document.getElementById('errorBox');

let index = 0;
let busy = false;
let timer;
let selectedItem = null;
const cache = new Map();
const collected = new Set(loadInventory());

function loadInventory() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(id => ITEM_DEFS[id]) : [];
  } catch {
    return [];
  }
}

function saveInventory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collected]));
  } catch {}
}

window.resetEnigma = function resetEnigma() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('sde-inventory-v1');
  } catch {}
  window.location.href = `./?v=${VERSION}&reset=1`;
};

function currentMapSource() {
  const hasCompass = !collected.has('compass');
  const hasFlashlight = !collected.has('flashlight');
  if (hasCompass && hasFlashlight) return MAP_SOURCES.both;
  if (!hasCompass && hasFlashlight) return MAP_SOURCES.flashlightOnly;
  if (hasCompass && !hasFlashlight) return MAP_SOURCES.compassOnly;
  return MAP_SOURCES.none;
}

function sceneSource(scene) {
  if (scene.id === 'map') return currentMapSource();
  return scene.src;
}

function preload(src) {
  return new Promise((resolve, reject) => {
    if (cache.has(src)) return resolve(cache.get(src));
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return reject(new Error('Image has zero dimensions'));
      cache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function showToast(message, duration = 1900) {
  clearTimeout(timer);
  toast.textContent = message;
  toast.classList.add('show');
  timer = setTimeout(() => toast.classList.remove('show'), duration);
}

function makeInventoryCrop(id) {
  const frame = document.createElement('span');
  frame.className = `inventory-photo inventory-photo-${id}`;
  frame.setAttribute('aria-hidden', 'true');
  const crop = document.createElement('img');
  crop.className = 'inventory-crop';
  crop.src = MAP_SOURCES.both;
  crop.alt = '';
  crop.draggable = false;
  frame.appendChild(crop);
  return frame;
}

function selectInventoryItem(id) {
  if (!id || !collected.has(id)) return;
  selectedItem = selectedItem === id ? null : id;
  renderInventory();
  showToast(selectedItem ? `${ITEM_DEFS[selectedItem].label} selected.` : 'Item deselected.');
}

function renderInventory() {
  const ids = [...collected];
  inventorySlots.forEach((slot, i) => {
    const id = ids[i];
    slot.className = 'inventory-slot';
    slot.replaceChildren();
    delete slot.dataset.itemId;
    slot.setAttribute('aria-pressed', 'false');
    if (!id) {
      slot.setAttribute('aria-label', 'Empty slot');
      slot.removeAttribute('title');
      return;
    }
    const def = ITEM_DEFS[id];
    slot.dataset.itemId = id;
    slot.classList.add('has-item', `item-${id}`);
    if (selectedItem === id) {
      slot.classList.add('selected');
      slot.setAttribute('aria-pressed', 'true');
    }
    slot.setAttribute('aria-label', `${def.label}${selectedItem === id ? ', selected' : ''}`);
    slot.title = def.label;
    slot.appendChild(makeInventoryCrop(id));
  });
  satchel.classList.toggle('has-selection', Boolean(selectedItem));
}

function getSceneHotspots(scene) {
  if (scene.id !== 'map') return scene.hotspots || [];
  return (scene.hotspots || []).filter(spec => spec.action !== 'collect' || !collected.has(spec.item));
}

async function refreshMapImage() {
  const scene = scenes[index];
  if (scene.id !== 'map') return;
  const src = currentMapSource();
  try {
    await preload(src);
    image.src = src;
  } catch (err) {
    console.error(err);
    showError('Map state failed to load.');
  }
}

function collectItem(id) {
  const def = ITEM_DEFS[id];
  if (!def || collected.has(id)) return;
  collected.add(id);
  saveInventory();
  renderInventory();
  setHotspots(scenes[index]);
  refreshMapImage();
  showToast(`${def.label} added to satchel.`);
}

function activateHotspot(spec, event) {
  event.stopPropagation();
  echo(event.clientX, event.clientY);
  if (spec.action === 'goto') {
    const targetIndex = sceneIndex.get(spec.target);
    if (targetIndex !== undefined) go(targetIndex);
  } else if (spec.action === 'collect') {
    collectItem(spec.item);
  }
}

function positionHotspot(button, spec, scene) {
  const [left, top, width, height] = spec.area;
  if (scene.id === 'map-detail' && image.naturalWidth && image.naturalHeight) {
    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    const scale = Math.min(stageWidth / image.naturalWidth, stageHeight / image.naturalHeight);
    const drawnWidth = image.naturalWidth * scale;
    const drawnHeight = image.naturalHeight * scale;
    const offsetX = (stageWidth - drawnWidth) / 2;
    const offsetY = (stageHeight - drawnHeight) / 2;
    Object.assign(button.style, {
      left: `${offsetX + drawnWidth * left / 100}px`,
      top: `${offsetY + drawnHeight * top / 100}px`,
      width: `${drawnWidth * width / 100}px`,
      height: `${drawnHeight * height / 100}px`
    });
    return;
  }
  Object.assign(button.style, {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`
  });
}

function setHotspots(scene) {
  hotspots.replaceChildren();
  for (const spec of getSceneHotspots(scene)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `hotspot hotspot-${spec.action}`;
    button.dataset.hotspotId = spec.id;
    button.setAttribute('aria-label', spec.label || 'Explore');
    button.style.zIndex = String(spec.z || 1);
    positionHotspot(button, spec, scene);
    button.addEventListener('click', event => activateHotspot(spec, event));
    hotspots.appendChild(button);
  }
}

function render(i) {
  index = i;
  const scene = scenes[i];
  game.dataset.scene = scene.id;
  image.style.objectPosition = scene.pos || 'center center';
  image.style.objectFit = scene.id === 'map-detail' ? 'contain' : 'cover';
  image.style.background = scene.id === 'map-detail' ? '#080603' : '#000';
  image.style.transform = 'none';
  image.style.transformOrigin = 'center center';
  image.classList.remove('map-detail-fallback');
  back.hidden = i === 0;
  sceneProps.replaceChildren();
  setHotspots(scene);
}

function closeInventory() {
  inventory.classList.remove('open');
  inventory.setAttribute('aria-hidden', 'true');
  satchel.setAttribute('aria-expanded', 'false');
}

async function go(i) {
  if (busy || i < 0 || i >= scenes.length) return;
  busy = true;
  closeInventory();
  const next = scenes[i];
  const src = sceneSource(next);
  try {
    await preload(src);
    image.classList.add('fade');
    setTimeout(() => {
      image.src = src;
      render(i);
      requestAnimationFrame(() => image.classList.remove('fade'));
      busy = false;
    }, 80);
  } catch (err) {
    console.error(err);
    busy = false;
    showError('Scene failed to load.');
  }
}

function showHint() {
  showToast(scenes[index].hint);
}

function toggleInventory() {
  const open = !inventory.classList.contains('open');
  inventory.classList.toggle('open', open);
  inventory.setAttribute('aria-hidden', String(!open));
  satchel.setAttribute('aria-expanded', String(open));
}

function echo(x, y) {
  const ring = document.createElement('span');
  ring.className = 'echo';
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  echoes.appendChild(ring);
  setTimeout(() => ring.remove(), 460);
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  setTimeout(() => { errorBox.hidden = true; }, 2600);
}

back.addEventListener('click', () => go(index - 1));
hint.addEventListener('click', showHint);
reset.addEventListener('click', window.resetEnigma);
satchel.addEventListener('click', toggleInventory);
inventorySlots.forEach(slot => {
  slot.addEventListener('click', () => selectInventoryItem(slot.dataset.itemId));
});
window.addEventListener('resize', () => setHotspots(scenes[index]));
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('button')) echo(event.clientX, event.clientY);
});
document.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') go(index - 1);
  if (event.key === 'Escape') closeInventory();
});

async function boot() {
  renderInventory();
  try {
    const firstSrc = sceneSource(scenes[0]);
    await preload(firstSrc);
    image.src = firstSrc;
    render(0);
    game.dataset.ready = 'true';
    loading.hidden = true;
    const sources = [...new Set([
      ...scenes.slice(1).map(sceneSource),
      ...Object.values(MAP_SOURCES),
      MAP_DETAIL_SOURCE
    ])];
    Promise.allSettled(sources.map(preload));
  } catch (err) {
    console.error(err);
    loading.hidden = true;
    showError('Initial scene failed to load.');
  }
}

boot();
