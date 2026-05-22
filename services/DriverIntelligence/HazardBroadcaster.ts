/**
 * Phase 12 — HazardBroadcaster
 *
 * HAZARD PACKET FLOW:
 *
 * Reporter's phone:
 *   reportHazard('pothole') → creates packet → broadcasts to server
 *
 * Server:
 *   receives HAZARD_PACKET → relays to all other connected phones
 *
 * Receiving phones:
 *   handleReceivedHazard(packet)
 *     → check TTL (expired? discard)
 *     → check distance (> 3km? don't alert)
 *     → check deduplicate (seen before? discard)
 *     → fire alert callback → UI shows banner
 *     → relay packet with hopCount+1 (if hops remaining)
 */

import { HazardPacket, HazardType, HazardAlertState, DRIVER_INTEL_CONFIG } from './types';
import { simulationBridge } from '../MeshRelay/SimulationBridge';
import { getLastKnownLocation } from '../GPSService';
import { haversineDistance } from '../../utils/haversine';
import { getDeviceHash } from '../MeshRelay/PacketProtocol';

function generateHazardId(): string {
  return (
    Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0') +
    Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
  );
}

type HazardAlertCallback = (alert: HazardAlertState) => void;

class HazardBroadcaster {
  private listeners: HazardAlertCallback[] = [];
  // Track hazard IDs we've already seen to avoid duplicate alerts
  private seenHazardIds = new Set<string>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Register with SimulationBridge to receive incoming hazard packets.
   * Call once in _layout.tsx AFTER meshRelayManager.initialize().
   */
  initialize(): void {
    simulationBridge.onHazardReceived((packet: HazardPacket) => {
      this.handleReceivedHazard(packet);
    });

    // Clear the seen-IDs set every 30 minutes
    // (Expired hazards won't be re-broadcast anyway due to TTL check)
    this.cleanupTimer = setInterval(() => {
      this.seenHazardIds.clear();
    }, DRIVER_INTEL_CONFIG.HAZARD_TTL_MS);

    console.log('[HazardBroadcaster] Initialized');
  }

  /**
   * Report a hazard at the current location and broadcast it via mesh.
   * Called when user taps "Report Hazard" on the map screen.
   *
   * @param hazardType  Type of hazard (pothole, accident, etc.)
   * @param severity    1=minor, 2=moderate, 3=severe (default: 2)
   */
  async reportHazard(
    hazardType: HazardType,
    severity: 1 | 2 | 3 = 2
  ): Promise<HazardPacket | null> {
    const loc = await getLastKnownLocation();
    if (!loc) {
      console.warn('[HazardBroadcaster] Cannot report hazard — no GPS fix');
      return null;
    }

    const deviceHash = await getDeviceHash();

    const packet: HazardPacket = {
      hazardId: generateHazardId(),
      hazardType,
      lat: loc.lat,
      lng: loc.lng,
      severity,
      reportedAt: Date.now(),
      hopCount: 0, // We are the origin
      deviceHash,
    };

    // Mark as seen so we don't alert ourselves for our own report
    this.seenHazardIds.add(packet.hazardId);

    const sent = simulationBridge.broadcastHazard(packet);
    if (sent) {
      console.log(
        `[HazardBroadcaster] ✅ Reported ${hazardType} at ` +
        `(${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`
      );
    } else {
      console.warn('[HazardBroadcaster] Broadcast failed — simulation server not connected');
    }

    return packet;
  }

  /**
   * Process a hazard packet received from another phone via the mesh.
   * This runs the TTL check, distance check, and deduplication.
   */
  private async handleReceivedHazard(packet: HazardPacket): Promise<void> {
    // ── 1. Deduplication: have we seen this hazard before? ────────────────
    if (this.seenHazardIds.has(packet.hazardId)) {
      return; // Already processed this one
    }
    this.seenHazardIds.add(packet.hazardId);

    // ── 2. TTL: is this hazard still fresh? ───────────────────────────────
    const ageMs = Date.now() - packet.reportedAt;
    if (ageMs > DRIVER_INTEL_CONFIG.HAZARD_TTL_MS) {
      console.log(
        `[HazardBroadcaster] Hazard ${packet.hazardId} expired ` +
        `(${Math.round(ageMs / 60000)}min old)`
      );
      return; // Stale — discard silently
    }

    // ── 3. Distance: is the hazard close enough to matter? ────────────────
    const loc = await getLastKnownLocation();
    if (!loc) return; // No GPS — can't check distance

    const distKm = haversineDistance(loc.lat, loc.lng, packet.lat, packet.lng);
    const distM = Math.round(distKm * 1000);

    console.log(
      `[HazardBroadcaster] Received ${packet.hazardType} — ` +
      `${distM}m away (hop ${packet.hopCount})`
    );

    // ── 4. Alert the driver if hazard is within 3km ───────────────────────
    if (distM <= DRIVER_INTEL_CONFIG.HAZARD_ALERT_RADIUS_M) {
      this.listeners.forEach(cb => {
        try { cb({ packet, distanceM: distM }); } catch {}
      });
    }

    // ── 5. Relay to other nearby phones if we haven't hit max hops ────────
    if (packet.hopCount < DRIVER_INTEL_CONFIG.HAZARD_MAX_HOPS) {
      const relayPacket: HazardPacket = {
        ...packet,
        hopCount: packet.hopCount + 1,
      };
      simulationBridge.broadcastHazard(relayPacket);
    }
  }

  /**
   * Subscribe to nearby hazard alerts.
   * Fires when a hazard packet arrives and is within 3km.
   * Returns an unsubscribe function.
   */
  onHazardAlert(callback: HazardAlertCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }
}

export const hazardBroadcaster = new HazardBroadcaster();