import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * The meditation bells.
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
let configured = false;

/**
 * Loads both bells and claims the audio session.
 *
 * Called when a session starts rather than at import: creating players costs
 * memory and an audio focus request, and most launches of this app never open
 * the meditation screen at all.
 */
export async function prepareBells(): Promise<void> {
  try {
    if (!configured) {
      await setAudioModeAsync({
        // The point of the bell is to be heard by someone who has just been
        // told to silence their phone.
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        allowsRecording: false,
      });
      configured = true;
    }

    for (const kind of Object.keys(SOURCES) as BellKind[]) {
      if (!players[kind]) players[kind] = createAudioPlayer(SOURCES[kind]);
    }
  } catch {
    // Left unprepared. `ring` degrades to the haptic tap on its own.
  }
}

export function ring(kind: BellKind): void {
  try {
    const player = players[kind];
    if (player) {
      // Rewind first: a bell rung again before the last one faded would
      // otherwise be silent, which is exactly what a 2-minute interval does to
      // a 3.6-second sample on a slow device.
      void player.seekTo(0);
      player.play();
    }
  } catch {
    // Ignored: see the note at the top of the file.
  }

  try {
    // Web has no haptics, and calling through logs a warning per bell.
    if (Platform.OS === 'web') return;
    void Haptics.notificationAsync(
      kind === 'final'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    );
  } catch {
    // Ignored.
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
}
