/**
 * Phase 9 — DrivingEventLogger
 *
 * WHAT THIS DOES:
 * Monitors the accelerometer and GPS while the user is driving.
 * When it detects a hard brake, lateral swerve, or sudden heading change,
 * it logs the event anonymously to a local SQLite database.
 *
 * PRIVACY GUARANTEES:
 * - No user ID stored anywhere
 * - No raw audio
 * - Only: event_type, lat, lng, timestamp, speed, magnitude
 * - User can opt out in Settings at any time
 *
 * ARCHITECTURE:
 * This class uses the Accelerometer from expo-sensors.
 * It does NOT create a duplicate subscription — it has its own listener
 * because Phase 3 (crash detection) uses a different setUpdateInterval
 * cadence during its specific windows. Both can coexist.
 *
 * HOW EVENT DETECTION WORKS:
 * 1. Accelerometer fires at 100Hz (every 10ms)
 * 2. We maintain a sliding buffer of recent readings
 * 3. Every 200ms we compute the RMS of that buffer
 * 4. If RMS exceeds threshold for required duration → log event
 * 5. 3-second cooldown before same event type can be logged again
 */

import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    DrivingEvent,
    DrivingEventType,
    ROAD_DNA_CONFIG,
    ROAD_DNA_STORAGE_KEYS,
} from './types';

// ─── DATABASE SETUP ───────────────────────────────────────────────────────────

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Open (or create) the driving events SQLite database.
 * Separate from the Phase 1 POI database — cleaner separation of concerns.
 */
