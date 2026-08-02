import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Flame from '../components/Flame';
import Glow from '../components/Glow';
import Embers, { Speck } from '../components/Embers';
import WeekStrip, { WEEK_LENGTH } from '../components/WeekStrip';
import { theme, space, radius, gradients, WICK_FALLOFF, EMBER_RGB } from '../theme';
import { easing, useAmbientLoop } from '../motion';
import { useReduceMotion } from '../reduceMotion';
import { builtinRoutine, resolveSteps, routineMinutes } from '../routineData';
import { loadActiveRoutine, refreshActiveRoutine } from '../routines';
import type { SavedRoutine } from '../routines';
import { loadCachedSettings, loadSettings } from '../storage';
import type { RoutineSettings } from '../storage';
import { loadProgress, nightOf } from '../sessions';
import { lastNights } from '../streak';
import type { BadgeState } from '../achievements';
import type { TabScreenNavigation } from '../navigation';

/**
 * Tonight, as a wick burning down.
 *
 * Everything on this screen reads off one number. `burn` is 0 when the evening's
 * window opens and 1 when the reminder lands, and the flame, the glow it throws,
 * the embers coming off it and the night closing in behind it are all straight
 * interpolations on it. There is no separate "state" for early evening and late
 * evening, which is the point: the screen is a clock you read without reading.
 *
 * The old numeral hero said the same thing in digits. It was accurate and it was
 * ignorable. This is neither more nor less information — it just cannot be
 * looked at without noticing how much of the evening is gone.
 */

/** How long before the reminder the wick is lit. */
const EVENING_MINUTES = 96;

/** A burn value never jumps in normal use; this is for reopening the app. */
const BURN_SETTLE = 500;

/** The flame is drawn at its largest and scaled down — see `Flame`'s `scale`. */
const FLAME_SIZE = 300;
const FLAME_SCALE = [1, 100 / FLAME_SIZE] as const;

/** The flame box's height, and how far the image hangs below it. */
const BOX_HEIGHT = [202, 110] as const;
const FLAME_DROP = 14;

/**
 * The bloom's CSS box is 2.3 flames across and its light dies at 56% of the
 * half-diagonal, so the light itself spans `2.3 * 0.56 * √2` of a flame. Drawn
 * at full size once and scaled with the flame, since the two are the same shape.
 */
const BLOOM_SIZE = Math.round(FLAME_SIZE * 2.3 * 0.56 * Math.SQRT2);
const BLOOM_PEAK = [0.19, 0.05] as const;

/**
 * The pool of light the flame throws on whatever is under it.
 *
 * The design draws this as a 300 × 140 window onto an ellipse centred on the
 * window's top edge, blurred by 11px. The blur is not a finishing touch here —
 * it is load-bearing. Unblurred, that construction is an ellipse cut across its
 * widest, brightest point, and it reads as the rim of a bowl.
 *
 * `filter` does not exist in React Native, and every way of faking one trades a
 * seam for a seam: a wider copy behind it just brightens the whole pool, and
 * stacking copies clipped at stepped heights turns one hard edge into four
 * softer ones. So what is reproduced here is the design as it *renders* rather
 * than as it is constructed — the blurred original's light peaks about `SINK`
 * below the cut and dies `REACH` below it, and an ellipse placed to do exactly
 * that needs no clipping and therefore has no edge to hide.
 */
const CAST_WIDTH = Math.round(300 * 0.68 * Math.SQRT2);
const CAST_SINK = 30;
const CAST_REACH = Math.round(140 * 0.68 * Math.SQRT2);
const CAST_SQUASH = ((CAST_REACH - CAST_SINK) * 2) / CAST_WIDTH;
/** Below the design's 0.30, because blurring a cut edge halves what shows. */
const CAST_PEAK = [0.24, 0.056] as const;

/** Held constant per screen so the field is recognisable, never re-rolled. */
const EMBER_SPECKS: readonly Speck[] = [
  { x: '18%', size: 3, seconds: 9, delay: 0 },
  { x: '31%', size: 2, seconds: 12, delay: 2.4 },
  { x: '47%', size: 4, seconds: 10.5, delay: 5.1 },
  { x: '58%', size: 2, seconds: 13, delay: 1.2 },
  { x: '72%', size: 3, seconds: 11, delay: 6.8 },
  { x: '84%', size: 2, seconds: 14, delay: 3.6 },
];

