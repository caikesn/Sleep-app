import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BEND_BANDS,
  BEND_SHARE,
  FLAME,
  FLAME_BODY,
  INNER,
  bendCuts,
  MARK_FOOT,
  MARK_SCALE,
  VIEW,
  centreline,
  halfWidth,
  inside,
  outline,
  type Profile,
} from './flame';

/**
 * The mark is a shape nobody can assert is beautiful, so these test the things
 * four rebuilds of it were actually about — every one of them is a failure that
 * shipped or nearly shipped, written down as an inequality.
 */

const sample = (profile: Profile, n = 400) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const y = profile.apex + ((profile.base - profile.apex) * i) / n;
    return { y, w: halfWidth(profile, y) };
  });

test('the flame comes to a point at the tip and a blunt stub at the foot', () => {
  for (const [name, profile] of Object.entries({ FLAME, INNER })) {
    assert.equal(halfWidth(profile, profile.apex), 0, `${name} is blunt at the apex`);
    assert.equal(halfWidth(profile, profile.apex - 0.01), 0);
    assert.equal(halfWidth(profile, profile.base + 0.01), 0);

    // Not zero — a shape sharp at both ends is a leaf, which is what the
    // notification icon showed the moment the foot was taken to a point.
    const stub = halfWidth(profile, profile.base);
    assert.ok(Math.abs(stub - profile.w * profile.stub) < 1e-12);
    assert.ok(stub > 0, `${name} comes to a spike at the foot`);
    // But narrow: this is the width of a wick, not the base of a cone.
    assert.ok(stub < profile.w * 0.3, `${name} sits on a slab`);
  }
});

test('the widest point is where the profile says it is', () => {
  for (const [name, profile] of Object.entries({ FLAME, INNER })) {
    const points = sample(profile);
    const widest = points.reduce((a, b) => (b.w > a.w ? b : a));
    assert.ok(Math.abs(widest.y - profile.widest) < 0.002, `${name} bulges off its widest point`);
    assert.equal(halfWidth(profile, profile.widest), profile.w);
    // Sampled on a grid that need not land on `widest`, so the measured peak
    // creeps up on the real one from below rather than matching it.
    assert.ok(profile.w - widest.w < 1e-4, `${name} is wider somewhere than its own w`);
  }
});

test('it is a flame and not a water droplet', () => {
  // The failure this shape was rebuilt for, twice: at icon size a bulb reads as
  // a flame because nothing else it could be is that small, and the first time
  // it was drawn at 190pt it read as a drop of liquid. Two things separate them.

  // One: the widest point sits above the middle of the shape, not below it. A
  // drop hangs its mass at the bottom.
  const span = FLAME.base - FLAME.apex;
  const down = (FLAME.widest - FLAME.apex) / span;
  assert.ok(down < 0.65, `the flame is widest ${Math.round(down * 100)}% of the way down`);

  // Two: it pinches on the way to the foot rather than holding a round
  // shoulder. Measured as the width halfway from the widest point to the base,
  // which a circle would still be at 87% of.
  const mid = (FLAME.widest + FLAME.base) / 2;
  assert.ok(halfWidth(FLAME, mid) / FLAME.w < 0.8, 'the flame has a droplet shoulder');
});

test('the flame is taller than it is round', () => {
  const ratio = (FLAME.base - FLAME.apex) / (FLAME.w * 2);
  assert.ok(ratio > 2.9, `the flame is only ${ratio.toFixed(1)}:1 and reads as a bead`);
});

test('the two curves meet without a kink', () => {
  // They are joined at the widest point, where both are required to have zero
  // slope. A mismatch there is a visible corner on the side of the mark at any
  // size — and it is the first thing an exponent change breaks.
  const step = 1e-4;
  const above = (FLAME.w - halfWidth(FLAME, FLAME.widest - step)) / step;
  const below = (FLAME.w - halfWidth(FLAME, FLAME.widest + step)) / step;
  assert.ok(Math.abs(above) < 0.05, `the upper curve arrives at a slope of ${above}`);
  assert.ok(Math.abs(below) < 0.05, `the lower curve leaves at a slope of ${below}`);
});

test('the width runs one way and then the other, never in and out', () => {
  // A wobble is what a badly chosen exponent pair produces, and on a shape this
  // small it reads as a dent rather than as a curve.
  for (const [name, profile] of Object.entries({ FLAME, INNER })) {
    const points = sample(profile);
    let turns = 0;
    for (let i = 2; i < points.length; i += 1) {
      const before = points[i - 1].w - points[i - 2].w;
      const after = points[i].w - points[i - 1].w;
      if (before > 1e-12 && after < -1e-12) turns += 1;
      if (before < -1e-12 && after > 1e-12) turns += 1;
    }
    assert.ok(turns <= 1, `${name} changes direction ${turns} times`);
  }
});

test('the flame leans, and it leans from its foot', () => {
  assert.equal(centreline(FLAME.base), 0, 'the foot has moved off centre');
  assert.ok(centreline(FLAME.apex) > 0.02, 'the lean is too small to read');
  // Monotonic going up: a centreline that doubles back is an S-bend.
  let previous = -Infinity;
  for (const { y } of sample(FLAME).reverse()) {
    const x = centreline(y);
    assert.ok(x >= previous - 1e-12, 'the centreline doubles back');
    previous = x;
  }
});

test('the inner cone stays inside the flame', () => {
  // It is drawn over the body, so anywhere it pokes out is a bright sliver with
  // no flame behind it — the tell that the highlight was painted on.
  for (const { y, w } of sample(INNER)) {
    assert.ok(w <= halfWidth(FLAME, y) - 1e-9, `the cone escapes the body at y=${y.toFixed(3)}`);
  }
});

