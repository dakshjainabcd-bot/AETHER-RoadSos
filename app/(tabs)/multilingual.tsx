/**
 * Multilingual Screen — Phase 5 (Whisper STT Rewrite)
 *
 * Uses OpenAI Whisper API (whisper-1 = large-v2 from the open-source repo)
 * Supports 99 languages — all Indian languages, Arabic, Chinese, Thai, etc.
 *
 * HOW TO USE:
 *   1. Add your OpenAI key to utils/constants.ts → OPENAI_API_KEY
 *   2. Tap the microphone button and speak
 *   3. The app records, sends to Whisper, returns transcript in seconds
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../_layout';
import { whisperSTT, STTState } from '../../services/MultilingualBridge/WhisperSTT';
import { multilingualBridge } from '../../services/MultilingualBridge/MultilingualBridgeManager';
import { translationService } from '../../services/MultilingualBridge/TranslationService';
import {
  SupportedLanguageCode,
  EMERGENCY_PHRASES,
} from '../../services/MultilingualBridge/Types';
import { Colors, BorderRadius, Shadows, Layout } from '../../theme';

export default function MultilingualScreen() {
  const { language } = useAppContext();

  // ── STT state ─────────────────────────────────────────────────────────────
  const [sttState, setSttState] = useState<STTState>('idle');
  const [transcript, setTranscript] = useState('');
  const [detectedLang, setDetectedLang] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [sttError, setSttError] = useState('');

  // ── Translation state ─────────────────────────────────────────────────────
  const [inputText, setInputText] = useState('Call ambulance immediately');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationCached, setTranslationCached] = useState(false);

  // ── General status ────────────────────────────────────────────────────────
  const [statusMsg, setStatusMsg] = useState('Ready — tap mic to record');

  // ── Animation for mic pulse ───────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Wire up Whisper callbacks once ───────────────────────────────────────
  useEffect(() => {
    // Initialize on mount
    multilingualBridge.initialize(language as SupportedLanguageCode).catch(console.error);

    // Listen for state changes from WhisperSTT
    whisperSTT.onStateChange((state) => {
      setSttState(state);

      if (state === 'recording') {
        setStatusMsg('🎤 Recording... speak now');
        setTranscript('');
        setSttError('');
        startPulse();
      } else if (state === 'transcribing') {
        setStatusMsg('⏳ Transcribing with Whisper...');
        stopPulse();
      } else if (state === 'idle') {
        stopPulse();
      }
    });

    // Listen for transcription results
    whisperSTT.onResult((result) => {
      if (result.isOffline) {
        setSttError(result.errorReason ?? 'Transcription failed');
        setStatusMsg('❌ ' + (result.errorReason ?? 'Transcription failed'));
        setTranscript('');
      } else {
        setTranscript(result.text);
        setDetectedLang(result.language);
        setConfidence(result.confidence);
        setSttError('');
        setStatusMsg(
          `✅ Whisper detected: ${result.language.toUpperCase()} (${(result.confidence * 100).toFixed(0)}% confidence)`
        );
        // Auto-fill the translation input with the transcript
        if (result.text) {
          setInputText(result.text);
        }
      }
    });

    // Listen for hard errors
    whisperSTT.onError((error) => {
      setSttError(error.message);
      setStatusMsg('❌ ' + error.message);
      stopPulse();
    });

    return () => {
      // Cancel any ongoing recording when screen unmounts
      whisperSTT.cancel().catch(() => {});
    };
  }, []);

  // ── Pulse animation ───────────────────────────────────────────────────────

  function startPulse() {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.current.start();
  }

  function stopPulse() {
    pulseLoop.current?.stop();
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleMicPress() {
    if (sttState === 'recording') {
      // User tapped again — stop early
      await whisperSTT.stopAndTranscribe(
        language !== 'en' ? language : undefined
      );
    } else if (sttState === 'idle') {
      const started = await whisperSTT.startRecording(30_000);
      if (!started) {
        Alert.alert(
          'Microphone Unavailable',
          'Please grant microphone permission in Settings to use voice input.',
          [{ text: 'OK' }]
        );
      }
    }
    // If 'transcribing', do nothing — wait for result
  }

  async function handleTranslate() {
    if (!inputText.trim()) return;
    setIsTranslating(true);
    setStatusMsg('Translating...');
    try {
      const result = await multilingualBridge.translateText(
        inputText.trim(),
        'en',
        language as SupportedLanguageCode
      );
      setTranslatedText(result.translatedText);
      setTranslationCached(result.cached);
      setStatusMsg(
        result.cached
          ? '✅ Translation (from cache)'
          : '✅ Translation complete'
      );
    } catch (error) {
      setStatusMsg('❌ Translation failed');
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleSpeak(text: string, lang: SupportedLanguageCode) {
    setStatusMsg('🔊 Speaking...');
    await multilingualBridge.speakText(text, lang, 'normal');
    setStatusMsg('✅ Done speaking');
  }

  async function handleEmergencyPhrase(phraseKey: keyof typeof EMERGENCY_PHRASES) {
    const phrase = translationService.getEmergencyPhrase(
      phraseKey,
      language as SupportedLanguageCode
    );
    setStatusMsg('🚨 Announcing: ' + phraseKey.replace(/_/g, ' '));
    await multilingualBridge.speakText(phrase, language as SupportedLanguageCode, 'urgent');
    setStatusMsg('✅ Announced');
  }

  // ── Mic button config ─────────────────────────────────────────────────────

  const micConfig = {
    idle: {
      icon: 'mic' as const,
      color: Colors.brand.accent,
      bg: `${Colors.brand.accent}15`,
      border: `${Colors.brand.accent}40`,
      label: 'Tap to record',
    },
    recording: {
      icon: 'stop-circle' as const,
      color: Colors.brand.primary,
      bg: `${Colors.brand.primary}15`,
      border: `${Colors.brand.primary}50`,
      label: 'Tap to stop',
    },
    transcribing: {
      icon: 'hourglass' as const,
      color: Colors.brand.gold,
      bg: `${Colors.brand.gold}15`,
      border: `${Colors.brand.gold}40`,
      label: 'Transcribing...',
    },
  }[sttState];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Multilingual Bridge</Text>
        <Text style={styles.subtitle}>
          Powered by OpenAI Whisper — 99 languages
        </Text>
      </View>

      {/* ── Status card ────────────────────────────────────────────────── */}
      <View style={styles.statusCard}>
        <Text style={styles.statusText}>{statusMsg}</Text>
        {detectedLang ? (
          <Text style={styles.statusSub}>
            Language: {detectedLang.toUpperCase()} · Confidence:{' '}
            {(confidence * 100).toFixed(0)}%
          </Text>
        ) : null}
      </View>

      {/* ── Section 1: Voice Recording ──────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Speech-to-Text (Whisper)</Text>

      <Text style={styles.sectionNote}>
        OpenAI Whisper (same model as the open-source repo) auto-detects
        Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali and 93 more languages.
      </Text>

      {/* Mic button */}
      <View style={styles.micWrapper}>
        <Animated.View
          style={[
            styles.micRing,
            {
              borderColor: micConfig.border,
              backgroundColor: micConfig.bg,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.micButton, { backgroundColor: micConfig.color }]}
            onPress={handleMicPress}
            disabled={sttState === 'transcribing'}
            activeOpacity={0.8}
          >
            <Ionicons name={micConfig.icon} size={36} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>
        <Text style={[styles.micLabel, { color: micConfig.color }]}>
          {micConfig.label}
        </Text>
      </View>

      {/* STT error */}
      {sttError ? (
        <View style={styles.errorCard}>
          <Ionicons name="warning-outline" size={16} color={Colors.status.warning} />
          <Text style={styles.errorText}>{sttError}</Text>
        </View>
      ) : null}

      {/* Transcript result */}
      {transcript ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultLabel}>Transcript</Text>
            <TouchableOpacity
              onPress={() =>
                handleSpeak(transcript, detectedLang as SupportedLanguageCode || 'en')
              }
            >
              <Ionicons name="volume-high-outline" size={18} color={Colors.brand.accent} />
            </TouchableOpacity>
          </View>
          <Text style={styles.resultText}>{transcript}</Text>
        </View>
      ) : null}

      {/* ── Section 2: Translation ──────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Translation</Text>

      <TextInput
        style={styles.input}
        value={inputText}
        onChangeText={setInputText}
        placeholder="Enter English text to translate..."
        placeholderTextColor={Colors.label.tertiary}
        multiline
        numberOfLines={3}
      />

      <View style={styles.langRow}>
        <View style={styles.langChip}>
          <Text style={styles.langText}>EN</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={Colors.label.secondary} />
        <View style={[styles.langChip, { backgroundColor: `${Colors.brand.accent}15` }]}>
          <Text style={[styles.langText, { color: Colors.brand.accent }]}>
            {language.toUpperCase()}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, isTranslating && styles.buttonDisabled]}
        onPress={handleTranslate}
        disabled={isTranslating || !inputText.trim()}
        activeOpacity={0.8}
      >
        <Ionicons name="language" size={20} color="#FFF" />
        <Text style={styles.buttonText}>
          {isTranslating ? 'Translating...' : 'Translate to ' + language.toUpperCase()}
        </Text>
      </TouchableOpacity>

      {translatedText ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultLabel}>
              Translation {translationCached ? '(cached ⚡)' : ''}
            </Text>
            <TouchableOpacity
              onPress={() =>
                handleSpeak(translatedText, language as SupportedLanguageCode)
              }
            >
              <Ionicons name="volume-high-outline" size={18} color={Colors.brand.accent} />
            </TouchableOpacity>
          </View>
          <Text style={styles.resultText}>{translatedText}</Text>
        </View>
      ) : null}

      {/* ── Section 3: Emergency Phrases ───────────────────────────────── */}
      <Text style={styles.sectionTitle}>
        Emergency Phrases ({language.toUpperCase()})
      </Text>

      <View style={styles.phraseGrid}>
        {(Object.keys(EMERGENCY_PHRASES) as Array<keyof typeof EMERGENCY_PHRASES>).map(
          (phraseKey) => {
            const phrase = translationService.getEmergencyPhrase(
              phraseKey,
              language as SupportedLanguageCode
            );
            const label = phraseKey.replace(/_/g, ' ');
            return (
              <TouchableOpacity
                key={phraseKey}
                style={styles.phraseButton}
                onPress={() => handleEmergencyPhrase(phraseKey)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="volume-medium-outline"
                  size={14}
                  color={Colors.brand.gold}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.phraseLabel}>{label}</Text>
                  <Text style={styles.phraseText} numberOfLines={1}>
                    {phrase}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }
        )}
      </View>

      {/* ── Section 4: API Info ─────────────────────────────────────────── */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={16} color={Colors.brand.accent} />
        <Text style={styles.infoText}>
          Speech-to-Text uses{' '}
          <Text style={{ fontWeight: '700' }}>OpenAI Whisper (whisper-1)</Text> —
          the same model as the open-source GitHub repo, running on OpenAI's
          servers. Add your key to{' '}
          <Text style={{ fontFamily: 'Courier' }}>utils/constants.ts</Text> →
          OPENAI_API_KEY
        </Text>
      </View>

      <View style={{ height: Layout.CONTENT_BOTTOM_PADDING }} />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.grouped,
  },
  content: {
    paddingTop: Layout.STATUS_BAR_HEIGHT + 4,
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.label.secondary,
    marginTop: 4,
  },

  // Status
  statusCard: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    padding: 14,
    marginBottom: 24,
    ...Shadows.xs,
  },
  statusText: {
    fontSize: 13,
    color: Colors.label.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusSub: {
    fontSize: 11,
    color: Colors.label.secondary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Sections
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.label.secondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 8,
  },
  sectionNote: {
    fontSize: 12,
    color: Colors.label.tertiary,
    lineHeight: 17,
    marginBottom: 16,
  },

  // Mic button
  micWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  micRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  micButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  micLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Error
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: `${Colors.status.warning}12`,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: `${Colors.status.warning}30`,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.status.warning,
    lineHeight: 18,
  },

  // Result cards
  resultCard: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    padding: 14,
    marginBottom: 16,
    ...Shadows.xs,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.label.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  resultText: {
    fontSize: 15,
    color: Colors.label.primary,
    lineHeight: 22,
  },

  // Translation controls
  input: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    padding: 14,
    fontSize: 15,
    color: Colors.label.primary,
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    ...Shadows.xs,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 14,
  },
  langChip: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
    ...Shadows.xs,
  },
  langText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.label.primary,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.brand.accent,
    borderRadius: BorderRadius.xl,
    paddingVertical: 14,
    marginBottom: 12,
    ...Shadows.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },

  // Emergency phrases
  phraseGrid: {
    gap: 10,
    marginBottom: 24,
  },
  phraseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: `${Colors.brand.gold}12`,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: `${Colors.brand.gold}28`,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  phraseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand.gold,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  phraseText: {
    fontSize: 13,
    color: Colors.label.secondary,
  },

  // Info
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: `${Colors.brand.accent}10`,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: `${Colors.brand.accent}25`,
    padding: 14,
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.label.secondary,
    lineHeight: 18,
  },
});