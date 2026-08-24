const VERSION = '185';
const SAVE_KEY = 'sde-save-v185';
const LEGACY_KEYS = [
  'sde-inventory-v2',
  'sde-inventory-v1',
  'sde-save-v176',
  'sde-save-v180',
  'sde-save-v181',
  'sde-save-v183',
  'sde-save-v184'
];

const R2_BASE = 'https://shattered-dragons-enigma.thomas-judes.workers.dev/assets/shattered-dragons';

const MAP_SOURCES = {
  both: `${R2_BASE}/map/map-both.png`,
  flashlightOnly: `${R2_BASE}/map/map-flashlight-only.png`,
  compassOnly: `${R2_BASE}/map/map-compass-only.png`,
  none: `${R2_BASE}/map/map-none.png`
};

const CAMP_SOURCE = `${R2_BASE}/scenes/camp-hidden-v185.png`;
const MAP_DETAIL_SOURCE = `${R2_BASE}/map/map-detail.png`;
const ENTRANCE_HIDDEN_SOURCE = `${R2_BASE}/scenes/entrance-hidden-v184.png`;
const TUNNEL_DARK_SOURCE = `${R2_BASE}/scenes/tunnel-dark-v183.png`;
const SERVICE_ROOM_SOURCE = `${R2_BASE}/scenes/service-room-v184.png`;
const PRESSURE_BANK_SOURCE = `${R2_BASE}/puzzles/pressure-bank-v184.png`;
const PUMP_REGULATOR_SOURCE = `${R2_BASE}/puzzles/pump-regulator-v185.png`;

const ITEM_DEFS = {
  compass: {
    label: 'Compass',
    icon: `${R2_BASE}/items/compass-v182.png`,
    description: 'A field compass. Mechanical, old-fashioned and independent of GPS.'
  },
  flashlight: {
    label: 'Flashlight',
    icon: `${R2_BASE}/items/flashlight-v182.png`,
    description: 'A rugged expedition flashlight.'
  },
  saw: {
    label: 'Pruning saw',
    icon: `${R2_BASE}/items/saw-v182.png`,
    description: 'A compact folding pruning saw.'
  }
};

const DEFAULT_STATE = {
  version: VERSION,
  sceneId: 'camp',
  history: [],
  inventory: [],
  flags: {
    mapExamined: false,
    routeAligned: false,
    entranceCleared: false,
    flashlightActive: false,
    pressureBankSeen: false,
    powerRestored: false,
    anomalyDetected: false
  }
};

// Pressure-bank clue: circle = 2, triangle = 1, diamond = 3.
// Regulator controls deliberately present the symbols in another order.
const PANEL_CONTROLS = [
  { symbol: '△', x: 28.5 },
  { symbol: '◇', x: 50.0 },
  { symbol: '○', x: 71.5 }
];
const PANEL_SOLUTION = [1, 3, 2];
const LEVER_ANGLES = [-30, -15, 0, 15, 30];

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function applyRequestedReset() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('reset') !== '1') return;
  try {
    localStorage.removeItem(SAVE_KEY);
    LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
  } catch {}
  url.searchParams.delete('reset');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

applyRequestedReset();

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!raw || raw.version !== VERSION) return cloneDefaultState();
    const fresh = cloneDefaultState();
    fresh.sceneId = typeof raw.sceneId === 'string' ? raw.sceneId : fresh.sceneId;
    fresh.history = Array.isArray(raw.history)
      ? raw.history.filter(id => typeof id === 'string').slice(-30)
      : [];
    fresh.inventory = Array.isArray(raw.inventory)
      ? raw.inventory.filter(id => ITEM_DEFS[id]).slice(0, 5)
      : [];
    fresh.flags = { ...fresh.flags, ...(raw.flags || {}) };
    return fresh;
  } catch {
    return cloneDefaultState();
  }
}

let state = loadState();
let selectedItem = null;
let busy = false;
let toastTimer;
// Start visually near the photographed HIGH position.
let selectorState = [4, 4, 4];
const cache = new Map();

