import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib/supabase';
import {
  type Reminder,
  type ReminderId,
  DEFAULT_REMINDERS,
  REMINDER_IDS,
  normaliseReminder,
} from './reminders';

/**
 * Preferences are stored in Supabase (`public.profiles`) but always mirrored to
 * a local cache. Reads answer from cache first so the app renders instantly and
 * still works with no signal; writes go to cache immediately and to the server
 * best-effort, with a dirty flag so a failed write retries on the next load.
 *
 * A single dirty flag is still right here, unlike `routines.ts`, because this is
 * one record. Reminders are a fixed set named in code — not a list the user can
 * add to — so there is nothing that can be deleted offline and resurrected.
 */

const CACHE_KEY = 'profile_cache_v1';
const DIRTY_KEY = 'profile_dirty_v1';

export type Reminders = Record<ReminderId, Reminder>;

export function defaultReminders(): Reminders {
  return fromRecord({});
}

/** Builds the full set from a partial map, filling gaps with defaults. */
function fromRecord(raw: Record<string, unknown>): Reminders {
  const out = {} as Reminders;
  for (const id of REMINDER_IDS) out[id] = normaliseReminder(id, raw[id]);
  return out;
}

/**
 * Reads the cache, understanding both shapes it has ever been written in.
 *
 * Before there was more than one reminder this key held a bare
 * `{hour, minute, enabled}`. An installed app has that on disk right now, and
 * silently dropping it would move someone's reminder back to the 21:30 default
 * without telling them — the same failure the `session_nights_v1` union exists
 * to prevent.
 */
async function readCache(): Promise<Reminders> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return defaultReminders();

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (parsed.reminders && typeof parsed.reminders === 'object') return fromRecord(parsed.reminders);
      // The legacy flat shape: it was the wind-down reminder, every night.
      if ('hour' in parsed) return fromRecord({ 'wind-down': parsed });
    }
  } catch {
    // Falls through to defaults — a corrupt cache is not worth a crash on a
    // screen someone opens in the dark.
  }

  return defaultReminders();
}

async function writeCache(reminders: Reminders): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ reminders }));
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function pushToServer(userId: string, reminders: Reminders): Promise<boolean> {
  const windDown = reminders['wind-down'];
  const { error } = await supabase
    .from('profiles')
    .update({
      reminders: reminders as unknown as Record<string, never>,
      // The pre-`reminders` columns are still written, so a build from before
      // the migration reads the right wind-down time rather than a stale one.
      // They are no longer read here. See the migration for when to drop them.
      reminder_hour: windDown.hour,
      reminder_minute: windDown.minute,
      reminder_enabled: windDown.enabled,
    })
    .eq('id', userId);
  return !error;
}

/** Cached values first, then reconciled with the server when reachable. */
export async function loadReminders(): Promise<Reminders> {
  const cached = await readCache();
  const userId = await currentUserId();
  if (!userId) return cached;

  // A local edit that never reached the server wins over whatever is stored
  // remotely — otherwise a stale server row would clobber the user's change.
  const dirty = (await AsyncStorage.getItem(DIRTY_KEY)) === 'true';
  if (dirty) {
    const ok = await pushToServer(userId, cached);
    if (ok) await AsyncStorage.removeItem(DIRTY_KEY);
    return cached;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('reminders, reminder_hour, reminder_minute, reminder_enabled')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return cached;

  const stored = data.reminders;
  const remote =
    stored && typeof stored === 'object' && Object.keys(stored).length > 0
      ? fromRecord(stored as Record<string, unknown>)
      : // A row the backfill never reached — a profile created by the signup
        // trigger between the migration and this client shipping.
        fromRecord({
          'wind-down': {
            hour: data.reminder_hour,
            minute: data.reminder_minute,
            enabled: data.reminder_enabled,
          },
        });

  await writeCache(remote);
  return remote;
}

/** Reads only the local cache — for render paths that must not await the network. */
export async function loadCachedReminders(): Promise<Reminders> {
  return readCache();
}

/**
 * Wipe the cached profile. Must run on sign-out, otherwise the next person to
 * sign in on this device briefly sees the previous user's reminder settings —
 * and could overwrite their own server row with them.
 */
export async function clearLocalCache(): Promise<void> {
  await AsyncStorage.multiRemove([CACHE_KEY, DIRTY_KEY]);
}

export async function saveReminders(reminders: Reminders): Promise<void> {
  await writeCache(reminders);

  const userId = await currentUserId();
  if (!userId) return;

  const ok = await pushToServer(userId, reminders);
  await AsyncStorage.setItem(DIRTY_KEY, ok ? 'false' : 'true');
}

export { DEFAULT_REMINDERS };
