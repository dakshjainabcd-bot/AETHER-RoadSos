export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  shareLocation: boolean;
}

export interface UserProfile {
  name: string;
}

export interface ContactNotificationPayload {
  incidentId: string;
  contacts: { name: string; phone: string; shareLocation: boolean }[];
  victimName: string;
  lat: number;
  lng: number;
  severity: number;
  timestamp: number;
  notifiedByDevices: string[];
}
