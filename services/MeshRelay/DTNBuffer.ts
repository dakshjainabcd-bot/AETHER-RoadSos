/**
 * DTNBuffer — Delay-Tolerant Networking Packet Buffer
 *
 * ═══════════════════════════════════════════════════════════════
 * WHAT THIS IS:
 * A simple ring buffer that holds SOS packets when no relay is
 * immediately available. Think of it like a postal mailbox — you
 * drop your letter (SOS) in the box when no postman is around,
 * and the letter waits until the postman (relay phone) arrives.
 *
 * STORAGE:
 * Packets are persisted to AsyncStorage (phone's local storage)
 * so they survive app restarts. If the victim's phone reboots after
 * a crash, the buffered SOS is not lost.
 *
 * EVICTION POLICY:
 * - TTL: packets older than 30 minutes are expired automatically
 * - Capacity: max 5 packets. 6th packet drops the oldest (FIFO)
 * ═══════════════════════════════════════════════════════════════
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOSPacket, DTNPacketEntry } from './types';
import { DTN } from '../../utils/constants';

const STORAGE_KEY = 'aether_dtn_buffer_v1';

export class DTNBuffer {
    // In-memory array of buffered packets.
    // This is the "source of truth" at runtime.
    // AsyncStorage is only used for persistence between sessions.
    private entries: DTNPacketEntry[] = [];

    // ── Initialization ────────────────────────────────────────────────────────

    /**
     * Load any packets that survived from a previous session.
     *
     * WHY: If the app is force-quit right after a crash is detected
     * and before a relay is found, the buffered SOS would be in
     * AsyncStorage. This restores it so we can continue trying to relay.
     *
     * Call this ONCE when the DTNManager initializes.
     */
    async load(): Promise<void> {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (!raw) {
                this.entries = [];
                return;
            }
            const parsed = JSON.parse(raw) as DTNPacketEntry[];
            // While loading, filter out expired packets so we don't
            // restore 2-hour-old SOS packets that are stale.
            this.entries = parsed.filter(e => !this.isExpired(e));
            console.log(
                `[DTNBuffer] Loaded ${this.entries.length} packet(s) from storage`
            );
        } catch (err) {
            console.error('[DTNBuffer] Failed to load from storage:', err);
            this.entries = [];
        }
    }

    // ── Core Operations ───────────────────────────────────────────────────────

    /**
     * Add a new SOS packet to the buffer.
     *
     * DUPLICATE HANDLING:
     * If a packet with the same incidentId already exists, we skip it.
     * This prevents the same SOS from filling up the buffer.
     *
     * CAPACITY HANDLING:
     * If the buffer is at MAX (5 packets), we drop the OLDEST one first.
     * This is a FIFO eviction — newest packets are preferred because the
     * oldest crash might already be handled (ambulance arrived).
     *
     * @returns true  if the packet was added (new packet)
     * @returns false if it was a duplicate (already buffered)
     */
    async push(packet: SOSPacket): Promise<boolean> {
        // Duplicate check — same incidentId means same crash
        const alreadyHave = this.entries.some(
            e => e.packet.incidentId === packet.incidentId
        );
        if (alreadyHave) {
            console.log(
                `[DTNBuffer] Duplicate skipped: ${packet.incidentId}`
            );
            return false;
        }

        // Capacity check — drop oldest if full
        if (this.entries.length >= DTN.MAX_BUFFER_SIZE) {
            const dropped = this.entries.shift(); // Remove from FRONT (oldest)
            console.log(
                `[DTNBuffer] ⚠️ Buffer full — dropped oldest: ${dropped?.packet.incidentId}`
            );
        }

        // Add the new packet to the END (newest)
        const entry: DTNPacketEntry = {
            packet,
            bufferedAt: Date.now(),
            forwardAttempts: 0,
        };
        this.entries.push(entry);
        await this.persist();

        console.log(
            `[DTNBuffer] 📦 Buffered: ${packet.incidentId}` +
            ` | Buffer: ${this.entries.length}/${DTN.MAX_BUFFER_SIZE}`
        );
        return true;
    }

    /**
     * Get all packets that are eligible for forwarding.
     *
     * This automatically runs TTL expiry first — expired packets are
     * removed from the buffer and never returned for forwarding.
     *
     * @returns Array of non-expired DTN entries (safe to forward)
     */
    async getForwardable(): Promise<DTNPacketEntry[]> {
        await this.purgeExpired();
        // Return a copy so callers can't accidentally mutate our internal state
        return [...this.entries];
    }

    /**
     * Remove a specific packet after it has been successfully forwarded.
     *
     * WHY: Once a packet is relayed to a peer, we should stop carrying it.
     * Otherwise we'd forward the same SOS every time a new peer appears.
     */
    async remove(incidentId: string): Promise<void> {
        const before = this.entries.length;
        this.entries = this.entries.filter(
            e => e.packet.incidentId !== incidentId
        );
        if (this.entries.length < before) {
            await this.persist();
            console.log(
                `[DTNBuffer] Removed: ${incidentId}` +
                ` | Buffer: ${this.entries.length}/${DTN.MAX_BUFFER_SIZE}`
            );
        }
    }

    /**
     * Remove all packets older than DTN.TTL_MS (30 minutes).
     *
     * WHY: A 30-minute-old SOS is likely already handled. Keeping stale
     * packets wastes battery trying to relay outdated emergencies.
     *
     * @returns Number of packets that were removed
     */
    async purgeExpired(): Promise<number> {
        const before = this.entries.length;
        this.entries = this.entries.filter(e => !this.isExpired(e));
        const removed = before - this.entries.length;

        if (removed > 0) {
            console.log(
                `[DTNBuffer] ⏰ Expired and removed ${removed} packet(s)` +
                ` | Buffer: ${this.entries.length}/${DTN.MAX_BUFFER_SIZE}`
            );
            await this.persist();
        }
        return removed;
    }

    /**
     * Remove ALL packets from the buffer.
     * Used for testing and reset purposes only.
     */
    async clear(): Promise<void> {
        this.entries = [];
        await AsyncStorage.removeItem(STORAGE_KEY);
        console.log('[DTNBuffer] 🧹 Buffer cleared');
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    /** Current number of buffered packets */
    get size(): number {
        return this.entries.length;
    }

    /** True when there are no buffered packets */
    get isEmpty(): boolean {
        return this.entries.length === 0;
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    /**
     * Check if a buffered entry has exceeded its 30-minute TTL.
     */
    private isExpired(entry: DTNPacketEntry): boolean {
        return Date.now() - entry.bufferedAt > DTN.TTL_MS;
    }

    /**
     * Write current buffer state to AsyncStorage.
     * Called after every mutation (push, remove, purge).
     */
    private async persist(): Promise<void> {
        try {
            await AsyncStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(this.entries)
            );
        } catch (err) {
            // Non-fatal — in-memory buffer still works, just not persisted
            console.error('[DTNBuffer] Failed to persist to storage:', err);
        }
    }
}