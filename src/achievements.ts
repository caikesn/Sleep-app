import { computeStreak, longestStreak, nightOf, NIGHT_CUTOFF_HOUR } from './streak';
import type { IconName } from './components/Icon';
import type { Vessel, WaxName } from './candles';

/**
 * Stats and badges.
 *
 * Like `streak.ts`, this holds no storage or network imports — the type-only
 * import above is erased at compile time — so the whole scoring model can be
 * exercised directly without booting AsyncStorage or a Supabase client.
 *
 * Every badge is a count against a target. Keeping that uniform means one
 * progress bar renders all of them, and "23 of 25" is visible on the locked
 * ones, which is the part that actually pulls people back.
 */

/** The subset of a session row the scoring cares about. */
export type SessionSummary = {
  kind: string;
  ended_at: string;
  completed: boolean;
  duration_seconds: number;
};

export type Stats = {
  /** Completed sessions. Abandoned ones are logged but never scored. */
  sessions: number;
  /** Distinct nights with at least one completed session. */
  nights: number;
  minutes: number;
  streak: number;
  bestStreak: number;
  /** Distinct kinds tried — routine, stretch, meditation, reading. */
  kinds: number;
  afterMidnight: number;
  earlyNights: number;
};

/** An evening finish: after 6pm and before this hour counts as an early night. */
export const EARLY_FINISH_HOUR = 22;
const EVENING_START_HOUR = 18;

export const emptyStats: Stats = {
  sessions: 0,
  nights: 0,
  minutes: 0,
  streak: 0,
  bestStreak: 0,
  kinds: 0,
  afterMidnight: 0,
  earlyNights: 0,
};

export function computeStats(rows: SessionSummary[], now: Date = new Date()): Stats {
  const done = rows.filter((r) => r.completed);
  const nights = new Set(done.map((r) => nightOf(r.ended_at)));
  const kinds = new Set(done.map((r) => r.kind));

  let seconds = 0;
  let afterMidnight = 0;
  let earlyNights = 0;

  for (const row of done) {
    seconds += row.duration_seconds;
    const hour = new Date(row.ended_at).getHours();
    if (hour < NIGHT_CUTOFF_HOUR) {
      afterMidnight += 1;
    } else if (hour >= EVENING_START_HOUR && hour < EARLY_FINISH_HOUR) {
      // Bounded below, or an afternoon stretch would read as an early night.
      earlyNights += 1;
    }
  }

  return {
    sessions: done.length,
    nights: nights.size,
    minutes: Math.round(seconds / 60),
    streak: computeStreak(nights, now),
    bestStreak: longestStreak(nights),
    kinds: kinds.size,
    afterMidnight,
    earlyNights,
  };
}

export type Badge = {
  id: string;
  name: string;
  detail: string;
  icon: IconName;
  /** The candle's silhouette. See `candles.ts`. */
  vessel: Vessel;
  /** Its wax, by palette name. */
  wax: WaxName;
  target: number;
  measure: (stats: Stats) => number;
};

export type BadgeState = Badge & {
  /** Progress toward the target, clamped to it. */
  value: number;
  earned: boolean;
};

/**
 * Order is fixed and never sorted by earned state — a badge case you can learn
 * the shape of is worth more than one that reshuffles every time you open it.
 *
 * Streak badges read `bestStreak`, so a missed night dims the streak on Tonight
 * but never takes a badge back.
 *
 * Every badge is also a candle, which fills with wax as you approach it and
 * lights when you earn it. Three families run through the vessels, so the case
 * can be read at a glance before any of the names are:
 *
 * - **Session counts grow.** tealight → votive → jar → pillar.
 * - **Streaks gain flames.** one taper → two → three, and a month becomes a
 *   storm lantern: the streak that doesn't blow out.
 * - **Total time comes in tins.** A small one for an hour, bronze for ten.
 *
 * No two badges share both a vessel and a wax, which is the rule that keeps
 * repeats legible — colour is doing real work here, not decoration.
 */
