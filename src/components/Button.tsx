import React from 'react';
import { Text, StyleSheet, Pressable, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { theme, space, radius } from '../theme';

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

  // A disabled primary drops its fill rather than fading it. Near-black text on
  // ember at 40% opacity is near-black on near-black — the label vanished
  // completely on the routine builder's empty state.
  const muted = variant === 'primary' && !!disabled && !busy;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
      accessibilityState={{ disabled: !!inert }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        variant === 'quiet' && styles.quiet,
        pressed && !inert && styles.pressed,
        inert && !muted && styles.disabled,
        muted && styles.primaryDisabled,
        style,
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
    </Pressable>
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
  pressed: {
    opacity: 0.85,
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
