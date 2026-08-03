/**
 * The Wick mark's geometry — one flame, drawn from one description.
 *
 * This module is imported by **both** `components/Flame.tsx`, which renders it
 * as SVG in the app, and `tools/make-icon.mjs`, which rasterises it into the
 * launcher icon, the splash, the notification icon and the favicon. That is the
 * whole reason it exists: the profile used to live in the icon generator alone
 * and the app drew the resulting PNG, so the moment the app wanted its own
 * flame there would have been two shapes to keep in step, maintained in two
 * languages. Now there is one, and `npm test` can assert things about it.
 *
 * Like `streak.ts`, `achievements.ts` and `candles.ts`, it holds no React and no
 * imports at all — which is also what lets a `.mjs` build tool import it.
 *
 * **Coordinates.** A unit square centred on the mark, `y` running *downwards* to
 * match a pixel buffer. The flame spans `apex` (most negative) to `base`.
 *
 * ---
 *
 * **The shape took four attempts and the wrong turns are the point.** A
 * `pow`-based profile cannot come to a point: any exponent sharp enough for a
 * tip puts the widest part at the base. A straight tangent cone draws a **water
 * droplet**, the one thing a warm bedtime app must not evoke. Concave sides
 * alone don't fix it. What separates a flame from a drop is that a drop is
 * perfectly symmetric and fully round at the bottom: the flame needs a **pinched
 * base**, where the wick enters, and a **slight lean**, because it is moving.
 *
 * **A fifth pass was needed once the mark was drawn at 190pt** on Tonight rather
 * than at icon size, and it was the droplet coming back. Nothing had changed —
 * the shape had simply never been seen large, and at 24 pixels a bulb reads as a
 * flame because there is nothing else it could be. Three values moved:
 *
 * - `widest` came up from 0.0875 to 0.05. At 73% of the way down, under a
 *   shoulder that holds its width, the widest point *is* the silhouette.
 * - `foot` went from 0.55 to 1.15. Below one, `cos` holds the width through a
 *   round shoulder and only then pulls in — which is exactly how a drop hangs.
 *   Above one it pinches from the start, the way wax-fed flame does.
 * - `w` came in from 0.072 to 0.061, taking the flame from 2.6:1 to about 3:1.
 *   Candle flames are tall. The old ratio was a bead.
 *
 * Do not flatten these back toward a rounder shape on the evidence of the icon
 * alone. Check any change at both ends: `npm run icons -- --preview` for the
 * small end, `npm run shoot -- tonight:steady` for the large one.
 */

/**
 * A flame silhouette: two curves meeting at the widest point with matching zero
 * slope, so there is no kink there.
 */
export type Profile = {
  /** Top of the shape. The most negative `y`. */
  apex: number;
  /** Bottom of the shape, where the wick would enter it. */
  base: number;
  /** Where the shape is widest. */
  widest: number;
  /** Half-width at the widest point. */
  w: number;
  /**
   * Exponent on the upper curve. Above 1 draws concave sides running to a
   * point; at 1 it is a plain sine shoulder; below 1 it bulges and blunts.
   */
  tip: number;
  /**
   * Exponent on the lower curve. Above 1 pinches in from the widest point;
   * below 1 holds the width through a round shoulder — which is a droplet.
   */
  foot: number;
  /**
   * Half-width at the base, as a fraction of `w`. The flame does not close.
   *
   * Between the round shoulder that draws a droplet and the exponent that
   * fixes it there is a third failure, and it only shows in silhouette: taken
   * to zero, the foot is a **spike**, and a shape sharp at both ends is a leaf.
   * The notification icon is flat white with no gradient and no cone to carry
   * it, so it found this immediately where the coloured renders had hidden it.
   *
   * There is no exponent that avoids both. Below 1 the width approaches zero
   * sublinearly and the foot is round; at or above 1 it approaches linearly or
   * faster and the foot is a point. The answer is that a real flame's foot is
   * neither — it ends at the width of the wick it is wrapped around, which is
   * small and blunt. So the curve lands on a floor instead of on nothing.
   */
  stub: number;
};

/** The mark. */
export const FLAME: Profile = {
  apex: -0.1875,
  base: 0.1875,
  widest: 0.05,
  w: 0.061,
  tip: 1.95,
  foot: 1.15,
  stub: 0.13,
};

