import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme, space, radius, gradients } from '../theme';
import BreathingPacer from '../components/BreathingPacer';
import {
  BELL_SETTINGS,
  GUIDED_SESSIONS,
  MEDITATION_DURATIONS,
  MEDITATION_PROMPTS,
  READING_PROMPT,
  UNGUIDED_ID,
  bellTimes,
  cueAt,
  guidedById,
  guidedTimeline,
  isFinalBell,
} from '../meditationData';
import type { BellSetting } from '../meditationData';
import { BREATH_PATTERNS, breathsIn, patternById } from '../breathing';
import { prepareBells, releaseBells, ring } from '../audio';
import { logSession } from '../sessions';
import type { RootStackParamList } from '../navigation';

type Mode = 'meditation' | 'breathing' | 'reading';
type Stage = 'setup' | 'dnd' | 'running';
type Props = NativeStackScreenProps<RootStackParamList, 'Meditation'>;

const PROMPT_INTERVAL_SECONDS = 20;

const MODES: { id: Mode; name: string }[] = [
  { id: 'meditation', name: 'Meditate' },
  { id: 'breathing', name: 'Breathe' },
  { id: 'reading', name: 'Read' },
];

export default function MeditationScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('meditation');
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [stage, setStage] = useState<Stage>('setup');
  const [guideId, setGuideId] = useState(UNGUIDED_ID);
  const [patternId, setPatternId] = useState(BREATH_PATTERNS[0].id);
  const [bells, setBells] = useState<BellSetting>('ends');

  const guide = guidedById(guideId);
  const pattern = patternById(patternId) ?? BREATH_PATTERNS[0];

  // Null until the timer actually starts — backing out of setup or the DND
  // prompt is not a session and must not be logged as an abandoned one.
  const startedAtRef = useRef<Date | null>(null);
  const loggedRef = useRef(false);

  // Players hold a native handle, so they are freed when the screen goes rather
  // than left to accumulate one set per visit.
  useEffect(() => releaseBells, []);

  function sessionTitle(): string {
    if (mode === 'reading') return 'Reading';
    if (mode === 'breathing') return `${pattern.name} breathing`;
    return guide ? guide.name : 'Meditation';
  }

  const record = useCallback(
    (completed: boolean) => {
      const startedAt = startedAtRef.current;
      if (!startedAt || loggedRef.current) return;
      loggedRef.current = true;
      const endedAt = new Date();
      void logSession({
        // Breathing logs as meditation: `sessions.kind` is constrained to four
        // values, and a migration to add a fifth isn't worth it when the title
        // already says which pattern was run.
        kind: mode === 'reading' ? 'reading' : 'meditation',
        title: sessionTitle(),
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        completed,
        duration_seconds: Math.max(
          0,
          Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
        ),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, guideId, patternId]
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
          guideId={guideId}
          onGuideChange={setGuideId}
          patternId={patternId}
          onPatternChange={setPatternId}
          bells={bells}
          onBellsChange={setBells}
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
          title={sessionTitle()}
          durationMinutes={durationMinutes}
          guideId={guideId}
          patternId={patternId}
          bells={bells}
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
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Pressable onPress={action.onPress} hitSlop={8} style={styles.headerAction}>
        <Text style={styles.headerActionText}>{action.label}</Text>
      </Pressable>
    </View>
  );
}

/** A row of small pills. Used for durations and bell intervals alike. */
function PillRow<T extends string | number>({
  options,
  value,
  onChange,
  format,
}: {
  options: { id: T; name: string }[];
  value: T;
  onChange: (value: T) => void;
  format?: (option: { id: T; name: string }) => string;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <Pressable
          key={String(option.id)}
          style={[styles.chip, value === option.id && styles.chipActive]}
          onPress={() => onChange(option.id)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === option.id }}
        >
          <Text style={[styles.chipText, value === option.id && styles.chipTextActive]}>
            {format ? format(option) : option.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A tall option with a name and a line of explanation. */
function ChoiceRow({
  name,
  detail,
  selected,
  onPress,
}: {
  name: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}. ${detail}`}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.choiceText}>
        <Text style={[styles.choiceName, selected && styles.choiceNameSelected]}>{name}</Text>
        <Text style={styles.choiceDetail}>{detail}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]} />
    </Pressable>
  );
}

function SetupStage({
  mode,
  onModeChange,
  durationMinutes,
  onDurationChange,
  guideId,
  onGuideChange,
  patternId,
  onPatternChange,
  bells,
  onBellsChange,
  onClose,
  onStart,
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  durationMinutes: number;
  onDurationChange: (n: number) => void;
  guideId: string;
  onGuideChange: (id: string) => void;
  patternId: string;
  onPatternChange: (id: string) => void;
  bells: BellSetting;
  onBellsChange: (setting: BellSetting) => void;
  onClose: () => void;
  onStart: () => void;
}) {
  const pattern = patternById(patternId) ?? BREATH_PATTERNS[0];

  return (
    <>
      <Header title="Reading & Meditation" action={{ label: 'Close', onPress: onClose }} />

      {/* Scrolls now that a mode can bring its own section with it — three
          modes' worth of options never fit a phone at once. */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.setupBody}>
        <Text style={styles.sectionLabel}>MODE</Text>
        <View style={styles.segmentRow}>
          {MODES.map((option) => (
            <Pressable
              key={option.id}
              style={[styles.segment, mode === option.id && styles.segmentActive]}
              onPress={() => onModeChange(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: mode === option.id }}
            >
              <Text style={[styles.segmentText, mode === option.id && styles.segmentTextActive]}>
                {option.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'meditation' && (
          <>
            <Text style={styles.sectionLabel}>GUIDE</Text>
            <ChoiceRow
              name="Unguided"
              detail="A timer and the occasional short prompt"
              selected={guideId === UNGUIDED_ID}
              onPress={() => onGuideChange(UNGUIDED_ID)}
            />
            {GUIDED_SESSIONS.map((session) => (
              <ChoiceRow
                key={session.id}
                name={session.name}
                detail={session.detail}
                selected={guideId === session.id}
                onPress={() => onGuideChange(session.id)}
              />
            ))}
            <Text style={styles.footnote}>
              Guided sessions are paced text, not narration — the script stretches to whatever
              length you choose.
            </Text>
          </>
        )}

        {mode === 'breathing' && (
          <>
            <Text style={styles.sectionLabel}>PATTERN</Text>
            {BREATH_PATTERNS.map((option) => (
              <ChoiceRow
                key={option.id}
                name={`${option.name} · ${option.detail}`}
                detail={option.note}
                selected={patternId === option.id}
                onPress={() => onPatternChange(option.id)}
              />
            ))}
          </>
        )}

        {mode === 'reading' && (
          <View style={styles.card}>
            <Text style={styles.cardBody}>{READING_PROMPT}</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>DURATION</Text>
        <PillRow
          options={MEDITATION_DURATIONS.map((d) => ({ id: d, name: `${d}m` }))}
          value={durationMinutes}
          onChange={onDurationChange}
        />
        {mode === 'breathing' && (
          <Text style={styles.footnote}>
            About {breathsIn(pattern, durationMinutes * 60)} breaths at this pace.
          </Text>
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>BELLS</Text>
          {bells !== 'off' && (
            <Pressable
              // Worth having on its own merits — checking the volume before you
              // lie down beats discovering it is wrong once you have.
              onPress={() => ring('interval')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Play the bell now"
            >
              <Text style={styles.testBell}>Hear it</Text>
            </Pressable>
          )}
        </View>
        <PillRow options={BELL_SETTINGS} value={bells} onChange={onBellsChange} />
        <Text style={styles.footnote}>
          A soft bell to open and close the session, and optionally to mark time in between. Each
          one is a gentle tap as well, so it still lands with the phone silenced.
        </Text>
      </ScrollView>

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
        <Text style={styles.step}>
          {'\n'}The bells still sound — they ignore the silent switch, and each one is a gentle tap
          as well, in case the phone is face down.
        </Text>
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
  title,
  durationMinutes,
  guideId,
  patternId,
  bells,
  onDone,
}: {
  mode: Mode;
  title: string;
  durationMinutes: number;
  guideId: string;
  patternId: string;
  bells: BellSetting;
  /** `completed` distinguishes running the clock out from ending early. */
  onDone: (completed: boolean) => void;
}) {
  useKeepAwake();

  const total = durationMinutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(total);
  const [paused, setPaused] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);

  const pattern = patternById(patternId) ?? BREATH_PATTERNS[0];
  const guide = guidedById(guideId);
  const timelineRef = useRef(guide ? guidedTimeline(guide, total) : []);

  const schedule = useRef(bellTimes(bells, total)).current;
  // Index of the next bell to ring. Held in a ref so a re-render can't ring one
  // twice, and advanced past any the clock skipped over.
  const nextBellRef = useRef(0);

  useEffect(() => {
    if (bells !== 'off') void prepareBells();
  }, [bells]);

  useEffect(() => {
    if (paused) return;

    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [paused]);

  const elapsed = total - secondsLeft;

  // Bells are driven off elapsed time rather than fired from the ticker, so a
  // dropped tick delays a bell instead of losing it.
  useEffect(() => {
    while (nextBellRef.current < schedule.length && schedule[nextBellRef.current] <= elapsed) {
      const at = schedule[nextBellRef.current];
      nextBellRef.current += 1;
      ring(isFinalBell(schedule, at) ? 'final' : 'interval');
    }
  }, [elapsed, schedule]);

  useEffect(() => {
    if (secondsLeft === 0) onDone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  // Unguided prompts rotate on their own interval rather than piggybacking the
  // tick. A guided session has its own script and ignores these entirely.
  useEffect(() => {
    if (mode !== 'meditation' || guide || paused) return;

    const id = setInterval(() => {
      setPromptIndex((i) => (i + 1) % MEDITATION_PROMPTS.length);
    }, PROMPT_INTERVAL_SECONDS * 1000);

    return () => clearInterval(id);
  }, [mode, guide, paused]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const bodyText =
    mode === 'reading'
      ? READING_PROMPT
      : guide
        ? cueAt(timelineRef.current, elapsed)?.text ?? ''
        : MEDITATION_PROMPTS[promptIndex];

  return (
    <>
      <Header title={title} action={{ label: 'End', onPress: () => onDone(false) }} />

      <View style={styles.runArea}>
        {mode === 'breathing' ? (
          <>
            <BreathingPacer pattern={pattern} running={!paused} />
            {/* Small and dim under the pacer: during breathing the clock is the
                least interesting thing on screen. */}
            <Text style={styles.smallTimer}>{timeLabel}</Text>
          </>
        ) : (
          <>
            <Text style={styles.timer}>{timeLabel}</Text>
            <Text style={styles.promptText}>{bodyText}</Text>
          </>
        )}
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
    flex: 1,
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
  setupBody: {
    paddingBottom: space.lg,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  testBell: {
    color: theme.ember,
    fontSize: 13,
    fontWeight: '700',
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  sectionLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  footnote: {
    color: theme.textFaint,
    fontSize: 12,
    lineHeight: 17,
    marginTop: space.sm,
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
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: theme.emberVeil,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: radius.md,
    paddingVertical: space.sm + 4,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  choiceSelected: {
    borderColor: theme.ember,
    backgroundColor: theme.emberGlow,
  },
  pressed: {
    opacity: 0.75,
  },
  choiceText: {
    flex: 1,
  },
  choiceName: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
  },
  choiceNameSelected: {
    color: theme.ember,
  },
  choiceDetail: {
    color: theme.textFaint,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
  },
  radioSelected: {
    borderColor: theme.ember,
    backgroundColor: theme.ember,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm + 2,
  },
  chip: {
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md - 2,
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
    fontSize: 14,
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
    marginTop: space.md,
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
  smallTimer: {
    color: theme.textFaint,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    marginTop: space.xl,
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
