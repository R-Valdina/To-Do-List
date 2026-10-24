import { button, focusTask } from './dom.js';

/** Capture on a stable page element, never on the row being moved. */
export function createDragController({ onReorder, announce }) {
  let drag = null;
  const capture = document.documentElement;
  const events = new AbortController();
  const { signal } = events;

  function createHandle(list, task, row, searching) {
    const handle = button('', 'drag-handle', () => {});
    handle.dataset.action = 'drag';
    handle.innerHTML = '<svg viewBox="0 0 16 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="5" r="1.6"/><circle cx="11" cy="5" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="11" cy="12" r="1.6"/><circle cx="5" cy="19" r="1.6"/><circle cx="11" cy="19" r="1.6"/></svg>';
    handle.disabled = searching || list.tasks.length < 2;
    handle.title = searching ? 'Clear search to reorder tasks' : 'Drag to reorder · Use ↑ / ↓ when focused';
    handle.setAttribute('aria-label', `Reorder ${task.text}. Drag or use the up and down arrow keys.`);
    handle.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown');
    handle.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const ids = list.tasks.map(task => task.id);
      const index = ids.indexOf(task.id);
      const destination = index + (event.key === 'ArrowUp' ? -1 : 1);
      if (destination < 0 || destination >= ids.length) return;
      [ids[index], ids[destination]] = [ids[destination], ids[index]];
      onReorder(list.id, ids, task.id);
    });
    handle.addEventListener('pointerdown', event => {
      if (handle.disabled || drag || !event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      handle.focus();
      const rect = row.getBoundingClientRect();
      drag = { pointerId: event.pointerId, row, listId: list.id, taskId: task.id,
        container: row.parentElement, startX: event.clientX, startY: event.clientY,
        x: event.clientX, y: event.clientY, offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top, started: false, ghost: null, frame: null };
      capture.setPointerCapture(event.pointerId);
    });
    return handle;
  }

  function start() {
    const styles = getComputedStyle(drag.row);
    const ghost = drag.row.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghost.style.width = `${drag.row.getBoundingClientRect().width}px`;
    for (const name of ['--list-accent', '--list-border', '--list-tint', '--list-ink',
      '--list-progress', '--list-check', '--list-selection', '--panel', '--field', '--text',
      '--muted', '--line', '--soft', '--accent', '--red', '--red-bg', '--yellow', '--yellow-bg', '--green', '--green-bg']) {
      ghost.style.setProperty(name, styles.getPropertyValue(name));
    }
    ghost.style.color = styles.color;
    ghost.style.colorScheme = styles.colorScheme;
    document.body.append(ghost);
    drag.ghost = ghost;
    drag.started = true;
    drag.row.classList.add('drag-source');
    document.body.classList.add('reordering');
    announce('Reordering task. Release to place it; Escape cancels.');
    drag.frame = requestAnimationFrame(update);
  }
  function positionRow() {
    const siblings = [...drag.container.children].filter(row => row !== drag.row);
    const before = siblings.find(row => {
      const rect = row.getBoundingClientRect();
      return drag.y < rect.top + rect.height / 2;
    }) ?? null;
    if (drag.row.nextElementSibling !== before) drag.container.insertBefore(drag.row, before);
  }
  function update() {
    if (!drag?.started) return;
    drag.ghost.style.left = `${drag.x - drag.offsetX}px`;
    drag.ghost.style.top = `${drag.y - drag.offsetY}px`;
    positionRow();
    const edge = 75;
    if (drag.y < edge) window.scrollBy(0, -15 * Math.min(1, (edge - drag.y) / edge));
    else if (drag.y > innerHeight - edge) window.scrollBy(0, 15 * Math.min(1, (drag.y - innerHeight + edge) / edge));
    drag.frame = requestAnimationFrame(update);
  }
  function finish(commit) {
    if (!drag) return;
    if (commit && drag.started) positionRow();
    const current = drag;
    drag = null;
    cancelAnimationFrame(current.frame);
    if (capture.hasPointerCapture(current.pointerId)) capture.releasePointerCapture(current.pointerId);
    current.ghost?.remove();
    current.row.classList.remove('drag-source');
    document.body.classList.remove('reordering');
    if (current.started) {
      if (!commit) {
        // Restore the original order before notifying the renderer.
        announce('Reordering cancelled.');
        onReorder(current.listId, null, current.taskId);
      } else {
        const ids = [...current.container.children].map(row => row.dataset.taskId);
        onReorder(current.listId, ids, current.taskId);
      }
    } else focusTask(current.taskId, 'drag');
  }
  document.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.started && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= 4) start();
  }, { passive: false, signal });
  document.addEventListener('pointerup', event => {
    if (drag && event.pointerId === drag.pointerId) {
      drag.x = event.clientX;
      drag.y = event.clientY;
      finish(true);
    }
  }, { signal });
  for (const name of ['pointercancel', 'lostpointercapture']) {
    capture.addEventListener(name, event => {
      if (drag && event.pointerId === drag.pointerId) finish(false);
    }, { signal });
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drag) { event.preventDefault(); finish(false); }
  }, { signal });
  window.addEventListener('blur', () => finish(false), { signal });
  return { createHandle, get active() { return Boolean(drag); },
    destroy() { finish(false); events.abort(); } };
}
