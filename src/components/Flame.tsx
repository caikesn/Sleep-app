import React, { useId } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Glow from './Glow';
import { duration, useAmbientLoop, useDrift } from '../motion';
import { EMBER_RGB } from '../theme';
import {
  BAND_OVERLAP,
  BEND_BANDS,
  BEND_SHARE,
  FLAME,
  INNER,
  MARK_FOOT,
  VIEW_BOX,
  bendCuts,
  centreline,
  outline,
  toBox,
  toView,
} from '../flame';

/**
 * The Wick mark, idling.
 *
 * **It is drawn, not an image.** This file used to render `splash-icon.png` and
 * argue that adding `react-native-svg` to draw a shape the icon generator
 * already produced would be the wrong trade. That was true while the mark was
 * only ever small. It stopped being true on Tonight, where the mark is 190pt
 * tall and the PNG was being *upscaled* to get there — the lit part is under a
 * third of the file, so a 1024px asset carries about 300px of flame and Tonight
 * asked for 570. Soft edges were the least of it: at that size the silhouette
 * read as **a water droplet**, which is the exact failure `flame.ts` documents
 * four attempts at avoiding, resurfacing because the shape had never been seen
 * large. See `flame.ts` for what moved and why.
 *
 * The geometry is shared with `tools/make-icon.mjs` rather than duplicated, so
 * the flame on this screen and the flame on the launcher are the same curve.
 *
 * **The movement is a lean and a draw, not a flicker.** A real flame flickers,
 * but a flicker is high-frequency motion at the top of a screen someone is
 * looking at in order to stop looking at their phone. So:
 *
 * - It **leans from its foot**, not from its middle. A rotation about the
 *   centre swings the base out from under the flame, which is why the old
 *   sideways slide never read as fire — flames are attached to something.
 * - It **draws up and settles**, taller and narrower and then shorter and
 *   wider, at roughly constant volume. This is the part that reads as a flame
 *   rather than as a logo being animated.
 * - Its brightness only breathes. Nothing here modulates opacity quickly;
 *   that is what a flicker is, and it is the one thing being avoided.
 *
 * The three loops run at 1, 1.3 and 1.7 times the breath, none a clean multiple
 * of another, so they drift in and out of phase and the whole thing never
 * visibly repeats. A flame that leans and swells in lockstep reads as
 * mechanical, and randomness would read as a flicker; incommensurate periods
 * are how you get neither.
 *
 * **Every loop still drives a transform or an opacity on a wrapper**, never an
 * SVG attribute. `d`, `cx` and gradient stops cannot run on the native driver,
 * and a flame that stutters is worse than one that doesn't move — which is why
 * going vector bought a better shape here and no new motion.
 */

export { FLAME_BODY } from '../flame';

/** Where the flame's foot sits in the image, as a fraction from the top. */
const FOOT = MARK_FOOT;

/**
 * How far the flame is rotated at each end of its sway, in degrees. Positive is
 * further to the right; the pivot is the flame's foot.
 *
 * **Not symmetric about zero, and that is the fix for a real complaint.** The
 * silhouette is drawn leaning — `LEAN` in `flame.ts`, which puts the tip about
 * 6° right of its foot — so a rotation of plus-or-minus anything sways *around
 * a flame that is already leaning right* and never comes back through upright.
 * At the old ±2.6° the mark travelled between 4° and 9° right: it read as stuck
 * to one side, because it was. The range below is offset by roughly the built-in
 * lean, so the middle of the sway is near vertical and each end is a genuine
 * lean the other way.
 *
 * Wider than the old range, too. This is the tip of a flame moving over ten or
 * fifteen seconds, not a control animating — the thing `motion.ts` rules out is
 * *fast* movement, and a slow wander is what a candle in a still room does.
 */
const SWAY_DEGREES = [3, -8] as const;

