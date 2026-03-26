import React, { useEffect, useCallback } from 'react';
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
  const [appIsReady, setAppIsReady] = React.useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Load persisted data
        await Promise.all([
          loadCart(),
          loadSettings(),
        ]);
        // Minimum splash display time for branding
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (e) {
        console.warn('Error loading app data:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // Hide splash screen after app is ready
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <StatusBar style="light" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
