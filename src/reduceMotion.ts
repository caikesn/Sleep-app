import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the device asks for reduced motion.
 *
 * The ambient loops in this app — a breathing bloom, drifting embers, a swaying
 * cast light — are the exact class of thing the setting exists to switch off:
 * they never stop, and they sit in peripheral vision. Callers hold them at their
 * mid value rather than removing the element, so the layout is identical either
 * way and only the movement goes.
 *
 * Subscribed rather than read once, because it can be toggled from Control
 * Centre while the app is open.
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (active) setReduced(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
