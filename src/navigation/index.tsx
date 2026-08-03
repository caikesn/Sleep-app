import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import type { CompositeNavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type { MaterialTopTabNavigationProp } from '@react-navigation/material-top-tabs';
import * as Notifications from 'expo-notifications';
import { theme } from '../theme';
import { resolveSteps, RoutineStep } from '../routineData';
import { applyReminders, reminderFromResponse } from '../notifications';
import { loadActiveRoutine } from '../routines';
import { loadReminders } from '../storage';
import { useAuth } from '../lib/AuthContext';
import { clearOnboardingPending, isOnboardingPending } from '../onboarding';
import TabBar from '../components/TabBar';
import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import TonightScreen from '../screens/TonightScreen';
import ProgressScreen from '../screens/ProgressScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ModulesScreen from '../screens/ModulesScreen';
import StretchLibraryScreen from '../screens/StretchLibraryScreen';
import RoutinesScreen from '../screens/RoutinesScreen';
import RoutineBuilderScreen from '../screens/RoutineBuilderScreen';
import RoutineScreen from '../screens/RoutineScreen';
import MeditationScreen from '../screens/MeditationScreen';
import RedLightTutorialScreen from '../screens/RedLightTutorialScreen';

export type RootStackParamList = {
  Auth: undefined;
  ForgotPassword: undefined;
  Onboarding: undefined;
  Tabs: undefined;
  Session: { steps: RoutineStep[]; title: string };
  Meditation: undefined;
  RedLightTutorial: undefined;
};

/**
 * The nested stacks are named in the params so a screen in one tab can deep-link
 * into another — Tonight jumps straight to the routine list, not just to Modules.
 */
export type TabParamList = {
  Tonight: undefined;
  Modules: NavigatorScreenParams<ModulesStackParamList>;
  You: NavigatorScreenParams<YouStackParamList>;
};

export type ModulesStackParamList = {
  ModulesHome: undefined;
  StretchLibrary: undefined;
  Routines: undefined;
  /** No id builds a new routine; `duplicate` copies one instead of editing it. */
  RoutineBuilder: { routineId?: string; duplicate?: boolean } | undefined;
};

export type YouStackParamList = {
  Progress: undefined;
  Settings: undefined;
};

/**
 * Tonight both pushes a session onto the root stack and jumps to another tab,
 * so it needs both navigators' methods rather than a cast that happens to work.
 */
export type TabScreenNavigation = CompositeNavigationProp<
  MaterialTopTabNavigationProp<TabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

const RootStack = createNativeStackNavigator<RootStackParamList>();

/**
 * Top tabs, worn at the bottom.
 *
 * The bottom-tab navigator has no swipe and never will — it renders one screen
 * at a time, so there is nothing beside the current page for a gesture to drag
 * in. This one is a pager: the three tabs are laid out side by side and the
 * page follows your thumb. `tabBarPosition` is the only thing that makes it
 * "top" tabs, and it is set to bottom here.
 *
 * On iOS and Android that pager is `react-native-pager-view`, a native scroll
 * view, so the swipe never touches the JS thread. On web `react-native-tab-view`
 * falls back to a PanResponder — which is what keeps the screenshot harness
 * working, and also why the web build's swipe is the rougher of the two.
 */
const Tabs = createMaterialTopTabNavigator<TabParamList>();
const ModulesStack = createNativeStackNavigator<ModulesStackParamList>();
const YouStack = createNativeStackNavigator<YouStackParamList>();

// Keeps browsing the library inside the Modules tab, so the tab bar stays put.
function ModulesNavigator() {
  return (
    <ModulesStack.Navigator screenOptions={{ headerShown: false }}>
      <ModulesStack.Screen name="ModulesHome" component={ModulesScreen} />
      <ModulesStack.Screen name="StretchLibrary" component={StretchLibraryScreen} />
      <ModulesStack.Screen name="Routines" component={RoutinesScreen} />
      <ModulesStack.Screen name="RoutineBuilder" component={RoutineBuilderScreen} />
    </ModulesStack.Navigator>
  );
}

// Progress is the tab's home and settings sit behind it: streaks and badges are
// looked at often, the reminder time is set once.
function YouNavigator() {
  return (
    <YouStack.Navigator screenOptions={{ headerShown: false }}>
      <YouStack.Screen name="Progress" component={ProgressScreen} />
      <YouStack.Screen name="Settings" component={SettingsScreen} />
    </YouStack.Navigator>
  );
}

/**
 * Exported so the preview harness can mount the real thing. Deep-linking
 * between tabs is the one behaviour that only exists once all three stacks are
 * assembled, so a harness that mounts screens one at a time cannot see it.
 */
export function TabsNavigator() {
  return (
    <Tabs.Navigator
      tabBarPosition="bottom"
      tabBar={(props) => <TabBar {...props} />}
      // Every tab is mounted up front rather than on first visit. A pager has
      // to have the next page drawn before the gesture starts — lazily mounting
      // it means the first swipe drags in a blank, which is the one thing that
      // would make this worse than tapping.
      screenOptions={{ lazy: false, sceneStyle: styles.scene }}
    >
      <Tabs.Screen name="Tonight" component={TonightScreen} options={{ title: 'Tonight' }} />
      <Tabs.Screen name="Modules" component={ModulesNavigator} options={{ title: 'Modules' }} />
      <Tabs.Screen name="You" component={YouNavigator} options={{ title: 'You' }} />
    </Tabs.Navigator>
  );
}

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.bg,
    card: theme.bgRaised,
    text: theme.text,
    border: theme.cardBorder,
    primary: theme.ember,
    notification: theme.ember,
  },
};

