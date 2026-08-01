import React, { useCallback, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import { theme } from '../theme';
import { defaultRoutine, RoutineStep } from '../routineData';
import { NIGHT_ROUTINE_CATEGORY } from '../notifications';
import { useAuth } from '../lib/AuthContext';
import TabBar from '../components/TabBar';
import AuthScreen from '../screens/AuthScreen';
import TonightScreen from '../screens/TonightScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ModulesScreen from '../screens/ModulesScreen';
import StretchLibraryScreen from '../screens/StretchLibraryScreen';
import RoutineScreen from '../screens/RoutineScreen';
import MeditationScreen from '../screens/MeditationScreen';
import RedLightTutorialScreen from '../screens/RedLightTutorialScreen';

export type RootStackParamList = {
  Auth: undefined;
  Tabs: undefined;
  Session: { steps: RoutineStep[]; title: string };
  Meditation: undefined;
  RedLightTutorial: undefined;
};

export type TabParamList = {
  Tonight: undefined;
  Modules: undefined;
  You: undefined;
};

export type ModulesStackParamList = {
  ModulesHome: undefined;
  StretchLibrary: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();
const ModulesStack = createNativeStackNavigator<ModulesStackParamList>();

// Keeps browsing the library inside the Modules tab, so the tab bar stays put.
function ModulesNavigator() {
  return (
    <ModulesStack.Navigator screenOptions={{ headerShown: false }}>
      <ModulesStack.Screen name="ModulesHome" component={ModulesScreen} />
      <ModulesStack.Screen name="StretchLibrary" component={StretchLibraryScreen} />
    </ModulesStack.Navigator>
  );
}

function TabsNavigator() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="Tonight" component={TonightScreen} options={{ title: 'Tonight' }} />
      <Tabs.Screen name="Modules" component={ModulesNavigator} options={{ title: 'Modules' }} />
      <Tabs.Screen name="You" component={SettingsScreen} options={{ title: 'You' }} />
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
  const { session, initializing } = useAuth();

  // A reminder tapped while signed out can't go straight to the session — that
  // route only exists in the signed-in stack. Hold the intent and honour it
  // once a session appears.
  const pendingSession = useRef(false);

  const consumePendingSession = useCallback(() => {
    if (!pendingSession.current || !session || !navigationRef.isReady()) return;
    pendingSession.current = false;
    navigationRef.navigate('Session', { steps: defaultRoutine, title: 'Night Routine' });
  }, [session, navigationRef]);

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
        {session ? (
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
          <RootStack.Screen name="Auth" component={AuthScreen} />
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
