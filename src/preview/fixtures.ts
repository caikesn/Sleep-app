import type { LoggedSession } from '../sessions';
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
