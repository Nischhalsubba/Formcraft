'use strict';

(() => {
  const VERSION = 'FORMCRAFT-BOARD-DRAG-COMPAT-1.0';
  let active = null;
  let syntheticDropInFlight = false;

  function cardFor(target) {
    return target instanceof Element ? target.closest('[data-ops-drag-task]') : null;
  }

  function columnAt(x, y, target = null) {
    const direct = target instanceof Element ? target.closest('[data-ops-drop-status]') : null;
    if (direct) return direct;
    const point = Number.isFinite(x) && Number.isFinite(y) ? document.elementFromPoint(x, y) : null;
    return point instanceof Element ? point.closest('[data-ops-drop-status]') : null;
  }

  function dispatchFallbackDrop(column) {
    if (!column || !active?.taskId || syntheticDropInFlight) return false;
    const DataTransferConstructor = globalThis.DataTransfer;
    const DragEventConstructor = globalThis.DragEvent;
    if (typeof DataTransferConstructor !== 'function' || typeof DragEventConstructor !== 'function') return false;
    const transfer = new DataTransferConstructor();
    transfer.effectAllowed = 'move';
    transfer.setData('text/plain', active.taskId);
    syntheticDropInFlight = true;
    try {
      return column.dispatchEvent(new DragEventConstructor('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
        clientX: active.lastX,
        clientY: active.lastY
      }));
    } finally {
      syntheticDropInFlight = false;
    }
  }

  document.addEventListener('pointerdown', event => {
    const card = cardFor(event.target);
    if (!card || event.button !== 0) return;
    active = {
      taskId: card.dataset.opsDragTask,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      nativeDropSeen: false
    };
  }, true);

  document.addEventListener('pointermove', event => {
    if (!active) return;
    active.lastX = event.clientX;
    active.lastY = event.clientY;
  }, true);

  document.addEventListener('dragstart', event => {
    const card = cardFor(event.target);
    if (!card) return;
    active ||= {
      taskId: card.dataset.opsDragTask,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      nativeDropSeen: false
    };
    active.taskId = card.dataset.opsDragTask;
    active.lastX = event.clientX;
    active.lastY = event.clientY;
    if (event.dataTransfer && !event.dataTransfer.getData('text/plain')) {
      try { event.dataTransfer.setData('text/plain', active.taskId); } catch {}
    }
  }, true);

  document.addEventListener('dragover', event => {
    if (!active) return;
    active.lastX = event.clientX;
    active.lastY = event.clientY;
  }, true);

  document.addEventListener('drop', event => {
    const column = columnAt(event.clientX, event.clientY, event.target);
    if (!column || !active?.taskId) return;
    active.nativeDropSeen = true;
    if (event.dataTransfer && !event.dataTransfer.getData('text/plain')) {
      try { event.dataTransfer.setData('text/plain', active.taskId); } catch {}
    }
  }, true);

  document.addEventListener('pointerup', event => {
    if (!active) return;
    active.lastX = event.clientX;
    active.lastY = event.clientY;
    const moved = Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >= 8;
    const column = moved ? columnAt(event.clientX, event.clientY, event.target) : null;
    if (column && !active.nativeDropSeen) dispatchFallbackDrop(column);
    active = null;
  }, true);

  document.addEventListener('dragend', event => {
    if (!active) return;
    active.lastX = Number.isFinite(event.clientX) ? event.clientX : active.lastX;
    active.lastY = Number.isFinite(event.clientY) ? event.clientY : active.lastY;
    const column = columnAt(active.lastX, active.lastY, event.target);
    if (column && !active.nativeDropSeen) dispatchFallbackDrop(column);
    active = null;
  }, true);

  window.FormcraftBoardDragCompat = Object.freeze({
    version: VERSION,
    active: () => active ? { ...active } : null,
    dispatchFallbackDrop
  });
})();
