/**
 * CrashDetectionEngine — The Brain of Phase 3
 *
 * This is the ORCHESTRATOR. It connects all Phase 3 components:
 * - SensorFusion   → accelerometer + gyroscope at 100Hz
 * - AcousticDetector → microphone amplitude analysis
 * - ManualTrigger   → shake detection + manual buttons
 *
 * And integrates with Phase 2:
 * - MeshRelayManager → broadcasts SOS over mesh network
 *
 * ═══════════════════════════════════════════════════════════════════════
 * FULL DETECTION FLOW (ASCII Architecture)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │                    SENSOR LAYER (100Hz)                          │
 *  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
 *  │  │ Accelerometer│  │  Gyroscope   │  │  Microphone (on-demand│   │
 *  │  │  x, y, z (g) │  │ x, y, z (r/s│  │  amplitude in dBFS)  │   │
 *  │  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
 *  │         │ Kalman          │ Kalman               │              │
 *  │         ▼                 ▼                      ▼              │
 *  │  ┌──────────────────────────────┐  ┌─────────────────────────┐  │
 *  │  │     SensorFusion             │  │   AcousticDetector      │  │
 *  │  │  RMS over 200ms windows      │  │   Activated only when   │  │
 *  │  │  → accelScore (0-1)          │  │   accelScore > 0.3      │  │
 *  │  │  → gyroScore  (0-1)          │  │   → acousticScore (0-1) │  │
 *  │  └──────────────┬───────────────┘  └──────────┬──────────────┘  │
 *  └─────────────────┼──────────────────────────────┼────────────────┘
 *                    │                              │
 *                    ▼                              ▼
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │              FUSION LAYER (this file)                            │
 *  │                                                                  │
 *  │  confidence = accel×0.4 + gyro×0.3 + acoustic×0.3               │
 *  │                                                                  │
 *  │  confidence ≥ 0.75 for 10 consecutive windows (2 seconds)?       │
 *  │       │ YES                                    │ NO              │
 *  │       ▼                                        ▼                 │
 *  │  ┌───────────────┐                    ┌─────────────────┐        │
 *  │  │ CRASH_CONFIRMED│                    │ Reset counter,  │        │
 *  │  │ → countdown UI │                    │ back to idle    │        │
 *  │  └───────┬───────┘                    └─────────────────┘        │
 *  └──────────┼───────────────────────────────────────────────────────┘
 *             │
 *             ▼
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │              ACTION LAYER                                        │
 *  │                                                                  │
 *  │  ┌─────────────────────────────────────────────────────────────┐ │
 *  │  │  5-SECOND COUNTDOWN (shown in _layout.tsx)                  │ │
 *  │  │                                                             │ │
 *  │  │  User taps "I'm OK"?  ──→  cancelSOS()                     │ │
 *  │  │    → Log false positive                                     │ │
 *  │  │    → Reset to idle                                          │ │
 *  │  │                                                             │ │
 *  │  │  5 seconds expire?    ──→  dispatchSOS()                    │ │
 *  │  │    → Calculate severity (1-5) from g-force                  │ │
 *  │  │    → meshRelayManager.triggerSOS(severity)  ← PHASE 2 LINK │ │
 *  │  │    → State = 'active_sos'                                   │ │
 *  │  └─────────────────────────────────────────────────────────────┘ │
 *  └──────────────────────────────────────────────────────────────────┘
 *
 *  MANUAL TRIGGERS (bypass the 2-second confidence requirement):
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │  🤝 Shake phone 3x rapidly    → ManualTrigger → countdown      │
 *  │  🔘 Tap SOS button in app     → ManualTrigger → countdown      │
 *  │  🎤 Voice sim test button     → ManualTrigger → countdown      │
 *  └──────────────────────────────────────────────────────────────────┘
 */

import { SensorFusion } from './SensorFusion';
import { AcousticDetector } from './AcousticDetector';
import { ManualTrigger } from './ManualTrigger';
import {
  CrashDetectionState,
  CrashEngineEvent,
  CrashEngineEventType,
  FusionScore,
  CRASH_THRESHOLDS,
  FUSION_WEIGHTS,
  FUSION_WEIGHTS_NO_ACOUSTIC,
} from './types';
import { meshRelayManager } from '../MeshRelay/MeshRelayManager';
import { trustScoreService } from '../Trust/TrustScoreService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../utils/constants';

