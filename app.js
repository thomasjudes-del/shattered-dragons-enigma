const VERSION = '181';
const SAVE_KEY = 'sde-save-v181';
const LEGACY_KEYS = ['sde-inventory-v2', 'sde-inventory-v1', 'sde-save-v176', 'sde-save-v180'];
const R2_BASE = 'https://shattered-dragons-enigma.thomas-judes.workers.dev/assets/shattered-dragons';

const MAP_SOURCES = {
  both: `${R2_BASE}/map/map-both.png`,
  flashlightOnly: `${R2_BASE}/map/map-flashlight-only.png`,
  compassOnly: `${R2_BASE}/map/map-compass-only.png`,
  none: `${R2_BASE}/map/map-none.png`
};
const MAP_DETAIL_SOURCE = `${R2_BASE}/map/map-detail.png`;

const ITEM_DEFS = {
  compass: {
    label: 'Compass',
    icon: `${R2_BASE}/items/compass.png`,
    description: 'A field compass. Reliable enough to trust when electronics are not.'
  },
  flashlight: {
    label: 'Flashlight',
    icon: `${R2_BASE}/items/flashlight.png`,
    description: 'A rugged expedition flashlight. Useful only where daylight cannot reach.'
  },
  saw: {
    label: 'Pruning saw',
    icon: `${R2_BASE}/items/saw.png`,
    description: 'A compact pruning saw from the expedition gear crate.'
  },
  crank: {
    label: 'Winch crank',
    icon: `${R2_BASE}/items/crank.png`,
    description: 'The detachable square-drive handle from the old survey winch.'
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
    mechanismInspected: false,
    entranceOpened: false,
    flashlightActive: false,
    machineInspected: false,
    powerRestored: false,
    anomalyDetected: false
  }
};

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
    fresh.history = Array.isArray(raw.history) ? raw.history.filter(id => typeof id === 'string').slice(-30) : [];
    fresh.inventory = Array.isArray(raw.inventory) ? raw.inventory.filter(id => ITEM_DEFS[id]).slice(0, 5) : [];
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
let circuitState = [0, 0, 0];
const cache = new Map();