/**
 * How far the tip bends past where the sway alone would put it, in degrees at
 * each end — the total across every joint, since the rotations compound.
 *
 * Symmetric, unlike the sway: the sway is offset to undo the silhouette's
 * built-in lean, whereas a bend has no resting side. At the middle of its
 * travel the flame is simply straight.
 */
const BEND_DEGREES = [5.5, -5.5] as const;

/**
 * The bend runs faster than the sway and shares no period with it.
 *
 * A tip whips where a body leans, and if the two ran together the flame would
 * bend hardest exactly when it leaned furthest — one pose, arrived at from two
 * directions, which is the mechanical look this is meant to break.
 */
const BEND_LOOPS = [5300, 3300, 2100] as const;
const BEND_WEIGHTS = [0.44, 0.33, 0.23] as const;

/**
 * The loops the sway and the draw are each summed from, as half-cycles in
 * milliseconds, with the weight each carries.
 *
 * No period is a simple ratio of another, in either set, and the two sets do
 * not share a period — so the lean and the height never come back into step and
 * the flame never strikes the same pose twice. A flame that leans and swells in
 * lockstep reads as mechanical; randomness would read as a flicker.
 */
const SWAY_LOOPS = [7400, 4700, 3100] as const;
const SWAY_WEIGHTS = [0.5, 0.31, 0.19] as const;
const DRAW_LOOPS = [2990, 1870, 4300] as const;
const DRAW_WEIGHTS = [0.46, 0.32, 0.22] as const;

/**
 * The flame's sway, for a screen that lights something else off the same flame.
 *
 * Exported because Tonight casts a pool of light on the surface below the mark,
 * and a pool swaying on its own clock drifts against the flame casting it —
 * visibly, since the two are inches apart. Both have to read off one value.
 */
export function useFlameSway(still?: boolean) {
  return useDrift(SWAY_LOOPS, SWAY_WEIGHTS, still);
}

/**
 * Built once. The path is a couple of hundred points and does not depend on any
 * prop — `size` scales the viewBox, which is the entire reason to draw in one.
 */
const BODY = outline(FLAME);
const CONE = outline(INNER);

/**
 * The flame cut into a stem and the bands above it that bend.
 *
 * `STEM` carries the cone, because the cone lives almost entirely below the
 * first cut — the hot core sits low, and the part of a flame that whips is the
 * wispy top, which has no core in it. The sliver of cone above the cut is
 * clipped off flat; its gradient is at zero opacity there, so nothing shows.
 */
const CUTS = bendCuts();
const STEM = outline(FLAME, { from: CUTS[0] });
const STEM_CONE = outline(INNER, { from: CUTS[0] });
// Each band runs past its own lower cut and under the piece below — see
// `BAND_OVERLAP`. Painted in order from the stem up, so the overlap is always
// covered by the band that owns the joint.
const BANDS = Array.from({ length: BEND_BANDS }, (_, k) =>
  outline(FLAME, { from: CUTS[k + 1], to: CUTS[k] + BAND_OVERLAP })
);

/**
 * The body's heat, bottom to top.
 *
 * Hottest a little above the foot rather than at it: the very base of a flame is
 * the coolest part of it, and on a badge that last stop is what stops the mark
 * looking pasted onto the wick underneath. The tip gives up some opacity as
 * well as some colour — a flame does not end at a line, and the alternative is a
 * hard edge against whatever ground the mark is standing on.
 */
const BODY_STOPS = [
  { offset: 0, color: '#d05c30', opacity: 0.85 },
  { offset: 0.13, color: '#ea7a44', opacity: 0.97 },
  { offset: 0.45, color: '#ff9d5c', opacity: 1 },
  { offset: 0.78, color: '#ffc292', opacity: 1 },
  { offset: 1, color: '#ef8b52', opacity: 0.95 },
] as const;

/**
 * The cone, fading in from nothing at its own tip.
 *
 * Warm cream rather than white. Near-white over an orange body is a *pastel*,
 * and a pastel on a near-black ground reads as grey — the first pass drew the
 * cone at `#fff3e4` and the mark came out looking like a blade. What says "hot"
 * is a colour further up the same ember ramp, not a colour off it.
 */
