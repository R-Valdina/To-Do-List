/** Date-only values are local calendar days, never UTC instants. */
export function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}

export function parseDate(value) {
  return new Date(`${value}T12:00:00`);
}

export function isValidDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseDate(value);
  return !Number.isNaN(date.getTime()) && dateKey(date) === value;
}

export function formatDate(value) {
  return parseDate(value).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function daysUntil(value, now = new Date()) {
  const due = parseDate(value);
  return Math.round((Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()) -
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
}

export function deadline(value, complete = false, now = new Date()) {
  if (!value) return null;
  const days = daysUntil(value, now);
  if (complete) return { kind: 'complete', text: `Completed · Due ${formatDate(value)}` };
  if (days < 0) return { kind: 'overdue',
    text: `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue · ${formatDate(value)}` };
  if (days <= 1) return { kind: 'urgent', text: `Urgent · Due ${days === 0 ? 'today' : 'tomorrow'}` };
  if (days <= 3) return { kind: 'warning', text: `Due soon · ${days} days left · ${formatDate(value)}` };
  return { kind: 'normal', text: `Due ${formatDate(value)}` };
}
