/**
 * AcousticDetector — Phase 3: Crash Sound Detection
 *
 * FIXES IN THIS VERSION:
 *
 * Fix 1 — Infinite retry loop (previous bug):
 *   Old code retried activate() every 200ms when mic permission was denied.
 *   Now we check permission ONCE at startup and cache the result permanently.
 *   If denied, activate() returns false silently — no error spam.
 *
 * Fix 2 — Clean SOS mic handover (new):
 *   When SOS fires, CrashDetectionEngine calls setEnabled(false).
 *   This stops acoustic detection immediately and blocks all future retries.
 *   The mic is now free for PostSOSVoice (injury description / victim log).
 *   When SOS is dismissed and we resetToIdle(), setEnabled(true) re-enables it.
 *
 * Mic ownership is crystal clear:
 *   Before SOS → AcousticDetector owns mic (crash sound detection)
 *   After SOS  → mic is free (PostSOSVoice / WhisperSTT can use it)
 *   After dismiss → AcousticDetector owns mic again
 */

import { Audio } from 'expo-av';
import { audioSessionManager } from '../../utils/AudioSessionManager';

const CRASH_AMPLITUDE_THRESHOLD = 0.6;
const SAMPLE_INTERVAL_MS = 250;

export type AcousticScore = {
  score: number;
  triggered: boolean;
};

export type AcousticScoreCallback = (result: AcousticScore) => void;

export class AcousticDetector {
  private recording: Audio.Recording | null = null;
  private sampleInterval: ReturnType<typeof setInterval> | null = null;
  private isActive = false;
  private onScore: AcousticScoreCallback | null;
  private latestScore = 0;

  // ── Permission state (checked once, cached forever) ──────────────────────
  private micPermissionGranted = true;
  private permissionChecked = false;

  // ── Enabled state (controlled by CrashDetectionEngine) ───────────────────
  // true  = normal operation (before SOS fires)
  // false = SOS is active, mic handed to PostSOSVoice
  private isEnabled = true;

  constructor(onScore?: AcousticScoreCallback) {
    this.onScore = onScore ?? null;

    audioSessionManager.register('AcousticDetector', async () => {
      await this.deactivate();
    });

    // Check permission once at startup — non-blocking
    this.checkPermission();
  }

  // ── Permission check (runs once) ──────────────────────────────────────────

  private async checkPermission(): Promise<void> {
    if (this.permissionChecked) return;
    this.permissionChecked = true;

    try {
      const { granted } = await Audio.getPermissionsAsync();
      if (granted) {
        this.micPermissionGranted = true;
        return;
      }
      const { granted: requested } = await Audio.requestPermissionsAsync();
      this.micPermissionGranted = requested;
      if (!requested) {
        console.warn(
          '[AcousticDetector] Mic permission denied — acoustic crash detection ' +
          'disabled. Crash detection still works via accelerometer + gyroscope.'
        );
      }
    } catch {
      this.micPermissionGranted = false;
    }
  }

  // ── Enabled control (called by CrashDetectionEngine) ─────────────────────

  /**
   * Enable or disable acoustic detection.
   *
   * setEnabled(false) → called when SOS dispatches (mic handed to PostSOSVoice)
   * setEnabled(true)  → called when SOS is dismissed (resumes crash detection)
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    if (!enabled && this.isActive) {
      this.deactivate(); // stop immediately — don't wait
    }

    console.log(
      `[AcousticDetector] ${enabled
        ? 'Enabled — resuming crash sound monitoring'
        : 'Disabled — mic released for voice input (SOS active)'}`
    );
  }

  // ── Activation ────────────────────────────────────────────────────────────

  /**
   * Start acoustic monitoring.
   * Returns false silently if disabled, no permission, or mic is busy.
   */
  async activate(): Promise<boolean> {
    if (this.isActive) return true;

    // Guard 1: SOS is active — mic belongs to PostSOSVoice
    if (!this.isEnabled) return false;

    // Guard 2: Permission denied (cached from startup check)
    if (!this.micPermissionGranted) return false;

    // Guard 3: Permission not checked yet — do it now
    if (!this.permissionChecked) {
      await this.checkPermission();
      if (!this.micPermissionGranted) return false;
    }

    // Guard 4: Acquire mic via session manager
    const granted = await audioSessionManager.acquire('AcousticDetector');
    if (!granted) return false; // WhisperSTT has the mic — skip silently

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.isActive = true;
      this._startSampling();

      console.log('[AcousticDetector] Activated — monitoring for crash sounds');
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      if (
        errMsg.toLowerCase().includes('permission')
      ) {
        // Permanently cache — stop all future attempts
        this.micPermissionGranted = false;
        console.warn(
          '[AcousticDetector] Mic permission denied at recording time — ' +
          'disabling acoustic detection permanently for this session.'
        );
      } else {
        console.error('[AcousticDetector] Recording error:', err);
      }

      audioSessionManager.release('AcousticDetector');
      return false;
    }
  }

  async deactivate(): Promise<void> {
    this.isActive = false;
    this._stopSampling();

    if (this.recording) {
      try {
        const status = await this.recording.getStatusAsync();
        if (status.isRecording) {
          await this.recording.stopAndUnloadAsync();
        }
      } catch {
        // Already stopped
      } finally {
        this.recording = null;
      }
    }

    audioSessionManager.release('AcousticDetector');
  }

  // ── Sampling ──────────────────────────────────────────────────────────────

  private _startSampling(): void {
    this._stopSampling();

    this.sampleInterval = setInterval(async () => {
      if (!this.recording || !this.isActive) return;

      try {
        const status = await this.recording.getStatusAsync();
        if (!status.isRecording) return;

        const metering = status.metering ?? -60;
        const normalized = Math.max(0, Math.min(1, (metering + 60) / 60));
        const result = this._classifyAmplitude(normalized);
        this.latestScore = result.score;
        if (this.onScore) this.onScore(result);
      } catch {
        // Recording revoked — ignore
      }
    }, SAMPLE_INTERVAL_MS);
  }

  private _stopSampling(): void {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }
  }

  private _classifyAmplitude(normalizedLevel: number): AcousticScore {
    return {
      score: normalizedLevel,
      triggered: normalizedLevel >= CRASH_AMPLITUDE_THRESHOLD,
    };
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get active(): boolean { return this.isActive; }

  getScore(): number { return this.latestScore; }

  /** True only when mic is physically available AND we're not in SOS mode */
  isMicrophoneAvailable(): boolean {
    return this.micPermissionGranted && this.isEnabled;
  }

  reset(): void { this.latestScore = 0; }
}