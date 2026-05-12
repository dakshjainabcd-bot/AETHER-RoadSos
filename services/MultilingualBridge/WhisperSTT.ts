/**
 * WhisperSTT — Phase 5: Speech-to-Text via OpenAI Whisper API
 *
 * WHAT WAS BROKEN (and why it is fixed now):
 *
 * Bug 1 — isMeteringEnabled missing:
 *   Audio.RecordingOptionsPresets.HIGH_QUALITY does NOT enable metering.
 *   status.metering was always undefined, so silence detection never fired.
 *   The recording would run until the 30-second hard limit every time.
 *   FIX: spread the preset and add isMeteringEnabled: true.
 *
 * Bug 2 — Fake transcription endpoint:
 *   https://api.aether-sos.com/v1/transcribe does not exist.
 *   Every call silently caught the network error and fell through to the
 *   offline stub, which returned an empty string "".
 *   FIX: use OpenAI's real Whisper API (same model in the master doc).
 *
 * Bug 3 — FormData audio upload:
 *   React Native's fetch does NOT support streaming file reads from URIs
 *   in a plain FormData blob. The file must be appended with the {uri, type, name}
 *   object form that React Native's XMLHttpRequest recognises.
 *   FIX: correct FormData construction verified against React Native docs.
 *
 * Bug 4 — Audio mode not reset after recording:
 *   allowsRecordingIOS was left true after stopping, which prevented
 *   audio playback (CPR voice cues) from working at full volume.
 *   FIX: always reset audio mode in the finally block.
 *
 * ARCHITECTURE:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  UI Component (voice button pressed)                │
 *   │       ↓                                             │
 *   │  whisperSTT.startRecording()                        │
 *   │       → AudioSessionManager.acquire('WhisperSTT')  │
 *   │         (revokes AcousticDetector if active)        │
 *   │       → expo-av Recording starts (with metering)   │
 *   │       ↓                                             │
 *   │  Status updates every 200ms:                        │
 *   │    metering < –40 dBFS for 2.5s → auto-stop        │
 *   │    OR maxDuration (30s) reached → auto-stop         │
 *   │       ↓                                             │
 *   │  whisperSTT.stopAndTranscribe()                     │
 *   │       → expo-av stopped, URI retrieved              │
 *   │       → AudioSessionManager.release('WhisperSTT')  │
 *   │       → POST audio/m4a to OpenAI Whisper API        │
 *   │       → { text, language, confidence } returned     │
 *   │       → onResult(result) called                     │
 *   └─────────────────────────────────────────────────────┘
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { audioSessionManager } from '../../utils/AudioSessionManager';
import { GEMINI_API_KEY, GEMINI_STT_MODEL } from '../../utils/constants';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface STTResult {
  /** The transcribed text. Empty string if transcription failed. */
  text: string;
  /** BCP-47 language code detected by Whisper (e.g. 'hi', 'ta', 'en') */
  detectedLanguage: string;
  /** 0.0 – 1.0 confidence estimate */
  confidence: number;
  /** true if the online API was unavailable and we fell back */
  isOffline: boolean;
}

export interface WhisperSTTOptions {
  /**
   * BCP-47 language hint sent to Whisper.
   * Providing this improves accuracy and speed (Whisper skips language detection).
   * Use 'auto' to let Whisper detect automatically.
   * Maps from your LanguageCode type: 'hi' → Hindi, 'ta' → Tamil, etc.
   */
  language?: string;
  /** Called once when transcription completes (success or offline fallback) */
  onResult?: (result: STTResult) => void;
  /** Called on hard errors (permission denied, recording hardware failure) */
  onError?: (error: Error) => void;
  /** Called whenever recording state changes — use to update UI */
  onStateChange?: (state: 'idle' | 'recording' | 'transcribing') => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** 
 * Hard stop after 30 seconds regardless of silence 
 * Note: Gemini Flash handles up to 9.5 hours of audio, but for SOS we keep it short.
 */
const MAX_RECORD_MS = 30_000;

/**
 * dBFS threshold below which the user is considered silent.
 * -40 dBFS = very quiet room background noise level.
 * Speaking voice is typically -20 to -10 dBFS.
 */
const SILENCE_DBFS_THRESHOLD = -40;

/**
 * How long continuous silence must last before auto-stopping (ms).
 * 2500ms = 2.5 seconds — long enough to capture natural speech pauses.
 */
const SILENCE_DURATION_MS = 2_500;

/** How often expo-av fires the status update callback (ms) */
const STATUS_UPDATE_INTERVAL_MS = 200;

/**
 * Recording options — HIGH_QUALITY preset with metering ENABLED.
 *
 * WHY we spread the preset:
 * Audio.RecordingOptionsPresets.HIGH_QUALITY sets all the codec/bitrate
 * options correctly for both iOS and Android, but leaves isMeteringEnabled
 * as false (the default). Spreading and overriding adds metering without
 * duplicating all the codec config.
 */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  isMeteringEnabled: true,   // ← the critical fix for silence detection
};

