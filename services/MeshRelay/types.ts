/**
 * Phase 2 — Core Type Definitions for Mesh Relay
 *
 * An SOS packet is a tiny data bundle (< 200 bytes) that travels
 * phone-to-phone via Bluetooth without internet.
 *
 * Think of it like a radio signal carrying these 7 fields.
 * Every phone that receives it checks it, shows an alert if nearby,
 * then re-broadcasts it further.
 */

export interface SOSPacket {
  incidentId: string;             // Unique ID like "a1b2c3d4" — identifies THIS crash
  lat: number;                    // Crash latitude (e.g., 12.9716)
  lng: number;                    // Crash longitude (e.g., 77.5946)
  severity: 1 | 2 | 3 | 4 | 5;  // 1 = minor fender bender, 5 = major crash
  timestamp: number;              // Unix milliseconds when crash happened
  hopCount: number;               // How many phones have relayed this so far (0 = victim's phone)
  deviceHash: string;             // Anonymous ID of the phone that originated this SOS
}

// How the mesh relay behaves
export const MAX_HOPS = 30;                    // Stop relaying after 30 hops (prevents infinite loops)
export const BYSTANDER_RADIUS_M = 500;        // Show alert only if crash is within 500 meters
export const DEDUP_WINDOW_MS = 5 * 60 * 1000; // Remember seen packets for 5 minutes

/**
 * Events that MeshRelayManager fires
 * Other parts of the app subscribe to these to update the UI.
 *
 * Example:
 *   meshRelayManager.on('SOS_RECEIVED', (event) => {
 *     // Show bystander alert
 *   });
 */
export type MeshEventType =
  | 'SOS_TRIGGERED'        // This phone just sent an SOS (we are the victim)
  | 'SOS_RECEIVED'         // We received SOS from another phone nearby
  | 'SOS_RELAYED'          // We forwarded (relayed) a packet to further phones
  | 'CLOUD_EGRESS_SUCCESS' // Successfully uploaded to cloud
  | 'CLOUD_EGRESS_FAILED'  // Upload failed, will retry
  | 'PEER_CONNECTED'       // Another AETHER phone is nearby
  | 'SIMULATION_CONNECTED' // Connected to simulation server (Expo Go mode)
  | 'SIMULATION_DISCONNECTED';

export interface MeshEvent {
  type: MeshEventType;
  packet?: SOSPacket;       // The SOS packet (if relevant)
  data?: Record<string, unknown>; // Extra info (like distance, isNearby)
}