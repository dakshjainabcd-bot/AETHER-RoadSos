/**
 * HazardReportStore — Groups received hazard reports into location clusters
 *
 * WHY THIS EXISTS:
 * When multiple drivers report the same pothole/accident, we need to
 * show "3 people reported this" instead of 3 separate alerts.
 * This store groups reports within 50m of each other (same grid cell)
 * and computes a credibility level based on report count.
 *
 * CREDIBILITY LEVELS:
 *   low    = 1 report (could be false alarm)
 *   medium = 2–4 reports (likely real)
 *   high   = 5+ reports (definitely real — slow down!)
 *
 * TTL: Reports expire after 30 minutes (matching HazardPacket TTL).
 * Grid: 50m cells (same algorithm as BlackspotEngine).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HazardPacket,
  HazardType,
  HazardReport,
  HazardCluster,
  HAZARD_STORE_KEY,
} from './types';

// 30 minutes — same as hazard packet TTL in DRIVER_INTEL_CONFIG
const HAZARD_TTL_MS = 30 * 60 * 1000;

// 50m grid (identical to BlackspotEngine)
const DEGREES_PER_METER = 1 / 111000;
const CELL_DEGREES = 50 * DEGREES_PER_METER;

function snapToGrid(value: number): number {
  return Math.round(value / CELL_DEGREES) * CELL_DEGREES;
}

function cellKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)}_${lng.toFixed(6)}`;
}

function computeCredibility(count: number): 'low' | 'medium' | 'high' {
  if (count >= 5) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}

class HazardReportStore {
  private reports: HazardReport[] = [];
  private initialized = false;

  // ── Initialization ──────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.loadFromStorage();
    this.initialized = true;
    console.log(`[HazardStore] Ready — ${this.reports.length} active report(s)`);
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(HAZARD_STORE_KEY);
      if (raw) {
        const all = JSON.parse(raw) as HazardReport[];
        // Filter expired on load so stale reports never come back
        this.reports = all.filter(r => !this.isExpired(r));
      }
    } catch {
      this.reports = [];
    }
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(HAZARD_STORE_KEY, JSON.stringify(this.reports));
    } catch (err) {
      console.warn('[HazardStore] Persist failed:', err);
    }
  }

  // ── Core Operations ─────────────────────────────────────────────────────────

  /**
   * Add a received hazard packet to the store.
   * Returns { count, credibilityLevel } for the cluster this packet belongs to.
   * Safe to call for our own reports too (to seed the cluster count at 1).
   */
  async addReport(packet: HazardPacket): Promise<{
    count: number;
    credibilityLevel: 'low' | 'medium' | 'high';
  }> {
    await this.initialize();

    // Purge expired entries first
    this.reports = this.reports.filter(r => !this.isExpired(r));

    // Skip duplicates (same hazardId = same report, maybe relayed multiple hops)
    if (this.reports.some(r => r.hazardId === packet.hazardId)) {
      const count = this.getClusterCount(packet.lat, packet.lng);
      return { count, credibilityLevel: computeCredibility(count) };
    }

    // Save the new report
    const report: HazardReport = {
      hazardId: packet.hazardId,
      hazardType: packet.hazardType,
      lat: packet.lat,
      lng: packet.lng,
      severity: packet.severity,
      reportedAt: packet.reportedAt,
    };

    this.reports.push(report);
    await this.persist();

    const count = this.getClusterCount(packet.lat, packet.lng);
    console.log(
      `[HazardStore] Stored ${packet.hazardType} — cluster count: ${count}` +
      ` (${computeCredibility(count)} credibility)`
    );
    return { count, credibilityLevel: computeCredibility(count) };
  }

  /**
   * Count how many active reports fall in the same 50m grid cell.
   */
  getClusterCount(lat: number, lng: number): number {
    const targetKey = cellKey(snapToGrid(lat), snapToGrid(lng));
    return this.reports.filter(r => {
      return cellKey(snapToGrid(r.lat), snapToGrid(r.lng)) === targetKey;
    }).length;
  }

  /**
   * Build aggregated clusters for map rendering.
   * Each cluster represents 1+ reports in the same 50m cell.
   */
  getClusters(): HazardCluster[] {
    // Work only with non-expired reports
    const active = this.reports.filter(r => !this.isExpired(r));

    // Group by grid cell
    const cellMap = new Map<string, HazardReport[]>();
    for (const report of active) {
      const key = cellKey(snapToGrid(report.lat), snapToGrid(report.lng));
      if (!cellMap.has(key)) cellMap.set(key, []);
      cellMap.get(key)!.push(report);
    }

    const clusters: HazardCluster[] = [];

    cellMap.forEach((cellReports, key) => {
      // Centroid: average of all report positions in cell
      const lat = cellReports.reduce((s, r) => s + r.lat, 0) / cellReports.length;
      const lng = cellReports.reduce((s, r) => s + r.lng, 0) / cellReports.length;

      // Most recent report
      const sorted = [...cellReports].sort((a, b) => b.reportedAt - a.reportedAt);
      const latest = sorted[0];

      // Most common hazard type in this cluster
      const typeCounts: Partial<Record<HazardType, number>> = {};
      for (const r of cellReports) {
        typeCounts[r.hazardType] = (typeCounts[r.hazardType] ?? 0) + 1;
      }
      const mostCommonType = (
        Object.entries(typeCounts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0][0]
      ) as HazardType;

      clusters.push({
        clusterKey: key,
        lat,
        lng,
        hazardType: mostCommonType,
        reportCount: cellReports.length,
        latestSeverity: latest.severity,
        lastReportedAt: latest.reportedAt,
        credibilityLevel: computeCredibility(cellReports.length),
      });
    });

    return clusters;
  }

  /** Clear all expired reports (housekeeping) */
  async purgeExpired(): Promise<void> {
    const before = this.reports.length;
    this.reports = this.reports.filter(r => !this.isExpired(r));
    if (this.reports.length < before) await this.persist();
  }

  /** Clear everything — for testing */
  async clearAll(): Promise<void> {
    this.reports = [];
    await AsyncStorage.removeItem(HAZARD_STORE_KEY);
  }

  private isExpired(report: HazardReport): boolean {
    return Date.now() - report.reportedAt > HAZARD_TTL_MS;
  }

  get reportCount(): number {
    return this.reports.length;
  }
}

// One instance for the whole app
export const hazardReportStore = new HazardReportStore();