export const BADGES: Badge[] = [
  {
    id: 'first-night',
    name: 'First night',
    detail: 'Finish your first wind-down',
    icon: 'award',
    // The smallest candle there is, for the smallest thing you can do.
    vessel: 'tealight',
    wax: 'ivory',
    target: 1,
    measure: (s) => s.sessions,
  },
  {
    id: 'streak-3',
    name: 'Three in a row',
    detail: 'Wind down three nights running',
    icon: 'streak',
    vessel: 'taper',
    wax: 'honey',
    target: 3,
    measure: (s) => s.bestStreak,
  },
  {
    id: 'sessions-10',
    name: 'Ten nights',
    detail: 'Finish ten sessions',
    icon: 'star',
    vessel: 'votive',
    wax: 'amber',
    target: 10,
    measure: (s) => s.sessions,
  },
  {
    id: 'minutes-60',
    name: 'An hour of quiet',
    detail: 'Spend an hour winding down',
    icon: 'clock',
    vessel: 'tin',
    wax: 'sand',
    target: 60,
    measure: (s) => s.minutes,
  },
  {
    id: 'streak-7',
    name: 'A full week',
    detail: 'Seven nights running',
    icon: 'streak',
    vessel: 'twin',
    wax: 'ember',
    target: 7,
    measure: (s) => s.bestStreak,
  },
  {
    id: 'well-rounded',
    name: 'Well rounded',
    detail: 'Try a routine, a stretch and a meditation',
    icon: 'layers',
    // Three candles for three disciplines — the one place the count in the
    // holder means something on its own.
    vessel: 'triple',
    wax: 'rose',
    target: 3,
    measure: (s) => s.kinds,
  },
  {
    id: 'night-owl',
    name: 'Night owl',
    detail: 'Finish a session after midnight',
    icon: 'rest',
    vessel: 'hurricane',
    wax: 'plum',
    target: 1,
    measure: (s) => s.afterMidnight,
  },
  {
    id: 'early-nights',
    name: 'Lights out early',
    detail: 'Finish five sessions before 10pm',
    icon: 'sunset',
    vessel: 'votive',
    wax: 'cream',
    target: 5,
    measure: (s) => s.earlyNights,
  },
  {
    id: 'sessions-25',
    name: 'Twenty-five nights',
    detail: 'Finish twenty-five sessions',
    icon: 'star',
    vessel: 'jar',
    wax: 'terracotta',
    target: 25,
    measure: (s) => s.sessions,
  },
  {
    id: 'streak-14',
    name: 'A fortnight',
    detail: 'Fourteen nights running',
    icon: 'streak',
    vessel: 'pillar',
    wax: 'amber',
    target: 14,
    measure: (s) => s.bestStreak,
  },
  {
    id: 'minutes-600',
    name: 'Ten hours down',
    detail: 'Ten hours of wind-down in total',
    icon: 'clock',
    vessel: 'tin',
    wax: 'bronze',
    target: 600,
    measure: (s) => s.minutes,
  },
  {
    id: 'streak-30',
    name: 'A month straight',
    detail: 'Thirty nights running',
    icon: 'streak',
    vessel: 'hurricane',
    wax: 'ember',
    target: 30,
    measure: (s) => s.bestStreak,
  },
  {
    id: 'sessions-100',
    name: 'A hundred nights',
    detail: 'Finish a hundred sessions',
    icon: 'award',
    vessel: 'pillar',
    wax: 'gold',
    target: 100,
    measure: (s) => s.sessions,
  },
];

export function evaluateBadges(stats: Stats): BadgeState[] {
  return BADGES.map((badge) => {
    const value = Math.min(badge.measure(stats), badge.target);
    return { ...badge, value, earned: value >= badge.target };
  });
}

/** Earned badges the user hasn't been shown yet, in catalog order. */
export function unseenBadges(badges: BadgeState[], seen: Iterable<string>): BadgeState[] {
  const already = new Set(seen);
  return badges.filter((b) => b.earned && !already.has(b.id));
}
