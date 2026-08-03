import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * The meditation bells and the background soundscapes.
 *
 * Two rules shape this file:
 *
 * Nothing here may ever throw into a session. A bell is decoration on a timer —
 * if the asset fails to decode, or the device has no audio route, or a future
 * SDK renames a method, the meditation must carry on in silence. Every entry
 * point is wrapped.
 *
 * And every bell is also a haptic tap. The app's own Do Not Disturb screen
 * tells you to silence the phone immediately before the session starts, so
 * sound alone is the one cue guaranteed to be muted by following our own
 * advice. `playsInSilentMode` covers the iOS ringer switch; the tap covers the
 * rest.
 */

const SOURCES = {
  interval: require('../assets/audio/bell.wav'),
  final: require('../assets/audio/bell-end.wav'),
};

export type BellKind = keyof typeof SOURCES;

const players: Partial<Record<BellKind, AudioPlayer>> = {};

/** In-flight or finished load. Also the de-duplicator for concurrent calls. */
let loading: Promise<void> | null = null;

async function load(): Promise<void> {
  try {
    await setAudioModeAsync({
      // The point of a bell is to be heard by someone who has just been told to
      // silence their phone.
      playsInSilentMode: true,
      // Never interrupt what is already playing. Someone winding down to their
      // own album or a podcast should keep it — the bell layers on top rather
      // than taking the session away from them.
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
      allowsRecording: false,
    });

    for (const kind of Object.keys(SOURCES) as BellKind[]) {
      if (!players[kind]) players[kind] = createAudioPlayer(SOURCES[kind]);
    }
  } catch {
    // Left unprepared. `ring` degrades to the haptic tap on its own.
  }
}

/**
 * Loads both bells and configures the audio session.
 *
 * Called when a session starts rather than at import: creating players costs
 * memory and an audio focus request, and most launches of this app never open
 * the meditation screen at all.
 */
export function prepareBells(): Promise<void> {
  if (!loading) loading = load();
  return loading;
}

function strike(player: AudioPlayer): void {
  try {
    // Rewind first: a bell rung again before the last one faded would otherwise
    // be silent, which is exactly what a 2-minute interval does to a 3.6-second
    // sample on a slow device.
    void player.seekTo(0);
    player.play();
  } catch {
    // Ignored: see the note at the top of the file.
  }
}

export function ring(kind: BellKind): void {
  try {
    // Web has no haptics, and calling through logs a warning per bell.
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(
        kind === 'final'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
    }
  } catch {
    // Ignored.
  }

  const player = players[kind];
  if (player) {
    strike(player);
    return;
  }

  // The opening bell of a session is due at elapsed zero — before loading can
  // possibly have finished, however early it was kicked off. Waiting for the
  // load and ringing a few hundred milliseconds late is right; dropping the
  // bell, which is what this used to do, is not.
  void prepareBells().then(() => {
    const loaded = players[kind];
    if (loaded) strike(loaded);
  });
}

/**
 * The last few seconds before a stretch starts, felt rather than heard.
 *
 * The countdown into a pose needs a cue, and it cannot be the bell: the bell
 * means *that stretch is over*, and a second one a few seconds later meaning
 * "now begin" would make the two indistinguishable in a dark room. So the end
 * of a hold is a sound and the start of one is a tap — which is also the only
 * cue that survives someone lying face-down in Sphinx with their eyes shut.
 */
export function tick(): void {
  try {
    // Web has no haptics, and calling through logs a warning per tick.
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignored: see the note at the top of the file.
  }
}

/**
 * Frees both players. Must run when the meditation screen unmounts — an
 * AudioPlayer holds a native handle, and leaking one per session eventually
 * costs the app its audio focus.
 */
export function releaseBells(): void {
  for (const kind of Object.keys(players) as BellKind[]) {
    try {
      players[kind]?.remove();
    } catch {
      // Ignored.
    }
    delete players[kind];
  }
  // Cleared too, or the next session would short-circuit on a resolved promise
  // and never rebuild the players it just threw away.
  loading = null;
}

/* ── soundscapes ────────────────────────────────────────────────────────── */

const FADE_MS = 2000;
/** Used when swapping one track for another rather than stopping outright. */
const REPLACE_FADE_MS = 400;
/**
 * How often a fade updates the volume. A fixed interval, with the step count
 * derived from it — the reverse (fixed steps, derived interval) asked for a
 * tick every 8ms on the short fade, which is below what the JS timer can
 * actually deliver, so that fade always overran its own deadline.
 */
const FADE_TICK_MS = 40;

/**
 * One playing loop and the timer that owns its volume.
 *
 * The timer belongs to the voice rather than to the module. Sharing a single
 * timer meant starting a second track cancelled the first track's fade-out —
 * and since the release only happened when that fade *completed*, the first
 * player was never paused or freed. Its reference was overwritten a moment
 * later, so nothing could reach it again: it played until the app was killed,
 * and every track you auditioned piled up on top of the last.
 */
