import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ViewStyle } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Icon, { IconName } from '../components/Icon';
import Glow from '../components/Glow';
import Embers, { Speck } from '../components/Embers';
import { theme, space, radius, EMBER_RGB, EMBER_DEEP_RGB } from '../theme';
import { duration, easing, PRESS_SCALE, useAmbientLoop } from '../motion';
import { useReduceMotion } from '../reduceMotion';
import { formatTotal } from '../format';
import { stepCatalog } from '../routineData';
import { GUIDED_SESSIONS } from '../meditationData';
import { loadActiveRoutine, loadCachedRoutines, listRoutines, refreshActiveRoutine } from '../routines';
import type { SavedRoutine } from '../routines';
import { loadProgress, nightOf } from '../sessions';
import type { LoggedSession } from '../sessions';
import { lastNights, nightDate } from '../streak';
import { WEEK_LENGTH } from '../components/WeekStrip';
import type { ModulesStackParamList, RootStackParamList } from '../navigation';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<ModulesStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * Three modules, ranked.
 *
 * The screen used to be three identical cards, which is the layout you draw when
 * you don't yet know which one matters. It turns out one of them always does —
 * people pick a lane and stay in it — so the one this person actually opens is
 * promoted to a lit card with its own front door, and the other two drop to a
 * compact pair. Nothing is hidden; the ranking is just done for you.
 */

type ModuleId = 'stretches' | 'routines' | 'meditation';

type Module = {
  id: ModuleId;
  icon: IconName;
  /** Full name, for the promoted card. */
  title: string;
  /** Short name, for a half-width tile. */
  short: string;
  body: string;
  cta: string;
  open: (navigation: Nav) => void;
};

const MODULES: readonly Module[] = [
  {
    id: 'stretches',
    icon: 'stretches',
    title: 'Yoga & Stretches',
    short: 'Stretches',
    body: 'Start one stretch, or pick several to run as a sequence.',
    cta: 'Open library',
    open: (navigation) => navigation.navigate('StretchLibrary'),
  },
  {
    id: 'routines',
    icon: 'routines',
    title: 'My Routines',
    short: 'My Routines',
    body: 'Build your own wind-down, and choose the one for tonight.',
    cta: 'Open routines',
    open: (navigation) => navigation.navigate('Routines'),
  },
  {
    id: 'meditation',
    icon: 'reading',
    title: 'Reading & Meditation',
    short: 'Reading',
    body: 'A timed session with a Do Not Disturb reminder.',
    cta: 'Start a session',
    open: (navigation) => navigation.navigate('Meditation'),
  },
];

/** Which module a logged session came out of. */
const KIND_MODULE: Record<string, ModuleId> = {
  stretch: 'stretches',
  routine: 'routines',
  meditation: 'meditation',
  reading: 'meditation',
};

/**
 * The module this person reaches for. Ties fall to `MODULES` order, so an empty
 * history promotes the stretch library — the one thing you can use on night one
 * without having built or chosen anything first.
 */
function mostUsed(history: LoggedSession[]): Module {
  const counts = new Map<ModuleId, number>();
  for (const session of history) {
    if (!session.completed) continue;
    const id = KIND_MODULE[session.kind];
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return MODULES.reduce((best, module) =>
    (counts.get(module.id) ?? 0) > (counts.get(best.id) ?? 0) ? module : best
  );
}

const CARD_HEADER_HEIGHT = 150;

/**
 * Two lamps under the card's bottom edge, breathing out of step with each other.
 * Nothing in the header is a pattern or a picture — it is the same lamplight
 * logic the rest of the app is lit by, turned up.
 */
const BLOOM_A = { box: 250, stop: 0.62, peak: 0.42, half: 5200 };
const BLOOM_B = { box: 300, stop: 0.64, peak: 0.3, half: 7600 };

/**
 * A bloom, positioned the way the design quotes it: by the box the light sits
 * in, rather than by the light's own extent. See `Glow` for why those differ.
 */
function Bloom({
  box,
  stop,
  peak,
  color,
  drift,
  fade,
  swell,
  style,
}: {
  box: number;
  stop: number;
  peak: number;
  color: readonly [number, number, number];
  drift: Animated.Value;
  fade: readonly [number, number];
  swell: readonly [number, number];
  style: ViewStyle;
}) {
  const size = Math.round(box * stop * Math.SQRT2);
  const inset = (box - size) / 2;

  return (
    <View pointerEvents="none" style={[styles.bloomBox, { width: box, height: box }, style]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: drift.interpolate({ inputRange: [0, 1], outputRange: fade as [number, number] }),
            transform: [
              {
                scale: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: swell as [number, number],
                }),
              },
            ],
          },
        ]}
      >
        <Glow size={size} peak={peak} color={color} style={{ left: inset, top: inset }} />
      </Animated.View>
    </View>
  );
}

