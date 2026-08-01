import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib/supabase';
import { nightOf } from './streak';
import { computeStats, evaluateBadges, emptyStats, unseenBadges } from './achievements';
import type { BadgeState, Stats } from './achievements';
import type { SessionKind } from './database.types';

export { computeStreak, nightOf } from './streak';

/**
 * Completed and abandoned sessions, logged for history, streaks and badges.
 *
 * Same shape as the settings layer: writes land locally first and push
 * best-effort. A routine finishes at 10pm in bed, which is exactly where the
 * wifi is worst — a failed push must never lose the session, so unsent rows sit
 * in a queue and flush on the next successful call.
 */

const QUEUE_KEY = 'session_queue_v1';
const LOG_KEY = 'session_log_v1';
const SEEN_BADGES_KEY = 'seen_badges_v1';

/**
 * Read but never written. Earlier builds cached bare night keys; unioning them
 * in means upgrading doesn't silently reset a streak, which is the one bug that
 * would make the whole feature untrustworthy. Safe to delete once shipped.
 */
const LEGACY_NIGHTS_KEY = 'session_nights_v1';

/** Enough history for a hundred-night badge with room to spare. */
const LOG_LIMIT = 400;

export type LoggedSession = {
  kind: SessionKind;
  title: string | null;
  started_at: string;
  ended_at: string;
  completed: boolean;
  duration_seconds: number;
};

/** Identity for dedup: the same session round-tripped from the server. */
function keyOf(session: LoggedSession): string {
  return `${session.started_at}|${session.kind}`;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

const readQueue = () => readJson<LoggedSession[]>(QUEUE_KEY, []);

/**
 * Normalised on the way out, not just on the way in. History is grouped by
 * night on the assumption that same-night sessions are adjacent, so an
 * out-of-order cache renders one night as two headings.
 */
const readLog = async () => newestFirst(await readJson<LoggedSession[]>(LOG_KEY, []));

function newestFirst(rows: LoggedSession[]): LoggedSession[] {
  const merged = new Map<string, LoggedSession>();
  for (const row of rows) merged.set(keyOf(row), row);
  return [...merged.values()]
    .sort((a, b) => b.ended_at.localeCompare(a.ended_at))
    .slice(0, LOG_LIMIT);
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
  // Written to the local log as well as the queue, so history and the streak
  // are correct the instant a session ends — before the push has a chance to
  // succeed, and whether or not it ever does.
  const [queued, log] = await Promise.all([readQueue(), readLog()]);
  await AsyncStorage.multiSet([
    [QUEUE_KEY, JSON.stringify([...queued, session])],
    [LOG_KEY, JSON.stringify(newestFirst([session, ...log]))],
  ]);
  await flushSessions();
}

/** Every session, newest first — cache first, then reconciled with the server. */
export async function loadHistory(): Promise<LoggedSession[]> {
  const cached = await readLog();

  const userId = await currentUserId();
  if (!userId) return cached;

  await flushSessions();

  const { data, error } = await supabase
    .from('sessions')
    .select('kind, title, started_at, ended_at, completed, duration_seconds')
    .order('ended_at', { ascending: false })
    .limit(LOG_LIMIT);

  if (error || !data) return cached;

  // Union rather than replace: a session logged offline on this device is not
  // on the server yet, and dropping it would visibly break the streak.
  const remote = data.map((row) => ({ ...row, kind: row.kind as SessionKind }));
  const rows = newestFirst([...cached, ...remote]);
  await AsyncStorage.setItem(LOG_KEY, JSON.stringify(rows));
  return rows;
}

export function nightsFrom(rows: LoggedSession[]): string[] {
  return [...new Set(rows.filter((r) => r.completed).map((r) => nightOf(r.ended_at)))];
}

/** Nights with a completed session. */
export async function loadNights(): Promise<string[]> {
  const [rows, legacy] = await Promise.all([
    loadHistory(),
    readJson<string[]>(LEGACY_NIGHTS_KEY, []),
  ]);
  return [...new Set([...nightsFrom(rows), ...legacy])];
}

export type Progress = {
  history: LoggedSession[];
  stats: Stats;
  badges: BadgeState[];
  /** Earned but not yet shown — drives the card on Tonight. */
  unseen: BadgeState[];
};

export const emptyProgress: Progress = {
  history: [],
  stats: emptyStats,
  badges: evaluateBadges(emptyStats),
  unseen: [],
};

/**
 * One read for both screens that need progress, so Tonight and You can never
 * disagree about the streak.
 */
export async function loadProgress(): Promise<Progress> {
  const [history, seen] = await Promise.all([
    loadHistory(),
    readJson<string[]>(SEEN_BADGES_KEY, []),
  ]);
  const stats = computeStats(history);
  const badges = evaluateBadges(stats);
  return { history, stats, badges, unseen: unseenBadges(badges, seen) };
}

/** Stops a badge being announced twice. Called once the case has been viewed. */
export async function markBadgesSeen(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const seen = await readJson<string[]>(SEEN_BADGES_KEY, []);
  await AsyncStorage.setItem(SEEN_BADGES_KEY, JSON.stringify([...new Set([...seen, ...ids])]));
}

/** Must run on sign-out, or the next user inherits this one's streak. */
export async function clearSessionCache(): Promise<void> {
  await AsyncStorage.multiRemove([QUEUE_KEY, LOG_KEY, SEEN_BADGES_KEY, LEGACY_NIGHTS_KEY]);
}
