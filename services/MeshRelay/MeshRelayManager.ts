/**
 * Phase 2 — Mesh Relay Manager (The Brain)
 * Phase 14 — Integrated with DTN (Delay-Tolerant Networking) for store-and-forward
 *
 * This is the central orchestrator for the mesh relay system.
 * All other mesh relay code feeds into and out of here.
 *
 * WHAT IT DOES WHEN AN SOS IS TRIGGERED (from THIS phone):
 * 1. Creates packet with GPS coordinates and severity
 * 2. Broadcasts via SimulationBridge (or BLE in production)
 * 3. If no peers available, buffers packet in DTN for later forwarding
 * 4. Queues for cloud upload
 * 5. Fires 'SOS_TRIGGERED' event so UI updates
 *
 * WHAT IT DOES WHEN SOS IS RECEIVED (from another phone):
 * 1. Validates the packet structure
 * 2. Checks deduplication buffer (seen before? → ignore)
 * 3. Calculates distance from crash to our GPS
 * 4. Fires 'SOS_RECEIVED' event → UI shows bystander alert
 * 5. After random jitter delay, relays (re-broadcasts) the packet.
 *    If no peers, buffers the relay packet in DTN.
 * 6. Queues for cloud upload
 *
 * EVENT SYSTEM:
 * This uses a publish-subscribe pattern. UI components call:
 *   meshRelayManager.on('SOS_RECEIVED', (event) => { ... })
 * and get notified when things happen, without tight coupling.
 */

import { SOSPacket, MeshEvent, MeshEventType } from './types';
import { createSOSPacket, createRelayPacket, isValidPacket, getDeviceHash } from './PacketProtocol';
import { deduplicationBuffer } from './DeduplicationBuffer';
import { simulationBridge } from './SimulationBridge';
import { haversineDistance } from '../../utils/haversine';
import { getLastKnownLocation } from '../GPSService';
import { cloudEgress } from '../CloudEgress';
import { MESH } from '../../utils/constants';
import { verifyHMAC } from '../../utils/AESCrypto';
import { SECURITY } from '../../utils/constants';
import { trustScoreService } from '../Trust/TrustScoreService';
import { badgeService } from '../Trust/BadgeService';
import { dtnManager } from './DTNManager';  // ← Phase 14: DTN

type EventCallback = (event: MeshEvent) => void;

class MeshRelayManager {
  // Map of eventType → list of callback functions
  private listeners: Map<string, EventCallback[]> = new Map();
  private isInitialized = false;
  private lastSOSTriggerTime: number = 0;