export async function initDrivingEventsDB(): Promise<void> {
    db = await SQLite.openDatabaseAsync('aether_road_dna.db');

    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS driving_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT    NOT NULL,
      lat        REAL    NOT NULL,
      lng        REAL    NOT NULL,
      timestamp  INTEGER NOT NULL,
      speed_kmh  REAL    NOT NULL,
      magnitude  REAL    NOT NULL,
      uploaded   INTEGER DEFAULT 0
    );

    -- Index for fast queries by upload status
    CREATE INDEX IF NOT EXISTS idx_de_uploaded  ON driving_events(uploaded);
    -- Index for fast spatial queries
    CREATE INDEX IF NOT EXISTS idx_de_location  ON driving_events(lat, lng);
    -- Index for time-based queries
    CREATE INDEX IF NOT EXISTS idx_de_timestamp ON driving_events(timestamp);
  `);

    console.log('[RoadDNA] Driving events DB initialized');
}

/**
 * Get all events pending upload (uploaded = 0).
 */
export async function getPendingEvents(): Promise<DrivingEvent[]> {
    if (!db) return [];
    return db.getAllAsync<DrivingEvent>(
        'SELECT * FROM driving_events WHERE uploaded = 0 ORDER BY timestamp ASC LIMIT 200'
    );
}

/**
 * Mark events as uploaded.
 */
export async function markEventsUploaded(ids: number[]): Promise<void> {
    if (!db || ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(
        `UPDATE driving_events SET uploaded = 1 WHERE id IN (${placeholders})`,
        ids
    );
}

/**
 * Get total event count (for debug panel).
 */
export async function getDrivingEventCount(): Promise<number> {
    if (!db) return 0;
    const row = await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) as n FROM driving_events'
    );
    return row?.n ?? 0;
}

/**
 * Get all events (for local blackspot computation).
 */
export async function getAllLocalEvents(): Promise<DrivingEvent[]> {
    if (!db) return [];
    return db.getAllAsync<DrivingEvent>(
        'SELECT * FROM driving_events ORDER BY timestamp DESC'
    );
}

/**
 * Delete events older than 30 days (housekeeping).
 */
export async function pruneOldEvents(): Promise<void> {
    if (!db) return;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    await db.runAsync('DELETE FROM driving_events WHERE timestamp < ?', [cutoff]);
}

// ─── LOGGER CLASS ─────────────────────────────────────────────────────────────

export class DrivingEventLogger {
    private isLogging = false;

    // Accelerometer subscription handle
    private accelSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;

    // Latest GPS — updated every 5 seconds by location watcher
    private latestGPS: { lat: number; lng: number; speed_kmh: number; heading: number } | null = null;
    private locationSubscription: Location.LocationSubscription | null = null;

    // Event cooldown tracking — prevents duplicate events in 3 seconds
    private lastEventTime: Record<DrivingEventType, number> = {
        hard_brake: 0,
        lateral_swerve: 0,
        heading_change: 0,
    };

    // Sliding window buffers for RMS calculation
    private accelBuffer: number[] = [];    // Combined g-force values
    private lateralBuffer: number[] = [];  // X-axis (lateral) values

    // For heading change: track last GPS heading
    private lastHeading: number | null = null;
    private lastHeadingTime: number = 0;

    // Duration tracking for brake/swerve (must exceed threshold for N ms)
    private hardBrakeStartTime: number | null = null;
    private lateralSwerveStartTime: number | null = null;

    // Window processing timer (every 200ms)
    private windowTimer: ReturnType<typeof setInterval> | null = null;

    /**
     * Start monitoring driving events.
     * Call when user opens app while moving (speed > 20 km/h detected).
     */
    async start(): Promise<void> {
        if (this.isLogging) return;

        // Check opt-out
        const optedOut = await AsyncStorage.getItem(ROAD_DNA_STORAGE_KEYS.OPT_OUT);
        if (optedOut === 'true') {
            console.log('[RoadDNA] User opted out — not logging driving events');
            return;
        }

        if (!db) {
            console.warn('[RoadDNA] DB not initialized — call initDrivingEventsDB() first');
            return;
        }

        this.isLogging = true;
        console.log('[RoadDNA] 🚗 Starting driving event logger');

        // ── 1. Subscribe to GPS for speed and heading ────────────────────────
        this.locationSubscription = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 2000,
                distanceInterval: 10,
            },
            (loc) => {
                const speedMs = loc.coords.speed ?? 0;
                const speedKmh = Math.max(0, speedMs * 3.6);

                this.latestGPS = {
                    lat: loc.coords.latitude,
                    lng: loc.coords.longitude,
                    speed_kmh: speedKmh,
                    heading: loc.coords.heading ?? 0,
                };

                // ── Heading change detection ────────────────────────────────────
                // GPS heading: 0°=North, 90°=East, 180°=South, 270°=West
                // We calculate how fast the heading is changing (degrees per second)
                if (speedKmh >= ROAD_DNA_CONFIG.MIN_SPEED_KMH) {
                    const heading = loc.coords.heading ?? 0;
                    const now = Date.now();

                    if (this.lastHeading !== null && this.lastHeadingTime > 0) {
                        const dt = (now - this.lastHeadingTime) / 1000; // seconds
                        if (dt > 0) {
                            // Handle the 0°/360° wrap-around
                            let delta = Math.abs(heading - this.lastHeading);
                            if (delta > 180) delta = 360 - delta;
                            const degPerSec = delta / dt;

                            if (
                                degPerSec > ROAD_DNA_CONFIG.HEADING_CHANGE_DEG_PER_S &&
                                this.canLogEvent('heading_change')
                            ) {
                                this.logEvent('heading_change', degPerSec);
                            }
                        }
                    }

                    this.lastHeading = heading;
                    this.lastHeadingTime = now;
                }
            }
        );

        // ── 2. Subscribe to Accelerometer ───────────────────────────────────
        Accelerometer.setUpdateInterval(ROAD_DNA_CONFIG.ACCEL_INTERVAL_MS);
        this.accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
            if (!this.latestGPS || this.latestGPS.speed_kmh < ROAD_DNA_CONFIG.MIN_SPEED_KMH) {
                // Not driving fast enough — clear buffers and return
                this.accelBuffer = [];
                this.lateralBuffer = [];
                this.hardBrakeStartTime = null;
                this.lateralSwerveStartTime = null;
                return;
            }

            // Combined g-force (gravity-removed on Z, same logic as Phase 3)
            const gForce = Math.sqrt(x * x + y * y + (z - 1) * (z - 1));
            this.accelBuffer.push(gForce);

            // Lateral (X-axis) — left/right forces
            this.lateralBuffer.push(Math.abs(x));

            // Cap buffer size (10 readings = 100ms at 100Hz)
            if (this.accelBuffer.length > 30) this.accelBuffer.shift();
            if (this.lateralBuffer.length > 30) this.lateralBuffer.shift();
        });

        // ── 3. Process window every 200ms ───────────────────────────────────
        this.windowTimer = setInterval(() => {
            this.processWindow();
        }, 200);
    }

    /**
     * Process 200ms window of accumulated sensor data.
     * Decides if a hard brake or lateral swerve should be logged.
     */
    private processWindow(): void {
        if (!this.latestGPS || this.latestGPS.speed_kmh < ROAD_DNA_CONFIG.MIN_SPEED_KMH) return;

        const now = Date.now();

        // ── Hard brake detection ─────────────────────────────────────────────
        const accelRMS = this.rms(this.accelBuffer);
        if (accelRMS > ROAD_DNA_CONFIG.HARD_BRAKE_G) {
            if (this.hardBrakeStartTime === null) {
                this.hardBrakeStartTime = now;
            } else if (
                now - this.hardBrakeStartTime >= ROAD_DNA_CONFIG.HARD_BRAKE_DURATION_MS &&
                this.canLogEvent('hard_brake')
            ) {
                this.logEvent('hard_brake', accelRMS);
                this.hardBrakeStartTime = null;
            }
        } else {
            this.hardBrakeStartTime = null;
        }

        // ── Lateral swerve detection ─────────────────────────────────────────
        const lateralRMS = this.rms(this.lateralBuffer);
        if (lateralRMS > ROAD_DNA_CONFIG.LATERAL_SWERVE_G) {
            if (this.lateralSwerveStartTime === null) {
                this.lateralSwerveStartTime = now;
            } else if (
                now - this.lateralSwerveStartTime >= ROAD_DNA_CONFIG.LATERAL_SWERVE_DURATION_MS &&
                this.canLogEvent('lateral_swerve')
            ) {
                this.logEvent('lateral_swerve', lateralRMS);
                this.lateralSwerveStartTime = null;
            }
        } else {
            this.lateralSwerveStartTime = null;
        }
    }

    /**
     * Check cooldown: same event type can only be logged once per 3 seconds.
     */
    private canLogEvent(type: DrivingEventType): boolean {
        const now = Date.now();
        return now - this.lastEventTime[type] >= ROAD_DNA_CONFIG.EVENT_COOLDOWN_MS;
    }

    /**
     * Write a driving event to SQLite.
     * Called only when speed, threshold, and cooldown checks all pass.
     */
    private logEvent(type: DrivingEventType, magnitude: number): void {
        if (!this.latestGPS || !db) return;

        const event: Omit<DrivingEvent, 'id'> = {
            event_type: type,
            lat: this.latestGPS.lat,
            lng: this.latestGPS.lng,
            timestamp: Date.now(),
            speed_kmh: this.latestGPS.speed_kmh,
            magnitude: Math.round(magnitude * 1000) / 1000, // 3 decimal places
            uploaded: 0,
        };

        db.runAsync(
            `INSERT INTO driving_events
       (event_type, lat, lng, timestamp, speed_kmh, magnitude, uploaded)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                event.event_type,
                event.lat,
                event.lng,
                event.timestamp,
                event.speed_kmh,
                event.magnitude,
                0,
            ]
        ).then(() => {
            console.log(
                `[RoadDNA] Logged ${type} at ${event.lat.toFixed(4)},${event.lng.toFixed(4)} ` +
                `speed=${event.speed_kmh.toFixed(0)}km/h mag=${event.magnitude.toFixed(2)}`
            );
        }).catch((err) => {
            console.error('[RoadDNA] Failed to log event:', err);
        });

        this.lastEventTime[type] = Date.now();
    }

    /** Root Mean Square of an array */
    private rms(values: number[]): number {
        if (values.length === 0) return 0;
        const sum = values.reduce((s, v) => s + v * v, 0);
        return Math.sqrt(sum / values.length);
    }

    /**
     * Stop all monitoring.
     * Call when app goes to background or user disables feature.
     */
    stop(): void {
        this.isLogging = false;
        this.accelSubscription?.remove();
        this.accelSubscription = null;
        this.locationSubscription?.remove();
        this.locationSubscription = null;
        if (this.windowTimer) {
            clearInterval(this.windowTimer);
            this.windowTimer = null;
        }
        this.accelBuffer = [];
        this.lateralBuffer = [];
        this.hardBrakeStartTime = null;
        this.lateralSwerveStartTime = null;
        console.log('[RoadDNA] Driving event logger stopped');
    }

    get active(): boolean {
        return this.isLogging;
    }
}

// Singleton instance — one logger for the whole app
export const drivingEventLogger = new DrivingEventLogger();