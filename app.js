const SCENES = {
  camp: {
    name: 'Camp de base',
    image: './assets/scene-camp.webp?v=4',
    hint: 'Le sentier continue derrière le camp, vers l’est.',
    exits: { forward: 'trail' },
    hotspots: [{ to: 'trail', label: 'Take the jungle trail', rect: [43, 18, 40, 58] }]
  },
  trail: {
    name: 'Sentier de la canopée',
    image: './assets/scene-trail.webp?v=4',
    hint: 'Quelque chose a été balisé plus loin. Le camp reste derrière vous.',
    exits: { forward: 'anomaly', back: 'camp' },
    hotspots: [{ to: 'anomaly', label: 'Continue along the trail', rect: [31, 15, 38, 60] }]
  },
  anomaly: {
    name: 'Clairière · anomalie',
    image: './assets/scene-anomaly.webp?v=4',
    hint: 'Le balisage converge vers une zone où les racines recouvrent une structure.',
    exits: { forward: 'entrance', back: 'trail' },
    hotspots: [{ to: 'entrance', label: 'Approach the buried structure', rect: [26, 20, 50, 58] }]
  },
  entrance: {
    name: 'Entrée enfouie',
    image: './assets/scene-entrance.webp?v=4',
    hint: 'L’ouverture est praticable. Rien n’indique qui l’a construite.',
    exits: { forward: 'lab', back: 'anomaly' },
    hotspots: [{ to: 'lab', label: 'Enter the buried facility', rect: [33, 18, 34, 64] }]
  },
  lab: {
    name: 'Installation intérieure',
    image: './assets/scene-lab.webp?v=4',
    hint: 'La salle continue hors champ. Pour ce test, revenez vers l’entrée.',
    exits: { back: 'entrance' },
    hotspots: []
  }
};

const sceneImage = document.querySelector('#sceneImage');
const backdropImage = document.querySelector('#backdropImage');
const sceneLabel = document.querySelector('#sceneLabel');
const hotspots = document.querySelector('#hotspots');
const nav = document.querySelector('#nav');
const scene = document.querySelector('#scene');
const echoLayer = document.querySelector('#echoLayer');
const hintButton = document.querySelector('#hintButton');
const satchelButton = document.querySelector('#satchelButton');
const satchel = document.querySelector('#satchel');
const satchelClose = document.querySelector('#satchelClose');
const toast = document.querySelector('#toast');
const qaReport = document.querySelector('#qaReport');

let current = 'camp';
let locked = false;
let toastTimer = 0;

function assertScene(id) {
  if (!SCENES[id]) throw new Error(`Unknown scene: ${id}`);
  return SCENES[id];
}

function preload() {
  Object.values(SCENES).forEach(item => {
    const img = new Image();
    img.src = item.image;
  });
}

function makeArrow(direction, target) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `arrow arrow-${direction}`;
  button.dataset.direction = direction;
  button.dataset.to = target;
  button.setAttribute('aria-label', `${direction}: ${SCENES[target].name}`);
  button.innerHTML = '<span aria-hidden="true"></span>';
  button.addEventListener('click', event => {
    event.stopPropagation();
    go(target);
  });
  return button;
}

function renderControls(item) {
  hotspots.replaceChildren();
  item.hotspots.forEach(spot => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hotspot';
    button.setAttribute('aria-label', spot.label);
    const [x, y, w, h] = spot.rect;
    Object.assign(button.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });
    button.addEventListener('click', event => {
      event.stopPropagation();
      go(spot.to);
    });
    hotspots.append(button);
  });

  nav.replaceChildren();
  Object.entries(item.exits).forEach(([direction, target]) => nav.append(makeArrow(direction, target)));
}

