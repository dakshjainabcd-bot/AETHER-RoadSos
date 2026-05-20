/**
 * Phase 9 — Road DNA Blackspot Map: Types & Constants
 *
 * WHY THIS FILE EXISTS:
 * TypeScript needs to know the "shape" of every piece of data before
 * it can check your code for bugs. This file declares all the data
 * structures used in Phase 9 so every other file can import and use them.
 *
 * KEY CONCEPTS:
 * - DrivingEvent: one detected dangerous event (hard brake, swerve, etc.)
 * - Blackspot: a geographic zone where many events cluster → danger zone
 * - ROAD_DNA_CONFIG: all tunable numbers in one place (easy to tweak)
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────

/** The three kinds of dangerous driving events AETHER can detect */
export type DrivingEventType = 'hard_brake' | 'lateral_swerve' | 'heading_change';

/**
 * A single anonymous driving event stored in SQLite.
 * Notice: NO user ID, NO phone number. Just physics + location.
 */
export interface DrivingEvent {
    id?: number;                // Auto-assigned by SQLite
    event_type: DrivingEventType;
    lat: number;
    lng: number;
    timestamp: number;         // Unix milliseconds
    speed_kmh: number;
    magnitude: number;         // g-force for brake/swerve, deg/s for heading
    uploaded: number;          // 0 = pending upload, 1 = uploaded (SQLite uses integers for booleans)
}

/**
 * A computed danger zone on the map.
 * Created by aggregating many DrivingEvents in the same geographic area.
 */
export interface Blackspot {
    id: string;
    lat: number;
    lng: number;
    event_count: number;
    severity: 'low' | 'medium' | 'high';
    event_types: {
        hard_brake: number;
        lateral_swerve: number;
        heading_change: number;
    };
    last_updated: number;       // Unix ms — when was this blackspot last recalculated
    radius_m: number;           // Display radius on map (metres)
}

/** State passed through AppContext for the proximity alert */
export interface BlackspotAlertState {
    blackspot: Blackspot;
    distanceM: number;
}

// ─── CONFIGURATION ────────────────────────────────────────────────────────────

/**
 * All Phase 9 thresholds and settings.
 *
 * WHY HERE (not in constants.ts)?
 * These values are only used by Phase 9 files, so keeping them here
 * avoids polluting the global constants file. Any Phase 9 developer
 * can tweak thresholds here without touching unrelated code.
 */
export const ROAD_DNA_CONFIG = {
    /**
     * Minimum speed before we start logging events.
     * WHY 20 km/h? Below this speed you're in slow traffic, parking, etc.
     * Hard brakes in parking lots aren't road hazards; they're normal driving.
     */
    MIN_SPEED_KMH: 20,

    /**
     * Hard brake: phone must experience > 0.7g deceleration for > 300ms.
     *
     * WHY 0.7g?
     * - Normal braking at red light: 0.3-0.5g
     * - Emergency brake on wet road: 0.7-1.2g
     * - 0.7g catches emergency brakes without triggering every stop-sign stop
     *
     * WHY 300ms?
     * - A pothole jolt: 50-100ms spike (filtered out)
     * - Real hard brake: 300ms+ of sustained force (captured)
     */
    HARD_BRAKE_G: 0.7,
    HARD_BRAKE_DURATION_MS: 300,

    /**
     * Lateral swerve: > 0.5g sideways for > 200ms.
     * Catches emergency swerves to avoid obstacles.
     */
    LATERAL_SWERVE_G: 0.5,
    LATERAL_SWERVE_DURATION_MS: 200,

    /**
     * Sudden heading change: GPS heading changes > 45 degrees per second.
     * Catches sharp unexpected turns (avoiding pothole, animal on road, etc.)
     */
    HEADING_CHANGE_DEG_PER_S: 45,

    /**
     * Alert driver when within 300m of a blackspot.
     * At 60 km/h, 300m gives ~18 seconds of warning — enough to slow down.
     */
    ALERT_RADIUS_M: 300,

    /**
     * Grid cell size for aggregation.
     * 50m x 50m squares. Events in the same square are counted together.
     * WHY 50m? Small enough to pinpoint road segments, large enough to aggregate.
     */
    GRID_CELL_M: 50,

    /**
     * A cell becomes a blackspot when its event count exceeds:
     *   mean + (STDDEV_MULTIPLIER × standard_deviation)
     *
     * This is a statistical outlier detection method. Cells with "normal"
     * amounts of events are fine; only statistically extreme cells are flagged.
     * STDDEV_MULTIPLIER = 2 catches the worst ~5% of road segments.
     */
    STDDEV_MULTIPLIER: 2,

    /**
     * A cell must have at least this many events to ever be a blackspot.
     * Prevents false flags from 1-2 events at any location.
     */
    MIN_EVENTS_FOR_BLACKSPOT: 5,

    /**
     * How often to check if driver is near a blackspot (milliseconds).
     * 5000ms = check every 5 seconds. At 100 km/h, driver moves 138m in 5s —
     * fine enough resolution for 300m alert radius.
     */
    GEOFENCE_CHECK_INTERVAL_MS: 5000,

    /**
     * Accelerometer polling rate: 100Hz (every 10ms).
     * Same rate as Phase 3 crash detection. Having two listeners on the
     * accelerometer is fine — expo-sensors supports multiple listeners.
     */
    ACCEL_INTERVAL_MS: 10,

    /**
     * Minimum time between logging the SAME event type.
     * Prevents logging 50 "hard_brake" events for a single braking event
     * at 100Hz sampling.
     */
    EVENT_COOLDOWN_MS: 3000,

    /** Cloud endpoint — replace with your FastAPI URL in Phase 10 */
    UPLOAD_ENDPOINT: 'https://httpbin.org/post',
} as const;

// ─── STORAGE KEYS ─────────────────────────────────────────────────────────────

/** AsyncStorage keys used by Phase 9 */
export const ROAD_DNA_STORAGE_KEYS = {
    OPT_OUT: 'aether_road_dna_opt_out',
    BLACKSPOTS_CACHE: 'aether_blackspots_cache_v1',
    LAST_UPLOAD_TIME: 'aether_road_dna_last_upload',
} as const;