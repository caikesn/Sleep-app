import test from 'node:test';
import assert from 'node:assert/strict';
import {
  type DimLevel,
  DEFAULT_LIGHTING,
  DIM_COPY,
  DIM_LEVELS,
  brightnessFor,
  describeDim,
  nextDimLevel,
  normaliseLighting,
} from './lighting';

test('every level is named, and the names are distinct', () => {
  const names = DIM_LEVELS.map((level) => DIM_COPY[level].name);
  assert.equal(new Set(names).size, names.length);
  for (const level of DIM_LEVELS) {
    assert.ok(DIM_COPY[level].caption.length > 0, `${level} has no caption`);
    assert.equal(describeDim(level), DIM_COPY[level].caption);
  }
});

test('off never asks for a brightness change', () => {
  // The whole contract of `off`: not "set it to full", but "don't touch it".
  // A number here would mean picking Off overwrites the phone's own setting.
  assert.equal(brightnessFor('off', 1), null);
  assert.equal(brightnessFor('off', 0.02), null);
});

test('the levels get darker in the order they are listed', () => {
  // The pills render in `DIM_LEVELS` order, so a level that is brighter than
  // the one before it would read as a control that goes backwards.
  const dimming = DIM_LEVELS.filter((level) => level !== 'off');
  const targets = dimming.map((level) => brightnessFor(level, 1) as number);

  for (let i = 1; i < targets.length; i += 1) {
    assert.ok(targets[i] < targets[i - 1], `${dimming[i]} must be darker than ${dimming[i - 1]}`);
  }
  assert.ok(targets[targets.length - 1] > 0, 'the darkest level must not be a black screen');
  assert.ok(targets[0] < 1, 'the softest level still has to do something');
});

test('a dim level never brightens a screen that is already darker', () => {
  // Someone at 5% has made this decision harder than we would. Raising them to
  // 15% because they picked "Dim" would be overriding the preference we claim
  // to be honouring.
  assert.equal(brightnessFor('dim', 0.05), 0.05);
  assert.equal(brightnessFor('soft', 0.1), 0.1);
  // And it still lowers a bright one.
  assert.ok((brightnessFor('soft', 1) as number) < 1);
});

test('an unreadable current brightness still yields the level ceiling', () => {
  // Web has no brightness to read and the native call can fail. Returning null
  // here would silently turn the feature off on the failure path.
  for (const value of [NaN, Infinity, -Infinity]) {
    const target = brightnessFor('dim', value);
    assert.ok(target !== null && target > 0 && target < 1, `bad reading ${value} dropped the dim`);
  }
});

test('brightness never leaves the range the OS accepts', () => {
  for (const level of DIM_LEVELS) {
    for (const current of [-1, 0, 0.5, 1, 2]) {
      const target = brightnessFor(level, current);
      if (target === null) continue;
      assert.ok(target >= 0 && target <= 1, `${level} at ${current} returned ${target}`);
    }
  }
});

test('a corrupt or partial stored preference falls back per field', () => {
  assert.deepEqual(normaliseLighting(null), DEFAULT_LIGHTING);
  assert.deepEqual(normaliseLighting('nonsense'), DEFAULT_LIGHTING);
  assert.deepEqual(normaliseLighting({}), DEFAULT_LIGHTING);

  // The point of per-field: an unknown level must not also cost them the warm
  // setting they did choose.
  assert.deepEqual(normaliseLighting({ dim: 'pitch-black', warm: false }), {
    dim: DEFAULT_LIGHTING.dim,
    warm: false,
  });
  assert.deepEqual(normaliseLighting({ dim: 'dark' }), {
    dim: 'dark',
    warm: DEFAULT_LIGHTING.warm,
  });
  assert.deepEqual(normaliseLighting({ dim: 'dark', warm: true }), { dim: 'dark', warm: true });
});

test('cycling visits every level and comes back round', () => {
  // The session banner's pill is the only way to change this mid-session, so a
  // level it can't reach is a level someone is stuck without at midnight.
  const seen = new Set<string>();
  let level: DimLevel = DIM_LEVELS[0];
  for (let i = 0; i < DIM_LEVELS.length; i += 1) {
    seen.add(level);
    level = nextDimLevel(level);
  }
  assert.equal(seen.size, DIM_LEVELS.length);
  assert.equal(level, DIM_LEVELS[0], 'cycling must return to where it started');
});

test('cycling follows the order the pills are in', () => {
  assert.equal(nextDimLevel('off'), 'soft');
  assert.equal(nextDimLevel('dark'), 'off');
});

test('normalising returns a fresh object every time', () => {
  // It is fed straight into component state and edited. Handing back the shared
  // default would let one screen's edit reach every other reader of it.
  const a = normaliseLighting(null);
  const b = normaliseLighting(null);
  a.dim = 'dark';
  assert.notEqual(b.dim, 'dark');
  assert.notEqual(DEFAULT_LIGHTING.dim, 'dark');
});
