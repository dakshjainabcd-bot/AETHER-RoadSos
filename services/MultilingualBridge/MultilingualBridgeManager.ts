/**
 * MultilingualBridgeManager — Central coordinator for all multilingual services
 *
 * This is the single entry point used by the rest of the app.
 * It wires together STT, Translation, and TTS into one clean API.
 */

import { whisperSTT } from './WhisperSTT';
import { translationService } from './TranslationService';
import { textToSpeech } from './TextToSpeech';
import {
  SupportedLanguageCode,
  EMERGENCY_PHRASES,
  MultilingualBridgeStatus,
  TranslationResult,
} from './Types';

interface VoiceCommandResult {
  transcript: string;
  language: SupportedLanguageCode;
  isTriggerPhrase: boolean;
}

/** Phrases that trigger emergency SOS when detected */
const TRIGGER_PHRASES = ['aether help', 'help me', 'emergency', 'sos'];

class MultilingualBridgeManager {
  private currentLanguage: SupportedLanguageCode = 'en';
  private isReady = false;

  /**
   * Initialize all multilingual services.
   * Call once at app startup.
   */
  async initialize(language: SupportedLanguageCode = 'en'): Promise<void> {
    if (this.isReady) return;
    this.currentLanguage = language;

    console.log('[MultilingualBridge] Initializing...');

    // Initialize services in parallel for speed
    await Promise.all([
      whisperSTT.initialize(),
      translationService.initialize(),
      textToSpeech.initialize(),
    ]);

    this.isReady = true;
    console.log('[MultilingualBridge] ✅ All services ready');
  }

  // ──────────────────────────────────────────────
  // SPEECH-TO-TEXT
  // ──────────────────────────────────────────────

  /** Start recording a voice command */
  async recordVoiceCommand(): Promise<void> {
    await whisperSTT.startRecording();
  }

  /** Stop recording and return the transcription */
  async stopVoiceRecording(): Promise<VoiceCommandResult> {
    const result = await whisperSTT.stopRecording();

    const isTriggerPhrase = TRIGGER_PHRASES.some(phrase =>
      result.text.toLowerCase().includes(phrase)
    );

    return {
      transcript: result.text,
      language: result.language as SupportedLanguageCode,
      isTriggerPhrase,
    };
  }

  // ──────────────────────────────────────────────
  // TRANSLATION
  // ──────────────────────────────────────────────

  /** Translate text between languages */
  async translateText(
    text: string,
    sourceLang: SupportedLanguageCode,
    targetLang: SupportedLanguageCode
  ): Promise<TranslationResult> {
    return translationService.translate({ text, sourceLang, targetLang });
  }

  // ──────────────────────────────────────────────
  // TEXT-TO-SPEECH
  // ──────────────────────────────────────────────

  /** Speak text aloud in the given language */
  async speakText(
    text: string,
    language: SupportedLanguageCode,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  ): Promise<void> {
    await textToSpeech.speak({ text, language, priority });
  }

  /** Announce a pre-translated emergency phrase in the current language */
  async announceEmergencyPhrase(
    phraseKey: keyof typeof EMERGENCY_PHRASES
  ): Promise<void> {
    const text = translationService.getEmergencyPhrase(phraseKey, this.currentLanguage);
    await textToSpeech.speak({ text, language: this.currentLanguage, priority: 'urgent' });
  }

  // ──────────────────────────────────────────────
  // STATUS
  // ──────────────────────────────────────────────

  getStatus(): MultilingualBridgeStatus {
    return {
      sttReady: this.isReady,
      translationReady: this.isReady,
      ttsReady: this.isReady,
      currentLanguage: this.currentLanguage,
      cacheSize: translationService.getCacheStats().size,
    };
  }

  setLanguage(language: SupportedLanguageCode): void {
    this.currentLanguage = language;
  }
}

// Singleton instance
export const multilingualBridge = new MultilingualBridgeManager();
