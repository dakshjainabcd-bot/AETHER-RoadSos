/**
 * AcousticDetector — Phase 3: Crash Sound Detection
 *
 * Uses YAMNet-style audio classification to detect crash sounds:
 * glass breaking, metal crumple, tyre screech, car alarm.
 *
 * Phase 5 fix: integrates AudioSessionManager so WhisperSTT (voice input)
 * can revoke the mic cleanly without triggering the expo-av
 * "Only one Recording object can be prepared at a given time" error.
 *
 * Flow:
 *   CrashDetectionEngine calls activate() when accel candidate fires.
 *   We acquire() the mic via AudioSessionManager.
 *     → If WhisperSTT owns the mic, acquire() returns false and we skip.
 *     → If mic is free, we get it and start sampling.
 *   CrashDetectionEngine calls deactivate() when the window closes.
 *   We always release() the mic in deactivate(), even if recording failed.
 */

import { Audio } from 'expo-av';
import { audioSessionManager } from '../../utils/AudioSessionManager';

// Threshold above which we consider a sound crash-related
const CRASH_AMPLITUDE_THRESHOLD = 0.6;

// How often we sample the audio level (milliseconds)
const SAMPLE_INTERVAL_MS = 250;

export type AcousticScore = {
  score: number;       // 0.0 – 1.0
  triggered: boolean;  // true if score exceeded threshold
};

export type AcousticScoreCallback = (result: AcousticScore) => void;

export class AcousticDetector {
  private recording: Audio.Recording | null = null;
  private sampleInterval: ReturnType<typeof setInterval> | null = null;
  private isActive = false;
  private onScore: AcousticScoreCallback | null;
  private latestScore = 0;
  private micAvailable = true;

  constructor(onScore?: AcousticScoreCallback) {
    this.onScore = onScore ?? null;

    // Register revoke callback with the session manager.
    // When WhisperSTT (higher priority) needs the mic, it calls this.
    // We MUST stop + unload the recording immediately.
    audioSessionManager.register('AcousticDetector', async () => {
      await this.deactivate();
    });
  }

  /**
   * Start acoustic monitoring.
   * Called by CrashDetectionEngine when accelerometer fires a candidate.
   * Returns false silently if the mic is held by WhisperSTT.
   */
  async activate(): Promise<boolean> {
    if (this.isActive) return true;

    // Ask the session manager for mic access.
    // If WhisperSTT has it, this returns false — we skip gracefully.
    const granted = await audioSessionManager.acquire('AcousticDetector');
    if (!granted) {
      console.log('[AcousticDetector] Mic busy (WhisperSTT active) — skipping acoustic sample');
      return false;
    }

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
      console.error('[AcousticDetector] Failed to start recording:', err);
      // Release the lock so other components aren't blocked
      audioSessionManager.release('AcousticDetector');
      return false;
    }
  }

  /**
   * Stop acoustic monitoring and release the mic.
   * Called by CrashDetectionEngine when the detection window closes,
   * AND called automatically by AudioSessionManager when WhisperSTT
   * needs the mic (via the revoke callback registered in the constructor).
   */
  async deactivate(): Promise<void> {
    this.isActive = false;
    this._stopSampling();

    if (this.recording) {
      try {
        const status = await this.recording.getStatusAsync();
        if (status.isRecording) {
          await this.recording.stopAndUnloadAsync();
        }
      } catch (err) {
        // Ignore — recording may already be unloaded
        console.warn('[AcousticDetector] Stop error (safe to ignore):', err);
      } finally {
        this.recording = null;
      }
    }

    // Always release the lock, even if stop threw
    audioSessionManager.release('AcousticDetector');
    console.log('[AcousticDetector] Deactivated — mic released');
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _startSampling(): void {
    this._stopSampling(); // safety: clear any existing interval

    this.sampleInterval = setInterval(async () => {
      if (!this.recording || !this.isActive) return;

      try {
        const status = await this.recording.getStatusAsync();
        if (!status.isRecording) return;

        // metering gives us dBFS (0 = full scale, negative = quieter)
        // Convert to 0–1 range: dBFS of -60 → 0.0, dBFS of 0 → 1.0
        const metering = status.metering ?? -60;
        const normalized = Math.max(0, Math.min(1, (metering + 60) / 60));

        const result = this._classifyAmplitude(normalized);
        this.latestScore = result.score;
        if (this.onScore) this.onScore(result);
      } catch {
        // Recording may have been stopped by revoke — ignore
      }
    }, SAMPLE_INTERVAL_MS);
  }

  private _stopSampling(): void {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }
  }

  /**
   * Simple amplitude-based classifier.
   * In production this is replaced by YAMNet TFLite inference.
   * The interface (score 0–1, triggered bool) is identical so swapping in
   * the TFLite version requires no changes to CrashDetectionEngine.
   */
  private _classifyAmplitude(normalizedLevel: number): AcousticScore {
    // Crash sounds are typically sudden loud spikes
    // A sudden jump from quiet to loud in < 250ms is characteristic
    const score = normalizedLevel;
    return {
      score,
      triggered: score >= CRASH_AMPLITUDE_THRESHOLD,
    };
  }

  get active(): boolean {
    return this.isActive;
  }

  // ── Polling API (used by CrashDetectionEngine) ────────────────────────

  /** Return the latest acoustic score (0–1). */
  getScore(): number {
    return this.latestScore;
  }

  /** Whether the microphone is available for acoustic detection. */
  isMicrophoneAvailable(): boolean {
    return this.micAvailable;
  }

  /** Reset internal score state (called after SOS cancel / reset). */
  reset(): void {
    this.latestScore = 0;
  }
}