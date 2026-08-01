import type { IconName } from './components/Icon';

/**
 * Where a stretch belongs in the body, in the order you'd work through them:
 * breath first, then down from the neck, ending in something restorative.
 */
export type StepCategory = 'breath' | 'neck' | 'back' | 'hips' | 'rest';

/**
 * How demanding the pose is. Named for stretching rather than for a difficulty
 * setting — "hard" is the wrong word to put in front of someone at bedtime, but
 * how deep a pose goes is real information they need before committing to it.
 */
export type StepLevel = 'gentle' | 'moderate' | 'deep';

export type RoutineStep = {
  id: string;
  name: string;
  seconds: number;
  /** Describes the movement, not the pose. See Icon.tsx. */
  icon: IconName;
  description: string;
  category: StepCategory;
  level: StepLevel;
};

export const CATEGORIES: { id: StepCategory; name: string; blurb: string }[] = [
  { id: 'breath', name: 'Breathing', blurb: 'Slow the day down before you move at all.' },
  { id: 'neck', name: 'Neck & shoulders', blurb: 'Where a day at a desk ends up.' },
  { id: 'back', name: 'Back & spine', blurb: 'Unwind the middle of you.' },
  { id: 'hips', name: 'Hips & legs', blurb: 'The big releases. Give these the most time.' },
  { id: 'rest', name: 'Winding down', blurb: 'Nothing to hold. Poses to finish in.' },
];

export const LEVELS: { id: StepLevel; name: string }[] = [
  { id: 'gentle', name: 'Gentle' },
  { id: 'moderate', name: 'Moderate' },
  { id: 'deep', name: 'Deep' },
];

/**
 * Every stretch in the app, grouped by category in the order above.
 *
 * Ids are permanent: saved routines reference them, so a step may be renamed or
 * re-described but never re-keyed. Adding is always safe; removing costs the
 * step from every routine that used it, which `resolveSteps` handles quietly.
 */
