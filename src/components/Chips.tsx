import React from 'react';
import { Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { theme, space, radius } from '../theme';

/**
 * A single row of filter pills that scrolls sideways.
 *
 * `null` is the unfiltered state and always sits first, so "everything" is one
 * tap away from wherever you've scrolled to rather than needing a scroll back.
 */

type Props<T extends string> = {
  options: { id: T; name: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  allLabel?: string;
};

export default function Chips<T extends string>({
  options,
  value,
  onChange,
  allLabel = 'All',
}: Props<T>) {
  const entries: { id: T | null; name: string }[] = [{ id: null, name: allLabel }, ...options];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // The row is full-bleed inside a padded screen, so a chip scrolled to the
      // edge doesn't look clipped against the margin.
      style={styles.strip}
      contentContainerStyle={styles.content}
    >
      {entries.map((entry) => {
        const active = entry.id === value;
        return (
          <Pressable
            key={entry.id ?? '__all__'}
            onPress={() => onChange(entry.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {entry.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: -space.lg,
    // Both are needed. Without flexShrink the strip is squeezed to a sliver
    // whenever it sits beside a flex:1 list — which is exactly how the stretch
    // library uses it, and it rendered as 20pt of clipped chip tops.
    flexGrow: 0,
    flexShrink: 0,
  },
  content: {
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.emberVeil,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  chipActive: {
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