type Voice = {
  player: AudioPlayer;
  source: number;
  fade: ReturnType<typeof setInterval> | null;
};

let current: Voice | null = null;
/** Every voice holding a native handle, including ones on their way out. */
const live = new Set<Voice>();
let target = 0;
/** Bumped by every start and stop, so a slow one cannot install a stale voice. */
let generation = 0;

function clearFade(voice: Voice): void {
  if (voice.fade) clearInterval(voice.fade);
  voice.fade = null;
}

/** Silences and frees a voice immediately. Safe to call more than once. */
function kill(voice: Voice): void {
  clearFade(voice);
  try {
    voice.player.pause();
  } catch {
    // Ignored.
  }
  try {
    voice.player.remove();
  } catch {
    // Ignored.
  }
  live.delete(voice);
  if (current === voice) current = null;
}

/**
 * Ramps one voice's volume, optionally freeing it at the end.
 *
 * Ambience must never start or stop abruptly. The whole point of it is that you
 * stop noticing it's there, and nothing breaks that faster than it appearing
 * out of nowhere — or worse, vanishing at the exact moment a session ends,
 * which lands as a jolt in a dark room.
 */
function fadeTo(voice: Voice, to: number, release: boolean, durationMs: number): void {
  clearFade(voice);

  let from = 0;
  try {
    from = voice.player.volume;
  } catch {
    // Ignored; a fade from zero is still a fade.
  }

  const steps = Math.max(2, Math.round(durationMs / FADE_TICK_MS));
  let step = 0;

  voice.fade = setInterval(() => {
    step += 1;
    const progress = Math.min(1, step / steps);

    try {
      voice.player.volume = from + (to - from) * progress;
    } catch {
      // Ignored.
    }

    if (progress < 1) return;
    clearFade(voice);
    if (release) kill(voice);
  }, FADE_TICK_MS);
}

/** Starts a looping soundscape, fading it in from silence. */
export async function startSoundscape(source: number, gain: number): Promise<void> {
  // Already playing this one. Someone who previewed a track on the setup screen
  // and then started the session should hear it carry straight through, not dip
  // out and back in because the running screen restarted it.
  if (current && current.source === source) {
    setSoundscapeGain(gain);
    return;
  }

  const mine = ++generation;
  target = gain;

  // The outgoing voice is handed to its own timer and left to fade out while
  // the new one fades in. Deliberately not awaited: overlapping them is a
  // crossfade rather than a gap, and — the part that matters — the outgoing
  // player stays in `live` with its own timer, so there is no window in which a
  // playing voice has nothing referencing it.
  const outgoing = current;
  current = null;
  if (outgoing) fadeTo(outgoing, 0, true, REPLACE_FADE_MS);

  try {
    await prepareBells();
    // A newer start or a stop landed while the audio session was being set up.
    if (mine !== generation) return;

    const player = createAudioPlayer(source);
    player.loop = true;
    player.volume = 0;
    player.play();

    const voice: Voice = { player, source, fade: null };
    live.add(voice);
    current = voice;
    fadeTo(voice, gain, false, FADE_MS);
  } catch {
    if (mine === generation) current = null;
  }
}

/** Applied immediately: this is someone changing the level while listening. */
export function setSoundscapeGain(gain: number): void {
  target = gain;
  if (!current) return;

  clearFade(current);
  try {
    current.player.volume = gain;
  } catch {
    // Ignored.
  }
}

export function setSoundscapePaused(paused: boolean): void {
  const voice = current;
  if (!voice) return;

  try {
    if (paused) {
      voice.player.pause();
      return;
    }
    voice.player.play();
    // Volume is restored explicitly: pausing part-way through the opening fade
    // would otherwise resume stuck at whatever level it had reached.
    clearFade(voice);
    voice.player.volume = target;
  } catch {
    // Ignored.
  }
}

/**
 * Fades the current voice out and frees it, and hard-stops anything else still
 * playing. Resolves once the fade has finished.
 *
 * The sweep over `live` is the backstop: a leftover voice is one whose release
 * was interrupted, and it should not have been audible in the first place, so
 * it is cut rather than faded. Turning the sound off has to mean silence even
 * if something upstream went wrong.
 */
export function stopSoundscape(durationMs = FADE_MS): Promise<void> {
  generation += 1;

  const outgoing = current;
  current = null;

  for (const voice of [...live]) {
    if (voice !== outgoing) kill(voice);
  }

  if (!outgoing) return Promise.resolve();

  fadeTo(outgoing, 0, true, durationMs);
  return new Promise((resolve) => setTimeout(resolve, durationMs + 100));
}
