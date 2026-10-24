/** Quotable is free/open source (MIT); only this public request leaves the app. */
export const QUOTE_API = 'https://api.quotable.io/quotes/random?tags=motivational%7Cinspirational%7Chumorous&maxLength=180&limit=20';
export const QUOTE_CACHE_KEY = 'todo-list:quotes:v1';
export const QUOTE_CACHE_TTL = 24 * 60 * 60 * 1000;
export const QUOTE_INTERVAL = 5 * 60 * 1000;

// Original app copy, not quotations attributed to historical people.
export const LOCAL_QUOTES = [
  'One task at a time. Your tabs can wait.',
  'Future you would like to thank present you. Present you would like a snack.',
  'Progress counts, even when it arrives wearing slippers.',
  'A small step still beats a very detailed plan to take a step.',
  'Your to-do list is a menu, not a personality test.',
  'Start with the tiny task. Let momentum do the heavy lifting.',
  'You do not have to finish everything to make today count.',
  'Crossing off a task: the smallest celebration with the best stationery.',
].map(content => ({ content, author: 'To-Do List', source: 'local' }));

export function parseQuotes(data) {
  if (!Array.isArray(data)) return [];
  const seen = new Set();
  return data.slice(0, 50).flatMap(item => {
    if (!item || typeof item.content !== 'string' || typeof item.author !== 'string') return [];
    const content = item.content.trim();
    const author = item.author.trim();
    if (!content || content.length > 240 || !author || author.length > 100 || seen.has(content)) return [];
    seen.add(content);
    return [{ content, author, source: 'quotable' }];
  });
}

export function createQuoteSource({
  fetcher = (...args) => globalThis.fetch(...args),
  getStorage = () => globalThis.localStorage,
  now = Date.now,
  random = Math.random,
  timeoutMs = 5000,
} = {}) {
  let pool = [...LOCAL_QUOTES];
  let pending;
  let loaded = false;

  function readCache() {
    try {
      const data = JSON.parse(getStorage().getItem(QUOTE_CACHE_KEY));
      if (!data || !Number.isFinite(data.savedAt) || data.savedAt > now() ||
          now() - data.savedAt >= QUOTE_CACHE_TTL) return false;
      const quotes = parseQuotes(data.quotes);
      if (!quotes.length) return false;
      pool = quotes;
      return true;
    } catch { return false; }
  }
  async function fetchQuotes() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(QUOTE_API, {
        signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
      });
      if (!response.ok) return false;
      const quotes = parseQuotes(await response.json());
      if (!quotes.length) return false;
      pool = quotes;
      try {
        getStorage().setItem(QUOTE_CACHE_KEY, JSON.stringify({ savedAt: now(), quotes }));
      } catch { /* A quote-cache failure must never interfere with task storage. */ }
      return true;
    } catch { return false; }
    finally { clearTimeout(timeout); }
  }
  return {
    load() {
      if (pending) return pending;
      if (loaded) return Promise.resolve(pool[0]?.source === 'quotable');
      loaded = true;
      if (readCache()) return Promise.resolve(true);
      pending = fetchQuotes();
      return pending;
    },
    next(previousContent = '') {
      const choices = pool.filter(quote => quote.content !== previousContent);
      const available = choices.length ? choices : pool;
      const index = Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)));
      return available[index];
    },
  };
}
