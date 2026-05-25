/**
 * Phase 12 — Driver Intelligence Suite: Type Definitions
 *
 * WHY THIS FILE:
 * Every Phase 12 service needs to agree on what a HazardPacket,
 * TripScore, or Badge looks like. We define them once here and
 * import everywhere — no drift, no duplicates.
 */

// ── Hazard Broadcasting ───────────────────────────────────────────────────────

/**
 * The four types of road hazards a driver can report.
 * These map to icons in the UI and alert text.
 */
export type HazardType = 'pothole' | 'accident' | 'road_closed' | 'debris';

/**
 * A HAZARD packet that travels phone-to-phone via the BLE mesh.
 * Similar to SOSPacket but for road conditions, not crashes.
 */
export interface HazardPacket {
  hazardId: string;       // Unique 8-char hex ID like "a1b2c3d4"
  hazardType: HazardType;
  lat: number;
  lng: number;
  severity: 1 | 2 | 3;  // 1 = minor (pothole), 3 = major (road blocked)
  reportedAt: number;     // Unix ms — used for 30-min TTL check
  hopCount: number;       // Max 15 hops for hazard packets
  deviceHash: string;     // Anonymous device ID of reporter
}

/**
 * State passed to the HazardAlert component so it knows
 * what to display and how far away the hazard is.
 */
export interface HazardAlertState {
  packet: HazardPacket;
  distanceM: number;
  reportCount: number;
  credibilityLevel: 'low' | 'medium' | 'high';
}

// ── Trip Scoring ──────────────────────────────────────────────────────────────

/**
 * A completed trip's safety summary.
 * Generated once per trip when vehicle stops for 3+ minutes.
 */
export interface TripScore {
  id: string;
  startTime: number;
  endTime: number;
  score: number;          // 0–100
  events: {
    hardBrakes: number;
    swerves: number;
    headingChanges: number;
  };
  isNightDriving: boolean;
  tip: string;            // Personalised coaching tip
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type BadgeType = 'safe_7_days' | 'safe_30_days' | 'safe_90_days';

export interface Badge {
  type: BadgeType;
  earnedAt: number;
  label: string;
  description: string;
  icon: string;
}

// ── Weekly Summary ────────────────────────────────────────────────────────────

export interface WeeklySummary {
  weekScore: number;      // 0–100 average for this week
  lastWeekScore: number;  // 0–100 average for last week
  trend: 'up' | 'down' | 'stable';
  trendPoints: number;    // How many points improved/declined
  tripCount: number;
  latestTip: string;
  streakDays: number;     // Consecutive safe driving days
}

// ── Storage Keys ──────────────────────────────────────────────────────────────

export const DRIVER_INTEL_STORAGE_KEYS = {
  TRIP_SCORES: 'aether_trip_scores_v1',
  BADGES: 'aether_driver_badges_v1',
} as const;

// ── Configuration Constants ───────────────────────────────────────────────────

/**
 * All Phase 12 tunable numbers in one place.
 *
 * MOVEMENT DETECTION:
 * 0.00015 degrees ≈ 16 metres. If GPS position changes by more than
 * this between polls, we consider the vehicle to be moving.
 * This avoids false trip-starts from GPS drift while parked.
 *
 * TRIP END DURATION:
 * Vehicle must be stationary for 3 minutes before we score the trip.
 * This handles red lights (short stops) without ending the trip early.
 */
export const DRIVER_INTEL_CONFIG = {
  // Trip detection
  TRIP_END_MOVEMENT_THRESHOLD: 0.00015,   // ~16m in degrees (stationary threshold)
  TRIP_START_MOVEMENT_THRESHOLD: 0.0005,  // ~55m — must move this much to START a trip
  TRIP_END_DURATION_MS: 3 * 60 * 1000,   // 3 minutes stationary = trip ended
  POLL_INTERVAL_MS: 30 * 1000,           // Check GPS every 30 seconds
  MIN_TRIP_DURATION_MS: 2 * 60 * 1000,   // Ignore trips shorter than 2 minutes

  // Scoring
  BASE_SCORE: 100,
  HARD_BRAKE_PENALTY: 5,
  SWERVE_PENALTY: 4,
  HEADING_CHANGE_PENALTY: 3,
  NIGHT_DRIVING_BONUS: 10,  // Bonus for safe night driving
  CLEAN_TRIP_BONUS: 15,     // Bonus for zero incidents

  // Night hours: 10 PM to 6 AM
  NIGHT_START_HOUR: 22,
  NIGHT_END_HOUR: 6,

  // Hazard broadcasting
  HAZARD_MAX_HOPS: 15,              // Fewer hops than SOS (15 vs 30)
  HAZARD_ALERT_RADIUS_M: 3000,      // Alert driver if hazard within 3km
  HAZARD_TTL_MS: 30 * 60 * 1000,   // Hazard packets expire after 30 minutes
} as const;

// ── Hazard Report Store Types ─────────────────────────────────────────────────

/** One stored hazard report from any device */
export interface HazardReport {
  hazardId: string;
  hazardType: HazardType;
  lat: number;
  lng: number;
  severity: 1 | 2 | 3;
  reportedAt: number;
  deviceHash?: string;   // for rate limiting
}

/** Aggregated cluster of nearby reports — used for map display */
export interface HazardCluster {
  clusterKey: string;
  lat: number;
  lng: number;
  hazardType: HazardType;
  reportCount: number;
  latestSeverity: 1 | 2 | 3;
  lastReportedAt: number;
  credibilityLevel: 'low' | 'medium' | 'high';
}

export const HAZARD_STORE_KEY = 'aether_hazard_reports_v1';