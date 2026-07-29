import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { theme } from '../theme';
import { defaultRoutine } from '../routineData';

type Props = {
  onFinish: () => void;
};

export default function RoutineScreen({ onFinish }: Props) {
  useKeepAwake();

  const [stepIndex, setStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(defaultRoutine[0].seconds);
  const [paused, setPaused] = useState(false);
  const [redLight, setRedLight] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = defaultRoutine[stepIndex];
  const isLastStep = stepIndex === defaultRoutine.length - 1;

  useEffect(() => {
    if (paused) return;

    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          goToNextStep();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, paused]);

  function goToStep(index: number) {
    if (index >= defaultRoutine.length) {
      onFinish();
      return;
    }
    setStepIndex(index);
    setSecondsLeft(defaultRoutine[index].seconds);
  }

  function goToNextStep() {
    goToStep(stepIndex + 1);
  }

  function goToPrevStep() {
    if (stepIndex === 0) return;
    goToStep(stepIndex - 1);
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <View style={[styles.container, redLight && styles.redContainer]}>
      <Pressable style={styles.closeButton} onPress={onFinish}>
        <Text style={styles.closeText}>End</Text>
      </Pressable>

      <Pressable style={styles.redToggle} onPress={() => setRedLight((v) => !v)}>
        <Text style={styles.redToggleText}>{redLight ? '🔴 Red light on' : '⚪ Normal light'}</Text>
      </Pressable>

      <View style={styles.stepArea}>
        <Text style={styles.stepCount}>
          Step {stepIndex + 1} of {defaultRoutine.length}
        </Text>
        <Text style={styles.emoji}>{step.emoji}</Text>
        <Text style={styles.stepName}>{step.name}</Text>
        <Text style={styles.description}>{step.description}</Text>
        <Text style={styles.timer}>{timeLabel}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.controlButton} onPress={goToPrevStep} disabled={stepIndex === 0}>
          <Text style={[styles.controlText, stepIndex === 0 && styles.controlDisabled]}>Back</Text>
        </Pressable>

        <Pressable style={[styles.controlButton, styles.pauseButton]} onPress={() => setPaused((p) => !p)}>
          <Text style={styles.controlText}>{paused ? 'Resume' : 'Pause'}</Text>
        </Pressable>

        <Pressable style={styles.controlButton} onPress={goToNextStep}>
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
    padding: 24,
    paddingTop: 60,
  },
  redContainer: {
    backgroundColor: theme.redLight,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  closeText: {
    color: theme.text,
    fontSize: 16,
    opacity: 0.8,
  },
  redToggle: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  redToggleText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  stepArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCount: {
    color: theme.text,
    opacity: 0.7,
    fontSize: 14,
    marginBottom: 12,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  stepName: {
    color: theme.text,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    color: theme.text,
    opacity: 0.85,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  timer: {
    color: theme.text,
    fontSize: 56,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  controlButton: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
  },
  pauseButton: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  controlText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  controlDisabled: {
    opacity: 0.4,
  },
});
