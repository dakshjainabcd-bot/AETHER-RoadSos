/**
 * HazardReportStore — Groups hazard reports into per-type location clusters
 *
 * FIXES:
 * 1. Clusters are keyed by TYPE + LOCATION (50m grid cell)
 *    → pothole and accident at same spot = 2 separate clusters, not 1
 * 2. Cluster marker position = stable grid cell center (not average of GPS readings)
 *    → marker stops jumping around due to GPS drift
 * 3. Rate limiting: 10-min cooldown per device+type+location, 30-sec global cooldown
 *    → same device can't spam reports
 *
 * CREDIBILITY:
 *   low    = 1 report  (grey)  — unverified
 *   medium = 2–4 reports (amber) — likely real
 *   high   = 5+ reports (red)  — confirmed, slow down!
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HazardPacket,
  HazardType,
  HazardReport,
  HazardCluster,
  HAZARD_STORE_KEY,
} from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const RATE_LIMIT_KEY        = 'aether_hazard_rate_limit_v1';
const GLOBAL_COOLDOWN_KEY   = 'aether_hazard_global_cooldown_v1';

const HAZARD_TTL_MS          = 30 * 60 * 1000;  // 30 min — matches packet TTL
const COOLDOWN_SAME_SPOT_MS  = 10 * 60 * 1000;  // 10 min — same device, same type, same location
const GLOBAL_COOLDOWN_MS     = 30 * 1000;        // 30 sec — any report from same device

// 50m grid — same as BlackspotEngine
const DEGREES_PER_METER = 1 / 111000;
const CELL_DEGREES       = 50 * DEGREES_PER_METER;

// ── Grid helpers ──────────────────────────────────────────────────────────────

function snapToGrid(v: number): number {
  return Math.round(v / CELL_DEGREES) * CELL_DEGREES;
}

/**
 * KEY INCLUDES HAZARD TYPE — this is the root fix for issues 1 and 5.
 * Pothole and accident at the same 50m cell get DIFFERENT keys and
 * therefore DIFFERENT clusters with correct counts and correct emojis.
 */
function typedCellKey(type: HazardType, lat: number, lng: number): string {
  return `${type}_${snapToGrid(lat).toFixed(6)}_${snapToGrid(lng).toFixed(6)}`;
}

/**
 * Stable display position for the cluster marker.
 * Uses the fixed grid cell center, NOT the average of report positions.
 * This prevents the marker from drifting due to GPS variation (fixes issue 2).
 */
function stableCenter(lat: number, lng: number): { lat: number; lng: number } {
  return { lat: snapToGrid(lat), lng: snapToGrid(lng) };
}

function credibilityLevel(count: number): 'low' | 'medium' | 'high' {
  if (count >= 5) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}

// ── Store class ───────────────────────────────────────────────────────────────

class HazardReportStore {
  private reports: HazardReport[] = [];
  private rateLimits: Record<string, number> = {};  // key → timestamp of last report
  private initialized = false;

