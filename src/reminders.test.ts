import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVERY_NIGHT,
  WEEKNIGHTS,
  WEEKENDS,
  type Reminder,
  type Weekday,
  describeNights,
  expandSchedules,
  expoWeekday,
  fireAtOn,
  fireDay,
  keyPrefix,
  minutesBetween,
  nextFireAt,
  normaliseReminder,
  ownsKey,
  sameNights,
  sortNights,
  toggleNight,
} from './reminders';

/**
 * Dates are built with local components throughout, for the same reason
 * `streak.test.ts` does it: a reminder fires at a wall-clock time in the room
 * the phone is in, and nothing here is meaningful in UTC.
 */

function reminder(over: Partial<Reminder> = {}): Reminder {
  return { id: 'wind-down', hour: 21, minute: 30, enabled: true, nights: EVERY_NIGHT, ...over };
}

test('nights are sorted, deduped and toggled without mutating the input', () => {
  const start: Weekday[] = [3, 1];
  assert.deepEqual(sortNights([6, 0, 6, 3]), [0, 3, 6]);
  assert.deepEqual(toggleNight(start, 0), [0, 1, 3]);
  assert.deepEqual(toggleNight(start, 3), [1]);
  assert.deepEqual(start, [3, 1], 'the caller keeps its array');

  assert.ok(sameNights([2, 0, 1], [0, 1, 2]), 'order does not matter');
  assert.ok(!sameNights([0, 1], [0, 1, 2]));
});

test('a reminder before 4am fires on the morning after the night it names', () => {
  // The point of the whole `nights` concept: lights out at half past midnight
  // on Sunday night is a Monday event.
  assert.equal(fireDay(0, 0), 1, 'Sunday night at midnight fires Monday');
  assert.equal(fireDay(6, 1), 0, 'Saturday night wraps to Sunday');
  assert.equal(fireDay(0, 3), 1, 'still the night before at 3am');

  assert.equal(fireDay(0, 4), 0, '4am is the cutoff, matching streak.ts');
  assert.equal(fireDay(0, 21), 0, 'an evening time fires on its own night');
});

test('expo numbers weekdays from one, with Sunday first', () => {
  assert.equal(expoWeekday(0), 1, 'Sunday');
  assert.equal(expoWeekday(6), 7, 'Saturday');
});

test('a reminder that is off, or has no nights, expands to nothing', () => {
  assert.deepEqual(expandSchedules(reminder({ enabled: false })), []);
  assert.deepEqual(expandSchedules(reminder({ nights: [] })), []);
});

test('every night collapses to one daily schedule, not seven weekly ones', () => {
  const specs = expandSchedules(reminder());
  assert.equal(specs.length, 1);
  assert.equal(specs[0].kind, 'daily');
  assert.equal(specs[0].key, 'wick.wind-down.daily');
  assert.equal(specs[0].hour, 21);
  assert.equal(specs[0].minute, 30);
});

test('every night stays daily even when the time is past midnight', () => {
  // Shifting all seven nights forward a day is still all seven days, so the
  // collapse has to survive the fire-day shift rather than fall out of it.
  const specs = expandSchedules(reminder({ id: 'lights-out', hour: 0, minute: 20 }));
  assert.equal(specs.length, 1);
  assert.equal(specs[0].kind, 'daily');
});

test('a partial week expands to one weekly schedule per night', () => {
  const specs = expandSchedules(reminder({ nights: WEEKNIGHTS }));

  assert.equal(specs.length, 5);
  assert.deepEqual(
    specs.map((s) => s.key),
    ['wick.wind-down.n0', 'wick.wind-down.n1', 'wick.wind-down.n2', 'wick.wind-down.n3', 'wick.wind-down.n4']
  );
  assert.deepEqual(
    specs.map((s) => (s.kind === 'weekly' ? s.weekday : null)),
    [0, 1, 2, 3, 4],
    'an evening time fires on the night it names'
  );
});

test('a past-midnight weekly schedule fires the following day, keyed by its night', () => {
  const specs = expandSchedules(reminder({ id: 'lights-out', hour: 0, minute: 30, nights: WEEKNIGHTS }));

  assert.deepEqual(
    specs.map((s) => (s.kind === 'weekly' ? s.weekday : null)),
    [1, 2, 3, 4, 5],
    'Sun–Thu nights fire Mon–Fri'
  );
  assert.deepEqual(
    specs.map((s) => s.key),
    ['wick.lights-out.n0', 'wick.lights-out.n1', 'wick.lights-out.n2', 'wick.lights-out.n3', 'wick.lights-out.n4'],
    'keys name the night, so they survive the time crossing midnight'
  );
});

test('each reminder owns only its own keys', () => {
  assert.ok(ownsKey('wind-down', 'wick.wind-down.daily'));
  assert.ok(ownsKey('lights-out', 'wick.lights-out.n3'));

  assert.ok(!ownsKey('wind-down', 'wick.lights-out.n3'), 'the bug this module exists to stop');
  assert.ok(!ownsKey('lights-out', 'wick.wind-down.daily'));
  assert.ok(!ownsKey('wind-down', 'some-other-app-notification'));

  assert.notEqual(keyPrefix('wind-down'), keyPrefix('lights-out'));
});

