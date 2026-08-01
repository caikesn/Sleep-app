import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Chips from '../components/Chips';
import SelectRow from '../components/SelectRow';
import { theme, space } from '../theme';
import {
  CATEGORIES,
  categoryName,
  filterSteps,
  groupByCategory,
  levelName,
  stepCatalog,
  stepsMinutes,
} from '../routineData';
import type { RoutineStep, StepCategory } from '../routineData';
import type { ModulesStackParamList, RootStackParamList } from '../navigation';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<ModulesStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

function length(seconds: number): string {
  return seconds >= 60 ? `${Math.round(seconds / 60)}m` : `${seconds}s`;
}

export default function StretchLibraryScreen() {
  const navigation = useNavigation<Nav>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<StepCategory | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function start(steps: RoutineStep[], title: string) {
    navigation.navigate('Session', { steps, title });
  }

  const visible = filterSteps({ category });
  const groups = groupByCategory(visible);
  // Catalog order, not tap order: a sequence should run down the body the way
  // the library is laid out, whatever order you happened to pick things in.
  const chosen = stepCatalog.filter((step) => selected.has(step.id));
  const count = chosen.length;

  // Nothing picked and no category is the one case with no sensible default:
  // "start all" used to mean eight stretches and now means thirty.
  const runnable = count > 0 ? chosen : category ? visible : [];
  const label =
    count > 0
      ? `Start ${count} stretch${count > 1 ? 'es' : ''}`
      : category
        ? `Start ${categoryName(category)}`
        : 'Pick a stretch or two';

  const title =
    count === 1
      ? chosen[0].name
      : count > 1
        ? `Sequence of ${count}`
        : category
          ? categoryName(category)
          : 'Stretches';

  return (
    <Screen
      title="Stretches"
      action={{ label: 'Back', onPress: () => navigation.goBack() }}
      footer={
        <Button
          label={label}
          meta={runnable.length > 0 ? `· ${stepsMinutes(runnable)} min` : undefined}
          disabled={runnable.length === 0}
          onPress={() => start(runnable, title)}
        />
      }
    >
      <Text style={styles.subtitle}>
        {stepCatalog.length} stretches. Pick the ones you want tonight, or filter to a part of the
        body and start the lot.
      </Text>

      <Chips options={CATEGORIES} value={category} onChange={setCategory} allLabel="Everything" />

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {groups.map((group) => (
          <View key={group.category}>
            {/* Headings only earn their space when more than one group is shown;
                filtered to a category, the chip above already says which. */}
            {groups.length > 1 && <Text style={styles.groupLabel}>{group.name}</Text>}
            {group.steps.map((step) => (
              <SelectRow
                key={step.id}
                label={step.name}
                icon={step.icon}
                selected={selected.has(step.id)}
                onPress={() => toggle(step.id)}
                // Gentle is the baseline here, and tagging two thirds of the
                // list with it would be noise rather than information.
                tag={step.level === 'gentle' ? undefined : levelName(step.level)}
                meta={length(step.seconds)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: theme.textDim,
    fontSize: 15,
    marginBottom: space.md,
    lineHeight: 21,
  },
  groupLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: space.md,
    marginBottom: space.sm,
  },
  list: {
    paddingTop: space.md,
    paddingBottom: space.md,
  },
});
