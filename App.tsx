import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import Navigation, { RootStackParamList } from './src/navigation';
import { NIGHT_ROUTINE_CATEGORY } from './src/notifications';
import { defaultRoutine } from './src/routineData';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === NIGHT_ROUTINE_CATEGORY && navigationRef.isReady()) {
        navigationRef.navigate('Session', { steps: defaultRoutine, title: 'Night Routine' });
      }
    });

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <Navigation navigationRef={navigationRef} />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
