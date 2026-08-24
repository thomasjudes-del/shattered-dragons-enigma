const PUMP_PANEL_BASE_V186 = `${R2_BASE}/puzzles/pump-panel-base-v186.png`;
const PUMP_LEVER_HANDLE_V186 = `${R2_BASE}/puzzles/pump-lever-handle-v186.png`;
const PUMP_TRACKS_V186 = [28.5, 50.0, 71.5];
const PUMP_DETENT_TOPS_V186 = [8, 28, 48, 68, 88];

function pumpSliderMarkup(i) {
  const value = selectorState[i];
  return `
    <button class="pump-slider-control" type="button" data-selector="${i}" style="--x:${PUMP_TRACKS_V186[i]}%" aria-label="Pump regulator ${i + 1}, position ${value}">
      <img class="pump-slider-handle" src="${PUMP_LEVER_HANDLE_V186}" alt="" draggable="false" style="top:${PUMP_DETENT_TOPS_V186[value]}%">
    </button>
  `;
}

function updatePumpSliderVisual(button, value) {
  const handle = button.querySelector('.pump-slider-handle');
  if (handle) handle.style.top = `${PUMP_DETENT_TOPS_V186[value]}%`;
  button.setAttribute('aria-label', `Pump regulator ${Number(button.dataset.selector) + 1}, position ${value}`);
}

function setPumpSelectorValue(button, value) {
  const i = Number(button.dataset.selector);
  const next = Math.max(0, Math.min(4, value));
  selectorState[i] = next;
  updatePumpSliderVisual(button, next);
}

function bindPumpSlider(button) {
  let dragged = false;
  let activePointer = null;

  button.addEventListener('pointerdown', event => {
    if (state.flags.powerRestored) return;
    activePointer = event.pointerId;
    dragged = false;
    button.setPointerCapture?.(event.pointerId);
  });

  button.addEventListener('pointermove', event => {
    if (state.flags.powerRestored || activePointer !== event.pointerId) return;
    const rect = button.getBoundingClientRect();
    if (!rect.height) return;
    const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const value = Math.max(0, Math.min(4, Math.round(ratio * 4)));
    if (value !== selectorState[Number(button.dataset.selector)]) {
      dragged = true;
      setPumpSelectorValue(button, value);
    }
  });

  button.addEventListener('pointerup', event => {
    if (activePointer !== event.pointerId) return;
    button.releasePointerCapture?.(event.pointerId);
    activePointer = null;
    setTimeout(() => { dragged = false; }, 0);
  });

  button.addEventListener('pointercancel', () => {
    activePointer = null;
    dragged = false;
  });

  button.addEventListener('click', event => {
    if (state.flags.powerRestored) return;
    if (dragged) {
      event.preventDefault();
      return;
    }
    const i = Number(button.dataset.selector);
    setPumpSelectorValue(button, (selectorState[i] + 1) % 5);
  });
}

renderSelectorPuzzle = function renderSelectorPuzzleV186() {
  modalContent.innerHTML = `
    <div id="pumpPanelWrap" class="pump-panel-wrap pump-panel-v186${state.flags.powerRestored ? ' pump-panel-locked' : ''}">
      <img class="pump-panel-photo" src="${PUMP_PANEL_BASE_V186}" alt="Corroded pump regulation panel with three slotted mechanical controls and etched detents">
      ${PUMP_TRACKS_V186.map((_, i) => pumpSliderMarkup(i)).join('')}
      <button id="engagePanel" class="pump-engage-target pump-engage-v186" type="button" aria-label="Engage pump regulator" ${state.flags.powerRestored ? 'disabled' : ''}></button>
    </div>
  `;

  modalContent.querySelectorAll('.pump-slider-control').forEach(bindPumpSlider);
  const engage = modalContent.querySelector('#engagePanel');
  if (engage && !state.flags.powerRestored) engage.addEventListener('click', applySelectorPuzzle);
};

openSelectorPuzzle = function openSelectorPuzzleV186() {
  modalLayer.hidden = false;
  modalLayer.classList.remove('ending', 'photo-view');
  modalLayer.classList.add('panel-view');
  modalLayer.setAttribute('aria-hidden', 'false');
  closeInventory();
  renderSelectorPuzzle();
};

applySelectorPuzzle = function applySelectorPuzzleV186() {
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
};
