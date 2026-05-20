/**
 * CrashCountdown — Prototype dark overlay
 *
 * Near-black (#0C0A07) fullscreen modal with:
 *  - "SOS ACTIVE" blinking badge
 *  - "CRASH DETECTED" / "AETHER will send SOS automatically"
 *  - Giant countdown number with red ring
 *  - "I'M OK — CANCEL SOS" green button
 *  - Reassurance text
 */

import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';

interface CrashCountdownProps {
  visible: boolean;
  secondsRemaining: number;
  totalSeconds: number;
  confidence: number;
  onCancel: () => void;
  onCountdownComplete: () => void;
}

export function CrashCountdown({
  visible,
  secondsRemaining,
  totalSeconds,
  confidence,
  onCancel,
  onCountdownComplete,
}: CrashCountdownProps) {
  const blinkOpacity = useRef(new Animated.Value(1)).current;

  // Blinking dot animation
  useEffect(() => {
    if (!visible) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkOpacity, { toValue: 0.18, duration: 900, useNativeDriver: true }),
        Animated.timing(blinkOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [visible]);

  // Fire onCountdownComplete when timer hits 0
  useEffect(() => {
    if (visible && secondsRemaining <= 0) {
      onCountdownComplete();
    }
  }, [visible, secondsRemaining]);

  if (!visible) return null;

  const progress = secondsRemaining / totalSeconds;
  const confidencePct = Math.round(confidence * 100);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* ── Top section ── */}
        <View style={styles.topSection}>
          {/* SOS ACTIVE badge */}
          <View style={styles.activeBadge}>
            <Animated.View style={[styles.activeDot, { opacity: blinkOpacity }]} />
            <Text style={styles.activeBadgeText}>SOS ACTIVE</Text>
          </View>

          {/* CRASH DETECTED */}
          <Text style={styles.crashLabel}>CRASH DETECTED</Text>

          {/* Main text */}
          <Text style={styles.mainTitle}>AETHER will send</Text>
          <Text style={styles.mainSubtitle}>SOS automatically</Text>
        </View>

        {/* ── Countdown ring ── */}
        <View style={styles.ringContainer}>
          {/* Background ring */}
          <View style={styles.ringBg} />
          
          {/* Progress indicator — we use a simple border approach */}
          <View style={styles.ringProgress}>
            <View style={[
              styles.ringFill,
              {
                borderColor: Colors.brand.primary,
                // Simulate progress with opacity
                opacity: progress > 0 ? 1 : 0.1,
              }
            ]} />
          </View>

          {/* Number */}
          <View style={styles.numberContainer}>
            <Text style={styles.countdownNumber}>{secondsRemaining}</Text>
            <Text style={styles.countdownUnit}>SEC</Text>
          </View>
        </View>

        {/* ── Bottom section ── */}
        <View style={styles.bottomSection}>
          {/* Info line */}
          <Text style={styles.infoText}>
            SOS dispatching in {secondsRemaining}s · Confidence: {confidencePct}%
          </Text>
          <View style={styles.divider} />

          {/* Cancel button */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={16} color={Colors.status.success} />
            <Text style={styles.cancelText}>I'M OK — CANCEL SOS</Text>
          </TouchableOpacity>

          {/* Reassurance */}
          <Text style={styles.reassurance}>
            If you are injured and cannot cancel,{'\n'}help is already on the way.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0A07',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 38,
    paddingHorizontal: 26,
  },

  // Top
  topSection: {
    width: '100%',
    alignItems: 'center',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 62, 40, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 62, 40, 0.26)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 28,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.brand.primary,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.brand.primary,
    letterSpacing: 2,
  },
  crashLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(247, 245, 240, 0.22)',
    letterSpacing: 4,
    marginBottom: 12,
  },
  mainTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#F7F5F0',
    letterSpacing: -1.5,
    lineHeight: 42,
  },
  mainSubtitle: {
    fontSize: 32,
    fontWeight: '300',
    color: '#F7F5F0',
    letterSpacing: -1,
    lineHeight: 38,
  },

  // Ring
  ringContainer: {
    width: 156,
    height: 156,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringBg: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 3,
    borderColor: 'rgba(239, 62, 40, 0.10)',
  },
  ringProgress: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
    overflow: 'hidden',
  },
  ringFill: {
    width: '100%',
    height: '100%',
    borderRadius: 78,
    borderWidth: 3,
    borderColor: Colors.brand.primary,
  },
  numberContainer: {
    alignItems: 'center',
  },
  countdownNumber: {
    fontSize: 96,
    fontWeight: '900',
    color: '#F7F5F0',
    lineHeight: 100,
    letterSpacing: -2,
  },
  countdownUnit: {
    fontSize: 9,
    color: 'rgba(247, 245, 240, 0.26)',
    letterSpacing: 4,
    marginTop: 4,
  },

  // Bottom
  bottomSection: {
    width: '100%',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 10,
    color: 'rgba(247, 245, 240, 0.22)',
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 22,
  },
  cancelBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderWidth: 1.5,
    borderColor: Colors.status.success,
    borderRadius: 14,
    marginBottom: 16,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.status.success,
    letterSpacing: 0.8,
  },
  reassurance: {
    fontSize: 12,
    color: 'rgba(247, 245, 240, 0.20)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
