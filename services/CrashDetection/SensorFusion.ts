/**
 * SensorFusion — Accelerometer + Gyroscope Crash Detection
 *
 * HOW IT WORKS:
 *
 * 1. Subscribe to accelerometer at 100Hz (10ms intervals)
 *    Accelerometer values from expo-sensors are in g-force units (1 = normal gravity)
 *    {x: 0, y: 0, z: 1} = phone lying flat, experiencing normal gravity downward
 *
 * 2. Subscribe to gyroscope at 100Hz
 *    Gyroscope values are in rad/s (radians per second of rotation)
 *    {x: 0, y: 0, z: 0} = phone stationary, not rotating
 *
 * 3. Apply Kalman filter to each axis — removes road vibration noise
 *
 * 4. Every 200ms: calculate RMS of the window
 *    RMS = Root Mean Square — a mathematical "average intensity"
 *    It's better than peak because crashes sustain high values for 200ms+
 *    while potholes are just brief spikes
 *
 * 5. Calculate accelScore (0-1) and gyroScore (0-1)
 *    These are fed into CrashDetectionEngine for fusion
 *
 * WHY Z-AXIS STARTS AT 1:
 * When a phone is lying flat on a table (or in a car mount), the accelerometer
 * reads {x: 0, y: 0, z: 1} because gravity pulls DOWN at 1g on the Z-axis.
 * So the "resting" value of Z is 1, not 0. We initialize the Kalman filter
 * for Z at 1 so it doesn't take time to "learn" that gravity exists.
 *
 * WHY WE SUBTRACT 1 FROM fz:
 * When calculating g-force, we want the NET acceleration beyond normal gravity.
 * A phone at rest has z ≈ 1g, but that's not a crash — it's just gravity.
 * By computing sqrt(x² + y² + (z-1)²), we get the force FROM MOVEMENT ONLY.
 * A phone at rest: sqrt(0 + 0 + (1-1)²) = 0g ← correct, no movement
 * A crash: sqrt(0.5² + 0.3² + (3.2-1)²) = ~2.3g ← real impact force
 */

import { Accelerometer, Gyroscope } from 'expo-sensors';
import { KalmanFilter1D } from './KalmanFilter';
import { CRASH_THRESHOLDS } from './types';

/** Callback type for score updates every 200ms window */
type ScoreCallback = (accelScore: number, gyroScore: number, gForce: number) => void;

export class SensorFusion {
  /**
   * One Kalman filter per axis, per sensor = 6 filters total.
   *
   * WHY per-axis filtering?
   * Each axis has independent noise characteristics. The X-axis might vibrate
   * differently than Z-axis in a moving car. Filtering each independently
   * gives better noise reduction than filtering the combined magnitude.
   */
  private readonly filters = {
    accel: {
      x: new KalmanFilter1D(0.01, 0.1, 0),  // X: left/right, rests at 0
      y: new KalmanFilter1D(0.01, 0.1, 0),  // Y: forward/back, rests at 0
      z: new KalmanFilter1D(0.01, 0.1, 1),  // Z: up/down, rests at 1 (GRAVITY!)
    },
    gyro: {
      x: new KalmanFilter1D(0.01, 0.1, 0),  // Roll rotation
      y: new KalmanFilter1D(0.01, 0.1, 0),  // Pitch rotation
      z: new KalmanFilter1D(0.01, 0.1, 0),  // Yaw rotation
    },
  };

  /**
   * Sliding window buffers — accumulate readings between processWindow() calls.
   * At 100Hz with 200ms windows, each buffer gets ~20 readings per window.
   */
  private accelWindowBuffer: number[] = [];
  private gyroWindowBuffer: number[] = [];

  /** Sensor subscription handles — needed for cleanup */
  private accelSub: ReturnType<typeof Accelerometer.addListener> | null = null;
  private gyroSub: ReturnType<typeof Gyroscope.addListener> | null = null;

  /** Timer that fires every 200ms to process the window */
  private windowTimer: ReturnType<typeof setInterval> | null = null;

  /** Callback provided by CrashDetectionEngine */
  private onScoreCallback: ScoreCallback | null = null;

  /** Guard against double-start */
  private running = false;

  /** Most recent g-force value (for UI display and severity calculation) */
  private latestGForce = 0;

