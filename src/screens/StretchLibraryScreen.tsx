import React, { useState } from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import Screen from '../components/Screen';
import Button from '../components/Button';
import SelectRow from '../components/SelectRow';
import { theme, space } from '../theme';
import { defaultRoutine, RoutineStep } from '../routineData';
import type { ModulesStackParamList, RootStackParamList } from '../navigation';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<ModulesStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function StretchLibraryScreen() {
  const navigation = useNavigation<Nav>();
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const chosen = defaultRoutine.filter((s) => selected.has(s.id));
  const count = chosen.length;

  const seconds = (count ? chosen : defaultRoutine).reduce((sum, s) => sum + s.seconds, 0);
  const minutes = Math.max(1, Math.round(seconds / 60));

  return (
    <Screen
      title="Stretches"
      action={{ label: 'Back', onPress: () => navigation.goBack() }}
      footer={
        <Button
          label={count ? `Start ${count} stretch${count > 1 ? 'es' : ''}` : 'Start all'}
          meta={`· ${minutes} min`}
          onPress={() =>
            count
              ? start(chosen, count === 1 ? chosen[0].name : `Sequence of ${count}`)
              : start(defaultRoutine, 'All stretches')
          }
        />
      }
    >
      <Text style={styles.subtitle}>
        Pick the ones you want tonight, or start the whole set.
      </Text>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {defaultRoutine.map((item) => (
          <SelectRow
            key={item.id}
            label={item.name}
            icon={item.icon}
            selected={selected.has(item.id)}
            onPress={() => toggle(item.id)}
            meta={item.seconds >= 60 ? `${Math.round(item.seconds / 60)}m` : `${item.seconds}s`}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: theme.textDim,
    fontSize: 15,
    marginBottom: space.lg,
    lineHeight: 21,
  },
  list: {
    paddingBottom: space.md,
  },
});
