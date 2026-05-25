/**
 * Phase 12 — HazardBroadcaster (Updated: rate limiting + type-aware clustering)
 */

import {
  HazardPacket,
  HazardType,
  HazardAlertState,
  DRIVER_INTEL_CONFIG,
} from './types';
import { hazardReportStore } from './HazardReportStore';
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
  private seenHazardIds = new Set<string>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  initialize(): void {
    simulationBridge.onHazardReceived((packet: HazardPacket) => {
      this.handleReceivedHazard(packet);
    });

    this.cleanupTimer = setInterval(() => {
      this.seenHazardIds.clear();
    }, DRIVER_INTEL_CONFIG.HAZARD_TTL_MS);

    hazardReportStore.initialize().catch(console.warn);
    console.log('[HazardBroadcaster] Initialized');
  }

  /**
   * Report a hazard at current GPS location.
   * Returns success/failure with human-readable reason for UI.
   */
  async reportHazard(
    hazardType: HazardType,
    severity: 1 | 2 | 3 = 2,
  ): Promise<{ success: boolean; packet?: HazardPacket; reason?: string }> {
    const loc = await getLastKnownLocation();
    if (!loc) {
      return { success: false, reason: 'Unable to get your location. Please enable GPS and try again.' };
    }

    const deviceHash = await getDeviceHash();

    // ── Rate limit check (fixes issue 3) ──────────────────────────────────
    const limitCheck = await hazardReportStore.checkRateLimit(
      deviceHash, hazardType, loc.lat, loc.lng,
    );
    if (!limitCheck.allowed) {
      return { success: false, reason: limitCheck.reason };
    }

    const packet: HazardPacket = {
      hazardId:    generateHazardId(),
      hazardType,
      lat:         loc.lat,
      lng:         loc.lng,
      severity,
      reportedAt:  Date.now(),
      hopCount:    0,
      deviceHash,
    };

    // Mark as seen so we don't alert ourselves for our own report
    this.seenHazardIds.add(packet.hazardId);

    // Store as own report (count = 1 from the start)
    await hazardReportStore.addReport(packet);

    // Record rate limit timestamp AFTER storing
    await hazardReportStore.stampRateLimit(deviceHash, hazardType, loc.lat, loc.lng);

    const sent = simulationBridge.broadcastHazard(packet);
    console.log(
      `[HazardBroadcaster] Reported ${hazardType} at (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})` +
      ` — mesh ${sent ? 'sent' : 'queued (offline)'}`,
    );

    return { success: true, packet };
  }

  /**
   * Process a hazard packet received from another phone.
   */
  private async handleReceivedHazard(packet: HazardPacket): Promise<void> {
    // Deduplicate
    if (this.seenHazardIds.has(packet.hazardId)) return;
    this.seenHazardIds.add(packet.hazardId);

    // TTL check
    const ageMs = Date.now() - packet.reportedAt;
    if (ageMs > DRIVER_INTEL_CONFIG.HAZARD_TTL_MS) {
      console.log(`[HazardBroadcaster] Expired hazard ${packet.hazardId} discarded`);
      return;
    }

    // Distance check
    const loc = await getLastKnownLocation();
    if (!loc) return;

    const distKm = haversineDistance(loc.lat, loc.lng, packet.lat, packet.lng);
    const distM  = Math.round(distKm * 1000);

    // Store and get cluster stats for THIS type+location (fixes issue 1)
    const { count, credibilityLevel } = await hazardReportStore.addReport(packet);

    console.log(
      `[HazardBroadcaster] ${packet.hazardType} ${distM}m away — ` +
      `${count} report(s), ${credibilityLevel} credibility`,
    );

    // Alert if within radius
    if (distM <= DRIVER_INTEL_CONFIG.HAZARD_ALERT_RADIUS_M) {
      this.listeners.forEach(cb => {
        try {
          cb({
            packet,
            distanceM:        distM,
            reportCount:      count,
            credibilityLevel,
          });
        } catch {}
      });
    }

    // Relay if hops remaining
    if (packet.hopCount < DRIVER_INTEL_CONFIG.HAZARD_MAX_HOPS) {
      simulationBridge.broadcastHazard({ ...packet, hopCount: packet.hopCount + 1 });
    }
  }

  onHazardAlert(callback: HazardAlertCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }
}

export const hazardBroadcaster = new HazardBroadcaster();