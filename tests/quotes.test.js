import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuoteSource, parseQuotes, QUOTE_API, QUOTE_CACHE_KEY, QUOTE_CACHE_TTL, LOCAL_QUOTES } from '../src/quotes.js';

const quotes = [
  { content: 'Small steps count.', author: 'Example author' },
  { content: 'Your tabs can wait.', author: 'Another author' },
];
function memory(value = null) {
  const data = new Map(value ? [[QUOTE_CACHE_KEY, value]] : []);
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('quote responses are bounded, normalized, deduplicated and validated', () => {
  assert.deepEqual(parseQuotes(null), []);
  const parsed = parseQuotes([quotes[0], quotes[0], {}, { content: ' ', author: 'X' },
    { content: 'x'.repeat(241), author: 'X' }, { content: 'Hi', author: 123 }]);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0], { ...quotes[0], source: 'quotable' });
});

test('a local quote is immediately available and next avoids repeating it', () => {
  const source = createQuoteSource({ random: () => 0 });
  const first = source.next();
  assert.equal(first.source, 'local');
  assert.notEqual(source.next(first.content).content, first.content);
  assert.ok(LOCAL_QUOTES.length > 1);
});

test('live API request sends no cookies, referrer, or task data and caches validated quotes', async () => {
  const storage = memory();
  const calls = [];
  const source = createQuoteSource({ getStorage: () => storage, now: () => 1000, random: () => 0,
    fetcher: async (...args) => { calls.push(args); return { ok: true, json: async () => quotes }; } });
  assert.equal(await source.load(), true);
  assert.equal(calls[0][0], QUOTE_API);
  assert.equal(calls[0][1].credentials, 'omit');
  assert.equal(calls[0][1].referrerPolicy, 'no-referrer');
  assert.equal(calls[0][1].body, undefined);
  assert.equal(source.next().source, 'quotable');
  assert.equal(JSON.parse(storage.getItem(QUOTE_CACHE_KEY)).savedAt, 1000);
  assert.equal(await source.load(), true);
  assert.equal(calls.length, 1);
});

test('fresh cache avoids network calls', async () => {
  const storage = memory(JSON.stringify({ savedAt: 100, quotes }));
  const source = createQuoteSource({ getStorage: () => storage, now: () => 200,
    fetcher: async () => { throw new Error('Network should not be used'); } });
  assert.equal(await source.load(), true);
  assert.equal(source.next().source, 'quotable');
});

test('expired, malformed and future-dated caches trigger a fresh request', async () => {
  for (const cache of ['broken', JSON.stringify({ savedAt: 0, quotes }),
    JSON.stringify({ savedAt: QUOTE_CACHE_TTL * 3, quotes })]) {
    let called = false;
    const source = createQuoteSource({ getStorage: () => memory(cache), now: () => QUOTE_CACHE_TTL + 1,
      fetcher: async () => { called = true; return { ok: true, json: async () => quotes }; } });
    assert.equal(await source.load(), true);
    assert.equal(called, true);
  }
});

test('HTTP errors, invalid JSON, invalid quote responses and offline failures keep local quotes', async () => {
  for (const fetcher of [
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw new Error('Bad JSON'); } }),
    async () => ({ ok: true, json: async () => [{}] }),
    async () => { throw new Error('Offline'); },
  ]) {
    const source = createQuoteSource({ getStorage: () => memory(), fetcher });
    assert.equal(await source.load(), false);
    assert.equal(source.next().source, 'local');
  }
});

test('blocked browser storage does not prevent fetching or displaying quotes', async () => {
  const source = createQuoteSource({ getStorage: () => { throw new Error('Storage blocked'); },
    fetcher: async () => ({ ok: true, json: async () => quotes }) });
  assert.equal(await source.load(), true);
  assert.equal(source.next().source, 'quotable');
});

test('concurrent loads share one request', async () => {
  let count = 0;
  const source = createQuoteSource({ getStorage: () => memory(), fetcher: async () => {
    count++;
    return { ok: true, json: async () => quotes };
  } });
  assert.deepEqual(await Promise.all([source.load(), source.load()]), [true, true]);
  assert.equal(count, 1);
});

test('a slow request is aborted and falls back rather than hanging', async () => {
  const source = createQuoteSource({ getStorage: () => memory(), timeoutMs: 5,
    fetcher: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
    }) });
  assert.equal(await source.load(), false);
  assert.equal(source.next().source, 'local');
});
