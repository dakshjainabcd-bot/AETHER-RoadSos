/**
 * Phase 3 — Crash Detection Types & Constants
 *
 * This file defines all the "shared vocabulary" for Phase 3.
 * Every other file in CrashDetection/ imports from here.
 *
 * THINK OF IT LIKE RULES FOR A GAME:
 * - ACCEL_G_FORCE = 2.0 means "if the phone experiences more than 2x gravity force, pay attention"
 * - CONFIDENCE_TRIGGER = 0.75 means "if we are 75% sure it's a crash, start the countdown"
 * - CANCEL_WINDOW_SECONDS = 5 means "user has 5 seconds to say 'it's fine, not a crash'"
 */

// ──────────────────────────────────────────────────────────────────────────────
// INTERFACES — What the data looks like
// ──────────────────────────────────────────────────────────────────────────────

/**
 * What a confirmed crash event looks like.
 *
 * This is the final "package" that gets sent over the mesh network when
 * a crash is confirmed. It contains everything emergency contacts need:
 * where it happened, how severe it was, and how confident the system is.
 */
export interface CrashEvent {
  /** Unique ID for this incident (UUID v4) — used to deduplicate across mesh relays */
  incidentId: string;

  /**
   * Severity on a 1–5 scale, calculated from g-force magnitude:
   *   1 = minor fender-bender (~2–3g)
   *   2 = moderate collision (~3–4g)
   *   3 = significant impact (~4–5g)
   *   4 = severe crash (~5–7g)
   *   5 = catastrophic (>7g)
   *
   * For reference: a typical car crash ranges from 5–30g at the vehicle frame,
   * but the phone inside the car sees dampened values (roughly 2–10g).
   */
  severity: 1 | 2 | 3 | 4 | 5;

  /** Latitude at the moment of impact detection */
  lat: number;

  /** Longitude at the moment of impact detection */
  lng: number;

  /** Unix timestamp (ms) when the crash was first detected as a candidate */
  timestamp: number;

  /**
   * Final fusion confidence score (0 to 1).
   * This is the weighted combination of accelerometer, gyroscope, and acoustic scores.
   * A value of 0.75+ means "we're quite sure this was a crash."
   */
  confidence: number;

  /**
   * How the crash detection was triggered:
   *   'auto'          — the sensor fusion engine detected it automatically
   *   'manual_button' — user pressed the SOS button on screen
   *   'shake'         — user shook the phone deliberately (accessibility feature)
   */
  triggerType: 'auto' | 'manual_button' | 'shake';

  /**
   * Peak g-force value recorded during the event.
   * Used for severity calculation. Normal driving is ~1g (just gravity).
   * A value of 2.0+ triggered the candidate detection.
   */
  gForce: number;
}

/**
 * The crash detection engine is a state machine that moves through
 * these states in a predictable order:
 *
 *   idle → candidate → countdown → dispatching → active_sos
 *                         ↓
 *                     cancelled
 *
 * WHY a state machine?
 * Because crash detection must be deterministic and testable.
 * At any moment, the engine is in exactly ONE state, and there are
 * clear rules for transitioning between states. This prevents bugs
 * like "sending two SOS messages" or "showing countdown after cancel."
 */
export type CrashDetectionState =
  | 'idle'           // Normal monitoring — sensors are reading but nothing unusual
  | 'candidate'      // Sensors detected something suspicious, accumulating evidence
  | 'countdown'      // Confirmed crash! Showing 5-second cancel window to the user
  | 'dispatching'    // User didn't cancel in time, now sending SOS over mesh network
  | 'cancelled'      // User tapped cancel — false positive, logged for ML improvement
  | 'active_sos';    // SOS is now live: location sharing, emergency contacts notified

/**
 * Raw sensor reading from the accelerometer or gyroscope.
 *
 * Both sensors report 3-axis data (x, y, z) at 100Hz (every 10ms).
 * The timestamp lets us align readings from different sensors and
 * organize them into 200ms sliding windows for RMS calculation.
 *
 * WHY x, y, z?
 * - x = left/right acceleration
 * - y = forward/backward acceleration
 * - z = up/down acceleration (includes gravity at ~9.81 m/s²)
 *
 * To get total force, we calculate: sqrt(x² + y² + z²)
 * Then divide by 9.81 to convert to g-force units.
 */
export interface SensorReading {
  x: number;
  y: number;
  z: number;
  /** Unix timestamp in milliseconds — used to organize readings into windows */
  timestamp: number;
}

/**
 * The combined confidence score from all three sensor sources.
 *
 * This is the output of the "sensor fusion" algorithm. Instead of relying
 * on a single sensor (which could give false positives), we combine three
 * independent signals to get a much more reliable crash detection.
 *
 * ANALOGY: It's like a jury verdict — one witness might be wrong, but if
 * three independent witnesses all agree, you can be much more confident.
 */
export interface FusionScore {
  /** Accelerometer contribution (0 to 1) — did the phone experience sudden force? */
  accelScore: number;

  /** Gyroscope contribution (0 to 1) — is the phone/vehicle rotating abnormally? */
  gyroScore: number;

