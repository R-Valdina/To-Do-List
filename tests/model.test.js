import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, validateState, listValues, taskValues, reorderTasks, isComplete, progressText } from '../src/model.js';
import { normalizeAppearance } from '../src/themes.js';

const task = (id = 'task-1') => ({ id, text: 'Buy milk', due: '', priority: 'Medium', done: false });
const list = () => ({ id: 'list-1', name: 'Personal', due: '',
  appearance: { color: 'white', texture: 'plain' }, tasks: [task(), task('task-2')] });
const state = () => ({ ...emptyState(), lists: [list()] });

test('state validation copies only supported fields without mutating input', () => {
  const original = state();
  original.lists[0].tasks[0].unexpected = 'ignored';
  const result = validateState(original);
  result.lists[0].tasks[0].text = 'Changed';
  assert.equal(original.lists[0].tasks[0].text, 'Buy milk');
  assert.equal(result.lists[0].tasks[0].unexpected, undefined);
});

test('duplicate IDs across lists and tasks are rejected', () => {
  const value = state();
  value.lists[0].tasks[0].id = 'list-1';
  assert.throws(() => validateState(value), /duplicate IDs/);
});

test('duplicate list names, unsupported schema, invalid completion and priority are rejected', () => {
  const duplicate = state();
  duplicate.lists.push({ ...list(), id: 'list-2', name: 'PERSONAL', tasks: [] });
  assert.throws(() => validateState(duplicate), /unique/);
  assert.throws(() => validateState({ ...state(), schemaVersion: 999 }), /unsupported/);
  for (const change of [{ done: 'yes' }, { priority: 'critical' }]) {
    const value = state();
    Object.assign(value.lists[0].tasks[0], change);
    assert.throws(() => validateState(value), /invalid priority or completion/);
  }
});

test('invalid dates, missing descriptions, and excessive data are rejected', () => {
  assert.throws(() => taskValues({ text: '  ', due: '', priority: 'Low' }), /Task must/);
  assert.throws(() => taskValues({ text: 'x'.repeat(251), due: '', priority: 'Low' }), /Task must/);
  assert.throws(() => listValues({ name: 'Work', due: '2026-02-30' }, []), /due date/);
  assert.throws(() => validateState({ ...emptyState(), lists: Array(101).fill(list()) }), /100/);
});

test('list edits permit current name, reject conflicts, and trim task text', () => {
  assert.equal(listValues({ name: ' Personal ', due: '' }, [list()], 'list-1').name, 'Personal');
  assert.throws(() => listValues({ name: 'personal', due: '' }, [list()]), /already exists/);
  assert.equal(taskValues({ text: '  milk  ', due: '', priority: 'High' }).text, 'milk');
});

test('reordering retains task identity, content and completion', () => {
  const value = list();
  value.tasks[0].done = true;
  const first = value.tasks[0];
  reorderTasks(value, ['task-2', 'task-1']);
  assert.equal(value.tasks[1], first);
  assert.equal(value.tasks[1].done, true);
  assert.equal(progressText(value), '1 of 2 done');
});

test('incomplete, duplicate or unknown task orders never mutate the list', () => {
  for (const ids of [[], ['task-1'], ['task-1', 'task-1'], ['task-1', 'unknown']]) {
    const value = list();
    const before = structuredClone(value);
    assert.throws(() => reorderTasks(value, ids), /Invalid task order/);
    assert.deepEqual(value, before);
  }
});

test('empty lists are not complete, progress is scoped to a list', () => {
  assert.equal(isComplete({ tasks: [] }), false);
  const value = list();
  value.tasks.forEach(task => { task.done = true; });
  assert.equal(isComplete(value), true);
  assert.equal(progressText(value), '2 of 2 done');
});

test('legacy themes migrate and unknown appearance cannot inject CSS', () => {
  assert.deepEqual(normalizeAppearance({ color: 'creamy', texture: 'grid' }), { color: 'white', texture: 'grid' });
  assert.deepEqual(normalizeAppearance({ color: 'violet', texture: 'dots' }), { color: 'dressBlues', texture: 'dots' });
  assert.deepEqual(normalizeAppearance({ color: 'url(evil)', texture: 'url(evil)' }), { color: 'white', texture: 'plain' });
});
