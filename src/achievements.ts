import {
  computeStreak,
  daysBetween,
  longestStreak,
  nightOf,
  nightRuns,
  NIGHT_CUTOFF_HOUR,
} from './streak';
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
 *
 * Badges come in two shapes, and the difference is what a missed night does:
 *
 * - **Cumulative** badges only ever go up. Nights finished, minutes spent — you
 *   did those, and no later night undoes them.
 * - **Streak** badges measure the run you are on *now*, so missing a night
 *   empties the candle back to where you restarted. What a miss cannot do is
 *   take a badge you already earned: those are settled against the best run you
 *   have ever had. Losing a streak costs you the climb, not the trophy — which
 *   is the version that makes tomorrow night worth showing up for rather than
 *   the version that makes it pointless.
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
  /** Distinct nights finished inside the early window. */
  earlyNights: number;
  /** Consecutive early nights ending tonight. Resets on a miss. */
  earlyStreak: number;
  bestEarlyStreak: number;
  /** Runs restarted after a long enough gap. See `COMEBACK_*`. */
  comebacks: number;
};

/** An evening finish: after 6pm and before this hour counts as an early night. */
export const EARLY_FINISH_HOUR = 22;
const EVENING_START_HOUR = 18;

/**
 * A comeback: a run this long, begun this many nights after the last one ended.
 *
 * The gap is a week because that is roughly where a lapse stops being a missed
 * night and starts being a stopped habit — and the night you come back from one
 * is the single hardest night in the app to get someone to open it.
 */
export const COMEBACK_RUN = 3;
export const COMEBACK_GAP = 7;

export const emptyStats: Stats = {
  sessions: 0,
  nights: 0,
  minutes: 0,
  streak: 0,
  bestStreak: 0,
  kinds: 0,
  afterMidnight: 0,
  earlyNights: 0,
  earlyStreak: 0,
  bestEarlyStreak: 0,
  comebacks: 0,
};

/**
 * Runs of `COMEBACK_RUN` nights or more that follow a gap of `COMEBACK_GAP` or
 * more. The first run of all is never one — there was nothing to come back from.
 */
function countComebacks(nights: Set<string>): number {
  const runs = nightRuns(nights);
  let count = 0;

  for (let i = 1; i < runs.length; i += 1) {
    const gap = daysBetween(runs[i - 1].end, runs[i].start);
    if (runs[i].length >= COMEBACK_RUN && gap >= COMEBACK_GAP) count += 1;
  }

  return count;
}

/**
 * The run of early nights ending tonight.
 *
 * `computeStreak` gives tonight one night of grace, because at 9pm you haven't
 * had the chance to wind down yet. An early-night run can't take that grace
 * unconditionally: if you *did* wind down tonight and finished at half eleven,
 * the night is spent, and holding the run open until 4am would tell you it was
 * alive right up to the moment it silently wasn't.
 */
function earlyStreakOf(nights: Set<string>, early: Set<string>, now: Date): number {
  const tonight = nightOf(now);
  if (nights.has(tonight) && !early.has(tonight)) return 0;
  return computeStreak(early, now);
}

