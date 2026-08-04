import type { LoggedSession } from '../sessions';
import type { Reminders } from '../storage';
import { EVERY_NIGHT, WEEKNIGHTS } from '../reminders';
import type { RoutinePlan } from '../routineData';
import { BUILTIN_ROUTINE_ID, stepCatalog } from '../routineData';
import type { SessionKind } from '../database.types';
import { type Lighting, DEFAULT_LIGHTING } from '../lighting';

/**
 * Canned session logs for the preview harness.
 *
 * Built relative to the real clock rather than fixed dates, so "tonight" is
 * always tonight and the streak is always live — no clock faking needed in the
 * screenshot script.
 */

type Options = {
  kind?: SessionKind;
  title?: string;
  minutes?: number;
  /** Local hour the session finished. Above 4, so it lands on that same day. */
  hour?: number;
  completed?: boolean;
};

function session(nightsAgo: number, options: Options = {}): LoggedSession {
  const { kind = 'routine', title = 'Night Routine', minutes = 18, hour = 21, completed = true } =
    options;

  const ended = new Date();
  ended.setDate(ended.getDate() - nightsAgo);
  ended.setHours(hour, 40, 0, 0);

  const started = new Date(ended.getTime() - minutes * 60 * 1000);

  return {
    kind,
    title,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    completed,
    duration_seconds: minutes * 60,
  };
}

/** A run of consecutive nights ending `endingNightsAgo` before tonight. */
function run(length: number, endingNightsAgo: number, options: Options = {}): LoggedSession[] {
  return Array.from({ length }, (_, i) => session(endingNightsAgo + i, options));
}

const starting: LoggedSession[] = [
  session(0),
  session(1, { kind: 'stretch', title: 'Neck & shoulders', minutes: 4, hour: 22 }),
];

const steady: LoggedSession[] = [
  // Twelve nights running, with a second session on some of them.
  ...run(12, 0),
  session(0, { kind: 'stretch', title: 'Neck & shoulders', minutes: 5, hour: 22 }),
  session(2, { kind: 'meditation', title: 'Body scan', minutes: 10, hour: 22 }),
  session(5, { kind: 'stretch', title: 'Hip opener', minutes: 6, hour: 20 }),
  // An abandoned one, to check the "left early" treatment.
  session(3, { kind: 'routine', title: 'Night Routine', minutes: 2, hour: 23, completed: false }),
  // An older cluster, so the best streak is longer than the current one.
  ...run(9, 20),
];

const veteran: LoggedSession[] = [
  ...run(41, 0),
  ...run(30, 45),
  ...run(22, 80),
  ...run(15, 110),
  session(1, { kind: 'meditation', title: 'Body scan', minutes: 12, hour: 22 }),
  session(2, { kind: 'stretch', title: 'Hip opener', minutes: 6, hour: 19 }),
  session(0, { kind: 'reading', title: 'Wind-down reading', minutes: 15, hour: 22 }),
  // Finished at 00:30 — belongs to the previous night, and unlocks Night owl.
  session(4, { kind: 'routine', title: 'Late one', minutes: 20, hour: 24 }),
];

export const FIXTURES: Record<string, LoggedSession[]> = {
  empty: [],
  starting,
  steady,
  veteran,
};

export type FixtureName = keyof typeof FIXTURES;

/**
 * Saved routines, for the builder and the routine list. The ids are fixed rather
 * than generated so `?preview=builder-edit` can name one of them.
 */
export const EDITABLE_ROUTINE_ID = '11111111-1111-4111-8111-111111111111';

