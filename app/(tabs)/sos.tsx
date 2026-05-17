/**
 * SOS Screen — Phase 6 + PostSOSVoice
 *
 * NEW: After SOS fires, a voice input panel appears automatically.
 * Bystander can speak the injury type in ANY language — Whisper
 * auto-detects and maps it to the correct hospital capability.
 *
 * Voice panel states:
 *   listening    → animated mic, "Say the injury type..."
 *   transcribing → spinner, "Transcribing..."
 *   done         → shows transcript + mapped injury chip (auto-selected)
 *   unclear      → shows transcript + asks user to confirm
 *   error        → fallback to manual chip selection
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Linking,
  Vibration,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../_layout';
import { Colors, Spacing, BorderRadius, Layout } from '../../theme';
import { crashDetectionEngine } from '../../services/CrashDetection/CrashDetectionEngine';
import type { CrashDetectionState, FusionScore } from '../../services/CrashDetection/types';
import { postSOSVoice, PostSOSVoiceState } from '../../services/PostSOSVoice';

// Phase 6 components
import { InjuryTypeSelector } from '../../components/InjuryTypeSelector';
import { HospitalMatchCard } from '../../components/HospitalMatchCard';
import type { InjuryType } from '../../services/TraumaMatch';

export default function SOSScreen() {
  const {
    emergencyNumbers,
    crashState,
    crashConfidence,
    injuryType,
    setInjuryType,
    preAlertState,
    clearPreAlert,
    language,
  } = useAppContext();

  // ── Manual SOS button state ───────────────────────────────────────────────
  const [isPressed, setIsPressed]   = useState(false);
  const [countdown, setCountdown]   = useState(3);

  // ── Sensor score display ──────────────────────────────────────────────────
  const [liveScore, setLiveScore] = useState<FusionScore>({
    accelScore: 0, gyroScore: 0, acousticScore: 0, confidence: 0, gForce: 0,
  });

  // ── PostSOSVoice state ────────────────────────────────────────────────────
  const [voiceState, setVoiceState]         = useState<PostSOSVoiceState>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceLanguage, setVoiceLanguage]   = useState('');
  const [voiceUnclear, setVoiceUnclear]     = useState(false);

  // ── Animations ────────────────────────────────────────────────────────────
  const ring1        = useRef(new Animated.Value(1)).current;
  const ring2        = useRef(new Animated.Value(1)).current;
  const ring3        = useRef(new Animated.Value(1)).current;
  const ringOpacity1 = useRef(new Animated.Value(0)).current;
  const ringOpacity2 = useRef(new Animated.Value(0)).current;
  const ringOpacity3 = useRef(new Animated.Value(0)).current;
  const buttonScale  = useRef(new Animated.Value(1)).current;
  const micPulse     = useRef(new Animated.Value(1)).current;

  const countdownTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const micPulseLoopRef    = useRef<Animated.CompositeAnimation | null>(null);

  const sosActive = crashState === 'active_sos' || crashState === 'countdown' || crashState === 'dispatching';

  // ── Wire PostSOSVoice callbacks ───────────────────────────────────────────
  useEffect(() => {
    postSOSVoice.setCallbacks({
      onStateChange: (state) => {
        setVoiceState(state);
        if (state === 'listening') {
          startMicPulse();
        } else {
          stopMicPulse();
        }
      },
      onInjuryDetected: (result) => {
        setVoiceTranscript(result.transcript);
        setVoiceLanguage(result.language);
        setVoiceUnclear(result.unclear);

        if (result.injuryType && !result.unclear) {
          // Auto-select the injury — fires hospital pre-alert automatically
          setInjuryType(result.injuryType);
        }
      },
      onUnclear: (transcript, lang) => {
        setVoiceTranscript(transcript);
        setVoiceLanguage(lang);
        setVoiceUnclear(true);
      },
      onError: () => {
        setVoiceUnclear(true); // Fall back to manual chip selection
      },
    });

    return () => {
      postSOSVoice.reset();
    };
  }, []);

  // ── Subscribe to sensor scores ────────────────────────────────────────────
  useEffect(() => {
    const unsub = crashDetectionEngine.on('SCORE_UPDATED', (event) => {
      if (event.score) setLiveScore(event.score);
    });
    return () => unsub();
  }, []);

  // ── SOS ring animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (sosActive) startRingPulse();
    else stopRings();
  }, [sosActive]);

  function startRingPulse() {
    const makeRing = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale,   { toValue: 2.4, duration: 1600, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(opacity, { toValue: 0.4, duration: 200,  useNativeDriver: true }),
              Animated.timing(opacity, { toValue: 0,   duration: 1400, useNativeDriver: true }),
            ]),
          ]),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ])
      );
    makeRing(ring1, ringOpacity1, 0).start();
    makeRing(ring2, ringOpacity2, 500).start();
    makeRing(ring3, ringOpacity3, 1000).start();
  }

  function stopRings() {
    [ring1, ring2, ring3].forEach((r) => r.setValue(1));
    [ringOpacity1, ringOpacity2, ringOpacity3].forEach((o) => o.setValue(0));
  }

  // ── Mic pulse for voice listening ─────────────────────────────────────────
  function startMicPulse() {
    micPulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, { toValue: 1.2, duration: 500, useNativeDriver: true }),
        Animated.timing(micPulse, { toValue: 1.0, duration: 500, useNativeDriver: true }),
      ])
    );
    micPulseLoopRef.current.start();
  }

  function stopMicPulse() {
    micPulseLoopRef.current?.stop();
    micPulse.setValue(1);
  }

  // ── Manual SOS hold-to-activate ───────────────────────────────────────────
  function onPressIn() {
    if (sosActive) return;
    setIsPressed(true);
    Vibration.vibrate(40);
    Animated.spring(buttonScale, { toValue: 0.93, useNativeDriver: true }).start();

    let count = 3;
    setCountdown(count);

    countdownTimerRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      Vibration.vibrate(30);
      if (count <= 0) {
        clearInterval(countdownTimerRef.current!);
        crashDetectionEngine.triggerManualSOS();
        Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
        setIsPressed(false);
        setCountdown(3);
      }
    }, 1000);
  }

  function onPressOut() {
    if (sosActive) return;
    setIsPressed(false);
    setCountdown(3);
    clearInterval(countdownTimerRef.current!);
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
  }

  // ── Dismiss SOS ───────────────────────────────────────────────────────────
  function handleDismissSOS() {
    postSOSVoice.reset();
    setVoiceTranscript('');
    setVoiceLanguage('');
    setVoiceUnclear(false);
    setVoiceState('idle');
    clearPreAlert();
    crashDetectionEngine.resetToIdle();
  }

  // ── Injury type manual selection ──────────────────────────────────────────
  function handleInjurySelect(type: InjuryType) {
    setInjuryType(type);
  }

  const statusConfig = getCrashStatusConfig(crashState);
  const showHospitalCard = preAlertState.status !== 'idle';

  // Whether to show manual chip selector:
  // Show if SOS active AND (voice is unclear OR voice errored OR not started)
  // and no injury is selected yet
  const showManualSelector =
    sosActive &&
    !injuryType &&
    !showHospitalCard &&
    (voiceUnclear || voiceState === 'error' || voiceState === 'idle');

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Emergency SOS</Text>
        <Text style={styles.subtitle}>
          {sosActive ? 'SOS Active — help is alerted' : 'Hold for 3 seconds to activate'}
        </Text>
      </View>

      {/* ── Crash status pill ───────────────────────────────────────────── */}
      <View
        style={[
          styles.detectionPill,
          { borderColor: `${statusConfig.color}30`, backgroundColor: `${statusConfig.color}0D` },
        ]}
      >
        <View style={[styles.detectionDot, { backgroundColor: statusConfig.color }]} />
        <Text style={[styles.detectionText, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
      </View>

      {/* ── SOS Button ─────────────────────────────────────────────────── */}
      <View style={styles.buttonArea}>
        {[
          { scale: ring1, opacity: ringOpacity1 },
          { scale: ring2, opacity: ringOpacity2 },
          { scale: ring3, opacity: ringOpacity3 },
        ].map((r, i) => (
          <Animated.View
            key={i}
            style={[styles.ring, { transform: [{ scale: r.scale }], opacity: r.opacity }]}
          />
        ))}

        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={1}
            style={[styles.sosButton, sosActive && styles.sosButtonActive]}
          >
            <View style={styles.sosInnerRing}>
              <Text style={styles.sosLabel}>SOS</Text>
              {isPressed && !sosActive ? (
                <Text style={styles.sosCountdown}>{countdown}</Text>
              ) : sosActive ? (
                <Text style={styles.sosActiveLabel}>ACTIVE</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ── Sensor meter ────────────────────────────────────────────────── */}
      <SensorMeter score={liveScore} />

      {/* ── POST-SOS VOICE PANEL ────────────────────────────────────────── */}
      {sosActive && (
        <VoiceInjuryPanel
          voiceState={voiceState}
          transcript={voiceTranscript}
          language={voiceLanguage}
          unclear={voiceUnclear}
          micPulse={micPulse}
          onStopEarly={() => postSOSVoice.stopEarly()}
        />
      )}

      {/* ── Injury selector (manual fallback / confirmation) ────────────── */}
      {showManualSelector && (
        <View style={styles.section}>
          <InjuryTypeSelector
            selected={injuryType}
            onSelect={handleInjurySelect}
          />
        </View>
      )}

      {/* ── Hospital match card ─────────────────────────────────────────── */}
      {showHospitalCard && (
        <View style={styles.section}>
          {injuryType && (
            <View style={styles.confirmedInjury}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.status.success} />
              <Text style={styles.confirmedInjuryText}>
                Injury type confirmed via{' '}
                {voiceTranscript ? 'voice' : 'manual selection'}
                {voiceLanguage ? ` (${voiceLanguage.toUpperCase()})` : ''}
              </Text>
            </View>
          )}
          <HospitalMatchCard
            alertState={preAlertState}
            isSpecialistMatch
            requiredCapabilities={
              injuryType
                ? require('../../services/TraumaMatch').getRequiredCapabilities(injuryType)
                : []
            }
          />
        </View>
      )}

      {/* ── Dismiss button ──────────────────────────────────────────────── */}
      {sosActive && (
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={handleDismissSOS}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissText}>I am safe — dismiss SOS</Text>
        </TouchableOpacity>
      )}

      {/* ── Quick dial ──────────────────────────────────────────────────── */}
      <View style={styles.dialRow}>
        <QuickDial label="Ambulance" number={emergencyNumbers.ambulance} color={Colors.brand.primary} />
        <QuickDial label="Police"    number={emergencyNumbers.police}    color={Colors.brand.purple} />
        <QuickDial label="Fire"      number={emergencyNumbers.fire}      color={Colors.brand.gold} />
      </View>

      <View style={{ height: Layout.CONTENT_BOTTOM_PADDING }} />
    </ScrollView>
  );
}

