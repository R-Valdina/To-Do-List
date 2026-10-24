import { createQuoteSource, QUOTE_INTERVAL } from '../quotes.js';

/** Optional sidebar content: automatic changes are not live-announced. */
export function createQuoteCard(root) {
  const source = createQuoteSource();
  const text = root.querySelector('[data-quote-text]');
  const author = root.querySelector('[data-quote-author]');
  const credit = root.querySelector('[data-quote-credit]');
  const next = root.querySelector('[data-quote-next]');
  const pause = root.querySelector('[data-quote-pause]');
  const status = root.querySelector('[data-quote-status]');
  let current = '';
  let paused = false;
  let timer;
  let destroyed = false;

  function show(manual = false) {
    const quote = source.next(current);
    current = quote.content;
    text.textContent = quote.content;
    author.textContent = `— ${quote.author}`;
    credit.hidden = quote.source !== 'quotable';
    if (manual) status.textContent = `New quote: ${quote.content} By ${quote.author}.`;
  }
  function schedule() {
    clearInterval(timer);
    if (!paused && !document.hidden) {
      timer = setInterval(() => {
        // Do not change something while the user is interacting with the card.
        if (!root.contains(document.activeElement)) show();
      }, QUOTE_INTERVAL);
    }
  }
  function onNext() { show(true); schedule(); }
  function onPause() {
    paused = !paused;
    pause.setAttribute('aria-pressed', String(paused));
    pause.textContent = paused ? 'Resume' : 'Pause';
    pause.setAttribute('aria-label', paused ? 'Resume quote rotation' : 'Pause quote rotation');
    status.textContent = paused ? 'Automatic quote rotation paused.' : 'Automatic quote rotation resumed.';
    schedule();
  }
  next.addEventListener('click', onNext);
  pause.addEventListener('click', onPause);
  document.addEventListener('visibilitychange', schedule);
  show();
  schedule();
  source.load().then(online => { if (online && !destroyed && !paused) show(); });
  return {
    destroy() {
      destroyed = true;
      clearInterval(timer);
      next.removeEventListener('click', onNext);
      pause.removeEventListener('click', onPause);
      document.removeEventListener('visibilitychange', schedule);
    },
  };
}
