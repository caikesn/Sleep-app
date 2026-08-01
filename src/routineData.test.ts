import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ROUTINE_NAME,
  builtinRoutine,
  cleanRoutineName,
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
