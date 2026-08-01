import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Chips from '../components/Chips';
import Field from '../components/Field';
import Icon from '../components/Icon';
import { theme, space, radius } from '../theme';
import {
  BUILTIN_ROUTINE_ID,
  CATEGORIES,
  MAX_ROUTINE_NAME,
  builtinRoutine,
  cleanRoutineName,
  filterSteps,
  groupByCategory,
  levelName,
  moveStep,
  removeStep,
  resolveSteps,
  routineMinutes,
} from '../routineData';
import type { RoutineStep, StepCategory } from '../routineData';
import {
  createRoutine,
  deleteRoutine,
  loadCachedRoutines,
  saveRoutine,
  setActiveRoutine,
} from '../routines';
import type { ModulesStackParamList } from '../navigation';

type Props = NativeStackScreenProps<ModulesStackParamList, 'RoutineBuilder'>;

function length(seconds: number): string {
  return seconds >= 60 ? `${Math.round(seconds / 60)}m` : `${seconds}s`;
}

/** A small square control. Disabled arrows stay in place so rows never reflow. */
function Control({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'up' | 'down' | 'close';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.control, pressed && !disabled && styles.pressed]}
    >
      <Icon name={icon} size={16} color={disabled ? theme.textFaint : theme.textDim} />
    </Pressable>
  );
}

function StepRow({
  step,
  index,
  last,
  onMove,
  onRemove,
}: {
  step: RoutineStep;
  index: number;
  last: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepIndex}>{index + 1}</Text>
      <Icon name={step.icon} size={18} color={theme.ember} />
      <View style={styles.stepText}>
        <Text style={styles.stepName} numberOfLines={1}>
          {step.name}
        </Text>
        <Text style={styles.stepMeta}>{length(step.seconds)}</Text>
      </View>
      <Control
        icon="up"
        label={`Move ${step.name} earlier`}
        onPress={() => onMove(-1)}
        disabled={index === 0}
      />
      <Control
        icon="down"
        label={`Move ${step.name} later`}
        onPress={() => onMove(1)}
        disabled={last}
      />
      <Control icon="close" label={`Remove ${step.name}`} onPress={onRemove} />
    </View>
  );
}

