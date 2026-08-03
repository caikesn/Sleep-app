import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useScreenLoad } from '../screenLoad';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Flame, { FLAME_BODY } from '../components/Flame';
import Glow from '../components/Glow';
import Embers, { Speck } from '../components/Embers';
import WeekStrip, { WEEK_LENGTH } from '../components/WeekStrip';
import { theme, space, radius, gradients, WICK_FALLOFF, EMBER_RGB } from '../theme';
import { easing, useAmbientLoop } from '../motion';
import { ordinal } from '../format';
import { useReduceMotion } from '../reduceMotion';
import { builtinRoutine, resolveSteps, routineMinutes, stepLength } from '../routineData';
import { loadActiveRoutine, refreshActiveRoutine } from '../routines';
import type { SavedRoutine } from '../routines';
import { type Reminders, loadCachedReminders, loadReminders } from '../storage';
import { type Reminder, fireAtOn } from '../reminders';
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

/**
 * How long before the reminder the wick is lit — the window the burn is drawn
 * across, not a cap on the countdown. The clock keeps honest time outside it.
 */
const EVENING_MINUTES = 96;

/** A burn value never jumps in normal use; this is for reopening the app. */
const BURN_SETTLE = 500;

/**
 * The flame is measured here in points of *visible flame* rather than points of
 * image, which is the whole reason the mark was once too small: the asset is
 * over three times the height of what it draws, so sizing the file understates
 * the flame by a factor of three and the old 300pt image drew an 88pt flame.
 * `FLAME_BODY` is the ratio, and it lives with the asset in `Flame.tsx`.
 */

/**
 * How tall the flame stands at the start of the evening and at the end.
 *
 * It fills the gap between the eyebrow and the countdown, and it gives up only
 * about a tenth of that over the whole evening. The wick burning down is told
 * by the light going out of it — `dim`, the veil and the two glows' peaks — not
 * by the mark shrinking to a pilot light. A flame that halves is a diagram of
 * an evening; one that stays and dims is an evening.
 */
const FLAME_HEIGHT = [190, 168] as const;

const FLAME_SIZE = Math.round(FLAME_HEIGHT[0] / FLAME_BODY);
const FLAME_SCALE = [1, FLAME_HEIGHT[1] / FLAME_HEIGHT[0]] as const;

/** The gap between the flame's base and the countdown beneath it. */
const FLAME_FOOT = 8;

/**
 * The flame box's height. It shrinks by less than the flame does, so the base
 * rides up with the layout while the tip also comes down a little — rather than
 * the flame appearing to shorten from the bottom, which is not how a wick goes.
 */
const BOX_HEIGHT = [202, 186] as const;

/**
 * The bloom around the flame, as a multiple of the flame's own height, and the
 * `Glow` box that holds it — whose light dies at 56% of the half-diagonal, so
 * the lit part spans `0.56 × √2` of the box. Deliberately a tighter multiple
 * than the old mark had: the flame more than doubled, and a bloom that kept its
 * old proportion would be wider than the phone.
 */
const BLOOM_SIZE = Math.round(FLAME_HEIGHT[0] * 3.4);
const BLOOM_PEAK = [0.13, 0.028] as const;

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

/** Pinned to the flame's base, the way it was to the old one's. */
const EMBER_FIELD = { top: BOX_HEIGHT[0] - FLAME_FOOT, height: 230, rise: 190 };

const BURN_BAR = { width: 170, height: 3 };

/** How far the descent's text is held off the rail its stops sit on. */
const DESCENT_INSET = 34;

/**
 * One descent row: 15pt of type on its default line box, plus 6pt either side.
 * The list is given four of them to stand on and grows into whatever the flame
 * and the week strip leave behind — four being what the old capped list showed,
 * so a short routine looks exactly as it did.
 */
const DESCENT_ROW = 32;
const DESCENT_MIN_ROWS = 4;

