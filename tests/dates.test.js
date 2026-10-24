import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, parseDate, isValidDate, daysUntil, deadline } from '../src/dates.js';
const now = new Date(2026, 9, 24, 23, 50);

test('date-only validation rejects rollover dates and timestamps', () => {
  assert.equal(isValidDate('2024-02-29'), true);
  for (const value of ['2026-02-29', '2026-02-30', '2026-13-01', '10/24/2026', '2026-10-24T00:00:00Z', null]) {
    assert.equal(isValidDate(value), false, String(value));
  }
  assert.equal(isValidDate(''), true);
});

test('date-only parsing preserves local day', () => {
  assert.equal(dateKey(parseDate('2026-10-24')), '2026-10-24');
  assert.equal(daysUntil('2026-10-25', now), 1);
  assert.equal(daysUntil('2026-10-23', now), -1);
});

for (const [due, kind] of [
  ['2026-10-23', 'overdue'], ['2026-10-24', 'urgent'], ['2026-10-25', 'urgent'],
  ['2026-10-26', 'warning'], ['2026-10-27', 'warning'], ['2026-10-28', 'normal'],
]) {
  test(`deadline ${due} has the correct threshold: ${kind}`, () => {
    assert.equal(deadline(due, false, now).kind, kind);
  });
}

test('completion suppresses warnings and missing deadlines show no status', () => {
  assert.equal(deadline('2026-10-20', true, now).kind, 'complete');
  assert.equal(deadline('', false, now), null);
});

test('calendar-day differences work across daylight saving changes', () => {
  assert.equal(daysUntil('2026-03-09', new Date(2026, 2, 7, 23)), 2);
  assert.equal(daysUntil('2026-11-02', new Date(2026, 9, 31, 23)), 2);
});
