const scenes = [
  {
    id:'camp',
    src:'./assets/scenes/camp-hd.avif?v=167',
    pos:'center center',
    hint:'The biodiversity survey camp is the last normal place on the route.',
    hotspots:[
      { id:'camp-next', action:'goto', target:'team', area:[52,18,38,70], label:'Follow the expedition route' }
    ]
  },
  {
    id:'team',
    src:'./assets/scenes/team-hd.png?v=167',
    pos:'center center',
    hint:'The team found a route that should not be here.',
    hotspots:[
      { id:'team-next', action:'goto', target:'map', area:[34,18,36,68], label:'Examine the field table' }
    ]
  },
  {
    id:'map',
    src:'./assets/scenes/map-table-base-hd.avif?v=167',
    pos:'center center',
    hint:'The map, flashlight and compass can each be used separately.',
    hotspots:[
      { id:'map-paper', action:'goto', target:'map-detail', area:[27,43,66,41], label:'Examine the map', z:2 },
      { id:'flashlight', action:'collect', item:'flashlight', asset:'./assets/items/flashlight.webp?v=167', area:[0,73,40,18], label:'Take the flashlight', z:4 },
      { id:'compass', action:'collect', item:'compass', asset:'./assets/items/compass.webp?v=167', area:[2,64,25,15], label:'Take the compass', z:4 }
    ]
  },
  {
    id:'map-detail',
    src:'./assets/scenes/map-detail-hd.avif?v=167',
    pos:'center center',
    hint:'The red X marks the route beyond the biodiversity survey area.',
    hotspots:[
      { id:'route-mark', action:'goto', target:'entrance', area:[55,47,18,14], label:'Follow the marked route' }
    ]
  },
  {
    id:'entrance',
    src:'./assets/scenes/entrance-hd.png?v=167',
    pos:'center center',
    hint:'The buried entrance is the only obvious way forward.',
    hotspots:[
      { id:'entrance-next', action:'goto', target:'lab', area:[34,30,34,50], label:'Enter the buried structure' }
    ]
  },
  {
    id:'lab',
    src:'./assets/scenes/lab-hd.png?v=167',
    pos:'center center',
    hint:'End of the navigation V0.',
    hotspots:[]
  }
];

const ITEM_DEFS = {
  flashlight: { label:'Flashlight', iconSrc:'./assets/items/flashlight.webp?v=167' },
  compass: { label:'Compass', iconSrc:'./assets/items/compass.webp?v=167' }
};

const sceneIndex = new Map(scenes.map((scene, i) => [scene.id, i]));
const game = document.getElementById('game');
const image = document.getElementById('scene');
const hotspots = document.getElementById('hotspots');
const back = document.getElementById('back');
const hint = document.getElementById('hint');
const satchel = document.getElementById('satchel');
const inventory = document.getElementById('inventory');
const inventorySlots = [...inventory.querySelectorAll('button')];
const toast = document.getElementById('toast');
const echoes = document.getElementById('echoes');
const loading = document.getElementById('loading');
const errorBox = document.getElementById('errorBox');

let index = 0;
let busy = false;
let timer;
const cache = new Map();
const collected = new Set(loadInventory());

function loadInventory() {
  try {
    const saved = JSON.parse(localStorage.getItem('sde-inventory-v1') || '[]');
    return Array.isArray(saved) ? saved.filter(id => ITEM_DEFS[id]) : [];
  } catch {
    return [];
  }
}

function saveInventory() {
  try { localStorage.setItem('sde-inventory-v1', JSON.stringify([...collected])); } catch {}
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

function showToast(message, duration = 1800) {
  clearTimeout(timer);
  toast.textContent = message;
  toast.classList.add('show');
  timer = setTimeout(() => toast.classList.remove('show'), duration);
}

function renderInventory() {
  const ids = [...collected];
  inventorySlots.forEach((slot, i) => {
    const id = ids[i];
    slot.className = 'inventory-slot';
    slot.replaceChildren();
    if (!id) {
      slot.setAttribute('aria-label', 'Empty slot');
      slot.removeAttribute('title');
      return;
    }
    const def = ITEM_DEFS[id];
    slot.classList.add('has-item');
    slot.setAttribute('aria-label', def.label);
    slot.title = def.label;
    const icon = document.createElement('img');
    icon.className = 'inventory-icon';
    icon.src = def.iconSrc;
    icon.alt = '';
    icon.draggable = false;
    slot.appendChild(icon);
  });
}

function collectItem(id) {
  const def = ITEM_DEFS[id];
  if (!def || collected.has(id)) return;
  collected.add(id);
  saveInventory();
  renderInventory();
  setHotspots(scenes[index]);
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
  for (const spec of scene.hotspots || []) {
    if (spec.action === 'collect' && collected.has(spec.item)) continue;
    const [left, top, width, height] = spec.area;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `hotspot hotspot-${spec.action}`;
    button.dataset.hotspotId = spec.id;
    button.setAttribute('aria-label', spec.label || 'Explore');
    Object.assign(button.style, {
      left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, zIndex: String(spec.z || 1)
    });
    if (spec.asset) {
      const objectImage = document.createElement('img');
      objectImage.className = `scene-item scene-item-${spec.item}`;
      objectImage.src = spec.asset;
      objectImage.alt = '';
      objectImage.draggable = false;
      button.appendChild(objectImage);
    }
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
  back.hidden = i === 0;
  setHotspots(scene);
}

function closeInventory() {
  inventory.classList.remove('open');
  inventory.setAttribute('aria-hidden','true');
  satchel.setAttribute('aria-expanded','false');
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

function showHint() { showToast(scenes[index].hint); }

function toggleInventory() {
  const open = !inventory.classList.contains('open');
  inventory.classList.toggle('open', open);
  inventory.setAttribute('aria-hidden', String(!open));
  satchel.setAttribute('aria-expanded', String(open));
}

function echo(x,y) {
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

back.addEventListener('click', () => go(index-1));
hint.addEventListener('click', showHint);
satchel.addEventListener('click', toggleInventory);
document.addEventListener('pointerdown', e => { if (!e.target.closest('button')) echo(e.clientX,e.clientY); });
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') go(index-1);
  if (e.key === 'Escape') closeInventory();
});

async function boot() {
  renderInventory();
  try {
    await preload(scenes[0].src);
    image.src = scenes[0].src;
    render(0);
    game.dataset.ready = 'true';
    loading.hidden = true;
    const sources = [
      ...scenes.slice(1).map(s => s.src),
      ...Object.values(ITEM_DEFS).map(def => def.iconSrc)
    ];
    Promise.allSettled(sources.map(src => preload(src)));
  } catch (err) {
    console.error(err);
    loading.hidden = true;
    showError('Initial scene failed to load.');
  }
}
boot();