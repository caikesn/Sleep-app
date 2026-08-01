import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme } from '../theme';
import { RoutineStep } from '../routineData';
import TabBar from '../components/TabBar';
import TonightScreen from '../screens/TonightScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ModulesScreen from '../screens/ModulesScreen';
import StretchLibraryScreen from '../screens/StretchLibraryScreen';
import RoutineScreen from '../screens/RoutineScreen';
import MeditationScreen from '../screens/MeditationScreen';
import RedLightTutorialScreen from '../screens/RedLightTutorialScreen';

export type RootStackParamList = {
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
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Tabs" component={TabsNavigator} />
        {/* Timed sessions sit above the tabs so nothing competes for attention. */}
        <RootStack.Screen name="Session" component={RoutineScreen} />
        <RootStack.Screen name="Meditation" component={MeditationScreen} />
        <RootStack.Screen
          name="RedLightTutorial"
          component={RedLightTutorialScreen}
          options={{ presentation: 'modal' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
