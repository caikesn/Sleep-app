import { nightOf } from './streak';

/**
 * Unfinished sessions, and what it takes to have finished one.
 *
 * Two rules live here, and they are the same rule seen from both ends:
 *
 * - **A session counts when you did the work**, not when you reached the end of
 *   it. Tapping Skip through eight stretches arrives at the last screen in about
 *   four seconds, and that used to log a completed session and extend the
 *   streak. A streak you can tap your way to is worth nothing, and worse, it
 *   makes the honest version feel pointless.
 * - **Leaving early is not failing.** The session is held open for the rest of
 *   the night so you can come back to it — the phone rang, the dog barked. What
 *   you don't get is the credit until you've actually done it.
 *
 * Pure, and imports only `streak.ts` (itself pure), so the whole model can be
 * exercised without a renderer or AsyncStorage. Seconds per step come in as
 * plain numbers rather than `RoutineStep`s, which keeps the step catalog out of
 * here entirely.
 */

/**
 * How much of a thing has to be served for it to count — of a single hold, and
 * of the steps in a routine.
 *
 * One number for both, because it is one judgement: roughly, "most of it".
 * Seventy percent is deliberately loose. Someone who holds a 30-second stretch
 * for 22 and moves on has done that stretch, and someone who skips one pose out
 * of eight because their knee hurts has still wound down. The number is not
 * there to grade the effort — it is there to be impossible to reach by tapping.
 */
export const SERVED_RATIO = 0.7;

/** Did a step get enough of its hold time to count as done? */
export function stepServed(plannedSeconds: number, heldSeconds: number): boolean {
  if (plannedSeconds <= 0) return true;
  return heldSeconds >= plannedSeconds * SERVED_RATIO;
}

export function servedCount(planned: number[], held: number[]): number {
  return planned.filter((seconds, i) => stepServed(seconds, held[i] ?? 0)).length;
}

/**
 * Did enough of the session happen to log it as completed?
 *
 * A session with no steps in it is not a completed session — otherwise the
 * emptiest possible routine would be the easiest badge in the app.
 */
export function isComplete(planned: number[], held: number[]): boolean {
  if (planned.length === 0) return false;
  return servedCount(planned, held) >= planned.length * SERVED_RATIO;
}

/**
 * The step to come back in at: the first one that didn't get its time.
 *
 * Not the step you happened to be on when you left. If you skipped past three
 * stretches and then quit on the fourth, "where you left off" is the first one
 * you skipped — resuming at the fourth would hand back the three you dodged.
 * From there the session simply plays out in order; a step already served that
 * comes later is played again rather than jumped over, because a routine that
 * hops around is harder to follow than one that repeats a stretch you've done.
 */
export function firstUnserved(planned: number[], held: number[]): number {
  return planned.findIndex((seconds, i) => !stepServed(seconds, held[i] ?? 0));
}

/**
 * A session left unfinished, saved so it can be picked up again.
 *
 * Device-local and never synced, the same call as the lighting preferences: an
 * interrupted session is a fact about the phone in your hand right now, and
 * finishing it on the tablet in the other room is not a thing anyone wants.
 */
export type ResumePoint = {
  title: string;
  /** Step ids rather than steps — ids are permanent, the content behind them isn't. */
  stepIds: string[];
  /**
   * Seconds the routine asked of each step, aligned to `stepIds`.
   *
   * Snapshotted rather than looked up again on the way back in, so the point can
   * answer "is there anything left in this?" on its own — no step catalog, no
   * resolution, nothing to go stale between saving it and reading it.
   */
  planned: number[];
  /** Seconds actually held, per step, aligned to `stepIds`. */
  held: number[];
  /** The night it belongs to. A resume point does not outlive its night. */
  night: string;
  savedAt: string;
};

/**
 * Trims or pads the held-seconds list to the number of steps resolved today.
 *
 * A saved point names step ids, and a step can leave the catalog between
 * quitting and coming back — after which the two lists disagree about which
 * number belongs to which stretch. Anything unaccounted for is treated as
 * unserved, which errs toward asking for the work again rather than granting it.
 */
export function alignHeld(held: number[], stepCount: number): number[] {
  return Array.from({ length: stepCount }, (_, i) => Math.max(0, held[i] ?? 0));
}

/**
 * Is this point still worth offering?
 *
 * It has to be tonight's, and it has to have something left in it. The night
 * bound is what stops a routine abandoned on Monday being finished on Thursday
 * to patch a streak — credit lands on the night you do the work, and by
 * Thursday, Monday's wind-down is not a thing you can still do.
 */
export function isResumable(point: ResumePoint | null, now: Date = new Date()): boolean {
  if (!point || point.stepIds.length === 0) return false;
  if (point.night !== nightOf(now)) return false;
  return firstUnserved(point.planned, point.held) !== -1;
}

/** Steps still owed, for the card that offers the session back. */
export function stepsLeft(point: ResumePoint): number {
  return point.planned.length - servedCount(point.planned, point.held);
}
