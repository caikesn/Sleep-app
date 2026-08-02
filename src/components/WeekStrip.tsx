import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from './Icon';
import { theme, space, radius } from '../theme';
import { lastNights, nightDate } from '../streak';

/** Seven nights is the span people actually hold in their head. */
export const WEEK_LENGTH = 7;

/**
 * The last seven nights, lit or not.
 *
 * Shared rather than duplicated: it closes the Tonight screen and opens the You
 * screen, and two copies of a seven-dot row would have drifted the first time
 * one of them was nudged.
 */
export default function WeekStrip({ nights }: { nights: Set<string> }) {
  const keys = lastNights(WEEK_LENGTH);
  const tonight = keys[keys.length - 1];

  return (
    <View style={styles.week}>
      {keys.map((key) => {
        const done = nights.has(key);
        return (
          <View key={key} style={styles.weekDay}>
            <View style={[styles.dot, done && styles.dotDone, key === tonight && styles.dotTonight]}>
              {done && <Icon name="check" size={13} color={theme.bg} />}
            </View>
            <Text style={[styles.weekLabel, done && styles.weekLabelDone]}>
              {nightDate(key).toLocaleDateString([], { weekday: 'narrow' })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  weekDay: {
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: theme.ember,
    borderColor: theme.ember,
  },
  dotTonight: {
    borderWidth: 1.5,
    borderColor: theme.ember,
  },
  weekLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '600',
    marginTop: space.xs + 2,
  },
  weekLabelDone: {
    color: theme.textDim,
  },
});
