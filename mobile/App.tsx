import React, { useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AppNavigator } from './src/navigation';
import { useCartStore, useSettingsStore } from './src/store';
import { SplashScreenComponent } from './src/components/SplashScreen';
import { ThemeProvider } from './src/contexts/ThemeContext';

// Prevent native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function App() {
  const loadCart = useCartStore((state) => state.loadCart);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const [appIsReady, setAppIsReady] = React.useState(false);
  const [showSplash, setShowSplash] = React.useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        // Hide native splash immediately
        await SplashScreen.hideAsync();
        
        // Load persisted data
        await Promise.all([
          loadCart(),
          loadSettings(),
        ]);
        
        // Show our custom splash for 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn('Error loading app data:', e);
      } finally {
        setAppIsReady(true);
        setShowSplash(false);
      }
    }

    prepare();
  }, []);

  // Show custom splash screen while loading
  if (showSplash || !appIsReady) {
    return <SplashScreenComponent />;
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
