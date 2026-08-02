import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Motion for an app used in the dark, half an hour before sleep.
 *
 * The defaults every UI toolkit ships are tuned for daytime software, where
 * snappy reads as responsive. Here the same curves read as urgent. Three rules
 * hold everywhere in this app:
 *
 * 1. **Nothing overshoots.** No springs, no bounce, no elastic. Overshoot is
 *    the grammar of play, and it is also the one thing that reliably pulls the
 *    eye back to a screen you are trying to put down.
 * 2. **Opacity and scale, not travel.** Things here fade and settle. Sliding
 *    panels are a lot of movement in peripheral vision.
 * 3. **Everything is native-driven.** The breathing pacer already proved the
 *    point: a shape redrawn from a JS ticker stutters, and a stuttering
 *    animation is worse than none, because you end up watching it.
 *
 * The one deliberate exception to "slow" is `press`. Touch feedback has to
 * arrive inside about 100ms or the control feels broken rather than calm.
 */

export const duration = {
  /** Touch feedback. Fast because late feedback reads as a dropped tap. */
  press: 90,
  /** Releasing a press — slower than the push, so it settles rather than snaps. */
  release: 220,
  /** Content arriving: a screen's first paint, a section appearing. */
  enter: 380,
  /** Something leaving, or a wash coming up behind a session. */
  exit: 260,
  /** One full cycle of an idling, breathing element. */
  breath: 4600,
};

export const easing = {
  /**
   * The default for anything arriving or leaving. Decelerating, and it ends
   * exactly at its target — `Easing.out(Easing.cubic)` and not `Easing.elastic`
   * or `Easing.back`, both of which pass their target and come back.
   */
  settle: Easing.out(Easing.cubic),
  /** For loops, so the turn at each end is as soft as the middle. */
  breathe: Easing.inOut(Easing.quad),
  /** Going down under the finger. Linear-ish; there is nothing to decelerate. */
  press: Easing.out(Easing.quad),
};

/**
 * A value that drifts 0 → 1 → 0 forever, for something that idles: a breathing
 * bloom, a swaying cast light, a glow behind a card.
 *
 * Alternating rather than resetting, so there is no seam where the animation
 * snaps back to its start — the turn at each end is as soft as the middle,
 * which is the whole reason `easing.breathe` exists.
 *
 * `still` parks it at the mid point for reduced motion. That holds the element
 * at its average brightness and size instead of removing it, so the layout and
 * the lighting are the same either way and only the movement goes.
 */
export function useAmbientLoop(halfCycleMs: number, still?: boolean): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) {
      value.setValue(0.5);
      return;
    }

    const leg = (to: number) =>
      Animated.timing(value, {
        toValue: to,
        duration: halfCycleMs,
        easing: easing.breathe,
        useNativeDriver: true,
      });

    const cycle = Animated.loop(Animated.sequence([leg(1), leg(0)]));
    cycle.start();
    return () => cycle.stop();
  }, [value, halfCycleMs, still]);

  return value;
}

/** How far a pressed control shrinks. Small — this is felt, not watched. */
export const PRESS_SCALE = 0.97;

/** How far content rises as it fades in. Enough to read as arriving, no more. */
export const ENTER_RISE = 8;
