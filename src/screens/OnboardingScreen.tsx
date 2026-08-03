import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { theme, space, type, gradients } from '../theme';
import { duration, easing, ENTER_RISE } from '../motion';
import { useReduceMotion } from '../reduceMotion';
import Button from '../components/Button';
import Flame from '../components/Flame';
import { loadActiveRoutine } from '../routines';
import { builtinRoutine } from '../routineData';
import { DEFAULT_REMINDERS } from '../reminders';
import { loadReminders, saveReminders } from '../storage';
import { applyReminder, ensurePermissions } from '../notifications';

/**
 * First run, once, after an account is created.
 *
 * Three screens rather than a tour: what the app is, when your evening starts,
 * and what is going to run tonight. The last two are the only two settings that
 * have to be right for night one to work, and both of them already have a
 * sensible default — so every screen here is skippable and none of them is a
 * question you have to answer.
 *
 * The red-light tutorial is deliberately not part of this. It is reachable from
 * Settings and from inside a session, and folding it in would make this four
 * screens for a tip that can wait until night two.
 */

const STEPS = 3;

/** The evening's default start, shown before the picker is touched. */
const DEFAULT_WIND_DOWN = DEFAULT_REMINDERS['wind-down'];

function timeToDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function formatTime(hour: number, minute: number): string {
  return timeToDate(hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function OnboardingScreen({ onDone }: { onDone?: () => void }) {
  const insets = useSafeAreaInsets();
  const stillFlame = useReduceMotion();

  const [step, setStep] = useState(0);
  const [hour, setHour] = useState(DEFAULT_WIND_DOWN.hour);
  const [minute, setMinute] = useState(DEFAULT_WIND_DOWN.minute);
  const [picking, setPicking] = useState(false);
  // Whatever Tonight would start right now. On a fresh account that is the
  // built-in, but it is read rather than assumed — an account created on a
  // device that already has routines cached should name the real one.
  const [routineName, setRoutineName] = useState(builtinRoutine.name);

  useEffect(() => {
    let active = true;
    loadActiveRoutine().then((routine) => {
      if (active) setRoutineName(routine.name);
    });
    return () => {
      active = false;
    };
  }, []);

  /**
   * Steps cross-fade in place: the flame and the footer stay put and only the
   * middle changes. Sliding whole pages sideways is a lot of movement for
   * someone who opened this at half past nine at night, and it would also drag
   * the picker across the screen mid-gesture.
   */
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: duration.enter,
      easing: easing.settle,
      useNativeDriver: true,
    }).start();
  }, [enter, step]);

  function goTo(next: number) {
    // The picker belongs to the step it sits on; leaving it open would hand the
    // next step a spinner it never asked for.
    setPicking(false);
    Animated.timing(enter, {
      toValue: 0,
      duration: duration.exit,
      easing: easing.settle,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setStep(next);
    });
  }

  /**
   * Writes the wind-down time on the way out of step two, not at the end.
   *
   * Someone who sets their evening and then skips the last screen has still
   * told us when their evening starts, and dropping it because they didn't
   * reach the final button would be throwing away the one thing they typed.
   *
   * The reminder is switched on only if the OS says yes. Enabling it against a
   * denied permission would leave Settings showing a reminder that cannot fire.
   */
  async function commitWindDown() {
    const granted = await ensurePermissions();
    const reminders = await loadReminders();
    const next = {
      ...reminders,
      'wind-down': { ...reminders['wind-down'], hour, minute, enabled: granted },
    };
    await saveReminders(next);
    await applyReminder(next['wind-down']);
  }

  function next() {
    if (step === 1) commitWindDown();
    if (step === STEPS - 1) {
      onDone?.();
      return;
    }
    goTo(step + 1);
  }

  const arriving = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [ENTER_RISE, 0] }) },
    ],
  };

  return (
    <LinearGradient colors={gradients.screen} style={styles.root}>
      <View style={[styles.content, { paddingTop: insets.top + space.md }]}>
        <View style={styles.header}>
          <Pressable onPress={onDone} style={styles.skip} hitSlop={8} accessibilityRole="button">
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <Animated.View style={[styles.body, arriving]}>
          {step === 0 && (
            <View style={styles.centred}>
              <Flame size={132} still={stillFlame} />
              <Text style={styles.line}>Lit at wind-down. Out by bed.</Text>
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={styles.heading}>When does your evening start?</Text>

              <Pressable
                onPress={() => setPicking((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel={`Wind-down time, ${formatTime(hour, minute)}`}
              >
                <Text style={styles.time}>{formatTime(hour, minute)}</Text>
              </Pressable>

              {/* iOS is an inline spinner and is worth showing unprompted here —
                  this screen exists to be answered. Android's is a dialog, so it
                  waits for the tap rather than opening over an arriving screen. */}
              {(Platform.OS === 'ios' || picking) && (
                <DateTimePicker
                  value={timeToDate(hour, minute)}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_event, date) => {
                    if (Platform.OS !== 'ios') setPicking(false);
                    if (!date) return;
                    setHour(date.getHours());
                    setMinute(date.getMinutes());
                  }}
                  themeVariant="dark"
                />
              )}
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.heading}>Tonight</Text>
              <Text style={styles.routine}>{routineName}</Text>
              <Text style={styles.line}>Change it anytime in Modules.</Text>
            </View>
          )}
        </Animated.View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no">
            {Array.from({ length: STEPS }, (_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
            ))}
          </View>
          <Button label={step === STEPS - 1 ? 'Start' : 'Continue'} onPress={next} />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: space.lg,
  },
  skip: {
    padding: space.sm,
  },
  skipText: {
    color: theme.textDim,
    fontSize: 15,
    fontWeight: '600',
  },
  /**
   * Centred vertically rather than sitting under the header: each step is a
   * single short thought, and hung from the top it reads as a page with its
   * content missing.
   */
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  centred: {
    alignItems: 'center',
  },
  heading: {
    ...type.title,
    color: theme.text,
    fontWeight: '300',
    letterSpacing: -0.5,
  },
  line: {
    color: theme.textDim,
    ...type.body,
    lineHeight: 22,
    marginTop: space.lg,
  },
  routine: {
    color: theme.ember,
    fontSize: 22,
    fontWeight: '600',
    marginTop: space.md,
  },
  time: {
    color: theme.text,
    fontSize: 44,
    fontWeight: '600',
    marginTop: space.md,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
    marginBottom: space.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.cardBorder,
  },
  dotOn: {
    backgroundColor: theme.ember,
  },
});