/** The last few points of the list dissolve rather than being cut off. */
const DESCENT_FADE = 28;

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
 * The two are clamped differently on purpose. `burn` only has meaning inside
 * the evening's window, so it holds at 0 all afternoon and at 1 once the
 * reminder has passed — at nine in the morning the wick is simply not lit yet,
 * and an hour after the reminder it is as out as it is ever going to get.
 * `minutes` is the real time left, however far off that is: capping it at the
 * window meant a reminder six hours away read "96 min", which is just wrong.
 *
 * `null` minutes means there is no wind-down tonight at all — no reminder, one
 * that is switched off, or one set for nights that are not this one.
 *
 * `fireAtOn` rather than the next firing, because a reminder set for weeknights
 * only should leave Saturday unlit — and because once tonight's has passed, the
 * next one is tomorrow, which would relight the wick the moment it went out.
 */
function burnedDown(
  reminder: Reminder | null,
  now: Date = new Date()
): { burn: number; minutes: number | null } {
  const at = reminder ? fireAtOn(reminder, now) : null;
  if (!at) return { burn: 0, minutes: null };

  const left = Math.max(0, (at.getTime() - now.getTime()) / 60_000);
  return { burn: 1 - Math.min(EVENING_MINUTES, left) / EVENING_MINUTES, minutes: Math.round(left) };
}

/**
 * The countdown as the hero says it out loud: `40 min`, `2h`, `5h 20m`.
 *
 * Hours as soon as there is one, because "312 min" is a number you have to do
 * arithmetic on before it tells you anything about your evening.
 */
