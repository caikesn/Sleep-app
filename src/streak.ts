/**
 * Pure night/streak arithmetic. Deliberately free of storage and network
 * imports so it can be exercised directly — the rest of the session layer
 * needs AsyncStorage and a Supabase client just to load.
 */

/**
 * A wind-down finished at 00:30 belongs to the night before, not to the new
 * calendar day. Without this, a routine done just after midnight would break
 * the streak it should have extended.
 */
export const NIGHT_CUTOFF_HOUR = 4;

/** Local `YYYY-MM-DD` for the night a timestamp belongs to. */
export function nightOf(when: Date | string): string {
  const d = new Date(when);
  const shifted = new Date(d.getTime() - NIGHT_CUTOFF_HOUR * 60 * 60 * 1000);
  return format(shifted);
}

function format(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Shifts a night key by whole days, crossing month and year boundaries. */
export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return format(new Date(y, m - 1, d + delta));
}

/**
 * Consecutive nights ending tonight, or yesterday if tonight's routine hasn't
 * happened yet — otherwise a streak would read zero all day until you did it.
 */
export function computeStreak(nights: Iterable<string>, now: Date = new Date()): number {
  const set = new Set(nights);
  const tonight = nightOf(now);

  let cursor = set.has(tonight) ? tonight : addDays(tonight, -1);
  if (!set.has(cursor)) return 0;

  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
