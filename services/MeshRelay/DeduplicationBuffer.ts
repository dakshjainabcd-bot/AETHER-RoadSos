/**
 * Phase 2 — Deduplication Buffer
 *
 * PROBLEM: In a mesh of 10 phones, one SOS packet triggers:
 * - Phone B re-broadcasts → heard by C, D, E
 * - Phone C re-broadcasts → heard by D, E, F
 * - Phone D might receive the same packet 4 times
 *
 * Without this buffer: 4 "accident nearby" alerts for one crash.
 * With this buffer: exactly 1 alert, always.
 *
 * HOW IT WORKS:
 * We keep a list of "incidentIds we've already seen."
 * Before processing any packet, we check: "Is this ID in the list?"
 * If YES → ignore. If NO → add to list and process.
 *
 * Entries auto-expire after 5 minutes (DEDUP_WINDOW_MS).
 */

import { DEDUP_WINDOW_MS } from './types';

interface SeenEntry {
  incidentId: string;
  seenAt: number; // Unix milliseconds when we first saw it
}

class DeduplicationBuffer {
  private seen: SeenEntry[] = [];
  private readonly MAX_SIZE = 200; // Maximum entries to keep in memory

  /**
   * Check if a packet is NEW (not seen before).
   *
   * SIDE EFFECT: If it IS new, we record it so future calls return false.
   *
   * @returns true → process this packet (it's new)
   *          false → ignore this packet (already seen)
   */
  isNew(incidentId: string): boolean {
    // First, clean up expired entries (older than 5 minutes)
    this.cleanup();

    // Check if already seen
    const alreadySeen = this.seen.some(entry => entry.incidentId === incidentId);

    if (alreadySeen) {
      return false; // Duplicate — skip it
    }

    // Not seen before — record it
    this.seen.push({ incidentId, seenAt: Date.now() });

    // Cap buffer size — drop oldest entries if over limit
    if (this.seen.length > this.MAX_SIZE) {
      this.seen = this.seen.slice(-this.MAX_SIZE);
    }

    return true; // New! Process it.
  }

  /**
   * Remove entries older than DEDUP_WINDOW_MS (5 minutes).
   * Called automatically before every isNew() check.
   */
  private cleanup(): void {
    const cutoff = Date.now() - DEDUP_WINDOW_MS;
    const before = this.seen.length;
    this.seen = this.seen.filter(entry => entry.seenAt > cutoff);
    const removed = before - this.seen.length;
    if (removed > 0) {
      console.log(`[DeduplicationBuffer] Cleaned ${removed} expired entries. ${this.seen.length} remaining.`);
    }
  }

  /** How many unique incidents have we seen recently? (For debug panel) */
  size(): number {
    this.cleanup();
    return this.seen.length;
  }

  /** Clear all entries (for testing) */
  clear(): void {
    this.seen = [];
  }
}

// One single instance shared by the whole app
export const deduplicationBuffer = new DeduplicationBuffer();