import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';

/**
 * Load a screen's data: once when it mounts, and again every time it is
 * returned to.
 *
 * `useFocusEffect` alone was enough while the tabs were a bottom-tab navigator,
 * because that renders exactly one screen and being rendered and being focused
 * were the same thing. They stopped being the same thing when the tabs became a
 * pager: the page you are swiping towards is drawn, at full size, beside the
 * one you are on — and it is not focused until you let go. A screen that waits
 * for focus therefore spends the whole gesture showing its empty state and
 * snaps into having content the moment you land, which is exactly the flicker
 * the swipe was added to avoid.
 *
 * The mount pass is skipped when the screen is already focused, since the focus
 * effect covers that in the same commit — so the tab the app opens on still
 * fetches once, not twice.
 *
 * `load` must be stable (wrap it in `useCallback`), the same requirement
 * `useFocusEffect` already has. It may return a cleanup.
 */
export function useScreenLoad(load: () => void | (() => void)) {
  const focusedNow = useIsFocused();
  const focusedAtMount = useRef(focusedNow);

  useEffect(() => {
    if (focusedAtMount.current) return;
    return load();
  }, [load]);

  useFocusEffect(useCallback(() => load(), [load]));
}
