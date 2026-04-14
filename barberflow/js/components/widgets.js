import { getJSON, setJSON } from '../utils/storage.js';
import { navigate } from '../router.js';

const widgetStorageKey = 'barberflow-hidden-widgets';
const widgetPositionStorageKey = 'barberflow-widget-positions';
const widgetDragThreshold = 6;

function getHiddenWidgets() {
  return getJSON(widgetStorageKey, []);
}

function setHiddenWidgets(hiddenIds) {
  setJSON(widgetStorageKey, hiddenIds);
}

function getWidgetPositions() {
  return getJSON(widgetPositionStorageKey, {});
}

function setWidgetPositions(positions) {
  setJSON(widgetPositionStorageKey, positions);
}

function updateRestoreWidgetsButton() {
  const btn = document.getElementById('restoreWidgetsBtn');
  if (!btn) return;

  const hiddenIds = getHiddenWidgets();
  if (hiddenIds.length === 0) {
    btn.textContent = '↺ Restaurar widgets';
    btn.disabled = true;
  } else if (hiddenIds.length === 1) {
    btn.textContent = '↺ Restaurar 1 widget';
    btn.disabled = false;
  } else {
    btn.textContent = `↺ Restaurar ${hiddenIds.length} widgets`;
    btn.disabled = false;
  }
}

function hideWidget(widgetId) {
  const widget = document.querySelector(`.dashboard-widget[data-widget-id="${widgetId}"]`);
  if (!widget) return;

  widget.classList.add('widget-hidden');
  const hiddenIds = getHiddenWidgets();
  if (!hiddenIds.includes(widgetId)) hiddenIds.push(widgetId);
  setHiddenWidgets(hiddenIds);
  updateRestoreWidgetsButton();
}

function restoreWidgets() {
  document.querySelectorAll('.dashboard-widget.widget-hidden').forEach((widget) => {
    widget.classList.remove('widget-hidden');
  });
  setHiddenWidgets([]);
  updateRestoreWidgetsButton();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function applyWidgetPosition(card, leftPct, topPct) {
  card.style.left = `${leftPct}%`;
  card.style.top = `${topPct}%`;
  card.style.right = 'auto';
  card.style.bottom = 'auto';
  card.classList.add('widget-positioned');
}

function saveWidgetPosition(card) {
  const hero = document.getElementById('hero');
  if (!hero || !card?.dataset.widgetId) return;

  const heroRect = hero.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const positions = getWidgetPositions();

  positions[card.dataset.widgetId] = {
    left: ((cardRect.left - heroRect.left) / heroRect.width) * 100,
    top: ((cardRect.top - heroRect.top) / heroRect.height) * 100,
  };

  setWidgetPositions(positions);
}

function applySavedWidgetPositions() {
  const positions = getWidgetPositions();
  document.querySelectorAll('.dashboard-widget[data-widget-id]').forEach((card) => {
    const saved = positions[card.dataset.widgetId];
    if (!saved) return;
    applyWidgetPosition(card, saved.left, saved.top);
  });
}

function initWidgetDrag() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  document.querySelectorAll('.dashboard-widget[data-widget-id]').forEach((card) => {
    const handle = card.querySelector('.widget-topbar');
    if (!handle) return;

    handle.addEventListener('pointerdown', (event) => {
      if (event.target.closest('[data-widget-close]')) return;
      if (event.button !== undefined && event.button !== 0) return;
      if (card.classList.contains('widget-hidden')) return;

      const heroRect = hero.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const offsetX = event.clientX - cardRect.left;
      const offsetY = event.clientY - cardRect.top;
      const startX = event.clientX;
      const startY = event.clientY;
      let hasMoved = false;
      let isDragging = false;

      function positionCard(clientX, clientY) {
        let nextLeft = clientX - heroRect.left - offsetX;
        let nextTop = clientY - heroRect.top - offsetY;
        nextLeft = clamp(nextLeft, 8, heroRect.width - card.offsetWidth - 8);
        nextTop = clamp(nextTop, 110, heroRect.height - card.offsetHeight - 10);
        applyWidgetPosition(card, (nextLeft / heroRect.width) * 100, (nextTop / heroRect.height) * 100);
      }

      function onPointerMove(ev) {
        const deltaX = ev.clientX - startX;
        const deltaY = ev.clientY - startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (!isDragging && distance > widgetDragThreshold) {
          isDragging = true;
          hasMoved = true;
          card.classList.add('widget-dragging');
          card.dataset.dragMoved = '1';
          positionCard(cardRect.left + offsetX, cardRect.top + offsetY);
        }

        if (!isDragging) return;
        positionCard(ev.clientX, ev.clientY);
      }

      function onPointerUp() {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        if (isDragging) {
          card.classList.remove('widget-dragging');
          saveWidgetPosition(card);
          setTimeout(() => {
            card.dataset.dragMoved = '0';
          }, 120);
        } else if (!hasMoved) {
          card.dataset.dragMoved = '0';
        }
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  });
}

export function initWidgets() {
  const hiddenIds = getHiddenWidgets();
  document.querySelectorAll('.dashboard-widget[data-widget-id]').forEach((widget) => {
    const isHidden = hiddenIds.includes(widget.dataset.widgetId);
    widget.classList.toggle('widget-hidden', isHidden);
    widget.dataset.dragMoved = '0';
  });

  applySavedWidgetPositions();

  document.querySelectorAll('.dashboard-widget[data-target]').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('[data-widget-close]')) return;
      if (card.dataset.dragMoved === '1' || card.classList.contains('widget-dragging')) return;
      navigate(card.dataset.target);
    });
  });

  document.querySelectorAll('[data-widget-close]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const card = btn.closest('.dashboard-widget');
      if (card) hideWidget(card.dataset.widgetId);
    });
  });

  const restoreBtn = document.getElementById('restoreWidgetsBtn');
  if (restoreBtn) restoreBtn.addEventListener('click', restoreWidgets);

  initWidgetDrag();
  updateRestoreWidgetsButton();
}
