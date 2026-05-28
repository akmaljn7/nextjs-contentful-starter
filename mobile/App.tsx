import React, { useEffect, useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { AppNavigator } from './src/navigation';
import { useCartStore, useSettingsStore, useAuthStore } from './src/store';
import { SplashScreenComponent } from './src/components/SplashScreen';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { I18nProvider } from './src/i18n';
import { InAppNotification } from './src/components/notifications/InAppNotification';
import { notificationService, NotificationData } from './src/services/notificationService';

// Prevent native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function App() {
  const loadCart = useCartStore((state) => state.loadCart);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [appIsReady, setAppIsReady] = React.useState(false);
  const [showSplash, setShowSplash] = React.useState(true);
  
  // In-app notification state
  const [notification, setNotification] = useState<{
    visible: boolean;
    title: string;
    body: string;
    type: NotificationData['type'] | 'default';
    data?: NotificationData;
  }>({
    visible: false,
    title: '',
    body: '',
    type: 'default',
  });

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

  // Register push notifications when user is authenticated
  useEffect(() => {
    if (isAuthenticated && appIsReady) {
      // Add a small delay to ensure token is fully stored and available
      // This fixes a race condition where push token registration
      // happens before the auth token is readable from SecureStore
      const timer = setTimeout(() => {
        notificationService.registerTokenWithBackend().catch(() => {
          // Silently ignore - push notifications will work once EAS is configured
        });
      }, 1000); // 1 second delay to ensure token is available
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, appIsReady]);

  // Set up notification listeners
  useEffect(() => {
    // Handle notifications received while app is in foreground
    const notificationReceivedSubscription = notificationService.addNotificationReceivedListener(
      (notification) => {
        const { title, body, data } = notification.request.content;
        const notificationData = data as unknown as NotificationData | undefined;
        
        // Show in-app notification banner
        setNotification({
          visible: true,
          title: title || 'Notification',
          body: body || '',
          type: notificationData?.type || 'default',
          data: notificationData,
        });
      }
    );

    // Handle notification taps (when user taps on notification)
    const notificationResponseSubscription = notificationService.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as unknown as NotificationData | undefined;
        // Navigation handling will be done by the navigation container
        console.log('Notification tapped:', data);
      }
    );

    return () => {
      notificationReceivedSubscription.remove();
      notificationResponseSubscription.remove();
    };
  }, []);

  // Show custom splash screen while loading
  if (showSplash || !appIsReady) {
    return <SplashScreenComponent />;
  }

  return (
    <SettingsProvider>
      <ThemeProvider>
        <I18nProvider>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <AppNavigator />
            <InAppNotification
              visible={notification.visible}
              title={notification.title}
              body={notification.body}
              type={notification.type}
              onDismiss={() => setNotification(prev => ({ ...prev, visible: false }))}
              onPress={() => {
                // Handle notification tap - could navigate based on type
                console.log('In-app notification tapped:', notification.data);
              }}
            />
          </SafeAreaProvider>
        </I18nProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}
