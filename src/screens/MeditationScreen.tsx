import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme, space, radius, gradients } from '../theme';
import { MEDITATION_DURATIONS, MEDITATION_PROMPTS, READING_PROMPT } from '../meditationData';
import { logSession } from '../sessions';
import type { RootStackParamList } from '../navigation';

type Mode = 'meditation' | 'reading';
type Stage = 'setup' | 'dnd' | 'running';
type Props = NativeStackScreenProps<RootStackParamList, 'Meditation'>;

const PROMPT_INTERVAL_SECONDS = 20;

export default function MeditationScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('meditation');
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [stage, setStage] = useState<Stage>('setup');

  // Null until the timer actually starts — backing out of setup or the DND
  // prompt is not a session and must not be logged as an abandoned one.
  const startedAtRef = useRef<Date | null>(null);
  const loggedRef = useRef(false);

  const record = useCallback(
    (completed: boolean) => {
      const startedAt = startedAtRef.current;
      if (!startedAt || loggedRef.current) return;
      loggedRef.current = true;
      const endedAt = new Date();
      void logSession({
        kind: mode === 'meditation' ? 'meditation' : 'reading',
        title: mode === 'meditation' ? 'Meditation' : 'Reading',
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        completed,
        duration_seconds: Math.max(
          0,
          Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
        ),
      });
    },
    [mode]
  );

  // Backing out mid-session with the gesture or hardware back still counts.
  useEffect(() => navigation.addListener('beforeRemove', () => record(false)), [
    navigation,
    record,
  ]);

  return (
    <LinearGradient
      colors={stage === 'running' ? gradients.session : gradients.screen}
      style={[
        styles.container,
        { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md },
      ]}
    >
      {stage === 'setup' && (
        <SetupStage
          mode={mode}
          onModeChange={setMode}
          durationMinutes={durationMinutes}
          onDurationChange={setDurationMinutes}
          onClose={() => navigation.goBack()}
          onStart={() => setStage('dnd')}
        />
      )}
      {stage === 'dnd' && (
        <DndStage
          onBack={() => setStage('setup')}
          onContinue={() => {
            startedAtRef.current = new Date();
            setStage('running');
          }}
        />
      )}
      {stage === 'running' && (
        <RunningStage
          mode={mode}
          durationMinutes={durationMinutes}
          onDone={(completed) => {
            record(completed);
            navigation.goBack();
          }}
        />
      )}
    </LinearGradient>
  );
}

function Header({ title, action }: { title: string; action: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.topRow}>
      <Text style={styles.title}>{title}</Text>
      <Pressable onPress={action.onPress} hitSlop={8} style={styles.headerAction}>
        <Text style={styles.headerActionText}>{action.label}</Text>
      </Pressable>
    </View>
  );
}

