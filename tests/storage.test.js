import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, decodeBackup, STORAGE_KEY } from '../src/storage.js';
import { emptyState } from '../src/model.js';

function memory(entries = {}) {
  const map = new Map(Object.entries(entries));
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map };
}
const mockup = [{ id: 'l1', name: 'Work', due: '', appearance: { color: 'creamy', texture: 'grid' },
  tasks: [{ id: 't1', text: 'Test', done: true, priority: 'High', due: '2026-10-24' }] }];

test('fresh storage starts empty with no demo tasks', () => {
  const store = createStorage(() => memory());
  assert.deepEqual(store.load().state, emptyState());
});

test('JSON backup roundtrips with version and settings', () => {
  const backend = memory();
  const store = createStorage(() => backend);
  const state = { ...emptyState(), settings: { theme: 'dark', sort: 'desc' } };
  store.save(state);
  assert.deepEqual(store.load().state, state);
  assert.deepEqual(decodeBackup(backend.getItem(STORAGE_KEY)), state);
});

test('latest mockup migrates without deleting source, preserving order and settings', () => {
  const raw = JSON.stringify(mockup);
  const backend = memory({ 'todo-lists-mockup-v3': raw, 'todo-lists-theme': 'dark', 'todo-lists-sort-order': 'desc' });
  const store = createStorage(() => backend);
  const loaded = store.load();
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.state.lists[0].appearance.color, 'white');
  assert.equal(loaded.state.lists[0].tasks[0].done, true);
  assert.deepEqual(loaded.state.settings, { theme: 'dark', sort: 'desc' });
  store.save(loaded.state);
  assert.equal(backend.getItem('todo-lists-mockup-v3'), raw);
});

test('original todos migrate to Personal and Work without losing task text', () => {
  const todos = [{ content: 'say "hello"', category: 'personal', done: false },
    { content: 'Proposal', category: 'business', done: true }];
  const backend = memory({ todos: JSON.stringify(todos) });
  const loaded = createStorage(() => backend).load();
  assert.equal(loaded.migrated, true);
  assert.deepEqual(loaded.state.lists.map(list => list.name), ['Personal', 'Work']);
  assert.equal(loaded.state.lists[0].tasks[0].text, 'say "hello"');
  assert.equal(loaded.state.lists[1].tasks[0].done, true);
  assert.equal(backend.getItem('todos'), JSON.stringify(todos));
});

test('malformed saved JSON blocks writes and is retained for recovery export', () => {
  const backend = memory({ [STORAGE_KEY]: '{broken' });
  const store = createStorage(() => backend);
  assert.match(store.load().error, /not been overwritten/);
  assert.throws(() => store.save(emptyState()), /paused/);
  assert.equal(backend.getItem(STORAGE_KEY), '{broken');
  assert.equal(store.recoveryText, '{broken');
  store.save(emptyState(), { replace: true });
  assert.equal(store.recoveryText, null);
  assert.deepEqual(store.load().state, emptyState());
});

test('invalid original tasks block migration rather than silently discarding data', () => {
  const backend = memory({ todos: JSON.stringify([{ content: '', done: false }]) });
  const store = createStorage(() => backend);
  assert.match(store.load().error, /preserved/);
  assert.throws(() => store.save(emptyState()), /paused/);
});

test('unavailable and full storage report errors rather than success', () => {
  const unavailable = createStorage(() => { throw new Error('Access denied'); });
  assert.match(unavailable.load().error, /Access denied/);
  const full = createStorage(() => ({ getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); } }));
  assert.throws(() => full.save(emptyState()), /Quota exceeded/);
});

test('invalid or oversized imports are rejected before replacing saved data', () => {
  assert.throws(() => decodeBackup('not json'), /not valid JSON/);
  assert.throws(() => decodeBackup(JSON.stringify({ schemaVersion: 900, lists: [] })), /unsupported/);
  assert.throws(() => decodeBackup(' '.repeat(2 * 1024 * 1024 + 1)), /under 2 MB/);
  assert.equal(decodeBackup(JSON.stringify(mockup)).lists[0].name, 'Work');
});

test('canonical state takes precedence over legacy browser data', () => {
  const backend = memory({ [STORAGE_KEY]: JSON.stringify(emptyState()), 'todo-lists-mockup-v3': JSON.stringify(mockup) });
  const loaded = createStorage(() => backend).load();
  assert.equal(loaded.migrated, false);
  assert.equal(loaded.state.lists.length, 0);
});
