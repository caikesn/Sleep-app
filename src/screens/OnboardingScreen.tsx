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
import LevelRow from '../components/LevelRow';
import { loadActiveRoutine } from '../routines';
import { builtinRoutine } from '../routineData';
import { DEFAULT_REMINDERS } from '../reminders';
import { loadCachedReminders, loadReminders, saveReminders } from '../storage';
import { applyReminder, ensurePermissions } from '../notifications';
import { type DimLevel, DEFAULT_LIGHTING, DIM_COPY, DIM_LEVELS, describeDim } from '../lighting';
import { loadLighting, saveLighting } from '../lightingStorage';

/**
 * First run, once, after an account is created.
 *
 * Four screens rather than a tour: what the app is, when your evening starts,
 * how dark it should get, and what is going to run tonight. Every one of them
 * already has a sensible default, so the whole thing is skippable and none of
 * it is a question you have to answer.
 *
 * The light step was added when there was finally something to set. The
 * original three deliberately left light out, and that was right at the time —
 * the only thing to say about it was a tip, and a tip can wait until night two.
 * A control is different: the app dims your screen during a session, and the
 * one place that should be said is before the first session rather than after
 * someone wonders why the screen went dark.
 *
 * The red-light *tutorial* is still not part of this. It is a page of written
 * steps for two operating systems, it lives in Settings and inside a session,
 * and it would double the length of a walkthrough that works because it is
 * short.
 */

const STEPS = 4;

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
  // Read rather than assumed, for the same reason the routine name is: this
  // screen is also reachable from Settings, where it must open showing what is
  // already set instead of resetting it to the default.
  const [dim, setDim] = useState<DimLevel>(DEFAULT_LIGHTING.dim);
  // Whatever Tonight would start right now. On a fresh account that is the
  // built-in, but it is read rather than assumed — an account created on a
  // device that already has routines cached should name the real one.
  const [routineName, setRoutineName] = useState(builtinRoutine.name);

  /**
   * Everything this screen can show is read back before it is offered.
   *
   * On a genuine first run these all resolve to the defaults already in state,
   * so nothing moves. It matters on the second visit: Settings can reopen this,
   * and a walkthrough that reopens showing 9:30pm and "Soft" to someone who set
   * 10:15pm and "Dark" is not a walkthrough, it's a reset with a Continue
   * button on it.
   */
  useEffect(() => {
    let active = true;

    loadActiveRoutine().then((routine) => {
      if (active) setRoutineName(routine.name);
    });

    loadLighting().then((lighting) => {
      if (active) setDim(lighting.dim);
    });

    // Only the local cache: this runs on the first frame after sign-up, and
    // `loadReminders` would go to the server before it could answer.
    loadCachedReminders().then((reminders) => {
      if (!active) return;
      const windDown = reminders['wind-down'];
      setHour(windDown.hour);
      setMinute(windDown.minute);
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

  /**
   * Same rule as the wind-down time: written on the way out of its own step,
   * not at the end. Someone who sets the light and then skips the rest has told
   * us how dark they want it, and only the last button having saved anything
   * would throw that away.
   *
   * Nothing is applied to the screen here. The level takes effect inside a
   * session, so the walkthrough never dims the screen it is being read on.
   */
  async function commitLight() {
    const lighting = await loadLighting();
    await saveLighting({ ...lighting, dim });
  }

  function next() {
    if (step === 1) commitWindDown();
    if (step === 2) commitLight();
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
              <Text style={styles.heading}>How dark should it get?</Text>
              <View style={styles.levels}>
                <LevelRow
                  label="Screen dim"
                  options={DIM_LEVELS.map((id) => ({ id, name: DIM_COPY[id].name }))}
                  value={dim}
                  onChange={setDim}
                />
              </View>
              <Text style={styles.levelCaption}>{describeDim(dim)}</Text>
              {/* The one sentence this whole app is built on, said once, at the
                  moment someone is thinking about light. Not a tip and not a
                  link — the tutorial is in Settings when they want it. */}
              <Text style={styles.line}>The lamp beside you matters more than any of this.</Text>
            </View>
          )}

          {step === 3 && (
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
  levels: {
    marginTop: space.lg,
  },
  /**
   * Sits tight under the pills, where `line` would sit a full `lg` below —
   * this describes the thing directly above it rather than adding a thought.
   */
  levelCaption: {
    color: theme.text,
    ...type.body,
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
