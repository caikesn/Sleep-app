/**
 * Candles — the shape and colour half of a badge.
 *
 * A badge fills with wax as you close in on it and lights when you earn it, so
 * the reward is ignition rather than a checkmark. That direction matters: the
 * obvious version of this metaphor has the candle *burning down* with progress,
 * which means the better you do the less candle you have and the prize is a
 * puddle. Here wax accumulates and the payoff is the flame.
 *
 * This module holds no React and no imports at all, for the same reason
 * `streak.ts` and `achievements.ts` don't — the catalog can then be asserted
 * over in `npm test` without booting a renderer. Everything that needs a View
 * lives in `components/Candle.tsx`.
 *
 * Geometry is quoted in points inside a fixed `BOX`. Fixed, because thirteen
 * tiles in a two-column grid must not change height as candles fill.
 */

/** The silhouette. Two candles differing only in wax colour read as the same badge. */
export type Vessel =
  | 'tealight'
  | 'votive'
  | 'jar'
  | 'hurricane'
  | 'tin'
  | 'taper'
  | 'twin'
  | 'pillar'
  | 'triple';

/** Wax as `[top, bottom]`. Lit from above, so the top is the lighter of the two. */
export type Wax = readonly [string, string];

/**
 * The palette. Warm only — the app's one hard colour rule is no blue anywhere,
 * and a candle is the last place to break it, since wax on a near-black ground
 * is the largest area of flat colour in the interface.
 *
 * Each pair is a light face and a shadowed base, not a tint and a shade of one
 * hue: real wax scatters, so the base drifts a little redder as it darkens.
 */
export const WAX = {
  ivory: ['#f4e7d4', '#d9c4a6'],
  cream: ['#f6dfb6', '#dcbe8b'],
  sand: ['#ddc9a2', '#b8a077'],
  honey: ['#eec27c', '#cf9a4e'],
  amber: ['#e9a463', '#c87a38'],
  ember: ['#f0a06a', '#cf6a37'],
  terracotta: ['#d98a67', '#a95a3c'],
  clay: ['#c9866f', '#9c5a46'],
  rose: ['#d9a09b', '#a86e6c'],
  plum: ['#a8757e', '#7a4c56'],
  bronze: ['#c9a05e', '#8f6b34'],
  gold: ['#f7d9a0', '#d8ac62'],
} as const satisfies Record<string, Wax>;

export type WaxName = keyof typeof WAX;

/** The box every candle is drawn into, bottom-aligned. Tall enough for a flame. */
export const BOX = { width: 52, height: 72 } as const;

export type VesselSpec = {
  /** Wax columns. More than one is a holder with several candles in it. */
  columns: number;
  /** Width of one column. */
  width: number;
  /** Space between columns. */
  gap: number;
  /** Wax height at a full fill. */
  height: number;
  radius: number;
  /**
   * Wall height for a container. Present means glass or metal is drawn around
   * the wax and the silhouette stays the same however empty it is; absent means
   * the candle is freestanding and the wax *is* the silhouette.
   */
  wall?: number;
  /** Draw the wall as opaque metal with a rim, rather than as glass. */
  metal?: boolean;
  /** Width of the dish under a freestanding candle. */
  saucer?: number;
  /**
   * Fraction each successive column is shortened by. Three candles cut to
   * exactly the same height read as a printed icon rather than as objects.
   */
  stagger?: number;
  /**
   * Width at the top as a fraction of the width at the base. 1 is straight
   * sided; below 1 narrows upward, above 1 flares open.
   *
   * This is the one thing the old rounded-rectangle drawing could not do, and
   * its absence was doing real damage: a *taper* candle that isn't tapered is
   * just a thin pillar, so two of the catalog's nine silhouettes were lying
   * about what they were. Glass flares slightly because a votive is a tumbler;
   * a jar pulls in at the shoulder, which is what separates it from a plain
   * cylinder now that both are drawn honestly.
   */
  taper?: number;
};

