import test from 'node:test';
import assert from 'node:assert/strict';
import { HEAD_R, POSES, POSE_BOX, posePath } from './poseArt';
import type { PoseArt } from './poseArt';

const entries = Object.entries(POSES) as [string, PoseArt][];

test('every drawing is actually a person', () => {
  // A pose with no strokes renders as a floating head, which is worse than no
  // drawing at all — it looks like something failed to load.
  for (const [name, art] of entries) {
    assert.ok(art.strokes.length >= 2, `${name} has almost nothing in it`);
    for (const stroke of art.strokes) {
      assert.ok(stroke.p.length >= 2, `${name} has a stroke with one point in it`);
    }
  }
});

test('nothing is drawn outside the box, head included', () => {
  // Anything past the edge is clipped by the viewBox, and a clipped limb reads
  // as an amputation rather than as a crop.
  for (const [name, art] of entries) {
    const points = [
      ...art.strokes.flatMap((stroke) => stroke.p),
      // The head is a circle, so its extremes are what have to fit.
      [art.head[0] - HEAD_R, art.head[1] - HEAD_R] as const,
      [art.head[0] + HEAD_R, art.head[1] + HEAD_R] as const,
    ];

    for (const [x, y] of points) {
      assert.ok(x >= 0 && x <= POSE_BOX, `${name} runs off the side at x=${x}`);
      assert.ok(y >= 0 && y <= POSE_BOX, `${name} runs off the top or bottom at y=${y}`);
    }
  }
});

test('a floor is a floor: below the body, and inside the box', () => {
  for (const [name, art] of entries) {
    if (art.floor === undefined) continue;
    assert.ok(art.floor > 0 && art.floor < POSE_BOX, `${name} has its floor off the page`);
    assert.ok(art.floor > art.head[1], `${name} has its head below the floor`);
  }
});

test('the curve passes through every joint it is given', () => {
  // Catmull-Rom rather than plain quadratic smoothing precisely so a knee ends
  // up where it was authored. This is the assertion that keeps it that way.
  const d = posePath([
    [10, 10],
    [20, 30],
    [40, 20],
  ]);
  assert.match(d, /^M 10 10/);
  assert.ok(d.includes('20 30'), 'the middle joint was smoothed away');
  assert.ok(d.trimEnd().endsWith('40 20'), 'the curve does not end on the last joint');
});

test('two points is a straight line, and a closed path closes', () => {
  assert.equal(
    posePath([
      [1, 2],
      [3, 4],
    ]),
    'M 1 2 L 3 4'
  );
  assert.match(
    posePath(
      [
        [1, 1],
        [5, 1],
        [5, 5],
      ],
      true
    ),
    /Z$/
  );
});

test('a lone point still draws, so a hand mark never silently disappears', () => {
  assert.equal(posePath([[7, 8]]), 'M 7 8 L 7 8');
  assert.equal(posePath([]), '');
});
