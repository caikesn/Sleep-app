/**
 * Breathing patterns and the arithmetic that drives the pacer.
 *
 * Kept free of any React or storage import so it runs directly under `node
 * --test`. Everything on this screen that could be silently wrong — which phase
 * you're in eleven minutes into a session, whether the circle should be growing
 * — is decided here rather than inside an animation callback.
 */

export type BreathPhaseKind = 'inhale' | 'hold' | 'exhale' | 'hold-out';

export type BreathPhase = { kind: BreathPhaseKind; seconds: number };

export type BreathPattern = {
  id: string;
  name: string;
  /** The counts, spelled out — the pattern's whole explanation in one line. */
  detail: string;
  /** Why you'd pick this one over the others. */
  note: string;
  phases: BreathPhase[];
};

export const BREATH_PATTERNS: BreathPattern[] = [
  {
    id: 'long-exhale',
    name: 'Long exhale',
    detail: '4 in · 8 out',
    note: 'The plainest way down. A longer exhale is the part that settles you.',
    phases: [
      { kind: 'inhale', seconds: 4 },
      { kind: 'exhale', seconds: 8 },
    ],
  },
  {
    id: 'coherent',
    name: 'Coherent',
    detail: '5 in · 5 out',
    note: 'Even and unhurried. Easiest to hold for a long stretch.',
    phases: [
      { kind: 'inhale', seconds: 5 },
      { kind: 'exhale', seconds: 5 },
    ],
  },
  {
    id: 'box',
    name: 'Box',
    detail: '4 in · 4 hold · 4 out · 4 hold',
    note: 'The holds give the mind something to count, which helps if it wanders.',
    phases: [
      { kind: 'inhale', seconds: 4 },
      { kind: 'hold', seconds: 4 },
      { kind: 'exhale', seconds: 4 },
      { kind: 'hold-out', seconds: 4 },
    ],
  },
  {
    id: 'four-seven-eight',
    name: '4-7-8',
    detail: '4 in · 7 hold · 8 out',
    note: 'The strongest of the four. Stop if the long hold feels like effort.',
    phases: [
      { kind: 'inhale', seconds: 4 },
      { kind: 'hold', seconds: 7 },
      { kind: 'exhale', seconds: 8 },
    ],
  },
];

export const PHASE_LABELS: Record<BreathPhaseKind, string> = {
  inhale: 'Breathe in',
  hold: 'Hold',
  exhale: 'Breathe out',
  'hold-out': 'Hold',
};

export function patternById(id: string): BreathPattern | undefined {
  return BREATH_PATTERNS.find((pattern) => pattern.id === id);
}

export function cycleSeconds(pattern: BreathPattern): number {
  return pattern.phases.reduce((sum, phase) => sum + phase.seconds, 0);
}

/** Rounded down: a half-finished breath isn't a breath you took. */
export function breathsIn(pattern: BreathPattern, totalSeconds: number): number {
  return Math.floor(totalSeconds / cycleSeconds(pattern));
}

export type PhaseAt = {
  phase: BreathPhase;
  index: number;
  /** Whole seconds still to go in this phase, counting down from its length. */
  remaining: number;
  /** 0 at the start of the phase, 1 at its end. */
  progress: number;
};

/**
 * Which phase a pattern is in after `elapsed` seconds.
 *
 * Derived from elapsed time rather than counted up by a ticker, so a dropped
 * frame, a backgrounded app or a slow render can't accumulate drift — after
 * twenty minutes a counter that misses one tick a minute is a whole phase out.
 */
export function phaseAt(pattern: BreathPattern, elapsed: number): PhaseAt {
  const cycle = cycleSeconds(pattern);
  // Negative elapsed would otherwise index backwards off the front of the cycle.
  const into = ((elapsed % cycle) + cycle) % cycle;

  let start = 0;
  for (const [index, phase] of pattern.phases.entries()) {
    if (into < start + phase.seconds || index === pattern.phases.length - 1) {
      const within = into - start;
      return {
        phase,
        index,
        // Ceil so the label reads "4" for the whole first second rather than
        // flicking to 3 immediately.
        remaining: Math.max(1, Math.ceil(phase.seconds - within)),
        progress: Math.min(1, within / phase.seconds),
      };
    }
    start += phase.seconds;
  }

  // Unreachable: the loop always returns on the last phase.
  throw new Error(`Pattern ${pattern.id} has no phases`);
}

/**
 * How big the pacer circle should be, 0 at rest and 1 at full breath.
 *
 * The holds matter as much as the movement: holding after an inhale must stay
 * expanded, holding after an exhale must stay small. A circle that drifts back
 * to neutral during a hold is telling you to breathe when you shouldn't.
 */
export function scaleFor(at: PhaseAt): number {
  switch (at.phase.kind) {
    case 'inhale':
      return at.progress;
    case 'exhale':
      return 1 - at.progress;
    case 'hold':
      return 1;
    case 'hold-out':
      return 0;
  }
}
