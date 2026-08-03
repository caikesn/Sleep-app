import React, { useId } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import Flame from './Flame';
import Glow from './Glow';
import { EMBER_RGB } from '../theme';
import {
  BOX,
  VESSELS,
  WICK_HEIGHT,
  columnCentre,
  flameSize,
  waxHeight,
  widthAt,
  type Vessel,
  type Wax,
} from '../candles';

/**
 * A badge, drawn as a candle that fills with wax and lights when it's earned.
 *
 * **This is now vector.** The file used to say `react-native-svg` was not a
 * dependency and that a candle is a stack of rounded rectangles, which is the
 * one shape that argument survives — and that was true right up until the
 * catalog contained a *taper*. A taper candle that doesn't taper is a thin
 * pillar, and the glass was being faked by an overlay because a rectangle has no
 * way to open out at the rim. Two of nine silhouettes were lying about what they
 * were, and no amount of `borderRadius` was going to fix either.
 *
 * The dependency stays confined to what a vector actually buys:
 *
 * - **Sides that aren't parallel.** `taper` in `candles.ts` is now drawn rather
 *   than implied — see `widthAt`.
 * - **A wax top that is an ellipse, not a bar.** The old 1.5pt meniscus was a
 *   flat highlight sitting on a flat cut. Wax has a melt pool, and a pool is the
 *   thing you see when you look down into a candle at all. The same `DOME`
 *   drives the vessel's rim, so the glass and the wax agree about where the
 *   viewer's eye is; two ellipses at different squashes read as two objects
 *   photographed separately and pasted together.
 *
 * What it explicitly does not do: `Glow` and `Embers` stay as they are. Their
 * stacked-circle falloff is not a workaround waiting for SVG — an SVG radial
 * gradient bands differently on web than on native, and `Glow`'s own note
 * explains why the constant-alpha stack has no seams to hide. A vector is the
 * right tool for an edge, not for a bloom.
 *
 * The flame is still `Flame`, a react-native View laid over the drawing rather
 * than a path inside it: the app's mark *is* a flame, the moment a badge lights
 * is the one place a candle and the logo should agree, and the mark carries a
 * baked bloom on transparency that nothing here should try to redraw.
 *
 * Nothing animates on progress. Wax height is laid out, not driven — the badge
 * grid is thirteen tiles deep and thirteen simultaneous fill animations in
 * peripheral vision at bedtime is precisely what `motion.ts` exists to stop.
 * The fill is a fact you notice, not an event you watch.
 */

