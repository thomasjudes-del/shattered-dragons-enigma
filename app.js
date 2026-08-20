const scenes = [
  { id:'camp', src:'./assets/clean/01-camp.webp?v=130', hint:'The biodiversity survey camp is the last normal place on the route.', hotspot:[18,5,64,82] },
  { id:'team', src:'./assets/clean/02-team.svg?v=130', hint:'The team found a structure that should not be here.', hotspot:[28,20,48,62] },
  { id:'map', src:'./assets/clean/03-map.webp?v=130', hint:'One marked route leaves the biodiversity survey area.', hotspot:[16,24,68,58] },
  { id:'entrance', src:'./assets/clean/04-entrance.webp?v=130', hint:'The entrance is the only obvious way forward.', hotspot:[24,25,54,55] },
  { id:'lab', src:'./assets/clean/05-lab.webp?v=130', hint:'End of the navigation V0.', hotspot:null }
];

const game = document.getElementById('game');
const image = document.getElementById('scene');
const hotspot = document.getElementById('hotspot');
const back = document.getElementById('back');
const hint = document.getElementById('hint');
const satchel = document.getElementById('satchel');
const inventory = document.getElementById('inventory');
const toast = document.getElementById('toast');
const echoes = document.getElementById('echoes');
const loading = document.getElementById('loading');
const errorBox = document.getElementById('errorBox');

let index = 0;
let busy = false;
let timer;
const cache = new Map();

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

function setHotspot(scene) {
  if (!scene.hotspot || index === scenes.length - 1) {
    hotspot.hidden = true;
    return;
  }
  const [left, top, width, height] = scene.hotspot;
  hotspot.hidden = false;
  Object.assign(hotspot.style, {
    left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`
  });
}

function render(i) {
  index = i;
  const scene = scenes[i];
  game.dataset.scene = scene.id;
  back.hidden = i === 0;
  setHotspot(scene);
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
    busy = false;
    showError('Scene failed to load.');
  }
}

function showHint() {
  clearTimeout(timer);
  toast.textContent = scenes[index].hint;
  toast.classList.add('show');
  timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

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

hotspot.addEventListener('click', e => { e.stopPropagation(); echo(e.clientX,e.clientY); go(index+1); });
back.addEventListener('click', () => go(index-1));
hint.addEventListener('click', showHint);
satchel.addEventListener('click', toggleInventory);
document.addEventListener('pointerdown', e => { if (!e.target.closest('button')) echo(e.clientX,e.clientY); });
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') go(index-1);
  if (e.key === 'Escape') closeInventory();
});

async function boot() {
  try {
    await preload(scenes[0].src);
    image.src = scenes[0].src;
    render(0);
    game.dataset.ready = 'true';
    loading.hidden = true;
    Promise.allSettled(scenes.slice(1).map(s => preload(s.src)));
  } catch (err) {
    loading.hidden = true;
    showError('Initial scene failed to load.');
  }
}
boot();