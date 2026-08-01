import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme, space, radius } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Session'>;

export default function RoutineScreen({ route, navigation }: Props) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { steps, title } = route.params;

  const [stepIndex, setStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(steps[0]?.seconds ?? 0);
  const [paused, setPaused] = useState(false);
  const [warmLight, setWarmLight] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  useEffect(() => {
    if (paused) return;

    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [stepIndex, paused]);

  // Advancing lives here rather than inside the tick updater: React may invoke
  // a state updater more than once, which would skip steps.
  useEffect(() => {
    if (secondsLeft === 0) goToStep(stepIndex + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, stepIndex]);

  function goToStep(index: number) {
    if (index >= steps.length) {
      navigation.goBack();
      return;
    }
    setStepIndex(index);
    setSecondsLeft(steps[index].seconds);
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const progress = steps.length > 1 ? (stepIndex + 1) / steps.length : 1;

  return (
    <View
      style={[
        styles.container,
        warmLight && styles.warmContainer,
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
        <Text style={styles.emoji}>{step.emoji}</Text>
        <Text style={styles.stepName}>{step.name}</Text>
        <Text style={styles.description}>{step.description}</Text>
        <Text style={styles.timer}>{timeLabel}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          style={styles.controlButton}
          onPress={() => stepIndex > 0 && goToStep(stepIndex - 1)}
          disabled={stepIndex === 0}
        >
          <Text style={[styles.controlText, stepIndex === 0 && styles.controlDisabled]}>Back</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: space.lg,
  },
  warmContainer: {
    backgroundColor: theme.warmLight,
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
  emoji: {
    fontSize: 60,
    marginBottom: space.md,
  },
  stepName: {
    color: theme.text,
    fontSize: 27,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: space.md,
  },
  description: {
    color: theme.textDim,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: space.xl,
    paddingHorizontal: space.sm,
  },
  timer: {
    color: theme.text,
    fontSize: 56,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
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