function SetupStage({
  mode,
  onModeChange,
  durationMinutes,
  onDurationChange,
  onClose,
  onStart,
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  durationMinutes: number;
  onDurationChange: (n: number) => void;
  onClose: () => void;
  onStart: () => void;
}) {
  return (
    <>
      <Header title="Reading & Meditation" action={{ label: 'Close', onPress: onClose }} />

      <Text style={styles.sectionLabel}>MODE</Text>
      <View style={styles.segmentRow}>
        {(['meditation', 'reading'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            style={[styles.segment, mode === m && styles.segmentActive]}
            onPress={() => onModeChange(m)}
          >
            <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
              {m === 'meditation' ? 'Meditation' : 'Reading'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>DURATION</Text>
      <View style={styles.chipRow}>
        {MEDITATION_DURATIONS.map((d) => (
          <Pressable
            key={d}
            style={[styles.chip, durationMinutes === d && styles.chipActive]}
            onPress={() => onDurationChange(d)}
          >
            <Text style={[styles.chipText, durationMinutes === d && styles.chipTextActive]}>{d}m</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.spacer} />

      <Pressable style={styles.primaryButton} onPress={onStart}>
        <Text style={styles.primaryButtonText}>Continue</Text>
      </Pressable>
    </>
  );
}

function DndStage({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <>
      <Header title="Do Not Disturb" action={{ label: 'Back', onPress: onBack }} />

      <View style={styles.card}>
        <Text style={styles.cardBody}>Silence notifications so nothing pulls you out of this session.</Text>
        <Text style={styles.platformLabel}>{Platform.OS === 'ios' ? '▸ ON THIS IPHONE' : 'ON IPHONE'}</Text>
        <Text style={styles.step}>Swipe down from the top-right corner and tap the moon (Focus) icon.</Text>
        <Text style={styles.platformLabel}>
          {Platform.OS === 'android' ? '▸ ON THIS ANDROID' : 'ON ANDROID'}
        </Text>
        <Text style={styles.step}>Swipe down twice from the top and tap Do Not Disturb.</Text>
      </View>

      <View style={styles.spacer} />

      <Pressable style={styles.primaryButton} onPress={onContinue}>
        <Text style={styles.primaryButtonText}>I've turned it on — Start</Text>
      </Pressable>
    </>
  );
}

function RunningStage({
  mode,
  durationMinutes,
  onDone,
}: {
  mode: Mode;
  durationMinutes: number;
  /** `completed` distinguishes running the clock out from ending early. */
  onDone: (completed: boolean) => void;
}) {
  useKeepAwake();

  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [paused, setPaused] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;

    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused]);

  useEffect(() => {
    if (secondsLeft === 0) onDone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  // Prompts rotate on their own interval rather than piggybacking the tick.
  useEffect(() => {
    if (mode !== 'meditation' || paused) return;

    const id = setInterval(() => {
      setPromptIndex((i) => (i + 1) % MEDITATION_PROMPTS.length);
    }, PROMPT_INTERVAL_SECONDS * 1000);

    return () => clearInterval(id);
  }, [mode, paused]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const promptText = mode === 'meditation' ? MEDITATION_PROMPTS[promptIndex] : READING_PROMPT;

  return (
    <>
      <Header
        title={mode === 'meditation' ? 'Meditating' : 'Reading'}
        action={{ label: 'End', onPress: () => onDone(false) }}
      />

      <View style={styles.runArea}>
        <Text style={styles.timer}>{timeLabel}</Text>
        <Text style={styles.promptText}>{promptText}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          style={[styles.controlButton, styles.pauseButton]}
          onPress={() => setPaused((p) => !p)}
        >
          <Text style={[styles.controlText, styles.pauseText]}>{paused ? 'Resume' : 'Pause'}</Text>
        </Pressable>
        <Pressable style={styles.controlButton} onPress={() => onDone(false)}>
          <Text style={styles.controlText}>End</Text>
        </Pressable>
      </View>
    </>
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
    fontSize: 20,
    fontWeight: '700',
  },
  headerAction: {
    padding: space.sm,
  },
  headerActionText: {
    color: theme.ember,
    fontSize: 15,
    fontWeight: '600',
  },
  sectionLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: space.sm + 4,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: theme.ember,
  },
  segmentText: {
    color: theme.textDim,
    fontSize: 15,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#1a0f08',
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm + 2,
  },
  chip: {
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    backgroundColor: theme.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
  },
  chipActive: {
    backgroundColor: theme.ember,
    borderColor: theme.ember,
  },
  chipText: {
    color: theme.textDim,
    fontSize: 15,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#1a0f08',
    fontWeight: '700',
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    padding: space.lg,
    marginTop: space.lg,
  },
  cardBody: {
    color: theme.textDim,
    fontSize: 15,
    lineHeight: 21,
  },
  platformLabel: {
    color: theme.ember,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: space.md,
    marginBottom: space.xs + 2,
  },
  step: {
    color: theme.textDim,
    fontSize: 14,
    lineHeight: 20,
  },
  spacer: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: theme.emberDeep,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#1a0f08',
    fontSize: 16,
    fontWeight: '700',
  },
  runArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    color: theme.text,
    fontSize: 64,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    marginBottom: space.lg,
  },
  promptText: {
    color: theme.textDim,
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 25,
    paddingHorizontal: space.md,
  },
  controls: {
    flexDirection: 'row',
    gap: space.sm + 2,
  },
  controlButton: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: theme.card,
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
});