function render(id, immediate = false) {
  const item = assertScene(id);
  current = id;
  document.querySelector('#game').dataset.scene = id;
  sceneLabel.textContent = item.name;
  sceneImage.alt = item.name;
  backdropImage.alt = '';

  if (immediate) {
    sceneImage.src = item.image;
    backdropImage.src = item.image;
    renderControls(item);
    return Promise.resolve();
  }

  locked = true;
  scene.classList.add('transitioning');
  return new Promise(resolve => {
    const probe = new Image();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      sceneImage.src = item.image;
      backdropImage.src = item.image;
      renderControls(item);
      requestAnimationFrame(() => {
        scene.classList.remove('transitioning');
        locked = false;
        resolve();
      });
    };
    probe.onload = finish;
    probe.onerror = finish;
    probe.src = item.image;
    if (probe.complete) finish();
  });
}

async function go(target) {
  if (locked || target === current) return;
  await render(target, false);
}

function echo(clientX, clientY) {
  const bounds = scene.getBoundingClientRect();
  if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) return;
  const ring = document.createElement('span');
  ring.className = 'echo';
  ring.style.left = `${clientX - bounds.left}px`;
  ring.style.top = `${clientY - bounds.top}px`;
  echoLayer.append(ring);
  setTimeout(() => ring.remove(), 560);
}

document.addEventListener('pointerdown', event => {
  if (event.target.closest('.satchel')) return;
  echo(event.clientX, event.clientY);
}, { passive: true });

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

hintButton.addEventListener('click', event => {
  event.stopPropagation();
  showToast(SCENES[current].hint);
});

function setSatchel(open) {
  satchel.classList.toggle('open', open);
  satchel.setAttribute('aria-hidden', String(!open));
  satchelButton.setAttribute('aria-expanded', String(open));
}

satchelButton.addEventListener('click', event => { event.stopPropagation(); setSatchel(!satchel.classList.contains('open')); });
satchelClose.addEventListener('click', event => { event.stopPropagation(); setSatchel(false); });

function validateGraph() {
  const errors = [];
  for (const [id, item] of Object.entries(SCENES)) {
    for (const target of Object.values(item.exits)) if (!SCENES[target]) errors.push(`${id} -> missing ${target}`);
    for (const spot of item.hotspots) if (!SCENES[spot.to]) errors.push(`${id} hotspot -> missing ${spot.to}`);
  }
  const reachable = new Set(['camp']);
  const queue = ['camp'];
  while (queue.length) {
    const id = queue.shift();
    Object.values(SCENES[id].exits).forEach(next => {
      if (!reachable.has(next)) { reachable.add(next); queue.push(next); }
    });
  }
  if (reachable.size !== Object.keys(SCENES).length) errors.push(`Only ${reachable.size}/5 scenes reachable`);
  return errors;
}

async function runQA() {
  const errors = validateGraph();
  const order = ['camp', 'trail', 'anomaly', 'entrance', 'lab', 'entrance', 'anomaly', 'trail', 'camp'];
  try {
    for (const id of order) {
      await render(id, true);
      if (current !== id) errors.push(`Navigation state failed at ${id}`);
      if (!document.querySelector(`[data-scene="${id}"]`) && document.querySelector('#game').dataset.scene !== id) errors.push(`DOM scene mismatch ${id}`);
      const expected = Object.keys(SCENES[id].exits).length;
      const actual = nav.querySelectorAll('.arrow').length;
      if (actual !== expected) errors.push(`${id}: expected ${expected} arrows, got ${actual}`);
    }
  } catch (error) {
    errors.push(error.message);
  }
  const mobileSafe = window.innerWidth < 500 ? (scene.getBoundingClientRect().height > 500 && nav.getBoundingClientRect().width > 0) : true;
  if (!mobileSafe) errors.push('Mobile viewport layout check failed');
  qaReport.hidden = false;
  qaReport.dataset.result = errors.length ? 'FAIL' : 'PASS';
  qaReport.textContent = errors.length ? errors.join(' | ') : `PASS: ${Object.keys(SCENES).length} scenes reachable, forward/back navigation rendered, viewport ${innerWidth}x${innerHeight}`;
  document.body.dataset.qa = errors.length ? 'fail' : 'pass';
}

preload();
render('camp', true);

if (new URLSearchParams(location.search).has('qa')) {
  window.addEventListener('load', () => setTimeout(runQA, 100));
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=4', { updateViaCache: 'none' }).catch(() => {}));
}