const SCENES = {
  camp: {
    id: 'camp',
    src: `./assets/scenes/camp-hd.avif?v=${VERSION}`,
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
  return true;
}

function removeItem(id) {
  state.inventory = state.inventory.filter(item => item !== id);
  if (selectedItem === id) selectedItem = null;
  saveState();
  renderInventory();
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

function showToast(message, duration = 2200) {
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

function openModal(html, { ending = false } = {}) {
  modalContent.innerHTML = html;
  modalLayer.hidden = false;
  modalLayer.classList.toggle('ending', ending);
  modalLayer.setAttribute('aria-hidden', 'false');
  closeInventory();
}

function closeModal() {
  modalLayer.hidden = true;
  modalLayer.classList.remove('ending');
  modalLayer.setAttribute('aria-hidden', 'true');
  modalContent.replaceChildren();
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
    selectedItemLabel.textContent = selectedItem ? `USING: ${ITEM_DEFS[selectedItem].label.toUpperCase()}` : '';
  }
}

function selectInventoryItem(id) {
  if (!id || !hasItem(id)) return;
  selectedItem = selectedItem === id ? null : id;
  renderInventory();
  if (selectedItem) {
    showToast(`${ITEM_DEFS[selectedItem].label} selected.`);
    setTimeout(closeInventory, 120);
  } else {
    showToast('Item deselected.');
  }
}

function currentHint() {
  const f = state.flags;
  switch (state.sceneId) {
    case 'camp':
      if (f.mechanismInspected && !hasItem('crank') && !f.entranceOpened) return 'The entrance needs a square-drive handle. Check the expedition gear cases.';
      if (!f.mapExamined) return 'The field table holds the route information you need.';
      if (!hasItem('compass')) return 'The compass is on the field table.';
      if (!f.routeAligned) return 'Select the compass, then tap the jungle route at the upper left.';
      return 'The route is already aligned. Tap the jungle route at the upper left.';
    case 'map':
      if (!f.mapExamined) return 'Inspect the map closely, especially the red X.';
      return 'Take the compass and flashlight if you have not already, then return to camp.';
    case 'map-detail':
      return f.mapExamined ? 'Bearing recorded. Go back to camp.' : 'Tap the red X to record the marked approach.';
    case 'entrance':
      if (!f.entranceCleared) return 'Roots block the mechanism. Select the pruning saw, then tap the blocked entrance.';
      if (!f.mechanismInspected) return 'Tap the exposed mechanism.';
      if (!hasItem('crank') && !f.entranceOpened) return 'The handle is missing. Go back to camp and search the expedition gear cases.';
      if (!f.entranceOpened) return 'Select the winch crank, then tap the mechanism.';
      return 'The passage is open. Tap the doorway.';
    case 'lab':
      if (!f.powerRestored && !f.flashlightActive) return 'Select the flashlight, then tap the dark scene.';
      if (!f.powerRestored && !f.machineInspected) return 'Inspect the central machinery.';
      if (!f.powerRestored) return 'Use the LOW / HIGH / LOW pattern at the control panel.';
      if (!f.anomalyDetected) return 'Select the compass, then inspect the western wall.';
      return 'The compass is pointing through solid concrete.';
    default:
      return 'Observe the environment and use the tools you have collected.';
  }
}

function sceneHotspots(scene) {
  const f = state.flags;
  if (scene.id === 'camp') {
    const list = [
      { id: 'camp-table', action: 'goto', target: 'map', area: [0, 43, 54, 25], label: 'Examine the field table', z: 3 },
      { id: 'camp-gear', action: 'gear', area: [62, 59, 34, 26], label: 'Search the expedition gear cases', z: 4 }
    ];
    if (f.mapExamined) {
      list.push({ id: 'camp-route', action: 'route', area: [0, 10, 43, 34], label: 'Follow the marked jungle route', z: 5 });
    }
    return list;
  }
  if (scene.id === 'map') {
    return [
      { id: 'map-paper', action: 'goto', target: 'map-detail', area: [20, 42, 68, 38], label: 'Examine the map', z: 2 },
      ...(!hasItem('compass') ? [{ id: 'compass', action: 'collect', item: 'compass', area: [1, 65, 27, 19], label: 'Take the compass', z: 5 }] : []),
      ...(!hasItem('flashlight') ? [{ id: 'flashlight', action: 'collect', item: 'flashlight', area: [0, 78, 43, 18], label: 'Take the flashlight', z: 5 }] : [])
    ];
  }
  if (scene.id === 'map-detail') {
    return [{ id: 'route-mark', action: 'mark-route', area: [49, 42, 12, 14], label: 'Study the red X and marked approach', z: 3 }];
  }
  if (scene.id === 'entrance') {
    if (!f.entranceCleared) {
      return [{ id: 'entrance-roots', action: 'clear-roots', area: [18, 25, 66, 60], label: 'Examine the roots blocking the entrance', z: 3 }];
    }
    if (!f.mechanismInspected) {
      return [{ id: 'entrance-mechanism', action: 'inspect-mechanism', area: [31, 34, 38, 45], label: 'Examine the exposed mechanism', z: 3 }];
    }
    if (!f.entranceOpened) {
      return [{ id: 'entrance-mechanism-use', action: 'open-entrance', area: [31, 34, 38, 45], label: 'Use the exposed mechanism', z: 3 }];
    }
    return [{ id: 'entrance-open', action: 'goto', target: 'lab', area: [31, 30, 38, 53], label: 'Enter the buried structure', z: 3 }];
  }
  if (scene.id === 'lab') {
    if (!f.powerRestored && !f.flashlightActive) {
      return [{ id: 'lab-dark', action: 'use-flashlight', area: [0, 0, 100, 100], label: 'Explore the darkness', z: 1 }];
    }
    if (!f.powerRestored) {
      return [
        { id: 'lab-machine', action: 'inspect-machine', area: [25, 20, 48, 49], label: 'Inspect the central machinery', z: 3 },
        { id: 'lab-panel', action: 'open-panel', area: [70, 50, 29, 38], label: 'Inspect the emergency control panel', z: 4 }
      ];
    }
    return [
      { id: 'lab-wall', action: 'detect-anomaly', area: [0, 8, 34, 76], label: 'Examine the western wall', z: 4 },
      { id: 'lab-machine-powered', action: 'inspect-powered-machine', area: [28, 18, 48, 52], label: 'Inspect the powered machinery', z: 3 }
    ];
  }
  return [];
}

function renderSceneProps(scene) {
  sceneProps.replaceChildren();
  if (scene.id === 'entrance' && !state.flags.entranceOpened) {
    const gate = document.createElement('span');
    gate.className = `entrance-gate${state.flags.entranceCleared ? ' cleared' : ''}`;
    gate.setAttribute('aria-hidden', 'true');
    sceneProps.appendChild(gate);
  }
  if (scene.id === 'lab' && !state.flags.powerRestored) {
    const darkness = document.createElement('span');
    darkness.className = `lab-darkness${state.flags.flashlightActive ? ' flashlight-on' : ''}`;
    darkness.setAttribute('aria-hidden', 'true');
    sceneProps.appendChild(darkness);
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

function refreshCurrentScene() {
  const scene = SCENES[state.sceneId];
  if (!scene) return;
  if (scene.id === 'map') image.src = currentMapSource();
  renderSceneProps(scene);
  setHotspots(scene);
  back.hidden = state.history.length === 0;
}

function collectItem(id) {
  const def = ITEM_DEFS[id];
  if (!def || hasItem(id)) return;
  if (!addItem(id)) {
    showToast('The satchel is full.');
    return;
  }
  if (state.sceneId === 'map') image.src = currentMapSource();
  refreshCurrentScene();
  showToast(`${def.label} added to satchel.`);
}

function handleGearSearch() {
  if (!hasItem('saw')) {
    collectItem('saw');
    return;
  }
  if (state.flags.mechanismInspected && !state.flags.entranceOpened && !hasItem('crank')) {
    collectItem('crank');
    showToast('The survey winch handle detaches. Its square drive matches the entrance mechanism.', 3000);
    return;
  }
  if (!state.flags.mechanismInspected) {
    showToast('Nothing else in the gear case looks immediately useful.');
    return;
  }
  showToast('The useful expedition hardware is already packed.');
}

function handleRoute() {
  if (!state.flags.mapExamined) {
    showToast('You do not know which route to follow yet.');
    return;
  }
  if (state.flags.routeAligned) {
    goTo('entrance');
    return;
  }
  if (!hasItem('compass')) {
    showToast('The map gives a bearing, but you left the compass behind.');
    return;
  }
  if (selectedItem !== 'compass') {
    showToast('The route is marked 042° NE. Open the satchel and select the compass.');
    return;
  }
  state.flags.routeAligned = true;
  selectedItem = null;
  saveState();
  renderInventory();
  showToast('Bearing aligned: 042° NE. The correct path is clear.');
  setTimeout(() => goTo('entrance'), 520);
}

function handleClearRoots() {
  if (!hasItem('saw')) {
    showToast('Thick roots are wrapped around the mechanism. You need a cutting tool.');
    return;
  }
  if (selectedItem !== 'saw') {
    showToast('Open the satchel, select the pruning saw, then tap the blocked entrance.');
    return;
  }
  state.flags.entranceCleared = true;
  selectedItem = null;
  saveState();
  renderInventory();
  refreshCurrentScene();
  showToast('The roots give way. A corroded square-drive mechanism is exposed.', 3000);
}

function handleInspectMechanism() {
  state.flags.mechanismInspected = true;
  saveState();
  refreshCurrentScene();
  showToast('The mechanism is intact, but its removable crank is missing.', 3000);
}

function handleOpenEntrance() {
  if (!hasItem('crank')) {
    showToast('The square drive needs a removable handle. Something at camp may fit.');
    return;
  }
  if (selectedItem !== 'crank') {
    showToast('Open the satchel, select the winch crank, then tap the mechanism.');
    return;
  }
  state.flags.entranceOpened = true;
  removeItem('crank');
  saveState();
  refreshCurrentScene();
  showToast('The old drive turns. Metal shifts behind the wall and the passage unlocks.', 3200);
}

function handleFlashlight() {
  if (!hasItem('flashlight')) {
    showToast('You cannot see enough to move safely. The flashlight is still back at the field table.');
    return;
  }
  if (selectedItem !== 'flashlight') {
    showToast('Open the satchel, select the flashlight, then tap the darkness.');
    return;
  }
  state.flags.flashlightActive = true;
  selectedItem = null;
  saveState();
  renderInventory();
  refreshCurrentScene();
  showToast('The beam catches pipes, old cabling and a control cabinet to the right.');
}

function handleInspectMachine() {
  state.flags.machineInspected = true;
  saveState();
  openModal(`
    <p class="eyebrow">SERVICE MACHINERY</p>
    <h2>Three mechanical pressure columns</h2>
    <p>The glass indicators are dead, but their physical stops remain readable.</p>
    <div class="clue-strip">
      <span>LEFT<br><b>LOW</b></span>
      <span>CENTER<br><b>HIGH</b></span>
      <span>RIGHT<br><b>LOW</b></span>
    </div>
    <p class="modal-note">A faded plate links these columns to the emergency bus selectors.</p>
  `);
  refreshCurrentScene();
}

function circuitLabel(value) {
  return ['OFF', 'LOW', 'HIGH'][value];
}

function renderCircuitPuzzle() {
  modalContent.innerHTML = `
    <p class="eyebrow">EMERGENCY BUS</p>
    <h2>Manual selector bank</h2>
    <p>Each selector cycles through OFF, LOW and HIGH.</p>
    <div class="circuit-grid">
      ${circuitState.map((value, i) => `
        <button class="circuit-switch" type="button" data-circuit="${i}" aria-label="Selector ${i + 1}: ${circuitLabel(value)}">
          <small>${['LEFT', 'CENTER', 'RIGHT'][i]}</small>
          <strong>${circuitLabel(value)}</strong>
        </button>
      `).join('')}
    </div>
    <button id="applyCircuit" class="modal-action" type="button">APPLY POWER</button>
    <p id="circuitFeedback" class="modal-feedback">${state.flags.machineInspected ? 'The machinery clue may be relevant here.' : 'You have not found a reliable setting clue yet.'}</p>
  `;
  modalContent.querySelectorAll('.circuit-switch').forEach(button => {
    button.addEventListener('click', () => {
      const i = Number(button.dataset.circuit);
      circuitState[i] = (circuitState[i] + 1) % 3;
      renderCircuitPuzzle();
    });
  });
  modalContent.querySelector('#applyCircuit').addEventListener('click', applyCircuitPuzzle);
}

function openCircuitPuzzle() {
  circuitState = [0, 0, 0];
  modalLayer.hidden = false;
  modalLayer.classList.remove('ending');
  modalLayer.setAttribute('aria-hidden', 'false');
  closeInventory();
  renderCircuitPuzzle();
}

function applyCircuitPuzzle() {
  const solved = circuitState[0] === 1 && circuitState[1] === 2 && circuitState[2] === 1;
  if (!solved) {
    const feedback = modalContent.querySelector('#circuitFeedback');
    if (feedback) feedback.textContent = state.flags.machineInspected
      ? 'The selector pattern does not match the physical pressure stops.'
      : 'The system rejects the configuration.';
    return;
  }
  state.flags.powerRestored = true;
  state.flags.flashlightActive = false;
  saveState();
  closeModal();
  refreshCurrentScene();
  showToast('Emergency power restored. The room answers with a low electrical hum.', 3200);
}

function handleDetectAnomaly() {
  if (!state.flags.powerRestored) {
    showToast('The facility is still dead.');
    return;
  }
  if (!hasItem('compass')) {
    showToast('You need an independent orientation reference.');
    return;
  }
  if (selectedItem !== 'compass') {
    showToast('Open the satchel, select the compass, then tap the western wall.');
    return;
  }
  state.flags.anomalyDetected = true;
  selectedItem = null;
  saveState();
  renderInventory();
  refreshCurrentScene();
  setTimeout(() => {
    openModal(`
      <p class="eyebrow">PROLOGUE COMPLETE</p>
      <h2>The needle points through solid concrete.</h2>
      <p>For a moment the compass ignores north completely. It locks onto the western wall while the powered machinery answers with a low pulse.</p>
      <p>There is something behind the structure that does not appear on any survey plan.</p>
      <p class="ending-line">And this facility was built around it.</p>
    `, { ending: true });
  }, 500);
}

function activateHotspot(spec, event) {
  event.stopPropagation();
  echo(event.clientX, event.clientY);
  switch (spec.action) {
    case 'goto': goTo(spec.target); break;
    case 'gear': handleGearSearch(); break;
    case 'route': handleRoute(); break;
    case 'collect': collectItem(spec.item); break;
    case 'mark-route':
      state.flags.mapExamined = true;
      saveState();
      showToast('Marked approach recorded: 042° NE from camp.', 2600);
      refreshCurrentScene();
      break;
    case 'clear-roots': handleClearRoots(); break;
    case 'inspect-mechanism': handleInspectMechanism(); break;
    case 'open-entrance': handleOpenEntrance(); break;
    case 'use-flashlight': handleFlashlight(); break;
    case 'inspect-machine': handleInspectMachine(); break;
    case 'open-panel': openCircuitPuzzle(); break;
    case 'detect-anomaly': handleDetectAnomaly(); break;
    case 'inspect-powered-machine':
      showToast('Emergency power is stable. The strongest vibration seems to come from the western wall.');
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
  if (!event.target.closest('button') && !event.target.closest('.modal-card')) echo(event.clientX, event.clientY);
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
      MAP_DETAIL_SOURCE,
      ...Object.values(ITEM_DEFS).map(item => item.icon)
    ])];
    Promise.allSettled(sources.map(preload));
    if (state.flags.anomalyDetected && state.sceneId === 'lab') {
      setTimeout(() => showToast('The compass is still pointing through the western wall.', 2800), 600);
    }
  } catch (err) {
    console.error(err);
    loading.hidden = true;
    showError('Initial scene failed to load.');
  }
}

boot();
