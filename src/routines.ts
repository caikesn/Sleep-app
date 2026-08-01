import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib/supabase';
import { BUILTIN_ROUTINE_ID, builtinRoutine } from './routineData';
import type { RoutinePlan } from './routineData';

/**
 * Saved routines, stored in Supabase (`routines` + `routine_steps`) and mirrored
 * locally.
 *
 * Same shape as the rest of the app: reads answer from cache so a screen never
 * waits on the network, writes land locally first and push best-effort. What is
 * different here is that routines are a *list*, so a single dirty flag isn't
 * enough — an unsent edit and an unsent delete have to be remembered separately,
 * or reconciling with the server would resurrect a routine you deleted offline.
 */

const CACHE_KEY = 'routines_v1';
/** Ids written locally whose push hasn't succeeded yet. */
const PENDING_KEY = 'routines_pending_v1';
/** Ids deleted locally whose delete hasn't reached the server yet. */
const TOMBSTONE_KEY = 'routines_deleted_v1';
/** Which routine Tonight's start button runs. */
const ACTIVE_KEY = 'active_routine_v1';

export type SavedRoutine = RoutinePlan;

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

const readCache = () => readJson<SavedRoutine[]>(CACHE_KEY, []);
const readIds = (key: string) => readJson<string[]>(key, []);

async function addId(key: string, id: string): Promise<void> {
  const ids = await readIds(key);
  if (!ids.includes(id)) await AsyncStorage.setItem(key, JSON.stringify([...ids, id]));
}

async function removeId(key: string, id: string): Promise<void> {
  const ids = await readIds(key);
  await AsyncStorage.setItem(key, JSON.stringify(ids.filter((existing) => existing !== id)));
}

/**
 * `routines.id` is a uuid, and the row is created on the device so a routine
 * saved offline keeps the same identity when it finally syncs. Hermes has no
 * global crypto, so the fallback is Math.random-shaped — weak entropy, but these
 * ids are scoped to one user's handful of routines, not a security boundary.
 */
export function newRoutineId(): string {
  const native = globalThis.crypto?.randomUUID?.();
  if (native) return native;

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    return (char === 'x' ? rand : (rand & 0x3) | 0x8).toString(16);
  });
}

export function createRoutine(name: string, stepIds: string[]): SavedRoutine {
  return { id: newRoutineId(), name, stepIds, updatedAt: new Date().toISOString() };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function pushRoutine(userId: string, routine: SavedRoutine): Promise<boolean> {
  const { error } = await supabase.from('routines').upsert({
    id: routine.id,
    user_id: userId,
    name: routine.name,
    updated_at: routine.updatedAt,
  });
  if (error) return false;

  // Steps are replaced wholesale. `(routine_id, position)` is unique, so editing
  // in place would need a diff that avoids transient collisions; clearing first
  // costs one extra call and cannot collide at all.
  const { error: clearFailed } = await supabase
    .from('routine_steps')
    .delete()
    .eq('routine_id', routine.id);
  if (clearFailed) return false;

  if (routine.stepIds.length === 0) return true;

  const { error: insertFailed } = await supabase.from('routine_steps').insert(
    routine.stepIds.map((stretchId, position) => ({
      routine_id: routine.id,
      stretch_id: stretchId,
      position,
    }))
  );
  return !insertFailed;
}

/** Pushes queued writes and deletes. Anything that fails stays queued. */
export async function flushRoutines(): Promise<void> {
  const [pending, deleted] = await Promise.all([readIds(PENDING_KEY), readIds(TOMBSTONE_KEY)]);
  if (pending.length === 0 && deleted.length === 0) return;

  const userId = await currentUserId();
  if (!userId) return;

  if (deleted.length > 0) {
    const { error } = await supabase.from('routines').delete().in('id', deleted);
    // routine_steps go with it: the foreign key is ON DELETE CASCADE.
    if (!error) await AsyncStorage.removeItem(TOMBSTONE_KEY);
  }

  const cache = await readCache();
  const stillPending: string[] = [];
  for (const id of pending) {
    const routine = cache.find((r) => r.id === id);
    // Saved and then deleted before either reached the server — the tombstone
    // above is the whole story, and there is nothing left to push.
    if (!routine) continue;
    if (!(await pushRoutine(userId, routine))) stillPending.push(id);
  }
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(stillPending));
}

