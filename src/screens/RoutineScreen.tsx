import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme, space, radius, gradients } from '../theme';
import { logSession } from '../sessions';
import { prepareBells, releaseBells, ring, tick } from '../audio';
import { buildPhases, phaseIndexForStep, phaseLabel } from '../sessionPlan';
import Pose from '../components/Pose';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

/**
 * How many seconds of the get-ready are counted in with a haptic tap.
 *
 * Three, out of a five-second get-ready. Enough to be a countdown, and it
 * deliberately does not fill the whole gap — a tap on every second of it would
 * be a pulse to ignore rather than a cue to act on.
 */
const COUNT_IN = 3;

export default function RoutineScreen({ route, navigation }: Props) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { steps, title } = route.params;

  // The routine, flattened into get-ready and hold phases. See `sessionPlan.ts`.
  const phases = useMemo(() => buildPhases(steps), [steps]);

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(phases[0]?.seconds ?? 0);
  const [paused, setPaused] = useState(false);
  const [warmLight, setWarmLight] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const phase = phases[phaseIndex];
  const step = phase?.step ?? steps[0];
  const stepIndex = phase?.stepIndex ?? 0;
  const isLastStep = stepIndex === steps.length - 1;
  const gettingReady = phase?.kind === 'ready';

  // Loaded on mount, not on the first bell: the first one is due at the end of
  // the first hold, which on a 30-second stretch is not long enough to decode a
  // sample on a cold audio session. Freed on unmount — an AudioPlayer holds a
  // native handle, and leaking one per session eventually costs the app its
  // audio focus.
  useEffect(() => {
    void prepareBells();
    return releaseBells;
  }, []);

  const startedAtRef = useRef(new Date());
  const loggedRef = useRef(false);

  // Idempotent: whichever exit path fires first wins, so an explicit finish is
  // never overwritten by the abandon listener below.
  const record = useCallback(
    (completed: boolean) => {
      if (loggedRef.current) return;
      loggedRef.current = true;
      const startedAt = startedAtRef.current;
      const endedAt = new Date();
      void logSession({
        kind: steps.length === 1 ? 'stretch' : 'routine',
        title,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        completed,
        duration_seconds: Math.max(
          0,
          Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
        ),
      });
    },
    [steps.length, title]
  );

  // Covers every way out that isn't finishing — End, hardware back, swipe.
  // `beforeRemove` fires only on real navigation, so unlike an unmount cleanup
  // it can't log a phantom session when an effect is re-run in development.
  useEffect(() => navigation.addListener('beforeRemove', () => record(false)), [
    navigation,
    record,
  ]);

  useEffect(() => {
    if (paused) return;

    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phaseIndex, paused]);

  /**
   * The phase whose clock has already been rung out, so a re-render can't ring
   * the same bell twice — which is what a development double-invoke, or any
   * unrelated state change landing on the same tick, would otherwise do.
   */
  const rungRef = useRef(-1);

  // Advancing lives here rather than inside the tick updater: React may invoke
  // a state updater more than once, which would skip phases.
  useEffect(() => {
    if (!phase) return;

    if (secondsLeft > 0) {
      // The count-in. Felt rather than heard, so that the end of a stretch and
      // the start of one are never the same cue — see `tick` in `audio.ts`.
      if (phase.kind === 'ready' && secondsLeft <= COUNT_IN) tick();
      return;
    }

    if (rungRef.current === phaseIndex) return;
    rungRef.current = phaseIndex;

    // Only a hold that ran out gets a bell. Skipping past one deliberately is
    // not "that stretch is over", and ringing for it would teach you to ignore
    // the sound that matters.
    if (phase.kind === 'hold') ring(phase.final ? 'final' : 'interval');

    goToPhase(phaseIndex + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phaseIndex]);

  function goToPhase(index: number) {
    if (index >= phases.length) {
      record(true);
      navigation.goBack();
      return;
    }
    setPhaseIndex(index);
    setSecondsLeft(phases[index].seconds);
  }

  /** Controls move by stretch, never by half of one — see `goBackOne` below. */
  function goToStep(index: number) {
    if (index >= steps.length) {
      record(true);
      navigation.goBack();
      return;
    }
    goToPhase(phaseIndexForStep(phases, Math.max(0, index)));
  }

  /**
   * Back restarts the current stretch unless you are already at the top of it,
   * in which case it goes to the previous one — the same thing the back button
   * on a music player does, and the behaviour you want when you have just
   * fumbled getting into a pose.
   */
  function goBackOne() {
    const atStart = phaseIndex === phaseIndexForStep(phases, stepIndex);
    goToStep(atStart ? stepIndex - 1 : stepIndex);
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const progress = steps.length > 1 ? (stepIndex + 1) / steps.length : 1;

  return (
    <LinearGradient
      // The warm-light toggle still swaps the whole ground; it just shifts
      // between two gradients now rather than two flat fills.
      colors={warmLight ? gradients.session : gradients.screen}
      style={[
        styles.container,
        { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md },
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.endButton}>
          <Text style={styles.endText}>End</Text>
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.lightBanner}>
        <Text style={styles.lightBannerText}>For real red light, turn on your own red lamp</Text>
        <View style={styles.lightBannerRow}>
          <Pressable style={styles.warmToggle} onPress={() => setWarmLight((v) => !v)}>
            <Text style={styles.warmToggleText}>{warmLight ? 'Warm light on' : 'Warm light off'}</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('RedLightTutorial')} hitSlop={8}>
            <Text style={styles.tipsLinkText}>Phone tips →</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.stepArea}>
        <Text style={styles.stepCount}>
          {stepIndex + 1} of {steps.length}
        </Text>

        {/* The drawing, at the size that makes it useful. This is the moment
            someone needs to know what the pose actually is, and the second half
            of a two-sided pose is the same figure mirrored. */}
        <Pose
          name={step.pose}
          size={132}
          color={gettingReady ? theme.ember : theme.text}
          flip={phase?.side === 'right'}
          style={styles.pose}
        />

        <Text style={styles.stepName}>{step.name}</Text>
        <Text style={styles.description}>{step.description}</Text>

        {phase && (
          <Text style={[styles.phaseLabel, gettingReady && styles.phaseLabelReady]}>
            {phaseLabel(phase)}
          </Text>
        )}
        <Text style={[styles.timer, gettingReady && styles.timerReady]}>{timeLabel}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.controlButton} onPress={goBackOne} disabled={phaseIndex === 0}>
          <Text style={[styles.controlText, phaseIndex === 0 && styles.controlDisabled]}>Back</Text>
        </Pressable>

        <Pressable
          style={[styles.controlButton, styles.pauseButton]}
          onPress={() => setPaused((p) => !p)}
        >
          <Text style={[styles.controlText, styles.pauseText]}>{paused ? 'Resume' : 'Pause'}</Text>
        </Pressable>

        <Pressable style={styles.controlButton} onPress={() => goToStep(stepIndex + 1)}>
          <Text style={styles.controlText}>{isLastStep ? 'Finish' : 'Skip'}</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: space.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '700',
  },
  endButton: {
    padding: space.sm,
  },
  endText: {
    color: theme.ember,
    fontSize: 15,
    fontWeight: '600',
  },
  progressTrack: {
    height: 2,
    backgroundColor: theme.cardBorder,
    borderRadius: radius.pill,
    marginTop: space.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    backgroundColor: theme.ember,
  },
  lightBanner: {
    marginTop: space.md,
    padding: space.md - 2,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  lightBannerText: {
    color: theme.textDim,
    fontSize: 12,
    marginBottom: space.sm,
  },
  lightBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  warmToggle: {
    paddingVertical: 6,
    paddingHorizontal: space.md - 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  warmToggleText: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '600',
  },
  tipsLinkText: {
    color: theme.ember,
    fontSize: 12,
    fontWeight: '700',
  },
  stepArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCount: {
    color: theme.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: space.md,
  },
  pose: {
    marginBottom: space.md,
  },
  stepName: {
    color: theme.text,
    fontSize: 27,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: space.sm + 4,
  },
  description: {
    color: theme.textDim,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: space.lg,
    paddingHorizontal: space.sm,
  },
  phaseLabel: {
    color: theme.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: space.xs,
  },
  phaseLabelReady: {
    color: theme.ember,
  },
  timer: {
    color: theme.text,
    fontSize: 56,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  // The countdown into a pose is the same numeral in the accent colour, so a
  // glance tells you whether the clock is time to get ready or time you are
  // meant to be holding something.
  timerReady: {
    color: theme.ember,
  },
  controls: {
    flexDirection: 'row',
    gap: space.sm + 2,
  },
  controlButton: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
  },
  pauseButton: {
    backgroundColor: theme.ember,
  },
  controlText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  pauseText: {
    color: '#1a0f08',
    fontWeight: '700',
  },
  controlDisabled: {
    opacity: 0.35,
  },
});
