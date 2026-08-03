import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAX, VESSELS, BOX, EMPTY_FILL, MIN_WAX, WICK_HEIGHT, flameSize, waxHeight } from './candles';
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
    const width = spec.columns * spec.width + (spec.columns - 1) * spec.gap;
    assert.ok(Math.max(width, spec.saucer ?? 0) <= BOX.width, `${name} is wider than the box`);
  }
});

test('extra candles in a holder are cut shorter than the first', () => {
  const triple = VESSELS.triple;
  assert.ok(waxHeight(triple, 1, 1) < waxHeight(triple, 1, 0));
  assert.ok(waxHeight(triple, 1, 2) < waxHeight(triple, 1, 1));
});
