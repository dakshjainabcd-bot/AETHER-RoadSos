/**
 * Phase 2 — SOS Packet Creation and Validation
 *
 * The PacketProtocol handles:
 * 1. Creating a NEW packet when this phone detects a crash
 * 2. Creating a RELAY packet when forwarding someone else's crash
 * 3. Validating received packets (is this real? not too old? not too many hops?)
 *
 * REAL BLE NOTE: In production, packets would be encoded as binary
 * (< 200 bytes) for Bluetooth efficiency. In our simulation, we use
 * JSON over WebSocket — functionally identical for demo purposes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOSPacket, MAX_HOPS } from './types';

// Cache the device hash in memory so we don't read AsyncStorage on every packet
let _deviceHashCache: string | null = null;

/**
 * Get or create a stable anonymous device ID.
 *
 * WHY ANONYMOUS? Privacy. We don't want to track who is where.
 * We just need a way to know "this packet came from phone X" so
 * we don't relay our own packets back to ourselves.
 *
 * Generated once on first app launch, stored in AsyncStorage forever.
 */
export async function getDeviceHash(): Promise<string> {
  if (_deviceHashCache) return _deviceHashCache;

  try {
    let hash = await AsyncStorage.getItem('aether_device_hash');
    if (!hash) {
      // Generate a random 20-character ID
      hash = Array.from({ length: 20 }, () =>
        Math.floor(Math.random() * 36).toString(36)
      ).join('');
      await AsyncStorage.setItem('aether_device_hash', hash);
      console.log('[PacketProtocol] New device hash generated:', hash.substring(0, 8) + '...');
    }
    _deviceHashCache = hash;
    return hash;
  } catch {
    // Fallback if AsyncStorage fails (shouldn't happen, but safety first)
    return 'fallback_' + Math.random().toString(36).substring(2, 12);
  }
}

/**
 * Generate a short unique incident ID.
 * Format: 8 hex characters (like "a1b2c3d4")
 * 4 billion possible values — collision essentially impossible for accidents.
 */
function generateIncidentId(): string {
  return (
    Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0') +
    Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
  );
}

/**
 * Create a NEW SOS packet — called when THIS phone detects a crash.
 *
 * @param lat       Crash latitude from GPS
 * @param lng       Crash longitude from GPS
 * @param severity  1 (minor) to 5 (critical) — derived from crash force
 */
export async function createSOSPacket(
  lat: number,
  lng: number,
  severity: 1 | 2 | 3 | 4 | 5
): Promise<SOSPacket> {
  const deviceHash = await getDeviceHash();

  const packet: SOSPacket = {
    incidentId: generateIncidentId(),
    lat,
    lng,
    severity,
    timestamp: Date.now(),
    hopCount: 0,  // ← 0 means "I am the origin phone"
    deviceHash,
  };

  console.log(`[PacketProtocol] Created SOS packet: ${packet.incidentId} severity=${severity}`);
  return packet;
}

/**
 * Create a RELAY packet — called when THIS phone forwards someone else's SOS.
 *
 * We increment the hop count so all phones know how far this has traveled.
 * At hop 30, phones stop relaying (prevents infinite loops in dense areas).
 */
export function createRelayPacket(received: SOSPacket): SOSPacket {
  return {
    ...received,          // Copy all fields
    hopCount: received.hopCount + 1,  // ← Increment hop count
  };
}

/**
 * Validate a received packet before processing it.
 *
 * WHY VALIDATE? In a real Bluetooth network, you might receive garbage
 * signals from other apps. We check that the packet makes sense.
 *
 * Returns true if the packet is legitimate and should be processed.
 */
export function isValidPacket(packet: unknown): packet is SOSPacket {
  if (!packet || typeof packet !== 'object') return false;

  const p = packet as Partial<SOSPacket>;

  // Must have all required fields
  if (typeof p.incidentId !== 'string' || p.incidentId.length === 0) return false;
  if (typeof p.lat !== 'number' || p.lat < -90 || p.lat > 90) return false;
  if (typeof p.lng !== 'number' || p.lng < -180 || p.lng > 180) return false;
  if (typeof p.severity !== 'number' || p.severity < 1 || p.severity > 5) return false;
  if (typeof p.timestamp !== 'number') return false;
  if (typeof p.hopCount !== 'number') return false;

  // Reject packets that have exceeded max hops
  if (p.hopCount >= MAX_HOPS) {
    console.log(`[PacketProtocol] Packet ${p.incidentId} exceeded MAX_HOPS (${p.hopCount}/${MAX_HOPS}) — discarding`);
    return false;
  }

  // Reject packets older than 30 minutes (stale crash — probably handled already)
  const ageMs = Date.now() - p.timestamp;
  if (ageMs > 30 * 60 * 1000) {
    console.log(`[PacketProtocol] Packet ${p.incidentId} is ${Math.round(ageMs / 60000)} min old — discarding`);
    return false;
  }

  return true;
}