/**
 * The inner cone — the hot part, low and central.
 *
 * A real candle flame has one, and it is the reason this is drawn as a second
 * shape rather than as a bright spot. The old raster mark faded a stretched
 * ellipse into the body, and at icon size that reads as light from inside; at
 * 190pt it reads as a **specular highlight**, a reflection on something glossy,
 * which turns the whole mark into a bead of liquid. A cone cannot: it is
 * flame-shaped, so wherever the eye lands it finds the same object.
 *
 * Blunter than the body (`tip` near 1) and shorter, sitting low. A cone that
 * reaches for the tip makes the flame look hollow.
 */
export const INNER: Profile = {
  apex: -0.052,
  base: 0.166,
  widest: 0.086,
  w: 0.029,
  tip: 1.25,
  foot: 1.0,
  stub: 0.22,
};

/**
 * How far the tip leans off the vertical, and how sharply the lean arrives.
 *
 * One centreline for every shape in the mark — the body and the cone both sit
 * on it. Giving the cone its own lean over its own shorter span puts it off
 * axis at the top, and the flame looks like it is sliding out of itself.
 */
export const LEAN = 0.042;
const LEAN_POWER = 2.2;

/** Half-width of `profile` at `y`. Zero outside it. */
export function halfWidth(profile: Profile, y: number): number {
  const { apex, base, widest, w, tip, foot, stub } = profile;
  if (y <= apex || y > base) return 0;

  if (y <= widest) {
    const s = (y - apex) / (widest - apex);
    return w * Math.pow(Math.sin((s * Math.PI) / 2), tip);
  }

  // Interpolated onto the floor rather than added to it, so the widest point is
  // still exactly `w` and the two curves still meet with matching zero slope.
  const u = (y - widest) / (base - widest);
  return w * (stub + (1 - stub) * Math.pow(Math.cos((u * Math.PI) / 2), foot));
}

/** The centreline: straight at the base, drifting to one side going up. */
export function centreline(y: number): number {
  const t = Math.max(0, Math.min(1, (FLAME.widest - y) / (FLAME.widest - FLAME.apex)));
  return LEAN * Math.pow(t, LEAN_POWER);
}

/** Whether a point is inside the flame body. */
export function inside(x: number, y: number): boolean {
  return Math.abs(x - centreline(y)) <= halfWidth(FLAME, y);
}

/**
 * The fraction of the mark's *image box* that is actually lit shape.
 *
 * The image is one unit wide over `MARK_SCALE`, and the flame is `apex` to
 * `base` of a unit, so the lit part is this much of the file — and everything
 * else is the room the bloom needs. Anything positioning or pivoting the mark
 * needs it, which is why it lives with the geometry.
 */
export const MARK_SCALE = 0.78;
export const FLAME_BODY = (FLAME.base - FLAME.apex) * MARK_SCALE;

/** Where the flame's foot sits in the image box, as a fraction from the top. */
export const MARK_FOOT = 0.5 + FLAME_BODY / 2;

/**
 * The SVG viewBox for the mark's image box, and the scale from mark units into
 * it.
 *
 * A thousand units rather than one, so path data can be written to two decimals
 * and still be exact well past any size a phone will draw it at. Fractional
 * viewBoxes are legal and every renderer rounds them differently.
 */
export const VIEW = 1000;
export const VIEW_BOX = `0 0 ${VIEW} ${VIEW}`;
const UNIT = VIEW * MARK_SCALE;

/** A mark-space coordinate in `VIEW_BOX` units. */
export function toView(u: number): number {
  return VIEW / 2 + u * UNIT;
}

/**
 * The same, as a fraction of the box — for anything positioning the drawing
 * from the outside, which works in points and not in viewBox units.
 */
export function toBox(u: number): number {
  return toView(u) / VIEW;
}

/**
 * How many samples each side of a silhouette is cut into.
 *
 * The outline is emitted as a polyline rather than fitted to Béziers. Fitting
 * is the tidier-looking answer and it is the wrong one here: the profile is two
 * transcendental curves meeting at a tangent, a fit has error exactly where the
 * shape is most recognisable — the tip and the pinch — and the path is built
 * once at module load and then never touched. At this count a step is under a
 * fifth of a point at Tonight's size.
 */
