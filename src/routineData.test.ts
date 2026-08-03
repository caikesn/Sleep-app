import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  GET_READY_SECONDS,
  LEVELS,
  MAX_ROUTINE_NAME,
  MIN_HOLD_SECONDS,
  builtinRoutine,
  cleanRoutineName,
  defaultRoutine,
  filterSteps,
  groupByCategory,
  moveStep,
  removeStep,
  resolveSteps,
  routineMinutes,
  routineSeconds,
  stepCatalog,
  stepLength,
  stepSeconds,
  stepTotalSeconds,
} from './routineData';
import { POSES } from './poseArt';

const [first, second, third] = stepCatalog.map((step) => step.id);

test('the built-in routine resolves to real steps', () => {
  // Catches a typo in the built-in's id list, which would otherwise show up as
  // a routine that silently loses a step.
  assert.equal(resolveSteps(builtinRoutine.stepIds).length, builtinRoutine.stepIds.length);
  assert.ok(builtinRoutine.stepIds.length > 0);
});

test('catalog step ids are unique', () => {
  const ids = stepCatalog.map((step) => step.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every step carries a real category and level, and has a description', () => {
  const categories = new Set(CATEGORIES.map((entry) => entry.id));
  const levels = new Set(LEVELS.map((entry) => entry.id));

  for (const step of stepCatalog) {
    assert.ok(categories.has(step.category), `${step.id} has an unknown category`);
    assert.ok(levels.has(step.level), `${step.id} has an unknown level`);
    assert.ok(step.seconds > 0, `${step.id} has no duration`);
    assert.ok(step.description.length > 20, `${step.id} needs a real description`);
  }
});

test('every step has its own drawing, and no two share one', () => {
  // A shared pose is the exact failure the art was made to end — `open` used to
  // be the same arrow for both Butterfly and Pigeon.
  const poses = stepCatalog.map((step) => step.pose);
  assert.equal(new Set(poses).size, poses.length, 'two steps share a pose');

  for (const step of stepCatalog) {
    assert.ok(POSES[step.pose], `${step.id} points at a drawing that doesn't exist`);
  }
});

test('no hold is shorter than the floor, per side', () => {
  // The bug this whole change exists for: a 45-second two-sided pose is a
  // 22-second hold done twice, and the old catalog was full of them.
  for (const step of stepCatalog) {
    assert.ok(
      step.seconds >= MIN_HOLD_SECONDS,
      `${step.id} holds for ${step.seconds}s${step.perSide ? ' a side' : ''}`
    );
  }
});

test('a two-sided pose runs its hold twice, with a get-ready before each', () => {
  const twoSided = stepCatalog.find((step) => step.perSide);
  const oneSided = stepCatalog.find((step) => !step.perSide);
  assert.ok(twoSided && oneSided);

  assert.equal(stepSeconds(twoSided), twoSided.seconds * 2);
  assert.equal(stepTotalSeconds(twoSided), (twoSided.seconds + GET_READY_SECONDS) * 2);

  assert.equal(stepSeconds(oneSided), oneSided.seconds);
  assert.equal(stepTotalSeconds(oneSided), oneSided.seconds + GET_READY_SECONDS);
});

test('a two-sided pose says so in its duration, and its description does not', () => {
  for (const step of stepCatalog) {
    assert.equal(
      stepLength(step).includes('×2'),
      !!step.perSide,
      `${step.id} reads as the wrong number of sides`
    );
    // The app announces the switch and mirrors the drawing, so a description
    // repeating it would be the third place to keep in step — and the one that
    // would go stale silently.
    assert.ok(
      !/switch sides/i.test(step.description),
      `${step.id} still tells you to switch sides in prose`
    );
  }
});

test('a breath pose lasts a whole number of its own cycles', () => {
  // 4-7-8 is a 19-second cycle and used to run for 60, cutting you off
  // three breaths in, mid-exhale.
  const cycles: Record<string, number> = {
    breathing: 16,
    'long-exhale': 12,
    'four-seven-eight': 19,
    'alternate-nostril': 16,
  };

  for (const [id, cycle] of Object.entries(cycles)) {
    const step = stepCatalog.find((s) => s.id === id);
    assert.ok(step, `${id} has left the catalog`);
    assert.equal(step.seconds % cycle, 0, `${id} runs ${step.seconds}s, not a multiple of ${cycle}`);
  }
});

test('the built-in routine stays a length someone would actually do', () => {
  // A guard rather than a target: the point is that a future edit to any one
  // step cannot quietly turn the nightly routine into twenty minutes.
  const minutes = routineMinutes(builtinRoutine.stepIds);
  assert.ok(minutes >= 8 && minutes <= 14, `the built-in routine is now ${minutes} min`);
  assert.equal(defaultRoutine.length, builtinRoutine.stepIds.length);
});

test('no category is left empty', () => {
  // An empty category renders as a filter chip that leads nowhere.
  for (const { id } of CATEGORIES) {
    assert.ok(filterSteps({ category: id }).length > 0, `${id} has no steps`);
  }
});

test('groupByCategory follows CATEGORIES order, not the order steps arrive in', () => {
  const shuffled = [...stepCatalog].reverse();
  const groups = groupByCategory(shuffled);
  assert.deepEqual(
    groups.map((group) => group.category),
    CATEGORIES.map((entry) => entry.id)
  );
});

test('groupByCategory drops empty groups so no bare headings render', () => {
  const groups = groupByCategory(filterSteps({ category: 'breath' }));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].category, 'breath');
});

