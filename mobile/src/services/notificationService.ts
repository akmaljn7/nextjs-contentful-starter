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
      // Silently skip - no need to log
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
      // Silently skip - user denied permission
      return null;
    }

    try {
      // Try to get project ID from Constants
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      if (projectId) {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        });
        token = tokenData.data;
        this.pushToken = token;
      } else {
        // No EAS project configured - silently skip push notifications
        // Push notifications will work once EAS is configured
        return null;
      }
    } catch {
      // Silently fail - push notifications aren't critical
      return null;
    }

    // Configure Android channel
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1a365d',
          sound: 'default',
        });
      } catch {
        // Silently ignore channel setup errors
      }
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
