import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nightOf,
  addDays,
  computeStreak,
  longestStreak,
  nightRuns,
  daysBetween,
  lastNights,
  nightDate,
} from './streak';

/**
 * Run with `npm test`. No test framework — Node strips the types and runs the
 * file directly, which is only possible because `streak.ts` imports nothing.
 *
 * Dates are constructed with `new Date(y, m, d, h, m)` rather than ISO strings
 * so every case is in local time. The whole point of a night boundary is that
 * it follows the person, not UTC.
 */

test('nightOf: a wind-down after midnight belongs to the night before', () => {
  assert.equal(nightOf(new Date(2026, 6, 10, 21, 0)), '2026-07-10');
  assert.equal(nightOf(new Date(2026, 6, 11, 0, 30)), '2026-07-10');
  assert.equal(nightOf(new Date(2026, 6, 11, 3, 59)), '2026-07-10');
  assert.equal(nightOf(new Date(2026, 6, 11, 4, 0)), '2026-07-11', '4am starts the new night');
});

test('addDays crosses month, year and leap-day boundaries', () => {
  assert.equal(addDays('2026-07-01', -1), '2026-06-30');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2028-03-01', -1), '2028-02-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('computeStreak counts consecutive nights back from tonight', () => {
  const now = new Date(2026, 6, 10, 22, 0); // tonight = 2026-07-10

  assert.equal(computeStreak([], now), 0);
  assert.equal(computeStreak(['2026-07-10'], now), 1);
  assert.equal(computeStreak(['2026-07-10', '2026-07-09', '2026-07-08'], now), 3);
  assert.equal(computeStreak(['2026-07-10', '2026-07-08'], now), 1, 'a gap ends it');
  assert.equal(computeStreak(['2026-07-08', '2026-07-10', '2026-07-09'], now), 3, 'unsorted');
  assert.equal(computeStreak(['2026-07-10', '2026-07-10', '2026-07-09'], now), 2, 'duplicates');
});

test('computeStreak holds through the day before tonight has happened', () => {
  const now = new Date(2026, 6, 10, 22, 0);

  // Otherwise a streak would read zero from 4am until you did that night's
  // routine, which is the whole day you most want to see it.
  assert.equal(computeStreak(['2026-07-09', '2026-07-08'], now), 2);
  assert.equal(computeStreak(['2026-07-08', '2026-07-07'], now), 0, 'but only one night of grace');
});

test('computeStreak spans a month boundary', () => {
  const now = new Date(2026, 7, 1, 23, 0);
  assert.equal(computeStreak(['2026-08-01', '2026-07-31', '2026-07-30'], now), 3);
});

test('a finish just after midnight extends rather than breaks', () => {
  const pastMidnight = new Date(2026, 6, 11, 0, 45); // still the night of 07-10
  assert.equal(computeStreak(['2026-07-10', '2026-07-09'], pastMidnight), 2);
});

test('longestStreak finds the best run ever recorded', () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(['2026-07-10']), 1);
  assert.equal(longestStreak(['2026-07-08', '2026-07-09', '2026-07-10']), 3);
  assert.equal(
    longestStreak(['2026-07-01', '2026-07-02', '2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08']),
    4,
    'picks the longer of two runs'
  );
  assert.equal(longestStreak(['2026-07-10', '2026-07-08', '2026-07-09']), 3, 'unsorted');
  assert.equal(longestStreak(['2026-07-08', '2026-07-08', '2026-07-09']), 2, 'duplicates');
  assert.equal(longestStreak(['2026-06-29', '2026-06-30', '2026-07-01']), 3, 'across a month');
  assert.equal(longestStreak(['2025-12-31', '2026-01-01']), 2, 'across a year');
  assert.equal(longestStreak(['2026-07-01', '2026-07-05', '2026-07-09']), 1, 'isolated nights');
});

test('nightRuns returns every run, oldest first, with its ends', () => {
  assert.deepEqual(nightRuns([]), []);
  assert.deepEqual(nightRuns(['2026-07-10']), [
    { start: '2026-07-10', end: '2026-07-10', length: 1 },
  ]);
  assert.deepEqual(nightRuns(['2026-07-02', '2026-06-30', '2026-07-01', '2026-07-09']), [
    { start: '2026-06-30', end: '2026-07-02', length: 3 },
    { start: '2026-07-09', end: '2026-07-09', length: 1 },
  ]);
  assert.deepEqual(
    nightRuns(['2026-07-01', '2026-07-01', '2026-07-02']),
    [{ start: '2026-07-01', end: '2026-07-02', length: 2 }],
    'duplicates'
  );
});

test('daysBetween counts whole nights in both directions', () => {
  assert.equal(daysBetween('2026-07-03', '2026-07-10'), 7);
  assert.equal(daysBetween('2026-07-10', '2026-07-10'), 0);
  assert.equal(daysBetween('2026-07-10', '2026-07-03'), -7);
  assert.equal(daysBetween('2026-06-28', '2026-07-02'), 4, 'across a month');
  // A span containing a daylight-saving change is 23 or 25 hours to the day, so
  // dividing exactly would report 6.96 nights as six.
  assert.equal(daysBetween('2026-04-01', '2026-04-08'), 7);
  assert.equal(daysBetween('2026-10-01', '2026-10-08'), 7);
});

test('lastNights returns a window ending tonight, oldest first', () => {
  const at = new Date(2026, 6, 10, 22, 0);
  assert.deepEqual(lastNights(7, at), [
    '2026-07-04',
    '2026-07-05',
    '2026-07-06',
    '2026-07-07',
    '2026-07-08',
    '2026-07-09',
    '2026-07-10',
  ]);
  assert.deepEqual(lastNights(3, new Date(2026, 6, 11, 1, 0)), [
    '2026-07-08',
    '2026-07-09',
    '2026-07-10',
  ]);
});

test('nightDate parses a key back to local midnight', () => {
  const d = nightDate('2026-07-10');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 6);
  assert.equal(d.getDate(), 10);
  assert.equal(d.getHours(), 0);
});
