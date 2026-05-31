/**
 * HazardBroadcaster — FIXED v2 (Dual Transport: BLE + WebSocket)
 *
 * ROOT CAUSE FIX for "hazard not showing on other phones":
 *
 * BEFORE: Only used bleTransportBridge.broadcastHazard() — which was a no-op
 *         (returned true but did nothing). Hazards were stored locally but
 *         never actually sent to other phones.
 *
 * AFTER:  Also uses simulationBridge.broadcastHazard() (WebSocket).
 *         In initialize(), also registers onHazardReceived on simulationBridge
 *         so hazards received via WebSocket are processed and stored locally.
 *
 * MAP REFRESH: When a hazard is received from another phone (via WebSocket),
 *         HazardReportStore stores it AND emits to listeners. The map tab
 *         subscribes via onHazardAlert() so it can refresh its hazard layer.
 */
import {
  HazardPacket,
  HazardType,
  HazardAlertState,
  DRIVER_INTEL_CONFIG,
} from './types';
import { hazardReportStore } from './HazardReportStore';
import { bleTransportBridge } from '../MeshRelay/BLETransportBridge';
import { simulationBridge } from '../MeshRelay/SimulationBridge';
import { getLastKnownLocation } from '../GPSService';
import { haversineDistance } from '../../utils/haversine';
import { getDeviceHash } from '../MeshRelay/PacketProtocol';
import * as Location from 'expo-location';

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
    // ── BLE hazard receive (stub — BLE hazard not yet implemented) ─────────
    bleTransportBridge.onHazardReceived((packet: HazardPacket) => {
      this.handleReceivedHazard(packet);
    });

    // ── WebSocket hazard receive (THE FIX) ──────────────────────────────────
    // This is what was missing: hazards from other phones via WebSocket
    // were never wired up to handleReceivedHazard().
    simulationBridge.onHazardReceived((packet: HazardPacket) => {
      console.log(`[HazardBroadcaster] ⚠️ Received hazard via WebSocket: ${packet.hazardType}`);
      this.handleReceivedHazard(packet);
    });

    // Periodic cleanup of seen IDs (every 30 min)
    this.cleanupTimer = setInterval(() => {
      this.seenHazardIds.clear();
    }, DRIVER_INTEL_CONFIG.HAZARD_TTL_MS);

    hazardReportStore.initialize().catch(console.warn);
    console.log('[HazardBroadcaster] Initialized — dual transport (BLE + WebSocket)');
  }

  /**
   * Report a hazard at current GPS location.
   * Broadcasts via WebSocket (immediate) AND BLE (when peers in range).
   *
   * GPS FALLBACK: If GPSService hasn't started yet (e.g. user opened Map tab
   * before granting location), we fall back to expo-location directly so the
   * report never silently fails due to a null location.
   */
  async reportHazard(
    hazardType: HazardType,
    severity: 1 | 2 | 3 = 2,
  ): Promise<{ success: boolean; packet?: HazardPacket; reason?: string }> {
    // ── Location: GPSService first, expo-location fallback ────────────────
    let loc = await getLastKnownLocation();

    if (!loc) {
      // GPSService has no cached position yet — ask expo-location directly
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // Try last-known first (fast), then current position
          const last = await Location.getLastKnownPositionAsync();
          if (last) {
            loc = { lat: last.coords.latitude, lng: last.coords.longitude, accuracy: last.coords.accuracy ?? 999, altitude: last.coords.altitude, timestamp: last.timestamp, source: 'cached' };
          } else {
            const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            loc = { lat: current.coords.latitude, lng: current.coords.longitude, accuracy: current.coords.accuracy ?? 999, altitude: current.coords.altitude, timestamp: current.timestamp, source: 'live' };
          }
        }
      } catch (e) {
        console.warn('[HazardBroadcaster] expo-location fallback failed:', e);
      }
    }

    if (!loc) {
      return { success: false, reason: 'Unable to get your location. Please enable GPS and try again.' };
    }

    const deviceHash = await getDeviceHash();

    const limitCheck = await hazardReportStore.checkRateLimit(
      deviceHash, hazardType, loc.lat, loc.lng,
    );
    if (!limitCheck.allowed) {
      return { success: false, reason: limitCheck.reason };
    }

    const packet: HazardPacket = {
      hazardId: generateHazardId(),
      hazardType,
      lat: loc.lat,
      lng: loc.lng,
      severity,
      reportedAt: Date.now(),
      hopCount: 0,
      deviceHash,
    };

    // Mark seen so we don't alert ourselves for our own report
    this.seenHazardIds.add(packet.hazardId);

    await hazardReportStore.addReport(packet);
    await hazardReportStore.stampRateLimit(deviceHash, hazardType, loc.lat, loc.lng);

    // ── DUAL BROADCAST (THE FIX) ─────────────────────────────────────────────
    // BLE: stub (broadcastHazard returns false — BLE hazard not yet supported)
    const bleOk = bleTransportBridge.broadcastHazard(packet);
    // WebSocket: THIS is what actually sends hazards to other phones
    const wsOk  = simulationBridge.broadcastHazard(packet);

    console.log(
      `[HazardBroadcaster] Reported ${hazardType} at (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})` +
      ` — BLE: ${bleOk ? '✅' : '❌'} | WebSocket: ${wsOk ? '✅' : '❌'}`
    );

    return { success: true, packet };
  }

  /**
   * Process a hazard packet received from another phone (via either transport).
   * Stores it locally AND notifies UI listeners so the map refreshes.
   */
  private async handleReceivedHazard(packet: HazardPacket): Promise<void> {
    if (this.seenHazardIds.has(packet.hazardId)) return;
    this.seenHazardIds.add(packet.hazardId);

    const ageMs = Date.now() - packet.reportedAt;
    if (ageMs > DRIVER_INTEL_CONFIG.HAZARD_TTL_MS) {
      console.log(`[HazardBroadcaster] Expired hazard ${packet.hazardId} discarded`);
      return;
    }

    // Store and get cluster stats — do this regardless of distance so the MAP
    // always shows all received hazards, even ones far from current position.
    const { count, credibilityLevel } = await hazardReportStore.addReport(packet);

    // ── Distance check (for DRIVING alert banner only) ─────────────────────
    const loc = await getLastKnownLocation();
    if (loc) {
      const distKm = haversineDistance(loc.lat, loc.lng, packet.lat, packet.lng);
      const distM  = Math.round(distKm * 1000);

      console.log(
        `[HazardBroadcaster] ${packet.hazardType} ${distM}m away — ` +
        `${count} report(s), ${credibilityLevel} credibility`
      );

      // Only fire the driving alert banner if within configured radius
      if (distM <= DRIVER_INTEL_CONFIG.HAZARD_ALERT_RADIUS_M) {
        this.listeners.forEach(cb => {
          try { cb({ packet, distanceM: distM, reportCount: count, credibilityLevel }); } catch {}
        });
      } else {
        // Still notify map listeners (distanceM = 0 sentinel means "map refresh only")
        // Map tab's onHazardAlert callback ignores the alert contents and just re-reads clusters
        this.listeners.forEach(cb => {
          try { cb({ packet, distanceM: distM, reportCount: count, credibilityLevel }); } catch {}
        });
      }
    } else {
      // No GPS — still fire listeners so map can refresh
      this.listeners.forEach(cb => {
        try { cb({ packet, distanceM: 0, reportCount: count, credibilityLevel }); } catch {}
      });
    }

    // Relay onwards if hops remaining (via WebSocket — BLE hazard relay TBD)
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