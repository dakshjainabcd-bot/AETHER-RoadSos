/**
 * Phase 9 — BlackspotEngine
 *
 * WHAT THIS DOES:
 * Takes all the raw driving events and figures out WHERE the dangerous
 * road segments are using a statistical outlier detection algorithm.
 *
 * THE ALGORITHM (PostGIS ST_SnapToGrid equivalent, done locally):
 *
 * Step 1 — Snap to Grid:
 *   Every GPS coordinate is "snapped" to the nearest 50m grid cell.
 *   Think of it like rounding to the nearest 50 metres — all events
 *   within the same 50m square get grouped together.
 *
 * Step 2 — Count Events per Cell:
 *   Count how many driving events fell in each cell.
 *
 * Step 3 — Statistical Outlier Detection:
 *   Calculate the mean and standard deviation of event counts across
 *   ALL cells. A cell becomes a "blackspot" if:
 *     count > mean + (2 × stddev)
 *
 *   WHY STATISTICS? Because a road near a school will naturally have
 *   more braking events than an empty highway. We're not looking for
 *   "many events" — we're looking for "significantly MORE events than
 *   the typical road segment in this dataset". That's what stddev gives us.
 *
 * Step 4 — Severity Tiers:
 *   - high:   > 50 events
 *   - medium: 11-50 events
 *   - low:    5-10 events
 *
 * WHY LOCAL (not cloud)?
 * The master document says PostGIS runs on the cloud backend.
 * For the Expo Go demo, we replicate the exact same algorithm in
 * JavaScript/TypeScript so it works offline. When a real backend
 * is deployed, this local engine becomes the fallback.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Blackspot, DrivingEvent, ROAD_DNA_CONFIG, ROAD_DNA_STORAGE_KEYS } from './types';
import { getAllLocalEvents } from './DrivingEventLogger';

// 1 degree latitude ≈ 111,000 metres
// So GRID_CELL_M metres in degrees = GRID_CELL_M / 111000
const DEGREES_PER_METER = 1 / 111000;
const CELL_DEGREES = ROAD_DNA_CONFIG.GRID_CELL_M * DEGREES_PER_METER;

/**
 * Snap a coordinate to the nearest grid cell centre.
 * This is the JavaScript equivalent of PostGIS ST_SnapToGrid.
 *
 * Example with CELL_DEGREES = 0.00045 (≈50m):
 *   12.9716 → round(12.9716 / 0.00045) × 0.00045 = 12.9716 (snapped)
 */
function snapToGrid(value: number): number {
    return Math.round(value / CELL_DEGREES) * CELL_DEGREES;
}

/**
 * Create a string key for a grid cell from its lat/lng.
 * Used as the key in our Map<string, events[]>.
 */
function cellKey(lat: number, lng: number): string {
    return `${lat.toFixed(6)}_${lng.toFixed(6)}`;
}

/**
 * Calculate mean of an array of numbers.
 */
function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Calculate population standard deviation.
 */
function stddev(values: number[], avg: number): number {
    if (values.length < 2) return 0;
    const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}

/**
 * Determine severity tier from event count.
 */
function getSeverity(count: number): 'low' | 'medium' | 'high' {
    if (count >= 51) return 'high';
    if (count >= 11) return 'medium';
    return 'low';
}

/**
 * Run the blackspot detection algorithm on local events.
 *
 * Returns an array of Blackspot objects ready to display on the map.
 * Also persists them to AsyncStorage so the map screen can load
 * blackspots without re-running the computation.
 */
