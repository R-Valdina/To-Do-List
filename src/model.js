import { isValidDate } from './dates.js';
import { normalizeAppearance } from './themes.js';

export const SCHEMA_VERSION = 1;
export const PRIORITIES = ['Low', 'Medium', 'High'];
export const MAX_LISTS = 100;
export const MAX_TASKS = 5000;
export const createId = () => globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, lists: [], settings: { theme: 'light', sort: 'asc' } };
}

function requiredText(value, limit, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) {
    throw new Error(`${label} must contain 1–${limit} characters.`);
  }
  return value.trim();
}

function requiredDate(value) {
  if (!isValidDate(value)) throw new Error('A due date is invalid. Use YYYY-MM-DD.');
  return value;
}

/** Validate and copy only supported fields; imported objects never become app state directly. */
export function validateState(value) {
  if (!value || value.schemaVersion !== SCHEMA_VERSION) {
    throw new Error('This backup uses an unsupported format or version.');
  }
  if (!Array.isArray(value.lists) || value.lists.length > MAX_LISTS) {
    throw new Error(`A backup can contain at most ${MAX_LISTS} lists.`);
  }
  const ids = new Set();
  const names = new Set();
  let taskCount = 0;
  function id(value) {
    const result = requiredText(value, 150, 'ID');
    if (ids.has(result)) throw new Error('The backup contains duplicate IDs.');
    ids.add(result);
    return result;
  }
  const lists = value.lists.map(list => {
    if (!list || !Array.isArray(list.tasks)) throw new Error('A list is missing its tasks.');
    const name = requiredText(list.name, 70, 'List name');
    if (names.has(name.toLowerCase())) throw new Error('List names must be unique.');
    names.add(name.toLowerCase());
    const listId = id(list.id);
    taskCount += list.tasks.length;
    if (taskCount > MAX_TASKS) throw new Error(`A backup can contain at most ${MAX_TASKS} tasks.`);
    return {
      id: listId, name, due: requiredDate(list.due ?? ''),
      appearance: normalizeAppearance(list.appearance),
      tasks: list.tasks.map(task => {
        if (!task || !PRIORITIES.includes(task.priority) || typeof task.done !== 'boolean') {
          throw new Error('A task has an invalid priority or completion status.');
        }
        return { id: id(task.id), text: requiredText(task.text, 250, 'Task'),
          priority: task.priority, done: task.done, due: requiredDate(task.due) };
      }),
    };
  });
  return { schemaVersion: SCHEMA_VERSION, lists, settings: {
    theme: value.settings?.theme === 'dark' ? 'dark' : 'light',
    sort: value.settings?.sort === 'desc' ? 'desc' : 'asc',
  } };
}

export function listValues(values, lists, editingId = null) {
  const name = requiredText(values.name, 70, 'List name');
  if (lists.some(list => list.id !== editingId && list.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A list with this name already exists.');
  }
  return { name, due: requiredDate(values.due), appearance: normalizeAppearance(values.appearance) };
}

export function taskValues(values) {
  if (!PRIORITIES.includes(values.priority)) throw new Error('Select a valid priority.');
  return { text: requiredText(values.text, 250, 'Task'),
    priority: values.priority, due: requiredDate(values.due) };
}

export const isComplete = list => list.tasks.length > 0 && list.tasks.every(task => task.done);
export const progressText = list => `${list.tasks.filter(task => task.done).length} of ${list.tasks.length} done`;

export function listProgress(list) {
  const total = list.tasks.length;
  const done = list.tasks.filter(task => task.done).length;
  return { done, total, percent: total ? Math.round(done / total * 100) : 0 };
}

export function completionText(list) {
  const { done, total, percent } = listProgress(list);
  return `${done} of ${total} · ${percent}% complete`;
}

export function reorderTasks(list, ids) {
  const byId = new Map(list.tasks.map(task => [task.id, task]));
  if (ids.length !== list.tasks.length || new Set(ids).size !== ids.length ||
      !ids.every(id => byId.has(id))) throw new Error('Invalid task order.');
  list.tasks = ids.map(id => byId.get(id));
}