const savedRoutines: RoutinePlan[] = [
  {
    id: EDITABLE_ROUTINE_ID,
    name: 'Quick wind-down',
    // Short, out of catalog order, and with one stretch used twice — the three
    // things the builder has to render correctly.
    stepIds: ['long-exhale', 'supine-twist', 'long-exhale', 'final-relaxation'],
    updatedAt: new Date().toISOString(),
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Long night',
    // Long enough to need scrolling in the builder, and spanning every category.
    stepIds: stepCatalog.filter((_, i) => i % 2 === 0).map((step) => step.id),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Reminder times, quoted as minutes from now for the same reason the sessions
 * are: Tonight's whole hero is an interpolation on how long is left, and a fixed
 * clock time would show the wick freshly lit for twenty-two hours of the day.
 */
function windDownIn(minutes: number, nights = EVERY_NIGHT): Reminders['wind-down'] {
  const at = new Date(Date.now() + minutes * 60 * 1000);
  return {
    id: 'wind-down',
    hour: at.getHours(),
    minute: at.getMinutes(),
    enabled: true,
    nights,
  };
}

/** Lights out sits a fixed distance after wind-down, as it would in real use. */
function lightsOutAfter(
  windDown: Reminders['wind-down'],
  minutes: number,
  { enabled = true, nights = windDown.nights } = {}
): Reminders['lights-out'] {
  const at = new Date();
  at.setHours(windDown.hour, windDown.minute + minutes, 0, 0);
  return { id: 'lights-out', hour: at.getHours(), minute: at.getMinutes(), enabled, nights };
}

/** And the morning sits a night after lights out, wrapping past midnight. */
function wakeAfter(lightsOut: Reminders['lights-out'], minutes: number): Reminders['wake'] {
  const at = new Date();
  at.setHours(lightsOut.hour, lightsOut.minute + minutes, 0, 0);
  return {
    id: 'wake',
    hour: at.getHours(),
    minute: at.getMinutes(),
    enabled: lightsOut.enabled,
    nights: lightsOut.nights,
  };
}

/**
 * Wind-down stays on every night in every fixture, deliberately.
 *
 * Tonight's whole hero reads off it, and a fixture set to weeknights would draw
 * the wick unlit on a Saturday — a screenshot taken at the weekend would look
 * like the screen was broken. The partial-week case is put on lights out
 * instead, which only Settings reads. Same trap as shooting an ambient loop at
 * 600ms and calling the glow too dim.
 */
function pair(windDown: Reminders['wind-down'], lightsOut: Partial<{ enabled: boolean; nights: typeof WEEKNIGHTS }> = {}): Reminders {
  const lights = lightsOutAfter(windDown, 75, lightsOut);
  return {
    'wind-down': windDown,
    'lights-out': lights,
    // Offset from lights out rather than pinned to 7am, so the sleep-window
    // line in Settings always shoots a plausible night. A fixed morning against
    // a clock-relative evening reads as twenty-two hours whenever the shot is
    // taken before lunch, which looks exactly like the bug that line is
    // guarded against. Nights follow lights out: the two are read as one night.
    wake: wakeAfter(lights, 8 * 60 + 15),
  };
}

export const SETTINGS_FIXTURES: Record<string, Reminders> = {
  // Nothing set yet: the countdown reads "Anytime" and the burn bar is absent.
  empty: pair(
    { id: 'wind-down', hour: 21, minute: 30, enabled: false, nights: EVERY_NIGHT },
    { enabled: false }
  ),
  // Freshly lit — the flame at full size, before the evening has taken any of it.
  starting: pair(windDownIn(96)),
  // Mid-evening, which is the state the design was drawn against. Lights out is
  // weeknights-only here, so Settings shows a partial strip rather than all
  // seven lit — the only state in which the strip is doing any work.
  steady: pair(windDownIn(48), { nights: WEEKNIGHTS }),
  // Burned out, so the veil is at full strength and the CTA reads "Start anyway".
  veteran: pair(windDownIn(0)),
};

/**
 * Lighting, keyed the same way.
 *
 * Seeded rather than left to the default so a screenshot is deterministic, and
 * varied so the two states worth looking at both have a fixture: `empty` is a
 * fresh account before anything has been chosen, and `veteran` is someone who
 * has turned the wash off and the dim all the way up — the combination that
 * leaves the session screen with the least contrast, which is where clipping
 * and unreadable text would show first.
 */
export const LIGHTING_FIXTURES: Record<string, Lighting> = {
  empty: { ...DEFAULT_LIGHTING },
  starting: { ...DEFAULT_LIGHTING },
  steady: { dim: 'dim', warm: true },
  veteran: { dim: 'dark', warm: false },
};

/** Keyed by the same fixture names, so one `--fixture` drives every screen. */
export const ROUTINE_FIXTURES: Record<string, { routines: RoutinePlan[]; activeId: string }> = {
  empty: { routines: [], activeId: BUILTIN_ROUTINE_ID },
  starting: { routines: [], activeId: BUILTIN_ROUTINE_ID },
  steady: { routines: savedRoutines, activeId: EDITABLE_ROUTINE_ID },
  veteran: { routines: savedRoutines, activeId: savedRoutines[1].id },
};