test('nextFireAt finds the soonest firing, today or later', () => {
  const monday = new Date(2026, 6, 6, 20, 0); // 2026-07-06 is a Monday
  assert.equal(new Date(2026, 6, 6).getDay(), 1);

  const tonight = nextFireAt(reminder(), monday);
  assert.deepEqual(tonight, new Date(2026, 6, 6, 21, 30), 'later the same evening');

  const afterItPassed = nextFireAt(reminder(), new Date(2026, 6, 6, 22, 0));
  assert.deepEqual(afterItPassed, new Date(2026, 6, 7, 21, 30), 'tomorrow, once tonight has gone');
});

test('nextFireAt skips nights the reminder is not set for', () => {
  const wednesday = new Date(2026, 6, 8, 20, 0);
  assert.equal(wednesday.getDay(), 3);

  const weekendOnly = nextFireAt(reminder({ nights: WEEKENDS }), wednesday);
  assert.deepEqual(weekendOnly, new Date(2026, 6, 10, 21, 30), 'Friday night');
});

test('nextFireAt reaches the same weekday a week out when today has passed', () => {
  // The off-by-one this guards: looping seven days from today never gets back
  // to today, so a once-a-week reminder would read as "never" all evening.
  const friday = new Date(2026, 6, 10, 22, 0);
  assert.equal(friday.getDay(), 5);

  const next = nextFireAt(reminder({ nights: [5] }), friday);
  assert.deepEqual(next, new Date(2026, 6, 17, 21, 30));
});

test('nextFireAt is null when nothing is scheduled', () => {
  assert.equal(nextFireAt(reminder({ enabled: false }), new Date(2026, 6, 6, 20, 0)), null);
  assert.equal(nextFireAt(reminder({ nights: [] }), new Date(2026, 6, 6, 20, 0)), null);
});

test('fireAtOn returns tonight even after it has passed', () => {
  const monday = new Date(2026, 6, 6, 23, 0); // an hour and a half past 21:30
  assert.equal(monday.getDay(), 1);

  // Tonight draws a burned-down wick, so it needs the slot that has gone, not
  // the next one. `nextFireAt` would answer tomorrow and relight it.
  assert.deepEqual(fireAtOn(reminder(), monday), new Date(2026, 6, 6, 21, 30));
  assert.deepEqual(nextFireAt(reminder(), monday), new Date(2026, 6, 7, 21, 30));
});

test('fireAtOn is null on a night the reminder is not set for', () => {
  const saturday = new Date(2026, 6, 11, 20, 0);
  assert.equal(saturday.getDay(), 6);

  assert.equal(fireAtOn(reminder({ nights: WEEKNIGHTS }), saturday), null, 'no reminder tonight');
  assert.deepEqual(fireAtOn(reminder({ nights: WEEKENDS }), saturday), new Date(2026, 6, 11, 21, 30));
  assert.equal(fireAtOn(reminder({ enabled: false }), saturday), null);
});

test('minutesBetween counts forward through midnight', () => {
  assert.equal(minutesBetween({ hour: 21, minute: 30 }, { hour: 22, minute: 45 }), 75);
  assert.equal(minutesBetween({ hour: 23, minute: 30 }, { hour: 0, minute: 15 }), 45, 'across midnight');
  assert.equal(minutesBetween({ hour: 21, minute: 30 }, { hour: 21, minute: 30 }), 0);
  assert.equal(minutesBetween({ hour: 22, minute: 0 }, { hour: 21, minute: 0 }), 23 * 60, 'the long way round');
});

test('describeNights names the presets and lists anything else', () => {
  assert.equal(describeNights([]), 'Never');
  assert.equal(describeNights(EVERY_NIGHT), 'Every night');
  assert.equal(describeNights(WEEKNIGHTS), 'Weeknights');
  assert.equal(describeNights(WEEKENDS), 'Weekends');
  assert.equal(describeNights([1, 0, 4]), 'Sun, Mon, Thu', 'listed Sunday-first, not in tap order');
});

test('normaliseReminder survives anything the cache or the server hands back', () => {
  const fallback = normaliseReminder('wind-down', null);
  assert.equal(fallback.hour, 21);
  assert.equal(fallback.enabled, false, 'never turn a reminder on by failing to parse it');
  assert.deepEqual(fallback.nights, EVERY_NIGHT);

  assert.deepEqual(normaliseReminder('lights-out', 'nonsense').id, 'lights-out');

  const clamped = normaliseReminder('wind-down', { hour: 99, minute: -4, enabled: true, nights: [] });
  assert.equal(clamped.hour, 23);
  assert.equal(clamped.minute, 0);
  assert.deepEqual(clamped.nights, [], 'an empty night list is a real choice, not a missing one');

  const dirty = normaliseReminder('wind-down', { hour: 22, nights: [3, 'x', 9, 3, 0] });
  assert.deepEqual(dirty.nights, [0, 3], 'junk nights dropped, the rest sorted and deduped');
  assert.equal(dirty.minute, 30, 'a missing field falls back rather than becoming NaN');
});

test('an old cached shape with no nights still works', () => {
  // `profile_cache_v1` was written as `{hour, minute, enabled}` before nights
  // existed. Reading one back must not silently produce a reminder that never
  // fires — the same migration care `session_nights_v1` got.
  const legacy = normaliseReminder('wind-down', { hour: 22, minute: 15, enabled: true });

  assert.equal(legacy.enabled, true);
  assert.deepEqual(legacy.nights, EVERY_NIGHT, 'a reminder with no nights recorded ran nightly');
  assert.equal(expandSchedules(legacy).length, 1);
});
