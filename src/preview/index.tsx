import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '../theme';
import TonightScreen from '../screens/TonightScreen';
import ProgressScreen from '../screens/ProgressScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ModulesScreen from '../screens/ModulesScreen';
import RoutinesScreen from '../screens/RoutinesScreen';
import RoutineBuilderScreen from '../screens/RoutineBuilderScreen';
import StretchLibraryScreen from '../screens/StretchLibraryScreen';
import MeditationScreen from '../screens/MeditationScreen';
import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RedLightTutorialScreen from '../screens/RedLightTutorialScreen';
import CandleSheet from './CandleSheet';
import PoseSheet from './PoseSheet';
import RoutineScreen from '../screens/RoutineScreen';
import { resolveSteps } from '../routineData';
import { TabsNavigator } from '../navigation';
import { AuthProvider } from '../lib/AuthContext';
import {
  FIXTURES,
  LIGHTING_FIXTURES,
  RESUME_FIXTURES,
  ROUTINE_FIXTURES,
  SETTINGS_FIXTURES,
  EDITABLE_ROUTINE_ID,
} from './fixtures';

/**
 * A development-only harness for looking at one screen in a chosen state.
 *
 * Two things make screens hard to inspect by hand: they sit behind sign-in, and
 * the interesting states — a forty-night streak, a full badge case, an empty
 * history — take weeks to reach honestly. This seeds the local cache and mounts
 * a single screen, so any state is one URL away:
 *
 *   http://localhost:8081/?preview=progress&fixture=veteran
 *
 * The cache is the only thing seeded. With no session, `sessions.ts` reads
 * local and never calls the server, so nothing here can touch real data.
 */

/**
 * `params` seeds the screen's route params, which is the only way to reach a
 * state that normally arrives by navigation — editing an existing routine, say.
 */
const SCREENS: Record<
  string,
  { component: React.ComponentType<any>; params?: object; needsAuth?: boolean }
> = {
  progress: { component: ProgressScreen },
  tonight: { component: TonightScreen },
  modules: { component: ModulesScreen },
  /**
   * Needs the provider for the same reason `auth` does, and had been listed
   * without it — so every attempt to shoot this screen threw inside `useAuth`
   * and hung the run rather than failing loudly. It reads `user?.email` and
   * nothing else, which with no session renders the signed-out dash.
   */
  settings: { component: SettingsScreen, needsAuth: true },
  routines: { component: RoutinesScreen },
  stretches: { component: StretchLibraryScreen },
  meditation: { component: MeditationScreen },
  builder: { component: RoutineBuilderScreen },
  'builder-edit': {
    component: RoutineBuilderScreen,
    params: { routineId: EDITABLE_ROUTINE_ID },
  },
  /**
   * The sign-in screen is the one screen the harness could not previously
   * reach, because avoiding auth is the whole point of it — which left the
   * app's first impression as the only thing nobody could look at. It is the
   * single screen that genuinely needs the provider, so it asks for it.
   *
   * `getSession()` reads local storage and resolves to null here; no session is
   * seeded, nothing is signed in, and no credentials are ever submitted.
   */
  auth: { component: AuthScreen, needsAuth: true },
  /**
   * Shown once, on the one night nobody can go back to, which makes it the
   * screen most in need of a harness. `onDone` is left off deliberately: the
   * real one hands it the swap out of the onboarding stack, and here the last
   * button should do nothing rather than unmount what you came to look at.
   * Walk it with taps:
   *
   *   npm run shoot -- "onboarding:steady@Continue|Continue"
   */
  onboarding: { component: OnboardingScreen },
  redlight: { component: RedLightTutorialScreen },
  /**
   * Not a screen — the badge candles laid out for design work. The only entry
   * here that doesn't exist in the app, and it earns that by being the only way
   * to see all thirteen at a fill of your choosing rather than at whatever fill
   * the fixture's log happens to produce.
   */
  candles: { component: CandleSheet },
  /**
   * Also not a screen: every stretch figure in one grid. Scale and stroke drift
   * between thirty drawings is invisible one at a time and obvious in a grid,
   * which is the only reason this exists. See `PoseSheet.tsx`.
   */
  poses: { component: PoseSheet },
  /**
   * A running session, which is otherwise three taps deep behind a routine.
   * Lands on the get-ready countdown of a two-sided pose — the state with the
   * most in it: the mirrored figure, the side label and the accent timer.
   *
   *   npm run shoot -- session
   */
  session: {
    component: RoutineScreen,
    params: {
      steps: resolveSteps(['figure-four', 'childs-pose', 'legs-up-wall']),
      title: 'Wind-down',
    },
  },
  /**
   * The whole tab bar, with all three nested stacks real. Every other entry
   * here mounts one screen with no navigator around it, which is what makes
   * them cheap — and also what made moving *between* tabs the one thing the
   * harness could not look at. Tapping is enough to walk it:
   *
   *   npm run shoot -- "tabs:steady@Wind|Back|Modules"
   *
   * Needs the provider because Settings sits in the You stack and reads it.
   */
  tabs: { component: TabsNavigator, needsAuth: true },
};

