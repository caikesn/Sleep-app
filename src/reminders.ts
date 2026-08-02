/**
 * What a reminder is, which nights it fires on, and what OS schedules it
 * expands into.
 *
 * Deliberately free of `expo-notifications`, so it can be exercised by the test
 * runner — the platform half lives in `notifications.ts`. The split is the same
 * one `soundscapes.ts` and `soundscapeAssets.ts` make, for the same reason: the
 * part that can be silently wrong is the part with no platform imports.
 */

import { NIGHT_CUTOFF_HOUR } from './streak';

export type ReminderId = 'wind-down' | 'lights-out';

/** Every reminder there is, in the order they happen. */
export const REMINDER_IDS: ReminderId[] = ['wind-down', 'lights-out'];

/** 0 = Sunday, matching `Date.prototype.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Reminder = {
  id: ReminderId;
  hour: number;
  minute: number;
  enabled: boolean;
  /** The nights it fires on, sorted and deduped. Empty means never. */
  nights: Weekday[];
};

export const EVERY_NIGHT: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * Sunday through Thursday — the nights *before* a working day, which is not
 * the same set as Monday to Friday.
 *
 * Someone asking for a weeknight bedtime wants to be in bed early on Sunday and
 * to stay up on Friday. Offering them Mon–Fri gets both ends wrong.
 */
export const WEEKNIGHTS: Weekday[] = [0, 1, 2, 3, 4];

export const WEEKENDS: Weekday[] = [5, 6];

/**
 * Sunday first, so `WEEKNIGHTS` is the first five toggles and `WEEKENDS` the
 * last two. A Monday-first row splits both presets across the ends of the strip
 * and neither is recognisable at a glance.
 */
export const NIGHT_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const NIGHT_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export function sortNights(nights: Iterable<Weekday>): Weekday[] {
  return [...new Set(nights)].sort((a, b) => a - b);
}

export function sameNights(a: Weekday[], b: Weekday[]): boolean {
  const left = sortNights(a);
  const right = sortNights(b);
  return left.length === right.length && left.every((day, i) => day === right[i]);
}

export function toggleNight(nights: Weekday[], night: Weekday): Weekday[] {
  return nights.includes(night)
    ? sortNights(nights.filter((day) => day !== night))
    : sortNights([...nights, night]);
}

/**
 * The weekday a reminder set for a given *night* actually fires on.
 *
 * `nights` names the night, not the calendar day, for the same reason
 * `streak.ts` shifts by `NIGHT_CUTOFF_HOUR`: lights out at 00:30 on Sunday
 * night happens on Monday. Scheduling that as a Sunday trigger would fire it
 * twenty-three and a half hours early, on the wrong end of the same evening.
 */
export function fireDay(night: Weekday, hour: number): Weekday {
  return hour < NIGHT_CUTOFF_HOUR ? (((night + 1) % 7) as Weekday) : night;
}

/**
 * `expo-notifications` numbers weekdays 1–7 with Sunday as 1; `Date.getDay()`
 * numbers them 0–6 with Sunday as 0. One place to be wrong, and it is tested.
 */
export function expoWeekday(day: Weekday): number {
  return day + 1;
}

/**
 * One OS-level schedule. A reminder expands into several of these, and each
 * carries the key it will be registered under so it can be cancelled by name.
 *
 * Cancelling by name is the whole point of this module existing. The previous
 * implementation called `cancelAllScheduledNotificationsAsync` before every
 * schedule, which made two coexisting reminders impossible.
 */
export type ScheduleSpec = {
  key: string;
  hour: number;
  minute: number;
} & ({ kind: 'daily' } | { kind: 'weekly'; weekday: Weekday });

/** Every key a reminder can own starts with this. Nothing else may. */
export function keyPrefix(id: ReminderId): string {
  return `wick.${id}.`;
}

export function ownsKey(id: ReminderId, key: string): boolean {
  return key.startsWith(keyPrefix(id));
}

/**
 * The schedules a reminder needs, or none if it is off.
 *
 * Seven weekly triggers and one daily trigger fire at identical moments, but
 * the daily one is a single registration. iOS caps an app at 64 pending
 * notifications, and the morning alarm still has to fit in the same budget.
 */
export function expandSchedules(reminder: Reminder): ScheduleSpec[] {
  const nights = sortNights(reminder.nights);
  if (!reminder.enabled || nights.length === 0) return [];

  const { hour, minute } = reminder;
  const prefix = keyPrefix(reminder.id);

  if (nights.length === EVERY_NIGHT.length) {
    return [{ key: `${prefix}daily`, kind: 'daily', hour, minute }];
  }

  // Keyed by the night, not the fire day, so the key is stable when the time
  // moves across midnight and the fire day shifts under it.
  return nights.map((night) => ({
    key: `${prefix}n${night}`,
    kind: 'weekly' as const,
    weekday: fireDay(night, hour),
    hour,
    minute,
  }));
}

