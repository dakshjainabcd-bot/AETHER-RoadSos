/**
 * BLEPacketCodec — Binary Encoding for BLE Advertisement Payloads
 *
 * WHY BINARY?
 * BLE manufacturer-specific data in legacy advertising is limited to ~27 bytes.
 * A JSON SOS packet is ~250 bytes — way too large.
 * This codec squeezes all essential SOS data into exactly 22 bytes.
 *
 * PACKET FORMAT (22 bytes):
 * ┌─────────┬────────┬──────────────────────────────────┐
 * │ Offset  │  Size  │  Field                           │
 * ├─────────┼────────┼──────────────────────────────────┤
 * │  0 – 1  │ 2 bytes│  incidentId high (hex → uint16)  │
 * │  2 – 3  │ 2 bytes│  incidentId low  (hex → uint16)  │
 * │  4 – 7  │ 4 bytes│  latitude  (float32 big-endian)  │
 * │  8 – 11 │ 4 bytes│  longitude (float32 big-endian)  │
 * │   12    │ 1 byte │  severity  (1–5)                 │
 * │   13    │ 1 byte │  hopCount                        │
 * │ 14 – 17 │ 4 bytes│  timestamp (unix seconds)        │
 * │ 18 – 21 │ 4 bytes│  deviceHash prefix (uint32)      │
 * └─────────┴────────┴──────────────────────────────────┘
 * Total: 22 bytes ✓ (fits comfortably in 27-byte BLE limit)
 *
 * NOTE: contactPayload (phone numbers, victim name) does NOT travel via BLE.
 * It syncs via cloud when internet is available. The BLE path carries the
 * core emergency alert only (location + severity). This is correct behaviour:
 * bystanders only need "crash at XY, severity Z" to respond.
 */

import { SOSPacket } from './types';

/** Service UUID that identifies an AETHER BLE node. Broadcast in advertisement. */
export const AETHER_SERVICE_UUID = 'ae700001-ae70-ae70-ae70-ae700000ae70';

/** Manufacturer ID registered to AETHER (arbitrary value in 0x0000–0xFFFF range). */
export const AETHER_MANUFACTURER_ID = 0xAE70;

const PACKET_BYTES = 22;

// ─── Encoder ──────────────────────────────────────────────────────────────────

/**
 * Encode an SOSPacket into a byte array suitable for BLE manufacturer data.
 *
 * Returns an array of numbers (0–255), ready to pass to the native advertiser.
 * Returns null if the packet is malformed.
 */
export function encodeToBytes(packet: SOSPacket): number[] | null {
  try {
    const buf = new ArrayBuffer(PACKET_BYTES);
    const view = new DataView(buf);

    // incidentId is an 8-char hex string like "a1b2c3d4"
    // Split into two uint16s
    const idHigh = parseInt(packet.incidentId.substring(0, 4), 16);
    const idLow  = parseInt(packet.incidentId.substring(4, 8), 16);
    if (isNaN(idHigh) || isNaN(idLow)) return null;

    view.setUint16(0, idHigh & 0xFFFF, false);
    view.setUint16(2, idLow  & 0xFFFF, false);

    // GPS (float32 gives ~1m precision, plenty for emergency routing)
    view.setFloat32(4, packet.lat, false);
    view.setFloat32(8, packet.lng, false);

    // Severity (clamp to 1–5) and hopCount
    view.setUint8(12, Math.min(Math.max(Math.round(packet.severity), 1), 5));
    view.setUint8(13, Math.min(packet.hopCount, 255));

    // Timestamp in seconds since Unix epoch (uint32 rolls over in 2106 — fine)
    view.setUint32(14, Math.floor(packet.timestamp / 1000), false);

    // First 8 hex chars of deviceHash → uint32 prefix
    const hashPrefix = parseInt(packet.deviceHash.substring(0, 8), 16) || 0;
    view.setUint32(18, hashPrefix, false);

    return Array.from(new Uint8Array(buf));
  } catch {
    return null;
  }
}

// ─── Decoder ──────────────────────────────────────────────────────────────────

/**
 * Decode a received BLE manufacturer data payload into an SOSPacket.
 *
 * react-native-ble-plx returns manufacturer data as a Base64 string.
 * The string may include a 2-byte manufacturer-ID prefix (added by the OS).
 *
 * Returns null if the data is not a valid AETHER packet.
 *
 * @param base64        manufacturerData from react-native-ble-plx Device object
 * @param sourceDeviceId  BLE device address of the advertising phone (used as
 *                       fallback deviceHash — not the real hash, but enough
 *                       for deduplication since each device has a unique address)
 */
export function decodeFromBase64(
  base64: string,
  sourceDeviceId: string
): SOSPacket | null {
  try {
    // Decode Base64 → binary string
    const binary = atob(base64);
    const totalLen = binary.length;

    // The OS may prepend the 2-byte manufacturer ID (0xAE70) or not.
    // Accept both 22-byte (raw payload) and 24-byte (with manufacturer ID prefix)
    if (totalLen !== PACKET_BYTES && totalLen !== PACKET_BYTES + 2) {
      return null; // Wrong length → not an AETHER packet
    }

    const dataOffset = totalLen === PACKET_BYTES + 2 ? 2 : 0;

    // Copy into ArrayBuffer for DataView access
    const buf = new ArrayBuffer(totalLen);
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < totalLen; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const view = new DataView(buf);

    // If OS included manufacturer ID prefix, verify it's ours
    if (dataOffset === 2) {
      const mfrId = view.getUint16(0, true); // little-endian as transmitted
      if (mfrId !== AETHER_MANUFACTURER_ID) return null;
    }

    const o = dataOffset; // offset alias for readability

    // Decode incidentId
    const idHigh = view.getUint16(o + 0, false).toString(16).padStart(4, '0');
    const idLow  = view.getUint16(o + 2, false).toString(16).padStart(4, '0');
    const incidentId = idHigh + idLow;
    if (incidentId === '00000000') return null; // Zero ID = empty/uninitialized

    // Decode GPS
    const lat = view.getFloat32(o + 4, false);
    const lng = view.getFloat32(o + 8, false);

    // Validate GPS ranges
    if (lat < -90 || lat > 90 || isNaN(lat)) return null;
    if (lng < -180 || lng > 180 || isNaN(lng)) return null;

    const severity = view.getUint8(o + 12) as 1 | 2 | 3 | 4 | 5;
    if (severity < 1 || severity > 5) return null;

    const hopCount = view.getUint8(o + 13);

    // Timestamp back to milliseconds
    const timestamp = view.getUint32(o + 14, false) * 1000;

    // DeviceHash: use the encoded prefix + pad with the BLE device address
    // This gives a stable, unique ID per device for deduplication purposes
    const hashPrefix = view.getUint32(o + 18, false).toString(16).padStart(8, '0');
    const deviceHash = hashPrefix + sourceDeviceId.replace(/:/g, '').substring(0, 12);

    return { incidentId, lat, lng, severity, hopCount, timestamp, deviceHash };
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Quick sanity check: is this Base64 string the right length to be an AETHER packet?
 * Call this before attempting a full decode to avoid wasting cycles.
 */
export function couldBeAETHERPacket(base64: string): boolean {
  try {
    const decodedLen = Math.floor((base64.length * 3) / 4);
    return decodedLen === PACKET_BYTES || decodedLen === PACKET_BYTES + 2;
  } catch {
    return false;
  }
}
