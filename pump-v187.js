const PUMP_PANEL_BASE_V187 = `${R2_BASE}/puzzles/pump-panel-base-v186.png`;
const PUMP_LEVER_PIVOT_V187 = `${R2_BASE}/puzzles/pump-lever-pivot-v187.png`;
const PUMP_TRACKS_V187 = [28.5, 50.0, 71.5];
const PUMP_ANGLES_V187 = [-24, -12, 0, 12, 24];

function pumpPivotMarkup(i) {
  const value = selectorState[i];
  return `
    <button class="pump-pivot-control" type="button" data-selector="${i}" style="--x:${PUMP_TRACKS_V187[i]}%;--angle:${PUMP_ANGLES_V187[value]}deg" aria-label="Pump regulator ${i + 1}, position ${value}">
      <img class="pump-pivot-handle" src="${PUMP_LEVER_PIVOT_V187}" alt="" draggable="false">
    </button>
  `;
}

function updatePumpPivotVisual(button, value) {
  button.style.setProperty('--angle', `${PUMP_ANGLES_V187[value]}deg`);
  button.setAttribute('aria-label', `Pump regulator ${Number(button.dataset.selector) + 1}, position ${value}`);
}

function setPumpPivotValue(button, value) {
  const i = Number(button.dataset.selector);
  const next = Math.max(0, Math.min(4, value));
  selectorState[i] = next;
  updatePumpPivotVisual(button, next);
}

function bindPumpPivot(button) {
  let activePointer = null;
  let dragged = false;
  let startX = 0;

  button.addEventListener('pointerdown', event => {
    if (state.flags.powerRestored) return;
    activePointer = event.pointerId;
    startX = event.clientX;
    dragged = false;
    button.setPointerCapture?.(event.pointerId);
  });

  button.addEventListener('pointermove', event => {
    if (state.flags.powerRestored || activePointer !== event.pointerId) return;
    if (Math.abs(event.clientX - startX) > 4) dragged = true;
    const rect = button.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setPumpPivotValue(button, Math.round(ratio * 4));
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
    setPumpPivotValue(button, (selectorState[i] + 1) % 5);
  });
}

renderSelectorPuzzle = function renderSelectorPuzzleV187() {
  modalContent.innerHTML = `
    <div id="pumpPanelWrap" class="pump-panel-wrap pump-panel-v187${state.flags.powerRestored ? ' pump-panel-locked' : ''}">
      <img class="pump-panel-photo" src="${PUMP_PANEL_BASE_V187}" alt="Corroded pump regulation panel with three mechanical controls and etched detents">
      ${PUMP_TRACKS_V187.map((_, i) => pumpPivotMarkup(i)).join('')}
      <button id="engagePanel" class="pump-engage-target pump-engage-v187" type="button" aria-label="Engage pump regulator" ${state.flags.powerRestored ? 'disabled' : ''}></button>
    </div>
  `;

  modalContent.querySelectorAll('.pump-pivot-control').forEach(bindPumpPivot);
  const engage = modalContent.querySelector('#engagePanel');
  if (engage && !state.flags.powerRestored) engage.addEventListener('click', applySelectorPuzzle);
};

openSelectorPuzzle = function openSelectorPuzzleV187() {
  modalLayer.hidden = false;
  modalLayer.classList.remove('ending', 'photo-view');
  modalLayer.classList.add('panel-view');
  modalLayer.setAttribute('aria-hidden', 'false');
  closeInventory();
  renderSelectorPuzzle();
};

applySelectorPuzzle = function applySelectorPuzzleV187() {
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