const EMBER_FIELD = { top: 113, height: 230, rise: 190 };

const BURN_BAR = { width: 170, height: 3 };

/** How far the descent's text is held off the rail its stops sit on. */
const DESCENT_INSET = 34;

/** The eyebrow row's height before it has been measured, so nothing jumps. */
const EYEBROW_FALLBACK = 15;

function formatTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * How far the evening has burned, and the minutes still on the clock.
 *
 * Clamped at both ends rather than allowed to run negative: at nine in the
 * morning the wick is simply not lit yet, and an hour after the reminder it is
 * as out as it is ever going to get.
 */
function burnedDown(
  reminder: RoutineSettings | null,
  now: Date = new Date()
): { burn: number; minutes: number } {
  if (!reminder?.enabled) return { burn: 0, minutes: EVENING_MINUTES };

  const at = new Date(now);
  at.setHours(reminder.hour, reminder.minute, 0, 0);

  const left = Math.min(EVENING_MINUTES, Math.max(0, (at.getTime() - now.getTime()) / 60_000));
  return { burn: 1 - left / EVENING_MINUTES, minutes: Math.round(left) };
}

/** Down the descent, each step is a little further from the light. */
function descentTone(index: number): { dot: string; name: string } {
  if (index === 0) return { dot: theme.ember, name: theme.text };
  if (index < 3) return { dot: 'rgba(255, 157, 92, 0.55)', name: theme.textDim };
  return { dot: 'rgba(255, 157, 92, 0.2)', name: theme.textFaint };
}

