import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNavigationContainerRef } from '@react-navigation/native';
import Navigation, { RootStackParamList } from './src/navigation';
import { AuthProvider } from './src/lib/AuthContext';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Navigation navigationRef={navigationRef} />
      </AuthProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
