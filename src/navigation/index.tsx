import React, { useCallback, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import type { CompositeNavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import { theme } from '../theme';
import { defaultRoutine, RoutineStep } from '../routineData';
import { NIGHT_ROUTINE_CATEGORY } from '../notifications';
import { useAuth } from '../lib/AuthContext';
import TabBar from '../components/TabBar';
import AuthScreen from '../screens/AuthScreen';
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
  BottomTabNavigationProp<TabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();
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

function TabsNavigator() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
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

  // A reminder tapped while signed out can't go straight to the session — that
  // route only exists in the signed-in stack. Hold the intent and honour it
  // once a session appears.
  const pendingSession = useRef(false);

  const consumePendingSession = useCallback(() => {
    if (!pendingSession.current || !signedIn || !navigationRef.isReady()) return;
    pendingSession.current = false;
    navigationRef.navigate('Session', { steps: defaultRoutine, title: 'Night Routine' });
  }, [signedIn, navigationRef]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.content.data?.type !== NIGHT_ROUTINE_CATEGORY) return;
      pendingSession.current = true;
      consumePendingSession();
    });
    return () => sub.remove();
  }, [consumePendingSession]);

  useEffect(consumePendingSession, [consumePendingSession]);

  // Held until the persisted session is read back, so we never flash the sign-in
  // screen at someone who is already logged in.
  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.ember} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {signedIn ? (
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
        ) : (
          <RootStack.Group>
            <RootStack.Screen name="Auth" component={AuthScreen} />
            <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </RootStack.Group>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
