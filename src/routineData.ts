import type { IconName } from './components/Icon';

export type RoutineStep = {
  id: string;
  name: string;
  seconds: number;
  /** Describes the movement, not the pose. See Icon.tsx. */
  icon: IconName;
  description: string;
};

export const defaultRoutine: RoutineStep[] = [
  {
    id: 'breathing',
    name: 'Box Breathing',
    seconds: 60,
    icon: 'breathe',
    description: 'Sit cross-legged. Inhale 4s, hold 4s, exhale 4s, hold 4s. Repeat, letting your shoulders drop.',
  },
  {
    id: 'neck-rolls',
    name: 'Neck Rolls',
    seconds: 30,
    icon: 'rotate',
    description: 'Slowly roll your head in a full circle, 5 times each direction. Keep shoulders relaxed.',
  },
  {
    id: 'cat-cow',
    name: 'Cat-Cow',
    seconds: 45,
    icon: 'arch',
    description: 'On hands and knees, arch your back up on the exhale, dip it down on the inhale. Slow and controlled.',
  },
  {
    id: 'childs-pose',
    name: "Child's Pose",
    seconds: 60,
    icon: 'fold',
    description: 'Kneel and fold forward, arms extended or by your sides. Breathe deeply into your lower back.',
  },
  {
    id: 'seated-forward-fold',
    name: 'Seated Forward Fold',
    seconds: 45,
    icon: 'reach',
    description: 'Sit with legs extended, hinge at the hips and reach for your feet. Let your neck relax.',
  },
  {
    id: 'figure-four',
    name: 'Figure-Four Stretch',
    seconds: 60,
    icon: 'cross',
    description: 'Lie on your back, cross one ankle over the opposite knee, pull the standing leg toward your chest. Switch sides halfway.',
  },
  {
    id: 'legs-up-wall',
    name: 'Legs Up the Wall',
    seconds: 120,
    icon: 'elevate',
    description: 'Lie on your back with legs resting up a wall. Rest your arms out to the sides and breathe slowly.',
  },
  {
    id: 'final-relaxation',
    name: 'Final Relaxation',
    seconds: 90,
    icon: 'rest',
    description: 'Lie flat on your back in savasana. Let your whole body sink and settle. Slow your breathing.',
  },
];

/**
 * Every step the builder can pick from. Identical to `defaultRoutine` today,
 * because the built-in routine happens to use all of them — these separate as
 * soon as the library grows past one routine's worth of material.
 */
export const stepCatalog: RoutineStep[] = defaultRoutine;

/** A routine as it is stored: a name and an ordered list of catalog step ids. */
export type RoutinePlan = {
  id: string;
  name: string;
  stepIds: string[];
  updatedAt: string;
};

export const BUILTIN_ROUTINE_ID = 'builtin';

/**
 * The one routine that always exists. Deliberately not stored anywhere: a fresh
 * install with no signal and nothing saved still has something to start.
 */
export const builtinRoutine: RoutinePlan = {
  id: BUILTIN_ROUTINE_ID,
  name: 'Night Routine',
  stepIds: defaultRoutine.map((step) => step.id),
  updatedAt: new Date(0).toISOString(),
};

/** Matches the CHECK constraint on `routines.name`, so a save can't 400. */
export const MAX_ROUTINE_NAME = 80;

const BY_ID = new Map(stepCatalog.map((step) => [step.id, step]));

export function stepById(id: string): RoutineStep | undefined {
  return BY_ID.get(id);
}

/**
 * Unknown ids are dropped rather than rendered blank. A routine saved against a
 * step that a later release renames should quietly lose that step, not break.
 */
export function resolveSteps(stepIds: string[]): RoutineStep[] {
  return stepIds.map(stepById).filter((step): step is RoutineStep => !!step);
}

export function routineSeconds(stepIds: string[]): number {
  return resolveSteps(stepIds).reduce((sum, step) => sum + step.seconds, 0);
}

/** Whole minutes — but never rounds a real routine down to "0 min". */
export function routineMinutes(stepIds: string[]): number {
  const seconds = routineSeconds(stepIds);
  return seconds === 0 ? 0 : Math.max(1, Math.round(seconds / 60));
}

/**
 * Moves one step by `delta`. A move off either end returns the list untouched,
 * so the arrows on the first and last rows are no-ops rather than errors.
 */
export function moveStep(stepIds: string[], index: number, delta: number): string[] {
  const target = index + delta;
  const inRange = (i: number) => i >= 0 && i < stepIds.length;
  if (!inRange(index) || !inRange(target)) return stepIds;

  const next = [...stepIds];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

/** By position, not by id — the same stretch may legitimately appear twice. */
export function removeStep(stepIds: string[], index: number): string[] {
  return stepIds.filter((_, i) => i !== index);
}

/** Trimmed and capped so the value always satisfies the database's own check. */
export function cleanRoutineName(raw: string, fallback = 'My routine'): string {
  const trimmed = raw.trim().slice(0, MAX_ROUTINE_NAME);
  return trimmed.length > 0 ? trimmed : fallback;
}
