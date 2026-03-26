import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AppNavigator } from './src/navigation';
import { useCartStore, useSettingsStore } from './src/store';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function App() {
  const loadCart = useCartStore((state) => state.loadCart);
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    async function prepare() {
      try {
        // Load persisted data
        await Promise.all([
          loadCart(),
          loadSettings(),
        ]);
      } catch (e) {
        console.warn('Error loading app data:', e);
      } finally {
        // Hide splash screen
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
