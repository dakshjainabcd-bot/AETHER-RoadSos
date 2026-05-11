/**
 * CPRCoach — Real-Time CPR Guidance
 *
 * This component does three things simultaneously:
 *
 * 1. VISUAL METRONOME: A red circle pulses at exactly 110 BPM (every 545ms).
 *    The bystander can look at this to calibrate their compression rate.
 *
 * 2. AUDIO DETECTION: The microphone records amplitude. Each compression
 *    creates a sound (thud against chest), detected as an amplitude spike.
 *    The user can also tap the circle manually as a backup.
 *
 * 3. VOICE COACHING: expo-speech reads feedback aloud so the bystander
 *    can focus on the victim, not the screen:
 *    - "Press faster" if BPM < 100
 *    - "Slow down" if BPM > 120
 *    - "Keep going, do not stop" if no compression detected for 4 seconds
 *
 * WHY 110 BPM?
 * Guidelines recommend 100–120 compressions per minute. 110 is the exact
 * midpoint, giving a safe margin either way. It matches the tempo of
 * 'Stayin' Alive' by the Bee Gees (a real medical mnemonic).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows } from '../../theme';
import { getSpokenLanguageTag } from '../../services/BystAI';

// 110 BPM = 60,000ms / 110 = 545ms per beat
const METRONOME_INTERVAL_MS = 545;
const TARGET_BPM_MIN = 100;
const TARGET_BPM_MAX = 120;

// Amplitude threshold for compression detection (in dBFS)
// dBFS scale: 0 = loudest, -160 = silence
// A CPR compression sound is typically louder than -35 dBFS
const COMPRESSION_THRESHOLD_DBFS = -35;

// Minimum time between registered compressions (ms)
// Prevents double-counting a single compression
const MIN_COMPRESSION_INTERVAL_MS = 300;

interface CPRCoachProps {
  language: string;
  onExit: () => void;
}

export function CPRCoach({ language, onExit }: CPRCoachProps) {
  const [isActive, setIsActive] = useState(false);
  const [compressionCount, setCompressionCount] = useState(0);
  const [currentBPM, setCurrentBPM] = useState(0);
  const [feedback, setFeedback] = useState(
    'Press START to begin CPR coaching'
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micAvailable, setMicAvailable] = useState(true);

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;
  const metronomePulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // Data refs (using refs because we don't want re-renders on every update)
  const recordingRef = useRef<Audio.Recording | null>(null);
  const compressionTimestampsRef = useRef<number[]>([]);
  const lastRegisteredCompressionRef = useRef<number>(0);
  const lastFeedbackTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micPollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef<boolean>(false);

  const spokenLang = getSpokenLanguageTag(language);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAll();
    };
  }, []);

  function cleanupAll() {
    metronomePulseRef.current?.stop();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (micPollingIntervalRef.current) clearInterval(micPollingIntervalRef.current);
    if (stoppedCheckIntervalRef.current) clearInterval(stoppedCheckIntervalRef.current);
    stopRecordingAsync();
    Speech.stop();
  }

  async function stopRecordingAsync() {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {
        // Ignore cleanup errors
      }
      recordingRef.current = null;
    }
  }

  // ── METRONOME ──────────────────────────────────────────────────────────────
  function startMetronome() {
    metronomePulseRef.current = Animated.loop(
      Animated.sequence([
        // Beat: quickly scale up and brighten
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.25,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1.0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
        // Rest: slowly scale back down and dim
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.0,
            duration: METRONOME_INTERVAL_MS - 150,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: METRONOME_INTERVAL_MS - 150,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    metronomePulseRef.current.start();
  }

  function stopMetronome() {
    metronomePulseRef.current?.stop();
    scaleAnim.setValue(1);
    opacityAnim.setValue(0.6);
  }

  // ── SESSION CONTROL ────────────────────────────────────────────────────────
  async function startSession() {
    setIsActive(true);
    isActiveRef.current = true;
    setCompressionCount(0);
    setCurrentBPM(0);
    setElapsedSeconds(0);
    compressionTimestampsRef.current = [];
    lastFeedbackTimeRef.current = 0;

    // Start elapsed time timer
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    // Start visual metronome
    startMetronome();

    // Try to start microphone monitoring
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.LOW_QUALITY,
        isMeteringEnabled: true,
      });
      recordingRef.current = recording;
      setMicAvailable(true);

      // Poll mic amplitude every 200ms
      micPollingIntervalRef.current = setInterval(async () => {
        if (!recordingRef.current || !isActiveRef.current) return;
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording) {
            const metering = (status as any).metering as number | undefined;
            if (
              typeof metering === 'number' &&
              metering >= COMPRESSION_THRESHOLD_DBFS
            ) {
              handleCompressionDetected();
            }
          }
        } catch {
          // Recording might have been unloaded — safe to ignore
        }
      }, 200);
    } catch {
      // Mic not available — user will tap manually
      setMicAvailable(false);
      setFeedback('Mic unavailable — tap the circle for each compression');
    }

    // Check if compressions have stopped (every 2 seconds)
    stoppedCheckIntervalRef.current = setInterval(() => {
      if (!isActiveRef.current) return;
      if (compressionTimestampsRef.current.length === 0) return;

      const lastTs =
        compressionTimestampsRef.current[
          compressionTimestampsRef.current.length - 1
        ];
      const gapMs = Date.now() - lastTs;

      if (gapMs > 4000) {
        const now = Date.now();
        if (now - lastFeedbackTimeRef.current > 3000) {
          lastFeedbackTimeRef.current = now;
          setFeedback('Keep going — do NOT stop compressions!');
          speakText('Keep going. Do not stop.');
        }
      }
    }, 2000);

    // Initial voice prompt
    speakText('CPR started. Push hard and fast. Keep going!');
    setFeedback('Compressions detected — keep the rhythm!');
  }

  function stopSession() {
    isActiveRef.current = false;
    setIsActive(false);
    stopMetronome();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (micPollingIntervalRef.current) clearInterval(micPollingIntervalRef.current);
    if (stoppedCheckIntervalRef.current) clearInterval(stoppedCheckIntervalRef.current);
    stopRecordingAsync();
    Speech.stop();
    setFeedback('Session ended. Well done for helping this person.');
    setCurrentBPM(0);
  }

  // ── COMPRESSION HANDLING ───────────────────────────────────────────────────
  const handleCompressionDetected = useCallback(() => {
    const now = Date.now();

    // Debounce: ignore if too soon after the last compression
    if (now - lastRegisteredCompressionRef.current < MIN_COMPRESSION_INTERVAL_MS) {
      return;
    }
    lastRegisteredCompressionRef.current = now;

    // Add to timestamps
    compressionTimestampsRef.current.push(now);

    // Keep only last 12 timestamps (enough for accurate BPM)
    if (compressionTimestampsRef.current.length > 12) {
      compressionTimestampsRef.current = compressionTimestampsRef.current.slice(-12);
    }

    setCompressionCount((prev) => prev + 1);

    // Calculate BPM from intervals between last 6 compressions
    const timestamps = compressionTimestampsRef.current;
    if (timestamps.length >= 3) {
      const recent = timestamps.slice(-6);
      const intervals: number[] = [];
      for (let i = 1; i < recent.length; i++) {
        intervals.push(recent[i] - recent[i - 1]);
      }
      const avgIntervalMs =
        intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
      const bpm = Math.round(60000 / avgIntervalMs);

      // Only update state if reasonable (10–250 BPM)
      if (bpm > 10 && bpm < 250) {
        setCurrentBPM(bpm);

        // Feedback every 3 seconds maximum
        if (now - lastFeedbackTimeRef.current > 3000) {
          lastFeedbackTimeRef.current = now;
          if (bpm < TARGET_BPM_MIN) {
            setFeedback(`Too slow — ${bpm} BPM. Press faster!`);
            speakText('Press faster.');
          } else if (bpm > TARGET_BPM_MAX) {
            setFeedback(`Too fast — ${bpm} BPM. Slow down slightly.`);
            speakText('Slow down a little.');
          } else {
            setFeedback(`Perfect — ${bpm} BPM. Keep this rhythm!`);
          }
        }
      }
    }
  }, []);

  // Manual tap (backup to mic detection)
  function handleManualTap() {
    if (!isActive) return;
    handleCompressionDetected();
  }

  // ── SPEECH ─────────────────────────────────────────────────────────────────
  function speakText(text: string) {
    try {
      Speech.stop();
      Speech.speak(text, {
        language: spokenLang,
        rate: 1.0,
        pitch: 1.0,
      });
    } catch {
      // Speech not available on this device — silent fallback
    }
  }

  // ── HELPERS ────────────────────────────────────────────────────────────────
  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  const bpmColor =
    currentBPM === 0
      ? Colors.label.tertiary
      : currentBPM < TARGET_BPM_MIN || currentBPM > TARGET_BPM_MAX
      ? Colors.brand.gold
      : Colors.status.success;

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Text style={styles.title}>CPR Coach</Text>
      <Text style={styles.subtitle}>
        Target: 100–120 compressions per minute
      </Text>

      {/* Metronome circle — also a tap target */}
      <TouchableOpacity
        onPress={handleManualTap}
        activeOpacity={0.85}
        disabled={!isActive}
        style={styles.metronomeWrapper}
      >
        <Animated.View
          style={[
            styles.metronomeOuter,
            {
              opacity: opacityAnim,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.metronomeInner,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <Text style={styles.metronomeEmoji}>
              {isActive ? '💓' : '❤️'}
            </Text>
            {isActive && (
              <Text style={styles.metronomeTapHint}>TAP EACH{'\n'}COMPRESSION</Text>
            )}
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatBox
          label="Count"
          value={compressionCount.toString()}
          color={Colors.brand.accent}
        />
        <StatBox
          label="BPM"
          value={currentBPM > 0 ? currentBPM.toString() : '--'}
          color={bpmColor}
        />
        <StatBox
          label="Time"
          value={formatTime(elapsedSeconds)}
          color={Colors.label.secondary}
        />
      </View>

      {/* Feedback text */}
      <View style={styles.feedbackBox}>
        <Text style={styles.feedbackText}>{feedback}</Text>
      </View>

      {/* Mic status note */}
      {!micAvailable && isActive && (
        <View style={styles.micNote}>
          <Ionicons
            name="mic-off"
            size={12}
            color={Colors.label.tertiary}
          />
          <Text style={styles.micNoteText}>
            Tap mode active — tap the circle for each compression
          </Text>
        </View>
      )}

      {/* Control buttons */}
      {!isActive ? (
        <TouchableOpacity style={styles.startBtn} onPress={startSession}>
          <Ionicons name="play" size={20} color="#fff" />
          <Text style={styles.startBtnText}>START CPR COACHING</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.stopBtn} onPress={stopSession}>
          <Ionicons name="stop" size={18} color={Colors.brand.primary} />
          <Text style={styles.stopBtnText}>STOP</Text>
        </TouchableOpacity>
      )}

      {/* Exit */}
      <TouchableOpacity style={styles.exitBtn} onPress={onExit}>
        <Ionicons name="arrow-back" size={14} color={Colors.label.secondary} />
        <Text style={styles.exitBtnText}>Back to First Aid Steps</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.label.secondary,
    textAlign: 'center',
  },

  // Metronome
  metronomeWrapper: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metronomeOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: `${Colors.brand.primary}25`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metronomeInner: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  metronomeEmoji: {
    fontSize: 44,
  },
  metronomeTapHint: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 4,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    padding: 12,
    alignItems: 'center',
    ...Shadows.xs,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 10,
    color: Colors.label.tertiary,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Feedback
  feedbackBox: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    padding: 14,
    width: '100%',
    ...Shadows.xs,
  },
  feedbackText: {
    fontSize: 14,
    color: Colors.label.primary,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Mic note
  micNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  micNoteText: {
    fontSize: 11,
    color: Colors.label.tertiary,
    textAlign: 'center',
  },

  // Buttons
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.brand.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  startBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.brand.primary,
  },
  stopBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.brand.primary,
    letterSpacing: 1,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  exitBtnText: {
    fontSize: 13,
    color: Colors.label.secondary,
  },
});