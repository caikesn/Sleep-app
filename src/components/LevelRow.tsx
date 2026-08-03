import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { theme, space, radius } from '../theme';

/**
 * A short, fixed set of levels laid out as one row of equal pills.
 *
 * Not `Chips`: that row scrolls, carries an "All" entry and sizes each pill to
 * its label, all of which suit a filter over thirty stretches and none of which
 * suit four settings that go from least to most. Here the row is the scale, so
 * every pill is the same width and the order on screen is the order of the
 * values — a pill that was wider because its word was longer would read as more.
 *
 * Tappable steps rather than a drag handle, on purpose. This is set in a dark
 * room, often by someone already lying down, and a thumb that misses a target
 * by 8pt hits the next level instead of setting 43%. It also matches the
 * soundscape volume steps, so the app has one idea of what a level control is.
 */

type Props<T extends string> = {
  options: readonly { id: T; name: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for a screen reader — "Screen dim", not four loose pills. */
  label: string;
};

export default function LevelRow<T extends string>({ options, value, onChange, label }: Props<T>) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.name}
            style={({ pressed }) => [
              styles.pill,
              active && styles.pillActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {option.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.sm,
  },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.emberVeil,
    borderRadius: radius.pill,
    paddingVertical: space.sm + 2,
    alignItems: 'center',
  },
  pillActive: {
    borderColor: theme.ember,
    backgroundColor: theme.emberGlow,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    color: theme.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    color: theme.ember,
  },
});
