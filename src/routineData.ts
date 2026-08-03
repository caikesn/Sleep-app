import type { IconName } from './components/Icon';
import type { PoseName } from './poseArt';

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
  /**
   * How long to hold it — **per side** on a two-sided pose, and in total on
   * every other one. Never read directly for a duration: `stepSeconds` is the
   * number of seconds the timer actually runs for.
   *
   * Authored as the unit rather than the total because the unit is the part the
   * body cares about. A 45-second Figure-Four is a 22-second hold done twice,
   * which is under the ~30 seconds a static stretch needs to do anything, and
   * nothing in the old numbers made that visible.
   */
  seconds: number;
  /**
   * Done on both sides, one after the other. The timer runs `seconds` twice and
   * says which side you're on; the drawing is always the left-side version.
   */
  perSide?: true;
  /** Describes the movement, not the pose. See Icon.tsx. */
  icon: IconName;
  /** The drawing of someone in it. One per step, never shared. See poseArt.ts. */
  pose: PoseName;
  description: string;
  category: StepCategory;
  level: StepLevel;
};

/**
 * The shortest a static hold is allowed to be.
 *
 * Below this a stretch is a gesture at a stretch. It is a floor rather than a
 * target — plenty of poses here are longer, and the restful ones are much
 * longer — but nothing in the catalog may go under it.
 */
export const MIN_HOLD_SECONDS = 30;

/**
 * How long you get to *get into* a pose before its timer starts.
 *
 * The old session went straight from one hold to the next, which meant the
 * clock on Pigeon started while you were still on your knees looking at the
 * screen — every stretch was really the stretch minus however long it took to
 * arrange yourself, and the deeper the pose the more it cost. This is that time,
 * given back and counted separately.
 *
 * A two-sided pose gets one before each side, because switching sides is
 * getting into the pose again.
 *
 * Five. Long enough to lie down and find the shape, short enough that it never
 * becomes a pause you are waiting out — which is what the first pass at twice
 * this was. The count-in covers the last three of it, so the gap is really two
 * seconds of quiet and then a countdown.
 */
export const GET_READY_SECONDS = 5;

/**
 * A step's duration as it reads in a list: `45s`, `2m`, or `30s ×2`.
 *
 * The `×2` is the whole reason this is shared rather than a helper per screen.
 * Every list in the app used to print a single number that silently meant two
 * different things depending on the step, and three copies of the formatter is
 * three places for that to come back.
 */
export function stepLength(step: RoutineStep): string {
  const unit = step.seconds >= 60 ? `${Math.round(step.seconds / 60)}m` : `${step.seconds}s`;
  return step.perSide ? `${unit} ×2` : unit;
}

/** How many holds a step is: two for a pose done on both sides, otherwise one. */
export function stepPhases(step: RoutineStep): number {
  return step.perSide ? 2 : 1;
}

/** Time spent actually holding the pose, both sides included. */
export function stepSeconds(step: RoutineStep): number {
  return step.seconds * stepPhases(step);
}

/** Everything the step costs, getting into it included. What the clock spends. */
export function stepTotalSeconds(step: RoutineStep): number {
  return (step.seconds + GET_READY_SECONDS) * stepPhases(step);
}

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
 * Re-*timing* one is safe too, and deliberately global — routines store ids, so
 * a better number here is a better number in every routine that uses the step.
 *
 * Two rules the numbers follow, and the tests enforce:
 *
 * - A hold is at least `MIN_HOLD_SECONDS`, **per side**. Two-sided poses carry
 *   `perSide` and their `seconds` is one side of it.
 * - A breath pose lasts a whole number of its own cycles. The old durations
 *   were round numbers instead, so 4-7-8 — a 19-second cycle — ran for 60
 *   seconds and cut you off three breaths in, mid-exhale.
 */