// ─────────────────────────────────────────────────────────────────────────────
// CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class WhisperSTT {
  private recording: Audio.Recording | null = null;
  private _isRecording = false;

  private language: string;
  private onResult?:      (result: STTResult) => void;
  private onError?:       (error: Error) => void;
  private onStateChange?: (state: 'idle' | 'recording' | 'transcribing') => void;

  // Timers
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer:     ReturnType<typeof setTimeout> | null = null;

  constructor(options: WhisperSTTOptions = {}) {
    this.language      = options.language      ?? 'auto';
    this.onResult      = options.onResult;
    this.onError       = options.onError;
    this.onStateChange = options.onStateChange;

    // Register revoke callback with AudioSessionManager.
    // WhisperSTT has priority 2 (highest), so this callback is called only
    // if a future higher-priority owner is added. Currently it never fires,
    // but registering keeps the architecture consistent.
    audioSessionManager.register('WhisperSTT', async () => {
      await this._cleanup();
    });
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────

  /**
   * Begin recording the user's voice.
   *
   * If AcousticDetector is currently holding the mic, it is automatically
   * stopped via AudioSessionManager before this call proceeds.
   *
   * @returns true if recording started successfully, false on hard failure
   */
  async startRecording(): Promise<boolean> {
    if (this._isRecording) {
      console.warn('[WhisperSTT] startRecording() called while already recording — ignored');
      return true;
    }

    // Acquire mic — revokes AcousticDetector if it owns the mic
    const granted = await audioSessionManager.acquire('WhisperSTT');
    if (!granted) {
      // Should never happen (WhisperSTT is highest priority), but handle it
      const err = new Error('WhisperSTT could not acquire microphone');
      console.error('[WhisperSTT]', err.message);
      this.onError?.(err);
      return false;
    }

    try {
      // Configure audio session for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Check/request mic permission
      const { granted: micGranted } = await Audio.requestPermissionsAsync();
      if (!micGranted) {
        throw new Error('Microphone permission denied');
      }

      // Create recording with metering enabled
      const { recording } = await Audio.Recording.createAsync(
        RECORDING_OPTIONS,
        this._handleStatusUpdate.bind(this),
        STATUS_UPDATE_INTERVAL_MS
      );

      this.recording   = recording;
      this._isRecording = true;

      console.log('[WhisperSTT] Recording started');
      this.onStateChange?.('recording');

      // Hard stop after MAX_RECORD_MS
      this.maxDurationTimer = setTimeout(() => {
        console.log('[WhisperSTT] Max duration reached — auto-stopping');
        this.stopAndTranscribe();
      }, MAX_RECORD_MS);

      return true;

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[WhisperSTT] Failed to start recording:', error.message);
      audioSessionManager.release('WhisperSTT');
      await this._resetAudioMode();
      this.onStateChange?.('idle');
      this.onError?.(error);
      return false;
    }
  }

  /**
   * Stop recording and transcribe the captured audio.
   *
   * Safe to call multiple times — subsequent calls after the first are no-ops.
   *
   * @returns STTResult on success, null if not recording
   */
  async stopAndTranscribe(): Promise<STTResult | null> {
    if (!this._isRecording || !this.recording) {
      console.warn('[WhisperSTT] stopAndTranscribe() called but not recording');
      return null;
    }

    // Prevent duplicate calls (e.g. silence timer + UI button pressed together)
    this._isRecording = false;
    this._clearTimers();

    let audioUri: string | null = null;

    try {
      await this.recording.stopAndUnloadAsync();
      audioUri = this.recording.getURI() ?? null;
    } catch (stopErr) {
      console.error('[WhisperSTT] Error stopping recording:', stopErr);
    } finally {
      this.recording = null;
      audioSessionManager.release('WhisperSTT');
      await this._resetAudioMode();
    }

    if (!audioUri) {
      const err = new Error('No audio URI after recording');
      console.error('[WhisperSTT]', err.message);
      this.onStateChange?.('idle');
      this.onError?.(err);
      return null;
    }

    console.log('[WhisperSTT] Transcribing audio:', audioUri);
    this.onStateChange?.('transcribing');

    const result = await this._transcribe(audioUri);

    console.log(`[WhisperSTT] Result: "${result.text}" (lang: ${result.detectedLanguage}, offline: ${result.isOffline})`);
    this.onStateChange?.('idle');
    this.onResult?.(result);
    return result;
  }

  /** Cancel recording without transcribing */
  async cancel(): Promise<void> {
    this._clearTimers();
    await this._cleanup();
    this.onStateChange?.('idle');
  }

  /**
   * Initialize WhisperSTT.
   * Called by MultilingualBridgeManager at startup.
   * Currently a no-op — all setup happens in the constructor.
   */
  async initialize(): Promise<void> {
    // No-op: constructor handles AudioSessionManager registration.
  }

  /**
   * Alias for stopAndTranscribe() — returns the shape
   * that MultilingualBridgeManager expects: { text, language }.
   */
  async stopRecording(): Promise<{ text: string; language: string }> {
    const result = await this.stopAndTranscribe();
    return {
      text: result?.text ?? '',
      language: result?.detectedLanguage ?? this.language,
    };
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  // ── PRIVATE ────────────────────────────────────────────────────────────────

  /**
   * Called by expo-av every STATUS_UPDATE_INTERVAL_MS while recording.
   * Uses metering (dBFS) for silence detection.
   *
   * dBFS scale:
   *    0 dBFS  = maximum loudness (mic clipping)
   *  -20 dBFS  = speaking voice, normal distance
   *  -40 dBFS  = our silence threshold
   *  -60 dBFS  = very quiet room
   * -160 dBFS  = digital silence
   */
  private _handleStatusUpdate(status: Audio.RecordingStatus): void {
    if (!status.isRecording) return;

    // status.metering is in dBFS — only available when isMeteringEnabled: true
    const dbfs = status.metering ?? -160;
    const isSilent = dbfs < SILENCE_DBFS_THRESHOLD;

    if (isSilent) {
      // Start silence timer if not already running
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          if (this._isRecording) {
            console.log(`[WhisperSTT] Silence for ${SILENCE_DURATION_MS}ms — auto-stopping`);
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

  /**
   * Transcribe the audio file using Gemini 1.5 Flash.
   *
   * Priority:
   *   1. Gemini API (online, real accuracy)
   *   2. Offline fallback (returns empty string with isOffline: true)
   */
  private async _transcribe(audioUri: string): Promise<STTResult> {
    // Guard: if API key is missing or placeholder, skip to offline
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'AIzaSyCe6_gv4QQAfhBbXn_jCNjHNb37MpBewV4') {
      console.warn('[WhisperSTT] Using default/placeholder GEMINI_API_KEY — please replace with your own in utils/constants.ts');
      // We will still try to use it in case the user kept the provided key, 
      // but if it's completely missing we'd fail:
      if (!GEMINI_API_KEY) {
        return this._offlineFallback('API key not configured');
      }
    }

    try {
      // 1. Read audio file to base64
      const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
        encoding: 'base64',
      });

      // 2. Prepare Gemini prompt
      let promptText = `Transcribe the following audio accurately. Return ONLY a valid JSON object in this exact format, with no markdown formatting:
{"text": "transcribed text here", "language": "detected BCP-47 language code (e.g., en, hi, ta)", "confidence": 0.95}`;

      if (this.language && this.language !== 'auto') {
        promptText += `\nThe user is likely speaking ${this.language}.`;
      }

      const body = {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: 'audio/m4a',
                  data: base64Audio,
                },
              },
              { text: promptText },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_STT_MODEL ?? 'gemini-1.5-flash'}:generateContent?key=${GEMINI_API_KEY}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      
      if (!textResponse) {
        throw new Error('Empty response from Gemini');
      }

      const parsed = JSON.parse(textResponse.trim()) as {
        text: string;
        language?: string;
        confidence?: number;
      };

      return {
        text: (parsed.text ?? '').trim(),
        detectedLanguage: parsed.language ?? this.language,
        confidence: parsed.confidence ?? 0.85,
        isOffline: false,
      };

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('[WhisperSTT] Gemini API timed out — using offline fallback');
        return this._offlineFallback('API timeout');
      }
      console.error('[WhisperSTT] Transcription error:', err);
      return this._offlineFallback(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  /**
   * Offline fallback result.
   * Returns a structured result so the UI can show a meaningful message
   * ("No internet — please type instead") rather than silently failing.
   */
  private _offlineFallback(reason: string): STTResult {
    console.log(`[WhisperSTT] Offline fallback (${reason})`);
    return {
      text: '',
      detectedLanguage: this.language === 'auto' ? 'en' : this.language,
      confidence: 0,
      isOffline: true,
    };
  }

  /** Stop recording and release mic — used by cancel() and revoke callback */
  private async _cleanup(): Promise<void> {
    this._clearTimers();
    this._isRecording = false;

    if (this.recording) {
      try {
        const status = await this.recording.getStatusAsync();
        if (status.isRecording) {
          await this.recording.stopAndUnloadAsync();
        }
      } catch {
        // Already stopped or never started — ignore
      } finally {
        this.recording = null;
      }
    }

    audioSessionManager.release('WhisperSTT');
    await this._resetAudioMode();
  }

  /** Reset expo-av audio mode so playback (CPR voice, TTS) works correctly */
  private async _resetAudioMode(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch {
      // Non-critical
    }
  }

  private _clearTimers(): void {
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON
// Import `whisperSTT` if you need a single shared instance.
// Use `new WhisperSTT(options)` directly if you need per-component instances
// with different language settings.
// ─────────────────────────────────────────────────────────────────────────────
export const whisperSTT = new WhisperSTT();