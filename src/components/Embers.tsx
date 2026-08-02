import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, StyleProp, ViewStyle } from 'react-native';

/**
 * Specks lifting off the wick.
 *
 * Each speck runs its own loop at its own pace, which is the entire trick: a
 * shared clock would put every ember on the same beat and the field would read
 * as a rising row rather than as air moving. The offsets and durations are
 * hand-set per screen, never random — a random field re-rolls on every mount,
 * and this is a thing you glance at twice in a night and should recognise.
 *
 * Opacity and translate only, native-driven, per the rules in `motion.ts`.
 */

export type Speck = {
  /** Horizontal position across the field, as a percentage string. */
  x: `${number}%`;
  size: number;
  /** One full rise, in seconds. */
  seconds: number;
  /** Applied once, before the loop starts — not on every cycle. */
  delay: number;
};

type Props = {
  specks: readonly Speck[];
  /** How far a speck travels before it goes out. */
  rise: number;
  scaleFrom: number;
  scaleTo: number;
  /** Fraction of the travel by which a speck has faded fully in. */
  fadeInAt: number;
  /** Brightest a speck gets, at `fadeInAt`. */
  peak: number;
  color: string;
  /** Where specks are born, relative to the field's bottom edge. */
  bottom?: number;
  /** Holds every speck mid-rise instead of animating. */
  still?: boolean;
  style?: StyleProp<ViewStyle>;
};

function Ember({
  speck,
  hold,
  rise,
  scaleFrom,
  scaleTo,
  fadeInAt,
  peak,
  color,
  bottom,
  still,
}: Omit<Props, 'specks' | 'style'> & { speck: Speck; hold: number; bottom: number }) {
  const travel = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reduced motion parks each speck part way up, lit. Every speck held at the
    // same point would put them all at the same height, and six dots in a level
    // row read as a deliberate dotted rule rather than as embers.
    if (still) {
      travel.setValue(hold);
      return;
    }

    const run = Animated.sequence([
      // The delay sits outside the loop on purpose. Inside it, it would be paid
      // again every cycle and each speck's period would be its own duration
      // plus its own delay, which is not what the timings were drawn against.
      Animated.delay(speck.delay * 1000),
      Animated.loop(
        Animated.timing(travel, {
          toValue: 1,
          duration: speck.seconds * 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
    ]);

    run.start();
    return () => run.stop();
  }, [travel, speck.delay, speck.seconds, hold, still]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: speck.x,
        bottom,
        width: speck.size,
        height: speck.size,
        borderRadius: speck.size / 2,
        backgroundColor: color,
        opacity: travel.interpolate({
          inputRange: [0, fadeInAt, 1],
          outputRange: [0, peak, 0],
        }),
        transform: [
          { translateY: travel.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) },
          { scale: travel.interpolate({ inputRange: [0, 1], outputRange: [scaleFrom, scaleTo] }) },
        ],
      }}
    />
  );
}

export default function Embers({ specks, style, bottom = 0, ...motion }: Props) {
  return (
    <View pointerEvents="none" style={[styles.field, style]}>
      {specks.map((speck, index) => (
        <Ember
          key={speck.x}
          speck={speck}
          // Spread up the field, and clear of both ends: a speck held at 0 or 1
          // is a speck at zero opacity, which is one fewer ember than asked for.
          hold={
            motion.fadeInAt + (1 - motion.fadeInAt) * ((index + 0.5) / specks.length)
          }
          bottom={bottom}
          {...motion}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