  /**
   * Initialize the mesh relay system.
   * Call this ONCE at app startup (in _layout.tsx).
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[MeshRelay] Already initialized');
      return;
    }

    try {
      const deviceHash = await getDeviceHash();
      console.log('[MeshRelay] Initializing. Device:', deviceHash.substring(0, 8) + '...');

      // ── Phase 14: Initialize DTN store-and-forward ────────────────────
      // This restores any buffered packets from previous sessions and
      // starts the TTL cleanup timer.
      await dtnManager.initialize();
      console.log(
        `[MeshRelay] DTN initialized` +
        ` | State: ${dtnManager.currentState}` +
        ` | Buffered: ${dtnManager.bufferSize} packet(s)`
      );
      // ─────────────────────────────────────────────────────────────────

      // Register callbacks before connecting
      simulationBridge.onPacketReceived((packet, relayedBy) => {
        this.handleReceivedPacket(packet);
      });

      simulationBridge.onStatusChanged((connected, deviceCount) => {
        this.emit({
          type: connected ? 'SIMULATION_CONNECTED' : 'SIMULATION_DISCONNECTED',
          data: { deviceCount },
        });

        // ── Phase 14: DTN Forward Trigger ──────────────────────────────
        // When the peer count increases (new phone connected), try to
        // forward any buffered DTN packets to the new peer.
        //
        // WHY HERE: This callback fires on EVERY peer count change
        // including new joins. So this is the perfect hook for DTN.
        //
        // The check `deviceCount >= 2` ensures we have at least 1 peer
        // (total connected = us + them, so ≥ 2 means at least 1 peer).
        if (connected && deviceCount >= 2 && dtnManager.isCarrying) {
          console.log(
            `[MeshRelay] New peer detected (${deviceCount} total)` +
            ` — triggering DTN forward`
          );
          dtnManager.tryForward().catch(err =>
            console.error('[MeshRelay] DTN forward error:', err)
          );
        }
        // ───────────────────────────────────────────────────────────────
      });

      // Connect to simulation server
      const connected = await simulationBridge.connect(deviceHash);
      if (connected) {
        console.log('[MeshRelay] ✅ Simulation server connected (Expo Go mode)');
      } else {
        console.log('[MeshRelay] ⚠️  Simulation server not reachable. App works, mesh relay unavailable until server starts.');
      }

      // Start cloud egress monitoring
      cloudEgress.startMonitoring();

      this.isInitialized = true;
      console.log('[MeshRelay] Ready');
    } catch (error) {
      console.error('[MeshRelay] Initialization error:', error);
      // Non-fatal — app continues without mesh relay
    }
  }

  /**
   * TRIGGER AN SOS — Call this when a crash is detected.
   *
   * @param severity  1 (minor) to 5 (critical) — based on crash force
   * @returns The created SOS packet, or null if GPS unavailable
   */
  async triggerSOS(severity: 1 | 2 | 3 | 4 | 5 = 3): Promise<SOSPacket | null> {
    try {
      // ── PHASE 10: Rate Limiting ────────────────────────────────────────────
      // Prevent SOS flooding: max 1 trigger per 60 seconds.
      // This defends against:
      // (a) Accidental double-taps
      // (b) Malicious apps trying to flood the mesh with fake SOS packets
      const now = Date.now();
      const timeSinceLast = now - this.lastSOSTriggerTime;

      if (this.lastSOSTriggerTime > 0 && timeSinceLast < SECURITY.SOS_RATE_LIMIT_MS) {
        const waitSec = Math.ceil((SECURITY.SOS_RATE_LIMIT_MS - timeSinceLast) / 1000);
        console.warn(
          `[MeshRelay] ⚠️ RATE LIMITED — SOS blocked.`,
          `Last SOS was ${Math.floor(timeSinceLast / 1000)}s ago.`,
          `Wait ${waitSec}s more.`
        );
        return null; // Caller handles null by showing "please wait" message
      }

      this.lastSOSTriggerTime = now; // Record this trigger attempt
      // ─────────────────────────────────────────────────────────────────────

      // Get current GPS location
      const location = await getLastKnownLocation();
      if (!location) {
        console.error('[MeshRelay] Cannot trigger SOS — GPS location unavailable');
        return null;
      }

      // Create the SOS packet
      const packet = await createSOSPacket(location.lat, location.lng, severity);
      console.log(`[MeshRelay] 🚨 SOS TRIGGERED! Incident: ${packet.incidentId}`);

      // Mark this packet as seen in our dedup buffer
      // (so we don't process our own relay-echo as an incoming SOS)
      deduplicationBuffer.isNew(packet.incidentId); // This marks it as seen

      // Broadcast via simulation bridge (or BLE in production)
      const broadcasted = simulationBridge.broadcast(packet);

      // ── Phase 14: DTN Logic ──────────────────────────────────────────────────
      // Check if there are actually peers to receive this broadcast.
      //
      // simulationBridge.connectedDevices counts ALL phones including ours.
      // If count < 2, we're alone — the packet went to the server but
      // no other phone received it.
      //
      // In this case, buffer the packet in DTN so it can be forwarded
      // when a peer eventually appears.
      if (!broadcasted || simulationBridge.connectedDevices < 2) {
        console.log(
          `[MeshRelay] No peers available` +
          ` (${simulationBridge.connectedDevices} device(s))` +
          ` — buffering SOS in DTN`
        );
        await dtnManager.bufferPacket(packet);
      } else {
        console.log(
          `[MeshRelay] SOS broadcast to ${simulationBridge.connectedDevices - 1} peer(s)`
        );
      }
      // ─────────────────────────────────────────────────────────────────────────

      // Queue for cloud upload (retries automatically when internet available)
      // Phase 10: We keep precise coords for cloud upload, while the 'packet' 
      // broadcasted to mesh relay only has rounded ±111m precision coords.
      cloudEgress.enqueue({
        ...packet,
        lat: location.lat,
        lng: location.lng,
      });

      // Notify all UI subscribers
      this.emit({ type: 'SOS_TRIGGERED', packet });

      return packet;
    } catch (error) {
      console.error('[MeshRelay] Failed to trigger SOS:', error);
      return null;
    }
  }

