import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { theme, space, radius } from '../theme';
import { PHASE_LABELS, phaseAt, scaleFor } from '../breathing';
import type { BreathPattern, PhaseAt } from '../breathing';

/**
 * The breathing pacer: a circle that grows on the inhale, holds where it is
 * through a hold, and shrinks on the exhale.
 *
 * Two clocks, on purpose. Which phase you are in comes from elapsed wall time,
 * so twenty minutes in it is still exactly right. The circle's movement is a
 * native-driven animation, because a shape redrawn from a JS ticker stutters,
 * and a stuttering pacer is worse than no pacer — you end up watching it
 * instead of breathing. They meet at each phase change, where the animation is
 * handed the time that phase has *actually* got left, which is what stops the
 * two drifting apart.
 */

const SIZE = 232;
/** The orb never vanishes: an empty ring gives you nothing to breathe back to. */
const MIN_SCALE = 0.4;
const TICK_MS = 200;

type Props = {
  pattern: BreathPattern;
  running: boolean;
};

/** Where the orb should end up by the end of a phase. */
function targetScale(at: PhaseAt): number {
  switch (at.phase.kind) {
    case 'inhale':
    case 'hold':
      return 1;
    case 'exhale':
    case 'hold-out':
      return 0;
  }
}

const toOrb = (value: number) => MIN_SCALE + value * (1 - MIN_SCALE);

export default function BreathingPacer({ pattern, running }: Props) {
  const [at, setAt] = useState<PhaseAt>(() => phaseAt(pattern, 0));

  // Elapsed is accumulated across pauses rather than read off a single start
  // time, so pausing for a minute doesn't fast-forward the pattern.
  const bankedRef = useRef(0);
  const startedRef = useRef<number | null>(null);
  // -1 means "no phase animated yet", so the next tick always starts one.
  const phaseRef = useRef(-1);

  const scale = useRef(new Animated.Value(toOrb(scaleFor(phaseAt(pattern, 0))))).current;

  // A new pattern is a new session for the orb: reset rather than easing over
  // from wherever the old one happened to be.
  useEffect(() => {
    bankedRef.current = 0;
    startedRef.current = running ? Date.now() : null;
    phaseRef.current = -1;
    setAt(phaseAt(pattern, 0));
  }, [pattern]);

  useEffect(() => {
    if (!running) {
      if (startedRef.current !== null) {
        bankedRef.current += (Date.now() - startedRef.current) / 1000;
        startedRef.current = null;
      }
      scale.stopAnimation();
      return;
    }

    startedRef.current = Date.now();
    // Re-arm on resume so the current phase is treated as new and the orb is
    // handed a fresh, correct duration rather than continuing a stopped one.
    phaseRef.current = -1;

    const id = setInterval(() => {
      const started = startedRef.current;
      const elapsed = bankedRef.current + (started === null ? 0 : (Date.now() - started) / 1000);
      const next = phaseAt(pattern, elapsed);
      setAt(next);

      // Index alone is enough to spot a boundary: no pattern repeats a phase
      // back to back, so consecutive phases always differ, including the wrap
      // from the last phase round to the first.
      if (phaseRef.current === next.index) return;
      phaseRef.current = next.index;

      Animated.timing(scale, {
        toValue: toOrb(targetScale(next)),
        // The time this phase has left, not its full length — a phase entered
        // slightly late must still finish on the beat.
        duration: Math.max(1, next.phase.seconds * (1 - next.progress) * 1000),
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, TICK_MS);

    return () => clearInterval(id);
  }, [pattern, running, scale]);

  return (
    <View style={styles.stage}>
      <View style={styles.ring} />
      <Animated.View style={[styles.orb, { transform: [{ scale }] }]} />
      <View style={styles.caption} pointerEvents="none">
        <Text style={styles.phase}>{PHASE_LABELS[at.phase.kind]}</Text>
        <Text style={styles.count}>{at.remaining}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
  },
  orb: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
    backgroundColor: theme.emberGlow,
    borderWidth: 1,
    borderColor: theme.emberEdge,
  },
  caption: {
    alignItems: 'center',
  },
  phase: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '600',
  },
  count: {
    color: theme.ember,
    fontSize: 44,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    marginTop: space.xs,
  },
});
