/**
 * SOS Screen — Phase 3 Update
 *
 * Phase 3 redesigns this screen entirely:
 * - Live sensor readings: g-force meter, confidence bars
 * - Detection state display (idle / candidate / active)
 * - Manual SOS button → triggers 5-second countdown (same as auto)
 * - "Test Crash Detection" button → simulates a confirmed crash (for demo)
 * - Shake hint: "Shake 3× to trigger"
 *
 * The 5-second countdown modal (CrashCountdown) is managed in _layout.tsx
 * and appears as a global overlay — it shows on this screen too.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Linking,
  Alert,
  Vibration,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../_layout';
import { crashDetectionEngine } from '../../services/CrashDetection/CrashDetectionEngine';
import { Colors, Spacing, BorderRadius, Shadows } from '../../theme';
import type { CrashDetectionState, FusionScore } from '../../services/CrashDetection/types';

// State → display label and color
const STATE_CONFIG: Record<CrashDetectionState, { label: string; color: string; icon: string }> = {
  idle:        { label: 'Monitoring',      color: Colors.status.success, icon: 'shield-checkmark' },
  candidate:   { label: 'Suspicious...',   color: Colors.status.warning,  icon: 'warning-outline' },
  countdown:   { label: 'CRASH DETECTED',  color: Colors.brand.primary,   icon: 'warning' },
  dispatching: { label: 'Sending SOS...',  color: Colors.brand.primary,   icon: 'send' },
  cancelled:   { label: 'Cancelled',       color: Colors.text.muted,      icon: 'close-circle' },
  active_sos:  { label: 'SOS ACTIVE',      color: Colors.brand.primary,   icon: 'radio' },
};

export default function SOSScreen() {
  const {
    emergencyNumbers,
    crashState,
    crashScore,
    currentGForce,
  } = useAppContext();

  const stateConfig = STATE_CONFIG[crashState] ?? STATE_CONFIG['idle'];

  // Animated pulse for the state indicator dot
  const dotPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (crashState === 'candidate' || crashState === 'active_sos') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(dotPulse, { toValue: 1.4, duration: 600, useNativeDriver: true }),
          Animated.timing(dotPulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      dotPulse.setValue(1);
    }
  }, [crashState]);

  function handleManualSOS() {
    Alert.alert(
      'Trigger Manual SOS',
      'This will start the 5-second cancel countdown, then dispatch SOS.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Trigger SOS',
          style: 'destructive',
          onPress: () => {
            Vibration.vibrate(100);
            crashDetectionEngine.triggerManualSOS();
          },
        },
      ]
    );
  }

  function handleTestCrash() {
    Alert.alert(
      '🧪 Test Crash Detection',
      'This simulates a confirmed crash detection for demo/testing. The 5-second countdown will appear. You can cancel it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Test',
          onPress: () => {
            Vibration.vibrate([0, 100, 50, 100]);
            crashDetectionEngine.triggerTestSOS();
          },
        },
      ]
    );
  }

  function handleResetSOS() {
    crashDetectionEngine.resetToIdle();
  }

  function dialNumber(number: string, label: string) {
    Alert.alert(
      `Call ${label}`,
      `Calling ${number}...`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Call ${number}`, style: 'destructive', onPress: () => Linking.openURL(`tel:${number}`) },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Emergency SOS</Text>

      {/* ── Detection State Badge ─────────────────────────────────────── */}
      <View style={[styles.stateBadge, { borderColor: stateConfig.color + '40' }]}>
        <Animated.View
          style={[
            styles.stateDot,
            { backgroundColor: stateConfig.color, transform: [{ scale: dotPulse }] },
          ]}
        />
        <Ionicons name={stateConfig.icon as any} size={16} color={stateConfig.color} />
        <Text style={[styles.stateLabel, { color: stateConfig.color }]}>
          {stateConfig.label}
        </Text>
      </View>

      {/* ── Live Sensor Readings ──────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>LIVE SENSOR READINGS</Text>
      <View style={styles.sensorsCard}>

        {/* G-Force Meter */}
        <View style={styles.sensorRow}>
          <Text style={styles.sensorName}>G-Force</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.min((currentGForce / 4) * 100, 100)}%` as `${number}%`,
                  backgroundColor: currentGForce > 2 ? Colors.brand.primary : Colors.status.success,
                },
              ]}
            />
          </View>
          <Text style={styles.sensorValue}>{currentGForce.toFixed(2)}g</Text>
        </View>

        {/* Accel Score */}
        <View style={styles.sensorRow}>
          <Text style={styles.sensorName}>Accel ×0.4</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, {
              width: `${Math.min(crashScore.accelScore * 100, 100)}%` as `${number}%`,
              backgroundColor: Colors.brand.accent,
            }]} />
          </View>
          <Text style={styles.sensorValue}>{(crashScore.accelScore * 100).toFixed(0)}%</Text>
        </View>

        {/* Gyro Score */}
        <View style={styles.sensorRow}>
          <Text style={styles.sensorName}>Gyro ×0.3</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, {
              width: `${Math.min(crashScore.gyroScore * 100, 100)}%` as `${number}%`,
              backgroundColor: '#A855F7',
            }]} />
          </View>
          <Text style={styles.sensorValue}>{(crashScore.gyroScore * 100).toFixed(0)}%</Text>
        </View>

        {/* Acoustic Score */}
        <View style={styles.sensorRow}>
          <Text style={styles.sensorName}>Acoustic ×0.3</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, {
              width: `${Math.min(crashScore.acousticScore * 100, 100)}%` as `${number}%`,
              backgroundColor: '#F59E0B',
            }]} />
          </View>
          <Text style={styles.sensorValue}>{(crashScore.acousticScore * 100).toFixed(0)}%</Text>
        </View>

        {/* Confidence (divider line then final score) */}
        <View style={styles.divider} />
        <View style={styles.sensorRow}>
          <Text style={[styles.sensorName, { fontWeight: '700', color: Colors.text.primary }]}>
            Confidence
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, {
              width: `${Math.min(crashScore.confidence * 100, 100)}%` as `${number}%`,
              backgroundColor: crashScore.confidence >= 0.75 ? Colors.brand.primary : Colors.status.success,
            }]} />
            {/* Threshold line at 75% */}
            <View style={styles.thresholdLine} />
          </View>
          <Text style={[
            styles.sensorValue,
            crashScore.confidence >= 0.75 && { color: Colors.brand.primary, fontWeight: '800' },
          ]}>
            {(crashScore.confidence * 100).toFixed(0)}%
          </Text>
        </View>
        <Text style={styles.thresholdNote}>← 75% threshold for auto-SOS</Text>
      </View>

      {/* ── Manual SOS Button ─────────────────────────────────────────── */}
      <TouchableOpacity
        style={[
          styles.sosButton,
          crashState === 'active_sos' && styles.sosButtonActive,
        ]}
        onPress={crashState === 'active_sos' ? handleResetSOS : handleManualSOS}
        activeOpacity={0.8}
      >
        <Ionicons
          name={crashState === 'active_sos' ? 'close-circle' : 'warning'}
          size={32}
          color="#FFFFFF"
        />
        <Text style={styles.sosButtonText}>
          {crashState === 'active_sos' ? 'RESET SOS' : 'MANUAL SOS'}
        </Text>
        <Text style={styles.sosButtonHint}>
          {crashState === 'active_sos'
            ? 'Tap to return to monitoring'
            : 'Triggers 5-second countdown'}
        </Text>
      </TouchableOpacity>

      {/* ── Quick Emergency Calls ─────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>QUICK CALL</Text>
      <View style={styles.quickCallRow}>
        <QuickCall label="Ambulance" number={emergencyNumbers.ambulance} color={Colors.brand.primary} onPress={() => dialNumber(emergencyNumbers.ambulance, 'Ambulance')} />
        <QuickCall label="Police"    number={emergencyNumbers.police}    color="#5856D6"              onPress={() => dialNumber(emergencyNumbers.police, 'Police')} />
        <QuickCall label="Fire"      number={emergencyNumbers.fire}      color="#FF9500"              onPress={() => dialNumber(emergencyNumbers.fire, 'Fire')} />
      </View>

      {/* ── Phase 3 Info & Test Tools ─────────────────────────────────── */}
      <Text style={styles.sectionLabel}>TESTING & DEMO</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="phone-portrait-outline" size={16} color={Colors.brand.accent} />
          <Text style={styles.infoText}>
            <Text style={{ color: Colors.text.primary, fontWeight: '700' }}>Shake trigger: </Text>
            Shake the phone 3 times rapidly within 2 seconds
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="analytics-outline" size={16} color={Colors.brand.accent} />
          <Text style={styles.infoText}>
            <Text style={{ color: Colors.text.primary, fontWeight: '700' }}>Auto trigger: </Text>
            Confidence ≥ 75% for 2 consecutive seconds
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.testButton} onPress={handleTestCrash}>
        <Ionicons name="flask" size={16} color="#FFD700" />
        <Text style={styles.testButtonText}>🧪 Simulate Crash (Test Countdown)</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function QuickCall({ label, number, color, onPress }: {
  label: string; number: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.quickCallBtn, { borderColor: color + '40' }]} onPress={onPress}>
      <Text style={[styles.quickCallNumber, { color }]}>{number}</Text>
      <Text style={styles.quickCallLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
  content: { padding: Spacing.lg, paddingTop: 56 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text.primary, marginBottom: Spacing.lg },

  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: Spacing['2xl'],
    backgroundColor: Colors.background.secondary,
  },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  stateLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },

  sensorsCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sensorName: { fontSize: 11, color: Colors.text.muted, width: 80, fontWeight: '500' },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 3,
    overflow: 'visible',
    position: 'relative',
  },
  barFill: { height: '100%', borderRadius: 3 },
  thresholdLine: {
    position: 'absolute',
    left: '75%',
    top: -3,
    width: 2,
    height: 12,
    backgroundColor: Colors.text.muted,
    borderRadius: 1,
  },
  sensorValue: { fontSize: 11, color: Colors.text.muted, width: 36, textAlign: 'right', fontFamily: 'monospace' },
  divider: { height: 1, backgroundColor: Colors.border.subtle, marginVertical: 8 },
  thresholdNote: { fontSize: 10, color: Colors.text.muted, textAlign: 'right', marginTop: 2 },

  sosButton: {
    backgroundColor: Colors.brand.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
    ...Shadows.emergency,
  },
  sosButtonActive: { backgroundColor: Colors.status.neutral },
  sosButtonText: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  sosButtonHint: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  quickCallRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  quickCallBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.secondary,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  quickCallNumber: { fontSize: 18, fontWeight: '800' },
  quickCallLabel: { fontSize: 10, color: Colors.text.muted, fontWeight: '600' },

  infoCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: 10,
    marginBottom: Spacing.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoText: { fontSize: 13, color: Colors.text.secondary, flex: 1, lineHeight: 20 },

  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFD700' + '15',
    borderWidth: 1,
    borderColor: '#FFD700' + '40',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  testButtonText: { fontSize: 14, color: '#FFD700', fontWeight: '600' },
});
