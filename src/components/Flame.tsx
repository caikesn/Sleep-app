import React from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { duration, useAmbientLoop } from '../motion';

/**
 * The Wick mark, idling.
 *
 * It is the splash asset rather than a vector: `react-native-svg` is not a
 * dependency and adding one to draw a shape the icon generator already produces
 * would be the wrong trade. The PNG carries its own bloom on transparency, so
 * it sits on any of the app's grounds without a plate behind it.
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
 */

/**
 * The fraction of the asset that is actually lit shape.
 *
 * `make-icon.mjs` draws the flame's apex at -0.1875 and its base at +0.1875 of
 * a unit that is 0.78 of the file's width, so the flame is `0.375 × 0.78` of the
 * image, centred, and everything else is the bloom it carries on transparency.
 * Anything positioning or pivoting the mark needs this, which is why it lives
 * with the asset rather than with any one screen that draws it.
 */
export const FLAME_BODY = 0.375 * 0.78;

/** Where the flame's foot sits in the image, as a fraction from the top. */
const FOOT = 0.5 + FLAME_BODY / 2;

/** How far the tip leans either side of upright. */
const LEAN_DEGREES = 2.6;

/** Loop lengths, as multiples of the breath. Deliberately not whole ratios. */
const LEAN_PERIOD = 1.7;
const DRAW_PERIOD = 1.3;

/** Anything that can be multiplied into the idle: a constant or a driven value. */
type Driver = number | Animated.Value | Animated.AnimatedInterpolation<number>;

export default function Flame({
  size = 96,
  dim,
  scale,
  still,
  sway: swaying = true,
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
   * An external 0→1 loop to lean on, instead of running one.
   *
   * For screens that light something else off the same flame. Tonight casts a
   * pool of light on the surface below, and a pool that sways on its own clock
   * drifts against the flame casting it — visibly, since the two are inches
   * apart. Handing both the same value is the only way they stay one light.
   */
  lean?: Animated.Value;
  /**
   * Placement. Lands on the wrapper rather than on the image, because that is
   * the element with the mark's footprint — a caller absolutely positioning the
   * image inside would leave the wrapper behind, taking up space in the layout.
   */
  style?: StyleProp<ViewStyle>;
}) {
  const swell = useAmbientLoop(duration.breath / 2, still);
  const draw = useAmbientLoop((duration.breath * DRAW_PERIOD) / 2, still);
  // Parked when a caller supplies its own, so the spare loop isn't running.
  const ownLean = useAmbientLoop((duration.breath * LEAN_PERIOD) / 2, still || lean !== undefined);
  const leaning = lean ?? ownLean;

  const idleOpacity = swell.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const breathe = swell.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] });

  // Taller and narrower, then shorter and wider — near enough constant volume
  // that it reads as the same flame moving rather than as one being resized.
  const drawY = draw.interpolate({ inputRange: [0, 1], outputRange: [0.965, 1.05] });
  const drawX = draw.interpolate({ inputRange: [0, 1], outputRange: [1.025, 0.98] });

  const tilt = swaying ? LEAN_DEGREES : 0;
  const rotate = leaning.interpolate({
    inputRange: [0, 1],
    outputRange: [`-${tilt}deg`, `${tilt}deg`],
  });

  return (
    // The idle rides on a wrapper rather than on the image so it can pivot at
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
      <Animated.Image
        source={require('../../assets/splash-icon.png')}
        resizeMode="contain"
        style={{
          width: size,
          height: size,
          opacity: dim === undefined ? idleOpacity : Animated.multiply(idleOpacity, dim),
          transform: scale === undefined ? [] : [{ scale }],
        }}
      />
    </Animated.View>
  );
}
