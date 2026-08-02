import React, { useRef } from 'react';
import {
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { theme, space, radius } from '../theme';
import { duration, easing, PRESS_SCALE } from '../motion';

/**
 * Animating the Pressable itself rather than wrapping it in an Animated.View.
 * A wrapper would take over the caller's `style`, which across the app carries
 * layout — flex, margins — and quietly moves where that layout applies.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The one button in the app. Screens were each hand-rolling their own filled
 * ember rectangle, which meant a change to the primary action cost an edit per
 * screen and the treatments had already drifted apart.
 */

type Variant = 'primary' | 'outline' | 'quiet';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Second line inside the button, e.g. "8 steps · 8 min". */
  meta?: string;
  /** Swaps the label for a spinner and blocks presses. */
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Dark enough to stay readable on the ember fill. */
const ON_EMBER = '#1a0f08';

export default function Button({
  label,
  onPress,
  variant = 'primary',
  meta,
  busy,
  disabled,
  style,
}: Props) {
  const inert = disabled || busy;

  /**
   * 0 at rest, 1 held down. Both the shrink and the dim read off this one
   * value, which is also why neither is expressed as a `pressed` style any
   * more: an animated component drops a **function** style prop entirely
   * rather than calling it, so `style={({ pressed }) => [...]}` silently left
   * this button with no styling at all — no fill, no radius, no centring.
   */
  const held = useRef(new Animated.Value(0)).current;

  function press(to: number, ms: number, curve: typeof easing.press) {
    Animated.timing(held, {
      toValue: to,
      duration: ms,
      easing: curve,
      useNativeDriver: true,
    }).start();
  }

  // A disabled button has a fixed look and never animates, so it keeps its
  // plain style. Layering an animated opacity over `styles.disabled` would
  // override the 0.4 with this value's resting 1 and undim it.
  const feedback = inert
    ? null
    : {
        opacity: held.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }),
        transform: [
          { scale: held.interpolate({ inputRange: [0, 1], outputRange: [1, PRESS_SCALE] }) },
        ],
      };

  // A disabled primary drops its fill rather than fading it. Near-black text on
  // ember at 40% opacity is near-black on near-black — the label vanished
  // completely on the routine builder's empty state.
  const muted = variant === 'primary' && !!disabled && !busy;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => !inert && press(1, duration.press, easing.press)}
      onPressOut={() => !inert && press(0, duration.release, easing.settle)}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
      accessibilityState={{ disabled: !!inert }}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        variant === 'quiet' && styles.quiet,
        inert && !muted && styles.disabled,
        muted && styles.primaryDisabled,
        style,
        feedback,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? ON_EMBER : theme.ember} />
      ) : (
        <>
          <Text
            // Single line so a long routine name in the label can't grow the
            // button to three lines.
            numberOfLines={1}
            style={[
              styles.label,
              variant === 'primary' ? styles.labelOnEmber : styles.labelEmber,
              muted && styles.labelMuted,
            ]}
          >
            {label}
          </Text>
          {meta && (
            <Text
              style={[
                styles.meta,
                variant === 'primary' ? styles.metaOnEmber : styles.metaEmber,
                muted && styles.labelMuted,
              ]}
            >
              {meta}
            </Text>
          )}
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 54,
  },
  primary: {
    backgroundColor: theme.emberDeep,
  },
  outline: {
    borderWidth: 1,
    borderColor: theme.ember,
  },
  quiet: {
    backgroundColor: theme.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
  },
  disabled: {
    opacity: 0.4,
  },
  primaryDisabled: {
    backgroundColor: theme.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
  },
  labelMuted: {
    color: theme.textFaint,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  labelOnEmber: {
    color: ON_EMBER,
  },
  labelEmber: {
    color: theme.ember,
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
  },
  metaOnEmber: {
    color: 'rgba(26, 15, 8, 0.7)',
  },
  metaEmber: {
    color: theme.textDim,
  },
});