function formatLeft(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
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

  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [streak, setStreak] = useState(0);
  const [nights, setNights] = useState<Set<string>>(new Set());
  const [earned, setEarned] = useState<BadgeState | null>(null);
  const [routine, setRoutine] = useState<SavedRoutine>(builtinRoutine);
  const [clock, setClock] = useState(() => burnedDown(null));
  const [eyebrowHeight, setEyebrowHeight] = useState(EYEBROW_FALLBACK);
  const [descentView, setDescentView] = useState(0);
  const [descentContent, setDescentContent] = useState(0);
  const descentScroll = useRef(new Animated.Value(0)).current;

  // Paint from cache immediately so switching tabs never waits on the network,
  // then reconcile with the server in the background — otherwise a fresh
  // install or a second device would show "Anytime" despite a saved reminder.
  useScreenLoad(
    useCallback(() => {
      let active = true;
      const take = (r: Reminders) => {
        if (!active) return;
        setReminder(r['wind-down']);
        setClock(burnedDown(r['wind-down']));
      };
      loadCachedReminders().then(take);
      loadReminders().then(take);
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
  /** A wind-down that actually lands tonight — see `burnedDown`. */
  const lit = reminder !== null && minutes !== null;
  /** Set, but not for tonight: a different sentence from having none at all. */
  const offNight = !lit && reminder?.enabled === true;

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
  /**
   * The flame's base and its centre, measured down from `anchor`.
   *
   * The base is the fixed point — a wick stands on its holder — so it is placed
   * first and everything else is derived from it. Both are the *flame's*, not
   * the image's: the asset is over three times the height of what it draws, so
   * the two differ by more than 200pt at this size.
   */
  const flameBase = (i: 0 | 1) => BOX_HEIGHT[i] - FLAME_FOOT;
  const flameCentre = (i: 0 | 1) => flameBase(i) - FLAME_HEIGHT[i] / 2;
  const flameScale = at(FLAME_SCALE[0], FLAME_SCALE[1]);

  /**
   * How far the image is pushed down so its *flame* lands on `flameBase`.
   *
   * Scaling happens about the image's centre, and the image is mostly empty, so
   * without this the flame would float wherever the bloom's padding put it.
   */
  const flameOffset = (i: 0 | 1) =>
    (FLAME_SIZE * (1 - FLAME_BODY * FLAME_SCALE[i])) / 2 - FLAME_FOOT;

  const litNights = lastNights(WEEK_LENGTH).filter((key) => nights.has(key)).length;

  /**
   * How much of the routine is still below the fold, as an opacity.
   *
   * The two heights are state because they change when the routine does, a
   * handful of times an evening. The scroll offset is not: it changes sixty
   * times a second while your thumb is down, so it stays an `Animated.Value`
   * on the native side and never re-renders this screen at all.
   */
  const descentHidden = Math.max(0, descentContent - descentView);
  const moreAbove = descentScroll.interpolate({
    inputRange: [0, DESCENT_FADE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const moreBelow =
    descentHidden > 0
      ? descentScroll.interpolate({
          inputRange: [Math.max(0, descentHidden - DESCENT_FADE), descentHidden],
          outputRange: [1, 0],
          extrapolate: 'clamp',
        })
      : 0;

  const background = (
    <>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.veil, { opacity: at(0, 0.5) }]}
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
                translateY: at(flameBase(0), flameBase(1)),
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
        {streak > 0 && <Text style={styles.night}>{ordinal(streak)} night</Text>}
      </View>

      <View style={[styles.flameBox, { height: boxHeight }]}>
        <Animated.View
          style={[
            styles.flameHolder,
            // Keeps the flame's base on `flameBase` as it shrinks, instead of
            // letting it climb the screen — scaling is about the image's centre
            // and the image is far taller than the flame it holds.
            { transform: [{ translateY: at(flameOffset(0), flameOffset(1)) }] },
          ]}
        >
          <Flame
            size={FLAME_SIZE}
            scale={flameScale}
            // The evening is told here rather than in the flame's height. A
            // quarter of the light left reads as nearly out; a quarter of the
            // height reads as a different, smaller flame.
            dim={at(1, 0.26)}
            still={still}
            // The same value the cast pool below leans on. They are one light,
            // and on separate loops — 7.8s against 14.8s — they visibly drifted
            // apart, the pool sliding left as the flame leaned right.
            lean={sway}
          />
        </Animated.View>
      </View>

      <View style={styles.countdown}>
        <Text style={styles.countdownValue}>
          {!lit ? 'Anytime' : minutes > 0 ? formatLeft(minutes) : 'Now'}
        </Text>
        <Text style={styles.countdownCaption}>
          {!lit
            ? offNight
              ? "no wind-down tonight — start whenever you're ready"
              : "no reminder set — start whenever you're ready"
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
          // the badge case. `initial: false` for the same reason as Routines
          // below — Progress happens to be that stack's home today, so it
          // changes nothing until the day the order changes.
          onPress={() => navigation.navigate('You', { screen: 'Progress', initial: false })}
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
        {/* The count carries what "+ 11 more" used to. A list that shows eight
            of a stated fifteen is visibly partial, which is the part a fade
            alone cannot say — it only appears once you have already started
            scrolling, and the whole problem is knowing to. */}
        <Text style={styles.sectionLabel}>
          THE DESCENT{steps.length > 0 && ` · ${steps.length} STEP${steps.length === 1 ? '' : 'S'}`}
        </Text>
        {/* The routine's name doubles as the way to change it — a separate
            "Change" link would say less in the same space.

            `initial: false` is load-bearing. Jumping into a tab whose stack has
            never mounted *builds* that stack from these params, and without it
            the Modules stack is created holding Routines and nothing else — no
            ModulesHome underneath. Back then leaves the tab entirely, and since
            the stack keeps that shape for the rest of the session, the Modules
            tab can never reach its own home screen again. */}
        <Pressable
          style={styles.changeRow}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Tonight's routine: ${routine.name}. Change it.`}
          onPress={() => navigation.navigate('Modules', { screen: 'Routines', initial: false })}
        >
          <Text style={styles.changeText} numberOfLines={1}>
            {routine.name}
          </Text>
          <Icon name="chevron" size={14} color={theme.ember} />
        </Pressable>
      </View>

      {/* The descent is the one part of this screen that gives, so it takes the
          slack the flame and the week strip refuse to. A long routine scrolls
          inside these bounds rather than growing the page — the flame is a
          clock hand and the week strip is the foot of the evening, and neither
          survives being pushed around by how many stretches you picked. */}
      <View style={styles.descentBox}>
        {/* `Animated.ScrollView`, not `ScrollView`, and the distinction is not
            cosmetic: under the native driver `Animated.event` hands back an
            AnimatedEvent *object* rather than a handler function, and only an
            Animated component knows to attach it natively instead of calling
            it. A plain ScrollView calls it, and calling an object throws on
            the first scroll frame. */}
        <Animated.ScrollView
          style={styles.descentScroll}
          contentContainerStyle={styles.descent}
          showsVerticalScrollIndicator={false}
          onLayout={(e) => setDescentView(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, height) => setDescentContent(height)}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: descentScroll } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={16}
        >
          {/* Inside the scroll, so the rail runs the length of the routine
              rather than the length of the window onto it. */}
          <LinearGradient
            colors={[theme.ember, 'rgba(255, 157, 92, 0.35)', 'rgba(255, 157, 92, 0.05)']}
            locations={[0, 0.4, 1]}
            style={styles.rail}
          />
          {steps.map((step, index) => {
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
                <Text style={styles.descentTime}>{stepLength(step)}</Text>
              </View>
            );
          })}
        </Animated.ScrollView>

        {/* A clipped row is not a signal — it looks like the list ends
            untidily — so whichever end has more behind it dissolves into the
            ground instead, and each fade lifts as you reach that end. Both are
            driven off one natively-animated scroll offset, so dragging the
            list never re-renders the screen. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.descentFade, styles.descentFadeTop, { opacity: moreAbove }]}
        >
          <LinearGradient
            colors={[theme.bg, 'rgba(20, 16, 12, 0)']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[styles.descentFade, styles.descentFadeBottom, { opacity: moreBelow }]}
        >
          <LinearGradient
            colors={['rgba(20, 16, 12, 0)', theme.bg]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
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
    // Sits on the box's bottom edge with no offset of its own: `flameOffset`
    // does all the placing, so there is one number to reason about rather than
    // two that have to be kept in step.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
  descentBox: {
    // Takes the slack. `flexBasis` is what the capped list used to occupy, so a
    // four-step routine is laid out exactly where it always was, and anything
    // longer grows into the gap above the week strip before it starts
    // scrolling. It shrinks too: on a short screen the list gets smaller rather
    // than shoving the week strip off the bottom, which is what a plain
    // `flex: 1` here would do.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: DESCENT_ROW * DESCENT_MIN_ROWS,
  },
  descentScroll: {
    // Both are needed. Without `flexGrow` the ScrollView collapses to its
    // content and the box never bounds it; without `flexShrink` it refuses to
    // give the box back any height and scrolls nothing.
    flexGrow: 1,
    flexShrink: 1,
  },
  descent: {
    // The rail and the stops on it are absolutely positioned against this box,
    // so it carries no padding: every row is inset by a *margin* instead.
    // Padding and absolute children are the one place Yoga and CSS have
    // historically disagreed, and this list would be visibly wrong if they did.
    position: 'relative',
  },
  descentFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: DESCENT_FADE,
  },
  descentFadeTop: {
    top: 0,
  },
  descentFadeBottom: {
    bottom: 0,
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
  week: {
    // The descent above now absorbs the slack, so this no longer needs
    // `marginTop: 'auto'` to be pushed down — and keeping it would fight the
    // list for the same space.
    paddingTop: 14,
    // The tab bar butts straight up against the body, so the strip has to hold
    // itself off it — without this the day letters sit on the bar's top rule.
    paddingBottom: space.md,
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
