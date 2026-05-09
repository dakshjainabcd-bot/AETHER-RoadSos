/**
 * CrashCountdown — 5-Second Full-Screen Cancel Modal
 *
 * WHY FULL SCREEN?
 * In a real crash, the phone might be:
 * - On the dashboard (owner unconscious — they can't cancel → SOS sends automatically ✓)
 * - In the owner's pocket (they can reach it and cancel ✓)
 * - In the owner's hand (they see the full screen immediately ✓)
 *
 * A small notification would be missed in scenarios 1 and 2.
 * Full screen is impossible to miss.
 *
 * THE COUNTDOWN:
 * - A large pulsing number shows seconds remaining (5...4...3...2...1...0)
 * - A progress bar fills as time runs out
 * - The background flashes dark red — impossible to ignore
 * - The phone vibrates in an urgent pattern
 * - The CANCEL button is huge and bright green (easy to tap with shaking hands)
 * - If not cancelled → onCountdownComplete() fires → CrashDetectionEngine.dispatchSOS()
 */

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../theme';

interface CrashCountdownProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Current countdown value (5 → 4 → 3 → 2 → 1 → 0) */
  secondsRemaining: number;
  /** Total countdown duration (always 5, used for progress bar) */
  totalSeconds: number;
  /** Optional — fusion confidence for debug display */
  confidence?: number;
  /** Called when user taps the cancel button */
  onCancel: () => void;
  /** Called when countdown reaches 0 — triggers SOS dispatch */
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
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bgFlashAnim = useRef(new Animated.Value(0)).current;

  // Animation refs for cleanup
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const flashRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── Start animations + vibration when modal becomes visible ─────────
  useEffect(() => {
    if (!visible) return;

    // Vibrate in urgent emergency pattern:
    // [pause, buzz, pause, buzz, pause, buzz] — three rapid pulses
    Vibration.vibrate([0, 300, 150, 300, 150, 300]);

    // Pulse the countdown circle: scale 1.0 → 1.08 → 1.0, looping
    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    pulseRef.current.start();

    // Flash the background between dark colors
    // NOTE: useNativeDriver: false is REQUIRED here because
    // backgroundColor is NOT supported by the native animation driver.
    // Only transform and opacity can use native driver.
    flashRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(bgFlashAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false,
        }),
        Animated.timing(bgFlashAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: false,
        }),
      ])
    );
    flashRef.current.start();

    // Cleanup: stop animations and vibration when modal closes
    return () => {
      pulseRef.current?.stop();
      flashRef.current?.stop();
      Vibration.cancel();
    };
  }, [visible]);

  // ── Auto-dispatch when countdown reaches 0 ─────────────────────────
  useEffect(() => {
    if (visible && secondsRemaining === 0) {
      onCountdownComplete();
    }
  }, [secondsRemaining, visible]);

  // Don't render anything when not visible
  if (!visible) return null;

  // Interpolate background color for the flash effect
  const bgColor = bgFlashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#050000', '#150000'],
  });

  // Progress bar: starts empty (0%), fills as time runs out (100%)
  const progressPercent = ((totalSeconds - secondsRemaining) / totalSeconds) * 100;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>

        {/* ── Warning icon ────────────────────────────────────────── */}
        <View style={styles.iconWrapper}>
          <Ionicons name="warning" size={44} color={Colors.brand.primary} />
        </View>

        {/* ── Title & subtitle ────────────────────────────────────── */}
        <Text style={styles.title}>CRASH DETECTED</Text>
        <Text style={styles.subtitle}>AETHER will send SOS automatically</Text>

        {/* ── Big pulsing countdown circle ─────────────────────────── */}
        <Animated.View style={[styles.circle, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.number}>{secondsRemaining}</Text>
          <Text style={styles.unit}>sec</Text>
        </Animated.View>

        {/* ── Progress bar — fills left to right as time runs out ─── */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%` as `${number}%` },
            ]}
          />
        </View>
        <Text style={styles.dispatchNote}>SOS dispatching in {secondsRemaining}s</Text>

        {/* ── Debug: confidence score ──────────────────────────────── */}
        {confidence !== undefined && (
          <Text style={styles.debugText}>
            Confidence: {(confidence * 100).toFixed(0)}%
          </Text>
        )}

        {/* ── CANCEL BUTTON — the most important button in the app ── */}
        {/* Green and large so it's easy to find and tap with shaking  */}
        {/* hands after a collision. Accessibility is critical here.    */}
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onCancel}
          activeOpacity={0.75}
        >
          <Text style={styles.cancelText}>✕   I'M OK — CANCEL SOS</Text>
        </TouchableOpacity>

        {/* ── Footer reassurance ──────────────────────────────────── */}
        <Text style={styles.footerNote}>
          If you are injured and cannot cancel, help is already on the way.
        </Text>
      </Animated.View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },

  // ── Warning icon ──────────────────────────────────────────────────────
  iconWrapper: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.brand.primary + '20', // 12% opacity red
    borderWidth: 2,
    borderColor: Colors.brand.primary + '60',      // 37% opacity red
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },

  // ── Title ─────────────────────────────────────────────────────────────
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: Colors.brand.primary,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing['3xl'],
  },

  // ── Countdown circle ──────────────────────────────────────────────────
  circle: {
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 6,
    borderColor: Colors.brand.primary,
    backgroundColor: Colors.brand.primary + '15', // Faint red fill
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    // Red glow shadow
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 12,
  },
  number: {
    fontSize: 74,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 80,
  },
  unit: {
    fontSize: 14,
    color: Colors.text.muted,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // ── Progress bar ──────────────────────────────────────────────────────
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 2,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.brand.primary,
    borderRadius: 2,
  },

  // ── Text below progress bar ───────────────────────────────────────────
  dispatchNote: {
    fontSize: 13,
    color: Colors.text.muted,
    marginBottom: 6,
  },
  debugText: {
    fontSize: 11,
    color: Colors.text.muted,
    fontFamily: 'monospace',
    marginBottom: Spacing['2xl'],
  },

  // ── Cancel button ─────────────────────────────────────────────────────
  cancelBtn: {
    borderWidth: 3,
    borderColor: Colors.status.success,
    borderRadius: BorderRadius.xl,
    paddingVertical: 20,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing['2xl'],
  },
  cancelText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.status.success,
    letterSpacing: 1,
  },

  // ── Footer ────────────────────────────────────────────────────────────
  footerNote: {
    fontSize: 12,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.lg,
  },
});
