// services/Rakshak/NotificationService.ts
/**
 * NotificationService — Push Notifications for Rakshak Alerts
 * 
 * In PRODUCTION:
 * - Cloud backend receives SOS → queries Firestore for nearby Rakshak
 * - Calls Firebase Admin SDK to send FCM push notification to each device
 * - Device receives notification even when app is backgrounded/closed
 * 
 * In EXPO GO DEMO:
 * - expo-notifications sends a LOCAL notification (appears on same device)
 * - This simulates receiving an alert from the cloud
 * - Shows the full notification UI without needing a backend
 * 
 * WHY EXPO NOTIFICATIONS?
 * - Works in Expo Go without custom native builds
 * - Handles both foreground and background notifications
 * - Expo Push Service acts as a relay to FCM/APNs
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  private expoPushToken: string | null = null;

  /**
   * Request permission and get the Expo Push Token.
   * 
   * The Expo Push Token is like a phone number for push notifications.
   * Your backend sends a message to Expo Push Service with this token,
   * and Expo delivers it to the correct device via FCM (Android) or APNs (iOS).
   * 
   * Format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
   */
  async initialize(): Promise<string | null> {
    // Physical device only — simulators can't receive push notifications
    if (!Device.isDevice) {
      console.log('[Notifications] Push notifications require a physical device');
      return null;
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission denied');
      return null;
    }

    // Android requires a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rakshak-alerts', {
        name: 'Rakshak Emergency Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF3B30',
        sound: 'default',
      });
    }

    // Get Expo Push Token
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const token = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      this.expoPushToken = token.data;
      console.log('[Notifications] Expo Push Token:', token.data);
      return token.data;
    } catch (error) {
      console.warn('[Notifications] Could not get push token:', error);
      return null;
    }
  }

  /**
   * Listen for incoming notifications.
   * Returns unsubscribe function — call in useEffect cleanup.
   */
  onNotificationReceived(
    callback: (notification: Notifications.Notification) => void
  ): () => void {
    const subscription = Notifications.addNotificationReceivedListener(callback);
    return () => subscription.remove();
  }

  /**
   * Listen for when user taps a notification.
   * Returns unsubscribe function.
   */
  onNotificationTapped(
    callback: (response: Notifications.NotificationResponse) => void
  ): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener(callback);
    return () => subscription.remove();
  }

  /**
   * Send a LOCAL notification (for demo purposes — simulates cloud dispatch).
   * 
   * In production, this would be sent FROM the cloud backend to the Rakshak's device.
   * Here, we trigger it locally to demonstrate the full notification flow.
   */
  async sendLocalRakshakAlert(
    incidentId: string,
    distanceKm: number,
    injuryType: string,
    severity: number
  ): Promise<void> {
    const distanceText = distanceKm < 1
      ? `${Math.round(distanceKm * 1000)}m`
      : `${distanceKm.toFixed(1)}km`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 Accident Nearby — Rakshak Alert',
        body: `${distanceText} away · ${injuryType} · Severity ${severity}/5`,
        data: {
          type: 'RAKSHAK_ALERT',
          incidentId,
          distanceKm,
          injuryType,
          severity,
        },
        sound: 'default',
        categoryIdentifier: 'rakshak-alert',
      },
      trigger: null, // null = show immediately
    });

    console.log('[Notifications] Rakshak alert sent for incident:', incidentId);
  }

  /**
   * Send a notification when hospital is READY.
   */
  async sendHospitalReadyNotification(hospitalName: string, etaMinutes: number): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🏥 Hospital Ready',
        body: `${hospitalName} is ready — ETA ${etaMinutes} min`,
        data: { type: 'HOSPITAL_READY', hospitalName, etaMinutes },
        sound: 'default',
      },
      trigger: null,
    });
  }

  /**
   * Get the stored Expo Push Token.
   */
  getToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Dismiss all notifications (e.g., when incident is resolved).
   */
  async dismissAll(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }
}

export const notificationService = new NotificationService();