/** Reads only the local cache — for render paths that must not await a network. */
export async function loadCachedRoutines(): Promise<SavedRoutine[]> {
  return readCache();
}

/** Saved routines, cache first, then reconciled with the server. */
export async function listRoutines(): Promise<SavedRoutine[]> {
  const cached = await readCache();

  const userId = await currentUserId();
  if (!userId) return cached;

  await flushRoutines();

  const { data, error } = await supabase
    .from('routines')
    .select('id, name, updated_at, routine_steps(stretch_id, position)')
    .order('created_at', { ascending: true });

  if (error || !data) return cached;

  const remote: SavedRoutine[] = data.map((row) => ({
    id: row.id,
    name: row.name,
    // PostgREST doesn't order embedded rows, and position is the whole point.
    stepIds: [...row.routine_steps]
      .sort((a, b) => a.position - b.position)
      .map((step) => step.stretch_id),
    updatedAt: row.updated_at,
  }));

  const [pending, deleted] = await Promise.all([readIds(PENDING_KEY), readIds(TOMBSTONE_KEY)]);
  const unsent = new Set(pending);
  const gone = new Set(deleted);

  // Anything still queued is newer than the server's copy by definition, so the
  // local version wins. Overwriting through the map rather than filtering keeps
  // each routine in its original position instead of shunting edits to the end.
  const byId = new Map(remote.filter((r) => !gone.has(r.id)).map((r) => [r.id, r]));
  for (const local of cached) {
    if (unsent.has(local.id) && !gone.has(local.id)) byId.set(local.id, local);
  }

  const merged = [...byId.values()];
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(merged));
  return merged;
}

export async function saveRoutine(routine: SavedRoutine): Promise<void> {
  const cache = await readCache();
  const next = cache.some((r) => r.id === routine.id)
    ? cache.map((r) => (r.id === routine.id ? routine : r))
    : [...cache, routine];

  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
  await addId(PENDING_KEY, routine.id);
  await flushRoutines();
}

export async function deleteRoutine(id: string): Promise<void> {
  // The built-in isn't a row anywhere; deleting it would queue a tombstone for
  // an id the server has never seen.
  if (id === BUILTIN_ROUTINE_ID) return;

  const cache = await readCache();
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache.filter((r) => r.id !== id)));
  await removeId(PENDING_KEY, id);
  await addId(TOMBSTONE_KEY, id);

  // Deleting tonight's pick would otherwise leave Tonight pointing at nothing.
  if ((await getActiveRoutineId()) === id) await setActiveRoutine(BUILTIN_ROUTINE_ID);

  await flushRoutines();
}

export async function getActiveRoutineId(): Promise<string> {
  return (await AsyncStorage.getItem(ACTIVE_KEY)) ?? BUILTIN_ROUTINE_ID;
}

export async function setActiveRoutine(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_KEY, id);
}

/**
 * Tonight's routine. Falls back to the built-in whenever the saved pick has gone
 * — deleted on another device, or simply not synced to this one yet — so the
 * start button always has something to run.
 */
export async function loadActiveRoutine(): Promise<SavedRoutine> {
  const [id, routines] = await Promise.all([getActiveRoutineId(), readCache()]);
  if (id === BUILTIN_ROUTINE_ID) return builtinRoutine;
  return routines.find((r) => r.id === id) ?? builtinRoutine;
}

/** As above, but reconciles with the server first. */
export async function refreshActiveRoutine(): Promise<SavedRoutine> {
  const [id, routines] = await Promise.all([getActiveRoutineId(), listRoutines()]);
  if (id === BUILTIN_ROUTINE_ID) return builtinRoutine;
  return routines.find((r) => r.id === id) ?? builtinRoutine;
}

/** Must run on sign-out, or the next user inherits this one's routines. */
export async function clearRoutineCache(): Promise<void> {
  await AsyncStorage.multiRemove([CACHE_KEY, PENDING_KEY, TOMBSTONE_KEY, ACTIVE_KEY]);
}