type EventCallback = (event: CrashEngineEvent) => void;

class CrashDetectionEngine {
  // ── Sub-components ────────────────────────────────────────────────────
  private sensorFusion = new SensorFusion();
  private acousticDetector = new AcousticDetector();
  private manualTrigger = new ManualTrigger();

  // ── State machine ─────────────────────────────────────────────────────
  private state: CrashDetectionState = 'idle';

  // ── Event system ──────────────────────────────────────────────────────
  private listeners = new Map<string, EventCallback[]>();

  // ── Detection tracking ────────────────────────────────────────────────
  /** How many consecutive 200ms windows have exceeded the confidence threshold */
  private consecutiveHighWindows = 0;

  /** Whether the acoustic detector is currently listening */
  private acousticActive = false;

  /** Latest fusion scores (for UI display and SOS dispatch) */
  private currentScore: FusionScore = {
    accelScore: 0,
    gyroScore: 0,
    acousticScore: 0,
    confidence: 0,
    gForce: 0,
  };

  /** Guard against double initialization */
  private initialized = false;

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC: INITIALIZATION
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Initialize the crash detection engine.
   * Call ONCE at app startup from _layout.tsx, AFTER GPS and MeshRelay are ready.
   *
   * This starts the sensor pipeline:
   *   Sensors → SensorFusion → onSensorWindow() → fusion → state machine
   */
  initialize(): void {
    if (this.initialized) return;

    console.log('[CrashDetection] Initializing Phase 3 crash detection...');

    this.acousticActive = true;
    this.acousticDetector.activate();

    // Set up manual trigger callback (shake, button, voice sim)
    this.manualTrigger.setCallback((triggerType) => {
      console.log(`[CrashDetection] Manual trigger received: ${triggerType}`);
      this.onManualTrigger(triggerType);
    });

    // Start sensor fusion — this begins the 100Hz sensor pipeline
    // onSensorWindow is called every 200ms with normalized scores
    this.sensorFusion.start((accelScore, gyroScore, gForce) => {
      this.onSensorWindow(accelScore, gyroScore, gForce);
    });

    this.initialized = true;
    console.log('[CrashDetection] ✅ Engine ready — sensors active at 100Hz');
  }

