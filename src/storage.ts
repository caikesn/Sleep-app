import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib/supabase';

/**
 * Preferences are stored in Supabase (`public.profiles`) but always mirrored to
 * a local cache. Reads answer from cache first so the app renders instantly and
 * still works with no signal; writes go to cache immediately and to the server
 * best-effort, with a dirty flag so a failed write retries on the next load.
 */

const CACHE_KEY = 'profile_cache_v1';
const DIRTY_KEY = 'profile_dirty_v1';

export type RoutineSettings = {
  hour: number;
  minute: number;
  enabled: boolean;
};

const DEFAULT_SETTINGS: RoutineSettings = { hour: 21, minute: 30, enabled: false };

async function readCache(): Promise<RoutineSettings> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function writeCache(settings: RoutineSettings): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(settings));
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function pushToServer(userId: string, settings: RoutineSettings): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({
      reminder_hour: settings.hour,
      reminder_minute: settings.minute,
      reminder_enabled: settings.enabled,
    })
    .eq('id', userId);
  return !error;
}

/** Cached values first, then reconciled with the server when reachable. */
export async function loadSettings(): Promise<RoutineSettings> {
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
    .select('reminder_hour, reminder_minute, reminder_enabled')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return cached;

  const remote: RoutineSettings = {
    hour: data.reminder_hour,
    minute: data.reminder_minute,
    enabled: data.reminder_enabled,
  };
  await writeCache(remote);
  return remote;
}

/** Reads only the local cache — for render paths that must not await the network. */
export async function loadCachedSettings(): Promise<RoutineSettings> {
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

export async function saveSettings(settings: RoutineSettings): Promise<void> {
  await writeCache(settings);

  const userId = await currentUserId();
  if (!userId) return;

  const ok = await pushToServer(userId, settings);
  await AsyncStorage.setItem(DIRTY_KEY, ok ? 'false' : 'true');
}
