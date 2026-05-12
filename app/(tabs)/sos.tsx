/**
 * SOS Screen — Phase 6 Integrated
 *
 * Phase 3: Manual hold-to-activate + sensor confidence meter
 * Phase 6 additions (NEW):
 *   - InjuryTypeSelector shown when crashState = active_sos
 *   - HospitalMatchCard shown when injuryType is selected
 *   - clearPreAlert() called when user dismisses the active SOS
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../_layout';
import { Colors, Spacing, BorderRadius, Layout } from '../../theme';
import { crashDetectionEngine } from '../../services/CrashDetection/CrashDetectionEngine';
import type { CrashDetectionState, FusionScore } from '../../services/CrashDetection/types';

// Phase 6 components
import { InjuryTypeSelector } from '../../components/InjuryTypeSelector';
import { HospitalMatchCard } from '../../components/HospitalMatchCard';
import type { InjuryType } from '../../services/TraumaMatch';

export default function SOSScreen() {
  const {
    emergencyNumbers,
    crashState,
    crashConfidence,
    // Phase 6
    injuryType,
    setInjuryType,
    preAlertState,
    clearPreAlert,
  } = useAppContext();

  // ── Manual SOS button UI state ────────────────────────────────────────
  const [isPressed, setIsPressed]       = useState(false);
  const [countdown, setCountdown]       = useState(3);

  // ── Live sensor score ─────────────────────────────────────────────────
  const [liveScore, setLiveScore] = useState<FusionScore>({
    accelScore: 0, gyroScore: 0, acousticScore: 0, confidence: 0, gForce: 0,
  });

  // Animation values
  const ring1       = useRef(new Animated.Value(1)).current;
  const ring2       = useRef(new Animated.Value(1)).current;
  const ring3       = useRef(new Animated.Value(1)).current;
  const ringOpacity1 = useRef(new Animated.Value(0)).current;
  const ringOpacity2 = useRef(new Animated.Value(0)).current;
  const ringOpacity3 = useRef(new Animated.Value(0)).current;
  const buttonScale  = useRef(new Animated.Value(1)).current;

  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sosActive = crashState === 'active_sos' || crashState === 'countdown' || crashState === 'dispatching';

  // ── Subscribe to live sensor scores ──────────────────────────────────
  useEffect(() => {
    const unsub = crashDetectionEngine.on('SCORE_UPDATED', (event) => {
      if (event.score) setLiveScore(event.score);
    });
    return () => unsub();
  }, []);

  // ── Animate rings when SOS is active ─────────────────────────────────
  useEffect(() => {
    if (sosActive) {
      startRingPulse();
    } else {
      stopRings();
    }
  }, [sosActive]);

  function startRingPulse() {
    const makeRing = (
      scale: Animated.Value,
      opacity: Animated.Value,
      delay: number
    ) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale,   { toValue: 2.4, duration: 1600, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(opacity, { toValue: 0.4, duration: 200, useNativeDriver: true }),
              Animated.timing(opacity, { toValue: 0,   duration: 1400, useNativeDriver: true }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );
    makeRing(ring1, ringOpacity1, 0).start();
    makeRing(ring2, ringOpacity2, 500).start();
    makeRing(ring3, ringOpacity3, 1000).start();
  }

  function stopRings() {
    [ring1, ring2, ring3].forEach(r => r.setValue(1));
    [ringOpacity1, ringOpacity2, ringOpacity3].forEach(o => o.setValue(0));
  }

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

  // ── Phase 6: Handle injury type selection ─────────────────────────────
  function handleInjurySelect(type: InjuryType) {
    setInjuryType(type);
  }

  // ── Phase 6: Dismiss active SOS ───────────────────────────────────────
  function handleDismissSOS() {
    clearPreAlert();
    crashDetectionEngine.resetToIdle();
  }

  const statusConfig = getCrashStatusConfig(crashState);

  // Show hospital card once a hospital has been searched (sending/sent/acknowledged/failed)
  const showHospitalCard = preAlertState.status !== 'idle';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Emergency SOS</Text>
        <Text style={styles.subtitle}>
          {sosActive ? 'SOS Active — help is alerted' : 'Hold for 3 seconds to activate'}
        </Text>
      </View>

      {/* ── Crash Detection Status Pill ─────────────────────────── */}
      <View style={[styles.detectionPill, { borderColor: `${statusConfig.color}30`, backgroundColor: `${statusConfig.color}0D` }]}>
        <View style={[styles.detectionDot, { backgroundColor: statusConfig.color }]} />
        <Text style={[styles.detectionText, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
      </View>

      {/* ── Button Area ─────────────────────────────────────────── */}
      <View style={styles.buttonArea}>
        {[
          { scale: ring1, opacity: ringOpacity1 },
          { scale: ring2, opacity: ringOpacity2 },
          { scale: ring3, opacity: ringOpacity3 },
        ].map((r, i) => (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              { transform: [{ scale: r.scale }], opacity: r.opacity },
            ]}
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

      {/* ── Live Sensor Confidence Meter ────────────────────────── */}
      <SensorMeter score={liveScore} />

      {/* ── Phase 6: Injury Type Selector ───────────────────────── */}
      {/* Show when SOS is active AND no injury type selected yet AND no hospital card */}
      {sosActive && !injuryType && !showHospitalCard && (
        <View style={styles.section}>
          <InjuryTypeSelector
            selected={injuryType}
            onSelect={handleInjurySelect}
          />
        </View>
      )}

      {/* Show selector as disabled (greyed) once type is picked and hospital found */}
      {sosActive && injuryType && showHospitalCard && (
        <View style={styles.section}>
          <InjuryTypeSelector
            selected={injuryType}
            onSelect={() => {}} // locked after selection
            disabled={true}
          />
        </View>
      )}

      {/* ── Phase 6: Hospital Match Card ─────────────────────────── */}
      {showHospitalCard && (
        <View style={styles.section}>
          <HospitalMatchCard
            alertState={preAlertState}
            isSpecialistMatch={true}
            requiredCapabilities={
              injuryType
                ? require('../../services/TraumaMatch').getRequiredCapabilities(injuryType)
                : []
            }
          />
        </View>
      )}

      {/* ── Phase 6: Dismiss SOS (shown only when active) ────────── */}
      {sosActive && (
        <TouchableOpacity style={styles.dismissBtn} onPress={handleDismissSOS} activeOpacity={0.7}>
          <Text style={styles.dismissText}>I am safe — dismiss SOS</Text>
        </TouchableOpacity>
      )}

      {/* ── Quick dial row ──────────────────────────────────────── */}
      <View style={styles.dialRow}>
        <QuickDial label="Ambulance" number={emergencyNumbers.ambulance} color={Colors.brand.primary} />
        <QuickDial label="Police"    number={emergencyNumbers.police}    color={Colors.brand.purple} />
        <QuickDial label="Fire"      number={emergencyNumbers.fire}      color={Colors.brand.gold} />
      </View>

      <View style={{ height: Layout.CONTENT_BOTTOM_PADDING }} />
    </ScrollView>
  );
}

// ── Helper functions ─────────────────────────────────────────────────────────

function getCrashStatusConfig(state: CrashDetectionState): { color: string; label: string } {
  switch (state) {
    case 'idle':
      return { color: Colors.status.success, label: '🛡  Crash Detection · Monitoring' };
    case 'candidate':
      return { color: Colors.status.warning, label: '⚠️  Possible impact detected…' };
    case 'countdown':
      return { color: Colors.brand.primary,  label: '🚨  Crash Confirmed — SOS in 5s' };
    case 'dispatching':
      return { color: Colors.brand.primary,  label: '📡  Dispatching SOS…' };
    case 'active_sos':
      return { color: Colors.brand.primary,  label: '🚨  SOS Active — help alerted' };
    case 'cancelled':
      return { color: Colors.status.success, label: '✓  SOS Cancelled' };
    default:
      return { color: Colors.status.neutral, label: 'Crash Detection' };
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SensorMeter({ score }: { score: FusionScore }) {
  const isActive = score.confidence > 0.02 || score.gForce > 0.1;
  if (!isActive) return (
    <View style={styles.meterContainer}>
      <Text style={styles.meterIdle}>Sensors active · Waiting for impact signal</Text>
    </View>
  );

  return (
    <View style={styles.meterContainer}>
      <MeterBar label="Accel" value={score.accelScore} color={Colors.brand.primary} />
      <MeterBar label="Gyro"  value={score.gyroScore}  color={Colors.brand.accent} />
      <MeterBar label="Audio" value={score.acousticScore} color={Colors.brand.gold} />
      <View style={styles.meterGforce}>
        <Text style={styles.meterGforceText}>{score.gForce.toFixed(1)}g</Text>
        <Text style={styles.meterGforceLabel}>peak g-force</Text>
      </View>
    </View>
  );
}

function MeterBar({ label, value, color }: { label: string; value: number; color: string }) {
  const clampedVal = Math.min(Math.max(value, 0), 1);
  return (
    <View style={styles.meterRow}>
      <Text style={styles.meterLabel}>{label}</Text>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${clampedVal * 100}%` as `${number}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.meterValue}>{(clampedVal * 100).toFixed(0)}%</Text>
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

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
  },

  header: {
    width: '100%',
    paddingTop: Layout.STATUS_BAR_HEIGHT + 4,
    marginBottom: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.label.secondary,
    fontWeight: '400',
  },

  // Detection pill
  detectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: 24,
  },
  detectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  detectionText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: -0.1,
  },

  // Button area
  buttonArea: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ring: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: Colors.brand.primary,
  },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 18,
  },
  sosButtonActive: {
    backgroundColor: '#E0352A',
    shadowOpacity: 0.5,
    shadowRadius: 32,
  },
  sosInnerRing: {
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosLabel: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  sosCountdown: {
    fontSize: 28,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  sosActiveLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  // Sensor meter
  meterContainer: {
    width: '100%',
    marginBottom: 24,
    gap: 5,
  },
  meterIdle: {
    fontSize: 11,
    color: Colors.label.tertiary,
    textAlign: 'center',
    fontWeight: '400',
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meterLabel: {
    fontSize: 10,
    color: Colors.label.tertiary,
    fontWeight: '500',
    width: 36,
    letterSpacing: 0.2,
  },
  meterTrack: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.fill.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 2,
  },
  meterValue: {
    fontSize: 10,
    color: Colors.label.tertiary,
    width: 28,
    textAlign: 'right',
  },
  meterGforce: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    alignSelf: 'center',
    marginTop: 2,
  },
  meterGforceText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.label.secondary,
    letterSpacing: -0.3,
  },
  meterGforceLabel: {
    fontSize: 10,
    color: Colors.label.tertiary,
  },

  // Phase 6 section wrapper
  section: {
    width: '100%',
    marginBottom: 16,
  },

  // Dismiss SOS button
  dismissBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.fill.secondary,
    alignItems: 'center',
    marginBottom: 20,
  },
  dismissText: {
    fontSize: 14,
    color: Colors.label.secondary,
    fontWeight: '500',
  },

  // Quick dial
  dialRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  dialChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  dialNumber: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  dialLabel: {
    fontSize: 10,
    color: Colors.label.secondary,
    fontWeight: '500',
  },
});