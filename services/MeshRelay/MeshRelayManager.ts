/**
 * MeshRelayManager — FIXED v4 (Dual Transport: BLE + WebSocket)
 *
 * ROOT CAUSE: The previous version removed simulationBridge entirely, using only
 * bleTransportBridge. But BLE advertising was failing (31-byte limit exceeded),
 * so MESH stayed at 1 and SOS never reached the other phone.
 *
 * THIS VERSION uses BOTH transports simultaneously:
 *   • bleTransportBridge  → BLE radio (true offline, airplane mode + BT on)
 *   • simulationBridge    → WebSocket relay (works on same WiFi/hotspot)
 *
 * DUAL BROADCAST: triggerSOS() and relay both broadcast via BLE + WebSocket.
 * DEDUPLICATION: If the same packet arrives via both, the second copy is dropped.
 * PEER COUNT: Shows max(BLE peers, WebSocket peers) — best available at any moment.
 */
import { SOSPacket, MeshEvent, MeshEventType } from './types';
import { createSOSPacket, createRelayPacket, isValidPacket, getDeviceHash } from './PacketProtocol';
import { deduplicationBuffer } from './DeduplicationBuffer';
import { bleTransportBridge } from './BLETransportBridge';
import { simulationBridge } from './SimulationBridge';
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

  // Convenience aliases for backward compatibility
  get transport() { return bleTransportBridge; }
  get wsTransport() { return simulationBridge; }

  // ── Initialization ─────────────────────────────────────────────────────────
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[MeshRelay] Already initialized');
      return;
    }
    try {
      const deviceId = await getDeviceHash();
      console.log('[MeshRelay] Initializing. Device:', deviceId.substring(0, 8) + '...');

      await dtnManager.initialize();
      console.log(
        `[MeshRelay] DTN initialized` +
        ` | State: ${dtnManager.currentState}` +
        ` | Buffered: ${dtnManager.bufferSize} packet(s)`
      );

      // ── BLE callbacks ──────────────────────────────────────────────────────
      bleTransportBridge.onPacketReceived((packet, relayedBy) => {
        this.handleReceivedPacket(packet, 'BLE');
      });
      bleTransportBridge.onStatusChanged((connected, deviceCount) => {
        this.emit({
          type: connected ? 'SIMULATION_CONNECTED' : 'SIMULATION_DISCONNECTED',
          data: { deviceCount: this.connectedPeers },
        });
        if (connected && deviceCount >= 2 && dtnManager.isCarrying) {
          dtnManager.tryForward().catch(err =>
            console.error('[MeshRelay] DTN forward error (BLE):', err)
          );
        }
      });

      // ── WebSocket callbacks ────────────────────────────────────────────────
      simulationBridge.onPacketReceived((packet, relayedBy) => {
        this.handleReceivedPacket(packet, 'WebSocket');
      });
      simulationBridge.onStatusChanged((connected, deviceCount) => {
        this.emit({
          type: connected ? 'SIMULATION_CONNECTED' : 'SIMULATION_DISCONNECTED',
          data: { deviceCount: this.connectedPeers },
        });
        if (connected && deviceCount >= 2 && dtnManager.isCarrying) {
          dtnManager.tryForward().catch(err =>
            console.error('[MeshRelay] DTN forward error (WS):', err)
          );
        }
      });

      // ── Start BLE mesh ─────────────────────────────────────────────────────
      const bleReady = await bleTransportBridge.connect(deviceId);
      console.log(`[MeshRelay] BLE: ${bleReady ? '✅ active' : '⚠️ standby (will activate with BT)'}`);

      // ── Start WebSocket relay ──────────────────────────────────────────────
      const wsReady = await simulationBridge.connect(deviceId);
      console.log(`[MeshRelay] WebSocket: ${wsReady ? '✅ active' : '⚠️ offline/server unreachable'}`);

      cloudEgress.startMonitoring();
      this.isInitialized = true;
      console.log('[MeshRelay] ✅ Ready — Dual transport (BLE + WebSocket)');
    } catch (error) {
      console.error('[MeshRelay] Initialization error:', error);
    }
  }

  // ── SOS Trigger ────────────────────────────────────────────────────────────
  async triggerSOS(severity: 1 | 2 | 3 | 4 | 5 = 3): Promise<SOSPacket | null> {
    try {
      const now = Date.now();
      const timeSinceLast = now - this.lastSOSTriggerTime;
      if (this.lastSOSTriggerTime > 0 && timeSinceLast < SECURITY.SOS_RATE_LIMIT_MS) {
        const waitSec = Math.ceil((SECURITY.SOS_RATE_LIMIT_MS - timeSinceLast) / 1000);
        console.warn(`[MeshRelay] ⚠️ RATE LIMITED — wait ${waitSec}s`);
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

      // Embed contact payload
      const activeContacts = await emergencyContactsService.getContacts();
      const userProfile = await emergencyContactsService.getUserProfile();
      if (activeContacts.length > 0) {
        packet.contactPayload = {
          incidentId: packet.incidentId,
          contacts: activeContacts.map(c => ({ name: c.name, phone: c.phone, shareLocation: c.shareLocation })),
          victimName: userProfile.name,
          lat: location.lat,
          lng: location.lng,
          severity,
          timestamp: Date.now(),
          notifiedByDevices: [await getDeviceHash()],
        };
      }

      emergencyContactsService.notifyContacts({
        incidentId: packet.incidentId,
        lat: location.lat,
        lng: location.lng,
        severity,
        deviceHash: await getDeviceHash(),
      }).catch(err => console.error('[MeshRelay] Contact notification error:', err));

      // Mark seen so we don't react to our own echo
      deduplicationBuffer.isNew(packet.incidentId);

      // ── DUAL BROADCAST ──────────────────────────────────────────────────────
      const bleOk = bleTransportBridge.broadcast(packet);
      const wsOk  = simulationBridge.broadcast(packet);
      console.log(`[MeshRelay] SOS broadcast — BLE: ${bleOk ? '✅' : '❌'} | WebSocket: ${wsOk ? '✅' : '❌'}`);

      if (!bleOk && !wsOk) {
        console.log('[MeshRelay] No active transport — buffering in DTN');
        await dtnManager.bufferPacket(packet);
      }

      // BLE keep-alive: re-advertises every 8s for 5 min so late-arriving phones get the SOS
      bleTransportBridge.startKeepAlive(packet);

      cloudEgress.enqueue({ ...packet, lat: location.lat, lng: location.lng });
      this.emit({ type: 'SOS_TRIGGERED', packet });
      return packet;
    } catch (error) {
      console.error('[MeshRelay] Failed to trigger SOS:', error);
      return null;
    }
  }

  // ── Packet Receive Handler ─────────────────────────────────────────────────
  private async handleReceivedPacket(packet: SOSPacket, source: 'BLE' | 'WebSocket' = 'BLE'): Promise<void> {
    if (!isValidPacket(packet)) {
      console.log(`[MeshRelay] Rejected invalid packet from ${source}`);
      return;
    }

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
    }

    // Deduplication — handles packets arriving via BOTH BLE and WebSocket
    if (!deduplicationBuffer.isNew(packet.incidentId)) {
      console.log(`[MeshRelay] Duplicate ${packet.incidentId} from ${source} — ignored`);
      return;
    }

    if (packet.contactPayload && deduplicationBuffer.isNew(`notif_${packet.incidentId}`)) {
      const deviceHash = await getDeviceHash();
      emergencyContactsService
        .handleRelayedNotification(packet.contactPayload, deviceHash)
        .then(sent => { if (sent) console.log(`[MeshRelay] 📬 Relayed contacts for ${packet.incidentId}`); })
        .catch(() => {});
    }

    console.log(
      `[MeshRelay] ✅ New SOS via ${source}! Incident: ${packet.incidentId}` +
      ` | Severity: ${packet.severity} | Hop: ${packet.hopCount}`
    );

    const myLocation = await getLastKnownLocation();
    let isNearby = true;
    let distanceM = 0;
    if (myLocation) {
      const distanceKm = haversineDistance(myLocation.lat, myLocation.lng, packet.lat, packet.lng);
      distanceM = distanceKm * 1000;
      isNearby = distanceM <= MESH.BYSTANDER_RADIUS_M;
    }

    this.emit({
      type: 'SOS_RECEIVED',
      packet,
      data: { isNearby, distanceM: Math.round(distanceM), receivedAt: Date.now() },
    });

    // Relay via BOTH transports with jitter
    if (packet.hopCount < MESH.MAX_HOPS) {
      const jitter = Math.floor(Math.random() * 200);
      setTimeout(async () => {
        const relayPacket = createRelayPacket(packet);
        const bleRelayed = bleTransportBridge.broadcast(relayPacket);
        const wsRelayed  = simulationBridge.broadcast(relayPacket);

        if (bleRelayed || wsRelayed) {
          console.log(
            `[MeshRelay] 📡 Relay hop=${relayPacket.hopCount}` +
            ` — BLE: ${bleRelayed ? '✅' : '❌'} WS: ${wsRelayed ? '✅' : '❌'}`
          );
          this.emit({ type: 'SOS_RELAYED', packet: relayPacket });
          trustScoreService.onSuccessfulRelay().catch(() => {});
          badgeService.onRelaySuccess()
            .then(earned => { if (earned) console.log('[MeshRelay] 🏆 Relay badge earned!'); })
            .catch(() => {});
        } else {
          await dtnManager.bufferPacket(relayPacket);
        }
      }, jitter);
    }

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

  // ── Getters ────────────────────────────────────────────────────────────────
  /** @deprecated Use transport.isConnected or wsTransport.isConnected */
  get isSimulationConnected(): boolean {
    return bleTransportBridge.isConnected || simulationBridge.isConnected;
  }

  /** Combined peer count: max of BLE and WebSocket peers */
  get connectedPeers(): number {
    return Math.max(
      bleTransportBridge.connectedDevices,
      simulationBridge.connectedDevices
    );
  }
}

export const meshRelayManager = new MeshRelayManager();