test('the cone is low and blunt, not a second flame', () => {
  assert.ok(INNER.apex > FLAME.apex, 'the cone reaches the tip');
  assert.ok(INNER.base <= FLAME.base, 'the cone hangs below the flame');
  assert.ok(INNER.tip < FLAME.tip, 'the cone is as sharp as the flame');
});

test('FLAME_BODY describes where the flame actually is in the image box', () => {
  // Tonight sizes its hero by this and positions it by `MARK_FOOT`; both are
  // derived rather than measured, and this is the assertion that keeps them
  // tied to the geometry instead of to a number someone once eyeballed.
  assert.equal(FLAME_BODY, (FLAME.base - FLAME.apex) * MARK_SCALE);
  assert.equal(MARK_FOOT, 0.5 + FLAME_BODY / 2);

  const path = outline(FLAME);
  const ys = [...path.matchAll(/[\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  assert.ok(Math.abs((bottom - top) / VIEW - FLAME_BODY) < 1e-6, 'the path is not FLAME_BODY tall');
  assert.ok(Math.abs(bottom / VIEW - MARK_FOOT) < 1e-6, 'the foot is not where MARK_FOOT says');
});

test('the bend cuts tile the flame from the stem to the tip', () => {
  const cuts = bendCuts();
  assert.equal(cuts.length, BEND_BANDS + 1);

  // Ordered upward, so `cuts[k]` is always the lower edge of band `k`.
  for (let i = 1; i < cuts.length; i += 1) {
    assert.ok(cuts[i] < cuts[i - 1], `cut ${i} is not above cut ${i - 1}`);
  }
  assert.ok(Math.abs(cuts[cuts.length - 1] - FLAME.apex) < 1e-12, 'the top band misses the tip');

  // Where the stem ends. Below this nothing moves, so it has to be far enough
  // down that the flame visibly bends and far enough up that the stem reads as
  // anchored — the ask was the top ~40%.
  const down = (cuts[0] - FLAME.apex) / (FLAME.base - FLAME.apex);
  assert.ok(down > 0.3 && down < 0.55, `the bend starts ${Math.round(down * 100)}% down`);
});

test('the bands abut exactly — no gap and no overlap at a joint', () => {
  // The stack only reassembles into one flame because each band ends where the
  // next begins. A cut that rounded differently on the two sides would leave a
  // hairline of ground showing through the mark at every joint, and it would
  // only be visible once the thing was moving.
  const cuts = bendCuts();
  for (let k = 0; k < BEND_BANDS; k += 1) {
    const upper = outline(FLAME, { from: cuts[k + 1], to: cuts[k] });
    const lower =
      k === 0 ? outline(FLAME, { from: cuts[0] }) : outline(FLAME, { from: cuts[k], to: cuts[k - 1] });

    const bottomOf = (path: string) =>
      Math.max(...[...path.matchAll(/[\d.]+ ([\d.]+)/g)].map((m) => Number(m[1])));
    const topOf = (path: string) =>
      Math.min(...[...path.matchAll(/[\d.]+ ([\d.]+)/g)].map((m) => Number(m[1])));

    assert.ok(
      Math.abs(bottomOf(upper) - topOf(lower)) < 0.02,
      `band ${k} does not meet the piece below it`
    );
  }
});

test('the bands together are exactly the whole flame', () => {
  const cuts = bendCuts();
  const heights = [
    FLAME.base - cuts[0],
    ...Array.from({ length: BEND_BANDS }, (_, k) => cuts[k] - cuts[k + 1]),
  ];
  const total = heights.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - (FLAME.base - FLAME.apex)) < 1e-12, 'the pieces do not add up');
  for (const h of heights) assert.ok(h > 0, 'a band has no height');
});

test('the bend curves rather than hinging', () => {
  // Equal shares bend the flame into an arc of a circle, which is a banana. A
  // flame's curvature is greatest where it is thinnest, so the share has to
  // rise toward the tip — and sum to one, or the total is a lie.
  assert.ok(Math.abs(BEND_SHARE.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  for (let i = 1; i < BEND_SHARE.length; i += 1) {
    assert.ok(BEND_SHARE[i] > BEND_SHARE[i - 1], `joint ${i} bends no more than the one below`);
  }
  assert.equal(BEND_SHARE.length, BEND_BANDS);
});

test('the outline is a closed path of finite numbers', () => {
  for (const profile of [FLAME, INNER]) {
    const path = outline(profile);
    assert.ok(path.startsWith('M '), 'the path does not open with a move');
    assert.ok(path.endsWith(' Z'), 'the path is not closed');
    assert.ok(!/NaN|Infinity|undefined/.test(path), 'the path has a hole in it');
  }
});

test('inside() and the outline agree about the silhouette', () => {
  // The app draws the path and the icon generator fills by `inside()`. They are
  // two renderers of one shape, and this is the only place that can catch them
  // disagreeing — a wrong sign or a dropped lean would still look plausible in
  // isolation on either side.
  for (let i = 1; i < 40; i += 1) {
    const y = FLAME.apex + ((FLAME.base - FLAME.apex) * i) / 40;
    const w = halfWidth(FLAME, y);
    const c = centreline(y);
    assert.ok(inside(c, y), `the centreline is outside the flame at y=${y.toFixed(3)}`);
    assert.ok(inside(c + w * 0.98, y));
    assert.ok(!inside(c + w * 1.02, y));
    assert.ok(!inside(c - w * 1.02, y));
  }
});
