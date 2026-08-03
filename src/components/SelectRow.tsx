import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { theme, space, radius } from '../theme';
import Icon, { IconName } from './Icon';
import Pose from './Pose';
import type { PoseName } from '../poseArt';

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
  /** Small qualifier before the meta, e.g. how deep a stretch goes. */
  tag?: string;
  /**
   * A figure in the pose, drawn instead of the icon.
   *
   * Browsing a catalog of thirty stretches is one of the two moments the shape
   * of a pose matters — the other is doing it — so the library passes this and
   * the denser, reorderable lists keep the icon.
   */
  pose?: PoseName;
};

export default function SelectRow({ label, icon, selected, onPress, meta, tag, pose }: Props) {
  const spoken = [label, tag, meta].filter(Boolean).join(', ');
  const tint = selected ? theme.ember : theme.textDim;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      accessibilityLabel={spoken}
      style={({ pressed }) => [
        styles.pill,
        // A figure is nearly twice the height of an icon, so the row gives back
        // what it takes and ends up the same height it always was.
        pose && styles.pillWithPose,
        selected && styles.pillSelected,
        pressed && styles.pressed,
      ]}
    >
      {pose ? (
        <Pose name={pose} size={34} color={tint} />
      ) : (
        <Icon name={icon} size={19} color={tint} />
      )}
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {tag && <Text style={styles.tag}>{tag}</Text>}
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
    // Tighter than the usual md so a name, a level tag and a duration all fit
    // on one line — "Thread the Needle" was truncating at 16.
    gap: space.sm + 2,
    backgroundColor: theme.emberVeil,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.sm + 4,
  },
  pillWithPose: {
    paddingVertical: space.sm + 2,
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
  tag: {
    color: theme.textFaint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
    // Required on web, or the border ignores the radius on a Text node.
    overflow: 'hidden',
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
