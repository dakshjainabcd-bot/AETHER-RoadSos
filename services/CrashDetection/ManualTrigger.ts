/**
 * ManualTrigger — Manual SOS Activation (Shake + Button + Voice Sim)
 *
 * FROM THE MASTER DOCUMENT:
 * Three manual triggers are specified:
 * 1. Power button ×5 rapid press (Android native only — NOT available in Expo Go)
 * 2. Voice command "AETHER help" (Whisper tiny TFLite — NOT available in Expo Go)
 * 3. In-app SOS button (AVAILABLE — handled in sos.tsx)
 *
 * EXPO GO SUBSTITUTES:
 * Since we're running in Expo Go (not a custom native build):
 * 1. Power button ×5 → SHAKE DETECTION: Shake the phone 3× rapidly
 *    (Accelerometer picks this up — works in Expo Go without native modules)
 * 2. Voice command → TEST BUTTON in UI (for demo/presentation purposes)
 * 3. In-app button → Already works (from Phase 1 / sos.tsx)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SHAKE DETECTION — How it works and WHY these values
 * ═══════════════════════════════════════════════════════════════════════
 *
 * WHY 2.5g THRESHOLD (not lower)?
 * ┌────────────────────────────────────────────────┐
 * │  Activity              │ Typical g-force        │
 * │────────────────────────│────────────────────────│
 * │  Phone at rest         │ ~0.0g (gravity removed)│
 * │  Normal driving        │ 0.1 - 0.3g             │
 * │  Road bump / pothole   │ 0.5 - 1.0g             │
 * │  Hard brake            │ 0.8 - 1.2g             │
 * │  Phone fumble in hand  │ 1.0 - 2.0g             │
 * │  INTENTIONAL shake     │ 2.5 - 5.0g  ← HERE    │
 * │  Car crash             │ 2.0 - 10.0g            │
 * └────────────────────────────────────────────────┘
 *
 * At 2.5g, we're safely above road bumps (1.0g) and casual phone handling
 * (2.0g), but easy enough for a determined user to reach by shaking hard.
 *
 * WHY 3 SHAKES (not 1)?
 * - 1 shake: Could be triggered by dropping the phone, tossing it on a bed,
 *   or an aggressive pothole. WAY too many accidental triggers.
 * - 2 shakes: Still possible accidentally (phone bouncing in a bag on a bumpy road).
 * - 3 shakes in 2 seconds: Virtually impossible to trigger accidentally.
 *   You have to deliberately grab the phone and shake it hard 3 times.
 *   This matches the "power button ×5" philosophy: multiple intentional actions.
 *
 * IMPORTANT ARCHITECTURE NOTE:
 * ManualTrigger does NOT create its own accelerometer subscription!
 * It piggybacks on SensorFusion's readings — CrashDetectionEngine calls
 * checkForShake() with the g-force value from each sensor window.
 * This prevents the "dual subscription interval conflict" where two
 * Accelerometer.addListener() calls fight over setUpdateInterval().
 */

/** Callback type for when a manual trigger fires */
type TriggerCallback = (triggerType: 'manual_button' | 'shake' | 'voice_simulation') => void;

export class ManualTrigger {
  /** Callback to fire when any manual trigger activates */
  private callback: TriggerCallback | null = null;

  // ── Shake detection state ─────────────────────────────────────────────────

  /** How many qualifying shakes we've detected in the current window */
  private shakeCount = 0;

  /** Timestamp (ms) of the most recent qualifying shake */
  private lastShakeTimestamp = 0;

  /**
   * Minimum g-force to count as a "shake".
   * 2.5g requires a deliberate, forceful shake — not achievable by road bumps.
   * See the table in the file header for comparison values.
   */
  private readonly SHAKE_G_THRESHOLD = 2.5;

  /**
   * Maximum time (ms) between shakes before the count resets.
   * 2000ms = 2 seconds. If you pause for more than 2 seconds between
   * shakes, you have to start over. This prevents slow, accidental
   * accumulation over time (e.g., 3 potholes over 30 seconds).
   */
  private readonly SHAKE_RESET_MS = 2000;

  /**
   * Number of shakes required to trigger SOS.
   * 3 shakes in 2 seconds = clearly intentional behavior.
   */
  private readonly REQUIRED_SHAKES = 3;

  /**
   * Register the callback that fires when a manual trigger is activated.
   * Called once during CrashDetectionEngine initialization.
   */
  setCallback(cb: TriggerCallback): void {
    this.callback = cb;
  }

  /**
   * Check if a raw g-force reading qualifies as a "shake".
   *
   * Called by CrashDetectionEngine on every sensor window (every 200ms)
   * with the raw g-force value from SensorFusion.
   *
   * The shake detection state machine:
   *   rawGForce > 2.5g?
   *     ├─ NO → do nothing (normal driving / idle)
   *     └─ YES → was lastShake > 2s ago?
   *                ├─ YES → reset count to 0, start fresh
   *                └─ NO → increment count
   *                          └─ count >= 3? → TRIGGER! 🚨
   *
   * @param rawGForce  The raw (unfiltered) g-force from SensorFusion's accelRMS
   */
  checkForShake(rawGForce: number): void {
    if (!this.callback) return;

    // Only count readings above the shake threshold
    if (rawGForce > this.SHAKE_G_THRESHOLD) {
      const now = Date.now();

      // If too much time has passed since the last shake, start over
      // This prevents slow accumulation: 3 potholes over 30 seconds ≠ intentional shake
      if (now - this.lastShakeTimestamp > this.SHAKE_RESET_MS) {
        this.shakeCount = 0;
      }

      this.shakeCount++;
      this.lastShakeTimestamp = now;

      console.log(
        `[ManualTrigger] Shake ${this.shakeCount}/${this.REQUIRED_SHAKES} ` +
        `(${rawGForce.toFixed(1)}g)`
      );

      // Three shakes detected within 2 seconds → fire the trigger!
      if (this.shakeCount >= this.REQUIRED_SHAKES) {
        this.shakeCount = 0; // Reset for next use
        console.log('[ManualTrigger] ✋ Shake trigger activated!');
        this.callback('shake');
      }
    }
  }

  /**
   * Trigger SOS via the in-app button.
   * Called directly from the SOS screen UI when user taps the SOS button.
   */
  triggerManualButton(): void {
    this.callback?.('manual_button');
  }

  /**
   * Trigger SOS via voice command simulation.
   * In production: Whisper TFLite would detect "AETHER help" spoken aloud.
   * In Expo Go: This is called from a test button in the UI for demo purposes.
   */
  triggerVoiceSimulation(): void {
    this.callback?.('voice_simulation');
  }

  /**
   * Reset shake detection state.
   * Called after a crash is confirmed/cancelled to start fresh,
   * preventing leftover shake counts from affecting the next detection cycle.
   */
  reset(): void {
    this.shakeCount = 0;
    this.lastShakeTimestamp = 0;
  }
}
