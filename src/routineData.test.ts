import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  LEVELS,
  MAX_ROUTINE_NAME,
  builtinRoutine,
  cleanRoutineName,
  filterSteps,
  groupByCategory,
  moveStep,
  removeStep,
  resolveSteps,
  routineMinutes,
  routineSeconds,
  stepCatalog,
} from './routineData';

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
