import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib/supabase';
import { nightOf } from './streak';
import type { SessionKind } from './database.types';

export { computeStreak, nightOf } from './streak';

/**
 * Completed and abandoned sessions, logged for history and streaks.
 *
 * Same shape as the settings layer: writes land locally first and push
 * best-effort. A routine finishes at 10pm in bed, which is exactly where the
 * wifi is worst — a failed push must never lose the session, so unsent rows sit
 * in a queue and flush on the next successful call.
 */

const QUEUE_KEY = 'session_queue_v1';
const NIGHTS_KEY = 'session_nights_v1';

export type LoggedSession = {
  kind: SessionKind;
  title: string | null;
  started_at: string;
  ended_at: string;
  completed: boolean;
  duration_seconds: number;
};

async function readQueue(): Promise<LoggedSession[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readNights(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(NIGHTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Records the night locally so the streak survives with no signal. */
async function rememberNight(session: LoggedSession): Promise<void> {
  if (!session.completed) return;
  const nights = new Set(await readNights());
  nights.add(nightOf(session.ended_at));
  await AsyncStorage.setItem(NIGHTS_KEY, JSON.stringify([...nights]));
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Pushes queued sessions. Anything that fails stays queued for next time. */
export async function flushSessions(): Promise<void> {
  const queued = await readQueue();
  if (queued.length === 0) return;

  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('sessions')
    .insert(queued.map((s) => ({ ...s, user_id: userId })));

  // All-or-nothing: a partial failure would need per-row ids to reconcile, and
  // a retry of the whole batch is cheap at this volume.
  if (!error) await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function logSession(session: LoggedSession): Promise<void> {
  await rememberNight(session);
  const queued = await readQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queued, session]));
  await flushSessions();
}

/** Nights with a completed session — cache first, then reconciled. */
export async function loadNights(): Promise<string[]> {
  const cached = await readNights();

  const userId = await currentUserId();
  if (!userId) return cached;

  await flushSessions();

  const { data, error } = await supabase
    .from('sessions')
    .select('ended_at')
    .eq('completed', true)
    .order('ended_at', { ascending: false })
    .limit(400);

  if (error || !data) return cached;

  // Union rather than replace: a session logged offline on this device is not
  // on the server yet, and dropping it would visibly break the streak.
  const merged = new Set([...cached, ...data.map((r) => nightOf(r.ended_at))]);
  const nights = [...merged];
  await AsyncStorage.setItem(NIGHTS_KEY, JSON.stringify(nights));
  return nights;
}

/** Must run on sign-out, or the next user inherits this one's streak. */
export async function clearSessionCache(): Promise<void> {
  await AsyncStorage.multiRemove([QUEUE_KEY, NIGHTS_KEY]);
}
