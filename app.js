const scenes=[
{id:'camp',src:'./assets/scenes/camp.avif?v=110',hint:'The biodiversity survey route continues beyond the camp.',hotspot:[48,24,42,62]},
{id:'trail',src:'./assets/scenes/trail.avif?v=110',hint:'The survey route continues deeper into the forest.',hotspot:[42,18,48,70]},
{id:'anomaly',src:'./assets/scenes/anomaly.avif?v=110',hint:'Something here does not belong to the expedition.',hotspot:[35,24,40,56]},
{id:'entrance',src:'./assets/scenes/entrance.avif?v=110',hint:'The buried structure is the only route forward.',hotspot:[34,24,38,58]},
{id:'lab',src:'./assets/scenes/lab.avif?v=110',hint:'End of the navigation V0.',hotspot:null}
];
const game=document.getElementById('game');
const image=document.getElementById('scene');
const hotspot=document.getElementById('hotspot');
const back=document.getElementById('back');
const hint=document.getElementById('hint');
const satchel=document.getElementById('satchel');
const inventory=document.getElementById('inventory');
const toast=document.getElementById('toast');
const echoes=document.getElementById('echoes');
let index=0,busy=false,timer;
function setHotspot(scene){if(!scene.hotspot||index===scenes.length-1){hotspot.hidden=true;return;}const [l,t,w,h]=scene.hotspot;hotspot.hidden=false;Object.assign(hotspot.style,{left:l+'%',top:t+'%',width:w+'%',height:h+'%'});}
function render(i){index=i;const scene=scenes[i];game.dataset.scene=scene.id;back.hidden=i===0;setHotspot(scene);}
function go(i){if(busy||i<0||i>=scenes.length)return;busy=true;inventory.classList.remove('open');satchel.setAttribute('aria-expanded','false');image.classList.add('fade');const next=scenes[i];const preload=new Image();preload.onload=()=>{image.src=next.src;render(i);requestAnimationFrame(()=>image.classList.remove('fade'));busy=false;};preload.onerror=()=>{image.classList.remove('fade');busy=false;};preload.src=next.src;}
function showHint(){clearTimeout(timer);toast.textContent=scenes[index].hint;toast.classList.add('show');timer=setTimeout(()=>toast.classList.remove('show'),2200);}
function echo(x,y){const e=document.createElement('span');e.className='echo';e.style.left=x+'px';e.style.top=y+'px';echoes.appendChild(e);setTimeout(()=>e.remove(),460);}
hotspot.addEventListener('click',e=>{echo(e.clientX,e.clientY);go(index+1);});
back.addEventListener('click',()=>go(index-1));
hint.addEventListener('click',showHint);
satchel.addEventListener('click',()=>{const open=!inventory.classList.contains('open');inventory.classList.toggle('open',open);inventory.setAttribute('aria-hidden',String(!open));satchel.setAttribute('aria-expanded',String(open));});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('button'))echo(e.clientX,e.clientY);});
document.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')go(index-1);if(e.key==='Escape'){inventory.classList.remove('open');satchel.setAttribute('aria-expanded','false');}});
image.addEventListener('load',()=>{game.dataset.ready='true';});
image.src=scenes[0].src;render(0);
