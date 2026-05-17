/**
 * WhisperSTT — Speech-to-Text via OpenAI Whisper API
 * =====================================================
 * Uses the official OpenAI Whisper API, which runs the same model
 * as the open-source repo: https://github.com/openai/whisper
 *
 * Model: whisper-1  (equivalent to large-v2 on the server)
 * Supports: 99 languages — Hindi, Tamil, Telugu, Kannada, Malayalam,
 *           Bengali, Gujarati, Punjabi, Marathi and many more.
 *
 * WHY API INSTEAD OF ON-DEVICE?
 * The Python Whisper "large" model is 1.5 GB — too large for a phone.
 * The API gives us the same model with zero download, zero battery drain,
 * and better accuracy than "tiny" or "base" on-device models.
 *
 * FLOW:
 *   1. User presses mic button → startRecording()
 *   2. expo-av records audio to a temp .m4a file
 *   3. Silence detection auto-stops after 2.5s of quiet
 *   4. stopAndTranscribe() → POST to api.openai.com/v1/audio/transcriptions
 *   5. Whisper returns text + detected language
 *   6. Temp file deleted, result returned to UI
 *
 * COST: ~$0.006 per minute of audio — extremely cheap for an emergency app.
 * GET YOUR KEY: https://platform.openai.com/api-keys (free tier available)
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { OPENAI_API_KEY } from '../../utils/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export type STTState = 'idle' | 'recording' | 'transcribing';

export interface WhisperResult {
  /** The transcribed text. Empty string on failure. */
  text: string;
  /** BCP-47 language code detected by Whisper (e.g. 'hi', 'ta', 'en') */
  language: string;
  /** 0.0–1.0 confidence estimate */
  confidence: number;
  /** true if transcription failed and we fell back gracefully */
  isOffline: boolean;
  /** Error message if isOffline is true */
  errorReason?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** OpenAI Whisper API endpoint */
const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

/** Whisper model — 'whisper-1' is large-v2 on the server */
const WHISPER_MODEL = 'whisper-1';

/** Maximum recording duration before auto-stop */
const MAX_RECORD_MS = 30_000; // 30 seconds

/** dBFS below which we consider the user silent (speaking ≈ -20 to -10) */
const SILENCE_THRESHOLD_DBFS = -40;

/** How long silence must last before auto-stopping */
const SILENCE_DURATION_MS = 2_500; // 2.5 seconds

/** How often expo-av fires metering updates */
const METER_INTERVAL_MS = 200;

/** API request timeout */
const API_TIMEOUT_MS = 30_000; // 30 seconds

// ─── Service class ────────────────────────────────────────────────────────────

class WhisperSTTService {
  private recording: Audio.Recording | null = null;
  private state: STTState = 'idle';

  // Callbacks
  private onStateChangeCb?: (state: STTState) => void;
  private onResultCb?: (result: WhisperResult) => void;
  private onErrorCb?: (error: Error) => void;

  // Timers
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Public configuration ──────────────────────────────────────────────────

  /** Register callback for state changes (idle → recording → transcribing → idle) */
  onStateChange(cb: (state: STTState) => void): void {
    this.onStateChangeCb = cb;
  }

  /** Register callback for transcription results */
  onResult(cb: (result: WhisperResult) => void): void {
    this.onResultCb = cb;
  }

  /** Register callback for hard errors (mic permission denied, etc.) */
  onError(cb: (error: Error) => void): void {
    this.onErrorCb = cb;
  }

  /** Initialize — request microphone permission. Call once at app startup. */
  async initialize(): Promise<void> {
    // Permission is requested lazily in startRecording(),
    // but calling this early gives a better UX.
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      console.warn('[WhisperSTT] Microphone permission not granted during init');
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Is the service currently recording? */
  get isRecording(): boolean {
    return this.state === 'recording';
  }

  /** Current state of the STT pipeline */
  getState(): STTState {
    return this.state;
  }

  /**
   * Start recording the user's voice.
   *
   * @param maxDurationMs  Auto-stop after this many ms (default 30 000)
   * @returns true if recording started, false if already recording or no mic
   */
  async startRecording(maxDurationMs = MAX_RECORD_MS): Promise<boolean> {
    if (this.state !== 'idle') {
      console.warn('[WhisperSTT] startRecording() called while state =', this.state);
      return false;
    }

    try {
      // ── 1. Request mic permission ────────────────────────────────────────
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        const err = new Error('Microphone permission denied');
        this.onErrorCb?.(err);
        return false;
      }

      // ── 2. Configure iOS audio session ───────────────────────────────────
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // ── 3. Create recording with metering enabled ────────────────────────
      // HIGH_QUALITY preset = AAC codec, 44.1 kHz, stereo → .m4a
      // Whisper accepts .m4a natively.
      const { recording } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true, // REQUIRED for silence detection
        },
        this.handleStatusUpdate.bind(this),
        METER_INTERVAL_MS
      );