export function computeStats(rows: SessionSummary[], now: Date = new Date()): Stats {
  const done = rows.filter((r) => r.completed);
  const nights = new Set(done.map((r) => nightOf(r.ended_at)));
  const kinds = new Set(done.map((r) => r.kind));
  // Counted as nights rather than as sessions, because the badge that reads it
  // is a streak now, and a streak is a run of nights: three stretches before
  // 10pm on one evening is one early night, not three.
  const early = new Set<string>();

  let seconds = 0;
  let afterMidnight = 0;

  for (const row of done) {
    seconds += row.duration_seconds;
    const hour = new Date(row.ended_at).getHours();
    if (hour < NIGHT_CUTOFF_HOUR) {
      afterMidnight += 1;
    } else if (hour >= EVENING_START_HOUR && hour < EARLY_FINISH_HOUR) {
      // Bounded below, or an afternoon stretch would read as an early night.
      early.add(nightOf(row.ended_at));
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
    earlyNights: early.size,
    earlyStreak: earlyStreakOf(nights, early, now),
    bestEarlyStreak: longestStreak(early),
    comebacks: countComebacks(nights),
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
  /** Progress right now. For a streak badge this is what a missed night resets. */
  measure: (stats: Stats) => number;
  /**
   * Marks a badge as a run of consecutive nights, which the tile says out loud —
   * a bar that can go backwards has to warn you before it does, or the first
   * time it drops it reads as a bug.
   */
  streak?: true;
  /**
   * The high-water mark a streak badge is earned against, so a badge is never
   * revoked by the miss that reset its progress.
   *
   * Absent on cumulative badges: their `measure` only ever climbs, so it is
   * already its own best.
   */
  peak?: (stats: Stats) => number;
};

export type BadgeState = Badge & {
  /** Progress toward the target, clamped to it. */
  value: number;
  /** The furthest this badge has ever got. Equal to `value` unless a streak lapsed. */
  best: number;
  earned: boolean;
};

/**
 * Order is fixed and never sorted by earned state — a badge case you can learn
 * the shape of is worth more than one that reshuffles every time you open it.
 * New badges are added in roughly the order they become reachable, which is the
 * order the case already reads in.
 *
 * Six of these are streak badges, flagged `streak` and labelled as such on the
 * tile. Their progress is the run you are on now and a missed night empties it;
 * their `peak` is what settles whether they are earned, so no badge is ever
 * taken back. Everything else is cumulative and only climbs.
 *
 * Every badge is also a candle, which fills with wax as you approach it and
 * lights when you earn it. Three families run through the vessels, so the case
 * can be read at a glance before any of the names are:
 *
 * - **Session counts grow.** tealight → votive → jar → pillar.
 * - **Streaks climb and then take shelter.** a taper, then two, then a pillar —
 *   and past a month a storm lantern, twice: the streak that doesn't blow out.
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
    streak: true,
    measure: (s) => s.streak,
    peak: (s) => s.bestStreak,
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
    streak: true,
    measure: (s) => s.streak,
    peak: (s) => s.bestStreak,
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
    // Five early finishes spread over two months said nothing about a bedtime.
    // Five in a row is the badge people thought this one already was.
    id: 'early-nights',
    name: 'Lights out early',
    detail: 'Five nights running, finished before 10pm',
    icon: 'sunset',
    vessel: 'votive',
    wax: 'cream',
    target: 5,
    streak: true,
    measure: (s) => s.earlyStreak,
    peak: (s) => s.bestEarlyStreak,
  },
  {
    id: 'comeback',
    name: 'Relit',
    detail: 'Three nights running, after a week away',
    icon: 'rotate',
    // A jar, because the point of this one is that the candle was out.
    vessel: 'jar',
    wax: 'clay',
    target: 1,
    measure: (s) => s.comebacks,
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
    streak: true,
    measure: (s) => s.streak,
    peak: (s) => s.bestStreak,
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
    streak: true,
    measure: (s) => s.streak,
    peak: (s) => s.bestStreak,
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
  {
    // The end of the streak ladder, and the only badge in the case that takes
    // two months of unbroken nights. A gold storm lantern is worth the climb.
    id: 'streak-60',
    name: 'Two months',
    detail: 'Sixty nights without missing one',
    icon: 'streak',
    vessel: 'hurricane',
    wax: 'gold',
    target: 60,
    streak: true,
    measure: (s) => s.streak,
    peak: (s) => s.bestStreak,
  },
];

export function evaluateBadges(stats: Stats): BadgeState[] {
  return BADGES.map((badge) => {
    const clamp = (n: number) => Math.max(0, Math.min(n, badge.target));
    const value = clamp(badge.measure(stats));
    // Earned off the best, shown off the current: the two only disagree while a
    // streak is broken, and that disagreement is the whole point of a streak.
    const best = badge.peak ? clamp(badge.peak(stats)) : value;
    return { ...badge, value, best, earned: best >= badge.target };
  });
}

/** Earned badges the user hasn't been shown yet, in catalog order. */
export function unseenBadges(badges: BadgeState[], seen: Iterable<string>): BadgeState[] {
  const already = new Set(seen);
  return badges.filter((b) => b.earned && !already.has(b.id));
}
