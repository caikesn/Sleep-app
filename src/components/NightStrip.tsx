import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { theme, space, radius } from '../theme';
import { type Weekday, NIGHT_INITIALS, NIGHT_LABELS } from '../reminders';

/**
 * Which nights a reminder fires on — seven toggles, Sunday first.
 *
 * Sunday-first is not the arbitrary choice it looks like: "weeknights" for a
 * bedtime reminder means Sunday through Thursday, so a Sunday-first strip draws
 * that preset as the first five lit and the last two dark. Monday-first splits
 * it across both ends and it stops being readable at a glance.
 *
 * Deliberately not the same component as `WeekStrip`. That one reports seven
 * nights of history and cannot be tapped; this one is a control. They look
 * alike on purpose and share nothing, because the day one of them grows a
 * feature the other must not follow is the day a merged version breaks both.
 */
export default function NightStrip({
  value,
  onToggle,
  disabled,
}: {
  value: Weekday[];
  onToggle: (night: Weekday) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.strip}>
      {NIGHT_INITIALS.map((initial, index) => {
        const night = index as Weekday;
        const on = value.includes(night);

        return (
          <Pressable
            key={night}
            onPress={() => onToggle(night)}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled }}
            // Two Saturdays' worth of "S" and three "T"s — the initials alone
            // are ambiguous to anyone who cannot see the row's shape.
            accessibilityLabel={NIGHT_LABELS[night]}
            style={({ pressed }) => [
              styles.night,
              on && styles.nightOn,
              disabled && styles.nightDisabled,
              pressed && !disabled && styles.pressed,
            ]}
          >
            <Text style={[styles.label, on && styles.labelOn, disabled && styles.labelDisabled]}>
              {initial}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    gap: space.xs,
  },
  night: {
    flex: 1,
    // Taller than it needs to look, because this is tapped in the dark without
    // looking, and the seven targets sit right next to each other.
    height: 40,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    backgroundColor: theme.bgRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nightOn: {
    backgroundColor: theme.emberDeep,
    borderColor: theme.ember,
  },
  nightDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    color: theme.textFaint,
    fontSize: 13,
    fontWeight: '700',
  },
  labelOn: {
    // Near-white rather than the ember text used elsewhere: on the filled
    // ember-deep pill, ember-on-ember is the invisible-disabled-button bug the
    // design system already had once.
    color: theme.text,
  },
  labelDisabled: {
    color: theme.textFaint,
  },
});
