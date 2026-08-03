import { GET_READY_SECONDS, stepPhases } from './routineData';
import type { RoutineStep } from './routineData';

/**
 * A routine, flattened into the things the timer actually counts.
 *
 * The session screen used to walk the steps directly, which quietly forced two
 * bad behaviours: the clock on a pose started while you were still getting into
 * it, and a pose done on both sides had no moment in it where the app could say
 * "other side now". Both are properties of the *sequence*, not of the screen, so
 * the sequence is built here where it can be tested without a renderer.
 *
 * A step becomes:
 *
 *     get ready → hold                    (one-sided)
 *     get ready → hold → get ready → hold (two-sided, left then right)
 *
 * and the screen walks phases while still reporting progress in steps, because
 * "3 of 8" should count stretches and nobody thinks of Pigeon as two of them.
 */

export type PhaseKind = 'ready' | 'hold';
export type Side = 'left' | 'right';

export type Phase = {
  kind: PhaseKind;
  seconds: number;
  step: RoutineStep;
  /** Which step it belongs to, for "3 of 8" and the progress bar. */
  stepIndex: number;
  /** Only on a two-sided pose. */
  side?: Side;
  /** The last hold of the last step — the one that ends the session. */
  final: boolean;
};

/** The order the sides are worked in. Left first, which is the side drawn. */
const SIDES: Side[] = ['left', 'right'];

export function buildPhases(steps: RoutineStep[]): Phase[] {
  const phases: Phase[] = [];

  steps.forEach((step, stepIndex) => {
    const count = stepPhases(step);
    for (let i = 0; i < count; i += 1) {
      const side = step.perSide ? SIDES[i] : undefined;
      const final = stepIndex === steps.length - 1 && i === count - 1;
      phases.push({ kind: 'ready', seconds: GET_READY_SECONDS, step, stepIndex, side, final: false });
      phases.push({ kind: 'hold', seconds: step.seconds, step, stepIndex, side, final });
    }
  });

  return phases;
}

/** The first phase of a step, so Back and Skip move by stretch rather than by half of one. */
export function phaseIndexForStep(phases: Phase[], stepIndex: number): number {
  const found = phases.findIndex((phase) => phase.stepIndex === stepIndex);
  return found === -1 ? phases.length : found;
}

export function sideLabel(side: Side): string {
  return side === 'left' ? 'Left side' : 'Right side';
}

/**
 * What the screen says above the timer.
 *
 * A two-sided pose says which side even while you're getting into it — being
 * told "other side" only once the clock has started is being told too late.
 */
export function phaseLabel(phase: Phase): string {
  const side = phase.side ? sideLabel(phase.side) : null;
  if (phase.kind === 'ready') {
    return side ? `Get into it · ${side}` : 'Get into it';
  }
  return side ?? 'Hold';
}