export const stepCatalog: RoutineStep[] = [
  // — Breathing ————————————————————————————————————————————————
  {
    id: 'breathing',
    name: 'Box Breathing',
    seconds: 60,
    icon: 'breathe',
    description: 'Sit cross-legged. Inhale 4s, hold 4s, exhale 4s, hold 4s. Repeat, letting your shoulders drop.',
    category: 'breath',
    level: 'gentle',
  },
  {
    id: 'long-exhale',
    name: 'Long Exhale',
    seconds: 60,
    icon: 'breathe',
    description: 'Breathe in for a count of 4, out for a count of 8. The longer exhale is the part that tells your body the day is over.',
    category: 'breath',
    level: 'gentle',
  },
  {
    id: 'belly-breathing',
    name: 'Belly Breathing',
    seconds: 90,
    icon: 'breathe',
    description: 'One hand on your chest, one on your belly. Breathe so that only the lower hand moves.',
    category: 'breath',
    level: 'gentle',
  },
  {
    id: 'four-seven-eight',
    name: '4-7-8 Breathing',
    seconds: 60,
    icon: 'breathe',
    description: 'Inhale through your nose for 4, hold for 7, exhale through your mouth for 8. Four rounds is plenty.',
    category: 'breath',
    level: 'moderate',
  },
  {
    id: 'alternate-nostril',
    name: 'Alternate Nostril',
    seconds: 90,
    icon: 'breathe',
    description: 'Thumb closes your right nostril, inhale through the left. Switch, exhale through the right. Keep the pace slow.',
    category: 'breath',
    level: 'moderate',
  },

  // — Neck & shoulders ——————————————————————————————————————————
  {
    id: 'neck-rolls',
    name: 'Neck Rolls',
    seconds: 30,
    icon: 'rotate',
    description: 'Slowly roll your head in a full circle, 5 times each direction. Keep shoulders relaxed.',
    category: 'neck',
    level: 'gentle',
  },
  {
    id: 'shoulder-rolls',
    name: 'Shoulder Rolls',
    seconds: 30,
    icon: 'rotate',
    description: 'Roll both shoulders backwards in big slow circles, then forwards. Let your arms hang.',
    category: 'neck',
    level: 'gentle',
  },
  {
    id: 'ear-to-shoulder',
    name: 'Ear to Shoulder',
    seconds: 45,
    icon: 'tilt',
    description: 'Drop your right ear toward your right shoulder and rest a hand on your head for a little weight. Switch sides halfway.',
    category: 'neck',
    level: 'gentle',
  },
  {
    id: 'chin-tuck',
    name: 'Chin Tucks',
    seconds: 30,
    icon: 'draw',
    description: 'Draw your chin straight back, as if making a double chin. Hold for 5, release. Repeat slowly.',
    category: 'neck',
    level: 'gentle',
  },
  {
    id: 'doorway-chest',
    name: 'Chest Opener',
    seconds: 45,
    icon: 'open',
    description: 'Forearm on a door frame at shoulder height, step gently through until you feel the chest open. Switch sides halfway.',
    category: 'neck',
    level: 'gentle',
  },
  {
    id: 'eagle-arms',
    name: 'Eagle Arms',
    seconds: 45,
    icon: 'draw',
    description: 'Cross one arm under the other and wrap the forearms. Lift the elbows until the upper back spreads. Switch sides halfway.',
    category: 'neck',
    level: 'moderate',
  },
  {
    id: 'thread-the-needle',
    name: 'Thread the Needle',
    seconds: 60,
    icon: 'twist',
    description: 'On hands and knees, slide one arm under the other and rest the shoulder on the floor. Switch sides halfway.',
    category: 'neck',
    level: 'moderate',
  },

  // — Back & spine ——————————————————————————————————————————————
  {
    id: 'cat-cow',
    name: 'Cat-Cow',
    seconds: 45,
    icon: 'arch',
    description: 'On hands and knees, arch your back up on the exhale, dip it down on the inhale. Slow and controlled.',
    category: 'back',
    level: 'gentle',
  },
  {
    id: 'knees-to-chest',
    name: 'Knees to Chest',
    seconds: 45,
    icon: 'draw',
    description: 'Lie on your back and hug both knees in. Rock gently side to side if it feels good.',
    category: 'back',
    level: 'gentle',
  },
  {
    id: 'supine-twist',
    name: 'Supine Twist',
    seconds: 60,
    icon: 'twist',
    description: 'On your back, drop both knees to one side and turn your head the other way. Switch sides halfway.',
    category: 'back',
    level: 'gentle',
  },
  {
    id: 'sphinx',
    name: 'Sphinx',
    seconds: 45,
    icon: 'lift',
    description: 'Lie on your front, forearms down, elbows under your shoulders. Lift the chest only as far as stays comfortable.',
    category: 'back',
    level: 'moderate',
  },
  {
    id: 'seated-twist',
    name: 'Seated Spinal Twist',
    seconds: 60,
    icon: 'twist',
    description: 'Sit tall, cross one foot over the opposite knee, and turn toward the top leg. Switch sides halfway.',
    category: 'back',
    level: 'moderate',
  },
  {
    id: 'standing-fold',
    // "Standing Forward Fold" is the only name in the catalog long enough to
    // truncate next to a level tag and a duration. Shortened rather than
    // shaving another pixel off everything else.
    name: 'Standing Fold',
    seconds: 45,
    icon: 'fold',
    description: 'Feet hip width, soft knees, hinge forward and let your head and arms hang. Come up slowly.',
    category: 'back',
    level: 'moderate',
  },

  // — Hips & legs ————————————————————————————————————————————————
  {
    id: 'butterfly',
    name: 'Butterfly',
    seconds: 60,
    icon: 'open',
    description: 'Sit with the soles of your feet together and let the knees fall open. Lean forward only if it stays easy.',
    category: 'hips',
    level: 'gentle',
  },
  {
    id: 'happy-baby',
    name: 'Happy Baby',
    seconds: 45,
    icon: 'draw',
    description: 'On your back, knees toward your armpits, hold the outsides of your feet. Rock gently if you like.',
    category: 'hips',
    level: 'gentle',
  },
  {
    id: 'hamstring-reclined',
    name: 'Reclined Hamstring',
    seconds: 60,
    icon: 'elevate',
    description: 'On your back, raise one leg and hold behind the thigh. A belt or towel round the foot helps. Switch sides halfway.',
    category: 'hips',
    level: 'gentle',
  },
  {
    id: 'seated-forward-fold',
    name: 'Seated Forward Fold',
    seconds: 45,
    icon: 'reach',
    description: 'Sit with legs extended, hinge at the hips and reach for your feet. Let your neck relax.',
    category: 'hips',
    level: 'moderate',
  },
  {
    id: 'figure-four',
    name: 'Figure-Four Stretch',
    seconds: 60,
    icon: 'cross',
    description: 'Lie on your back, cross one ankle over the opposite knee, pull the standing leg toward your chest. Switch sides halfway.',
    category: 'hips',
    level: 'moderate',
  },
  {
    id: 'low-lunge',
    name: 'Low Lunge',
    seconds: 60,
    icon: 'lift',
    description: 'Back knee down, front foot forward, sink the hips until the front of the back thigh opens. Switch sides halfway.',
    category: 'hips',
    level: 'moderate',
  },
  {
    id: 'pigeon',
    name: 'Pigeon',
    seconds: 90,
    icon: 'open',
    description: 'Front shin across the mat, back leg long, fold forward over the front leg. Back off the moment the knee complains. Switch sides halfway.',
    category: 'hips',
    level: 'deep',
  },

  // — Winding down ———————————————————————————————————————————————
  {
    id: 'childs-pose',
    name: "Child's Pose",
    seconds: 60,
    icon: 'fold',
    description: 'Kneel and fold forward, arms extended or by your sides. Breathe deeply into your lower back.',
    category: 'rest',
    level: 'gentle',
  },
  {
    id: 'constructive-rest',
    name: 'Constructive Rest',
    seconds: 90,
    icon: 'rest',
    description: 'On your back, knees bent and feet flat, hands on your ribs. Do nothing at all and let the lower back settle.',
    category: 'rest',
    level: 'gentle',
  },
  {
    id: 'side-lying-rest',
    name: 'Side-Lying Rest',
    seconds: 90,
    icon: 'rest',
    description: 'On your side, knees drawn up, a pillow between them. Close your eyes and let the breath go quiet.',
    category: 'rest',
    level: 'gentle',
  },
  {
    id: 'legs-up-wall',
    name: 'Legs Up the Wall',
    seconds: 120,
    icon: 'elevate',
    description: 'Lie on your back with legs resting up a wall. Rest your arms out to the sides and breathe slowly.',
    category: 'rest',
    level: 'gentle',
  },
  {
    id: 'final-relaxation',
    name: 'Final Relaxation',
    seconds: 90,
    icon: 'rest',
    description: 'Lie flat on your back in savasana. Let your whole body sink and settle. Slow your breathing.',
    category: 'rest',
    level: 'gentle',
  },
];

