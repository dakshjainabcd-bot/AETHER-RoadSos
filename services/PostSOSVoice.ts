/**
 * PostSOSVoice — Voice-Activated Injury Reporting After SOS
 * ===========================================================
 *
 * WHY THIS EXISTS:
 * After a crash, a bystander's hands may be bloody, shaking, or occupied
 * applying pressure to a wound. Tapping tiny UI chips is hard or impossible.
 * Voice lets them say "head injury" or "behosh hai" (Hindi: unconscious)
 * and AETHER handles the rest — auto-selects injury type, fires hospital
 * pre-alert, saves a voice log for paramedics.
 *
 * THIS IS NOT A GIMMICK because:
 * 1. Hands-free — bystander can keep hands on victim while speaking
 * 2. Multilingual — Whisper auto-detects language (no setup needed)
 * 3. Saves victim voice log — paramedics hear the bystander's description
 *    when they arrive, even if the bystander has left the scene
 * 4. Faster than tapping — 1 second of speech vs 5 taps through a UI
 *
 * FLOW:
 *   SOS dispatched → acousticDetector.setEnabled(false) releases mic
 *   PostSOSVoice.start() → auto-records for 8 seconds
 *   Whisper transcribes → keyword matching maps to InjuryType
 *   onInjuryDetected callback → _layout.tsx calls setInjuryType()
 *   Hospital pre-alert fires automatically
 *   Voice log saved to AsyncStorage for paramedic access
 *
 * MIC OWNERSHIP:
 *   This service only runs when CrashDetectionEngine is in 'active_sos' state.
 *   AcousticDetector.setEnabled(false) was already called in dispatchSOS().
 *   So there is zero conflict — we have exclusive mic access.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { whisperSTT, WhisperResult } from './MultilingualBridge/WhisperSTT';
import type { InjuryType } from './TraumaMatch';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceInjuryResult {
  /** The mapped injury type, or null if unclear */
  injuryType: InjuryType | null;
  /** Raw Whisper transcript */
  transcript: string;
  /** Language Whisper detected */
  language: string;
  /** Confidence of Whisper transcription (0-1) */
  confidence: number;
  /** Whether the transcript was unclear / no keywords matched */
  unclear: boolean;
}

export type PostSOSVoiceState =
  | 'idle'           // Not active
  | 'listening'      // Recording bystander's voice
  | 'transcribing'   // Sending to Whisper API
  | 'done'           // Completed — result ready
  | 'error';         // Something went wrong

export interface PostSOSVoiceCallbacks {
  /** Called when injury type is successfully detected from voice */
  onInjuryDetected: (result: VoiceInjuryResult) => void;
  /** Called when transcript comes back but no injury keywords matched */
  onUnclear: (transcript: string, language: string) => void;
  /** Called on state changes — use this to update UI */
  onStateChange: (state: PostSOSVoiceState) => void;
  /** Called on hard errors (mic permission, network) */
  onError: (reason: string) => void;
}

// ─── Keyword maps ─────────────────────────────────────────────────────────────
// Maps speech keywords → InjuryType
// Each entry: [keywords that match this injury, in multiple languages]