      this.recording = recording;
      this.setState('recording');
      console.log('[WhisperSTT] ✅ Recording started');

      // ── 4. Auto-stop after max duration ─────────────────────────────────
      this.maxDurationTimer = setTimeout(() => {
        if (this.state === 'recording') {
          console.log('[WhisperSTT] Max duration reached — auto-stopping');
          this.stopAndTranscribe();
        }
      }, maxDurationMs);

      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[WhisperSTT] Failed to start recording:', err.message);
      await this.resetAudioMode();
      this.setState('idle');
      this.onErrorCb?.(err);
      return false;
    }
  }

  /**
   * Stop recording and transcribe via Whisper API.
   * Safe to call even if not recording (returns empty offline result).
   *
   * @param language  Optional BCP-47 hint (e.g. 'hi', 'ta', 'en').
   *                  Omit to let Whisper auto-detect (slower but works).
   */
  async stopAndTranscribe(language?: string): Promise<WhisperResult> {
    this.clearTimers();

    if (this.state !== 'recording' || !this.recording) {
      console.warn('[WhisperSTT] stopAndTranscribe() called but not recording');
      return this.makeOfflineResult('Not recording');
    }

    // Move to transcribing state immediately so UI can react
    this.setState('transcribing');

    let audioUri: string | null = null;

    try {
      // ── Stop and unload recording ────────────────────────────────────────
      await this.recording.stopAndUnloadAsync();
      audioUri = this.recording.getURI() ?? null;
    } catch (stopError) {
      console.error('[WhisperSTT] Error stopping recording:', stopError);
    } finally {
      this.recording = null;
      await this.resetAudioMode();
    }

    if (!audioUri) {
      this.setState('idle');
      return this.makeOfflineResult('No audio file produced');
    }

    console.log('[WhisperSTT] Audio saved to:', audioUri);

    // ── Send to Whisper API ──────────────────────────────────────────────
    const result = await this.callWhisperAPI(audioUri, language);

    // ── Clean up temp file ───────────────────────────────────────────────
    await FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(() => {});

    this.setState('idle');
    this.onResultCb?.(result);

    console.log(
      `[WhisperSTT] Result: "${result.text.substring(0, 60)}"`,
      `| lang: ${result.language}`,
      `| offline: ${result.isOffline}`
    );

    return result;
  }

  /**
   * Alias for compatibility with MultilingualBridgeManager.
   * Calls stopAndTranscribe() and returns {text, language}.
   */
  async stopRecording(language?: string): Promise<{ text: string; language: string }> {
    const result = await this.stopAndTranscribe(language);
    return { text: result.text, language: result.language };
  }

  /**
   * Cancel recording without transcribing.
   */
  async cancel(): Promise<void> {
    this.clearTimers();

    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch { /* ignore */ }

      const uri = this.recording.getURI();
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
      this.recording = null;
    }

    await this.resetAudioMode();
    this.setState('idle');
    console.log('[WhisperSTT] Recording cancelled');
  }

  // ── Private: silence detection ────────────────────────────────────────────

  /**
   * Called by expo-av every METER_INTERVAL_MS while recording.
   * Uses metering (dBFS) to detect silence and auto-stop.
   */
  private handleStatusUpdate(status: Audio.RecordingStatus): void {
    if (!status.isRecording) return;

    // status.metering is dBFS when isMeteringEnabled = true
    // 0 dBFS = maximum volume, -160 dBFS = silence
    const dbfs = status.metering ?? -160;
    const isSilent = dbfs < SILENCE_THRESHOLD_DBFS;

    if (isSilent) {
      // Start silence timer if not already running
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          if (this.state === 'recording') {
            console.log(`[WhisperSTT] Silence detected (${dbfs.toFixed(1)} dBFS) — auto-stopping`);
            this.stopAndTranscribe();
          }
        }, SILENCE_DURATION_MS);
      }
    } else {
      // User is speaking — reset silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    }
  }

  // ── Private: Whisper API call ─────────────────────────────────────────────

  /**
   * POST audio file to OpenAI Whisper API.
   *
   * The API accepts multipart/form-data with:
   *   - file:     audio file (.m4a, .mp3, .wav, .webm, .mp4)
   *   - model:    'whisper-1'
   *   - language: optional BCP-47 code for better speed/accuracy
   *   - response_format: 'verbose_json' → includes language + segments
   */
  private async callWhisperAPI(audioUri: string, language?: string): Promise<WhisperResult> {
    // ── Validate API key ─────────────────────────────────────────────────
    if (!OPENAI_API_KEY || OPENAI_API_KEY.startsWith('YOUR_')) {
      console.warn('[WhisperSTT] OPENAI_API_KEY not configured in utils/constants.ts');
      return this.makeOfflineResult('OpenAI API key not configured');
    }

    try {
      // ── Build multipart form data ────────────────────────────────────────
      // React Native fetch supports FormData with file objects
      const formData = new FormData();

      // The audio file — name must have correct extension
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'voice.m4a',
      } as unknown as Blob);

      // Whisper model name (whisper-1 = large-v2 on OpenAI servers)
      formData.append('model', WHISPER_MODEL);

      // Language hint — dramatically improves accuracy and speed
      // Whisper language codes match BCP-47 (hi, ta, te, kn, ml, etc.)
      if (language && language !== 'auto' && language !== 'en') {
        formData.append('language', this.toWhisperLang(language));
      }

      // verbose_json gives us: text, language, segments with confidence
      formData.append('response_format', 'verbose_json');

      // ── Make API request with timeout ────────────────────────────────────
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      console.log('[WhisperSTT] Calling Whisper API...');

      const response = await fetch(WHISPER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          // Do NOT set Content-Type — fetch sets it automatically
          // with the correct multipart boundary
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // ── Handle non-OK responses ──────────────────────────────────────────
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error('[WhisperSTT] API error:', response.status, errorBody);

        if (response.status === 401) {
          return this.makeOfflineResult('Invalid OpenAI API key');
        }
        if (response.status === 429) {
          return this.makeOfflineResult('Rate limit exceeded — try again shortly');
        }
        return this.makeOfflineResult(`API error ${response.status}`);
      }

      // ── Parse response ───────────────────────────────────────────────────
      const data = await response.json();

      const text = (data.text ?? '').trim();
      const detectedLang = data.language ?? language ?? 'en';
      const confidence = this.calculateConfidence(data);

      return {
        text,
        language: detectedLang,
        confidence,
        isOffline: false,
      };
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string };

      if (err.name === 'AbortError') {
        console.warn('[WhisperSTT] API request timed out after', API_TIMEOUT_MS / 1000, 's');
        return this.makeOfflineResult('Request timed out — check your internet connection');
      }

      console.error('[WhisperSTT] Network error:', err.message ?? error);
      return this.makeOfflineResult(
        err.message ?? 'Network error — check your internet connection'
      );
    }
  }

  // ── Private: helpers ──────────────────────────────────────────────────────

  /**
   * Calculate confidence from Whisper's verbose_json response.
   *
   * Each segment has avg_logprob (log probability, ≤ 0).
   * We convert: confidence ≈ exp(avg_logprob) clamped to [0, 1]
   * A logprob of 0 = 100% confidence, -1 ≈ 37%, -3 ≈ 5%
   */
  private calculateConfidence(data: {
    segments?: Array<{ avg_logprob?: number }>;
    text?: string;
  }): number {
    if (data.segments && data.segments.length > 0) {
      const validSegments = data.segments.filter(
        (s) => typeof s.avg_logprob === 'number'
      );
      if (validSegments.length > 0) {
        const avgLogProb =
          validSegments.reduce((sum, s) => sum + (s.avg_logprob ?? -1), 0) /
          validSegments.length;
        // Convert log prob to 0-1 confidence
        return Math.min(1, Math.max(0, Math.exp(avgLogProb)));
      }
    }
    // Fallback: if we got text, assume decent confidence
    return data.text ? 0.85 : 0;
  }

  /**
   * Map our app's language codes to Whisper's expected codes.
   * Whisper uses ISO 639-1 codes — most already match.
   */
  private toWhisperLang(code: string): string {
    const map: Record<string, string> = {
      // Our code  → Whisper code (most are identical)
      en: 'en',
      hi: 'hi',
      ta: 'ta',
      te: 'te',
      kn: 'kn',
      ml: 'ml',
      mr: 'mr',
      bn: 'bn',
      gu: 'gu',
      pa: 'pa',
      ur: 'ur',
      ne: 'ne',
      si: 'si',
      my: 'my',
      th: 'th',
      fr: 'fr',
      ar: 'ar',
      zh: 'zh',
      es: 'es',
      pt: 'pt',
    };
    return map[code] ?? code;
  }

  private makeOfflineResult(reason: string): WhisperResult {
    return {
      text: '',
      language: 'en',
      confidence: 0,
      isOffline: true,
      errorReason: reason,
    };
  }

  private setState(newState: STTState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.onStateChangeCb?.(newState);
  }

  private clearTimers(): void {
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
   * Reset iOS audio session after recording.
   * CRITICAL: Without this, audio playback (TTS, CPR voice) won't work at full volume.
   */
  private async resetAudioMode(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch { /* non-critical */ }
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────
// One instance shared across the entire app.
export const whisperSTT = new WhisperSTTService();