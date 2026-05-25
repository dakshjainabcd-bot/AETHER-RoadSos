import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../utils/constants';
import { EmergencyContact, UserProfile, ContactNotificationPayload } from './types';
import NetInfo from '@react-native-community/netinfo';

const NOTIFICATION_ENDPOINT = 'https://your-api.railway.app/api/v1/notify_contacts';

class EmergencyContactsService {
  async initialize() {
    // any init logic
    console.log('[EmergencyContactsService] Initialized');
  }

  async getContacts(): Promise<EmergencyContact[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.EMERGENCY_CONTACTS);
    return data ? JSON.parse(data) : [];
  }

  async saveContacts(contacts: EmergencyContact[]) {
    await AsyncStorage.setItem(STORAGE_KEYS.EMERGENCY_CONTACTS, JSON.stringify(contacts));
  }

  async getUserProfile(): Promise<UserProfile> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return data ? JSON.parse(data) : { name: 'Unknown User' };
  }

  async saveUserProfile(profile: UserProfile) {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  }

  async notifyContacts(params: { incidentId: string; lat: number; lng: number; severity: number; deviceHash: string }) {
    const contacts = await this.getContacts();
    const profile = await this.getUserProfile();
    
    if (contacts.length === 0) return;

    const payload: ContactNotificationPayload = {
      incidentId: params.incidentId,
      contacts: contacts.map(c => ({ name: c.name, phone: c.phone, shareLocation: c.shareLocation })),
      victimName: profile.name,
      lat: params.lat,
      lng: params.lng,
      severity: params.severity,
      timestamp: Date.now(),
      notifiedByDevices: [params.deviceHash],
    };

    const state = await NetInfo.fetch();
    if (state.isConnected && state.isInternetReachable !== false) {
      await this.sendToAPI(payload);
    } else {
      await this.queuePendingNotification(payload);
    }
  }

  async handleRelayedNotification(payload: ContactNotificationPayload, deviceHash: string): Promise<boolean> {
    payload.notifiedByDevices.push(deviceHash);
    const state = await NetInfo.fetch();
    if (state.isConnected && state.isInternetReachable !== false) {
      return await this.sendToAPI(payload);
    }
    return false;
  }

  private async sendToAPI(payload: ContactNotificationPayload): Promise<boolean> {
    try {
      const response = await fetch(NOTIFICATION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return response.ok;
    } catch (e) {
      console.error('[EmergencyContactsService] Failed to send notification', e);
      return false;
    }
  }

  async queuePendingNotification(payload: ContactNotificationPayload) {
    const pending = await this.getPendingNotifications();
    pending.push(payload);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_NOTIFICATIONS, JSON.stringify(pending));
  }

  async getPendingNotifications(): Promise<ContactNotificationPayload[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_NOTIFICATIONS);
    return data ? JSON.parse(data) : [];
  }

  async retryPendingNotifications() {
    const pending = await this.getPendingNotifications();
    if (pending.length === 0) return;

    const remaining = [];
    for (const payload of pending) {
      const success = await this.sendToAPI(payload);
      if (!success) {
        remaining.push(payload);
      }
    }
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_NOTIFICATIONS, JSON.stringify(remaining));
  }
}

export const emergencyContactsService = new EmergencyContactsService();
