import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVED_RATIO,
  stepServed,
  servedCount,
  isComplete,
  firstUnserved,
  alignHeld,
  isResumable,
  stepsLeft,
} from './resume';
import type { ResumePoint } from './resume';

/** An eight-stretch routine, thirty seconds of hold each. */
const EIGHT = Array.from({ length: 8 }, () => 30);

const NOW = new Date(2026, 6, 10, 22, 30); // night of 2026-07-10

function point(over: Partial<ResumePoint> = {}): ResumePoint {
  return {
    title: 'Night Routine',
    stepIds: ['cat-cow', 'sphinx', 'childs-pose'],
    planned: [30, 30, 30],
    held: [30, 0, 0],
    night: '2026-07-10',
    savedAt: NOW.toISOString(),
    ...over,
  };
}

test('a hold counts once most of it has been served', () => {
  assert.equal(stepServed(30, 30), true);
  assert.equal(stepServed(30, 21), true, 'seventy percent is enough');
  assert.equal(stepServed(30, 20), false);
  assert.equal(stepServed(30, 0), false);
  // A step that asks for nothing cannot be dodged, so it is served by default —
  // otherwise it would be an unfinishable step in the middle of a routine.
  assert.equal(stepServed(0, 0), true);
});

test('skipping the whole way through is not finishing', () => {
  // The exact cheat this exists to close: eight taps of Skip reaches the end of
  // the routine in about four seconds, and used to log a completed session.
  const skipped = EIGHT.map(() => 0);
  assert.equal(servedCount(EIGHT, skipped), 0);
  assert.equal(isComplete(EIGHT, skipped), false);
});

test('doing the routine finishes it, and so does skipping one stretch', () => {
  assert.equal(isComplete(EIGHT, EIGHT), true);

  const allButOne = [...EIGHT.slice(0, 7).map(() => 30), 0];
  assert.equal(isComplete(EIGHT, allButOne), true, 'seven of eight is a wind-down');

  const half = EIGHT.map((_, i) => (i < 4 ? 30 : 0));
  assert.equal(isComplete(EIGHT, half), false, 'half of it is not');
});

test('an empty session is never a completed one', () => {
  // Or the emptiest possible routine would be the cheapest badge in the app.
  assert.equal(isComplete([], []), false);
});

test('a short hold still counts if it is most of that hold', () => {
  // Steps are not all the same length, so the ratio has to be applied per step
  // rather than to a total — a routine of one long stretch and three short ones
  // could otherwise be "finished" by holding the long one alone.
  const mixed = [120, 30, 30, 30];
  const longOnly = [120, 0, 0, 0];
  assert.equal(isComplete(mixed, longOnly), false);
  assert.equal(servedCount(mixed, longOnly), 1);
});

test('you come back in at the first stretch you skipped, not where you quit', () => {
  // Skipped 1 and 2, did 3, quit during 4. Resuming at 4 would hand back the two
  // that were dodged.
  const held = [0, 0, 30, 5];
  assert.equal(firstUnserved([30, 30, 30, 30], held), 0);
  assert.equal(firstUnserved([30, 30, 30, 30], [30, 0, 30, 30]), 1);
  assert.equal(firstUnserved(EIGHT, EIGHT), -1, 'nothing left');
});

test('held seconds are realigned to the steps that actually resolved', () => {
  assert.deepEqual(alignHeld([30, 20], 4), [30, 20, 0, 0], 'missing entries are unserved');
  assert.deepEqual(alignHeld([30, 20, 10, 5], 2), [30, 20], 'extra entries are dropped');
  assert.deepEqual(alignHeld([], 3), [0, 0, 0]);
  assert.deepEqual(alignHeld([-5], 1), [0], 'never negative');
});

test('a resume point is offered only tonight, and only with work left', () => {
  assert.equal(isResumable(point(), NOW), true);
  assert.equal(isResumable(null, NOW), false);
  assert.equal(isResumable(point({ held: [30, 30, 30] }), NOW), false, 'nothing left in it');
  assert.equal(isResumable(point({ stepIds: [], planned: [], held: [] }), NOW), false);

  // Last night's, which is the rule that stops a lapsed streak being patched by
  // finishing an old session — credit lands on the night you do the work.
  assert.equal(isResumable(point(), new Date(2026, 6, 11, 22, 0)), false);
  // Still the same night at half past midnight, on the 4am cutoff.
  assert.equal(isResumable(point(), new Date(2026, 6, 11, 0, 30)), true);
});

test('the card counts the stretches still owed', () => {
  assert.equal(stepsLeft(point()), 2);
  assert.equal(stepsLeft(point({ held: [30, 30, 0] })), 1);
  assert.equal(stepsLeft(point({ held: [0, 0, 0] })), 3);
});

test('the served ratio is loose enough to be human and tight enough to matter', () => {
  assert.ok(SERVED_RATIO > 0.5, 'below half would let a session be mostly skipped');
  assert.ok(SERVED_RATIO < 1, 'exactly all of it would fail on a single dropped tick');
});
