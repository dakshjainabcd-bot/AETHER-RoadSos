/**
 * DTNManager — Delay-Tolerant Networking State Machine
 *
 * ═══════════════════════════════════════════════════════════════
 * THE STATE MACHINE:
 *
 *          ┌─────────────────────────────────────────┐
 *          │              SOS packet cannot            │
 *          │              be immediately relayed        │
 *          ▼                                           │
 *   ┌──────────┐  ─────────────────────────▶  ┌───────────────────┐
 *   │   IDLE   │                              │  CARRYING_SOS     │
 *   │ (buffer  │  ◀─────────────────────────  │  (≥1 packet in    │
 *   │  empty)  │    All packets forwarded      │   buffer)         │
 *   └──────────┘    OR all TTLs expired        └───────────────────┘
 *                                                       │
 *                                               New peer appears
 *                                               OR WiFi comes up
 *                                                       │
 *                                               Forward all packets
 *
 * ROUTING HEURISTICS (Vertical B from spec):
 *   1. Battery check: must be >20% to act as relay
 *   2. Peer check: must have ≥1 connected peer to forward to
 *   (Trust score heuristic is handled in Phase 13 — we stub it here)
 * ═══════════════════════════════════════════════════════════════
 */

import { DTNBuffer } from './DTNBuffer';
import {
    SOSPacket,
    DTNState,
    DTNEvent,
    DTNEventType,
} from './types';
import { bleTransportBridge } from './BLETransportBridge';
import { simulationBridge } from './SimulationBridge';
import { cloudEgress } from '../CloudEgress';
import { DTN } from '../../utils/constants';
import * as Battery from 'expo-battery';

type DTNEventCallback = (event: DTNEvent) => void;

class DTNManager {
    // The underlying buffer — handles storage and TTL logic
    private readonly buffer = new DTNBuffer();

    // Current state of the DTN state machine
    private state: DTNState = 'IDLE';

    // Subscribers that want to know about DTN events (UI components, etc.)
    private listeners: DTNEventCallback[] = [];

    // Periodic timer to clean up expired packets even when app is idle
    private ttlCheckTimer: ReturnType<typeof setInterval> | null = null;

    // Prevent double-initialization
    private initialized = false;

    // ── Initialization ────────────────────────────────────────────────────────

    /**
     * Start the DTN system.
     *
     * WHAT THIS DOES:
     * 1. Restores any buffered packets from the previous session
     * 2. Sets the correct initial state (IDLE or CARRYING_SOS)
     * 3. Starts a periodic TTL cleanup timer
     *
     * Call this once from MeshRelayManager.initialize().
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Restore packets that survived from the previous app session
        await this.buffer.load();

        // If we loaded packets, we're already in CARRYING state
        if (!this.buffer.isEmpty) {
            this.state = 'CARRYING_SOS';
            console.log(
                `[DTNManager] Restored CARRYING_SOS state` +
                ` — ${this.buffer.size} packet(s) from previous session`
            );
        }

        // Periodic TTL cleanup — runs every 5 minutes even when idle
        // WHY: Without this, the buffer would only be cleaned when
        // tryForward() is called. If no peer ever appears, expired
        // packets would sit in the buffer (and storage) indefinitely.
        this.ttlCheckTimer = setInterval(async () => {
            const removed = await this.buffer.purgeExpired();
            if (removed > 0) {
                this.emit({
                    type: 'DTN_PACKET_EXPIRED',
                    bufferSize: this.buffer.size,
                });
                // If buffer is now empty, return to IDLE
                if (this.buffer.isEmpty) {
                    this.setState('IDLE');
                }
            }
        }, 5 * 60 * 1000); // Every 5 minutes

        this.initialized = true;
        console.log(
            `[DTNManager] ✅ Initialized` +
            ` | State: ${this.state}` +
            ` | Buffer: ${this.buffer.size} packet(s)`
        );
    }

    // ── Core DTN Operations ───────────────────────────────────────────────────

    /**
     * Buffer an SOS packet that could not be immediately relayed.
     *
     * WHEN IS THIS CALLED?
     * By MeshRelayManager in two situations:
     *   1. triggerSOS() is called but connectedDevices < 2 (no peers)
     *   2. handleReceivedPacket() tries to relay but has no peers
     *
     * WHAT HAPPENS NEXT:
     * The packet waits in the buffer. Every time a new peer is discovered
     * (PEER_COUNT_UPDATE from server), tryForward() is called automatically.
     *
     * Additionally, cloudEgress.enqueue() is called immediately — if WiFi
     * happens to be available at this moment, the packet uploads directly
     * to the cloud without waiting for a BLE/WiFi-Direct relay peer.
     */
    async bufferPacket(packet: SOSPacket): Promise<void> {
        const wasAdded = await this.buffer.push(packet);
        if (!wasAdded) {
            // Duplicate — already buffered this incidentId
            return;
        }

        // Transition to CARRYING state
        this.setState('CARRYING_SOS');

        // Emit event so UI can update
        this.emit({
            type: 'DTN_PACKET_BUFFERED',
            packet,
            bufferSize: this.buffer.size,
        });

        // Try cloud upload immediately — CloudEgress will only actually
        // upload if internet is available; otherwise it queues internally.
        cloudEgress.enqueue(packet);

        console.log(
            `[DTNManager] 📦 Buffered SOS: ${packet.incidentId}` +
            ` | Buffer: ${this.buffer.size}/${DTN.MAX_BUFFER_SIZE}` +
            ` | Severity: ${packet.severity}/5`
        );
    }

