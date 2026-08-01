import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { theme, space, radius } from '../theme';
import { defaultRoutine } from '../routineData';
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

  // Paint from cache immediately so switching tabs never waits on the network,
  // then reconcile with the server in the background — otherwise a fresh
  // install or a second device would show "Anytime" despite a saved reminder.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadCachedSettings().then((s) => active && setReminder(s));
      loadSettings().then((s) => active && setReminder(s));
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

  const totalMinutes = Math.round(defaultRoutine.reduce((sum, s) => sum + s.seconds, 0) / 60);

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
        <Pressable style={styles.earnedCard} onPress={() => navigation.navigate('You')}>
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
        onPress={() =>
          navigation.navigate('Session', { steps: defaultRoutine, title: 'Night Routine' })
        }
      />

      <Text style={styles.sectionLabel}>WHAT'S IN IT</Text>
      <View style={styles.stepList}>
        {defaultRoutine.map((step) => (
          <View key={step.id} style={styles.stepRow}>
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
  sectionLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: space.xl,
    marginBottom: space.sm,
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
