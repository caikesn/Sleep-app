import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../components/Screen';
import { theme, space, radius } from '../theme';
import { defaultRoutine } from '../routineData';
import { loadCachedSettings, loadSettings } from '../storage';
import type { RootStackParamList } from '../navigation';

function formatTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function TonightScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [reminder, setReminder] = useState<{ hour: number; minute: number; enabled: boolean } | null>(
    null
  );

  // Paint from cache immediately so switching tabs never waits on the network,
  // then reconcile with the server in the background — otherwise a fresh
  // install or a second device would show "Anytime" despite a saved reminder.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadCachedSettings().then((s) => active && setReminder(s));
      loadSettings().then((s) => active && setReminder(s));
      return () => {
        active = false;
      };
    }, [])
  );

  const totalMinutes = Math.round(defaultRoutine.reduce((sum, s) => sum + s.seconds, 0) / 60);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>TONIGHT</Text>
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

      <Pressable
        style={styles.startButton}
        onPress={() =>
          navigation.navigate('Session', { steps: defaultRoutine, title: 'Night Routine' })
        }
      >
        <Text style={styles.startButtonText}>Start routine</Text>
        <Text style={styles.startButtonMeta}>
          {defaultRoutine.length} steps · {totalMinutes} min
        </Text>
      </Pressable>

      <Text style={styles.sectionLabel}>WHAT'S IN IT</Text>
      <View style={styles.stepList}>
        {defaultRoutine.map((step, i) => (
          <View key={step.id} style={styles.stepRow}>
            <Text style={styles.stepIndex}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={styles.stepEmoji}>{step.emoji}</Text>
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
  eyebrow: {
    color: theme.ember,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: space.sm,
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
  startButton: {
    backgroundColor: theme.emberDeep,
    borderRadius: radius.lg,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#1a0f08',
    fontSize: 17,
    fontWeight: '700',
  },
  startButtonMeta: {
    color: 'rgba(26, 15, 8, 0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
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
  stepIndex: {
    color: theme.textFaint,
    fontSize: 12,
    fontWeight: '700',
    width: 26,
    fontVariant: ['tabular-nums'],
  },
  stepEmoji: {
    fontSize: 16,
    marginRight: space.sm,
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