  /**
   * Start sensor monitoring and score computation.
   *
   * @param onScore  Called every 200ms with normalized scores:
   *                 accelScore (0-1), gyroScore (0-1), gForce (raw RMS)
   */
  start(onScore: ScoreCallback): void {
    if (this.running) return;
    this.running = true;
    this.onScoreCallback = onScore;

    // Configure both sensors to 100Hz (10ms between readings)
    // IMPORTANT: setUpdateInterval is global — affects ALL listeners for that sensor
    Accelerometer.setUpdateInterval(CRASH_THRESHOLDS.SENSOR_INTERVAL_MS);
    Gyroscope.setUpdateInterval(CRASH_THRESHOLDS.SENSOR_INTERVAL_MS);

    // ── ACCELEROMETER SUBSCRIPTION ──────────────────────────────────────────
    // expo-sensors delivers {x, y, z} in g-force units at the configured rate
    this.accelSub = Accelerometer.addListener(({ x, y, z }) => {
      // Step 1: Apply Kalman filter to each axis independently
      const fx = this.filters.accel.x.filter(x);
      const fy = this.filters.accel.y.filter(y);
      const fz = this.filters.accel.z.filter(z);

      // Step 2: Calculate net g-force (gravity removed)
      //
      // WHY subtract 1 from Z?
      // The accelerometer ALWAYS reads ~1g on Z-axis due to gravity:
      //   Phone at rest: {x: 0, y: 0, z: 1.0} → not a crash!
      //   Phone in crash: {x: 0.5, y: 0.3, z: 3.2} → real force
      //
      // By computing sqrt(fx² + fy² + (fz - 1)²) we get:
      //   Rest:  sqrt(0 + 0 + 0) = 0g    ← correct, no movement
      //   Crash: sqrt(0.25 + 0.09 + 4.84) = 2.27g  ← real impact
      //
      // NOTE: This assumes the phone is roughly upright/flat. If the phone
      // is at an angle, gravity distributes across axes. For AETHER v1,
      // this approximation works well enough for car-mounted phones.
      const gForce = Math.sqrt(fx * fx + fy * fy + (fz - 1) * (fz - 1));

      this.latestGForce = gForce;
      this.accelWindowBuffer.push(gForce);
    });

    // ── GYROSCOPE SUBSCRIPTION ──────────────────────────────────────────────
    // expo-sensors delivers {x, y, z} in rad/s (radians per second)
    this.gyroSub = Gyroscope.addListener(({ x, y, z }) => {
      // Apply Kalman filter to each rotation axis
      const fx = this.filters.gyro.x.filter(x);
      const fy = this.filters.gyro.y.filter(y);
      const fz = this.filters.gyro.z.filter(z);

      // Total rotation speed (magnitude of the rotation vector)
      // Unlike accelerometer, we DON'T subtract anything — 0 rad/s = no rotation
      const magnitude = Math.sqrt(fx * fx + fy * fy + fz * fz);
      this.gyroWindowBuffer.push(magnitude);
    });

    // ── WINDOW PROCESSING TIMER ─────────────────────────────────────────────
    // Every 200ms: compute scores from buffered readings, clear buffers
    this.windowTimer = setInterval(() => {
      this.processWindow();
    }, CRASH_THRESHOLDS.WINDOW_SIZE_MS);

    console.log('[SensorFusion] Started — 100Hz sampling, 200ms windows');
  }

