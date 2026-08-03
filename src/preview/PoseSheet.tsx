import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Pose from '../components/Pose';
import { CATEGORIES, groupByCategory, stepCatalog, stepLength } from '../routineData';
import { theme, space } from '../theme';

/**
 * Every figure, side by side. Preview-only — nothing in the app imports this.
 *
 *   http://localhost:8081/?preview=poses
 *   npm run shoot -- poses
 *
 * The one check the real screens cannot give you. A drawing looks fine on its
 * own and wrong next to twenty-nine others: heads a size apart, one figure
 * standing taller than the rest, a stroke that reads heavy because the pose has
 * more of them in it. Scale and weight drift is only visible in a grid, so
 * there is a grid.
 *
 * The small row at the bottom is the other half of it — these are drawn at 34pt
 * in the library and 132pt in a session, and a pose that reads at one size and
 * turns to soup at the other is a pose that needs fewer joints in it.
 */

const LARGE = 92;
const SMALL = 34;

export default function PoseSheet() {
  const groups = groupByCategory(stepCatalog);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {groups.map((group) => (
        <View key={group.category}>
          <Text style={styles.heading}>
            {CATEGORIES.find((c) => c.id === group.category)?.name ?? group.name}
          </Text>
          <View style={styles.grid}>
            {group.steps.map((step) => (
              <View key={step.id} style={styles.cell}>
                <Pose name={step.pose} size={LARGE} />
                <Text style={styles.name} numberOfLines={1}>
                  {step.name}
                </Text>
                <Text style={styles.meta}>{stepLength(step)}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.heading}>At library size</Text>
      <View style={styles.strip}>
        {stepCatalog.map((step) => (
          <Pose key={step.id} name={step.pose} size={SMALL} color={theme.textDim} />
        ))}
      </View>

      <Text style={styles.heading}>Mirrored, as the second side is drawn</Text>
      <View style={styles.strip}>
        {stepCatalog
          .filter((step) => step.perSide)
          .map((step) => (
            <View key={step.id} style={styles.pair}>
              <Pose name={step.pose} size={SMALL + 12} />
              <Pose name={step.pose} size={SMALL + 12} flip color={theme.ember} />
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: space.md, paddingBottom: space.xxl },
  heading: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.33%', alignItems: 'center', marginBottom: space.md },
  name: { color: theme.textDim, fontSize: 10, marginTop: 2, maxWidth: '100%' },
  meta: { color: theme.textFaint, fontSize: 10 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: space.sm,
    // A hairline between the pairs, or twelve figures in a row read as one
    // sequence rather than as six before-and-afters.
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.cardBorder,
    paddingRight: space.sm,
  },
});
