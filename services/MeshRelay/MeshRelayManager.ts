/**
 * Phase 2 — Mesh Relay Manager (The Brain)
 *
 * This is the central orchestrator for the mesh relay system.
 * All other mesh relay code feeds into and out of here.
 *
 * WHAT IT DOES WHEN AN SOS IS TRIGGERED (from THIS phone):
 * 1. Creates packet with GPS coordinates and severity
 * 2. Broadcasts via SimulationBridge (or BLE in production)
 * 3. Queues for cloud upload
 * 4. Fires 'SOS_TRIGGERED' event so UI updates
 *
 * WHAT IT DOES WHEN SOS IS RECEIVED (from another phone):
 * 1. Validates the packet structure
 * 2. Checks deduplication buffer (seen before? → ignore)
 * 3. Calculates distance from crash to our GPS
 * 4. Fires 'SOS_RECEIVED' event → UI shows bystander alert
 * 5. After random jitter delay, relays (re-broadcasts) the packet
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

type EventCallback = (event: MeshEvent) => void;

class MeshRelayManager {
  // Map of eventType → list of callback functions
  private listeners: Map<string, EventCallback[]> = new Map();
  private isInitialized = false;

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

      // Register callbacks before connecting
      simulationBridge.onPacketReceived((packet, relayedBy) => {
        this.handleReceivedPacket(packet);
      });

      simulationBridge.onStatusChanged((connected, deviceCount) => {
        this.emit({
          type: connected ? 'SIMULATION_CONNECTED' : 'SIMULATION_DISCONNECTED',
          data: { deviceCount },
        });
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
      if (!broadcasted) {
        console.warn('[MeshRelay] Broadcast failed — simulation server not connected');
      }

      // Queue for cloud upload (retries automatically when internet available)
      cloudEgress.enqueue(packet);

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

    // ── Step 5: Relay (re-broadcast) ─────────────────────────────
    if (packet.hopCount < MESH.MAX_HOPS) {
      // Random jitter: 0-200ms. Why? If all phones relay simultaneously,
      // packets collide in the Bluetooth radio. Staggering prevents this.
      const jitter = Math.floor(Math.random() * 200);
      setTimeout(() => {
        const relayPacket = createRelayPacket(packet);
        const relayed = simulationBridge.broadcast(relayPacket);
        if (relayed) {
          console.log(`[MeshRelay] 📡 Relayed packet hop=${relayPacket.hopCount}`);
          this.emit({ type: 'SOS_RELAYED', packet: relayPacket });
        }
      }, jitter);
    } else {
      console.log(`[MeshRelay] Max hops reached — not relaying`);
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