export default function Navigation({ navigationRef }: { navigationRef: any }) {
  const { session, initializing, recovering } = useAuth();

  // Verifying a recovery code creates a session before the new password is
  // saved. Holding the swap keeps the reset screen mounted until it lands.
  const signedIn = !!session && !recovering;

  /**
   * Whether the first-run walkthrough is still owed. `null` means "not read
   * yet" — the swap below waits on it rather than guessing, because guessing
   * `false` would show a frame of Tonight before onboarding replaced it, and
   * guessing `true` would flash the walkthrough at everybody else.
   */
  const [onboarding, setOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (!signedIn) {
      setOnboarding(null);
      return;
    }
    let active = true;
    isOnboardingPending().then((pending) => {
      if (active) setOnboarding(pending);
    });
    return () => {
      active = false;
    };
  }, [signedIn]);

  function finishOnboarding() {
    // Cleared whether it was walked through or skipped: both mean seen.
    clearOnboardingPending();
    setOnboarding(false);
  }

  // A reminder tapped while signed out can't go straight to the session — that
  // route only exists in the signed-in stack. Hold the intent and honour it
  // once a session appears.
  const pendingSession = useRef(false);

  const consumePendingSession = useCallback(() => {
    // Onboarding is its own group, without a `Session` route in it — and
    // dropping someone into a timed routine mid-walkthrough would be the wrong
    // answer even if the route existed. The intent is held until they are out.
    if (onboarding !== false) return;
    if (!pendingSession.current || !signedIn || !navigationRef.isReady()) return;
    pendingSession.current = false;
    // Whichever routine Tonight would have started, not the built-in one — a
    // reminder that ignores the routine you saved is worse than no shortcut.
    loadActiveRoutine().then((routine) => {
      navigationRef.navigate('Session', {
        steps: resolveSteps(routine.stepIds),
        title: routine.name,
      });
    });
  }, [signedIn, onboarding, navigationRef]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      // Only the wind-down reminder opens anything. Lights out has done its job
      // the moment it is read — sending someone into the app at a quarter to
      // eleven is the opposite of what it asked them to do.
      if (reminderFromResponse(response) !== 'wind-down') return;
      pendingSession.current = true;
      consumePendingSession();
    });
    return () => sub.remove();
  }, [consumePendingSession]);

  useEffect(consumePendingSession, [consumePendingSession]);

  /**
   * Re-register the stored reminders once a session appears.
   *
   * Pending notifications do not survive a reinstall, and the OS drops them on
   * a restore to a new device — but the settings do survive, in the profile
   * row. Without this, Settings would keep showing a reminder that was silently
   * no longer scheduled, and the only way to fix it would be to toggle it off
   * and on. Rescheduling is cancel-then-register per key, so running it every
   * launch is a no-op when nothing has changed.
   */
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    loadReminders().then((reminders) => {
      if (active) applyReminders(Object.values(reminders));
    });
    return () => {
      active = false;
    };
  }, [signedIn]);

  // Held until the persisted session is read back, so we never flash the sign-in
  // screen at someone who is already logged in — and, once it is, until the
  // onboarding flag has been read for the same reason.
  if (initializing || (signedIn && onboarding === null)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.ember} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!signedIn ? (
          <RootStack.Group>
            <RootStack.Screen name="Auth" component={AuthScreen} />
            <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </RootStack.Group>
        ) : onboarding ? (
          // A group of its own, so a first run has nowhere else to navigate to
          // and no back gesture out of the middle of it. Finishing swaps the
          // whole group for the app below.
          <RootStack.Group>
            <RootStack.Screen name="Onboarding">
              {() => <OnboardingScreen onDone={finishOnboarding} />}
            </RootStack.Screen>
          </RootStack.Group>
        ) : (
          <RootStack.Group>
            <RootStack.Screen name="Tabs" component={TabsNavigator} />
            {/* Timed sessions sit above the tabs so nothing competes for attention. */}
            <RootStack.Screen name="Session" component={RoutineScreen} />
            <RootStack.Screen name="Meditation" component={MeditationScreen} />
            <RootStack.Screen
              name="RedLightTutorial"
              component={RedLightTutorialScreen}
              options={{ presentation: 'modal' }}
            />
          </RootStack.Group>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  /**
   * Each tab draws its own gradient ground edge to edge, so the pager's own
   * surface must never show. Left at its default it is the theme's card colour,
   * which reads as a pale seam sliding between pages mid-swipe.
   */
  scene: {
    backgroundColor: theme.bg,
  },
  loading: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