  // ══════════════════════════════════════════════════════════════════════
  // PRIVATE: CORE DETECTION LOOP (called every 200ms)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Process a 200ms window of sensor data.
   *
   * This is the HEARTBEAT of crash detection — called 5 times per second
   * by SensorFusion with pre-computed scores from the Kalman-filtered
   * accelerometer and gyroscope data.
   *
   * @param accelScore  Normalized accelerometer RMS (0-1)
   * @param gyroScore   Normalized peak gyroscope magnitude (0-1)
   * @param gForce      Raw RMS g-force (for severity and shake detection)
   */
  private onSensorWindow(accelScore: number, gyroScore: number, gForce: number): void {
    // ── GUARD: Don't process during countdown/dispatch/active SOS ──────
    // Once a crash is confirmed, we stop looking for new crashes.
    // The user must either cancel or the SOS must complete first.
    if (
      this.state === 'countdown' ||
      this.state === 'dispatching' ||
      this.state === 'active_sos'
    ) {
      return;
    }

    // ── SHAKE DETECTION ───────────────────────────────────────────────
    // Pass the raw gForce to ManualTrigger for shake pattern recognition.
    // ManualTrigger doesn't have its own sensor subscription — it piggybacks
    // on SensorFusion's data to avoid dual-subscription interval conflicts.
    this.manualTrigger.checkForShake(gForce);

    // ── ACOUSTIC ACTIVATION ───────────────────────────────────────────
    // The microphone is now dedicated entirely to crash detection and 
    // runs continuously from initialization.
    const acousticScore = this.acousticDetector.getScore();

    // ── SENSOR FUSION CALCULATION ─────────────────────────────────────
    // Choose weights based on microphone availability
    const useMic = this.acousticDetector.isMicrophoneAvailable();
    const weights = useMic ? FUSION_WEIGHTS : FUSION_WEIGHTS_NO_ACOUSTIC;

    // Choose threshold: lower when no mic (to compensate for missing data)
    const threshold = !useMic
      ? FUSION_WEIGHTS_NO_ACOUSTIC.THRESHOLD_OVERRIDE
      : CRASH_THRESHOLDS.CONFIDENCE_TRIGGER;

    // The fusion formula:
    //   With mic:    confidence = accel×0.4 + gyro×0.3 + acoustic×0.3
    //   Without mic: confidence = accel×0.57 + gyro×0.43 + acoustic×0.0
    const confidence =
      accelScore * weights.ACCEL +
      gyroScore * weights.GYRO +
      acousticScore * weights.ACOUSTIC;

    // Update current scores (used by UI and dispatchSOS)
    this.currentScore = { accelScore, gyroScore, acousticScore, confidence, gForce };

    // Emit score update for live UI display (SOS screen confidence meter)
    this.emit({ type: 'SCORE_UPDATED', score: this.currentScore });

    // ── CONFIDENCE TRACKING (State Machine Logic) ─────────────────────
    if (confidence >= threshold) {
      this.consecutiveHighWindows++;

      // First high window: move from idle → candidate
      if (this.state === 'idle') {
        this.setState('candidate');
        this.emit({ type: 'CANDIDATE_DETECTED', score: this.currentScore });
      }

      console.log(
        `[CrashDetection] Confidence: ${confidence.toFixed(3)} — ` +
        `window ${this.consecutiveHighWindows}/${CRASH_THRESHOLDS.CONSECUTIVE_WINDOWS}`
      );

      // 10 consecutive high windows (2 seconds) → CRASH CONFIRMED
      if (this.consecutiveHighWindows >= CRASH_THRESHOLDS.CONSECUTIVE_WINDOWS) {
        this.onCrashConfirmed();
      }
    } else {
      // Confidence dropped below threshold — reset counter
      if (this.consecutiveHighWindows > 0) {
        console.log(
          `[CrashDetection] Confidence dropped to ${confidence.toFixed(3)}, ` +
          `resetting window counter`
        );
        this.consecutiveHighWindows = 0;
      }

      // If we were in candidate state, go back to idle
      if (this.state === 'candidate') {
        this.setState('idle');
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // PRIVATE: STATE TRANSITIONS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Crash confidence sustained for 2 seconds — transition to countdown.
   * The UI (_layout.tsx) will show the 5-second cancel window.
   */
  private onCrashConfirmed(): void {
    // Guard against duplicate calls
    if (this.state === 'countdown' || this.state === 'active_sos') return;

    console.log('[CrashDetection] 🚨 CRASH CONFIRMED — starting 5-second cancel window');
    this.consecutiveHighWindows = 0;
    this.setState('countdown');
    this.emit({ type: 'CRASH_CONFIRMED', score: this.currentScore });
  }

  /**
   * Handle manual SOS triggers (shake, button, voice simulation).
   * These bypass the 2-second confidence requirement and go straight
   * to countdown with 100% confidence (user explicitly asked for help).
   */
  private onManualTrigger(triggerType: 'manual_button' | 'shake' | 'voice_simulation'): void {
    // Don't interrupt an existing countdown or active SOS
    if (this.state === 'countdown' || this.state === 'active_sos') return;

    console.log(`[CrashDetection] Manual SOS: ${triggerType} — starting countdown`);
    this.setState('countdown');

    // Manual triggers have 100% confidence — the user TOLD us it's an emergency
    this.emit({
      type: 'CRASH_CONFIRMED',
      score: {
        accelScore: 0,
        gyroScore: 0,
        acousticScore: 0,
        confidence: 1.0,
        gForce: 0,
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC: ACTIONS (called by UI / _layout.tsx)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Cancel the SOS — user tapped "I'm OK" within the 5-second window.
   *
   * This:
   * 1. Logs the false positive count (for future ML model improvement)
   * 2. Resets all detection state
   * 3. Transitions: countdown → cancelled → (2s) → idle
   */
  async cancelSOS(): Promise<void> {
    if (this.state !== 'countdown') return;
    console.log('[CrashDetection] ❌ User cancelled SOS — logging false positive');

    // ── Phase 13: Deduct trust score for false positive ──────────────
    trustScoreService.onFalsePositive().catch(() => {});

    // ── Log false positive for future improvement ───────────────────
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.FALSE_POSITIVE_COUNT);
      const count = parseInt(raw ?? '0', 10) + 1;
      await AsyncStorage.setItem(STORAGE_KEYS.FALSE_POSITIVE_COUNT, count.toString());
      console.log(`[CrashDetection] Total false positives logged: ${count}`);
    } catch {
      // Non-critical — don't crash the app over analytics
    }

    // ── Reset all detection state ───────────────────────────────────
    this.consecutiveHighWindows = 0;
    this.acousticDetector.reset();
    await this.acousticDetector.deactivate();
    this.acousticActive = false;
    this.manualTrigger.reset();

    // ── Transition to cancelled, then back to idle after 2 seconds ──
    this.setState('cancelled');
    this.emit({ type: 'CRASH_CANCELLED' });

    // Brief "cancelled" state lets UI show confirmation before returning to normal
    setTimeout(() => this.setState('idle'), 2000);
  }

  /**
   * Dispatch the SOS — called when the 5-second countdown expires
   * WITHOUT the user pressing cancel.
   *
   * This is the CRITICAL INTEGRATION POINT between Phase 3 and Phase 2:
   * CrashDetectionEngine.dispatchSOS() → meshRelayManager.triggerSOS()
   *
   * The mesh relay system then:
   * - Broadcasts SOS packet via WebSocket (Expo Go) or BLE (production)
   * - Queues for cloud upload
   * - Notifies nearby AETHER phones
   */
  async dispatchSOS(): Promise<void> {
    if (this.state !== 'countdown') return;
    this.setState('dispatching');

    // Calculate severity from peak g-force
    const severity = this.calculateSeverity(this.currentScore.gForce);

    console.log(
      `[CrashDetection] 🚨 DISPATCHING SOS — ` +
      `severity: ${severity}, ` +
      `confidence: ${this.currentScore.confidence.toFixed(2)}, ` +
      `gForce: ${this.currentScore.gForce.toFixed(1)}g`
    );

    // ══════════════════════════════════════════════════════════════════
    // KEY INTEGRATION: Phase 3 → Phase 2
    // CrashDetectionEngine hands off to MeshRelayManager
    // MeshRelayManager handles GPS, packet creation, broadcast, and cloud
    // ══════════════════════════════════════════════════════════════════
    const packet = await meshRelayManager.triggerSOS(severity);

    if (packet) {
      console.log(`[CrashDetection] ✅ SOS dispatched via mesh relay: ${packet.incidentId}`);
    } else {
      console.warn('[CrashDetection] ⚠️ Mesh relay returned null — SOS may not have been relayed');
    }

    // Transition to active SOS state
    this.setState('active_sos');

    // ── Phase 13: Award trust for lifesaver event (if hospital READY later) ──
    // The HospitalPreAlert service calls trustScoreService.onLifesaverEvent()
    // when it receives the READY reply — no action needed here.

    // Emit SOS_DISPATCHED event with crash details
    // NOTE: lat/lng are 0 here because meshRelayManager handles GPS internally.
    // The actual GPS coordinates are in the packet created by meshRelayManager.
    this.emit({
      type: 'SOS_DISPATCHED',
      crashEvent: {
        incidentId: packet?.incidentId ?? `local_${Date.now()}`,
        severity,
        lat: 0,  // meshRelayManager has the real GPS in the packet
        lng: 0,
        timestamp: Date.now(),
        confidence: this.currentScore.confidence,
        triggerType: 'auto',
        gForce: this.currentScore.gForce,
      },
    });
  }

  /**
   * Manually trigger SOS via the in-app button.
   * Goes through the same 5-second countdown as auto-detection.
   */
  triggerManualSOS(): void {
    this.manualTrigger.triggerManualButton();
  }

  /**
   * Test/demo trigger — bypasses sensor detection.
   * For development and presentation purposes only.
   */
  triggerTestSOS(): void {
    this.manualTrigger.triggerVoiceSimulation();
  }

  /**
   * Reset to idle — call after an active SOS is resolved.
   * Used when the emergency is over and the user wants to return to normal mode.
   */
  resetToIdle(): void {
    this.consecutiveHighWindows = 0;
    this.acousticDetector.reset();
    this.acousticActive = false;
    this.manualTrigger.reset();
    this.setState('idle');
    console.log('[CrashDetection] Reset to idle');
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC: GETTERS
  // ══════════════════════════════════════════════════════════════════════

  /** Current state machine state */
  getState(): CrashDetectionState {
    return this.state;
  }

  /** Latest fusion scores (for UI confidence display) */
  getCurrentScore(): FusionScore {
    return this.currentScore;
  }

  /** Latest raw g-force from accelerometer */
  getCurrentGForce(): number {
    return this.sensorFusion.getCurrentGForce();
  }

  // ══════════════════════════════════════════════════════════════════════
  // EVENT SYSTEM (pub-sub, same pattern as MeshRelayManager)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to crash detection events.
   *
   * Usage:
   *   const unsub = crashDetectionEngine.on('CRASH_CONFIRMED', (event) => {
   *     // Show countdown UI
   *   });
   *   // Call unsub() in useEffect cleanup
   *
   * @param eventType  Specific event name, or 'ALL' to receive everything
   * @param callback   Function called when event fires
   * @returns          Cleanup function (call to unsubscribe)
   */
  on(eventType: CrashEngineEventType | 'ALL', callback: EventCallback): () => void {
    const key = String(eventType);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)!.push(callback);

    // Return unsubscribe function
    return () => {
      const cbs = this.listeners.get(key) ?? [];
      this.listeners.set(key, cbs.filter(cb => cb !== callback));
    };
  }

  /**
   * Fire an event to all matching listeners.
   * Events go to both specific-type listeners AND 'ALL' listeners.
   */
  private emit(event: CrashEngineEvent): void {
    // Fire specific type listeners
    const specificKey = String(event.type);
    const specific = this.listeners.get(specificKey) ?? [];
    specific.forEach(cb => {
      try { cb(event); } catch { /* don't let one listener break others */ }
    });

    // Fire 'ALL' listeners
    const all = this.listeners.get('ALL') ?? [];
    all.forEach(cb => {
      try { cb(event); } catch { /* don't let one listener break others */ }
    });
  }

  /**
   * Transition to a new state.
   * Guards against same-state transitions and emits STATE_CHANGED.
   */
  private setState(newState: CrashDetectionState): void {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    console.log(`[CrashDetection] State: ${oldState} → ${newState}`);
    this.emit({ type: 'STATE_CHANGED', state: newState });
  }

  /**
   * Calculate crash severity (1-5) from peak g-force.
   *
   * Severity scale based on phone-measured g-force:
   *   1 = minor (< 3g)  — fender-bender, the kind you exchange insurance for
   *   2 = moderate (3-5g) — noticeable impact, possible injuries
   *   3 = significant (5-8g) — serious collision, likely injuries
   *   4 = severe (8-12g) — major crash, high injury probability
   *   5 = catastrophic (12g+) — extreme impact, life-threatening
   *
   * NOTE: Phone g-force is lower than vehicle frame g-force
   * because the phone is cushioned inside the cabin.
   */
  private calculateSeverity(gForce: number): 1 | 2 | 3 | 4 | 5 {
    if (gForce < 3) return 1;
    if (gForce < 5) return 2;
    if (gForce < 8) return 3;
    if (gForce < 12) return 4;
    return 5;
  }

  /**
   * Shut down the crash detection engine.
   * Call when the app is closing or crash detection is being disabled.
   * Stops all sensors and releases resources.
   */
  shutdown(): void {
    this.sensorFusion.stop();
    this.acousticDetector.deactivate();
    this.initialized = false;
    console.log('[CrashDetection] Engine shut down');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// SINGLETON — One engine instance for the whole app
// Used by _layout.tsx, sos.tsx, and any component that needs crash state
// ══════════════════════════════════════════════════════════════════════════
export const crashDetectionEngine = new CrashDetectionEngine();