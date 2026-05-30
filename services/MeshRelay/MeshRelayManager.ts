/**
 * MeshRelayManager — Phase 2–14 (Offline BLE Edition)
 *
 * ═══════════════════════════════════════════════════════════════════
 * WHAT CHANGED FROM THE SIMULATION VERSION:
 *
 *   BEFORE:  simulationBridge → WebSocket → Render server → WebSocket → other phones
 *   AFTER:   bleTransportBridge → BLE radio → other phones (no server, no internet)
 *
 * EVERYTHING ELSE IS IDENTICAL:
 *   - DTN store-and-forward logic        ✓ unchanged
 *   - Deduplication buffer               ✓ unchanged
 *   - HMAC verification                  ✓ unchanged
 *   - Distance/bystander alert logic     ✓ unchanged
 *   - Rate limiting                      ✓ unchanged
 *   - Cloud egress (uploads when online) ✓ unchanged
 *   - Emergency contact relay            ✓ unchanged
 *   - Trust + Badge system               ✓ unchanged
 *   - Event subscription API             ✓ unchanged
 *
 * The only swap is: simulationBridge  →  bleTransportBridge
 * All call sites are identical — MeshRelayManager's API is unchanged.
 * ═══════════════════════════════════════════════════════════════════
 */

import { SOSPacket, MeshEvent, MeshEventType } from './types';
import { createSOSPacket, createRelayPacket, isValidPacket, getDeviceHash } from './PacketProtocol';
import { deduplicationBuffer } from './DeduplicationBuffer';
import { bleTransportBridge } from './BLETransportBridge';  // ← THE KEY SWAP
import { haversineDistance } from '../../utils/haversine';
import { getLastKnownLocation } from '../GPSService';
import { cloudEgress } from '../CloudEgress';
import { MESH } from '../../utils/constants';
import { verifyHMAC } from '../../utils/AESCrypto';
import { SECURITY } from '../../utils/constants';
import { trustScoreService } from '../Trust/TrustScoreService';
import { badgeService } from '../Trust/BadgeService';
import { dtnManager } from './DTNManager';
import { emergencyContactsService } from '../EmergencyContacts';

type EventCallback = (event: MeshEvent) => void;

class MeshRelayManager {
  private listeners: Map<string, EventCallback[]> = new Map();
  private isInitialized = false;
  private lastSOSTriggerTime: number = 0;

  // ── Convenience alias ──────────────────────────────────────────────────────
  // Code that previously used `simulationBridge` directly can call
  // `meshRelayManager.transport` instead. No other files need to change.
  get transport() {
    return bleTransportBridge;
  }

