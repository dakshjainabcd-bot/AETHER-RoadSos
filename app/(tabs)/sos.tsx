/**
 * SOS Screen — Emergency Trigger
 *
 * Phase 1 builds the MANUAL SOS button here.
 * Phase 3 (Crash Detection) will add automatic detection on top.
 *
 * WHAT PHASE 1 SOS DOES:
 * - Shows a large red SOS button
 * - User holds it for 3 seconds to trigger (prevents accidental presses)
 * - Calls the local emergency number immediately
 * - Shows location to user so they can describe it
 *
 * WHAT PHASE 3 WILL ADD HERE:
 * - Automatic crash detection countdown
 * - 5-second cancel window
 * - Mesh relay dispatch
 */

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Linking,
  Alert,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../_layout';
import { getLastKnownLocation } from '../../services/GPSService';
import { Colors, Spacing, Typography, BorderRadius } from '../../theme';
import { meshRelayManager } from '../../services/MeshRelay/MeshRelayManager';

export default function SOSScreen() {
  const { emergencyNumbers } = useAppContext();

  const [isPressed, setIsPressed] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [sosActive, setSOSActive] = useState(false);
  const [locationText, setLocationText] = useState<string>('Fetching location...');

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation for the SOS button
  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // When user starts pressing the SOS button
  function onPressIn() {
    setIsPressed(true);
    Vibration.vibrate(50);

    // Scale up animation
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();

    let count = 3;
    setCountdown(count);

    // Count down from 3
    countdownTimer.current = setInterval(() => {
      count -= 1;
      setCountdown(count);

      if (count <= 0) {
        clearInterval(countdownTimer.current!);
        triggerSOS();
      }
    }, 1000);
  }

  // When user releases the SOS button before 3 seconds
  function onPressOut() {
    setIsPressed(false);
    setCountdown(3);

    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
    }
  }

  async function triggerSOS() {
    setSOSActive(true);
    Vibration.vibrate([0, 200, 100, 200]);

    // Get location for display
    const loc = await getLastKnownLocation();
    if (loc) {
      setLocationText(
        `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}\n±${Math.round(loc.accuracy)}m accuracy`
      );
    } else {
      setLocationText('Location unavailable — describe your surroundings');
    }

    startPulse();

    // Phase 2: Broadcast SOS via mesh relay ← NEW
    const severity = 3; // Default severity — Phase 3 will calculate from crash force
    const packet = await meshRelayManager.triggerSOS(severity);
    
    if (packet) {
      console.log(`[SOS Screen] Mesh SOS broadcasted: ${packet.incidentId}`);
    } else {
      console.warn('[SOS Screen] Mesh relay unavailable — direct call only');
    }

    Alert.alert(
      '🚨 SOS ACTIVATED',
      `Calling ${emergencyNumbers.ambulance} (Ambulance)\n\nYour location is being relayed to nearby phones.`,
      [
        { text: 'Cancel SOS', style: 'cancel', onPress: cancelSOS },
        { text: `Call ${emergencyNumbers.ambulance}`, style: 'destructive', onPress: () => Linking.openURL(`tel:${emergencyNumbers.ambulance}`) },
      ]
    );
  }

  function cancelSOS() {
    setSOSActive(false);
    setIsPressed(false);
    setCountdown(3);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    Vibration.cancel();
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Emergency SOS</Text>
      <Text style={styles.subtitle}>
        Hold button for 3 seconds to trigger
      </Text>

      {/* SOS Button */}
      <View style={styles.buttonContainer}>
        {/* Outer pulse ring */}
        {sosActive && (
          <Animated.View
            style={[
              styles.pulseRing,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
        )}

        {/* Main SOS button */}
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.sosButton,
              isPressed && styles.sosButtonPressed,
              sosActive && styles.sosButtonActive,
            ]}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={1}
          >
            <Text style={styles.sosButtonText}>SOS</Text>
            {isPressed && !sosActive && (
              <Text style={styles.countdownText}>{countdown}</Text>
            )}
            {sosActive && (
              <Text style={styles.activeText}>ACTIVE</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Location display */}
      <View style={styles.locationCard}>
        <Ionicons name="location" size={16} color={Colors.brand.accent} />
        <Text style={styles.locationText}>{locationText}</Text>
      </View>

      {/* Emergency Numbers Quick Reference */}
      <View style={styles.quickCallsContainer}>
        <Text style={styles.quickCallsTitle}>Quick Call</Text>
        <View style={styles.quickCallsRow}>
          <QuickCallButton
            label="Ambulance"
            number={emergencyNumbers.ambulance}
            color={Colors.brand.primary}
          />
          <QuickCallButton
            label="Police"
            number={emergencyNumbers.police}
            color="#5856D6"
          />
          <QuickCallButton
            label="Fire"
            number={emergencyNumbers.fire}
            color="#FF9500"
          />
        </View>
      </View>

      {/* Instruction */}
      <View style={styles.instructionCard}>
        <Ionicons name="information-circle-outline" size={16} color={Colors.text.muted} />
        <Text style={styles.instructionText}>
          Phase 3 will add automatic crash detection.{'\n'}
          This screen will show a 5-second cancel countdown.
        </Text>
      </View>
    </View>
  );
}

function QuickCallButton({
  label,
  number,
  color,
}: {
  label: string;
  number: string;
  color: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.quickCall, { borderColor: color + '40' }]}
      onPress={() => Linking.openURL(`tel:${number}`)}
    >
      <Text style={[styles.quickCallNumber, { color }]}>{number}</Text>
      <Text style={styles.quickCallLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.muted,
    marginBottom: 48,
    textAlign: 'center',
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  pulseRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 3,
    borderColor: Colors.brand.primary + '40',
  },
  sosButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  sosButtonPressed: {
    backgroundColor: '#CC2F26',
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  sosButtonActive: {
    shadowOpacity: 0.9,
    shadowRadius: 40,
  },
  sosButtonText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  countdownText: {
    fontSize: 28,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  activeText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 2,
    marginTop: 4,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: 32,
    width: '100%',
  },
  locationText: {
    fontSize: 12,
    color: Colors.text.secondary,
    flex: 1,
    fontFamily: 'monospace',
  },
  quickCallsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  quickCallsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  quickCallsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickCall: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
  quickCallNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  quickCallLabel: {
    fontSize: 10,
    color: Colors.text.muted,
    marginTop: 2,
  },
  instructionCard: {
    flexDirection: 'row',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    width: '100%',
  },
  instructionText: {
    fontSize: 12,
    color: Colors.text.muted,
    flex: 1,
    lineHeight: 18,
  },
});
