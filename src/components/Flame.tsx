import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ImageStyle } from 'react-native';
import { duration, easing } from '../motion';

/**
 * The Wick mark, idling.
 *
 * It is the splash asset rather than a vector: `react-native-svg` is not a
 * dependency and adding one to draw a shape the icon generator already produces
 * would be the wrong trade. The PNG carries its own bloom on transparency, so
 * it sits on any of the app's grounds without a plate behind it.
 *
 * The movement is a slow swell, not a flicker. A real flame flickers, but a
 * flicker is high-frequency motion at the top of a sign-in screen, and this app
 * is opened by someone trying to stop looking at their phone. It breathes at
 * roughly the pace the breathing pacer asks you to, which is the point.
 */
/** Anything that can be multiplied into the idle: a constant or a driven value. */
type Driver = number | Animated.Value | Animated.AnimatedInterpolation<number>;

export default function Flame({
  size = 96,
  dim,
  scale,
  still,
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
   */
  scale?: Driver;
  /** Holds the swell at its mid point, for reduced motion. */
  still?: boolean;
  style?: StyleProp<ImageStyle>;
}) {
  const swell = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) {
      swell.setValue(0.5);
      return;
    }

    const cycle = Animated.loop(
      Animated.sequence([
        Animated.timing(swell, {
          toValue: 1,
          duration: duration.breath / 2,
          easing: easing.breathe,
          useNativeDriver: true,
        }),
        Animated.timing(swell, {
          toValue: 0,
          duration: duration.breath / 2,
          easing: easing.breathe,
          useNativeDriver: true,
        }),
      ])
    );

    cycle.start();
    return () => cycle.stop();
  }, [swell, still]);

  const idleOpacity = swell.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const idleScale = swell.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] });

  return (
    <Animated.Image
      // Decorative: the screen states the app's name in text directly below it,
      // so announcing it again here would only make the heading read twice.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      source={require('../../assets/splash-icon.png')}
      resizeMode="contain"
      style={[
        {
          width: size,
          height: size,
          opacity: dim === undefined ? idleOpacity : Animated.multiply(idleOpacity, dim),
          transform: [
            { scale: scale === undefined ? idleScale : Animated.multiply(idleScale, scale) },
          ],
        },
        style,
      ]}
    />
  );
}
