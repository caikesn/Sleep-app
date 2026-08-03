import test from 'node:test';
import assert from 'node:assert/strict';
import { GET_READY_SECONDS, resolveSteps, stepCatalog } from './routineData';
import { buildPhases, phaseIndexForStep, phaseLabel } from './sessionPlan';

const oneSided = stepCatalog.find((step) => !step.perSide)!;
const twoSided = stepCatalog.find((step) => step.perSide)!;

test('every hold is preceded by a get-ready', () => {
  // The complaint this fixes: the clock on Pigeon used to start while you were
  // still on your knees reading the screen.
  const phases = buildPhases(resolveSteps([oneSided.id, twoSided.id]));

  for (let i = 0; i < phases.length; i += 1) {
    assert.equal(phases[i].kind, i % 2 === 0 ? 'ready' : 'hold');
  }
  for (const phase of phases) {
    if (phase.kind === 'ready') assert.equal(phase.seconds, GET_READY_SECONDS);
  }
});

test('a one-sided step is one hold, a two-sided one is left then right', () => {
  assert.deepEqual(
    buildPhases([oneSided]).map((p) => [p.kind, p.side]),
    [
      ['ready', undefined],
      ['hold', undefined],
    ]
  );

  assert.deepEqual(
    buildPhases([twoSided]).map((p) => [p.kind, p.side]),
    [
      ['ready', 'left'],
      ['hold', 'left'],
      ['ready', 'right'],
      ['hold', 'right'],
    ]
  );
});

test('both sides hold for the full time — the whole point of `perSide`', () => {
  const holds = buildPhases([twoSided]).filter((p) => p.kind === 'hold');
  assert.equal(holds.length, 2);
  for (const hold of holds) assert.equal(hold.seconds, twoSided.seconds);
});

test('only the very last hold is final, so only it gets the closing bell', () => {
  const phases = buildPhases(resolveSteps([oneSided.id, twoSided.id]));
  const finals = phases.filter((phase) => phase.final);
  assert.equal(finals.length, 1);
  assert.equal(finals[0], phases[phases.length - 1]);
  assert.equal(finals[0].kind, 'hold');
});

test('phases report which step they belong to, so "3 of 8" still counts stretches', () => {
  const steps = resolveSteps([twoSided.id, oneSided.id]);
  const phases = buildPhases(steps);
  // Four phases for the two-sided step, two for the one-sided — but two steps.
  assert.equal(phases.length, 6);
  assert.deepEqual(
    phases.map((phase) => phase.stepIndex),
    [0, 0, 0, 0, 1, 1]
  );
});

test('phaseIndexForStep lands on the top of a step, never mid-pose', () => {
  const phases = buildPhases(resolveSteps([twoSided.id, oneSided.id]));
  assert.equal(phaseIndexForStep(phases, 0), 0);
  assert.equal(phaseIndexForStep(phases, 1), 4);
  // Past the end, so Skip on the last step finishes rather than sticking.
  assert.equal(phaseIndexForStep(phases, 2), phases.length);
});

test('the side is named while you are still getting into it, not once the clock has started', () => {
  const [ready, hold] = buildPhases([twoSided]);
  assert.match(phaseLabel(ready), /Left side/);
  assert.equal(phaseLabel(hold), 'Left side');
  assert.equal(phaseLabel(buildPhases([oneSided])[0]), 'Get into it');
});

test('an empty routine has no phases', () => {
  assert.deepEqual(buildPhases([]), []);
});