const BY_ID = new Map(stepCatalog.map((step) => [step.id, step]));

function requireStep(id: string): RoutineStep {
  const step = BY_ID.get(id);
  // Only reachable from the hard-coded list below, so this is a build-time
  // mistake rather than anything a user can cause.
  if (!step) throw new Error(`Unknown step id in the built-in routine: ${id}`);
  return step;
}

/**
 * The built-in Night Routine. Named ids rather than a slice of the catalog: the
 * catalog is now much larger than any one routine, and this order was chosen —
 * breath, then neck down, ending flat on the floor — not inherited.
 */
export const defaultRoutine: RoutineStep[] = [
  'breathing',
  'neck-rolls',
  'cat-cow',
  'childs-pose',
  'seated-forward-fold',
  'figure-four',
  'legs-up-wall',
  'final-relaxation',
].map(requireStep);

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

/** As above, for a set of steps that isn't a saved routine yet. */
export function stepsMinutes(steps: RoutineStep[]): number {
  const seconds = steps.reduce((sum, step) => sum + step.seconds, 0);
  return seconds === 0 ? 0 : Math.max(1, Math.round(seconds / 60));
}

/** Catalog order is preserved, so a filtered list never reshuffles itself. */
export function filterSteps(
  filter: { category?: StepCategory | null; level?: StepLevel | null } = {}
): RoutineStep[] {
  return stepCatalog.filter(
    (step) =>
      (!filter.category || step.category === filter.category) &&
      (!filter.level || step.level === filter.level)
  );
}

export type StepGroup = { category: StepCategory; name: string; steps: RoutineStep[] };

/**
 * Groups in `CATEGORIES` order, not in whatever order the steps arrived in, and
 * drops empty groups so a filtered list doesn't render bare headings.
 */
export function groupByCategory(steps: RoutineStep[]): StepGroup[] {
  return CATEGORIES.map(({ id, name }) => ({
    category: id,
    name,
    steps: steps.filter((step) => step.category === id),
  })).filter((group) => group.steps.length > 0);
}

export function categoryName(category: StepCategory): string {
  return CATEGORIES.find((entry) => entry.id === category)?.name ?? '';
}

export function levelName(level: StepLevel): string {
  return LEVELS.find((entry) => entry.id === level)?.name ?? '';
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
