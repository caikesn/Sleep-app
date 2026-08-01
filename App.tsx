import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNavigationContainerRef } from '@react-navigation/native';
import Navigation, { RootStackParamList } from './src/navigation';
import { AuthProvider } from './src/lib/AuthContext';
import Preview, { previewRequest } from './src/preview';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  // Development only, and only when the URL asks for it — see src/preview.
  const preview = previewRequest();
  if (preview) {
    return (
      <SafeAreaProvider>
        <Preview request={preview} />
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Navigation navigationRef={navigationRef} />
      </AuthProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
