import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAX,
  VESSELS,
  BOX,
  EMPTY_FILL,
  MIN_WAX,
  WICK_HEIGHT,
  columnCentre,
  flameSize,
  silhouetteHeight,
  waxHeight,
  widestPoint,
  widthAt,
} from './candles';
import { BADGES } from './achievements';

test('every badge names a real vessel and a real wax', () => {
  for (const badge of BADGES) {
    assert.ok(VESSELS[badge.vessel], `${badge.id} has no vessel`);
    assert.ok(WAX[badge.wax], `${badge.id} has no wax`);
  }
});

test('no two badges share both a vessel and a wax', () => {
  // Vessels repeat on purpose — thirteen distinct silhouettes would be thirteen
  // shapes nobody can tell apart. Colour is what keeps a repeat legible, so a
  // duplicated pair is the one combination that makes two badges the same object.
  const seen = new Set<string>();
  for (const badge of BADGES) {
    const pair = `${badge.vessel}/${badge.wax}`;
    assert.ok(!seen.has(pair), `${badge.id} is indistinguishable from another badge (${pair})`);
    seen.add(pair);
  }
});

test('wax is lit from above — the top of every pair is the lighter end', () => {
  const luminance = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
  };
  for (const [name, [top, bottom]] of Object.entries(WAX)) {
    assert.ok(luminance(top) > luminance(bottom), `${name} is shaded upside down`);
  }
});

test('an untouched candle still has a body to see', () => {
  for (const [name, spec] of Object.entries(VESSELS)) {
    // A tealight is seven points of wax all told, so the fractional empty state
    // lands under a point and the absolute floor is what saves it.
    assert.ok(waxHeight(spec, 0) >= MIN_WAX, `an empty ${name} draws as nothing`);
    assert.equal(waxHeight(spec, 0), Math.max(MIN_WAX, spec.height * EMPTY_FILL));
  }
});

test('a full candle fills its vessel and never overflows the box', () => {
  for (const [name, spec] of Object.entries(VESSELS)) {
    assert.equal(waxHeight(spec, 1), spec.height, `${name} does not fill`);
    assert.ok(waxHeight(spec, 2) === spec.height, `${name} overshoots on a clamped fill`);
    // Wall over wax, plus room for a wick and the flame above it. The box is
    // fixed so a filling grid never changes height, which means a vessel made
    // taller has to be checked against it here rather than found by eye.
    assert.ok(
      (spec.wall ?? spec.height) + WICK_HEIGHT + flameSize(spec) <= BOX.height,
      `${name} has no room for its flame`
    );
    assert.ok(spec.wall === undefined || spec.wall >= spec.height, `${name} overflows its vessel`);
    // Measured off `widestPoint`, not off the nominal width: a flared vessel is
    // widest at the rim, and the rim is the part that would be clipped.
    assert.ok(widestPoint(spec) <= BOX.width, `${name} is wider than the box`);
  }
});

test('a flared vessel never grows into its neighbour', () => {
  for (const [name, spec] of Object.entries(VESSELS)) {
    if (spec.columns < 2) continue;
    // Columns are spaced on their base widths, so a flare eats the gap. Two
    // candles in one holder whose rims touch draw as a single wide blob.
    const rim = widthAt(spec, silhouetteHeight(spec));
    assert.ok(
      columnCentre(spec, 1) - columnCentre(spec, 0) > rim,
      `${name}'s columns collide at the rim`
    );
  }
});

test('the taper is drawn from the vessel, not from the wax', () => {
  // A jar's glass is the same shape empty as it is full — only a freestanding
  // candle's silhouette moves with its fill.
  const jar = VESSELS.jar;
  assert.equal(silhouetteHeight(jar), jar.wall);
  assert.equal(widthAt(jar, 0), jar.width);
  assert.ok(widthAt(jar, jar.wall!) < jar.width, 'the jar has lost its shoulder');

  const taper = VESSELS.taper;
  assert.equal(silhouetteHeight(taper), taper.height);
  assert.ok(widthAt(taper, taper.height) < widthAt(taper, 0), 'the taper does not taper');
  // The one that used to be undrawable: a taper is markedly narrower at the
  // wick than at the foot, or it is a thin pillar with a different name.
  assert.ok(widthAt(taper, taper.height) < taper.width * 0.75);
});

test('a straight-sided vessel keeps its width all the way up', () => {
  const tin = VESSELS.tin;
  assert.equal(widthAt(tin, 0), tin.width);
  assert.equal(widthAt(tin, tin.wall!), tin.width);
});

test('columns are centred in the box', () => {
  for (const [name, spec] of Object.entries(VESSELS)) {
    const first = columnCentre(spec, 0);
    const last = columnCentre(spec, spec.columns - 1);
    assert.ok(
      Math.abs((first + last) / 2 - BOX.width / 2) < 1e-9,
      `${name} is not centred in the box`
    );
  }
});

test('extra candles in a holder are cut shorter than the first', () => {
  const triple = VESSELS.triple;
  assert.ok(waxHeight(triple, 1, 1) < waxHeight(triple, 1, 0));
  assert.ok(waxHeight(triple, 1, 2) < waxHeight(triple, 1, 1));
});