export default function RoutineBuilderScreen({ route, navigation }: Props) {
  const { routineId, duplicate } = route.params ?? {};
  const editing = !!routineId && !duplicate && routineId !== BUILTIN_ROUTINE_ID;

  const [name, setName] = useState('');
  const [stepIds, setStepIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [category, setCategory] = useState<StepCategory | null>(null);

  // The id to save under, fixed once. Held in a ref rather than state because
  // re-running the effect must never mint a second id for the same edit.
  const idRef = useRef<string | null>(null);

  // Deliberately not `useFocusEffect`: reloading on focus would throw away
  // everything typed so far the moment the screen is returned to.
  useEffect(() => {
    let active = true;

    (async () => {
      if (!routineId) {
        idRef.current = createRoutine('', []).id;
        if (active) setReady(true);
        return;
      }

      const source =
        routineId === BUILTIN_ROUTINE_ID
          ? builtinRoutine
          : (await loadCachedRoutines()).find((r) => r.id === routineId) ?? builtinRoutine;

      if (!active) return;
      // A duplicate takes a fresh id, so saving it can never overwrite what it
      // was copied from.
      idRef.current = duplicate ? createRoutine('', []).id : source.id;
      setName(duplicate ? `${source.name} copy` : source.name);
      setStepIds(source.stepIds);
      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, [routineId, duplicate]);

  const steps = resolveSteps(stepIds);
  const minutes = routineMinutes(stepIds);
  const addGroups = groupByCategory(filterSteps({ category }));

  async function save() {
    const id = idRef.current;
    if (!id || stepIds.length === 0) return;

    await saveRoutine({
      id,
      name: cleanRoutineName(name),
      stepIds,
      updatedAt: new Date().toISOString(),
    });

    // A routine you just built is almost certainly the one you want tonight.
    // Editing an existing one says nothing about which to run, so it's left be.
    if (!editing) await setActiveRoutine(id);
    navigation.goBack();
  }

  async function remove() {
    if (!editing || !routineId) return;
    await deleteRoutine(routineId);
    navigation.goBack();
  }

  // Rendering before the source routine is read would flash an empty builder and
  // then fill in — the one frame a screenshot is most likely to catch.
  if (!ready) {
    return (
      <Screen>
        <View />
      </Screen>
    );
  }

  return (
    <Screen
      title={editing ? 'Edit routine' : 'New routine'}
      action={{ label: 'Cancel', onPress: () => navigation.goBack() }}
      footer={
        <Button
          label="Save routine"
          meta={stepIds.length > 0 ? `· ${stepIds.length} steps · ${minutes} min` : undefined}
          disabled={stepIds.length === 0}
          onPress={save}
        />
      }
    >
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Field
          label="NAME"
          value={name}
          onChangeText={setName}
          placeholder="Wind-down"
          maxLength={MAX_ROUTINE_NAME}
          autoCapitalize="sentences"
          returnKeyType="done"
        />

        <Text style={styles.sectionLabel}>STEPS</Text>
        {steps.length === 0 ? (
          <Text style={styles.empty}>
            Nothing here yet. Add a step or two from the list below — you can reorder them
            afterwards.
          </Text>
        ) : (
          steps.map((step, index) => (
            <StepRow
              // Position, not id: the same stretch may appear more than once.
              key={`${step.id}-${index}`}
              step={step}
              index={index}
              last={index === steps.length - 1}
              onMove={(delta) => setStepIds((ids) => moveStep(ids, index, delta))}
              onRemove={() => setStepIds((ids) => removeStep(ids, index))}
            />
          ))
        )}

        <Text style={styles.sectionLabel}>ADD A STEP</Text>
        <Chips
          options={CATEGORIES}
          value={category}
          onChange={setCategory}
          allLabel="Everything"
        />
        {addGroups.map((group) => (
          <View key={group.category}>
            {addGroups.length > 1 && <Text style={styles.groupLabel}>{group.name}</Text>}
            {group.steps.map((step) => (
              <Pressable
                key={step.id}
                onPress={() => setStepIds((ids) => [...ids, step.id])}
                accessibilityRole="button"
                accessibilityLabel={`Add ${step.name}, ${length(step.seconds)}`}
                style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
              >
                <Icon name={step.icon} size={18} color={theme.textDim} />
                <Text style={styles.addName} numberOfLines={1}>
                  {step.name}
                </Text>
                {step.level !== 'gentle' && (
                  <Text style={styles.addTag}>{levelName(step.level)}</Text>
                )}
                <Text style={styles.addMeta}>{length(step.seconds)}</Text>
                <Icon name="plus" size={16} color={theme.ember} />
              </Pressable>
            ))}
          </View>
        ))}

        {editing && (
          <Pressable
            // Two taps rather than a dialog: react-native-web has no Alert, and
            // an inline confirm behaves the same on every platform.
            onPress={() => (confirmingDelete ? void remove() : setConfirmingDelete(true))}
            accessibilityRole="button"
            style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]}
          >
            <Icon name="trash" size={16} color={theme.danger} />
            <Text style={styles.deleteText}>
              {confirmingDelete ? 'Tap again to delete' : 'Delete routine'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingBottom: space.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  sectionLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  empty: {
    color: theme.textFaint,
    fontSize: 14,
    lineHeight: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    backgroundColor: theme.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    borderRadius: radius.md,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md - 2,
    marginBottom: space.sm,
  },
  stepIndex: {
    width: 16,
    color: theme.textFaint,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  stepText: {
    flex: 1,
  },
  stepName: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  stepMeta: {
    color: theme.textFaint,
    fontSize: 11,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  control: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: theme.bgRaised,
  },
  groupLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.cardBorder,
    paddingVertical: space.md - 2,
  },
  addTag: {
    color: theme.textFaint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm - 2,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  addName: {
    flex: 1,
    color: theme.textDim,
    fontSize: 15,
  },
  addMeta: {
    color: theme.textFaint,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.xl,
    paddingVertical: space.md,
  },
  deleteText: {
    color: theme.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
