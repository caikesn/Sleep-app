import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Flame from './Flame';
import Glow from './Glow';
import { EMBER_RGB } from '../theme';
import { BOX, VESSELS, WICK_HEIGHT, flameSize, waxHeight, type Vessel, type Wax } from '../candles';

/**
 * A badge, drawn as a candle that fills with wax and lights when it's earned.
 *
 * Everything here is plain Views and one linear gradient. `react-native-svg` is
 * still not a dependency — see `Flame.tsx` — and a candle is a stack of
 * rectangles with rounded ends, which is the one shape that argument survives.
 * The two things a vector would buy, a tapered vessel and a drawn flame, are
 * covered instead by the glass overlay and by reusing the Wick mark itself.
 *
 * The flame is `Flame`, not a new shape: the app's mark *is* a flame, and the
 * moment a badge lights is the one place a candle and the logo should agree.
 * It brings its own breath and sway, so a shelf of earned candles is alive
 * without this file animating anything.
 *
 * Nothing here animates on progress. Wax height is laid out, not driven — the
 * badge grid is thirteen tiles deep and thirteen simultaneous fill animations
 * in peripheral vision at bedtime is precisely what `motion.ts` exists to stop.
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

export default function Candle({ vessel, wax, fill, lit, size = 1, still, style }: Props) {
  const spec = VESSELS[vessel];
  const u = (n: number) => n * size;

  const [waxTop, waxBottom] = wax;
  const flame = u(flameSize(spec));
  const glowSize = flame * 2.4;

  return (
    <View
      // Decorative. The tile states the badge's name, what it takes and how far
      // along you are in text; a screen reader reading "candle" after that is
      // noise, and reading the vessel name would be worse.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[{ width: u(BOX.width), height: u(BOX.height) }, styles.root, style]}
    >
      <View style={[styles.columns, { gap: u(spec.gap) }]}>
        {Array.from({ length: spec.columns }, (_, i) => {
          const height = waxHeight(spec, fill, i);
          const wickBase = u(height);
          // The mark is a square image with the flame floating in the middle of
          // it, so sitting its *box* on the wick leaves the flame hovering an
          // eighth of an inch above the candle. Sink it by the transparent
          // margin underneath instead, and the flame stands on the wick.
          const flameBottom = wickBase + u(WICK_HEIGHT) - flame * FLAME_SINK;

          return (
            <View
              key={i}
              style={{
                width: u(spec.width),
                // A container keeps its silhouette however empty it is; a
                // freestanding candle is only as tall as its wax.
                height: u(spec.wall ?? height),
                justifyContent: 'flex-end',
              }}
            >
              <LinearGradient
                colors={[waxTop, waxBottom]}
                style={{ height: wickBase, borderRadius: u(spec.radius) }}
              />

              {/* The pool at the top, lit from the wick above it. Drawn as a
                  white overlay rather than a third gradient stop so it reads
                  the same on ivory wax and on plum. */}
              <View
                style={{
                  position: 'absolute',
                  bottom: wickBase - u(1.5),
                  left: 0,
                  right: 0,
                  height: u(1.5),
                  borderRadius: u(1.5),
                  backgroundColor: MENISCUS,
                }}
              />

              {spec.wall !== undefined && (
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      borderRadius: u(spec.radius + 1),
                      borderWidth: StyleSheet.hairlineWidth,
                      backgroundColor: spec.metal ? METAL_FILL : GLASS_FILL,
                      borderColor: spec.metal ? METAL_EDGE : GLASS_EDGE,
                    },
                  ]}
                >
                  {spec.metal && (
                    <View style={{ height: u(1.5), borderRadius: u(1.5), backgroundColor: RIM }} />
                  )}
                </View>
              )}

              <View
                style={{
                  position: 'absolute',
                  bottom: wickBase,
                  alignSelf: 'center',
                  width: Math.max(1.5, u(2)),
                  height: u(lit ? WICK_HEIGHT - 2 : WICK_HEIGHT),
                  borderRadius: u(1),
                  backgroundColor: lit ? WICK_LIT : WICK,
                }}
              />

              {lit && (
                <>
                  <Glow
                    size={glowSize}
                    peak={0.2}
                    color={EMBER_RGB}
                    style={{
                      left: (u(spec.width) - glowSize) / 2,
                      bottom: flameBottom + flame / 2 - glowSize / 2,
                    }}
                  />
                  <Flame
                    size={flame}
                    still={still}
                    // No lean at this size. The flame is standing on a wick two
                    // points wide, and any horizontal travel at all reads as it
                    // sliding off rather than as a draught.
                    sway={false}
                    style={{ position: 'absolute', alignSelf: 'center', bottom: flameBottom }}
                  />
                </>
              )}
            </View>
          );
        })}
      </View>

      {/* After the columns, not before: this is a flex column aligned to the
          bottom, so the dish has to be the last child or it stacks on top of
          the candle it is supposed to be under. */}
      {spec.saucer !== undefined && (
        <View
          style={{
            width: u(spec.saucer),
            height: u(SAUCER_HEIGHT),
            borderRadius: u(SAUCER_HEIGHT),
            backgroundColor: SAUCER,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    // Bottom-aligned: candles stand on a surface, and a grid of them has to
    // share one. The spare height at the top is the flame's room.
    justifyContent: 'flex-end',
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
});