export default function TonightScreen() {
  const navigation = useNavigation<TabScreenNavigation>();
  const insets = useSafeAreaInsets();
  const still = useReduceMotion();

  const [reminder, setReminder] = useState<RoutineSettings | null>(null);
  const [streak, setStreak] = useState(0);
  const [nights, setNights] = useState<Set<string>>(new Set());
  const [earned, setEarned] = useState<BadgeState | null>(null);
  const [routine, setRoutine] = useState<SavedRoutine>(builtinRoutine);
  const [clock, setClock] = useState(() => burnedDown(null));
  const [eyebrowHeight, setEyebrowHeight] = useState(EYEBROW_FALLBACK);

  // Paint from cache immediately so switching tabs never waits on the network,
  // then reconcile with the server in the background — otherwise a fresh
  // install or a second device would show "Anytime" despite a saved reminder.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const take = (s: RoutineSettings) => {
        if (!active) return;
        setReminder(s);
        setClock(burnedDown(s));
      };
      loadCachedSettings().then(take);
      loadSettings().then(take);
      // Same two-step for tonight's routine, so switching it in Modules is
      // reflected here the instant you come back.
      loadActiveRoutine().then((r) => active && setRoutine(r));
      refreshActiveRoutine().then((r) => active && setRoutine(r));
      // Refetched on focus so finishing a routine updates the streak — and
      // announces any badge it just earned — the moment you land back here.
      loadProgress().then((p) => {
        if (!active) return;
        setStreak(p.stats.streak);
        setNights(new Set(p.history.filter((s) => s.completed).map((s) => nightOf(s.ended_at))));
        // Last in catalog order when several land at once — the hardest one
        // earned, rather than whichever happened to be checked first.
        setEarned(p.unseen[p.unseen.length - 1] ?? null);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  // A minute is the smallest step the countdown can show, so it is also the
  // slowest tick that never leaves the screen visibly wrong.
  useEffect(() => {
    const tick = setInterval(() => setClock(burnedDown(reminder)), 60_000);
    return () => clearInterval(tick);
  }, [reminder]);

  const { burn, minutes } = clock;
  const lit = reminder?.enabled === true;

  /**
   * The whole design, as one driven value. Every layer below interpolates off
   * this, which is what keeps the flame, its bloom and its shadow from ever
   * disagreeing about what time it is.
   */
  const burning = useRef(new Animated.Value(burn)).current;
  const at = useCallback(
    (from: number, to: number) => burning.interpolate({ inputRange: [0, 1], outputRange: [from, to] }),
    [burning]
  );

  useEffect(() => {
    Animated.timing(burning, {
      toValue: burn,
      duration: BURN_SETTLE,
      easing: easing.settle,
      useNativeDriver: true,
    }).start();
  }, [burn, burning]);

  const breath = useAmbientLoop(4600, still);
  const sway = useAmbientLoop(7400, still);
  const pulse = useRef(new Animated.Value(0)).current;

  // The ring is the one loop here that does not alternate: it leaves the button
  // and is gone, so there is nothing to come back from.
  useEffect(() => {
    if (still) {
      pulse.setValue(0);
      return;
    }
    const ring = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 3400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    ring.start();
    return () => ring.stop();
  }, [pulse, still]);

  const steps = resolveSteps(routine.stepIds);
  const totalMinutes = routineMinutes(routine.stepIds);
  const boxHeight = BOX_HEIGHT[0] + (BOX_HEIGHT[1] - BOX_HEIGHT[0]) * burn;

  /**
   * Where the flame box starts on screen. The glows are positioned from here
   * and follow the flame down as it shrinks, rather than sitting at a fixed
   * height with the mark drifting out of them.
   */
  const anchor = insets.top + space.md + eyebrowHeight;
  const flameCentre = (i: 0 | 1) => BOX_HEIGHT[i] + FLAME_DROP - (FLAME_SIZE * FLAME_SCALE[i]) / 2;
  const flameScale = at(FLAME_SCALE[0], FLAME_SCALE[1]);

  const litNights = lastNights(WEEK_LENGTH).filter((key) => nights.has(key)).length;
  const shown = steps.slice(0, 4);

  const background = (
    <>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.veil, { opacity: at(0, 0.42) }]}
      />

      {/* Centred on the flame's own centre, so the light tracks the mark. */}
      <Animated.View
        style={[
          styles.bloom,
          {
            top: anchor - BLOOM_SIZE / 2,
            marginLeft: -BLOOM_SIZE / 2,
            opacity: Animated.multiply(
              breath.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
              at(1, BLOOM_PEAK[1] / BLOOM_PEAK[0])
            ),
            transform: [
              { translateY: at(flameCentre(0), flameCentre(1)) },
              {
                scale: Animated.multiply(
                  breath.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] }),
                  flameScale
                ),
              },
            ],
          },
        ]}
      >
        <Glow size={BLOOM_SIZE} peak={BLOOM_PEAK[0]} color={EMBER_RGB} />
      </Animated.View>

      {/* A 300 × 140 window onto the pool the flame throws on the floor. The
          sway pivots on the flame's feet, not on the pool's middle. */}
      <Animated.View
        style={[
          styles.castWindow,
          {
            top: anchor,
            transform: [
              {
                translateY: at(
                  flameCentre(0) + (FLAME_SIZE * FLAME_SCALE[0]) / 2 - 34,
                  flameCentre(1) + (FLAME_SIZE * FLAME_SCALE[1]) / 2 - 34
                ),
              },
              { translateX: sway.interpolate({ inputRange: [0, 1], outputRange: [-10, 11] }) },
              { scaleY: sway.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.06] }) },
            ],
          },
        ]}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: at(1, CAST_PEAK[1] / CAST_PEAK[0]) }]}
        >
          <Glow
            size={CAST_WIDTH}
            squash={CAST_SQUASH}
            peak={CAST_PEAK[0]}
            color={EMBER_RGB}
            style={{ left: 0, top: CAST_SINK - CAST_WIDTH / 2 }}
          />
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[
          styles.emberField,
          { top: anchor + EMBER_FIELD.top, height: EMBER_FIELD.height, opacity: at(1, 0.3) },
        ]}
      >
        <Embers
          specks={EMBER_SPECKS}
          rise={EMBER_FIELD.rise}
          scaleFrom={0.8}
          scaleTo={1.15}
          fadeInAt={0.18}
          peak={0.85}
          color={theme.ember}
          still={still}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </>
  );

  return (
    <Screen ground={gradients.wick} groundStops={WICK_FALLOFF} background={background}>
      <View style={styles.eyebrowRow} onLayout={(e) => setEyebrowHeight(e.nativeEvent.layout.height)}>
        <Text style={styles.eyebrow}>TONIGHT</Text>
        {streak > 0 && <Text style={styles.night}>night {streak}</Text>}
      </View>

      <View style={[styles.flameBox, { height: boxHeight }]}>
        <Animated.View
          style={[
            styles.flameHolder,
            // Scaling happens about the mark's centre, so without this the
            // flame's feet would climb the screen as it shrank instead of
            // staying planted on the box's bottom edge.
            {
              transform: [
                {
                  translateY: at(
                    (FLAME_SIZE * (1 - FLAME_SCALE[0])) / 2,
                    (FLAME_SIZE * (1 - FLAME_SCALE[1])) / 2
                  ),
                },
              ],
            },
          ]}
        >
          <Flame
            size={FLAME_SIZE}
            scale={flameScale}
            dim={at(1, 0.46)}
            still={still}
          />
        </Animated.View>
      </View>

      <View style={styles.countdown}>
        <Text style={styles.countdownValue}>
          {!lit ? 'Anytime' : minutes > 0 ? `${minutes} min` : 'Now'}
        </Text>
        <Text style={styles.countdownCaption}>
          {!lit
            ? "no reminder set — start whenever you're ready"
            : minutes > 0
              ? `until wind-down at ${formatTime(reminder.hour, reminder.minute)}`
              : 'the wick is out — go to bed'}
        </Text>

        {/* No reminder means no window, and a bar reading zero percent burned
            through an evening that was never timed would simply be a lie. */}
        {lit && (
          <>
            <View style={styles.burnTrack}>
              <Animated.View
                style={[
                  styles.burnFillHolder,
                  // Scaled rather than widened: width is not a property the
                  // native driver can drive, and the gradient squashes with the
                  // fill either way.
                  {
                    transform: [
                      { translateX: at(-BURN_BAR.width / 2, 0) },
                      { scaleX: at(0, 1) },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={[theme.emberDeep, theme.ember]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.burnFill}
                />
              </Animated.View>
            </View>
            <Text style={styles.burnLabel}>
              {burn >= 1 ? 'BURNED OUT' : 'EVENING BURNED DOWN'}
            </Text>
          </>
        )}
      </View>

      {earned && (
        <Pressable
          style={styles.earnedCard}
          // Named explicitly rather than just switching tabs: the You stack may
          // have been left sitting on Settings, and a badge card must land on
          // the badge case.
          onPress={() => navigation.navigate('You', { screen: 'Progress' })}
        >
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

      <View style={styles.cta}>
        <Button
          label={lit && minutes === 0 ? 'Start anyway' : 'Light it now'}
          meta={`· ${totalMinutes} min`}
          disabled={steps.length === 0}
          onPress={() => navigation.navigate('Session', { steps, title: routine.name })}
        />
        {/* Drawn over the button rather than behind it: it is a 1px line leaving
            a filled shape, and behind it the first half of every pulse would be
            invisible. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
            },
          ]}
        />
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>THE DESCENT</Text>
        {/* The routine's name doubles as the way to change it — a separate
            "Change" link would say less in the same space. */}
        <Pressable
          style={styles.changeRow}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Tonight's routine: ${routine.name}. Change it.`}
          onPress={() => navigation.navigate('Modules', { screen: 'Routines' })}
        >
          <Text style={styles.changeText} numberOfLines={1}>
            {routine.name}
          </Text>
          <Icon name="chevron" size={14} color={theme.ember} />
        </Pressable>
      </View>

      <View style={styles.descent}>
        <LinearGradient
          colors={[theme.ember, 'rgba(255, 157, 92, 0.35)', 'rgba(255, 157, 92, 0.05)']}
          locations={[0, 0.4, 1]}
          style={styles.rail}
        />
        {shown.map((step, index) => {
          const tone = descentTone(index);
          return (
            // Keyed by position: a custom routine may use the same stretch twice.
            <View key={`${step.id}-${index}`} style={styles.descentRow}>
              <View style={styles.dotRing}>
                <View style={[styles.dot, { backgroundColor: tone.dot }]} />
              </View>
              <Text style={[styles.descentName, { color: tone.name }]} numberOfLines={1}>
                {step.name}
              </Text>
              <Text style={styles.descentTime}>
                {step.seconds >= 60 ? `${Math.round(step.seconds / 60)}m` : `${step.seconds}s`}
              </Text>
            </View>
          );
        })}
        {steps.length > shown.length && (
          <Text style={styles.descentMore}>+ {steps.length - shown.length} more</Text>
        )}
      </View>

      <View style={styles.week}>
        <View style={styles.weekHead}>
          <Text style={styles.sectionLabel}>THIS WEEK</Text>
          <Text style={styles.weekCount}>
            {litNights} of {WEEK_LENGTH} nights lit
          </Text>
        </View>
        <WeekStrip nights={nights} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  veil: {
    backgroundColor: theme.nightVeil,
  },
  bloom: {
    position: 'absolute',
    left: '50%',
    width: BLOOM_SIZE,
    height: BLOOM_SIZE,
  },
  castWindow: {
    position: 'absolute',
    left: '50%',
    marginLeft: -CAST_WIDTH / 2,
    width: CAST_WIDTH,
    height: CAST_REACH,
    // The sway pivots on the flame's feet, not on the middle of the pool.
    transformOrigin: '50% 0%',
  },
  emberField: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: theme.ember,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  night: {
    color: theme.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  flameBox: {
    // Never flexible. This box is the clock's hand — letting it absorb slack
    // would make the flame's height a function of the screen, not the hour.
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'visible',
  },
  flameHolder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -FLAME_DROP,
    alignItems: 'center',
  },
  countdown: {
    alignItems: 'center',
    marginTop: 10,
  },
  countdownValue: {
    color: theme.text,
    fontSize: 44,
    fontWeight: '200',
    letterSpacing: -1,
    lineHeight: 48,
  },
  countdownCaption: {
    color: theme.textDim,
    fontSize: 14,
    marginTop: 2,
  },
  burnTrack: {
    width: BURN_BAR.width,
    height: BURN_BAR.height,
    borderRadius: radius.pill,
    backgroundColor: theme.cardBorder,
    marginTop: 18,
    overflow: 'hidden',
  },
  burnFillHolder: {
    width: BURN_BAR.width,
    height: BURN_BAR.height,
  },
  burnFill: {
    flex: 1,
    borderRadius: radius.pill,
  },
  burnLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginTop: 8,
  },
  earnedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.emberVeil,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.emberEdge,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.md,
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
  cta: {
    marginTop: 18,
  },
  pulseRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 92, 0.6)',
    borderRadius: radius.pill,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginTop: 22,
    marginBottom: space.sm,
  },
  sectionLabel: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    // Keeps a long routine name from pushing the chevron off the row.
    flexShrink: 1,
  },
  changeText: {
    color: theme.ember,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  descent: {
    // The rail and the stops on it are absolutely positioned against this box,
    // so it carries no padding: every row is inset by a *margin* instead.
    // Padding and absolute children are the one place Yoga and CSS have
    // historically disagreed, and this list would be visibly wrong if they did.
    position: 'relative',
  },
  rail: {
    position: 'absolute',
    left: 9,
    top: space.sm,
    bottom: space.sm,
    width: 2,
  },
  descentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingVertical: 6,
    marginLeft: DESCENT_INSET,
  },
  dotRing: {
    // A ring in the screen's own ground, so the rail passes behind each stop
    // rather than through it. Back out the row's inset to land on the rail.
    position: 'absolute',
    left: 5 - DESCENT_INSET - 3,
    top: 7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  descentName: {
    flex: 1,
    fontSize: 15,
  },
  descentTime: {
    color: theme.textFaint,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  descentMore: {
    color: theme.textFaint,
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 6,
    marginLeft: DESCENT_INSET,
  },
  week: {
    // Pushed to the foot of the screen: the evening ends here, and so does the
    // page. Everything above it keeps its natural height.
    marginTop: 'auto',
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.cardBorder,
  },
  weekHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.md - 4,
  },
  weekCount: {
    color: theme.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
});