    /**
     * Attempt to forward all buffered packets to available peers.
     *
     * WHEN IS THIS CALLED?
     * By MeshRelayManager when:
     *   1. A new peer connects to the simulation server
     *   2. We reconnect to the simulation server
     *
     * ROUTING HEURISTICS (checked before forwarding):
     *   1. Battery must be >20% (we don't drain a dying phone)
     *   2. Must have at least 1 connected peer to forward to
     *
     * WHAT HAPPENS:
     * For each buffered packet that passes TTL check:
     *   → Broadcast it via SimulationBridge
     *   → If successful, remove from buffer
     *   → After all forwards, update state to IDLE if buffer is empty
     */
    async tryForward(): Promise<void> {
        // Nothing to forward
        if (this.buffer.isEmpty) return;

        // Routing Heuristic 2: Need at least 1 other peer on ANY transport.
        // BUG FIX: Previously only checked bleTransportBridge.connectedDevices,
        // which is always 1 in WiFi/demo mode (no BLE peers ever counted).
        // Now we take the max of BLE peers and WebSocket peers — same logic
        // as MeshRelayManager.connectedPeers — so DTN forwards correctly over
        // whichever transport actually has peers connected.
        const blePeers = bleTransportBridge.connectedDevices;   // verified AETHER peers + self
        const wsPeers  = simulationBridge.connectedDevices;     // WS phones including self
        const totalVisible = Math.max(blePeers, wsPeers);

        if (totalVisible < 2) {
            console.log(
                `[DTNManager] No peers available` +
                ` (BLE: ${blePeers}, WS: ${wsPeers})` +
                ` — holding ${this.buffer.size} packet(s)`
            );
            return;
        }

        // Routing Heuristic 1: Battery check
        const batteryOk = await this.checkBattery();
        if (!batteryOk) {
            console.log(
                `[DTNManager] Battery too low (<${DTN.MIN_BATTERY_PCT}%)` +
                ` — not forwarding to conserve power`
            );
            return;
        }

        const peerCount = totalVisible - 1; // Peers = total - self
        const entries = await this.buffer.getForwardable();

        if (entries.length === 0) {
            // All were expired during purge
            this.setState('IDLE');
            return;
        }

        console.log(
            `[DTNManager] 🚀 Forwarding ${entries.length} packet(s)` +
            ` to ${peerCount} peer(s) | BLE: ${blePeers - 1} WS: ${wsPeers - 1}`
        );

        for (const entry of entries) {
            // BUG FIX: Previously only called bleTransportBridge.broadcast() here.
            // If BLE had no peers (common in WiFi/demo mode), success was always
            // false and the packet was never removed from the buffer — stuck forever.
            // Now we try BOTH transports (same dual-broadcast pattern as triggerSOS).
            const bleOk = bleTransportBridge.broadcast(entry.packet);
            const wsOk  = simulationBridge.broadcast(entry.packet);
            const success = bleOk || wsOk;

            if (success) {
                // Packet sent — remove from buffer
                await this.buffer.remove(entry.packet.incidentId);

                this.emit({
                    type: 'DTN_PACKET_FORWARDED',
                    packet: entry.packet,
                    bufferSize: this.buffer.size,
                });

                console.log(
                    `[DTNManager] ✅ Forwarded: ${entry.packet.incidentId}` +
                    ` — BLE: ${bleOk ? '✅' : '❌'} WS: ${wsOk ? '✅' : '❌'}` +
                    ` | Remaining: ${this.buffer.size}`
                );
            } else {
                // Both transports failed (disconnected mid-forward)
                console.warn(
                    `[DTNManager] Both transports failed for ${entry.packet.incidentId}` +
                    ` — keeping in buffer`
                );
            }
        }

        // Update state after all forward attempts
        if (this.buffer.isEmpty) {
            this.setState('IDLE');
        }
    }