export const VESSELS: Record<Vessel, VesselSpec> = {
  // The three contained shapes are separated by proportion, not by size: a
  // squat wide jar and a narrow tall hurricane read as different objects at a
  // glance, where two rounded rectangles a few points apart do not.
  // The two metal ones are taller than a real tealight or tin, on purpose. At
  // true proportions the wax is a four-point bar and the fill has nowhere to
  // travel — you cannot see how far along the badge is, which is the whole job.
  tealight: { columns: 1, width: 22, gap: 0, height: 8, radius: 2, wall: 10, metal: true, taper: 1.1 },
  votive: { columns: 1, width: 24, gap: 0, height: 20, radius: 3, wall: 23, taper: 1.12 },
  jar: { columns: 1, width: 32, gap: 0, height: 26, radius: 5, wall: 30, taper: 0.93 },
  hurricane: { columns: 1, width: 19, gap: 0, height: 37, radius: 3, wall: 41, taper: 1.06 },
  tin: { columns: 1, width: 34, gap: 0, height: 16, radius: 3, wall: 18, metal: true },
  taper: { columns: 1, width: 9, gap: 0, height: 46, radius: 4, saucer: 22, taper: 0.6 },
  twin: { columns: 2, width: 9, gap: 8, height: 42, radius: 4, saucer: 32, stagger: 0.13, taper: 0.62 },
  pillar: { columns: 1, width: 28, gap: 0, height: 34, radius: 4, saucer: 34, taper: 0.94 },
  triple: { columns: 3, width: 8, gap: 6, height: 44, radius: 4, saucer: 40, stagger: 0.15, taper: 0.62 },
};

/**
 * How much wax an untouched candle already has, as a fraction of its full
 * height.
 *
 * Not zero. A freestanding candle at a true zero has no body to see, so the
 * whole grid of unstarted badges would be thirteen empty saucers — and the
 * point of showing a locked badge as its own dim shape rather than a padlock is
 * that you can tell them apart before you've earned any of them.
 */
export const EMPTY_FILL = 0.14;

/**
 * The least wax that still draws as wax, in points.
 *
 * `EMPTY_FILL` alone isn't enough, because it's a fraction of a height that
 * varies by an order of magnitude across the catalog: 14% of a taper is a
 * visible stub, 14% of a tealight is under a point and renders as a hairline or
 * as nothing at all. The floor is absolute for the same reason the meniscus is
 * a fixed 1.5 — below about two points there is no shape left to read.
 */
export const MIN_WAX = 2;

/** How tall a wick stands out of the wax. */
export const WICK_HEIGHT = 6;

/**
 * The flame for a vessel, tied to its column width so a taper doesn't carry a
 * pillar's flame. Clamped at both ends: below ~15pt the Wick mark is a smudge,
 * above ~24 it dwarfs the candle it's standing on.
 */
export function flameSize(spec: VesselSpec): number {
  return Math.max(15, Math.min(24, spec.width * 1.7));
}

/**
 * The height the taper is measured against: the vessel's wall if it has one,
 * otherwise the wax at a full fill.
 *
 * A contained candle's sides are the *glass*, and glass does not change shape as
 * the wax rises — so its taper has to be read off the wall or a half-full jar
 * would be drawn narrower than an empty one standing beside it.
 */
export function silhouetteHeight(spec: VesselSpec): number {
  return spec.wall ?? spec.height;
}

/** Width of the silhouette `y` points above its base. */
export function widthAt(spec: VesselSpec, y: number): number {
  const t = Math.max(0, Math.min(1, y / silhouetteHeight(spec)));
  return spec.width * (1 + ((spec.taper ?? 1) - 1) * t);
}

/**
 * Horizontal centre of column `index`, in points from the left of the `BOX`.
 *
 * Columns are spaced on their *base* widths, which is what keeps a flared pair
 * from colliding at the rim and a tapered pair from drifting apart at the foot.
 */
export function columnCentre(spec: VesselSpec, index = 0): number {
  const span = spec.columns * spec.width + (spec.columns - 1) * spec.gap;
  return (BOX.width - span) / 2 + index * (spec.width + spec.gap) + spec.width / 2;
}

/** The widest the silhouette gets anywhere, including a flared rim. */
export function widestPoint(spec: VesselSpec): number {
  const span = spec.columns * spec.width + (spec.columns - 1) * spec.gap;
  return Math.max(span + Math.max(0, spec.width * ((spec.taper ?? 1) - 1)), spec.saucer ?? 0);
}

/** Wax height for column `index`, in points. `fill` is the badge's 0–1 progress. */
export function waxHeight(spec: VesselSpec, fill: number, index = 0): number {
  const clamped = Math.max(0, Math.min(1, fill));
  const filled = EMPTY_FILL + clamped * (1 - EMPTY_FILL);
  const height = spec.height * filled * (1 - (spec.stagger ?? 0) * index);
  return Math.max(MIN_WAX, Math.min(spec.height, height));
}