  /** Acoustic/microphone contribution (0 to 1) — was there a loud crash sound? */
  acousticScore: number;

  /**
   * Final weighted confidence score (0 to 1).
   * Calculated as: (accelScore × 0.4) + (gyroScore × 0.3) + (acousticScore × 0.3)
   * If this exceeds CONFIDENCE_TRIGGER (0.75) for CONSECUTIVE_WINDOWS (10) windows
   * in a row (~2 seconds), the crash is confirmed.
   */
  confidence: number;

  /**
   * Raw g-force value from the accelerometer.
   * Kept separately from accelScore because we need the actual number
   * for severity calculation (not just the 0-1 normalized score).
   */
  gForce: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// EVENT SYSTEM — How the engine communicates with the UI and other services
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Events that the CrashDetectionEngine fires.
 *
 * The engine uses an event-driven architecture (pub/sub pattern) so that
 * the UI, logging service, and mesh network service can all react to
 * crash detection events independently without tight coupling.
 */
export type CrashEngineEventType =
  | 'CANDIDATE_DETECTED'  // Sensors see something suspicious — UI might show a subtle indicator
  | 'CRASH_CONFIRMED'     // Confidence exceeded threshold for 2 seconds — start countdown UI
  | 'CRASH_CANCELLED'     // User tapped cancel within 5 seconds — dismiss countdown UI
  | 'SOS_DISPATCHED'      // SOS sent via mesh relay — show "help is on the way" screen
  | 'SCORE_UPDATED'       // New sensor window processed — update debug/confidence display
  | 'STATE_CHANGED';      // State machine moved to new state — update UI accordingly

/**
 * The event object passed to event listeners.
 *
 * Not all fields are present in every event:
 * - SCORE_UPDATED always includes `score`
 * - STATE_CHANGED always includes `state`
 * - CRASH_CONFIRMED and SOS_DISPATCHED include `crashEvent`
 * - CANDIDATE_DETECTED includes `score` and `state`
 */
export interface CrashEngineEvent {
  /** Which event fired */
  type: CrashEngineEventType;

  /** Current fusion score — present on SCORE_UPDATED, CANDIDATE_DETECTED */
  score?: FusionScore;

  /** Current engine state — present on STATE_CHANGED */
  state?: CrashDetectionState;