const SCENES = {
  camp: {
    id: 'camp',
    src: CAMP_SOURCE,
    pos: 'center center'
  },
  map: {
    id: 'map',
    src: MAP_SOURCES.both,
    pos: 'center center'
  },
  'map-detail': {
    id: 'map-detail',
    src: MAP_DETAIL_SOURCE,
    pos: 'center center'
  },
  entrance: {
    id: 'entrance',
    src: `./assets/scenes/entrance-hd.png?v=${VERSION}`,
    pos: 'center center'
  },
  tunnel: {
    id: 'tunnel',
    src: TUNNEL_DARK_SOURCE,
    pos: 'center center'
  },
  service: {
    id: 'service',
    src: SERVICE_ROOM_SOURCE,
    pos: 'center center'
  },
  lab: {
    id: 'lab',
    src: `./assets/scenes/lab-hd.png?v=${VERSION}`,
    pos: 'center center'
  }
};

if (!SCENES[state.sceneId]) state.sceneId = 'camp';
state.history = state.history.filter(id => SCENES[id]);

const game = document.getElementById('game');
const stage = document.querySelector('.stage');
const image = document.getElementById('scene');
const sceneProps = document.getElementById('sceneProps');
const hotspots = document.getElementById('hotspots');
const back = document.getElementById('back');
const hint = document.getElementById('hint');
const reset = document.getElementById('reset');
const satchel = document.getElementById('satchel');
const selectedItemLabel = document.getElementById('selectedItemLabel');
const inventory = document.getElementById('inventory');
const inventorySlots = [...inventory.querySelectorAll('.inventory-slot')];
const toast = document.getElementById('toast');
const echoes = document.getElementById('echoes');
const loading = document.getElementById('loading');
const errorBox = document.getElementById('errorBox');
const modalLayer = document.getElementById('modalLayer');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {}
}

function hasItem(id) {
  return state.inventory.includes(id);
}

function addItem(id) {
  if (!ITEM_DEFS[id] || hasItem(id) || state.inventory.length >= inventorySlots.length) return false;
  state.inventory.push(id);
  saveState();
  renderInventory();
  pulseSatchel();
  return true;
}

window.resetEnigma = function resetEnigma() {
  try {
    localStorage.removeItem(SAVE_KEY);
    LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
  } catch {}
  window.location.href = `./?v=${VERSION}&reset=1`;
};

function currentMapSource() {
  const compassPresent = !hasItem('compass');
  const flashlightPresent = !hasItem('flashlight');
  if (compassPresent && flashlightPresent) return MAP_SOURCES.both;
  if (!compassPresent && flashlightPresent) return MAP_SOURCES.flashlightOnly;
  if (compassPresent && !flashlightPresent) return MAP_SOURCES.compassOnly;
  return MAP_SOURCES.none;
}

function sceneSource(scene) {
  if (scene.id === 'map') return currentMapSource();
  if (scene.id === 'entrance' && !state.flags.entranceCleared) return ENTRANCE_HIDDEN_SOURCE;
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

function showToast(message, duration = 2600) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  setTimeout(() => { errorBox.hidden = true; }, 2600);
}

function pulseSatchel() {
  satchel.classList.remove('item-added');
  requestAnimationFrame(() => satchel.classList.add('item-added'));
  setTimeout(() => satchel.classList.remove('item-added'), 520);
}

function openModal(html, { ending = false, mode = '' } = {}) {
  modalContent.innerHTML = html;
  modalLayer.hidden = false;
  modalLayer.classList.remove('ending', 'photo-view', 'panel-view');
  if (ending) modalLayer.classList.add('ending');
  if (mode) modalLayer.classList.add(mode);
  modalLayer.setAttribute('aria-hidden', 'false');
  closeInventory();
}

function closeModal() {
  modalLayer.hidden = true;
  modalLayer.classList.remove('ending', 'photo-view', 'panel-view');
  modalLayer.setAttribute('aria-hidden', 'true');
  modalContent.replaceChildren();
}

function openPhotoInspect(src, alt) {
  openModal(`
    <div class="photo-inspect">
      <img class="photo-inspect-image" src="${src}" alt="${alt}">
    </div>
  `, { mode: 'photo-view' });
}

function showItemInfo(id) {
  const def = ITEM_DEFS[id];
  if (!def) return;
  openModal(`
    <div class="item-detail">
      <img src="${def.icon}" alt="">
      <div>
        <p class="eyebrow">INVENTORY</p>
        <h2>${def.label}</h2>
        <p>${def.description}</p>
      </div>
    </div>
  `);
}