type Props = {
  vessel: Vessel;
  wax: Wax;
  /** Progress toward the badge, 0–1. Below 1 the candle is unlit. */
  fill: number;
  /** Earned. Lights every wick. */
  lit?: boolean;
  /** Scales the whole drawing. 1 is `BOX`. */
  size?: number;
  /** Holds the flames at mid-breath, for reduced motion. */
  still?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Warm white, for glass, metal and the pool at the top of the wax.
 *
 * The glass alphas are higher than they look like they should be. Empty glass
 * over a near-black ground *is* near-black, so a jar at 90% drawn honestly is a
 * block of wax with nothing above it — the same silhouette as a pillar. The
 * vessel has to stay visible above the wax line or the shape stops identifying
 * the badge, which is the one job it has.
 */
const GLASS_FILL = 'rgba(247, 237, 226, 0.075)';
const GLASS_EDGE = 'rgba(247, 237, 226, 0.24)';
const METAL_FILL = 'rgba(247, 237, 226, 0.10)';
const METAL_EDGE = 'rgba(247, 237, 226, 0.24)';
const RIM = 'rgba(247, 237, 226, 0.30)';
const MENISCUS = 'rgba(255, 246, 232, 0.22)';
const SAUCER = 'rgba(247, 237, 226, 0.13)';

/** Unlit wick: bare cotton. Lit, it's mostly hidden under the flame anyway. */
const WICK = '#4a382c';
const WICK_LIT = '#2a1d14';
const SAUCER_HEIGHT = 3;

/** Fraction of the mark's box that is transparent below the flame. Measured. */
const FLAME_SINK = 0.34;

/**
 * How squashed every ellipse is, as a fraction of its own half-width.
 *
 * This is the viewing angle, and it is one number on purpose: a pool, a rim and
 * a saucer at three different squashes are three objects seen from three
 * heights. Low, because the grid is looked at from the side — enough to say the
 * top is open, not enough to turn a badge into a diagram of a cylinder.
 */
const DOME = 0.16;

/** Line weight for glass and metal, in points at `size` 1. */
const STROKE = 0.6;

/** How far inside the vessel the wax sits, per side. Glass has thickness. */
const WALL_INSET = 1;

/** Geometry for one drawn body: a tapered column standing on `base`. */
type Body = {
  /** Horizontal centre. */
  cx: number;
  /** Baseline, in y-down points from the top of the `BOX`. */
  base: number;
  height: number;
  bottomWidth: number;
  topWidth: number;
  radius: number;
};

/**
 * A tapered column with a domed top and rounded feet, as a closed path.
 *
 * The top arc is the *far* rim — the edge of the opening that is furthest from
 * the viewer, which is what a slightly-raised eye sees as the highest point of a
 * round top. Drawing the shape's top edge as a straight line and adding an
 * ellipse over it puts the ellipse's upper half outside the silhouette, and the
 * candle grows a lip.
 */
function bodyPath({ cx, base, height, bottomWidth, topWidth, radius }: Body): string {
  const hb = bottomWidth / 2;
  const ht = topWidth / 2;
  const top = base - height;
  const dome = ht * DOME;
  const r = Math.max(0, Math.min(radius, hb, height / 2));

  return [
    `M ${cx - hb} ${base - r}`,
    `L ${cx - ht} ${top}`,
    `A ${ht} ${dome} 0 0 1 ${cx + ht} ${top}`,
    `L ${cx + hb} ${base - r}`,
    `A ${r} ${r} 0 0 1 ${cx + hb - r} ${base}`,
    `L ${cx - hb + r} ${base}`,
    `A ${r} ${r} 0 0 1 ${cx - hb} ${base - r}`,
    'Z',
  ].join(' ');
}

/**
 * A wick, as a stroke with a slight bend in it.
 *
 * Straight, it is a two-point bar and reads as a staple. The bend is the whole
 * difference between a piece of string and a tick mark, and it leans the same
 * way the Wick mark does so a lit badge doesn't argue with its own flame.
 */
function wickPath(cx: number, top: number, height: number): string {
  return `M ${cx} ${top} Q ${cx + height * 0.16} ${top - height * 0.6} ${cx + height * 0.09} ${top - height}`;
}

export default function Candle({ vessel, wax, fill, lit, size = 1, still, style }: Props) {
  const spec = VESSELS[vessel];
  const u = (n: number) => n * size;

  const [waxTop, waxBottom] = wax;
  const flame = u(flameSize(spec));
  const glowSize = flame * 2.4;

  // React's own ids carry colons, which are legal in an `id` attribute and
  // legal inside `url(#…)` but not in a CSS selector — cheap to strip, and the
  // failure it prevents is invisible until there are two candles on screen: on
  // web every `<Svg>` is real DOM, so thirteen badges sharing one gradient id
  // would all paint themselves the colour of whichever badge rendered first.
  const gradient = `wax-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  /** Everything stands on the dish if there is one, not on the floor. */
  const base = BOX.height - (spec.saucer !== undefined ? SAUCER_HEIGHT : 0);

  const columns = Array.from({ length: spec.columns }, (_, i) => {
    const height = waxHeight(spec, fill, i);
    const cx = columnCentre(spec, i);
    const inset = spec.wall !== undefined ? WALL_INSET : 0;

    return {
      cx,
      height,
      /** Top of the wax, in y-down points. */
      top: base - height,
      body: {
        cx,
        base: base - (spec.wall !== undefined ? STROKE / 2 : 0),
        height,
        bottomWidth: spec.width - inset * 2,
        topWidth: widthAt(spec, height) - inset * 2,
        radius: spec.radius,
      } satisfies Body,
    };
  });

  const wall =
    spec.wall === undefined
      ? undefined
      : {
          height: spec.wall,
          top: base - spec.wall,
          halfTop: widthAt(spec, spec.wall) / 2,
        };

  return (
    <View
      // Decorative. The tile states the badge's name, what it takes and how far
      // along you are in text; a screen reader reading "candle" after that is
      // noise, and reading the vessel name would be worse.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[{ width: u(BOX.width), height: u(BOX.height) }, style]}
    >
      {/* One viewport for the whole drawing, so the geometry above is written
          in the same points `candles.ts` quotes and `size` only scales the
          viewBox. The old drawing multiplied every literal by `size` by hand. */}
      <Svg
        width={u(BOX.width)}
        height={u(BOX.height)}
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {/* Bounding-box units, so one definition serves every column and each
              gets the full ramp over its own height — a shared user-space
              gradient would leave a short staggered column entirely in the
              shadowed end. */}
          <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={waxTop} />
            <Stop offset="1" stopColor={waxBottom} />
          </LinearGradient>
        </Defs>

        {/* Before the columns: a dish is under the candle standing on it. */}
        {spec.saucer !== undefined && (
          <Ellipse
            cx={BOX.width / 2}
            cy={BOX.height - SAUCER_HEIGHT / 2}
            rx={spec.saucer / 2}
            ry={SAUCER_HEIGHT / 2}
            fill={SAUCER}
          />
        )}

        {columns.map((column, i) => {
          const halfPool = column.body.topWidth / 2;
          const wickHeight = WICK_HEIGHT - (lit ? 2 : 0);

          return (
            <React.Fragment key={i}>
              <Path d={bodyPath(column.body)} fill={`url(#${gradient})`} />

              {/* The pool, drawn whole: its upper half lands exactly on the
                  body's top arc and its lower half is the near rim, which is
                  the part that says this is a surface rather than a cut. */}
              <Ellipse
                cx={column.cx}
                cy={column.top}
                rx={halfPool}
                ry={halfPool * DOME}
                fill={MENISCUS}
              />

              <Path
                d={wickPath(column.cx, column.top, wickHeight)}
                stroke={lit ? WICK_LIT : WICK}
                strokeWidth={1.6}
                strokeLinecap="round"
                fill="none"
              />
            </React.Fragment>
          );
        })}

        {/* After the wax, and translucent: glass in front of what it holds. The
            wall keeps the silhouette whatever the fill is, which is the reason
            a contained badge is legible when it's empty. */}
        {wall !== undefined && (
          <>
            <Path
              d={bodyPath({
                cx: BOX.width / 2,
                base: base - STROKE / 2,
                height: wall.height,
                bottomWidth: spec.width,
                topWidth: wall.halfTop * 2,
                radius: spec.radius + 1,
              })}
              fill={spec.metal ? METAL_FILL : GLASS_FILL}
              stroke={spec.metal ? METAL_EDGE : GLASS_EDGE}
              strokeWidth={STROKE}
            />
            {/* The near rim. Without it the opening is a filled arc and the
                vessel reads as solid — a lozenge of tinted glass, not a cup. */}
            <Ellipse
              cx={BOX.width / 2}
              cy={wall.top}
              rx={wall.halfTop}
              ry={wall.halfTop * DOME}
              fill="none"
              stroke={spec.metal ? RIM : GLASS_EDGE}
              strokeWidth={STROKE}
            />
          </>
        )}
      </Svg>

      {/* The flame is not part of the drawing: it is the app's mark, an image
          with its own bloom and its own breath, laid over the top. */}
      {lit &&
        columns.map((column, i) => {
          // The mark is a square image with the flame floating in the middle of
          // it, so sitting its *box* on the wick leaves the flame hovering an
          // eighth of an inch above the candle. Sink it by the transparent
          // margin underneath instead, and the flame stands on the wick.
          // Measured off the full `WICK_HEIGHT`, not the shortened lit one, so
          // lighting a badge doesn't drop the flame two points.
          const bottom = u(BOX.height - column.top + WICK_HEIGHT) - flame * FLAME_SINK;

          return (
            <React.Fragment key={i}>
              <Glow
                size={glowSize}
                peak={0.2}
                color={EMBER_RGB}
                style={{
                  left: u(column.cx) - glowSize / 2,
                  bottom: bottom + flame / 2 - glowSize / 2,
                }}
              />
              <Flame
                size={flame}
                still={still}
                // The `Glow` above is this flame's bloom, sized to the candle
                // rather than to the mark's own box.
                bloom={false}
                // No lean at this size. The flame is standing on a wick two
                // points wide, and any horizontal travel at all reads as it
                // sliding off rather than as a draught.
                sway={false}
                style={{ position: 'absolute', left: u(column.cx) - flame / 2, bottom }}
              />
            </React.Fragment>
          );
        })}
    </View>
  );
}
