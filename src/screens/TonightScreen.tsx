import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { theme, space, radius } from '../theme';
import { builtinRoutine, resolveSteps, routineMinutes } from '../routineData';
import { loadActiveRoutine, refreshActiveRoutine } from '../routines';
import type { SavedRoutine } from '../routines';
import { loadCachedSettings, loadSettings } from '../storage';
import { loadProgress } from '../sessions';
import type { BadgeState } from '../achievements';
import type { TabScreenNavigation } from '../navigation';

function formatTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function TonightScreen() {
  const navigation = useNavigation<TabScreenNavigation>();
  const [reminder, setReminder] = useState<{ hour: number; minute: number; enabled: boolean } | null>(
    null
  );
  const [streak, setStreak] = useState(0);
  const [earned, setEarned] = useState<BadgeState | null>(null);
  const [routine, setRoutine] = useState<SavedRoutine>(builtinRoutine);

  // Paint from cache immediately so switching tabs never waits on the network,
  // then reconcile with the server in the background — otherwise a fresh
  // install or a second device would show "Anytime" despite a saved reminder.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadCachedSettings().then((s) => active && setReminder(s));
      loadSettings().then((s) => active && setReminder(s));
      // Same two-step for tonight's routine, so switching it in Modules is
      // reflected here the instant you come back.
      loadActiveRoutine().then((r) => active && setRoutine(r));
      refreshActiveRoutine().then((r) => active && setRoutine(r));
      // Refetched on focus so finishing a routine updates the streak — and
      // announces any badge it just earned — the moment you land back here.
      loadProgress().then((p) => {
        if (!active) return;
        setStreak(p.stats.streak);
        // Last in catalog order when several land at once — the hardest one
        // earned, rather than whichever happened to be checked first.
        setEarned(p.unseen[p.unseen.length - 1] ?? null);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const steps = resolveSteps(routine.stepIds);
  const totalMinutes = routineMinutes(routine.stepIds);

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.eyebrowRow}>
          <Text style={styles.eyebrow}>TONIGHT</Text>
          {streak > 0 && (
            <Text style={styles.streak}>
              {streak} night{streak > 1 ? 's' : ''} in a row
            </Text>
          )}
        </View>
        {reminder?.enabled ? (
          <>
            <Text style={styles.time}>{formatTime(reminder.hour, reminder.minute)}</Text>
            <Text style={styles.heroCaption}>wind-down begins</Text>
          </>
        ) : (
          <>
            <Text style={styles.time}>Anytime</Text>
            <Text style={styles.heroCaption}>no reminder set — start whenever you're ready</Text>
          </>
        )}
      </View>

      {earned && (
        <Pressable
          style={styles.earnedCard}
          // Named explicitly rather than just switching tabs: the You stack may
          // have been left sitting on Settings, and a badge card must land on
          // the badge case.
          onPress={() => navigation.navigate('You', { screen: 'Progress' })}
        >
          <View style={styles.earnedIcon}>
            <Icon name={earned.icon} size={20} color={theme.ember} />
          </View>
          <View style={styles.earnedText}>
            <Text style={styles.earnedEyebrow}>NEW ACHIEVEMENT</Text>
            <Text style={styles.earnedName}>{earned.name}</Text>
          </View>
          <Icon name="chevron" size={18} color={theme.ember} />
        </Pressable>
      )}

      <Button
        label="Start routine"
        meta={`· ${totalMinutes} min`}
        disabled={steps.length === 0}
        onPress={() => navigation.navigate('Session', { steps, title: routine.name })}
      />

      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>WHAT'S IN IT</Text>
        {/* The routine's name doubles as the way to change it — a separate
            "Change" link would say less in the same space. */}
        <Pressable
          style={styles.changeRow}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Tonight's routine: ${routine.name}. Change it.`}
          onPress={() => navigation.navigate('Modules', { screen: 'Routines' })}
        >
          <Text style={styles.changeText} numberOfLines={1}>
            {routine.name}
          </Text>
          <Icon name="chevron" size={14} color={theme.ember} />
        </Pressable>
      </View>
      <View style={styles.stepList}>
        {steps.map((step, index) => (
          // Keyed by position: a custom routine may use the same stretch twice.
          <View key={`${step.id}-${index}`} style={styles.stepRow}>
            <View style={styles.stepIcon}>
              <Icon name={step.icon} size={17} color={theme.ember} />
            </View>
            <Text style={styles.stepName}>{step.name}</Text>
            <Text style={styles.stepTime}>
              {step.seconds >= 60 ? `${Math.round(step.seconds / 60)}m` : `${step.seconds}s`}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  eyebrow: {
    color: theme.ember,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  streak: {
    color: theme.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  time: {
    color: theme.text,
    fontSize: 52,
    fontWeight: '300',
    letterSpacing: -1,
  },
  heroCaption: {
    color: theme.textDim,
    fontSize: 14,
    marginTop: space.xs,
  },
  earnedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.emberVeil,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.emberEdge,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.md,
  },
  earnedIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: theme.emberGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  earnedText: {
    flex: 1,
  },
  earnedEyebrow: {
    color: theme.ember,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  earnedName: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 1,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  sectionLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    // Keeps a long routine name from pushing the chevron off the row.
    flexShrink: 1,
  },
  changeText: {
    color: theme.ember,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  stepList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.cardBorder,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.cardBorder,
  },
  stepIcon: {
    width: 28,
  },
  stepName: {
    flex: 1,
    color: theme.text,
    fontSize: 15,
  },
  stepTime: {
    color: theme.textDim,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
