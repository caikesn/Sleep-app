import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import Screen from '../components/Screen';
import { theme, space, radius } from '../theme';
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

  const selectedCount = selected.size;

  return (
    <Screen title="Stretches" action={{ label: 'Back', onPress: () => navigation.goBack() }}>
      <Text style={styles.subtitle}>Tap a stretch to start it alone, or check a few to build a sequence.</Text>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {defaultRoutine.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <Pressable key={item.id} style={styles.row} onPress={() => start([item], item.name)}>
              <Pressable
                style={[styles.checkbox, isSelected && styles.checkboxChecked]}
                onPress={() => toggle(item.id)}
                hitSlop={10}
              >
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
              <Text style={styles.rowEmoji}>{item.emoji}</Text>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSeconds}>{item.seconds}s</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedCount > 0 && (
        <Pressable
          style={styles.startButton}
          onPress={() =>
            start(
              defaultRoutine.filter((s) => selected.has(s.id)),
              `Custom sequence (${selectedCount})`
            )
          }
        >
          <Text style={styles.startButtonText}>Start sequence ({selectedCount})</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: theme.textDim,
    fontSize: 14,
    marginBottom: space.md,
  },
  scrollContent: {
    paddingBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    padding: space.md - 2,
    marginBottom: space.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm - 2,
    borderWidth: 2,
    borderColor: theme.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md - 2,
  },
  checkboxChecked: {
    backgroundColor: theme.ember,
    borderColor: theme.ember,
  },
  checkmark: {
    color: '#1a0f08',
    fontSize: 15,
    fontWeight: '700',
  },
  rowEmoji: {
    fontSize: 24,
    marginRight: space.sm + 4,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSeconds: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  startButton: {
    marginVertical: space.sm,
    backgroundColor: theme.emberDeep,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#1a0f08',
    fontSize: 16,
    fontWeight: '700',
  },
});