const STEPS = 220;

/**
 * `profile` as a closed SVG path, in `VIEW_BOX` coordinates.
 *
 * Down the right side, back up the left. `from` and `to` cut a horizontal band
 * out of the shape — the band's ends are flat, so bands stacked back to back
 * reassemble into the whole silhouette with no seam and no overlap.
 *
 * That is what the bend is built from: a band rotated a degree about its own
 * lower edge stays glued to the band beneath it, and a stack of them
 * compounding upward curves. One transform cannot do this — an affine transform
 * is linear by definition, so rotating or skewing the whole flame moves the tip
 * furthest but leaves it *straight*, which is a wiper blade rather than a flame.
 */
export function outline(
  profile: Profile = FLAME,
  { from = profile.apex, to = profile.base, steps }: Band = {}
): string {
  const at = (y: number, side: 1 | -1) => {
    const x = centreline(y) + side * halfWidth(profile, y);
    return `${toView(x).toFixed(2)} ${toView(y).toFixed(2)}`;
  };

  const top = Math.max(from, profile.apex);
  const bottom = Math.min(to, profile.base);
  // Proportional to the band's share of the shape, so a thin band near the tip
  // is not drawn at the same coarseness as the whole flame.
  const cuts =
    steps ?? Math.max(12, Math.round((STEPS * (bottom - top)) / (profile.base - profile.apex)));
  const y = (i: number) => top + ((bottom - top) * i) / cuts;

  const points: string[] = [];
  for (let i = 0; i <= cuts; i += 1) points.push(at(y(i), 1));
  // Back up the left, including both ends. Where the half-width is zero the two
  // sides meet and the segment between them is empty, which costs a duplicated
  // point and saves the caller from caring which ends are pointed.
  for (let i = cuts; i >= 0; i -= 1) points.push(at(y(i), -1));

  return `M ${points[0]} L ${points.slice(1).join(' L ')} Z`;
}

/** A horizontal slice of a profile. Both bounds are in mark units. */
export type Band = { from?: number; to?: number; steps?: number };

/**
 * The boundaries the flame is cut at to bend, from the lowest upward.
 *
 * `BEND_FROM` is where the bending starts, as a fraction of the flame's height
 * measured down from the tip — everything below it is one piece and does not
 * move, because a flame is anchored to its wick and the part that whips is the
 * top of it.
 *
 * More bands is a smoother curve and more nodes to draw. Five is where the
 * joints stop being findable: the outline's direction changes by well under a
 * degree at each one, and the widest joint sits where the flame is already
 * curving hard enough to hide it.
 */
export const BEND_FROM = 0.42;
export const BEND_BANDS = 5;

/**
 * How the total bend is shared between the joints, lowest first.
 *
 * Rising toward the tip, and that is the whole reason for a chain rather than
 * one hinge. Share it equally and the flame bends into an arc of a circle,
 * which is a banana; a flame's curvature is greatest where it is thinnest, so
 * most of the angle has to happen in the last third. Sums to one, so the total
 * the component asks for is the total the tip gets.
 */
export const BEND_SHARE = [0.12, 0.16, 0.2, 0.24, 0.28] as const;

/**
 * How far each band is drawn *past* its lower cut, in mark units, so that it
 * tucks under the piece below instead of merely touching it.
 *
 * Abutting exactly is right geometrically and wrong on a screen. Two shapes
 * sharing an edge each antialias to about half coverage along it, and half over
 * half does not compose to one — the join comes out short of opaque and the
 * ground shows through as a **hairline across the flame**, once per joint.
 * There were four of them and they were plainly visible at Tonight's size.
 *
 * Small enough that the overlap costs nothing when the joint is bent: a band
 * pivots on its own lower cut, so a point this far below it swings by the
 * band's angle times this distance — a fraction of a point at any size the mark
 * is drawn, and it is hidden under the band below in any case.
 */
export const BAND_OVERLAP = 0.006;

/** The cut lines, lowest first. `bendCuts()[0]` is where the stem ends. */
export function bendCuts(): number[] {
  const start = FLAME.apex + BEND_FROM * (FLAME.base - FLAME.apex);
  return Array.from(
    { length: BEND_BANDS + 1 },
    (_, i) => start - ((start - FLAME.apex) * i) / BEND_BANDS
  );
}
