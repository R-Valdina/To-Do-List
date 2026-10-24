import { createId, emptyState, validateState } from './model.js';

export const STORAGE_KEY = 'todo-list:state:v1';
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

function migrateOriginal(todos, settings) {
  if (!Array.isArray(todos)) throw new Error('Original task data is invalid.');
  const lists = new Map();
  for (const todo of todos) {
    if (!todo || typeof todo.content !== 'string' || typeof todo.done !== 'boolean') {
      throw new Error('An original task is invalid.');
    }
    const name = todo.category === 'personal' ? 'Personal' :
      todo.category === 'business' ? 'Work' : 'Imported tasks';
    if (!lists.has(name)) lists.set(name, { id: createId(), name, due: '',
      appearance: { color: name === 'Work' ? 'teal' : 'white', texture: 'plain' }, tasks: [] });
    // Preserve even blank or overlong original entries so migration never silently drops data.
    if (!todo.content.trim() || todo.content.trim().length > 250) {
      throw new Error('Some original tasks need repair before migration. The original data was preserved.');
    }
    lists.get(name).tasks.push({ id: createId(), text: todo.content,
      done: todo.done, priority: 'Medium', due: '' });
  }
  return validateState({ ...emptyState(), lists: [...lists.values()], settings });
}

export function decodeBackup(text) {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('Choose a JSON file under 2 MB.');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('The file is not valid JSON.'); }
  // Also accept the latest standalone mockup's exported list array.
  return validateState(Array.isArray(parsed) ? { ...emptyState(), lists: parsed } : parsed);
}

/** A read failure blocks writes until the user explicitly imports a replacement. */
export function createStorage(getStorage = () => globalThis.localStorage) {
  let blocked = false;
  let recoveryText = null;
  return {
    load() {
      try {
        const storage = getStorage();
        const current = storage.getItem(STORAGE_KEY);
        if (current !== null) {
          recoveryText = current;
          const state = decodeBackup(current);
          recoveryText = null;
          return { state, migrated: false };
        }
        const mockup = storage.getItem('todo-lists-mockup-v3');
        const original = storage.getItem('todos');
        const source = mockup ?? original;
        if (source === null) return { state: emptyState(), migrated: false };
        recoveryText = source;
        const settings = {
          theme: storage.getItem('todo-lists-theme') === 'dark' ? 'dark' : 'light',
          sort: storage.getItem('todo-lists-sort-order') === 'desc' ? 'desc' : 'asc',
        };
        const parsed = JSON.parse(source);
        const state = mockup !== null
          ? validateState({ ...emptyState(), lists: parsed, settings })
          : migrateOriginal(parsed, settings);
        recoveryText = null;
        return { state, migrated: true };
      } catch (error) {
        blocked = true;
        return { state: emptyState(), migrated: false, error:
          `Saved data could not be loaded. It has not been overwritten. ${error.message}` };
      }
    },
    save(state, { replace = false } = {}) {
      if (blocked && !replace) throw new Error('Saving is paused to protect existing data. Export it, then import a valid backup to recover.');
      const normalized = validateState(state);
      getStorage().setItem(STORAGE_KEY, JSON.stringify(normalized));
      blocked = false;
      recoveryText = null;
    },
    get recoveryText() { return recoveryText; },
  };
}