const CONE_STOPS = [
  { offset: 0, color: '#ffd9a8', opacity: 0 },
  { offset: 0.45, color: '#ffe4bb', opacity: 0.4 },
  { offset: 0.82, color: '#fff1da', opacity: 0.8 },
  { offset: 1, color: '#ffdead', opacity: 0.52 },
] as const;

/**
 * The bloom, as a fraction of the image box.
 *
 * The PNG carried its own, baked onto transparency, and that is what let it sit
 * on any of the app's grounds without a plate behind it. A drawn mark has to be
 * given one back — but by the same `Glow` every other light in the app uses,
 * rather than by an SVG radial gradient, which bands differently on web than on
 * native and would put a second kind of light in the interface.
 *
 * Screens that already cast their own light around the mark pass `bloom={false}`
 * instead of stacking two.
 */
const BLOOM_PEAK = 0.075;

/**
 * The bloom fills the image box exactly and never spills past it.
 *
 * `Glow` takes its light to zero at the edge of its own square, and the obvious
 * fix for the boundary that leaves — spread it wider than the mark, the way the
 * PNG's baked bloom faded out before the edge of the file — **made the sign-in
 * screen scroll**. Absolutely positioned overflow still counts toward a scroll
 * container's extent on react-native-web, so a decorative glow hanging 60pt off
 * each side of an 88pt box put a second page on a screen with six controls on
 * it. The box is already more than three times the flame; the falloff has room
 * to run inside it, and the peak comes down instead.
 */
const BLOOM_SPREAD = 1;

/**
 * One drawing surface in the stack: a full-size, full-viewBox `<Svg>` holding
 * whichever pieces of the flame belong to it.
 *
 * Every layer shares the same box and the same viewBox, so a piece drawn in
 * mark coordinates lands in exactly the place it would have in a single
 * drawing — the stack reassembles the flame perfectly when nothing is rotated,
 * with no seam to hide, and the bend is then the only thing that moves it.
 *
 * The gradients are `userSpaceOnUse` and quoted over the *whole* flame rather
 * than over the piece in hand. On bounding-box units each band would run the
 * full ramp over its own few points of height, and the flame would come out
 * banded like a colour chart. They are also redefined per layer with the
 * layer's own ids, because on web each `<Svg>` is a separate DOM tree and two
 * of them cannot share one `<defs>`.
 *
 * Absolutely positioned because `Glow` is: a positioned sibling paints over a
 * static one whatever the order in the tree, so a layer left in flow would end
 * up buried under the mark's own bloom on web.
 */
function Layer({
  size,
  id,
  children,
}: {
  size: number;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={VIEW_BOX}
      style={{ position: 'absolute', left: 0, top: 0 }}
    >
      <Defs>
        {/* Tip to foot, so offset 0 is the tip — the direction the stops are
            written in. The first pass ran this bottom-to-top and the flame came
            out dark at the foot and bright at the tip, which is a flame lit
            from above: it read as muddy metal and took the cone down with it. */}
        <LinearGradient
          id={`flame-body-${id}`}
          gradientUnits="userSpaceOnUse"
          x1={toView(0)}
          y1={toView(FLAME.apex)}
          x2={toView(0)}
          y2={toView(FLAME.base)}
        >
          {BODY_STOPS.map((stop) => (
            <Stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={stop.color}
              stopOpacity={stop.opacity}
            />
          ))}
        </LinearGradient>
        <LinearGradient
          id={`flame-cone-${id}`}
          gradientUnits="userSpaceOnUse"
          x1={toView(0)}
          y1={toView(INNER.apex)}
          x2={toView(0)}
          y2={toView(INNER.base)}
        >
          {CONE_STOPS.map((stop) => (
            <Stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={stop.color}
              stopOpacity={stop.opacity}
            />
          ))}
        </LinearGradient>
      </Defs>
      {children}
    </Svg>
  );
}