test('filterSteps keeps catalog order and combines category with level', () => {
  const deep = filterSteps({ level: 'deep' });
  assert.ok(deep.every((step) => step.level === 'deep'));

  const gentleHips = filterSteps({ category: 'hips', level: 'gentle' });
  assert.ok(gentleHips.every((step) => step.category === 'hips' && step.level === 'gentle'));

  const hips = filterSteps({ category: 'hips' });
  const catalogOrder = stepCatalog.filter((step) => step.category === 'hips').map((s) => s.id);
  assert.deepEqual(hips.map((step) => step.id), catalogOrder);
});

test('an empty filter is the whole catalog', () => {
  assert.equal(filterSteps().length, stepCatalog.length);
  assert.equal(filterSteps({ category: null, level: null }).length, stepCatalog.length);
});

test('unknown step ids are dropped rather than rendered blank', () => {
  const steps = resolveSteps([first, 'removed-in-a-later-release', second]);
  assert.deepEqual(
    steps.map((step) => step.id),
    [first, second]
  );
});

test('the same step may appear more than once', () => {
  const steps = resolveSteps([first, second, first]);
  assert.equal(steps.length, 3);
  assert.equal(routineSeconds([first, first]), routineSeconds([first]) * 2);
});

test('a short routine never reads as zero minutes', () => {
  const shortest = stepCatalog.reduce((a, b) => (a.seconds <= b.seconds ? a : b));
  assert.ok(shortest.seconds < 60, 'expected at least one sub-minute step in the catalog');
  assert.equal(routineMinutes([shortest.id]), 1);
});

test('an empty routine is zero minutes, not one', () => {
  assert.equal(routineMinutes([]), 0);
  assert.equal(routineSeconds([]), 0);
});

test('moveStep shifts one step in either direction', () => {
  assert.deepEqual(moveStep([first, second, third], 2, -1), [first, third, second]);
  assert.deepEqual(moveStep([first, second, third], 0, 1), [second, first, third]);
});

test('moving off either end leaves the list untouched', () => {
  const ids = [first, second, third];
  assert.deepEqual(moveStep(ids, 0, -1), ids);
  assert.deepEqual(moveStep(ids, 2, 1), ids);
  assert.deepEqual(moveStep(ids, 9, -1), ids);
  assert.deepEqual(moveStep(ids, -1, 1), ids);
});

test('moveStep does not mutate its input', () => {
  const ids = [first, second];
  moveStep(ids, 0, 1);
  assert.deepEqual(ids, [first, second]);
});

test('removeStep removes by position, not by id', () => {
  // The whole point: with the same stretch twice, removing the second must
  // leave the first standing.
  assert.deepEqual(removeStep([first, second, first], 2), [first, second]);
  assert.deepEqual(removeStep([first, second, first], 0), [second, first]);
});

test('routine names are trimmed, defaulted and capped for the database check', () => {
  assert.equal(cleanRoutineName('  Wind-down  '), 'Wind-down');
  assert.equal(cleanRoutineName('   '), 'My routine');
  assert.equal(cleanRoutineName('', 'Night Routine copy'), 'Night Routine copy');
  assert.equal(cleanRoutineName('x'.repeat(200)).length, MAX_ROUTINE_NAME);
});