const CARD_SPECKS: readonly Speck[] = [
  { x: '9%', size: 2, seconds: 7.5, delay: 0 },
  { x: '17%', size: 3, seconds: 9.5, delay: 3.1 },
  { x: '26%', size: 2, seconds: 11, delay: 6.4 },
  { x: '38%', size: 3, seconds: 8.5, delay: 1.7 },
  { x: '46%', size: 2, seconds: 12, delay: 4.9 },
  { x: '57%', size: 4, seconds: 9, delay: 7.6 },
  { x: '66%', size: 2, seconds: 10.5, delay: 2.3 },
  { x: '78%', size: 3, seconds: 13, delay: 5.5 },
  { x: '89%', size: 2, seconds: 8, delay: 0.9 },
];

const CHART_TRACK = 56;
/** Leaves the tallest bar clear of the top of its track. */
const CHART_MAX = 52;
/** A night with nothing in it still gets a mark, or the week reads as six days. */
const CHART_EMPTY = 4;

/** Minutes wound down on each of the last seven nights, oldest first. */
function weekMinutes(history: LoggedSession[]): { key: string; minutes: number }[] {
  const byNight = new Map<string, number>();
  for (const session of history) {
    if (!session.completed) continue;
    const night = nightOf(session.ended_at);
    byNight.set(night, (byNight.get(night) ?? 0) + session.duration_seconds / 60);
  }
  return lastNights(WEEK_LENGTH).map((key) => ({
    key,
    minutes: Math.round(byNight.get(key) ?? 0),
  }));
}

