import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import {
  SOUNDSCAPES,
  SOUND_OFF,
  VOLUME_LEVELS,
  gainFor,
  soundscapeById,
  soundscapeFileName,
} from './soundscapes';

test('soundscape ids and names are unique', () => {
  const ids = SOUNDSCAPES.map((track) => track.id);
  const names = SOUNDSCAPES.map((track) => track.name);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(names).size, names.length);
});

test('every soundscape has an audio file on disk', () => {
  // The real check the app needs. `soundscapeAssets.ts` can't be imported here
  // — it is full of Metro `require` calls — so this verifies the convention
  // those requires follow instead. A renamed or ungenerated track fails here
  // rather than as silence on someone's phone.
  for (const track of SOUNDSCAPES) {
    const path = `assets/audio/${soundscapeFileName(track.id)}`;
    assert.ok(existsSync(path), `${track.id}: missing ${path} — run tools/make-ambience.mjs`);
    // A WAV header alone is 44 bytes; anything this small is a failed render.
    assert.ok(statSync(path).size > 10_000, `${path} is too small to be a real loop`);
  }
});

test('the off sentinel is not a track', () => {
  assert.equal(soundscapeById('rain')?.name, 'Rain');
  // The screen relies on this returning undefined to know it should stop rather
  // than start something.
  assert.equal(soundscapeById(SOUND_OFF), undefined);
  assert.equal(soundscapeById(''), undefined);
});

test('volume levels rise, and none of them is loud', () => {
  const gains = VOLUME_LEVELS.map((level) => gainFor(level.id));

  for (let i = 1; i < gains.length; i += 1) {
    assert.ok(gains[i] > gains[i - 1], `${VOLUME_LEVELS[i].id} must be louder than the one below`);
  }

  assert.ok(gains[0] > 0, 'the quietest setting still has to be audible');
  // This plays next to someone's head in a silent room, and has to sit under
  // the bell rather than over it.
  assert.ok(gains[gains.length - 1] <= 0.7, 'the loudest setting is too loud for a bedside');
});