/**
 * The next moment this reminder fires, or null if it never does.
 *
 * Built from local date components rather than by adding milliseconds, so it
 * lands on the wall-clock time through a daylight-saving change instead of an
 * hour either side of it.
 */
export function nextFireAt(reminder: Reminder, now: Date = new Date()): Date | null {
  const specs = expandSchedules(reminder);
  if (specs.length === 0) return null;

  const daily = specs.some((spec) => spec.kind === 'daily');
  const days = new Set(specs.map((spec) => (spec.kind === 'weekly' ? spec.weekday : -1)));

  // Eight days, not seven: today's slot may already have passed, so the same
  // weekday a week out has to stay reachable.
  for (let offset = 0; offset <= 7; offset += 1) {
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      reminder.hour,
      reminder.minute,
      0,
      0
    );
    if (at.getTime() <= now.getTime()) continue;
    if (daily || days.has(at.getDay() as Weekday)) return at;
  }

  return null;
}

/**
 * This evening's firing, or null if the reminder is not set for tonight.
 *
 * Unlike `nextFireAt` this returns a time that has already passed, which is the
 * whole reason it exists: Tonight draws the wick as burned *down*, so at ten
 * past a half-nine reminder it needs "twenty minutes ago", not "tomorrow at
 * half nine". Asking `nextFireAt` would relight the wick the moment it went out.
 */
export function fireAtOn(reminder: Reminder, day: Date = new Date()): Date | null {
  const specs = expandSchedules(reminder);
  const fires = specs.some((spec) => spec.kind === 'daily' || spec.weekday === day.getDay());
  if (!fires) return null;

  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    reminder.hour,
    reminder.minute,
    0,
    0
  );
}

/** Minutes from one clock time to another, counted forward through midnight. */
export function minutesBetween(
  from: { hour: number; minute: number },
  to: { hour: number; minute: number }
): number {
  const start = from.hour * 60 + from.minute;
  const end = to.hour * 60 + to.minute;
  return (end - start + 24 * 60) % (24 * 60);
}

export function describeNights(nights: Weekday[]): string {
  const sorted = sortNights(nights);
  if (sorted.length === 0) return 'Never';
  if (sameNights(sorted, EVERY_NIGHT)) return 'Every night';
  if (sameNights(sorted, WEEKNIGHTS)) return 'Weeknights';
  if (sameNights(sorted, WEEKENDS)) return 'Weekends';
  return sorted.map((night) => NIGHT_LABELS[night]).join(', ');
}

/**
 * Copy lives here rather than in the scheduling call, because a scheduled
 * notification keeps the text it was created with. Changing a word means
 * rescheduling, and one place to change it is the difference between that
 * working and half the week still saying the old thing.
 */
export const REMINDER_COPY: Record<
  ReminderId,
  { name: string; caption: string; title: string; body: string }
> = {
  'wind-down': {
    name: 'Wind-down',
    caption: 'Start the routine',
    title: 'Time to wind down',
    body: 'Dim the lights and start your night routine.',
  },
  'lights-out': {
    name: 'Lights out',
    caption: 'Put the phone down',
    // Deliberately not a call to open the app. This one has done its job when
    // it is dismissed, which is why tapping it does not start anything.
    title: 'Lights out',
    body: 'Nothing left to do tonight. Put the phone down.',
  },
};

export const DEFAULT_REMINDERS: Record<ReminderId, Reminder> = {
  'wind-down': { id: 'wind-down', hour: 21, minute: 30, enabled: false, nights: EVERY_NIGHT },
  'lights-out': { id: 'lights-out', hour: 22, minute: 45, enabled: false, nights: EVERY_NIGHT },
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Rebuilds a reminder from whatever came back out of the cache or the server.
 *
 * Both sources are `unknown` as far as this app is concerned — the cache can
 * hold a shape written by an older build, and the jsonb column will accept
 * anything. A reminder that silently fails to parse is one that stops firing
 * without saying so, so every field falls back rather than throwing.
 */
export function normaliseReminder(id: ReminderId, raw: unknown): Reminder {
  const fallback = DEFAULT_REMINDERS[id];
  if (!raw || typeof raw !== 'object') return { ...fallback, nights: [...fallback.nights] };

  const source = raw as Record<string, unknown>;
  const nights = Array.isArray(source.nights)
    ? sortNights(source.nights.filter((n): n is Weekday => Number.isInteger(n) && n >= 0 && n <= 6))
    : [...fallback.nights];

  return {
    id,
    hour: clamp(source.hour, 0, 23, fallback.hour),
    minute: clamp(source.minute, 0, 59, fallback.minute),
    enabled: source.enabled === true,
    nights,
  };
}
