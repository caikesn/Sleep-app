import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { theme, space, radius } from '../theme';
import { BUILTIN_ROUTINE_ID, builtinRoutine, routineMinutes, resolveSteps } from '../routineData';
import {
  loadCachedRoutines,
  listRoutines,
  getActiveRoutineId,
  setActiveRoutine,
  deleteRoutine,
} from '../routines';
import type { SavedRoutine } from '../routines';
import type { ModulesStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<ModulesStackParamList>;

function summarise(routine: SavedRoutine): string {
  const count = resolveSteps(routine.stepIds).length;
  if (count === 0) return 'no steps yet';
  return `${count} step${count === 1 ? '' : 's'} · ${routineMinutes(routine.stepIds)} min`;
}

/**
 * One whole-row press target, like `SelectRow`. Tucking an Edit button inside
 * the row would put a pressable inside a pressable, which is the exact bug the
 * stretch list was rebuilt to get rid of — editing lives in the footer instead,
 * acting on whichever routine is selected.
 */
function RoutineRow({
  routine,
  selected,
  builtin,
  onPress,
}: {
  routine: SavedRoutine;
  selected: boolean;
  builtin: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${routine.name}, ${summarise(routine)}`}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.rowIcon, selected && styles.rowIconSelected]}>
        <Icon
          name={builtin ? 'tonight' : 'routines'}
          size={19}
          color={selected ? theme.ember : theme.textFaint}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {routine.name}
        </Text>
        <Text style={styles.rowMeta}>
          {summarise(routine)}
          {builtin ? ' · built in' : ''}
        </Text>
      </View>
      {selected && <Icon name="check" size={18} color={theme.ember} />}
    </Pressable>
  );
}

export default function RoutinesScreen() {
  const navigation = useNavigation<Nav>();
  const [saved, setSaved] = useState<SavedRoutine[]>([]);
  const [activeId, setActiveId] = useState(BUILTIN_ROUTINE_ID);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Refetched on focus so a routine created or deleted in the builder is
  // reflected the moment you come back to this list.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Coming back to the screen is as good as changing your mind: an armed
      // delete must never survive a trip away and fire on the next stray tap.
      setConfirmingDelete(false);
      loadCachedRoutines().then((rows) => active && setSaved(rows));
      getActiveRoutineId().then((id) => active && setActiveId(id));
      listRoutines().then((rows) => active && setSaved(rows));
      return () => {
        active = false;
      };
    }, [])
  );

  const all = [builtinRoutine, ...saved];
  const selected = all.find((routine) => routine.id === activeId) ?? builtinRoutine;
  const isBuiltin = selected.id === BUILTIN_ROUTINE_ID;

  function choose(id: string) {
    setActiveId(id);
    // Disarming on every pick, so a confirm armed for one routine can't be
    // spent on whichever one is selected by the time the second tap lands.
    setConfirmingDelete(false);
    void setActiveRoutine(id);
  }

  async function remove() {
    const id = selected.id;
    if (id === BUILTIN_ROUTINE_ID) return;

    setConfirmingDelete(false);
    await deleteRoutine(id);
    // `deleteRoutine` falls back to the built-in when it deletes tonight's
    // pick, so the selection is read back rather than assumed.
    setSaved(await loadCachedRoutines());
    setActiveId(await getActiveRoutineId());
  }

  return (
    <Screen
      title="Routines"
      action={{ label: 'Back', onPress: () => navigation.goBack() }}
      footer={
        <View style={styles.footer}>
          <Button
            variant="quiet"
            // The built-in can't be edited, but copying it is a far better start
            // than an empty list — most custom routines are the default minus a
            // step or two.
            label={isBuiltin ? 'Duplicate to edit' : `Edit ${selected.name}`}
            onPress={() =>
              navigation.navigate('RoutineBuilder', {
                routineId: selected.id,
                duplicate: isBuiltin,
              })
            }
          />
          {/* Deleting used to live only at the bottom of the builder, below the
              whole thirty-stretch add list — reachable, but nobody scrolls that
              far to throw something away. It belongs next to the routine it
              acts on. The built-in has no row to delete, so it gets no button. */}
          {!isBuiltin && (
            <Pressable
              // Two taps rather than a dialog, matching the builder:
              // react-native-web has no Alert, and an inline confirm behaves
              // the same on every platform.
              onPress={() => (confirmingDelete ? void remove() : setConfirmingDelete(true))}
              accessibilityRole="button"
              accessibilityLabel={
                confirmingDelete
                  ? `Confirm delete ${selected.name}`
                  : `Delete ${selected.name}`
              }
              style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]}
            >
              <Icon name="trash" size={16} color={theme.danger} />
              <Text style={styles.deleteText} numberOfLines={1}>
                {confirmingDelete ? 'Tap again to delete' : `Delete ${selected.name}`}
              </Text>
            </Pressable>
          )}
        </View>
      }
    >
      <Text style={styles.subtitle}>
        Pick the one you want tonight — the start button on Tonight runs it.
      </Text>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {all.map((routine) => (
          <RoutineRow
            key={routine.id}
            routine={routine}
            selected={routine.id === selected.id}
            builtin={routine.id === BUILTIN_ROUTINE_ID}
            onPress={() => choose(routine.id)}
          />
        ))}

        <Pressable
          onPress={() => navigation.navigate('RoutineBuilder', {})}
          accessibilityRole="button"
          style={({ pressed }) => [styles.newRow, pressed && styles.pressed]}
        >
          <Icon name="plus" size={18} color={theme.ember} />
          <Text style={styles.newText}>New routine</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: theme.textDim,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: space.lg,
  },
  list: {
    paddingBottom: space.md,
  },
  footer: {
    gap: space.xs,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.sm + 2,
  },
  deleteText: {
    // Shrinkable so a long routine name truncates instead of shoving the icon
    // off the row.
    flexShrink: 1,
    color: theme.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: theme.emberVeil,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm + 4,
  },
  rowSelected: {
    borderColor: theme.ember,
    backgroundColor: theme.emberGlow,
  },
  pressed: {
    opacity: 0.75,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bgRaised,
  },
  rowIconSelected: {
    backgroundColor: theme.emberGlow,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    // Full brightness whether or not it's selected. The border, the tinted icon
    // and the check already carry the selection; dimming the name on top of
    // that made a list of your own routines read as disabled.
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
  },
  rowMeta: {
    color: theme.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.emberEdge,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    marginTop: space.xs,
  },
  newText: {
    color: theme.ember,
    fontSize: 15,
    fontWeight: '700',
  },
});