  /**
   * Handle an SOS packet received from another phone.
   * This is the core relay logic.
   */
  private async handleReceivedPacket(packet: SOSPacket): Promise<void> {
    // ── Step 1: Validate ─────────────────────────────────────────
    if (!isValidPacket(packet)) {
      console.log('[MeshRelay] Rejected invalid packet');
      return;
    }

    // ── PHASE 10: HMAC Integrity Verification ─────────────────────────────
    // If the packet has an HMAC attached, verify it.
    // If it doesn't (old format or test packet), pass through.
    if (packet.hmac) {
      const dataToVerify = JSON.stringify({
        incidentId: packet.incidentId,
        lat: packet.lat,
        lng: packet.lng,
        severity: packet.severity,
        timestamp: packet.timestamp,
      });

      const isAuthentic = verifyHMAC(dataToVerify, packet.hmac);

      if (!isAuthentic) {
        console.warn(
          `[MeshRelay] ❌ HMAC VERIFICATION FAILED for packet ${packet.incidentId}`,
          `— packet may have been tampered with. Dropping.`
        );
        return; // Reject tampered packet — do not process or relay
      }

      console.log(`[MeshRelay] ✅ HMAC verified — packet ${packet.incidentId} is authentic`);
    } else {
      console.log(`[MeshRelay] ℹ️ Packet ${packet.incidentId} has no HMAC — accepting (legacy format)`);
    }
    // ─────────────────────────────────────────────────────────────────────

    // ── Step 2: Deduplicate ──────────────────────────────────────
    if (!deduplicationBuffer.isNew(packet.incidentId)) {
      console.log(`[MeshRelay] Duplicate packet ${packet.incidentId} — ignored`);
      return;
    }

    console.log(
      `[MeshRelay] New SOS! Incident: ${packet.incidentId} | ` +
      `Severity: ${packet.severity} | Hop: ${packet.hopCount}`
    );

    // ── Step 3: Distance check ───────────────────────────────────
    const myLocation = await getLastKnownLocation();
    let isNearby = true; // Default: show alert even if no GPS (safety first)
    let distanceM = 0;

    if (myLocation) {
      const distanceKm = haversineDistance(
        myLocation.lat, myLocation.lng,
        packet.lat, packet.lng
      );
      distanceM = distanceKm * 1000;
      isNearby = distanceM <= MESH.BYSTANDER_RADIUS_M;

      console.log(
        `[MeshRelay] Crash is ${Math.round(distanceM)}m away. ` +
        `${isNearby ? '✅ Within' : '❌ Outside'} ${MESH.BYSTANDER_RADIUS_M}m alert radius.`
      );
    } else {
      console.log('[MeshRelay] No GPS — showing alert by default');
    }

    // ── Step 4: Notify UI ────────────────────────────────────────
    this.emit({
      type: 'SOS_RECEIVED',
      packet,
      data: {
        isNearby,
        distanceM: Math.round(distanceM),
        receivedAt: Date.now(),
      },
    });

    // ── Step 5: Relay (re-broadcast) ─────────────────────────────────────────
    if (packet.hopCount < MESH.MAX_HOPS) {
      // Random jitter: 0-200ms. Why? If all phones relay simultaneously,
      // packets collide in the Bluetooth radio. Staggering prevents this.
      const jitter = Math.floor(Math.random() * 200);
      setTimeout(async () => {
        const relayPacket = createRelayPacket(packet);

        // ── Phase 14: DTN-aware relay ─────────────────────────────────────
        // Before relaying, check if there are any peers to relay TO.
        // If we're alone, buffer the relay packet in DTN instead of
        // dropping it. This is the "store" part of store-and-forward.
        if (simulationBridge.connectedDevices < 2) {
          console.log(
            `[MeshRelay] No peers for relay (hop=${relayPacket.hopCount})` +
            ` — buffering in DTN`
          );
          await dtnManager.bufferPacket(relayPacket);
        } else {
          const relayed = simulationBridge.broadcast(relayPacket);
          if (relayed) {
            console.log(
              `[MeshRelay] 📡 Relayed hop=${relayPacket.hopCount}` +
              ` to ${simulationBridge.connectedDevices - 1} peer(s)`
            );
            this.emit({ type: 'SOS_RELAYED', packet: relayPacket });
            // ── Phase 13: Trust + Badge tracking ───────────────────────
            trustScoreService.onSuccessfulRelay().catch(() => {});
            badgeService.onRelaySuccess().then((earned) => {
              if (earned) {
                console.log(`[MeshRelay] 🏆 Relay Node badge earned!`);
              }
            }).catch(() => {});
          } else {
            // Broadcast returned false (disconnected) — buffer it
            console.log(
              `[MeshRelay] Broadcast failed — buffering relay packet in DTN`
            );
            await dtnManager.bufferPacket(relayPacket);
          }
        }
        // ─────────────────────────────────────────────────────────────────
      }, jitter);
    } else {
      console.log(`[MeshRelay] Max hops (${MESH.MAX_HOPS}) reached — not relaying`);
    }

    // ── Step 6: Queue for cloud upload ───────────────────────────
    cloudEgress.enqueue(packet);
  }

