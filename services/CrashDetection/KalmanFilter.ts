/**
 * 1D Kalman Filter — Noise Reduction for Sensor Data
 *
 * THE PROBLEM IT SOLVES:
 * A real phone in a car gets constant vibrations from:
 * - Engine rumble (~0.1-0.3g)
 * - Road texture (~0.1-0.5g on bad roads)
 * - Potholes (~0.5-1.0g brief spikes)
 *
 * Without filtering, AETHER would trigger SOS on every pothole.
 *
 * THE SOLUTION:
 * A Kalman filter is like a "smart average" that knows:
 * - How much the true value changes over time (processNoise)
 * - How noisy the sensor is (measurementNoise)
 * - Kalman gain = how much to trust the new measurement vs past estimate
 *
 * VISUAL EXAMPLE — Pothole (brief spike, NOT a crash):
 * ┌─────────────────────────────────────────────────────┐
 * │  Raw:    0.1  0.1  2.3  0.2  0.1  0.3  0.1  0.1   │
 * │                     ▲                               │
 * │               pothole spike                         │
 * │  Kalman: 0.1  0.1  0.3  0.3  0.2  0.2  0.2  0.1   │
 * │               smooth — no false trigger!            │
 * └─────────────────────────────────────────────────────┘
 *
 * VISUAL EXAMPLE — Real Crash (sustained high values):
 * ┌─────────────────────────────────────────────────────┐
 * │  Raw:    0.1  0.2  3.5  4.2  3.8  3.1  2.8  2.5   │
 * │                     ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲              │
 * │               sustained impact force                │
 * │  Kalman: 0.1  0.2  1.2  2.3  2.9  2.9  2.9  2.7   │
 * │               rises and STAYS high → triggers!      │
 * └─────────────────────────────────────────────────────┘
 *
 * KEY INSIGHT: The Kalman filter smooths out brief spikes (potholes)
 * but faithfully tracks sustained changes (real crashes). This is
 * exactly the behavior we need for crash detection.
 */
export class KalmanFilter1D {
  /**
   * q — Process noise covariance.
   * "How much does the TRUE value change between readings?"
   *
   * Small q (0.01): The filter assumes the real signal is smooth/stable.
   *   → Good for: accelerometer during normal driving
   *   → Effect: Strong smoothing, slow to react to changes
   *
   * Large q (1.0): The filter assumes the real signal changes rapidly.
   *   → Good for: highly dynamic signals
   *   → Effect: Weak smoothing, fast to react but more noise passes through
   */
  private q: number;

  /**
   * r — Measurement noise covariance.
   * "How noisy is the sensor itself?"
   *
   * Small r (0.01): "I trust the sensor readings a lot"
   *   → Filter output stays close to raw measurements
   *
   * Large r (1.0): "The sensor is very noisy, don't trust individual readings"
   *   → Filter smooths aggressively, ignoring individual spikes
   *
   * For phone accelerometers, r = 0.1 is a good starting point because
   * they have moderate noise from vibration and digitization.
   */
  private r: number;

  /**
   * x — Current state estimate.
   * "Our best guess of the TRUE acceleration right now."
   *
   * This is the output of the filter — the smoothed value.
   * It gets updated every time filter() is called with a new measurement.
   */
  private x: number;

  /**
   * p — Estimation error covariance.
   * "How uncertain are we about our current estimate?"
   *
   * Starts at 1.0 (very uncertain — we just started, no data yet).
   * Decreases as we process more measurements (we become more confident).
   * Increases slightly each predict step (time passes, things change).
   *
   * You never read this value directly, but it controls the Kalman gain.
   */
  private p: number;

  /**
   * k — Kalman gain.
   * "How much should we trust the NEW measurement vs our EXISTING estimate?"
   *
   * k close to 1.0: "Trust the measurement" → filter reacts quickly
   * k close to 0.0: "Trust our estimate" → filter smooths heavily
   *
   * The beauty of the Kalman filter is that k is computed automatically
   * based on p, q, and r — no manual tuning needed for this parameter.
   */
  private k: number;

