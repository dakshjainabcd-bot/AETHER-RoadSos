/**
 * MultilingualBridgeManager — Central coordinator for all multilingual services
 *
 * Phase 5 rewrite: Uses the new WhisperSTTService backed by OpenAI Whisper API
 * (same model as https://github.com/openai/whisper — whisper-1 = large-v2)
 *
 * Architecture:
 *   whisperSTT  → records audio → POST to OpenAI → returns transcript
 *   translationService → caches + translates between languages
 *   textToSpeech → speaks text aloud via expo-speech
 */

import { whisperSTT, WhisperResult } from './WhisperSTT';
import { translationService } from './TranslationService';
import { textToSpeech } from './TextToSpeech';
import {
  SupportedLanguageCode,
  EMERGENCY_PHRASES,
  MultilingualBridgeStatus,
  TranslationResult,
} from './Types';

// ── Voice command trigger phrases ─────────────────────────────────────────────
// If the transcript contains any of these, it's treated as an SOS voice command
const TRIGGER_PHRASES = [
  'aether help',
  'help me',
  'emergency',
  'sos',
  'bachao',        // Hindi: "save me"
  'madad karo',    // Hindi: "help me"
  'sahayam',       // Tamil: "help"
  'sahayya',       // Malayalam: "help"
];

export interface VoiceCommandResult {
  transcript: string;
  language: SupportedLanguageCode;
  isTriggerPhrase: boolean;
  isOffline: boolean;
  errorReason?: string;
}

class MultilingualBridgeManager {
  private currentLanguage: SupportedLanguageCode = 'en';
  private isReady = false;

  /**
   * Initialize all multilingual services.
   * Call once at app startup from _layout.tsx.
   */
  async initialize(language: SupportedLanguageCode = 'en'): Promise<void> {
    if (this.isReady) return;

    this.currentLanguage = language;
    console.log('[MultilingualBridge] Initializing...');

    // Initialize services in parallel — faster startup
    await Promise.all([
      whisperSTT.initialize(),          // request mic permission early
      translationService.initialize(),  // load cached translations
      textToSpeech.initialize(),        // enumerate available voices
    ]);

    this.isReady = true;
    console.log('[MultilingualBridge] ✅ All services ready');
  }

  // ──────────────────────────────────────────────────────────
  // SPEECH-TO-TEXT (Whisper)
  // ──────────────────────────────────────────────────────────

  /**
   * Start recording the user's voice.
   * Call stopVoiceRecording() to get the transcript.
   */
  async recordVoiceCommand(): Promise<void> {
    await whisperSTT.startRecording(30_000);
  }

  /**
   * Stop recording and transcribe using OpenAI Whisper API.
   *
   * Automatically detects language — no language hint needed.
   * Checks transcript for trigger phrases (SOS activation).
   */
  async stopVoiceRecording(): Promise<VoiceCommandResult> {
    const result: WhisperResult = await whisperSTT.stopAndTranscribe(
      this.currentLanguage !== 'en' ? this.currentLanguage : undefined
    );

    const isTriggerPhrase = TRIGGER_PHRASES.some((phrase) =>
      result.text.toLowerCase().includes(phrase.toLowerCase())
    );

    return {
      transcript: result.text,
      language: (result.language as SupportedLanguageCode) ?? this.currentLanguage,
      isTriggerPhrase,
      isOffline: result.isOffline,
      errorReason: result.errorReason,
    };
  }

  /**
   * Check whether the mic is currently recording.
   */
  get isRecording(): boolean {
    return whisperSTT.isRecording;
  }

  /**
   * Cancel an active recording without transcribing.
   */
  async cancelRecording(): Promise<void> {
    await whisperSTT.cancel();
  }

  // ──────────────────────────────────────────────────────────
  // TRANSLATION
  // ──────────────────────────────────────────────────────────

  /** Translate text between languages */
  async translateText(
    text: string,
    sourceLang: SupportedLanguageCode,
    targetLang: SupportedLanguageCode
  ): Promise<TranslationResult> {
    return translationService.translate({ text, sourceLang, targetLang });
  }

  // ──────────────────────────────────────────────────────────
  // TEXT-TO-SPEECH
  // ──────────────────────────────────────────────────────────

  /** Speak text aloud in the given language */
  async speakText(
    text: string,
    language: SupportedLanguageCode,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  ): Promise<void> {
    await textToSpeech.speak({ text, language, priority });
  }

  /** Speak a pre-translated emergency phrase in the current language */
  async announceEmergencyPhrase(
    phraseKey: keyof typeof EMERGENCY_PHRASES
  ): Promise<void> {
    const text = translationService.getEmergencyPhrase(phraseKey, this.currentLanguage);
    await textToSpeech.speak({ text, language: this.currentLanguage, priority: 'urgent' });
  }

  // ──────────────────────────────────────────────────────────
  // CONFIGURATION
  // ──────────────────────────────────────────────────────────

  setLanguage(language: SupportedLanguageCode): void {
    this.currentLanguage = language;
  }

  getStatus(): MultilingualBridgeStatus {
    return {
      sttReady: this.isReady,
      translationReady: this.isReady,
      ttsReady: this.isReady,
      currentLanguage: this.currentLanguage,
      cacheSize: translationService.getCacheStats().size,
    };
  }
}

// Singleton instance
export const multilingualBridge = new MultilingualBridgeManager();