  /**
   * Subscribe to mesh events.
   *
   * Usage:
   *   const unsubscribe = meshRelayManager.on('SOS_RECEIVED', (e) => {
   *     console.log('SOS nearby!', e.packet);
   *   });
   *   // Call unsubscribe() to stop listening (e.g., in useEffect cleanup)
   *
   * @param eventType  Specific event type, or 'ALL' to hear everything
   * @param callback   Function called when event fires
   * @returns          Cleanup function — call it when component unmounts
   */
  on(eventType: MeshEventType | 'ALL', callback: EventCallback): () => void {
    const key = String(eventType);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)!.push(callback);

    // Return cleanup function
    return () => {
      const callbacks = this.listeners.get(key) ?? [];
      this.listeners.set(key, callbacks.filter(cb => cb !== callback));
    };
  }

  /** Fire an event to all subscribers */
  private emit(event: MeshEvent): void {
    // Specific type listeners
    const specific = this.listeners.get(event.type) ?? [];
    specific.forEach(cb => {
      try { cb(event); } catch (err) {
        console.error('[MeshRelay] Listener error:', err);
      }
    });

    // 'ALL' listeners
    const all = this.listeners.get('ALL') ?? [];
    all.forEach(cb => {
      try { cb(event); } catch (err) {
        console.error('[MeshRelay] Listener error:', err);
      }
    });
  }

  /** Is the simulation server currently connected? */
  get isSimulationConnected(): boolean {
    return simulationBridge.isConnected;
  }

  /** How many AETHER phones are currently online? */
  get connectedPeers(): number {
    return simulationBridge.connectedDevices;
  }
}

// Singleton — the one and only MeshRelayManager for the whole app
export const meshRelayManager = new MeshRelayManager();