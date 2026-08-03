import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Lighting, DEFAULT_LIGHTING, normaliseLighting } from './lighting';

/**
 * Lighting preferences, kept on the device and never synced.
 *
 * Deliberately not in `profiles` alongside the reminders. A reminder time is a
 * fact about the person — 9:30pm is 9:30pm on any phone they own. How dark the
 * screen should go is a fact about *this screen in this room*: the level that
 * is right on a phone in bed is wrong on a tablet in a lit lounge, and syncing
 * it would have one device quietly change the other.
 *
 * It also means this feature needed no migration and no RLS policy, which is
 * the second reason and not the first — but worth writing down, because the
 * next preference to be added should ask the same question rather than assume
 * the answer is a column.
 *
 * There is no dirty flag here for the same reason: nothing to push.
 */

const KEY = 'lighting_v1';

export async function loadLighting(): Promise<Lighting> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_LIGHTING };
    return normaliseLighting(JSON.parse(raw));
  } catch {
    // A corrupt value costs someone their level, not their session. This is
    // read on the way into a timed routine, in the dark.
    return { ...DEFAULT_LIGHTING };
  }
}

export async function saveLighting(lighting: Lighting): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(lighting));
}