type ScreenName = string;

export type PreviewRequest = {
  screen: ScreenName;
  fixture: string;
};

/** The requested preview, or null for the real app. Web and `__DEV__` only. */
export function previewRequest(): PreviewRequest | null {
  if (!__DEV__ || Platform.OS !== 'web' || typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const screen = params.get('preview');
  if (!screen || !(screen in SCREENS)) return null;

  return { screen: screen as ScreenName, fixture: params.get('fixture') ?? 'steady' };
}

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: theme.bg, text: theme.text, primary: theme.ember },
};

export default function Preview({ request }: { request: PreviewRequest }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const rows = FIXTURES[request.fixture] ?? FIXTURES.steady;
    const routines = ROUTINE_FIXTURES[request.fixture] ?? ROUTINE_FIXTURES.steady;
    const settings = SETTINGS_FIXTURES[request.fixture] ?? SETTINGS_FIXTURES.steady;
    const lighting = LIGHTING_FIXTURES[request.fixture] ?? LIGHTING_FIXTURES.steady;
    // Badges are left unseen on purpose — the NEW treatment is one of the
    // things worth looking at.
    AsyncStorage.multiSet([
      ['profile_cache_v1', JSON.stringify({ reminders: settings })],
      ['session_log_v1', JSON.stringify(rows)],
      ['session_queue_v1', '[]'],
      ['seen_badges_v1', '[]'],
      ['routines_v1', JSON.stringify(routines.routines)],
      ['routines_pending_v1', '[]'],
      ['routines_deleted_v1', '[]'],
      ['active_routine_v1', routines.activeId],
      // Read by both session screens and by Settings. Nothing here can actually
      // change the screen's brightness — `screenDim.ts` is a no-op on web — so
      // what a shot of a dark fixture shows is the warm wash and the banner,
      // not the dim itself. That part is only checkable on a device.
      ['lighting_v1', JSON.stringify(lighting)],
      // Absent in most fixtures, which is the normal state — `loadResume` reads
      // 'null' back as nothing to offer.
      ['session_resume_v1', JSON.stringify(RESUME_FIXTURES[request.fixture] ?? null)],
    ]).then(() => setReady(true));
  }, [request.fixture]);

  // Mounting the screen before the cache lands would show the empty state and
  // then jump, which is exactly the frame a screenshot would catch.
  if (!ready) return null;

  const { component, params, needsAuth } = SCREENS[request.screen];

  const tree = (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Preview" component={component} initialParams={params} />
      </Stack.Navigator>
    </NavigationContainer>
  );

  return needsAuth ? <AuthProvider>{tree}</AuthProvider> : tree;
}
