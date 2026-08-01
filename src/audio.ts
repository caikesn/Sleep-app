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
const REPLACE_FADE_MS = 250;
const FADE_STEPS = 30;

let ambience: AudioPlayer | null = null;
/** Which asset is loaded, so an unchanged track is never restarted. */
let ambienceSource: number | null = null;
let target = 0;
let fade: ReturnType<typeof setInterval> | null = null;

function stopFade(): void {
  if (fade) clearInterval(fade);
  fade = null;
}

/**
 * Ramps the loop's volume over `FADE_MS`, optionally freeing the player at the
 * end.
 *
 * Ambience must never start or stop abruptly. The whole point of it is that you
 * stop noticing it's there, and nothing breaks that faster than it appearing
 * out of nowhere — or worse, vanishing at the exact moment a session ends,
 * which lands as a jolt in a dark room.
 */
function rampTo(value: number, thenRelease = false, durationMs = FADE_MS): void {
  stopFade();

  const player = ambience;
  if (!player) return;

  let from = 0;
  try {
    from = player.volume;
  } catch {
    // Ignored; a fade from zero is still a fade.
  }

  let step = 0;
  fade = setInterval(() => {
    step += 1;
    const progress = Math.min(1, step / FADE_STEPS);

    try {
      player.volume = from + (value - from) * progress;
    } catch {
      // Ignored.
    }

    if (progress < 1) return;
    stopFade();
    if (!thenRelease) return;

    try {
      player.pause();
      player.remove();
    } catch {
      // Ignored.
    }
    if (ambience === player) {
      ambience = null;
      ambienceSource = null;
    }
  }, durationMs / FADE_STEPS);
}

/** Starts a looping soundscape, fading it in from silence. */
export async function startSoundscape(source: number, gain: number): Promise<void> {
  // Already playing this one. Someone who previewed a track on the setup screen
  // and then started the session should hear it carry straight through, not dip
  // out and back in because the running screen restarted it.
  if (ambience && ambienceSource === source) {
    setSoundscapeGain(gain);
    return;
  }

  // Quick, not the full fade: this path is someone auditioning tracks on the
  // setup screen, and two seconds of silence between taps is a long time when
  // you are comparing two of them.
  await stopSoundscape(REPLACE_FADE_MS);
  target = gain;

  try {
    await prepareBells();
    const player = createAudioPlayer(source);
    player.loop = true;
    player.volume = 0;
    player.play();
    ambience = player;
    ambienceSource = source;
    rampTo(gain);
  } catch {
    ambience = null;
    ambienceSource = null;
  }
}

/** Applied immediately: this is someone dragging the level while listening. */
export function setSoundscapeGain(gain: number): void {
  target = gain;
  stopFade();
  try {
    if (ambience) ambience.volume = gain;
  } catch {
    // Ignored.
  }
}

export function setSoundscapePaused(paused: boolean): void {
  try {
    if (!ambience) return;
    if (paused) ambience.pause();
    else {
      ambience.play();
      // Volume is restored explicitly: pausing part-way through the opening
      // fade would otherwise resume stuck at whatever level it had reached.
      ambience.volume = target;
    }
  } catch {
    // Ignored.
  }
}

/** Fades out and frees the player. Resolves once the fade has finished. */
export function stopSoundscape(durationMs = FADE_MS): Promise<void> {
  if (!ambience) {
    stopFade();
    return Promise.resolve();
  }

  rampTo(0, true, durationMs);
  return new Promise((resolve) => setTimeout(resolve, durationMs + 50));
}
