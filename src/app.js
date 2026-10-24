import { createId, listValues, taskValues, reorderTasks, MAX_LISTS, MAX_TASKS } from './model.js';
import { dateKey } from './dates.js';
import { createStorage, decodeBackup, MAX_IMPORT_BYTES } from './storage.js';
import { $, showError, focusTask } from './ui/dom.js';
import { createEditors } from './ui/editors.js';
import { createDragController } from './ui/drag.js';
import { renderApp } from './ui/render.js';

const storage = createStorage();
const loaded = storage.load();
let state = loaded.state;
const view = { selected: 'all' };
let deleted = null;
let pendingImport = null;

function announce(message) { $('#status').textContent = message; }
function persist(message) {
  try {
    storage.save(state);
    showError($('#storage-error'));
    announce(message);
  } catch (error) {
    showError($('#storage-error'), `${error.message} Changes remain available in this tab; export JSON before closing it.`);
  }
}
function findList(id) {
  const list = state.lists.find(list => list.id === id);
  if (!list) throw new Error('This list no longer exists.');
  return list;
}
function redraw() { renderApp(state, view, actions, drag); }
function clearSearch() { $('#search').value = ''; }

const editors = createEditors({
  getState: () => state,
  onSaveList(id, values) {
    const parsed = listValues(values, state.lists, id);
    if (id) Object.assign(findList(id), parsed);
    else {
      if (state.lists.length >= MAX_LISTS) throw new Error(`You can create up to ${MAX_LISTS} lists.`);
      const list = { id: createId(), ...parsed, tasks: [] };
      state.lists.push(list);
      view.selected = list.id;
      clearSearch();
    }
    persist(id ? 'List updated.' : 'List created.');
    redraw();
    return () => $('#navigation .active')?.focus();
  },
  onSaveTask(listId, id, values) {
    const list = findList(listId);
    const parsed = taskValues(values);
    let task = list.tasks.find(task => task.id === id);
    if (id && !task) throw new Error('This task no longer exists.');
    if (task) Object.assign(task, parsed);
    else {
      if (state.lists.reduce((sum, list) => sum + list.tasks.length, 0) >= MAX_TASKS) {
        throw new Error(`You can create up to ${MAX_TASKS} tasks.`);
      }
      task = { id: createId(), ...parsed, done: false };
      list.tasks.push(task);
    }
    clearSearch();
    persist(id ? 'Task updated.' : 'Task added.');
    redraw();
    return () => focusTask(task.id);
  },
});

const drag = createDragController({
  announce,
  onReorder(listId, ids, taskId) {
    try {
      const list = findList(listId);
      if (ids) {
        reorderTasks(list, ids);
        persist(`Task moved to position ${ids.indexOf(taskId) + 1} in ${list.name}.`);
      }
    } catch (error) { announce(error.message); }
    redraw();
    focusTask(taskId, 'drag');
  },
});

const actions = {
  navigate(id) {
    view.selected = id;
    clearSearch();
    redraw();
    $('#navigation .active')?.focus();
  },
  editList: (list, opener) => editors.openList(list, opener),
  editTask: (list, task, opener) => editors.openTask(list, task, opener),
  completeTask(listId, id, done) {
    const task = findList(listId).tasks.find(task => task.id === id);
    task.done = done;
    persist(done ? 'Task completed.' : 'Task marked active.');
    redraw();
    focusTask(id, 'check');
  },
  deleteTask(listId, id) {
    const list = findList(listId);
    const index = list.tasks.findIndex(task => task.id === id);
    deleted = { listId, index, task: list.tasks[index] };
    list.tasks.splice(index, 1);
    persist('Task deleted. Undo is available until the next deletion or you dismiss it.');
    redraw();
    $('#toast').hidden = false;
    $('#undo').focus();
  },
};

$('#undo').addEventListener('click', () => {
  if (!deleted) return;
  const { listId, index, task } = deleted;
  findList(listId).tasks.splice(index, 0, task);
  deleted = null;
  $('#toast').hidden = true;
  persist('Task restored.');
  redraw();
  focusTask(task.id);
});
$('#dismiss-undo').addEventListener('click', () => {
  deleted = null;
  $('#toast').hidden = true;
  $('#new-list').focus();
});
$('#new-list').addEventListener('click', () => editors.openList(null, $('#new-list')));
$('#top-add-task').addEventListener('click', () => editors.openTask(findList(view.selected), null, $('#top-add-task')));
$('#search').addEventListener('input', redraw);
$('#sort-lists').addEventListener('click', () => {
  state.settings.sort = state.settings.sort === 'asc' ? 'desc' : 'asc';
  persist(state.settings.sort === 'asc' ? 'Lists sorted A to Z.' : 'Lists sorted Z to A.');
  redraw();
});
$('#theme').addEventListener('click', () => {
  state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
  persist('Theme updated.');
  redraw();
  editors.refresh();
});

document.addEventListener('click', event => {
  document.querySelectorAll('details[open]').forEach(details => {
    if (!details.contains(event.target)) details.open = false;
  });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
    const details = document.querySelector('details[open]');
    if (details) { details.open = false; details.querySelector('summary').focus(); }
  }
});

$('#export').addEventListener('click', () => {
  const recovery = storage.recoveryText;
  const text = recovery ?? JSON.stringify(state, null, 2);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${recovery !== null ? 'todo-list-recovery' : 'todo-list-backup'}-${dateKey(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce(recovery !== null ? 'Exported the original saved data for recovery.' : 'JSON backup exported. Keep it in a safe location.');
});
$('#import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('Choose a JSON file under 2 MB.');
    pendingImport = decodeBackup(await file.text());
    const count = pendingImport.lists.reduce((sum, list) => sum + list.tasks.length, 0);
    $('#import-summary').textContent = `This backup contains ${pendingImport.lists.length} lists and ${count} tasks. It will replace your current ${state.lists.length} lists.`;
    showError($('#import-error'));
    editors.show($('#import-dialog'), $('#import'));
  } catch (error) {
    pendingImport = null;
    announce(`Import cancelled: ${error.message} Your current data was not changed.`);
  }
});
$('#import-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!pendingImport) return;
  try {
    // Persist first. An unavailable browser store must not destroy current in-memory data.
    storage.save(pendingImport, { replace: true });
    state = pendingImport;
    pendingImport = null;
    deleted = null;
    $('#toast').hidden = true;
    view.selected = 'all';
    clearSearch();
    showError($('#storage-error'));
    $('#import-dialog').close();
    redraw();
    editors.refresh();
    announce('Backup imported. Lists and settings were restored.');
  } catch (error) { showError($('#import-error'), error.message); }
});
$('#import-dialog').addEventListener('close', () => { pendingImport = null; });

function updateDate() {
  $('#date').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}
function refreshDeadlines() {
  updateDate();
  if (!drag.active && !document.querySelector('dialog[open], details[open]') &&
      !document.activeElement?.closest('#lists, #navigation')) redraw();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDeadlines(); });
setInterval(refreshDeadlines, 60000);

showError($('#storage-error'), loaded.error ?? '');
updateDate();
redraw();
editors.refresh();
if (loaded.migrated) persist('Your existing lists and tasks were migrated. Original browser data was kept.');