  /**
   * Create a new 1D Kalman filter.
   *
   * @param processNoise     How fast does the real signal change?
   *                         0.01 = slow/smooth (good for accel), 1.0 = fast/jumpy
   * @param measurementNoise How noisy is the sensor?
   *                         0.1 = moderate noise (phone accelerometer), 1.0 = very noisy
   * @param initialValue     Starting estimate. Use 0 for acceleration delta,
   *                         or 1.0 for Z-axis (which rests at ~1g due to gravity).
   */
  constructor(
    processNoise: number = 0.01,
    measurementNoise: number = 0.1,
    initialValue: number = 0
  ) {
    this.q = processNoise;
    this.r = measurementNoise;
    this.x = initialValue;
    this.p = 1.0; // Start uncertain — we have no data yet
    this.k = 0;   // No gain computed yet
  }

  /**
   * Feed a new raw sensor measurement and get back the filtered (smoothed) value.
   *
   * Call this for EVERY sensor sample (at 100Hz, that's every 10ms).
   *
   * The method implements the standard Kalman predict-update cycle:
   *
   *   ┌──────────────────────────────────────────────────┐
   *   │  PREDICT: "Time has passed, we're less certain"  │
   *   │     p = p + q                                    │
   *   │                                                  │
   *   │  GAIN: "How much to trust the new measurement?"  │
   *   │     k = p / (p + r)                              │
   *   │                                                  │
   *   │  UPDATE STATE: "Blend old estimate with new data"│
   *   │     x = x + k × (measurement - x)               │
   *   │                                                  │
   *   │  UPDATE COVARIANCE: "We're more certain now"     │
   *   │     p = (1 - k) × p                              │
   *   └──────────────────────────────────────────────────┘
   *
   * @param measurement  Raw sensor reading (e.g., g-force from accelerometer)
   * @returns            Filtered value with noise reduced
   */
  filter(measurement: number): number {
    // ── PREDICT STEP ──
    // Time has passed since our last estimate. The true value might have
    // changed, so our uncertainty (p) increases by the process noise (q).
    // Think of it like: "I knew where my car was 10ms ago, but it could
    // have moved since then, so I'm slightly less sure now."
    this.p = this.p + this.q;

    // ── COMPUTE KALMAN GAIN ──
    // This is the "magic" of the Kalman filter. The gain automatically
    // balances between trusting the measurement and trusting our estimate.
    //
    // If p is large (we're very uncertain): k → 1 → trust measurement more
    // If r is large (sensor is very noisy): k → 0 → trust estimate more
    //
    // Example: p=1.0, r=0.1 → k = 1.0/1.1 = 0.91 (trust measurement)
    // Example: p=0.05, r=0.1 → k = 0.05/0.15 = 0.33 (trust estimate more)
    this.k = this.p / (this.p + this.r);

    // ── UPDATE STATE ESTIMATE ──
    // Blend our current estimate with the new measurement.
    // (measurement - this.x) is the "innovation" — how much the measurement
    // differs from what we predicted. We move our estimate toward the
    // measurement by an amount proportional to the Kalman gain.
    //
    // If k = 0.9: x moves 90% of the way toward measurement (trust it!)
    // If k = 0.1: x moves only 10% toward measurement (barely budge)
    this.x = this.x + this.k * (measurement - this.x);

    // ── UPDATE ERROR COVARIANCE ──
    // After incorporating the measurement, we're more certain about our
    // estimate, so p decreases. The more we trusted the measurement
    // (higher k), the more our uncertainty decreases.
    this.p = (1 - this.k) * this.p;

    return this.x;
  }

  /**
   * Reset the filter state — call this when:
   * - A false positive was cancelled (start fresh for next detection)
   * - The app transitions from background to foreground
   * - Sensor readings jump discontinuously (e.g., phone picked up)
   *
   * @param value  New initial estimate (default 0)
   */
  reset(value: number = 0): void {
    this.x = value;
    this.p = 1.0; // Reset to uncertain — we need fresh data
    this.k = 0;
  }

  /**
   * Get the current filtered estimate WITHOUT providing a new measurement.
   *
   * Useful for:
   * - Displaying the current smoothed value in debug UI
   * - Checking the last known value when sensors are temporarily unavailable
   */
  get estimate(): number {
    return this.x;
  }
}