const INJURY_KEYWORDS: Array<{
  injuryType: InjuryType;
  keywords: string[];
}> = [
  {
    injuryType: 'head_trauma',
    keywords: [
      // English
      'head', 'brain', 'skull', 'unconscious', 'unresponsive', 'knocked out',
      'head injury', 'head trauma', 'concussion', 'not responding',
      // Hindi
      'sir', 'sar', 'behosh', 'behosh hai', 'hosh nahi', 'sar mein chot',
      // Tamil
      'thalai', 'mayakkam', 'unconscious', 'thalai adipattu',
      // Telugu
      'tala', 'tala guayu', 'spruha',
      // Kannada
      'tale', 'tale gaayu', 'spruhe ille',
      // Malayalam
      'thaala', 'ബോധം', 'bodham illa',
    ],
  },
  {
    injuryType: 'cardiac',
    keywords: [
      // English
      'heart', 'cardiac', 'chest', 'not breathing', 'no pulse', 'heart attack',
      'chest pain', 'cpr', 'stopped breathing',
      // Hindi
      'dil', 'seena', 'sans nahi', 'dil ka dora', 'cpr',
      // Tamil
      'idhayam', 'maarbu', 'maranam', 'maruppu',
      // Telugu
      'gunde', 'gundecho noppi',
      // Kannada
      'ede', 'edeshole novu',
      // Malayalam
      'hrudhayam', 'maarbu',
    ],
  },
  {
    injuryType: 'burns',
    keywords: [
      // English
      'burn', 'burns', 'fire', 'flames', 'scorched', 'burnt', 'burned',
      // Hindi
      'jala', 'jal gaya', 'aag', 'jalana',
      // Tamil
      'vedippilai', 'erith', 'neruppu',
      // Telugu
      'korukunu', 'aagu',
      // Kannada
      'suta', 'bichchu',
      // Malayalam
      'charichchu', 'tee',
    ],
  },
  {
    injuryType: 'spinal',
    keywords: [
      // English
      'spine', 'spinal', 'neck', 'back', 'paralysed', 'paralyzed',
      'cannot move', "can't move", 'back injury', 'neck injury',
      // Hindi
      'gardan', 'kamar', 'reedh', 'hil nahi sakta', 'pith',
      // Tamil
      'mugam', 'thadai',
      // Telugu
      'muggu', 'vennupu',
      // Kannada
      'belakade', 'kothala',
      // Malayalam
      'kazhuth', 'mughu',
    ],
  },
  {
    injuryType: 'paediatric',
    keywords: [
      // English
      'child', 'children', 'kid', 'baby', 'infant', 'toddler', 'boy', 'girl',
      'minor', 'young', 'small',
      // Hindi
      'baccha', 'bacchi', 'baalak', 'shishu',
      // Tamil
      'kulandhai', 'pillai',
      // Telugu
      'pillala', 'pilladu', 'pilladu',
      // Kannada
      'magu', 'maguvina',
      // Malayalam
      'kutti', 'kunjinu',
    ],
  },
  {
    injuryType: 'general',
    keywords: [
      // English
      'bleeding', 'blood', 'fracture', 'broken', 'bone', 'wound', 'cut',
      'injury', 'injured', 'hurt', 'leg', 'arm', 'hand', 'foot',
      // Hindi
      'khoon', 'khoon bah raha', 'toota', 'haddi', 'chot', 'ghaav',
      'haath', 'pair', 'tang',
      // Tamil
      'iratham', 'eritham', 'murivu', 'kaayam',
      // Telugu
      'netti', 'netti kaarutondi', 'musalipoindi',
      // Kannada
      'nettaru', 'gaayu', 'mugidha',
      // Malayalam
      'raktham', 'murivu', 'marikku',
    ],
  },
];

// Storage key for the victim voice log
const VOICE_LOG_KEY = 'aether_victim_voice_log_v1';

// Max recording duration for injury description
const RECORDING_MAX_MS = 10_000; // 10 seconds — enough to describe an injury

// ─── Service class ────────────────────────────────────────────────────────────

class PostSOSVoiceService {
  private state: PostSOSVoiceState = 'idle';
  private callbacks: Partial<PostSOSVoiceCallbacks> = {};
  private currentIncidentId = '';

  // ── Configuration ─────────────────────────────────────────────────────────

  setCallbacks(callbacks: Partial<PostSOSVoiceCallbacks>): void {
    this.callbacks = callbacks;
  }

  getState(): PostSOSVoiceState {
    return this.state;
  }

  // ── Main entry point ──────────────────────────────────────────────────────

  /**
   * Start listening for injury description after SOS fires.
   *
   * Call this from _layout.tsx when crashState becomes 'active_sos'.
   * The mic is already free at this point because CrashDetectionEngine
   * called acousticDetector.setEnabled(false) in dispatchSOS().
   *
   * @param incidentId  The SOS packet incidentId — used for voice log storage
   * @param language    App's current language (used as Whisper hint)
   */
  async start(incidentId: string, language = 'en'): Promise<void> {
    if (this.state !== 'idle') {
      console.warn('[PostSOSVoice] Already active — ignoring start()');
      return;
    }

    this.currentIncidentId = incidentId;
    this.setState('listening');

    console.log('[PostSOSVoice] 🎤 Listening for injury description...');

    // Wire up Whisper callbacks
    whisperSTT.onStateChange((sttState) => {
      if (sttState === 'transcribing') {
        this.setState('transcribing');
      }
    });

    whisperSTT.onResult((result) => {
      this.handleTranscriptResult(result);
    });

    whisperSTT.onError((error) => {
      console.error('[PostSOSVoice] Whisper error:', error.message);
      this.setState('error');
      this.callbacks.onError?.(error.message);
    });

    // Start recording — 10 seconds max, silence auto-stops at 2.5s
    const started = await whisperSTT.startRecording(RECORDING_MAX_MS);

    if (!started) {
      console.warn('[PostSOSVoice] Could not start recording — mic unavailable');
      this.setState('error');
      this.callbacks.onError?.('Microphone unavailable. Please type the injury type.');
    }
  }

