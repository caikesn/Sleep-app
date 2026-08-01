import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BREATH_PATTERNS,
  PHASE_LABELS,
  breathsIn,
  cycleSeconds,
  patternById,
  phaseAt,
  scaleFor,
} from './breathing';

const box = patternById('box')!;
const longExhale = patternById('long-exhale')!;

test('every pattern is well formed and labelled', () => {
  const ids = BREATH_PATTERNS.map((pattern) => pattern.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const pattern of BREATH_PATTERNS) {
    assert.ok(pattern.phases.length >= 2, `${pattern.id} needs at least two phases`);
    assert.ok(pattern.phases.every((phase) => phase.seconds > 0));
    assert.ok(pattern.phases.every((phase) => PHASE_LABELS[phase.kind]));
    // The pacer spots a phase boundary by index alone, which only holds if no
    // pattern ever repeats a phase back to back.
    for (let i = 1; i < pattern.phases.length; i += 1) {
      assert.notEqual(pattern.phases[i].kind, pattern.phases[i - 1].kind, `${pattern.id}`);
    }
  }
});

test('every pattern starts on an inhale', () => {
  // Anything else means the session opens by asking you to breathe out air you
  // have not been told to take in.
  for (const pattern of BREATH_PATTERNS) {
    assert.equal(pattern.phases[0].kind, 'inhale', pattern.id);
  }
});

test('cycleSeconds adds up the phases', () => {
  assert.equal(cycleSeconds(box), 16);
  assert.equal(cycleSeconds(longExhale), 12);
});

test('phaseAt walks through a cycle in order', () => {
  assert.equal(phaseAt(box, 0).phase.kind, 'inhale');
  assert.equal(phaseAt(box, 3.9).phase.kind, 'inhale');
  assert.equal(phaseAt(box, 4).phase.kind, 'hold');
  assert.equal(phaseAt(box, 8).phase.kind, 'exhale');
  assert.equal(phaseAt(box, 12).phase.kind, 'hold-out');
  assert.equal(phaseAt(box, 15.9).phase.kind, 'hold-out');
});

test('phaseAt wraps round to the start of the next cycle', () => {
  assert.equal(phaseAt(box, 16).index, 0);
  assert.equal(phaseAt(box, 16.5).phase.kind, 'inhale');
  // Twenty minutes in, which is where a drifting counter would have gone wrong.
  assert.deepEqual(phaseAt(box, 1200).index, phaseAt(box, 0).index);
  assert.equal(phaseAt(box, 1204).phase.kind, 'hold');
});

test('phaseAt never returns a remaining count of zero', () => {
  // A pacer that reads "0" is telling you a phase you are still in has ended.
  for (const pattern of BREATH_PATTERNS) {
    for (let t = 0; t < cycleSeconds(pattern) * 2; t += 0.25) {
      const at = phaseAt(pattern, t);
      assert.ok(at.remaining >= 1, `${pattern.id} at ${t}`);
      assert.ok(at.remaining <= at.phase.seconds, `${pattern.id} at ${t}`);
    }
  }
});

test('phaseAt progress runs from 0 to 1 within a phase', () => {
  assert.equal(phaseAt(box, 0).progress, 0);
  assert.equal(phaseAt(box, 2).progress, 0.5);
  assert.ok(phaseAt(box, 3.99).progress > 0.99);
});

test('negative elapsed does not index off the front of the cycle', () => {
  // Clock skew or a paused-then-resumed session can hand this a value below 0.
  const at = phaseAt(box, -1);
  assert.ok(at.index >= 0 && at.index < box.phases.length);
  assert.equal(at.phase.kind, 'hold-out');
});

test('the orb holds its size through a hold, in both directions', () => {
  // The whole point of the hold: drifting back toward neutral would be telling
  // you to breathe when the pattern says not to.
  assert.equal(scaleFor(phaseAt(box, 4)), 1);
  assert.equal(scaleFor(phaseAt(box, 7.9)), 1);
  assert.equal(scaleFor(phaseAt(box, 12)), 0);
  assert.equal(scaleFor(phaseAt(box, 15.9)), 0);
});

test('the orb grows on the inhale and shrinks on the exhale', () => {
  assert.ok(scaleFor(phaseAt(longExhale, 1)) < scaleFor(phaseAt(longExhale, 3)));
  assert.ok(scaleFor(phaseAt(longExhale, 5)) > scaleFor(phaseAt(longExhale, 11)));
});

test('breathsIn counts only whole breaths', () => {
  assert.equal(breathsIn(box, 16), 1);
  assert.equal(breathsIn(box, 31), 1);
  assert.equal(breathsIn(box, 32), 2);
  assert.equal(breathsIn(longExhale, 300), 25);
});
