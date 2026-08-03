import { Linking, Platform } from 'react-native';

/**
 * Opening the phone's own settings, and being honest about how far that gets.
 *
 * The two things that actually matter for night light — a system-wide red
 * filter and the display's warm mode — live in system settings, and no app can
 * turn either one on. The most we can do is shorten the walk.
 *
 * The platforms are not equally cooperative, and pretending otherwise is the
 * trap here:
 *
 * - **Android** has public intents for these screens, so a tap really does land
 *   on Display or on Accessibility. `Linking.sendIntent` is in React Native
 *   itself, so this costs no dependency.
 * - **iOS** has no supported way to deep-link into another part of Settings.
 *   The `App-Prefs:` scheme that turns up in search results is private, and
 *   shipping it risks the app being pulled; `openSettings()` reaches Wick's own
 *   page and no further.
 *
 * So iOS gets the Settings app and a caption that says what to tap next, rather
 * than a button that promises Display & Brightness and delivers a page with a
 * notifications toggle on it. The written steps in the red-light tutorial are
 * the real answer on iOS, and this is the shortcut to their starting point.
 */

/** Whether a tap lands on the screen it names, or merely near it. */
export const DEEP_LINKS_TO_SYSTEM = Platform.OS === 'android';

async function open(action: string): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent(action);
      return;
    } catch {
      // Manufacturers do rename and remove these. Falling through to the app's
      // own page is still the Settings app, which beats nothing happening.
    }
  }

  try {
    await Linking.openSettings();
  } catch {
    // Nothing left to try, and a failed deep link is not worth an alert on a
    // screen someone opened at eleven at night.
  }
}

/** Display & Brightness / Display — where the warm night mode lives. */
export function openDisplaySettings(): Promise<void> {
  return open('android.settings.DISPLAY_SETTINGS');
}

/** Accessibility — where the real red filter lives, on both platforms. */
export function openAccessibilitySettings(): Promise<void> {
  return open('android.settings.ACCESSIBILITY_SETTINGS');
}

/**
 * The caption under a settings link, per platform. Kept here beside the reason
 * it differs, so the two can't drift apart in a later edit to one screen.
 */
export const SETTINGS_LINK_COPY = {
  display: DEEP_LINKS_TO_SYSTEM
    ? 'Night Light and the brightness slider'
    : 'Opens Settings — Display & Brightness is two taps down',
  accessibility: DEEP_LINKS_TO_SYSTEM
    ? 'Colour adjustment, and the shortcut for it'
    : 'Opens Settings — Accessibility is further down the list',
};