    // ── Routing Heuristics ────────────────────────────────────────────────────

    /**
     * Check if the device has enough battery to safely act as a relay.
     *
     * WHY 20%?
     * Below 20%, the device owner needs the battery for their own
     * emergency (calling for help, GPS navigation, etc.). We shouldn't
     * drain their remaining battery relaying someone else's SOS.
     *
     * If the battery API fails for any reason, we default to TRUE
     * (allow forwarding) — it's safer to relay and risk battery drain
     * than to drop an emergency SOS.
     *
     * If the device is charging, we always relay (no restriction).
     */
    private async checkBattery(): Promise<boolean> {
        try {
            const level = await Battery.getBatteryLevelAsync(); // 0.0 to 1.0
            const pct = Math.round(level * 100);

            // Always relay when charging
            const batteryState = await Battery.getBatteryStateAsync();
            if (
                batteryState === Battery.BatteryState.CHARGING ||
                batteryState === Battery.BatteryState.FULL
            ) {
                console.log(`[DTNManager] Charging — relay allowed (battery: ${pct}%)`);
                return true;
            }

            if (pct < DTN.MIN_BATTERY_PCT) {
                console.log(
                    `[DTNManager] Battery at ${pct}% — below ${DTN.MIN_BATTERY_PCT}% threshold`
                );
                return false;
            }

            console.log(`[DTNManager] Battery OK: ${pct}%`);
            return true;
        } catch {
            // Battery API unavailable (simulator, or permissions)
            // Default to TRUE — relay is allowed
            return true;
        }
    }

    // ── Getters (for UI and debugging) ────────────────────────────────────────

    /** Current state of the DTN state machine */
    get currentState(): DTNState {
        return this.state;
    }

    /** Number of packets currently in the buffer */
    get bufferSize(): number {
        return this.buffer.size;
    }

    /** True when we have packets waiting for a relay opportunity */
    get isCarrying(): boolean {
        return this.state === 'CARRYING_SOS' && !this.buffer.isEmpty;
    }

    // ── Event System (same pub/sub pattern as MeshRelayManager) ──────────────

    /**
     * Subscribe to DTN events.
     * Returns an unsubscribe function — call it in useEffect cleanup.
     *
     * Usage:
     *   const unsub = dtnManager.on((event) => {
     *     if (event.type === 'DTN_PACKET_BUFFERED') { ... }
     *   });
     *   return () => unsub();
     */
    on(callback: DTNEventCallback): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private emit(event: DTNEvent): void {
        this.listeners.forEach(cb => {
            try {
                cb(event);
            } catch (err) {
                console.error('[DTNManager] Listener error:', err);
            }
        });
    }

    private setState(newState: DTNState): void {
        if (this.state === newState) return;
        const prev = this.state;
        this.state = newState;
        console.log(`[DTNManager] State: ${prev} → ${newState}`);
        this.emit({
            type: 'DTN_STATE_CHANGED',
            state: newState,
            bufferSize: this.buffer.size,
        });
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /** Stop all timers. Call when the app closes. */
    shutdown(): void {
        if (this.ttlCheckTimer) {
            clearInterval(this.ttlCheckTimer);
            this.ttlCheckTimer = null;
        }
        console.log('[DTNManager] Shutdown');
    }

    /** Clear the buffer — for testing only */
    async resetForTesting(): Promise<void> {
        await this.buffer.clear();
        this.setState('IDLE');
        console.log('[DTNManager] Buffer cleared (test reset)');
    }
}

// ── Singleton export ──────────────────────────────────────────────────────────
// One instance shared across the entire app.
// Import this wherever you need DTN functionality.
export const dtnManager = new DTNManager();