/** Anything that can be multiplied into the idle: a constant or a driven value. */
type Driver = number | Animated.Value | Animated.AnimatedInterpolation<number>;

export default function Flame({
  size = 96,
  dim,
  scale,
  still,
  sway: swaying = true,
  bloom = true,
  lean,
  style,
}: {
  size?: number;
  /**
   * Multiplied into the idle's opacity. Tonight drives this off how far the
   * evening has burned down, so the mark fades as the wick goes.
   */
  dim?: Driver;
  /**
   * Multiplied into the idle's scale, so a shrinking flame still breathes.
   * Scale rather than a smaller `size`: width and height cannot be driven
   * natively, and a flame that stutters is worse than one that doesn't move.
   *
   * Applied about the image's centre, unlike the idle, because callers place
   * the mark by compensating for exactly that.
   */
  scale?: Driver;
  /** Holds every loop at its mid point, for reduced motion. */
  still?: boolean;
  /**
   * Whether the flame leans. Off for anything drawn small: the lean is
   * proportional so it never overshoots, but a flame twenty points tall stands
   * on a wick two points wide and any horizontal travel at all reads as it
   * sliding off. The draw and the breath stay either way.
   */
  sway?: boolean;
  /**
   * Whether the mark carries its own bloom. Off for callers that already draw
   * a `Glow` around it — Tonight and the badge candles both do, and two blooms
   * on one flame is a bright ring rather than a brighter light.
   */
  bloom?: boolean;
  /**
   * An external 0→1 loop to lean on, instead of running one.
   *
   * For screens that light something else off the same flame. Tonight casts a
   * pool of light on the surface below, and a pool that sways on its own clock
   * drifts against the flame casting it — visibly, since the two are inches
   * apart. Handing both the same value is the only way they stay one light.
   */
  lean?: Animated.AnimatedInterpolation<number>;
  /**
   * Placement. Lands on the wrapper rather than on the drawing, because that is
   * the element with the mark's footprint — a caller absolutely positioning the
   * drawing inside would leave the wrapper behind, taking up space in the layout.
   */
  style?: StyleProp<ViewStyle>;
}) {
  // Brightness stays on one slow loop. It is the one channel where irregularity
  // would read as a flicker rather than as a draught, which is the whole thing
  // this component is built to avoid.
  const swell = useAmbientLoop(duration.breath / 2, still);
  const draw = useDrift(DRAW_LOOPS, DRAW_WEIGHTS, still);
  // Parked when a caller supplies its own, and when there is no lean to drive:
  // a badge grid is thirteen tiles deep, and three loops apiece animating a
  // rotation of zero is thirty-nine animations doing nothing.
  const ownSway = useFlameSway(still || lean !== undefined || !swaying);
  const leaning = lean ?? ownSway;

  /**
   * Whether the flame is drawn as a chain that bends, or as one still shape.
   *
   * Tied to `sway`, which is off for anything drawn small. Five extra layers to
   * curve a flame fifteen points tall is invisible detail bought at thirteen
   * times the cost on the badge grid, and at that size the whole mark is about
   * as wide as one joint's travel.
   */
  const bending = swaying;
  const bend = useDrift(BEND_LOOPS, BEND_WEIGHTS, still || !bending);

  const idleOpacity = swell.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const breathe = swell.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] });

  // Taller and narrower, then shorter and wider — near enough constant volume
  // that it reads as the same flame moving rather than as one being resized.
  const drawY = draw.interpolate({ inputRange: [0, 1], outputRange: [0.965, 1.05] });
  const drawX = draw.interpolate({ inputRange: [0, 1], outputRange: [1.025, 0.98] });

  // Per instance, not a constant. On web every `<Svg>` is real DOM, and a
  // shared id would leave thirteen lit badges all pointing at whichever mark
  // rendered first — fine until that one unmounts and takes the `<defs>` with
  // it, at which point every remaining flame loses its fill. The colons React
  // puts in an id are legal in `url(#…)` but not in a CSS selector.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  const [from, to] = swaying ? SWAY_DEGREES : [0, 0];
  const rotate = leaning.interpolate({
    inputRange: [0, 1],
    outputRange: [`${from}deg`, `${to}deg`],
  });

  /**
   * The chain, built from the tip down so each band ends up *inside* the one
   * below it. Nesting is what makes the angles compound: a band carries its own
   * rotation plus every rotation beneath it, which is why the tip travels
   * several times as far as the first joint does and the curve tightens as it
   * goes up.
   *
   * Each wrapper is the same full-size box pinned to the same origin, so a band
   * needs no offset of its own — its geometry already sits in the right place —
   * and its pivot is simply the point where it meets the band below, on the
   * flame's own centreline rather than on the middle of the box.
   */
  let chain: React.ReactNode = null;
  for (let k = BEND_BANDS - 1; k >= 0; k -= 1) {
    const pivot = CUTS[k];
    const inner = chain;
    chain = (
      <Animated.View
        key={k}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
          transformOrigin: [size * toBox(centreline(pivot)), size * toBox(pivot), 0],
          transform: [
            {
              rotate: bend.interpolate({
                inputRange: [0, 1],
                outputRange: [
                  `${BEND_DEGREES[0] * BEND_SHARE[k]}deg`,
                  `${BEND_DEGREES[1] * BEND_SHARE[k]}deg`,
                ],
              }),
            },
          ],
        }}
      >
        <Layer size={size} id={`${id}-${k + 1}`}>
          <Path d={BANDS[k]} fill={`url(#flame-body-${id}-${k + 1})`} />
        </Layer>
        {inner}
      </Animated.View>
    );
  }

  return (
    // The idle rides on a wrapper rather than on the drawing so it can pivot at
    // the flame's foot while the caller's `scale` still works about the centre.
    // One element cannot have two transform origins.
    <Animated.View
      // Decorative: screens that show this state the app's name in text beside
      // it, so announcing it here would only make the heading read twice.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        style,
        {
          width: size,
          height: size,
          transformOrigin: ['50%', `${FOOT * 100}%`, 0],
          transform: [
            { rotate },
            { scaleX: Animated.multiply(breathe, drawX) },
            { scaleY: Animated.multiply(breathe, drawY) },
          ],
        },
      ]}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          opacity: dim === undefined ? idleOpacity : Animated.multiply(idleOpacity, dim),
          transform: scale === undefined ? [] : [{ scale }],
        }}
      >
        {bloom && (
          <Glow
            size={size * BLOOM_SPREAD}
            peak={BLOOM_PEAK}
            color={EMBER_RGB}
            // Centred on the box, which is where the flame's own centre is —
            // `apex` and `base` are symmetric about it.
            style={{ left: (size * (1 - BLOOM_SPREAD)) / 2, top: (size * (1 - BLOOM_SPREAD)) / 2 }}
          />
        )}

        {bending ? (
          <>
            {/* The stem. It does not move: a flame is anchored to its wick, and
                the complaint that started this was that rotating the whole mark
                about its foot moves the tip and the stem by the same angle,
                which is a wiper blade. */}
            <Layer size={size} id={`${id}-0`}>
              <Path d={STEM} fill={`url(#flame-body-${id}-0)`} />
              <Path d={STEM_CONE} fill={`url(#flame-cone-${id}-0)`} />
            </Layer>
            {chain}
          </>
        ) : (
          <Layer size={size} id={`${id}-0`}>
            <Path d={BODY} fill={`url(#flame-body-${id}-0)`} />
            <Path d={CONE} fill={`url(#flame-cone-${id}-0)`} />
          </Layer>
        )}
      </Animated.View>
    </Animated.View>
  );
}