function renderInventory() {
  inventorySlots.forEach((slot, i) => {
    const id = state.inventory[i];
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
    slot.classList.add('has-item');

    if (selectedItem === id) {
      slot.classList.add('selected');
      slot.setAttribute('aria-pressed', 'true');
    }

    slot.setAttribute('aria-label', `${def.label}${selectedItem === id ? ', selected' : ''}`);
    slot.title = def.label;

    const icon = document.createElement('img');
    icon.className = 'inventory-item-icon';
    icon.src = def.icon;
    icon.alt = '';
    icon.draggable = false;
    slot.appendChild(icon);
  });

  satchel.classList.toggle('has-selection', Boolean(selectedItem));

  if (selectedItemLabel) {
    selectedItemLabel.hidden = !selectedItem;
    selectedItemLabel.textContent = selectedItem
      ? `USING: ${ITEM_DEFS[selectedItem].label.toUpperCase()}`
      : '';
  }
}

function selectInventoryItem(id) {
  if (!id || !hasItem(id)) return;
  selectedItem = selectedItem === id ? null : id;
  renderInventory();
  setTimeout(closeInventory, 100);
}

function currentHint() {
  const f = state.flags;

  switch (state.sceneId) {
    case 'camp':
      if (!f.mapExamined) return 'The field table deserves a closer look.';
      if (!hasItem('compass')) return 'A bearing is only useful if you can orient it.';
      if (!f.routeAligned) return 'The map gave you a bearing. Try the compass on the jungle route.';
      return 'You already know which way the marked route lies.';

    case 'map':
      if (!f.mapExamined) return 'The red mark on the map is not random.';
      return 'Some of the gear on this table may matter later.';

    case 'map-detail':
      return f.mapExamined
        ? 'You have what you need from the map.'
        : 'Study the red mark and the approach drawn into it.';

    case 'entrance':
      return f.entranceCleared
        ? 'The concrete opening is usable now.'
        : 'The straight concrete edges continue behind the growth.';

    case 'tunnel':
      return f.flashlightActive
        ? 'The lit passage continues deeper.'
        : 'Daylight is gone now.';

    case 'service':
      if (!f.pressureBankSeen) return 'One of the old pressure assemblies is still readable.';
      if (!f.powerRestored) return 'Match the pressure readings by symbol. The regulator levers have five detents.';
      return 'Emergency power has opened the route deeper into the facility.';

    case 'lab':
      if (!f.anomalyDetected) return 'The compass is behaving strangely near the western side of the room.';
      return 'The compass is no longer pointing north.';

    default:
      return 'Look at the environment before trying another tool.';
  }
}

function sceneHotspots(scene) {
  const f = state.flags;

  if (scene.id === 'camp') {
    const list = [
      { id: 'camp-table', action: 'goto', target: 'map', area: [0, 44, 55, 23], label: 'Examine the field table', z: 3 },
      { id: 'camp-gear', action: 'gear', area: [62, 56, 35, 28], label: 'Search the expedition gear cases', z: 4 }
    ];
    if (f.mapExamined) {
      list.push({ id: 'camp-route', action: 'route', area: [0, 12, 42, 34], label: 'Follow the jungle route', z: 5 });
    }
    return list;
  }

  if (scene.id === 'map') {
    return [
      { id: 'map-paper', action: 'goto', target: 'map-detail', area: [20, 42, 68, 38], label: 'Examine the map', z: 2 },
      ...(!hasItem('compass')
        ? [{ id: 'compass', action: 'collect', item: 'compass', area: [1, 65, 27, 19], label: 'Take the compass', z: 5 }]
        : []),
      ...(!hasItem('flashlight')
        ? [{ id: 'flashlight', action: 'collect', item: 'flashlight', area: [0, 78, 43, 18], label: 'Take the flashlight', z: 5 }]
        : [])
    ];
  }

  if (scene.id === 'map-detail') {
    return [
      { id: 'route-mark', action: 'mark-route', area: [49, 42, 12, 14], label: 'Study the marked approach', z: 3 }
    ];
  }

  if (scene.id === 'entrance') {
    if (!f.entranceCleared) {
      return [
        { id: 'entrance-growth', action: 'clear-roots', area: [31, 30, 42, 47], label: 'Examine the overgrown concrete opening', z: 3 }
      ];
    }
    return [
      { id: 'entrance-open', action: 'goto', target: 'tunnel', area: [29, 30, 43, 52], label: 'Enter the structure', z: 3 }
    ];
  }

  if (scene.id === 'tunnel') {
    if (!f.flashlightActive) {
      return [
        { id: 'tunnel-dark', action: 'use-flashlight', area: [0, 0, 100, 100], label: 'Explore the darkness', z: 1 }
      ];
    }
    return [
      { id: 'tunnel-forward', action: 'goto', target: 'service', area: [27, 20, 46, 65], label: 'Continue down the passage', z: 3 }
    ];
  }

  if (scene.id === 'service') {
    const list = [
      { id: 'service-pressure', action: 'inspect-pressure', area: [67, 58, 31, 29], label: 'Inspect the pressure assembly', z: 4 },
      { id: 'service-regulator', action: 'open-panel', area: [39, 27, 39, 40], label: 'Inspect the regulator panel', z: 5 }
    ];
    if (f.powerRestored) {
      list.push({ id: 'service-deeper', action: 'goto', target: 'lab', area: [0, 30, 31, 48], label: 'Continue deeper into the facility', z: 6 });
    }
    return list;
  }

  if (scene.id === 'lab') {
    return [
      { id: 'lab-wall', action: 'detect-anomaly', area: [0, 8, 36, 76], label: 'Examine the western wall', z: 4 }
    ];
  }

  return [];
}

