import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '../theme';
import TonightScreen from '../screens/TonightScreen';
import ProgressScreen from '../screens/ProgressScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { FIXTURES } from './fixtures';

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

const SCREENS = {
  progress: ProgressScreen,
  tonight: TonightScreen,
  settings: SettingsScreen,
} as const;

type ScreenName = keyof typeof SCREENS;

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
    // Badges are left unseen on purpose — the NEW treatment is one of the
    // things worth looking at.
    AsyncStorage.multiSet([
      ['session_log_v1', JSON.stringify(rows)],
      ['session_queue_v1', '[]'],
      ['seen_badges_v1', '[]'],
    ]).then(() => setReady(true));
  }, [request.fixture]);

  // Mounting the screen before the cache lands would show the empty state and
  // then jump, which is exactly the frame a screenshot would catch.
  if (!ready) return null;

  const Component = SCREENS[request.screen];

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Preview" component={Component} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
