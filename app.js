const VERSION = '172';
const STORAGE_KEY = 'sde-inventory-v2';
const MAP_SOURCE = `./assets/scenes/map-hd.png?v=${VERSION}`;

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
    src: MAP_SOURCE,
    pos: 'center 68%',
    hint: 'The red X marks a route beyond the biodiversity survey area.',
    hotspots: [
      { id: 'route-mark', action: 'goto', target: 'entrance', area: [54, 43, 18, 16], label: 'Follow the marked route', z: 3 }
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
  crop.src = MAP_SOURCE;
  crop.alt = '';
  crop.draggable = false;
  frame.appendChild(crop);
  return frame;
}

function selectInventoryItem(id) {
  if (!id || !collected.has(id)) return;
  selectedItem = selectedItem === id ? null : id;
  renderInventory();
  if (selectedItem) {
    showToast(`${ITEM_DEFS[selectedItem].label} selected.`);
  } else {
    showToast('Item deselected.');
  }
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

function renderMapProps(scene) {
  sceneProps.replaceChildren();
  if (scene.id !== 'map') return;
  for (const id of ['compass', 'flashlight']) {
    if (!collected.has(id)) continue;
    const mask = document.createElement('span');
    mask.className = `scene-mask scene-mask-${id}`;
    mask.setAttribute('aria-hidden', 'true');
    sceneProps.appendChild(mask);
  }
}

function getSceneHotspots(scene) {
  if (scene.id !== 'map') return scene.hotspots || [];
  return (scene.hotspots || []).filter(spec => spec.action !== 'collect' || !collected.has(spec.item));
}

function collectItem(id) {
  const def = ITEM_DEFS[id];
  if (!def || collected.has(id)) return;
  collected.add(id);
  saveInventory();
  renderInventory();
  const scene = scenes[index];
  renderMapProps(scene);
  setHotspots(scene);
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

function setHotspots(scene) {
  hotspots.replaceChildren();
  for (const spec of getSceneHotspots(scene)) {
    const [left, top, width, height] = spec.area;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `hotspot hotspot-${spec.action}`;
    button.dataset.hotspotId = spec.id;
    button.setAttribute('aria-label', spec.label || 'Explore');
    Object.assign(button.style, {
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
      zIndex: String(spec.z || 1)
    });
    button.addEventListener('click', event => activateHotspot(spec, event));
    hotspots.appendChild(button);
  }
}

function render(i) {
  index = i;
  const scene = scenes[i];
  game.dataset.scene = scene.id;
  image.style.objectPosition = scene.pos || 'center center';
  image.style.transform = 'none';
  image.style.transformOrigin = 'center center';
  image.classList.toggle('map-detail-fallback', scene.id === 'map-detail');
  back.hidden = i === 0;
  renderMapProps(scene);
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
  try {
    await preload(next.src);
    image.classList.add('fade');
    setTimeout(() => {
      image.src = next.src;
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
    await preload(scenes[0].src);
    image.src = scenes[0].src;
    render(0);
    game.dataset.ready = 'true';
    loading.hidden = true;
    Promise.allSettled([...new Set(scenes.slice(1).map(scene => scene.src))].map(preload));
  } catch (err) {
    console.error(err);
    loading.hidden = true;
    showError('Initial scene failed to load.');
  }
}

boot();