  /**
   * Process the current 200ms window of accumulated sensor readings.
   *
   * This runs 5 times per second and produces normalized scores:
   * - accelScore: 0 (no force) to 1 (extreme force, ≥ 4g)
   * - gyroScore:  0 (no rotation) to 1 (extreme rotation, ≥ 6 rad/s)
   *
   * WHY RMS for accelerometer?
   * RMS (Root Mean Square) captures the "sustained intensity" of a signal.
   * A pothole spike of 3g in a single reading gets averaged down when
   * surrounded by 19 readings of 0.1g. But a real crash with 20 readings
   * all above 2g produces a high RMS. This is exactly the distinction we need.
   *
   * WHY MAX for gyroscope?
   * Peak rotation speed matters more than average for rollovers.
   * A vehicle can rotate briefly at 5 rad/s during a rollover — catching
   * that peak is more important than the average rotation over 200ms.
   */
  private processWindow(): void {
    if (!this.onScoreCallback) return;
    if (this.accelWindowBuffer.length === 0) return;

    // Accelerometer: RMS gives us sustained force level
    const accelRMS = this.rms(this.accelWindowBuffer);

    // Gyroscope: peak rotation in the window
    const maxGyro = this.gyroWindowBuffer.length > 0
      ? Math.max(...this.gyroWindowBuffer)
      : 0;

    // ── NORMALIZE TO 0-1 SCORES ─────────────────────────────────────────────
    // We divide by 2× the threshold so that the threshold value maps to 0.5
    // This gives the fusion engine a linear scale to work with:
    //
    // accelScore mapping:
    //   0g   → 0.00  (no force)
    //   1g   → 0.25  (hard brake)
    //   2g   → 0.50  (at threshold)
    //   4g+  → 1.00  (severe crash, capped)
    const accelScore = Math.min(
      accelRMS / (CRASH_THRESHOLDS.ACCEL_G_FORCE * 2),
      1.0
    );

    // gyroScore mapping:
    //   0 rad/s → 0.00  (no rotation)
    //   1.5     → 0.25  (sharp turn)
    //   3.0     → 0.50  (at threshold)
    //   6.0+    → 1.00  (violent rollover, capped)
    const gyroScore = Math.min(
      maxGyro / (CRASH_THRESHOLDS.GYRO_ROLLOVER_RAD_S * 2),
      1.0
    );

    // Clear buffers for next 200ms window
    this.accelWindowBuffer = [];
    this.gyroWindowBuffer = [];

    // Emit scores to CrashDetectionEngine
    this.onScoreCallback(accelScore, gyroScore, accelRMS);
  }

  /**
   * Root Mean Square — mathematical "average intensity" of a set of values.
   *
   * Formula: sqrt( (v1² + v2² + ... + vN²) / N )
   *
   * WHY RMS instead of simple average?
   * Simple average: [0.1, 3.0, 0.1] → avg = 1.07 (misleadingly high)
   * RMS:            [0.1, 3.0, 0.1] → RMS = 1.73 (even higher!)
   *
   * Wait — that seems worse? Not for our use case:
   * Simple average: [2.5, 2.8, 2.3, 2.6] → avg = 2.55
   * RMS:            [2.5, 2.8, 2.3, 2.6] → RMS = 2.56
   *
   * For SUSTAINED high values (crashes), RMS ≈ average.
   * For SPIKE values (potholes), the Kalman filter already dampened them.
   * RMS is the standard in vibration analysis and signal processing.
   */
  private rms(values: number[]): number {
    if (values.length === 0) return 0;
    const sumOfSquares = values.reduce((sum, v) => sum + v * v, 0);
    return Math.sqrt(sumOfSquares / values.length);
  }

  /**
   * Get the most recent g-force reading.
   * Used by CrashDetectionEngine for severity calculation and by UI for display.
   */
  getCurrentGForce(): number {
    return this.latestGForce;
  }

  /**
   * Stop all sensors and clean up resources.
   *
   * IMPORTANT: Always call this when the app goes to background or when
   * crash detection is disabled. Leaving sensors running drains battery
   * at ~5% per hour.
   */
  stop(): void {
    this.running = false;

    // Remove sensor subscriptions
    this.accelSub?.remove();
    this.gyroSub?.remove();
    this.accelSub = null;
    this.gyroSub = null;

    // Clear window processing timer
    if (this.windowTimer) {
      clearInterval(this.windowTimer);
      this.windowTimer = null;
    }

    // Reset all 6 Kalman filters to initial state
    // This ensures clean data on next start() — no stale state
    this.filters.accel.x.reset(0);
    this.filters.accel.y.reset(0);
    this.filters.accel.z.reset(1); // Z resets to 1 (gravity!)
    this.filters.gyro.x.reset(0);
    this.filters.gyro.y.reset(0);
    this.filters.gyro.z.reset(0);

    // Clear buffers
    this.accelWindowBuffer = [];
    this.gyroWindowBuffer = [];

    this.latestGForce = 0;
    this.onScoreCallback = null;

    console.log('[SensorFusion] Stopped');
  }
}