  // ── Init ──────────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this._load();
    this.initialized = true;
    console.log(`[HazardStore] Ready — ${this.reports.length} stored report(s)`);
  }

  /** Force reload from storage (call after app foreground) */
  async reload(): Promise<void> {
    this.initialized = false;
    await this.initialize();
  }

  private async _load(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(HAZARD_STORE_KEY);
      if (raw) {
        const all: HazardReport[] = JSON.parse(raw);
        this.reports = all.filter(r => !this._expired(r));
      } else {
        this.reports = [];
      }
    } catch {
      this.reports = [];
    }

    try {
      const limitsRaw = await AsyncStorage.getItem(RATE_LIMIT_KEY);
      if (limitsRaw) this.rateLimits = JSON.parse(limitsRaw);
    } catch {
      this.rateLimits = {};
    }
  }

  private async _persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(HAZARD_STORE_KEY, JSON.stringify(this.reports));
      await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(this.rateLimits));
    } catch (e) {
      console.warn('[HazardStore] Persist error:', e);
    }
  }

  // ── Rate limiting (fixes issue 3) ────────────────────────────────────────

  /**
   * Check whether this device is allowed to report right now.
   * Returns { allowed: true } or { allowed: false, reason, waitSeconds }.
   */
  async checkRateLimit(
    deviceHash: string,
    type: HazardType,
    lat: number,
    lng: number,
  ): Promise<{ allowed: boolean; reason?: string; waitSeconds?: number }> {
    const now = Date.now();

    // ── Global 30-second cooldown ──────────────────────────────────────────
    try {
      const raw = await AsyncStorage.getItem(GLOBAL_COOLDOWN_KEY);
      if (raw) {
        const { dh, t } = JSON.parse(raw) as { dh: string; t: number };
        if (dh === deviceHash) {
          const elapsed = now - t;
          if (elapsed < GLOBAL_COOLDOWN_MS) {
            const waitSeconds = Math.ceil((GLOBAL_COOLDOWN_MS - elapsed) / 1000);
            return {
              allowed: false,
              reason: `Please wait ${waitSeconds} second${waitSeconds !== 1 ? 's' : ''} before reporting again.`,
              waitSeconds,
            };
          }
        }
      }
    } catch {}

    // ── Per-type-location 10-minute cooldown ──────────────────────────────
    const key = `${deviceHash}_${typedCellKey(type, lat, lng)}`;
    const last = this.rateLimits[key];
    if (last) {
      const elapsed = now - last;
      if (elapsed < COOLDOWN_SAME_SPOT_MS) {
        const waitMin = Math.ceil((COOLDOWN_SAME_SPOT_MS - elapsed) / 60000);
        return {
          allowed: false,
          reason: `You already reported a ${type} here. Wait ${waitMin} more minute${waitMin !== 1 ? 's' : ''} to report again.`,
        };
      }
    }

    return { allowed: true };
  }

  /** Call after a successful report to stamp the rate limit */
  async stampRateLimit(
    deviceHash: string,
    type: HazardType,
    lat: number,
    lng: number,
  ): Promise<void> {
    const now = Date.now();
    const key = `${deviceHash}_${typedCellKey(type, lat, lng)}`;
    this.rateLimits[key] = now;

    try {
      await AsyncStorage.setItem(
        GLOBAL_COOLDOWN_KEY,
        JSON.stringify({ dh: deviceHash, t: now }),
      );
    } catch {}

    await this._persist();
  }

  // ── Core: add report ──────────────────────────────────────────────────────

  /**
   * Store a received hazard packet.
   * Returns the updated cluster stats for THIS specific type+location.
   */
  async addReport(packet: HazardPacket): Promise<{
    count: number;
    credibilityLevel: 'low' | 'medium' | 'high';
    clusterKey: string;
  }> {
    await this.initialize();

    // Purge stale data first
    const before = this.reports.length;
    this.reports = this.reports.filter(r => !this._expired(r));
    if (this.reports.length !== before) await this._persist();

    const clusterKey = typedCellKey(packet.hazardType, packet.lat, packet.lng);

    // Deduplicate — same hazardId may arrive via multiple relay hops
    if (this.reports.some(r => r.hazardId === packet.hazardId)) {
      const count = this._countForKey(clusterKey);
      return { count, credibilityLevel: credibilityLevel(count), clusterKey };
    }

    // Store
    this.reports.push({
      hazardId:    packet.hazardId,
      hazardType:  packet.hazardType,
      lat:         packet.lat,
      lng:         packet.lng,
      severity:    packet.severity,
      reportedAt:  packet.reportedAt,
      deviceHash:  packet.deviceHash,
    });
    await this._persist();

    const count = this._countForKey(clusterKey);
    console.log(
      `[HazardStore] ${packet.hazardType} @ cluster "${clusterKey}": ` +
      `${count} report(s) — ${credibilityLevel(count)} credibility`,
    );
    return { count, credibilityLevel: credibilityLevel(count), clusterKey };
  }

  private _countForKey(key: string): number {
    return this.reports.filter(r =>
      typedCellKey(r.hazardType, r.lat, r.lng) === key,
    ).length;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * Build one cluster per (hazardType + 50m cell).
   * Each cluster has the correct type, count, and stable position.
   */
  getClusters(): HazardCluster[] {
    const active = this.reports.filter(r => !this._expired(r));
    const map = new Map<string, HazardReport[]>();

    for (const r of active) {
      const key = typedCellKey(r.hazardType, r.lat, r.lng);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }

    return Array.from(map.entries()).map(([key, reps]) => {
      const first  = reps[0];
      const center = stableCenter(first.lat, first.lng); // stable, no GPS drift
      const latest = [...reps].sort((a, b) => b.reportedAt - a.reportedAt)[0];

      return {
        clusterKey:       key,
        lat:              center.lat,
        lng:              center.lng,
        hazardType:       first.hazardType,  // always correct — key is type-aware
        reportCount:      reps.length,
        latestSeverity:   latest.severity,
        lastReportedAt:   latest.reportedAt,
        credibilityLevel: credibilityLevel(reps.length),
      } satisfies HazardCluster;
    });
  }

  /** Count for a specific type+location (used by alert system) */
  getClusterCount(type: HazardType, lat: number, lng: number): number {
    return this._countForKey(typedCellKey(type, lat, lng));
  }

  async clearAll(): Promise<void> {
    this.reports    = [];
    this.rateLimits = {};
    await AsyncStorage.multiRemove([HAZARD_STORE_KEY, RATE_LIMIT_KEY, GLOBAL_COOLDOWN_KEY]);
  }

  private _expired(r: HazardReport): boolean {
    return Date.now() - r.reportedAt > HAZARD_TTL_MS;
  }

  get reportCount(): number {
    return this.reports.length;
  }
}

export const hazardReportStore = new HazardReportStore();
