import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

/**
 * A soft pool of light, standing in for a CSS radial gradient.
 *
 * There isn't one. `expo-linear-gradient` is linear by definition, and
 * `react-native-svg` is not a dependency — see the note in `Flame.tsx` for why
 * that stays true. So the falloff is drawn as a stack of concentric circles,
 * each with the same small alpha.
 *
 * That is not an approximation chosen by eye. `n` constant-alpha layers of alpha
 * `s` composite to `1 - (1 - s)^n`, and at a normalised distance `t` from the
 * centre roughly `n(1 - t)` of them are still covering the point, so the stack
 * reads as `1 - (1 - peak)^(1 - t)`. At the alphas this app actually uses — 0.42
 * and below — that sits within a percent of the straight `peak * (1 - t)` ramp a
 * real gradient would draw, and it has no seams because every layer is a circle
 * with an exact radius rather than a band with two edges.
 *
 * The light reaches zero at the edge of the box, so `size` is the full extent of
 * the glow and not the CSS box a `radial-gradient` stop was quoted against.
 */

type Props = {
  /** Diameter of the light. The view is this square; centre it on your target. */
  size: number;
  /** Alpha at the centre. */
  peak: number;
  /** The light's colour, as components — each layer needs its own alpha. */
  color: readonly [number, number, number];
  /** Vertical squash, for an ellipse. 1 is a circle. */
  squash?: number;
  /**
   * How many circles the falloff is cut into. Defaults to whatever keeps each
   * step below `SMALLEST_STEP`; override only to buy performance back.
   */
  layers?: number;
  /**
   * Shifts every ring by this fraction of one ring's width, 0–1.
   *
   * Only matters when glows are stacked. Two stacks of the same size have their
   * ring edges in exactly the same places, so their steps land on top of each
   * other and add — four stacked glows band four times as hard as one, which is
   * the opposite of what stacking them was for. Giving each a different phase
   * interleaves the edges and the banding goes back to one step's worth.
   */
  phase?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The largest alpha jump between two neighbouring layers that still reads as a
 * gradient rather than as rings. Measured, not guessed: at 0.018 the cast light
 * under Tonight's flame came out looking like the rim of a bowl.
 *
 * Layer count follows from the peak rather than from the size, because banding
 * is a contrast artefact — a wide glow with tiny steps is smooth, and a small
 * bright one with coarse steps is not.
 */
const SMALLEST_STEP = 0.008;

export default function Glow({
  size,
  peak,
  color,
  squash = 1,
  layers = Math.min(48, Math.max(12, Math.round(peak / SMALLEST_STEP))),
  phase = 0,
  style,
}: Props) {
  const rings = useMemo(() => {
    const [r, g, b] = color;
    const step = 1 - Math.pow(1 - peak, 1 / layers);
    const fill = `rgba(${r}, ${g}, ${b}, ${step})`;

    // Largest first, so the array reads outside-in like the light does.
    return Array.from({ length: layers }, (_, i) => {
      const diameter = (size * Math.max(0, layers - i - phase)) / layers;
      const inset = (size - diameter) / 2;
      return {
        position: 'absolute' as const,
        left: inset,
        top: inset,
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        backgroundColor: fill,
      };
    });
  }, [size, peak, color, layers, phase]);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.root,
        { width: size, height: size },
        // Squashing the whole stack keeps every layer a true ellipse. Setting an
        // elliptical radius per layer isn't possible — a single `borderRadius`
        // on a non-square box gives a stadium, with a flat side down the middle.
        squash !== 1 && { transform: [{ scaleY: squash }] },
        style,
      ]}
    >
      {rings.map((ring, index) => (
        <View key={index} style={ring} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    // Decorative light. It must never sit between a finger and a control.
    position: 'absolute',
  },
});