// Same reason as `Button`: a wrapper would take over the caller's layout style.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A half-width module tile, with the app's standard press feedback. */
function Tile({ module, meta, onPress }: { module: Module; meta: string; onPress: () => void }) {
  const held = useRef(new Animated.Value(0)).current;

  const press = (to: number, ms: number, curve: typeof easing.press) =>
    Animated.timing(held, { toValue: to, duration: ms, easing: curve, useNativeDriver: true }).start();

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${module.title}. ${meta}`}
      onPress={onPress}
      onPressIn={() => press(1, duration.press, easing.press)}
      onPressOut={() => press(0, duration.release, easing.settle)}
      style={[
        styles.tile,
        {
          opacity: held.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }),
          transform: [
            { scale: held.interpolate({ inputRange: [0, 1], outputRange: [1, PRESS_SCALE] }) },
          ],
        },
      ]}
    >
      <View style={styles.tilePlate}>
        <Icon name={module.icon} size={19} color={theme.ember} />
      </View>
      <Text style={styles.tileName}>{module.short}</Text>
      <Text style={styles.tileMeta}>{meta}</Text>
    </AnimatedPressable>
  );
}

export default function ModulesScreen() {
  const navigation = useNavigation<Nav>();
  const still = useReduceMotion();

  const [history, setHistory] = useState<LoggedSession[]>([]);
  const [routines, setRoutines] = useState<SavedRoutine[]>([]);
  const [tonightsRoutine, setTonightsRoutine] = useState<SavedRoutine | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      loadProgress().then((p) => live && setHistory(p.history));
      // Cache first, then the server — same two-step as everywhere else, so the
      // promoted card never waits on a network to know what to promote.
      loadCachedRoutines().then((r) => live && setRoutines(r));
      listRoutines().then((r) => live && setRoutines(r));
      loadActiveRoutine().then((r) => live && setTonightsRoutine(r));
      refreshActiveRoutine().then((r) => live && setTonightsRoutine(r));
      return () => {
        live = false;
      };
    }, [])
  );

  const bloomA = useAmbientLoop(BLOOM_A.half, still);
  const bloomB = useAmbientLoop(BLOOM_B.half, still);

  const promoted = mostUsed(history);
  const pair = MODULES.filter((module) => module.id !== promoted.id);

  const META: Record<ModuleId, string> = {
    stretches: `${stepCatalog.length} stretches · one or a sequence`,
    routines: tonightsRoutine
      ? `${routines.length} saved · ${tonightsRoutine.name} set`
      : `${routines.length} saved`,
    meditation: `${GUIDED_SESSIONS.length} guided · Do Not Disturb`,
  };

  const CTA_META: Record<ModuleId, string> = {
    stretches: `· ${stepCatalog.length} stretches`,
    routines: `· ${routines.length} saved`,
    meditation: `· ${GUIDED_SESSIONS.length} guided`,
  };

  const week = weekMinutes(history);
  const peak = Math.max(...week.map((night) => night.minutes));
  const tonight = week[week.length - 1].key;
  const total = week.reduce((sum, night) => sum + night.minutes, 0);

  return (
    <Screen title="Modules">
      <View style={styles.promoted}>
        <LinearGradient colors={['#120e0a', '#251a11']} style={styles.header}>
          <Bloom
            {...BLOOM_A}
            color={EMBER_RGB}
            drift={bloomA}
            fade={[0.45, 1]}
            swell={[0.94, 1.06]}
            style={{ left: '8%', bottom: -120 }}
          />
          <Bloom
            {...BLOOM_B}
            color={EMBER_DEEP_RGB}
            drift={bloomB}
            fade={[0.25, 0.7]}
            swell={[0.97, 1.04]}
            style={{ right: '2%', bottom: -140 }}
          />

          <Embers
            specks={CARD_SPECKS}
            rise={150}
            scaleFrom={0.7}
            scaleTo={1.1}
            fadeInAt={0.22}
            peak={0.9}
            color={theme.emberBright}
            bottom={-4}
            still={still}
            style={StyleSheet.absoluteFill}
          />

          {/* Holds the badge and the card's top edge apart from the light. */}
          <LinearGradient
            colors={['rgba(20, 16, 12, 0.55)', 'rgba(20, 16, 12, 0)']}
            locations={[0, 0.55]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={styles.badge}>
            <Text style={styles.badgeText}>TONIGHT'S PICK</Text>
          </View>
        </LinearGradient>

        <View style={styles.promotedBody}>
          <Text style={styles.promotedTitle}>{promoted.title}</Text>
          <Text style={styles.promotedText}>{promoted.body}</Text>
          <Button
            label={promoted.cta}
            meta={CTA_META[promoted.id]}
            style={styles.promotedCta}
            onPress={() => promoted.open(navigation)}
          />
        </View>
      </View>

      <View style={styles.pair}>
        {pair.map((module) => (
          <Tile
            key={module.id}
            module={module}
            meta={META[module.id]}
            onPress={() => module.open(navigation)}
          />
        ))}
      </View>

      <View style={styles.chart}>
        <View style={styles.chartHead}>
          <Text style={styles.chartLabel}>THIS WEEK</Text>
          <Text style={styles.chartTotal}>{formatTotal(total)} wound down</Text>
        </View>
        <View style={styles.chartRow}>
          {week.map((night) => {
            const missed = night.minutes === 0;
            return (
              <View key={night.key} style={styles.chartColumn}>
                {/* The track is a fixed height and the label sits below it. Put
                    the two in one box and a full-height bar lands on its own
                    weekday. */}
                <View style={styles.chartTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: missed
                          ? CHART_EMPTY
                          : Math.max(CHART_EMPTY, (night.minutes / peak) * CHART_MAX),
                        backgroundColor: missed
                          ? theme.cardBorder
                          : night.key === tonight
                            ? theme.ember
                            : theme.emberDeep,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.chartDay}>
                  {nightDate(night.key).toLocaleDateString([], { weekday: 'narrow' })}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  promoted: {
    borderWidth: 1,
    borderColor: theme.emberEdge,
    borderRadius: radius.xxl,
    backgroundColor: theme.card,
    // The blooms are drawn well outside the header; without this they'd spill
    // down over the body copy.
    overflow: 'hidden',
  },
  header: {
    height: CARD_HEADER_HEIGHT,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  /** The box the design quotes the light against; the glow is centred in it. */
  bloomBox: {
    position: 'absolute',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(20, 16, 12, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 92, 0.28)',
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 11,
    marginLeft: 20,
    marginBottom: 14,
  },
  badgeText: {
    color: theme.ember,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  promotedBody: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  promotedTitle: {
    color: theme.text,
    fontSize: 19,
    fontWeight: '700',
  },
  promotedText: {
    color: theme.textDim,
    fontSize: 13,
    lineHeight: 18,
    marginTop: space.xs,
  },
  promotedCta: {
    minHeight: 48,
    marginTop: space.md,
  },
  pair: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 14,
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: 'rgba(255, 157, 92, 0.05)',
    borderRadius: radius.xl,
    padding: space.md,
  },
  tilePlate: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.emberGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileName: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  tileMeta: {
    color: theme.textFaint,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  chart: {
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: radius.xl,
    backgroundColor: theme.card,
    padding: 18,
    marginTop: 14,
  },
  chartHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  chartLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  chartTotal: {
    color: theme.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  chartRow: {
    flexDirection: 'row',
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartTrack: {
    height: CHART_TRACK,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 16,
    borderRadius: 5,
  },
  chartDay: {
    color: theme.textFaint,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 10,
  },
});