export const stepCatalog: RoutineStep[] = [
  // — Breathing ————————————————————————————————————————————————
  {
    id: 'breathing',
    name: 'Box Breathing',
    // 16s a round, four rounds.
    seconds: 64,
    icon: 'breathe',
    pose: 'breathing',
    description: 'Sit cross-legged. Inhale 4s, hold 4s, exhale 4s, hold 4s. Repeat, letting your shoulders drop.',
    category: 'breath',
    level: 'gentle',
  },
  {
    id: 'long-exhale',
    name: 'Long Exhale',
    // 12s a round, five rounds.
    seconds: 60,
    icon: 'breathe',
    pose: 'long-exhale',
    description: 'Breathe in for a count of 4, out for a count of 8. The longer exhale is the part that tells your body the day is over.',
    category: 'breath',
    level: 'gentle',
  },
  {
    id: 'belly-breathing',
    name: 'Belly Breathing',
    // No fixed count in this one — it is your own breath, slowed.
    seconds: 90,
    icon: 'breathe',
    pose: 'belly-breathing',
    description: 'One hand on your chest, one on your belly. Breathe so that only the lower hand moves.',
    category: 'breath',
    level: 'gentle',
  },
  {
    id: 'four-seven-eight',
    name: '4-7-8 Breathing',
    // 19s a round, four rounds — which is what the description has always said.
    seconds: 76,
    icon: 'breathe',
    pose: 'four-seven-eight',
    description: 'Inhale through your nose for 4, hold for 7, exhale through your mouth for 8. Four rounds is plenty.',
    category: 'breath',
    level: 'moderate',
  },
  {
    id: 'alternate-nostril',
    name: 'Alternate Nostril',
    // 16s for a full there-and-back round, six rounds.
    seconds: 96,
    icon: 'breathe',
    pose: 'alternate-nostril',
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
    pose: 'neck-rolls',
    description: 'Slowly roll your head in a full circle, 5 times each direction. Keep shoulders relaxed.',
    category: 'neck',
    level: 'gentle',
  },
  {
    id: 'shoulder-rolls',
    name: 'Shoulder Rolls',
    seconds: 30,
    icon: 'rotate',
    pose: 'shoulder-rolls',
    description: 'Roll both shoulders backwards in big slow circles, then forwards. Let your arms hang.',
    category: 'neck',
    level: 'gentle',
  },
  {
    id: 'ear-to-shoulder',
    name: 'Ear to Shoulder',
    seconds: 30,
    perSide: true,
    icon: 'tilt',
    pose: 'ear-to-shoulder',
    description: 'Drop your ear toward your shoulder and rest a hand on your head for a little weight.',
    category: 'neck',
    level: 'gentle',
  },
  {
    id: 'chin-tuck',
    name: 'Chin Tucks',
    seconds: 30,
    icon: 'draw',
    pose: 'chin-tuck',
    description: 'Draw your chin straight back, as if making a double chin. Hold for 5, release. Repeat slowly.',
    category: 'neck',
    level: 'gentle',
  },
  {
    id: 'doorway-chest',
    name: 'Chest Opener',
    seconds: 30,
    perSide: true,
    icon: 'open',
    pose: 'doorway-chest',
    description: 'Forearm on a door frame at shoulder height, step gently through until you feel the chest open.',
    category: 'neck',
    level: 'gentle',
  },
  {
    id: 'eagle-arms',
    name: 'Eagle Arms',
    seconds: 30,
    perSide: true,
    icon: 'draw',
    pose: 'eagle-arms',
    description: 'Cross one arm under the other and wrap the forearms. Lift the elbows until the upper back spreads.',
    category: 'neck',
    level: 'moderate',
  },
  {
    id: 'thread-the-needle',
    name: 'Thread the Needle',
    seconds: 30,
    perSide: true,
    icon: 'twist',
    pose: 'thread-the-needle',
    description: 'On hands and knees, slide one arm under the other and rest the shoulder on the floor.',
    category: 'neck',
    level: 'moderate',
  },

  // — Back & spine ——————————————————————————————————————————————
  {
    id: 'cat-cow',
    name: 'Cat-Cow',
    seconds: 30,
    icon: 'arch',
    pose: 'cat-cow',
    description: 'On hands and knees, arch your back up on the exhale, dip it down on the inhale. Slow and controlled.',
    category: 'back',
    level: 'gentle',
  },
  {
    id: 'knees-to-chest',
    name: 'Knees to Chest',
    seconds: 30,
    icon: 'draw',
    pose: 'knees-to-chest',
    description: 'Lie on your back and hug both knees in. Rock gently side to side if it feels good.',
    category: 'back',
    level: 'gentle',
  },
  {
    id: 'supine-twist',
    name: 'Supine Twist',
    seconds: 30,
    perSide: true,
    icon: 'twist',
    pose: 'supine-twist',
    description: 'On your back, drop both knees to one side and turn your head the other way.',
    category: 'back',
    level: 'gentle',
  },
  {
    id: 'sphinx',
    name: 'Sphinx',
    seconds: 30,
    icon: 'lift',
    pose: 'sphinx',
    description: 'Lie on your front, forearms down, elbows under your shoulders. Lift the chest only as far as stays comfortable.',
    category: 'back',
    level: 'moderate',
  },
  {
    id: 'seated-twist',
    name: 'Seated Spinal Twist',
    seconds: 30,
    perSide: true,
    icon: 'twist',
    pose: 'seated-twist',
    description: 'Sit tall, cross one foot over the opposite knee, and turn toward the top leg.',
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
    pose: 'standing-fold',
    description: 'Feet hip width, soft knees, hinge forward and let your head and arms hang. Come up slowly.',
    category: 'back',
    level: 'moderate',
  },

  // — Hips & legs ————————————————————————————————————————————————
  {
    id: 'butterfly',
    name: 'Butterfly',
    seconds: 45,
    icon: 'open',
    pose: 'butterfly',
    description: 'Sit with the soles of your feet together and let the knees fall open. Lean forward only if it stays easy.',
    category: 'hips',
    level: 'gentle',
  },
  {
    id: 'happy-baby',
    name: 'Happy Baby',
    seconds: 45,
    icon: 'draw',
    pose: 'happy-baby',
    description: 'On your back, knees toward your armpits, hold the outsides of your feet. Rock gently if you like.',
    category: 'hips',
    level: 'gentle',
  },
  {
    id: 'hamstring-reclined',
    name: 'Reclined Hamstring',
    seconds: 30,
    perSide: true,
    icon: 'elevate',
    pose: 'hamstring-reclined',
    description: 'On your back, raise one leg and hold behind the thigh. A belt or towel round the foot helps.',
    category: 'hips',
    level: 'gentle',
  },
  {
    id: 'seated-forward-fold',
    name: 'Seated Forward Fold',
    seconds: 30,
    icon: 'reach',
    pose: 'seated-forward-fold',
    description: 'Sit with legs extended, hinge at the hips and reach for your feet. Let your neck relax.',
    category: 'hips',
    level: 'moderate',
  },
  {
    id: 'figure-four',
    name: 'Figure-Four Stretch',
    seconds: 30,
    perSide: true,
    icon: 'cross',
    pose: 'figure-four',
    description: 'Lie on your back, cross one ankle over the opposite knee, pull the standing leg toward your chest.',
    category: 'hips',
    level: 'moderate',
  },
  {
    id: 'low-lunge',
    name: 'Low Lunge',
    seconds: 30,
    perSide: true,
    icon: 'lift',
    pose: 'low-lunge',
    description: 'Back knee down, front foot forward, sink the hips until the front of the back thigh opens.',
    category: 'hips',
    level: 'moderate',
  },
  {
    id: 'pigeon',
    name: 'Pigeon',
    // The one hold given longer than the standard: a deep hip opener needs the
    // time to actually let go, and rushing it is how the knee gets hurt.
    seconds: 45,
    perSide: true,
    icon: 'open',
    pose: 'pigeon',
    description: 'Front shin across the mat, back leg long, fold forward over the front leg. Back off the moment the knee complains.',
    category: 'hips',
    level: 'deep',
  },

  // — Winding down ———————————————————————————————————————————————
  {
    id: 'childs-pose',
    name: "Child's Pose",
    seconds: 60,
    icon: 'fold',
    pose: 'childs-pose',
    description: 'Kneel and fold forward, arms extended or by your sides. Breathe deeply into your lower back.',
    category: 'rest',
    level: 'gentle',
  },
  {
    id: 'constructive-rest',
    name: 'Constructive Rest',
    seconds: 90,
    icon: 'rest',
    pose: 'constructive-rest',
    description: 'On your back, knees bent and feet flat, hands on your ribs. Do nothing at all and let the lower back settle.',
    category: 'rest',
    level: 'gentle',
  },
  {
    id: 'side-lying-rest',
    name: 'Side-Lying Rest',
    seconds: 90,
    icon: 'rest',
    pose: 'side-lying-rest',
    description: 'On your side, knees drawn up, a pillow between them. Close your eyes and let the breath go quiet.',
    category: 'rest',
    level: 'gentle',
  },
  {
    id: 'legs-up-wall',
    name: 'Legs Up the Wall',
    seconds: 120,
    icon: 'elevate',
    pose: 'legs-up-wall',
    description: 'Lie on your back with legs resting up a wall. Rest your arms out to the sides and breathe slowly.',
    category: 'rest',
    level: 'gentle',
  },
  {
    id: 'final-relaxation',
    name: 'Final Relaxation',
    seconds: 90,
    icon: 'rest',
    pose: 'final-relaxation',
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

/**
 * How long a routine takes end to end — both sides of every two-sided pose, and
 * the time to get into each of them.
 *
 * The number people plan their evening around, so it is the honest one rather
 * than the sum of the holds.
 */
export function routineSeconds(stepIds: string[]): number {
  return resolveSteps(stepIds).reduce((sum, step) => sum + stepTotalSeconds(step), 0);
}

/** Whole minutes — but never rounds a real routine down to "0 min". */
export function routineMinutes(stepIds: string[]): number {
  const seconds = routineSeconds(stepIds);
  return seconds === 0 ? 0 : Math.max(1, Math.round(seconds / 60));
}

/** As above, for a set of steps that isn't a saved routine yet. */
export function stepsMinutes(steps: RoutineStep[]): number {
  const seconds = steps.reduce((sum, step) => sum + stepTotalSeconds(step), 0);
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