  /** The crash event details — present on CRASH_CONFIRMED, SOS_DISPATCHED */
  crashEvent?: CrashEvent;
}

// ──────────────────────────────────────────────────────────────────────────────
// DETECTION THRESHOLDS
// These values come directly from the AETHER master design document.
// Each value is carefully chosen based on physics and real-world crash data.
// ──────────────────────────────────────────────────────────────────────────────

export const CRASH_THRESHOLDS = {
  /**
   * Accelerometer threshold in g-force units.
   *
   * WHY 2.0g?
   * - 1g = 9.81 m/s² = the force of Earth's gravity. You feel 1g just standing still.
   * - Normal driving (accelerating, braking, speed bumps): 0.3–0.8g
   * - Hard braking (emergency stop): 0.8–1.2g
   * - Minor fender-bender: 2–5g at the phone
   * - Significant collision: 5–15g at the phone
   *
   * Setting the threshold at 2.0g means:
   * ✅ Will detect: actual collisions, significant impacts
   * ❌ Won't trigger: normal driving, potholes, speed bumps, hard braking
   *
   * This is the first line of defense — a cheap check before doing expensive fusion.
   */
  ACCEL_G_FORCE: 2.0,

  /**
   * Gyroscope threshold in radians per second.
   *
   * WHY 3.0 rad/s?
   * - 3 rad/s ≈ 172 degrees/second of rotation
   * - Normal driving turns: 0.1–0.5 rad/s
   * - Sharp swerve: 0.5–1.5 rad/s
   * - Vehicle spinning out: 2–4 rad/s
   * - Vehicle rolling over: 3–10 rad/s
   *
   * 3.0 rad/s specifically targets rollover events, which are among
   * the most dangerous types of crashes. A car rolling sideways at
   * 172°/sec is NOT normal driving under any circumstances.
   */
  GYRO_ROLLOVER_RAD_S: 3.0,

  /**
   * Minimum fusion confidence score to trigger the countdown.
   *
   * WHY 0.75?
   * - The fusion score ranges from 0 (definitely not a crash) to 1 (definitely a crash)
   * - 0.5 would mean "coin flip" — way too many false positives
   * - 0.9 would mean "almost certain" — might miss real crashes
   * - 0.75 means "three out of four signals agree this is a crash"
   *
   * Combined with the CONSECUTIVE_WINDOWS requirement (must stay above 0.75
   * for 2 full seconds), this gives us very high accuracy while still
   * catching real crashes quickly.
   */
  CONFIDENCE_TRIGGER: 0.75,

  /**
   * Acoustic threshold in dBFS (decibels relative to full scale).
   *
   * WHY -25 dBFS?
   * - dBFS is a digital audio scale: 0 dBFS = loudest possible, -160 dBFS = silence
   * - Normal cabin noise while driving: -60 to -40 dBFS
   * - Loud music in car: -30 to -20 dBFS
   * - Crash/impact sound (metal, glass, airbag): -20 to 0 dBFS
   *
   * -25 dBFS catches the sudden loud transient of a crash (metal impact,
   * glass breaking, airbag deployment) while ignoring normal cabin noise.
   * If the sound exceeds this threshold, the acoustic score jumps to 0.7.
   */
  ACOUSTIC_THRESHOLD_DBFS: -25,

  /**
   * Number of consecutive 200ms windows that must exceed CONFIDENCE_TRIGGER.
   *
   * WHY 10?
   * - Each window is 200ms (WINDOW_SIZE_MS below)
   * - 10 windows × 200ms = 2,000ms = 2 seconds
   * - A real crash produces sustained abnormal readings for 1–5 seconds
   * - A phone being dropped produces a spike lasting < 500ms (2–3 windows)
   * - A pothole produces a spike lasting < 300ms (1–2 windows)
   *
   * Requiring 10 consecutive windows eliminates single-spike false positives
   * (drops, bumps) while still detecting crashes within 2 seconds.
   */
  CONSECUTIVE_WINDOWS: 10,

  /**
   * Seconds the user has to cancel before SOS is dispatched.
   *
   * WHY 5 seconds?
   * - Too short (2–3s): User can't react fast enough, especially if dazed
   * - Too long (10–15s): Delays emergency response for real crashes
   * - 5 seconds is the sweet spot: enough time to tap "I'm OK" if it's a
   *   false positive, but still gets help dispatched quickly for real crashes
   *
   * During these 5 seconds, the app shows a full-screen countdown with
   * a large "I'm OK" cancel button and plays an alarm sound.
   */
  CANCEL_WINDOW_SECONDS: 5,

  /**
   * How often sensors report new data, in milliseconds.
   *
   * WHY 10ms (100Hz)?
   * - 100Hz is fast enough to capture the sharp transients of a crash
   * - A crash impact lasts 50–150ms — at 100Hz we get 5–15 data points
   * - Lower rates (e.g., 30Hz) would miss the peak g-force
   * - Higher rates (e.g., 500Hz) would drain battery unnecessarily
   *
   * Most modern phone accelerometers support up to 200Hz.
   * 100Hz is a good balance between accuracy and battery life.
   */
  SENSOR_INTERVAL_MS: 10,

  /**
   * Size of the sliding analysis window, in milliseconds.
   *
   * WHY 200ms?
   * - We collect sensor data at 100Hz, giving us 20 readings per window
   * - 20 readings is enough to calculate a statistically meaningful RMS
   * - The window slides every 200ms, so we get 5 confidence updates/second
   * - This is fast enough for real-time UI updates but not so fast that
   *   it overwhelms the event system
   *
   * RMS (Root Mean Square) over 200ms smooths out individual spikes
   * and gives us the "sustained force" which is what matters for crash detection.
   */
  WINDOW_SIZE_MS: 200,
} as const;

/**
 * Sensor fusion weights — how much each sensor contributes to the final score.
 *
 * The formula is:
 *   confidence = (accelScore × 0.4) + (gyroScore × 0.3) + (acousticScore × 0.3)
 *
 * WHY these weights?
 * - Accelerometer (0.4): The primary crash indicator. Impact force is the most
 *   reliable and direct measurement of a collision. Gets the highest weight.
 * - Gyroscope (0.3): Detects rollovers and spins that the accelerometer alone
 *   might not flag (e.g., a slow rollover has low g-force but high rotation).
 * - Acoustic (0.3): Catches crash sounds (glass, metal, airbag) that add
 *   confidence. Equal to gyro because sound is a strong independent signal.
 *
 * The weights sum to exactly 1.0, so the maximum possible confidence is 1.0.
 */
export const FUSION_WEIGHTS = {
  ACCEL: 0.4,
  GYRO: 0.3,
  ACOUSTIC: 0.3,
} as const;

/**
 * Adjusted fusion weights when the microphone is NOT available.
 *
 * This happens when:
 * - User denied microphone permission
 * - Microphone hardware is unavailable or in use by another app
 *
 * WHY these specific values?
 * - Without acoustic data, we redistribute its weight proportionally:
 *   Original ratio of ACCEL:GYRO = 0.4:0.3 = 4:3
 *   New ACCEL = 0.4 / 0.7 ≈ 0.57
 *   New GYRO  = 0.3 / 0.7 ≈ 0.43
 *   These still sum to 1.0
 *
 * - THRESHOLD_OVERRIDE = 0.65 (lower than the normal 0.75) because:
 *   Without acoustic confirmation, we're less confident overall, but we
 *   still need to detect crashes. Lowering the threshold compensates for
 *   the missing sensor while accepting slightly more false positives
 *   (which the 5-second cancel window handles).
 */
export const FUSION_WEIGHTS_NO_ACOUSTIC = {
  ACCEL: 0.57,
  GYRO: 0.43,
  ACOUSTIC: 0.0,
  THRESHOLD_OVERRIDE: 0.65,
} as const;
