import type { SoundscapeId } from './soundscapes';

/**
 * The soundscape audio files.
 *
 * Split out from `soundscapes.ts` because `require` of a .wav is Metro's asset
 * mechanism — it resolves to a numeric handle at bundle time and does not exist
 * under Node, so a module containing one cannot be imported by the test runner.
 * Keeping the names and levels on the other side of this line is what makes
 * them testable.
 *
 * The paths must be literals: Metro resolves `require` statically, so a
 * computed path silently bundles nothing.
 */
export const SOUNDSCAPE_FILES: Record<SoundscapeId, number> = {
  brown: require('../assets/audio/amb-brown.wav'),
  rain: require('../assets/audio/amb-rain.wav'),
  waves: require('../assets/audio/amb-waves.wav'),
  embers: require('../assets/audio/amb-embers.wav'),
  drone: require('../assets/audio/amb-drone.wav'),
};