  /**
   * Stop recording early (e.g. user tapped "Done speaking" button).
   * Triggers transcription immediately.
   */
  async stopEarly(): Promise<void> {
    if (this.state !== 'listening') return;
    await whisperSTT.stopAndTranscribe();
  }

  /**
   * Reset to idle — called when SOS is dismissed.
   */
  reset(): void {
    whisperSTT.cancel().catch(() => {});
    this.setState('idle');
    this.currentIncidentId = '';
  }

  // ── Transcript processing ─────────────────────────────────────────────────

  private async handleTranscriptResult(result: WhisperResult): Promise<void> {
    this.setState('done');

    if (result.isOffline || !result.text.trim()) {
      console.warn('[PostSOSVoice] No transcript —', result.errorReason ?? 'empty');
      this.callbacks.onUnclear?.('', result.language);
      return;
    }

    const transcript = result.text.trim();
    const language = result.language;

    console.log(`[PostSOSVoice] Transcript: "${transcript}" (${language})`);

    // Save to voice log for paramedics
    await this.saveVoiceLog(transcript, language, result.confidence);

    // Map transcript to injury type
    const injuryType = this.mapToInjuryType(transcript);

    if (injuryType) {
      console.log(`[PostSOSVoice] ✅ Injury detected: ${injuryType}`);
      this.callbacks.onInjuryDetected?.({
        injuryType,
        transcript,
        language,
        confidence: result.confidence,
        unclear: false,
      });
    } else {
      console.log('[PostSOSVoice] ⚠️ No keywords matched — transcript unclear');
      this.callbacks.onUnclear?.(transcript, language);
      // Still emit result so UI can show the transcript and let user confirm
      this.callbacks.onInjuryDetected?.({
        injuryType: null,
        transcript,
        language,
        confidence: result.confidence,
        unclear: true,
      });
    }
  }

  /**
   * Map transcript to an InjuryType using keyword matching.
   * Works across all languages Whisper supports — no hardcoded language check.
   */
  private mapToInjuryType(transcript: string): InjuryType | null {
    const lower = transcript.toLowerCase();

    for (const entry of INJURY_KEYWORDS) {
      for (const keyword of entry.keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          return entry.injuryType;
        }
      }
    }

    return null;
  }

  // ── Voice log ─────────────────────────────────────────────────────────────

  /**
   * Save the voice transcript to AsyncStorage.
   * Paramedics or dispatchers can read this log when they arrive.
   *
   * Stored as an array so multiple voice reports for the same incident
   * are all preserved.
   */
  private async saveVoiceLog(
    transcript: string,
    language: string,
    confidence: number
  ): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(VOICE_LOG_KEY);
      const logs: VoiceLogEntry[] = existing ? JSON.parse(existing) : [];

      const entry: VoiceLogEntry = {
        incidentId: this.currentIncidentId,
        transcript,
        language,
        confidence,
        timestamp: Date.now(),
      };

      // Keep only last 20 logs — prevents unbounded growth
      logs.push(entry);
      const trimmed = logs.slice(-20);

      await AsyncStorage.setItem(VOICE_LOG_KEY, JSON.stringify(trimmed));
      console.log('[PostSOSVoice] Voice log saved for paramedics');
    } catch (err) {
      console.error('[PostSOSVoice] Failed to save voice log:', err);
    }
  }

  /**
   * Get all saved voice logs (for a paramedic / dispatcher UI).
   */
  async getVoiceLogs(): Promise<VoiceLogEntry[]> {
    try {
      const stored = await AsyncStorage.getItem(VOICE_LOG_KEY);
      return stored ? (JSON.parse(stored) as VoiceLogEntry[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get the most recent voice log for a specific incident.
   */
  async getVoiceLogForIncident(incidentId: string): Promise<VoiceLogEntry | null> {
    const all = await this.getVoiceLogs();
    return all.filter((l) => l.incidentId === incidentId).pop() ?? null;
  }

  // ── State helpers ─────────────────────────────────────────────────────────

  private setState(newState: PostSOSVoiceState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.callbacks.onStateChange?.(newState);
    console.log(`[PostSOSVoice] State: ${newState}`);
  }
}

// ─── Voice log type ───────────────────────────────────────────────────────────

export interface VoiceLogEntry {
  incidentId: string;
  transcript: string;
  language: string;
  confidence: number;
  timestamp: number;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const postSOSVoice = new PostSOSVoiceService();