import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { theme, space, radius } from '../theme';
import Icon, { IconName } from './Icon';

/**
 * A selectable pill: outlined icon, label, and a selected state that brightens
 * the *border* rather than adding a checkbox.
 *
 * Dropping the checkbox also removes a whole class of bug — the old row nested
 * a pressable checkbox inside a pressable row, which on React Native Web meant
 * the two competed for the tap. Here the entire pill is one target.
 */

type Props = {
  label: string;
  icon: IconName;
  selected?: boolean;
  onPress: () => void;
  /** Trailing text, e.g. a duration. */
  meta?: string;
};

export default function SelectRow({ label, icon, selected, onPress, meta }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
      style={({ pressed }) => [
        styles.pill,
        selected && styles.pillSelected,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={19} color={selected ? theme.ember : theme.textDim} />
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {meta && <Text style={styles.meta}>{meta}</Text>}
      {/* Balances the icon so the label sits optically centred when there's no meta. */}
      {!meta && <View style={styles.spacer} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: theme.emberVeil,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.sm + 4,
  },
  pillSelected: {
    borderColor: theme.ember,
    backgroundColor: theme.emberGlow,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    flex: 1,
    color: theme.textDim,
    fontSize: 16,
    fontWeight: '600',
  },
  labelSelected: {
    color: theme.text,
  },
  meta: {
    color: theme.textFaint,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  spacer: {
    width: 19,
  },
});
