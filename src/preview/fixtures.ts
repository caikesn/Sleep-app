import type { LoggedSession } from '../sessions';
import type { RoutinePlan } from '../routineData';
import { BUILTIN_ROUTINE_ID, stepCatalog } from '../routineData';
import type { SessionKind } from '../database.types';

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

/** Keyed by the same fixture names, so one `--fixture` drives every screen. */
export const ROUTINE_FIXTURES: Record<string, { routines: RoutinePlan[]; activeId: string }> = {
  empty: { routines: [], activeId: BUILTIN_ROUTINE_ID },
  starting: { routines: [], activeId: BUILTIN_ROUTINE_ID },
  steady: { routines: savedRoutines, activeId: EDITABLE_ROUTINE_ID },
  veteran: { routines: savedRoutines, activeId: savedRoutines[1].id },
};
