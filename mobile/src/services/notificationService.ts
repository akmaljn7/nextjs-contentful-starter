import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import apiClient from '../api/client';
import Constants from 'expo-constants';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type: 'order_update' | 'consultation_update' | 'consultation_scheduled' | 'message';
  order_id?: string;
  consultation_id?: string;
  status?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  sender_id?: string;
}

class NotificationService {
  private pushToken: string | null = null;

  async registerForPushNotifications(): Promise<string | null> {
    let token: string | null = null;

    // Must be a physical device
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check and request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    try {
      // Try to get project ID from Constants, otherwise use a fallback approach
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      if (projectId) {
        // If we have a valid project ID, use it
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        });
        token = tokenData.data;
      } else {
        // Fallback: try without projectId (works for Expo Go in some cases)
        try {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          token = tokenData.data;
        } catch (fallbackError) {
          console.log('Push notifications not configured. To enable push notifications:');
          console.log('1. Run "npx eas init" to create an EAS project');
          console.log('2. Or run "npx expo install --fix" to update dependencies');
          return null;
        }
      }
      
      this.pushToken = token;
      console.log('Push token obtained:', token);
    } catch (error) {
      console.log('Push notifications setup skipped:', error);
      return null;
    }

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1a365d',
        sound: 'default',
      });
    }

    return token;
  }

  async registerTokenWithBackend(): Promise<boolean> {
    if (!this.pushToken) {
      await this.registerForPushNotifications();
    }

    if (!this.pushToken) {
      return false;
    }

    try {
      await apiClient.post('/push-tokens/register', {
        token: this.pushToken,
        device_type: Platform.OS,
      });
      console.log('Push token registered with backend');
      return true;
    } catch (error) {
      console.error('Failed to register push token with backend:', error);
      return false;
    }
  }

  async unregisterToken(): Promise<void> {
    if (!this.pushToken) return;

    try {
      await apiClient.delete(`/push-tokens/unregister?token=${encodeURIComponent(this.pushToken)}`);
      this.pushToken = null;
      console.log('Push token unregistered');
    } catch (error) {
      console.error('Failed to unregister push token:', error);
    }
  }

  getPushToken(): string | null {
    return this.pushToken;
  }

  // Add listeners for notification events
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  // Schedule a local notification (for in-app banners)
  async showLocalNotification(title: string, body: string, data?: NotificationData): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data as any,
        sound: 'default',
      },
      trigger: null, // Show immediately
    });
  }

  // Get badge count
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  // Set badge count
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  // Clear all notifications
  async clearAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
    await this.setBadgeCount(0);
  }
}

export const notificationService = new NotificationService();