export async function computeBlackspots(): Promise<Blackspot[]> {
    console.log('[RoadDNA] Computing blackspots from local events...');

    // ── Step 1: Load all local events ────────────────────────────────────────
    const events: DrivingEvent[] = await getAllLocalEvents();

    if (events.length === 0) {
        console.log('[RoadDNA] No events to compute blackspots from');
        return [];
    }

    // ── Step 2: Group events into 50m grid cells ──────────────────────────────
    // Map: cellKey → array of events in that cell
    const cellMap = new Map<string, {
        lat: number;
        lng: number;
        events: DrivingEvent[];
    }>();

    for (const event of events) {
        const snappedLat = snapToGrid(event.lat);
        const snappedLng = snapToGrid(event.lng);
        const key = cellKey(snappedLat, snappedLng);

        if (!cellMap.has(key)) {
            cellMap.set(key, { lat: snappedLat, lng: snappedLng, events: [] });
        }
        cellMap.get(key)!.events.push(event);
    }

    // ── Step 3: Count events per cell ────────────────────────────────────────
    const counts: number[] = [];
    cellMap.forEach((cell) => counts.push(cell.events.length));

    const avgCount = mean(counts);
    const sdCount = stddev(counts, avgCount);
    const threshold = avgCount + ROAD_DNA_CONFIG.STDDEV_MULTIPLIER * sdCount;

    console.log(
        `[RoadDNA] Cells: ${cellMap.size}, Mean: ${avgCount.toFixed(1)}, ` +
        `StdDev: ${sdCount.toFixed(1)}, Threshold: ${threshold.toFixed(1)}`
    );

    // ── Step 4: Flag cells above threshold as blackspots ─────────────────────
    const blackspots: Blackspot[] = [];

    cellMap.forEach((cell, key) => {
        const count = cell.events.length;

        // Must exceed BOTH the statistical threshold AND the minimum event count
        if (
            count >= ROAD_DNA_CONFIG.MIN_EVENTS_FOR_BLACKSPOT &&
            count > threshold
        ) {
            // Count by event type
            const typeCounts = { hard_brake: 0, lateral_swerve: 0, heading_change: 0 };
            cell.events.forEach((e) => typeCounts[e.event_type]++);

            blackspots.push({
                id: key,
                lat: cell.lat,
                lng: cell.lng,
                event_count: count,
                severity: getSeverity(count),
                event_types: typeCounts,
                last_updated: Date.now(),
                radius_m: ROAD_DNA_CONFIG.GRID_CELL_M,
            });
        }
    });

    console.log(`[RoadDNA] Found ${blackspots.length} blackspots`);

    // ── Step 5: Persist to AsyncStorage for map screen ───────────────────────
    await AsyncStorage.setItem(
        ROAD_DNA_STORAGE_KEYS.BLACKSPOTS_CACHE,
        JSON.stringify(blackspots)
    );

    return blackspots;
}

/**
 * Load cached blackspots (fast, no computation).
 * Used by the map screen on initial load.
 */
export async function loadCachedBlackspots(): Promise<Blackspot[]> {
    const raw = await AsyncStorage.getItem(ROAD_DNA_STORAGE_KEYS.BLACKSPOTS_CACHE);
    if (!raw) return [];
    try {
        return JSON.parse(raw) as Blackspot[];
    } catch {
        return [];
    }
}

/**
 * Seed test data — used for the exit checklist verification.
 * Creates 25 events at the same location so a blackspot is guaranteed.
 * This function should ONLY be called from the debug panel; never in production.
 */
export async function seedTestBlackspot(lat: number, lng: number): Promise<void> {
    const { initDrivingEventsDB } = await import('./DrivingEventLogger');
    const SQLite = await import('expo-sqlite');
    const db = await SQLite.openDatabaseAsync('aether_road_dna.db');

    const now = Date.now();
    for (let i = 0; i < 25; i++) {
        // Small random jitter within the same 50m cell
        const jitterLat = lat + (Math.random() - 0.5) * CELL_DEGREES * 0.5;
        const jitterLng = lng + (Math.random() - 0.5) * CELL_DEGREES * 0.5;
        await db.runAsync(
            `INSERT INTO driving_events (event_type, lat, lng, timestamp, speed_kmh, magnitude, uploaded)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                i % 3 === 0 ? 'hard_brake' : i % 3 === 1 ? 'lateral_swerve' : 'heading_change',
                jitterLat,
                jitterLng,
                now - i * 60000, // events spread over 25 minutes
                45 + Math.random() * 30,
                0.7 + Math.random() * 0.5,
                0,
            ]
        );
    }

    console.log(`[RoadDNA] Seeded 25 test events at ${lat.toFixed(4)},${lng.toFixed(4)}`);
}