  // ── Initialization ─────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[MeshRelay] Already initialized');
      return;
    }

    try {
      const deviceId = await getDeviceHash();
      console.log('[MeshRelay] Initializing. Device:', deviceId.substring(0, 8) + '...');

      // Phase 14: Restore DTN buffer from previous session
      await dtnManager.initialize();
      console.log(
        `[MeshRelay] DTN initialized` +
        ` | State: ${dtnManager.currentState}` +
        ` | Buffered: ${dtnManager.bufferSize} packet(s)`
      );

      // ── Register BLE callbacks (identical API to SimulationBridge) ─────────
      bleTransportBridge.onPacketReceived((packet, relayedBy) => {
        this.handleReceivedPacket(packet);
      });

      bleTransportBridge.onStatusChanged((connected, deviceCount) => {
        // Emit UI event — consumers see 'SIMULATION_CONNECTED' / 'SIMULATION_DISCONNECTED'
        // We keep these event names for backwards-compat with all existing UI listeners
        this.emit({
          type: connected ? 'SIMULATION_CONNECTED' : 'SIMULATION_DISCONNECTED',
          data: { deviceCount },
        });

        // Phase 14: New peer appeared — try to drain DTN buffer
        if (connected && deviceCount >= 2 && dtnManager.isCarrying) {
          console.log(
            `[MeshRelay] New BLE peer (${deviceCount} total) — triggering DTN forward`
          );
          dtnManager.tryForward().catch(err =>
            console.error('[MeshRelay] DTN forward error:', err)
          );
        }
      });

      // ── Start BLE mesh ──────────────────────────────────────────────────────
      const bleReady = await bleTransportBridge.connect(deviceId);
      if (bleReady) {
        console.log('[MeshRelay] ✅ BLE mesh active — truly offline relay enabled');
      } else {
        console.log(
          '[MeshRelay] ⚠️  BLE not available right now.' +
          ' Mesh will activate automatically when Bluetooth is enabled.'
        );
      }

      // Start cloud egress (uploads SOS to server when internet is available)
      cloudEgress.startMonitoring();

      this.isInitialized = true;
      console.log('[MeshRelay] Ready');
    } catch (error) {
      console.error('[MeshRelay] Initialization error:', error);
      // Non-fatal — app continues, cloud path still works
    }
  }

  // ── SOS Trigger ────────────────────────────────────────────────────────────

  async triggerSOS(severity: 1 | 2 | 3 | 4 | 5 = 3): Promise<SOSPacket | null> {
    try {
      // Phase 10: Rate limit — max 1 SOS per 60 seconds
      const now = Date.now();
      const timeSinceLast = now - this.lastSOSTriggerTime;
      if (this.lastSOSTriggerTime > 0 && timeSinceLast < SECURITY.SOS_RATE_LIMIT_MS) {
        const waitSec = Math.ceil((SECURITY.SOS_RATE_LIMIT_MS - timeSinceLast) / 1000);
        console.warn(
          `[MeshRelay] ⚠️ RATE LIMITED — wait ${waitSec}s`
        );
        return null;
      }
      this.lastSOSTriggerTime = now;

      const location = await getLastKnownLocation();
      if (!location) {
        console.error('[MeshRelay] Cannot trigger SOS — GPS unavailable');
        return null;
      }

      const packet = await createSOSPacket(location.lat, location.lng, severity);
      console.log(`[MeshRelay] 🚨 SOS TRIGGERED! Incident: ${packet.incidentId}`);

      // Embed contact payload for mesh-relayed notification delivery
      const activeContacts = await emergencyContactsService.getContacts();
      const userProfile = await emergencyContactsService.getUserProfile();
      if (activeContacts.length > 0) {
        packet.contactPayload = {
          incidentId: packet.incidentId,
          contacts: activeContacts.map(c => ({
            name: c.name,
            phone: c.phone,
            shareLocation: c.shareLocation,
          })),
          victimName: userProfile.name,
          lat: location.lat,
          lng: location.lng,
          severity,
          timestamp: Date.now(),
          notifiedByDevices: [await getDeviceHash()],
        };
      }

      // Notify contacts immediately (SMS + queue for relay)
      emergencyContactsService.notifyContacts({
        incidentId: packet.incidentId,
        lat: location.lat,
        lng: location.lng,
        severity,
        deviceHash: await getDeviceHash(),
      }).catch(err => console.error('[MeshRelay] Contact notification error:', err));

      // Mark as seen so we don't react to our own echo
      deduplicationBuffer.isNew(packet.incidentId);

      // ── BLE Broadcast ───────────────────────────────────────────────────────
      const broadcasted = bleTransportBridge.broadcast(packet);

      if (!broadcasted || bleTransportBridge.connectedDevices < 2) {
        console.log(
          `[MeshRelay] No BLE peers (${bleTransportBridge.connectedDevices} device(s))` +
          ` — buffering in DTN for when peers appear`
        );
        await dtnManager.bufferPacket(packet);
      } else {
        console.log(
          `[MeshRelay] SOS broadcast via BLE to ${bleTransportBridge.connectedDevices - 1} peer(s)`
        );
      }

      // Cloud upload (best-effort, not blocking)
      cloudEgress.enqueue({ ...packet, lat: location.lat, lng: location.lng });

      this.emit({ type: 'SOS_TRIGGERED', packet });
      return packet;
    } catch (error) {
      console.error('[MeshRelay] Failed to trigger SOS:', error);
      return null;
    }
  }

  // ── Packet Receive Handler ─────────────────────────────────────────────────

  private async handleReceivedPacket(packet: SOSPacket): Promise<void> {
    // Step 1: Validate structure
    if (!isValidPacket(packet)) {
      console.log('[MeshRelay] Rejected invalid packet');
      return;
    }

    // Step 2: HMAC check (if present)
    if (packet.hmac) {
      const dataToVerify = JSON.stringify({
        incidentId: packet.incidentId,
        lat: packet.lat,
        lng: packet.lng,
        severity: packet.severity,
        timestamp: packet.timestamp,
      });
      if (!verifyHMAC(dataToVerify, packet.hmac)) {
        console.warn(`[MeshRelay] ❌ HMAC failed — dropping ${packet.incidentId}`);
        return;
      }
      console.log(`[MeshRelay] ✅ HMAC verified: ${packet.incidentId}`);
    }

    // Step 3: Deduplicate
    if (!deduplicationBuffer.isNew(packet.incidentId)) {
      console.log(`[MeshRelay] Duplicate ${packet.incidentId} — ignored`);
      return;
    }

    // Step 4: Relay contact notification if we have internet and haven't yet
    if (packet.contactPayload && deduplicationBuffer.isNew(`notif_${packet.incidentId}`)) {
      const deviceHash = await getDeviceHash();
      emergencyContactsService
        .handleRelayedNotification(packet.contactPayload, deviceHash)
        .then(sent => {
          if (sent) {
            console.log(`[MeshRelay] 📬 Relayed contact notifications for ${packet.incidentId}`);
          }
        })
        .catch(() => {});
    }

    console.log(
      `[MeshRelay] New SOS! Incident: ${packet.incidentId} |` +
      ` Severity: ${packet.severity} | Hop: ${packet.hopCount}`
    );

    // Step 5: Distance check
    const myLocation = await getLastKnownLocation();
    let isNearby = true;
    let distanceM = 0;

    if (myLocation) {
      const distanceKm = haversineDistance(
        myLocation.lat, myLocation.lng,
        packet.lat, packet.lng
      );
      distanceM = distanceKm * 1000;
      isNearby = distanceM <= MESH.BYSTANDER_RADIUS_M;
      console.log(
        `[MeshRelay] Crash is ${Math.round(distanceM)}m away.` +
        ` ${isNearby ? '✅ Within' : '❌ Outside'} ${MESH.BYSTANDER_RADIUS_M}m radius.`
      );
    }

    // Step 6: Notify UI
    this.emit({
      type: 'SOS_RECEIVED',
      packet,
      data: { isNearby, distanceM: Math.round(distanceM), receivedAt: Date.now() },
    });

    // Step 7: Relay via BLE (with jitter to prevent radio collision)
    if (packet.hopCount < MESH.MAX_HOPS) {
      const jitter = Math.floor(Math.random() * 200);
      setTimeout(async () => {
        const relayPacket = createRelayPacket(packet);

        if (bleTransportBridge.connectedDevices < 2) {
          console.log(
            `[MeshRelay] No BLE peers for relay (hop=${relayPacket.hopCount}) — buffering in DTN`
          );
          await dtnManager.bufferPacket(relayPacket);
        } else {
          const relayed = bleTransportBridge.broadcast(relayPacket);
          if (relayed) {
            console.log(
              `[MeshRelay] 📡 BLE relay hop=${relayPacket.hopCount}` +
              ` to ${bleTransportBridge.connectedDevices - 1} peer(s)`
            );
            this.emit({ type: 'SOS_RELAYED', packet: relayPacket });
            trustScoreService.onSuccessfulRelay().catch(() => {});
            badgeService.onRelaySuccess().then(earned => {
              if (earned) console.log('[MeshRelay] 🏆 Relay Node badge earned!');
            }).catch(() => {});
          } else {
            await dtnManager.bufferPacket(relayPacket);
          }
        }
      }, jitter);
    } else {
      console.log(`[MeshRelay] Max hops (${MESH.MAX_HOPS}) reached — not relaying`);
    }

    // Step 8: Cloud upload
    cloudEgress.enqueue(packet);
  }

  // ── Event System ───────────────────────────────────────────────────────────

  on(eventType: MeshEventType | 'ALL', callback: EventCallback): () => void {
    const key = String(eventType);
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key)!.push(callback);
    return () => {
      const cbs = this.listeners.get(key) ?? [];
      this.listeners.set(key, cbs.filter(cb => cb !== callback));
    };
  }

  private emit(event: MeshEvent): void {
    (this.listeners.get(event.type) ?? []).forEach(cb => {
      try { cb(event); } catch (err) { console.error('[MeshRelay] Listener error:', err); }
    });
    (this.listeners.get('ALL') ?? []).forEach(cb => {
      try { cb(event); } catch (err) { console.error('[MeshRelay] Listener error:', err); }
    });
  }

  // ── Getters (backwards-compatible with existing UI code) ───────────────────

  /** @deprecated Use transport.isConnected */
  get isSimulationConnected(): boolean {
    return bleTransportBridge.isConnected;
  }

  /** How many AETHER phones are visible via BLE right now */
  get connectedPeers(): number {
    return bleTransportBridge.connectedDevices;
  }
}

export const meshRelayManager = new MeshRelayManager();