// ── VoiceInjuryPanel ──────────────────────────────────────────────────────────

function VoiceInjuryPanel({
  voiceState,
  transcript,
  language,
  unclear,
  micPulse,
  onStopEarly,
}: {
  voiceState: PostSOSVoiceState;
  transcript: string;
  language: string;
  unclear: boolean;
  micPulse: Animated.Value;
  onStopEarly: () => void;
}) {
  if (voiceState === 'idle') return null;

  return (
    <View style={styles.voicePanel}>
      {/* Header */}
      <View style={styles.voicePanelHeader}>
        <Ionicons name="mic" size={14} color={Colors.brand.accent} />
        <Text style={styles.voicePanelTitle}>Voice Injury Report</Text>
        {language ? (
          <View style={styles.langBadge}>
            <Text style={styles.langBadgeText}>{language.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      {/* Listening state */}
      {voiceState === 'listening' && (
        <View style={styles.voiceListening}>
          <Animated.View
            style={[
              styles.micCircle,
              { transform: [{ scale: micPulse }] },
            ]}
          >
            <Ionicons name="mic" size={28} color="#FFF" />
          </Animated.View>
          <Text style={styles.voiceInstruction}>
            Say the injury type in any language
          </Text>
          <Text style={styles.voiceExamples}>
            "Head injury" · "दिल का दौरा" · "தலை காயம்" · "Burns"
          </Text>
          <TouchableOpacity style={styles.voiceStopBtn} onPress={onStopEarly}>
            <Text style={styles.voiceStopBtnText}>Done speaking</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Transcribing state */}
      {voiceState === 'transcribing' && (
        <View style={styles.voiceTranscribing}>
          <ActivityIndicator size="small" color={Colors.brand.accent} />
          <Text style={styles.voiceTranscribingText}>
            Whisper is transcribing...
          </Text>
        </View>
      )}

      {/* Done — show transcript */}
      {(voiceState === 'done') && transcript ? (
        <View style={styles.voiceResult}>
          <Text style={styles.voiceResultLabel}>You said:</Text>
          <Text style={styles.voiceResultText}>"{transcript}"</Text>
          {unclear ? (
            <View style={styles.voiceUnclearBanner}>
              <Ionicons name="help-circle-outline" size={14} color={Colors.brand.gold} />
              <Text style={styles.voiceUnclearText}>
                Couldn't match a specific injury — please tap below to select manually
              </Text>
            </View>
          ) : (
            <View style={styles.voiceMatchedBanner}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.status.success} />
              <Text style={styles.voiceMatchedText}>
                Injury type identified — hospital pre-alert sent automatically
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Error state */}
      {voiceState === 'error' && (
        <View style={styles.voiceErrorBanner}>
          <Ionicons name="warning-outline" size={14} color={Colors.status.warning} />
          <Text style={styles.voiceErrorText}>
            Voice input unavailable — please select injury type below
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────

function SensorMeter({ score }: { score: FusionScore }) {
  const isActive = score.confidence > 0.02 || score.gForce > 0.1;

  if (!isActive) {
    return (
      <View style={styles.meterContainer}>
        <Text style={styles.meterIdle}>Sensors active · Waiting for impact signal</Text>
      </View>
    );
  }

  return (
    <View style={styles.meterContainer}>
      <MeterBar label="Accel" value={score.accelScore}   color={Colors.brand.primary} />
      <MeterBar label="Gyro"  value={score.gyroScore}    color={Colors.brand.accent} />
      <MeterBar label="Audio" value={score.acousticScore} color={Colors.brand.gold} />
      <View style={styles.meterGforce}>
        <Text style={styles.meterGforceText}>{score.gForce.toFixed(1)}g</Text>
        <Text style={styles.meterGforceLabel}>peak g-force</Text>
      </View>
    </View>
  );
}

function MeterBar({ label, value, color }: { label: string; value: number; color: string }) {
  const v = Math.min(Math.max(value, 0), 1);
  return (
    <View style={styles.meterRow}>
      <Text style={styles.meterLabel}>{label}</Text>
      <View style={styles.meterTrack}>
        <View
          style={[
            styles.meterFill,
            { width: `${v * 100}%` as `${number}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.meterValue}>{(v * 100).toFixed(0)}%</Text>
    </View>
  );
}

function QuickDial({ label, number, color }: { label: string; number: string; color: string }) {
  return (
    <TouchableOpacity
      style={[styles.dialChip, { backgroundColor: `${color}0F`, borderColor: `${color}25` }]}
      onPress={() => Linking.openURL(`tel:${number}`)}
    >
      <Text style={[styles.dialNumber, { color }]}>{number}</Text>
      <Text style={styles.dialLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function getCrashStatusConfig(state: CrashDetectionState): { color: string; label: string } {
  switch (state) {
    case 'idle':        return { color: Colors.status.success, label: '🛡  Crash Detection · Monitoring' };
    case 'candidate':   return { color: Colors.status.warning, label: '⚠️  Possible impact detected…' };
    case 'countdown':   return { color: Colors.brand.primary,  label: '🚨  Crash Confirmed — SOS in 5s' };
    case 'dispatching': return { color: Colors.brand.primary,  label: '📡  Dispatching SOS…' };
    case 'active_sos':  return { color: Colors.brand.primary,  label: '🚨  SOS Active — help alerted' };
    case 'cancelled':   return { color: Colors.status.success, label: '✓  SOS Cancelled' };
    default:            return { color: Colors.status.neutral,  label: 'Crash Detection' };
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background.primary },
  content: { alignItems: 'center', paddingHorizontal: Layout.HORIZONTAL_PADDING },

  header: { width: '100%', paddingTop: Layout.STATUS_BAR_HEIGHT + 4, marginBottom: 16 },
  title: { fontSize: 34, fontWeight: '700', color: Colors.label.primary, letterSpacing: -0.8, marginBottom: 6 },
  subtitle: { fontSize: 15, color: Colors.label.secondary },

  detectionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: BorderRadius.full,
    borderWidth: 1, marginBottom: 24,
  },
  detectionDot: { width: 6, height: 6, borderRadius: 3 },
  detectionText: { fontSize: 11, fontWeight: '500' },

  buttonArea: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  ring: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: Colors.brand.primary },
  sosButton: {
    width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.brand.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 18,
  },
  sosButtonActive: { backgroundColor: '#E0352A', shadowOpacity: 0.5, shadowRadius: 32 },
  sosInnerRing: {
    width: 164, height: 164, borderRadius: 82, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  sosLabel: { fontSize: 38, fontWeight: '800', color: '#FFFFFF', letterSpacing: 4 },
  sosCountdown: { fontSize: 28, fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  sosActiveLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 2, marginTop: 4 },

  // Sensor meter
  meterContainer: { width: '100%', marginBottom: 20, gap: 5 },
  meterIdle: { fontSize: 11, color: Colors.label.tertiary, textAlign: 'center' },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meterLabel: { fontSize: 10, color: Colors.label.tertiary, fontWeight: '500', width: 36 },
  meterTrack: { flex: 1, height: 3, backgroundColor: Colors.fill.tertiary, borderRadius: 2, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 2 },
  meterValue: { fontSize: 10, color: Colors.label.tertiary, width: 28, textAlign: 'right' },
  meterGforce: { flexDirection: 'row', alignItems: 'baseline', gap: 4, alignSelf: 'center', marginTop: 2 },
  meterGforceText: { fontSize: 13, fontWeight: '700', color: Colors.label.secondary, letterSpacing: -0.3 },
  meterGforceLabel: { fontSize: 10, color: Colors.label.tertiary },

  // ── Voice panel ────────────────────────────────────────────────────────────
  voicePanel: {
    width: '100%',
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${Colors.brand.accent}25`,
  },
  voicePanelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14,
  },
  voicePanelTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.label.primary },
  langBadge: {
    backgroundColor: `${Colors.brand.accent}15`, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  langBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.brand.accent },

  voiceListening: { alignItems: 'center', gap: 10 },
  micCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.brand.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.brand.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
  voiceInstruction: { fontSize: 14, fontWeight: '600', color: Colors.label.primary, textAlign: 'center' },
  voiceExamples: { fontSize: 11, color: Colors.label.tertiary, textAlign: 'center', lineHeight: 16 },
  voiceStopBtn: {
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: Colors.fill.secondary, borderRadius: BorderRadius.full,
  },
  voiceStopBtnText: { fontSize: 13, color: Colors.label.secondary, fontWeight: '500' },

  voiceTranscribing: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  voiceTranscribingText: { fontSize: 13, color: Colors.label.secondary },

  voiceResult: { gap: 8 },
  voiceResultLabel: { fontSize: 11, fontWeight: '600', color: Colors.label.tertiary, letterSpacing: 0.5, textTransform: 'uppercase' },
  voiceResultText: { fontSize: 15, color: Colors.label.primary, fontStyle: 'italic', lineHeight: 22 },
  voiceMatchedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${Colors.status.success}12`, borderRadius: BorderRadius.md, padding: 10,
  },
  voiceMatchedText: { flex: 1, fontSize: 12, color: Colors.status.success },
  voiceUnclearBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: `${Colors.brand.gold}12`, borderRadius: BorderRadius.md, padding: 10,
  },
  voiceUnclearText: { flex: 1, fontSize: 12, color: Colors.brand.gold },
  voiceErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${Colors.status.warning}12`, borderRadius: BorderRadius.md, padding: 10,
  },
  voiceErrorText: { flex: 1, fontSize: 12, color: Colors.status.warning },

  // Confirmed injury label
  confirmedInjury: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 8, paddingHorizontal: 4,
  },
  confirmedInjuryText: { fontSize: 12, color: Colors.status.success, fontWeight: '500' },

  section: { width: '100%', marginBottom: 16 },

  dismissBtn: {
    width: '100%', paddingVertical: 14, borderRadius: BorderRadius.xl,
    backgroundColor: Colors.fill.secondary, alignItems: 'center', marginBottom: 20,
  },
  dismissText: { fontSize: 14, color: Colors.label.secondary, fontWeight: '500' },

  dialRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 12 },
  dialChip: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: BorderRadius.xl, borderWidth: 1 },
  dialNumber: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5, marginBottom: 2 },
  dialLabel: { fontSize: 10, color: Colors.label.secondary, fontWeight: '500' },
});