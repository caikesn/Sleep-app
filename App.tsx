import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import HomeScreen from './src/screens/HomeScreen';
import RoutineScreen from './src/screens/RoutineScreen';
import { NIGHT_ROUTINE_CATEGORY } from './src/notifications';

type Screen = 'home' | 'routine';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === NIGHT_ROUTINE_CATEGORY) {
        setScreen('routine');
      }
    });

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  return (
    <>
      {screen === 'home' ? (
        <HomeScreen onStartRoutine={() => setScreen('routine')} />
      ) : (
        <RoutineScreen onFinish={() => setScreen('home')} />
      )}
      <StatusBar style="light" />
    </>
  );
}