function renderSceneProps(scene) {
  sceneProps.replaceChildren();

  if (scene.id === 'tunnel') {
    const darkness = document.createElement('span');
    darkness.className = `tunnel-darkness${state.flags.flashlightActive ? ' flashlight-on' : ''}`;
    darkness.setAttribute('aria-hidden', 'true');
    sceneProps.appendChild(darkness);
  }

  if (scene.id === 'service' && !state.flags.powerRestored) {
    const dim = document.createElement('span');
    dim.className = 'service-power-off';
    dim.setAttribute('aria-hidden', 'true');
    sceneProps.appendChild(dim);
  }

  if (scene.id === 'service' && state.flags.powerRestored) {
    const glow = document.createElement('span');
    glow.className = 'service-power-glow';
    glow.setAttribute('aria-hidden', 'true');
    sceneProps.appendChild(glow);
  }

  if (scene.id === 'lab' && state.flags.anomalyDetected) {
    const pulse = document.createElement('span');
    pulse.className = 'anomaly-pulse';
    pulse.setAttribute('aria-hidden', 'true');
    sceneProps.appendChild(pulse);
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

  for (const spec of sceneHotspots(scene)) {
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

function refreshCurrentScene({ swapImage = false } = {}) {
  const scene = SCENES[state.sceneId];
  if (!scene) return;
  if (swapImage || scene.id === 'map') image.src = sceneSource(scene);
  renderSceneProps(scene);
  setHotspots(scene);
  back.hidden = state.history.length === 0;
}

function collectItem(id) {
  const def = ITEM_DEFS[id];
  if (!def || hasItem(id)) return;
  if (!addItem(id)) return;
  if (state.sceneId === 'map') image.src = currentMapSource();
  refreshCurrentScene();
  showToast(`${def.label} added to satchel.`);
}

function handleGearSearch() {
  if (!hasItem('saw')) collectItem('saw');
}

function handleRoute() {
  if (!state.flags.mapExamined) return;

  if (state.flags.routeAligned) {
    goTo('entrance');
    return;
  }

  if (!hasItem('compass') || selectedItem !== 'compass') return;

  state.flags.routeAligned = true;
  selectedItem = null;
  saveState();
  renderInventory();
  showToast('The compass settles on the marked bearing.');
  setTimeout(() => goTo('entrance'), 520);
}

async function handleClearRoots() {
  if (!hasItem('saw') || selectedItem !== 'saw') return;

  state.flags.entranceCleared = true;
  selectedItem = null;
  saveState();
  renderInventory();

  const src = sceneSource(SCENES.entrance);

  try {
    await preload(src);
    image.classList.add('fade');
    setTimeout(() => {
      image.src = src;
      renderScene(SCENES.entrance);
      requestAnimationFrame(() => image.classList.remove('fade'));
      showToast('The cut vines expose a recessed concrete doorway.');
    }, 90);
  } catch {
    showError('Scene failed to load.');
  }
}

function handleFlashlight() {
  if (!hasItem('flashlight') || selectedItem !== 'flashlight') return;

  state.flags.flashlightActive = true;
  selectedItem = null;
  saveState();
  renderInventory();
  refreshCurrentScene();
  showToast('The beam picks out a service corridor ahead.');
}

function handleInspectPressureBank() {
  state.flags.pressureBankSeen = true;
  saveState();
  openPhotoInspect(PRESSURE_BANK_SOURCE, 'Old pump pressure bank with three analog gauges and etched symbols');
}

function leverMarkup(control, i) {
  const value = selectorState[i];
  const angle = LEVER_ANGLES[value];
  return `
    <span class="pump-symbol-plaque" style="--x:${control.x}%">${control.symbol}</span>
    <button class="pump-lever-control" type="button" data-selector="${i}" style="--x:${control.x}%;--angle:${angle}deg" aria-label="Regulator ${control.symbol}, detent ${value}">
      <span class="pump-lever-mask"></span>
      <span class="pump-lever-arm"></span>
      <span class="pump-lever-pivot"></span>
      <span class="pump-detents" aria-hidden="true">
        <i>0</i><i>1</i><i>2</i><i>3</i><i>4</i>
      </span>
    </button>
  `;
}

function renderSelectorPuzzle() {
  modalContent.innerHTML = `
    <div id="pumpPanelWrap" class="pump-panel-wrap">
      <img class="pump-panel-photo" src="${PUMP_REGULATOR_SOURCE}" alt="Corroded pump regulation unit with three mechanical levers">
      ${PANEL_CONTROLS.map(leverMarkup).join('')}
      <button id="engagePanel" class="pump-engage-target" type="button" aria-label="Engage pump regulator"></button>
    </div>
  `;

  modalContent.querySelectorAll('.pump-lever-control').forEach(button => {
    button.addEventListener('click', () => {
      const i = Number(button.dataset.selector);
      selectorState[i] = (selectorState[i] + 1) % 5;
      renderSelectorPuzzle();
    });
  });

  modalContent.querySelector('#engagePanel').addEventListener('click', applySelectorPuzzle);
}

function openSelectorPuzzle() {
  if (state.flags.powerRestored) {
    openPhotoInspect(PUMP_REGULATOR_SOURCE, 'Powered pump pressure regulator');
    return;
  }

  modalLayer.hidden = false;
  modalLayer.classList.remove('ending', 'photo-view');
  modalLayer.classList.add('panel-view');
  modalLayer.setAttribute('aria-hidden', 'false');
  closeInventory();
  renderSelectorPuzzle();
}

function applySelectorPuzzle() {
  const solved = selectorState.every((value, i) => value === PANEL_SOLUTION[i]);

  if (!solved) {
    const wrap = modalContent.querySelector('#pumpPanelWrap');
    if (wrap) {
      wrap.classList.remove('rejected');
      requestAnimationFrame(() => wrap.classList.add('rejected'));
      setTimeout(() => wrap.classList.remove('rejected'), 460);
    }
    return;
  }

  state.flags.powerRestored = true;
  saveState();
  closeModal();
  refreshCurrentScene();
  showToast('A relay snaps shut. Emergency power returns.');
}

function handleDetectAnomaly() {
  if (!state.flags.powerRestored || !hasItem('compass') || selectedItem !== 'compass') return;

  state.flags.anomalyDetected = true;
  selectedItem = null;
  saveState();
  renderInventory();
  refreshCurrentScene();

  setTimeout(() => {
    openModal(`
      <p class="eyebrow">PROLOGUE COMPLETE</p>
      <h2>The needle points through solid concrete.</h2>
      <p>For a moment the compass ignores north completely. It locks onto the western wall while the machinery answers with a low pulse.</p>
      <p>There is something behind the structure that does not appear on any survey plan.</p>
      <p class="ending-line">And this facility was built around it.</p>
    `, { ending: true });
  }, 450);
}

function activateHotspot(spec, event) {
  event.stopPropagation();
  echo(event.clientX, event.clientY);

  switch (spec.action) {
    case 'goto':
      goTo(spec.target);
      break;

    case 'gear':
      handleGearSearch();
      break;

    case 'route':
      handleRoute();
      break;

    case 'collect':
      collectItem(spec.item);
      break;

    case 'mark-route':
      state.flags.mapExamined = true;
      saveState();
      refreshCurrentScene();
      showToast('Bearing noted: 042° NE.');
      break;

    case 'clear-roots':
      handleClearRoots();
      break;

    case 'use-flashlight':
      handleFlashlight();
      break;

    case 'inspect-pressure':
      handleInspectPressureBank();
      break;

    case 'open-panel':
      openSelectorPuzzle();
      break;

    case 'detect-anomaly':
      handleDetectAnomaly();
      break;
  }
}

function renderScene(scene) {
  game.dataset.scene = scene.id;
  image.style.objectPosition = scene.pos || 'center center';
  image.style.objectFit = scene.id === 'map-detail' ? 'contain' : 'cover';
  image.style.background = scene.id === 'map-detail' ? '#080603' : '#000';
  image.classList.toggle('anomaly-active', scene.id === 'lab' && state.flags.anomalyDetected);
  renderSceneProps(scene);
  setHotspots(scene);
  back.hidden = state.history.length === 0;
}

async function goTo(sceneId, { record = true } = {}) {
  const next = SCENES[sceneId];
  if (!next || busy || sceneId === state.sceneId) return;

  busy = true;
  closeInventory();
  closeModal();

  const src = sceneSource(next);

  try {
    await preload(src);

    if (record) {
      const current = state.sceneId;
      if (current && current !== sceneId && state.history[state.history.length - 1] !== current) {
        state.history.push(current);
        state.history = state.history.slice(-30);
      }
    }

    state.sceneId = sceneId;
    saveState();

    image.classList.add('fade');
    setTimeout(() => {
      image.src = src;
      renderScene(next);
      requestAnimationFrame(() => image.classList.remove('fade'));
      busy = false;
    }, 90);
  } catch (err) {
    console.error(err);
    busy = false;
    showError('Scene failed to load.');
  }
}

async function goBack() {
  if (busy) return;

  if (!modalLayer.hidden) {
    closeModal();
    return;
  }

  const target = state.history.pop();

  if (!target || !SCENES[target]) {
    back.hidden = true;
    saveState();
    return;
  }

  const next = SCENES[target];
  const src = sceneSource(next);
  busy = true;
  closeInventory();

  try {
    await preload(src);
    state.sceneId = target;
    saveState();

    image.classList.add('fade');
    setTimeout(() => {
      image.src = src;
      renderScene(next);
      requestAnimationFrame(() => image.classList.remove('fade'));
      busy = false;
    }, 90);
  } catch (err) {
    console.error(err);
    busy = false;
    showError('Scene failed to load.');
  }
}

function toggleInventory() {
  const open = !inventory.classList.contains('open');
  inventory.classList.toggle('open', open);
  inventory.setAttribute('aria-hidden', String(!open));
  satchel.setAttribute('aria-expanded', String(open));
}

function closeInventory() {
  inventory.classList.remove('open');
  inventory.setAttribute('aria-hidden', 'true');
  satchel.setAttribute('aria-expanded', 'false');
}

function echo(x, y) {
  const ring = document.createElement('span');
  ring.className = 'echo';
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  echoes.appendChild(ring);
  setTimeout(() => ring.remove(), 460);
}

back.addEventListener('click', goBack);
hint.addEventListener('click', () => showToast(currentHint(), 3000));
reset.addEventListener('click', window.resetEnigma);
satchel.addEventListener('click', toggleInventory);
modalClose.addEventListener('click', closeModal);

modalLayer.addEventListener('click', event => {
  if (event.target === modalLayer && !modalLayer.classList.contains('ending')) closeModal();
});

inventorySlots.forEach(slot => {
  slot.addEventListener('click', () => selectInventoryItem(slot.dataset.itemId));
  slot.addEventListener('dblclick', () => showItemInfo(slot.dataset.itemId));
});

window.addEventListener('resize', () => setHotspots(SCENES[state.sceneId]));

document.addEventListener('pointerdown', event => {
  if (!event.target.closest('button') && !event.target.closest('.modal-card')) {
    echo(event.clientX, event.clientY);
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') goBack();
  if (event.key === 'Escape') {
    if (!modalLayer.hidden) closeModal();
    else closeInventory();
  }
});

async function boot() {
  renderInventory();

  const scene = SCENES[state.sceneId];
  const firstSrc = sceneSource(scene);

  try {
    await preload(firstSrc);
    image.src = firstSrc;
    renderScene(scene);
    game.dataset.ready = 'true';
    loading.hidden = true;

    const sources = [...new Set([
      ...Object.values(SCENES).map(sceneSource),
      ...Object.values(MAP_SOURCES),
      CAMP_SOURCE,
      MAP_DETAIL_SOURCE,
      ENTRANCE_HIDDEN_SOURCE,
      TUNNEL_DARK_SOURCE,
      SERVICE_ROOM_SOURCE,
      PRESSURE_BANK_SOURCE,
      PUMP_REGULATOR_SOURCE,
      ...Object.values(ITEM_DEFS).map(item => item.icon)
    ])];

    Promise.allSettled(sources.map(preload));
  } catch (err) {
    console.error(err);
    loading.hidden = true;
    showError('Initial scene failed to load.');
  }
}

boot();
