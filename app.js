import expeditionImg from './assets/expedition.js';
import entranceImg from './assets/entrance.js';
import labImg from './assets/lab.js';

const scenes = {
  expedition: {
    id: 'expedition',
    name: 'Expedition Perimeter',
    image: expeditionImg,
    zoom: 1.0,
    pos: '54% 48%',
    hint: 'The overgrown structure behind the expedition team is the only obvious route forward.',
    exits: { forward: 'entrance' },
    hotspots: [
      { id: 'to-entrance', to: 'entrance', label: 'Overgrown structure', rect: [63, 12, 35, 76] }
    ]
  },
  entrance: {
    id: 'entrance',
    name: 'Overgrown Access',
    image: entranceImg,
    zoom: 1.0,
    pos: '50% 50%',
    hint: 'The opening is passable. You can still return to the expedition perimeter.',
    exits: { forward: 'threshold', back: 'expedition' },
    hotspots: [
      { id: 'to-threshold', to: 'threshold', label: 'Dark entrance', rect: [29, 27, 42, 53] }
    ]
  },
  threshold: {
    id: 'threshold',
    name: 'Buried Threshold',
    image: entranceImg,
    zoom: 1.2,
    pos: '50% 50%',
    hint: 'The geometry continues inward. The surface remains behind you.',
    exits: { forward: 'lab', back: 'entrance' },
    hotspots: [
      { id: 'to-lab', to: 'lab', label: 'Interior passage', rect: [28, 22, 44, 61] }
    ]
  },
  lab: {
    id: 'lab',
    name: 'Containment Hall',
    image: labImg,
    zoom: 1.0,
    pos: '53% 50%',
    hint: 'One containment unit on the right is visibly damaged.',
    exits: { right: 'pod', back: 'threshold' },
    hotspots: [
      { id: 'to-pod', to: 'pod', label: 'Damaged containment unit', rect: [65, 10, 33, 77] }
    ]
  },
  pod: {
    id: 'pod',
    name: 'Damaged Pod',
    image: labImg,
    zoom: 1.28,
    pos: '76% 49%',
    hint: 'The glass is fractured from the inside. For now, there is nothing else to do here.',
    exits: { left: 'lab', back: 'lab' },
    hotspots: []
  }
};

const stage = document.getElementById('sceneStage');
const imageA = document.getElementById('sceneImageA');
const imageB = document.getElementById('sceneImageB');
const hotspotsEl = document.getElementById('hotspots');
const navEl = document.getElementById('navControls');
const locationLabel = document.getElementById('locationLabel');
const hintBtn = document.getElementById('hintBtn');
const hintToast = document.getElementById('hintToast');
const tapFx = document.getElementById('tapFx');
const satchel = document.getElementById('satchel');
const satchelBtn = document.getElementById('satchelBtn');
const satchelClose = document.getElementById('satchelClose');
const firstRun = document.getElementById('firstRun');
const enterBtn = document.getElementById('enterBtn');

let currentSceneId = 'expedition';
let visibleImage = imageA;
let hiddenImage = imageB;
let hintTimer = null;
let labelTimer = null;
let transitioning = false;

for (const scene of Object.values(scenes)) {
  const pre = new Image();
  pre.src = scene.image;
}

function echoAt(x, y) {
  const rect = stage.getBoundingClientRect();
  const el = document.createElement('span');
  el.className = 'tap-echo';
  el.style.left = `${x - rect.left}px`;
  el.style.top = `${y - rect.top}px`;
  tapFx.appendChild(el);
  window.setTimeout(() => el.remove(), 650);
}

document.addEventListener('pointerdown', (event) => {
  const target = event.target;
  if (target.closest('.satchel') || target.closest('.first-run')) return;
  echoAt(event.clientX, event.clientY);
}, { passive: true });

function showLocation(name) {
  clearTimeout(labelTimer);
  locationLabel.textContent = name;
  locationLabel.classList.add('show');
  labelTimer = setTimeout(() => locationLabel.classList.remove('show'), 1450);
}

function renderHotspots(scene) {
  hotspotsEl.replaceChildren();
  for (const spot of scene.hotspots) {
    const btn = document.createElement('button');
    btn.className = 'hotspot';
    btn.type = 'button';
    btn.setAttribute('aria-label', spot.label);
    const [x, y, w, h] = spot.rect;
    Object.assign(btn.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      navigate(spot.to);
    });
    hotspotsEl.appendChild(btn);
  }
}

function arrowButton(direction, to) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `nav-arrow ${direction}`;
  btn.setAttribute('aria-label', `${direction} to ${scenes[to].name}`);
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    navigate(to);
  });
  return btn;
}

function renderNav(scene) {
  navEl.replaceChildren();
  for (const [direction, to] of Object.entries(scene.exits)) {
    navEl.appendChild(arrowButton(direction, to));
  }
}

function setSceneInitial(id) {
  const scene = scenes[id];
  currentSceneId = id;
  visibleImage.src = scene.image;
  visibleImage.style.setProperty('--scene-pos', scene.pos || '50% 50%');
  visibleImage.style.setProperty('--scene-zoom', scene.zoom || 1);
  visibleImage.alt = scene.name;
  renderHotspots(scene);
  renderNav(scene);
  showLocation(scene.name);
}

function navigate(to) {
  if (transitioning || !scenes[to] || to === currentSceneId) return;
  transitioning = true;
  const next = scenes[to];
  hiddenImage.src = next.image;
  hiddenImage.style.setProperty('--scene-pos', next.pos || '50% 50%');
  hiddenImage.style.setProperty('--scene-zoom', next.zoom || 1);
  hiddenImage.alt = next.name;

  const finish = () => {
    hiddenImage.onload = null;
    hiddenImage.classList.add('is-visible');
    visibleImage.classList.remove('is-visible');
    currentSceneId = to;
    renderHotspots(next);
    renderNav(next);
    showLocation(next.name);
    setTimeout(() => {
      const temp = visibleImage;
      visibleImage = hiddenImage;
      hiddenImage = temp;
      transitioning = false;
    }, 380);
  };

  if (hiddenImage.complete) finish();
  else hiddenImage.onload = finish;
}

function showHint() {
  clearTimeout(hintTimer);
  hintToast.textContent = scenes[currentSceneId].hint;
  hintToast.classList.add('show');
  hintTimer = setTimeout(() => hintToast.classList.remove('show'), 3100);
}

function setSatchel(open) {
  satchel.classList.toggle('open', open);
  satchel.setAttribute('aria-hidden', String(!open));
  satchelBtn.setAttribute('aria-expanded', String(open));
}

hintBtn.addEventListener('click', (event) => { event.stopPropagation(); showHint(); });
satchelBtn.addEventListener('click', (event) => { event.stopPropagation(); setSatchel(!satchel.classList.contains('open')); });
satchelClose.addEventListener('click', () => setSatchel(false));

enterBtn.addEventListener('click', () => {
  firstRun.classList.add('hidden');
  try { localStorage.setItem('sde.entered', '1'); } catch {}
  showLocation(scenes[currentSceneId].name);
});

try {
  if (localStorage.getItem('sde.entered') === '1') firstRun.classList.add('hidden');
} catch {}

setSceneInitial(currentSceneId);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
