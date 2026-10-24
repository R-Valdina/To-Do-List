import { COLORS, TEXTURES, normalizeAppearance, applyAppearance, textureImage } from '../themes.js';
import { PRIORITIES } from '../model.js';
import { formatDate } from '../dates.js';
import { $, element, button, showError } from './dom.js';
import { createDatePicker } from './calendar.js';

/** Forms own draft state; only submitting a form commits changes. */
export function createEditors({ getState, onSaveList, onSaveTask }) {
  let listId = null;
  let taskListId = null;
  let taskId = null;
  let priority = 'Medium';
  let appearance = normalizeAppearance();
  const openers = new WeakMap();
  const listDate = createDatePicker($('#list-date-picker'), 'list-due-label', updatePreview);
  const taskDate = createDatePicker($('#task-date-picker'), 'task-due-label');
  listDate.set('');
  taskDate.set('');

  function show(dialog, opener) {
    document.querySelectorAll('details[open]').forEach(item => { item.open = false; });
    openers.set(dialog, opener ?? document.activeElement);
    dialog.showModal();
    dialog.querySelector('.modal-body').scrollTop = 0;
  }
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {
      const opener = openers.get(dialog);
      (opener?.isConnected ? opener : $('#new-list')).focus();
    });
  });
  document.querySelectorAll('[data-close]').forEach(control => {
    control.addEventListener('click', () => document.getElementById(control.dataset.close).close());
  });

  Object.entries(COLORS).forEach(([key, color]) => {
    const control = button('', 'color-button', () => { appearance.color = key; updatePreview(); });
    control.dataset.color = key;
    control.title = color.name;
    control.setAttribute('aria-label', color.name);
    control.style.setProperty('--swatch', color.base);
    $('#colors').append(control);
  });
  Object.entries(TEXTURES).forEach(([key, name]) => {
    const control = button('', 'texture-button', () => { appearance.texture = key; updatePreview(); });
    control.dataset.texture = key;
    const sample = element('span', 'texture-sample');
    sample.setAttribute('aria-hidden', 'true');
    control.append(sample, element('span', '', name));
    $('#textures').append(control);
  });
  PRIORITIES.forEach(value => {
    const control = button(value, `priority-option priority-${value.toLowerCase()}`, () => setPriority(value));
    control.dataset.priority = value;
    $('#priority-options').append(control);
  });
  function setPriority(value) {
    priority = value;
    $('#priority-options').querySelectorAll('button').forEach(control => {
      control.setAttribute('aria-pressed', control.dataset.priority === value);
    });
  }
  function updatePreview() {
    const dark = getState().settings.theme === 'dark';
    applyAppearance($('#list-preview'), appearance, dark);
    $('#preview-name').textContent = $('#list-name').value.trim() || 'Your list';
    $('#preview-due').textContent = listDate.value ? `List due ${formatDate(listDate.value)}` : 'No list deadline';
    $('#selected-color-name').textContent = COLORS[appearance.color].name;
    $('#colors').querySelectorAll('button').forEach(control => {
      control.setAttribute('aria-pressed', control.dataset.color === appearance.color);
    });
    $('#textures').querySelectorAll('button').forEach(control => {
      const key = control.dataset.texture;
      control.setAttribute('aria-pressed', key === appearance.texture);
      const sample = control.querySelector('.texture-sample');
      sample.style.backgroundImage = textureImage(key, dark);
      sample.style.backgroundSize = key === 'dots' ? '12px 12px' : key === 'grid' ? '16px 16px' : 'auto';
    });
  }
  $('#list-name').addEventListener('input', () => { showError($('#list-form-error')); updatePreview(); });
  $('#task-text').addEventListener('input', () => showError($('#task-form-error')));
  $('#reset-appearance').addEventListener('click', () => { appearance = normalizeAppearance(); updatePreview(); });
  $('#list-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const result = onSaveList(listId, {
        name: $('#list-name').value, due: listDate.value, appearance: { ...appearance },
      });
      $('#list-dialog').close();
      requestAnimationFrame(() => result?.());
    } catch (error) { showError($('#list-form-error'), error.message); }
  });
  $('#task-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const result = onSaveTask(taskListId, taskId, {
        text: $('#task-text').value, priority, due: taskDate.value,
      });
      $('#task-dialog').close();
      requestAnimationFrame(() => result?.());
    } catch (error) { showError($('#task-form-error'), error.message); }
  });
  $('#task-text').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); $('#task-form').requestSubmit(); }
  });
  return {
    show,
    refresh: updatePreview,
    openList(list = null, opener = null) {
      listId = list?.id ?? null;
      $('#list-dialog-title').textContent = list ? 'Edit list' : 'Create list';
      $('#list-name').value = list?.name ?? '';
      appearance = normalizeAppearance(list?.appearance);
      listDate.set(list?.due ?? '');
      showError($('#list-form-error'));
      updatePreview();
      show($('#list-dialog'), opener);
      $('#list-name').focus();
    },
    openTask(list, task = null, opener = null) {
      taskListId = list.id;
      taskId = task?.id ?? null;
      $('#task-dialog-title').textContent = `${task ? 'Edit task' : 'Add task'} · ${list.name}`;
      $('#task-list-deadline').textContent = list.due ? `List deadline: ${formatDate(list.due)}` : 'This list has no deadline.';
      $('#task-text').value = task?.text ?? '';
      setPriority(task?.priority ?? 'Medium');
      taskDate.set(task?.due ?? '');
      showError($('#task-form-error'));
      show($('#task-dialog'), opener);
      $('#task-text').focus();
    },
  };
}
