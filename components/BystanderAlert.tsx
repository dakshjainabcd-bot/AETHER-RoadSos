/**
 * BystanderAlert — Full-screen alert when a crash is detected nearby
 *
 * This component appears as a modal overlay on the HOME SCREEN when:
 * - MeshRelayManager fires 'SOS_RECEIVED'
 * - The crash GPS is within 500m of our location
 *
 * WHY FULL SCREEN?
 * A small notification banner can be missed. In an emergency, we want
 * the bystander to NOTICE. A full-screen red overlay is impossible to ignore.
 *
 * WHAT IT SHOWS:
 * - Distance to crash
 * - Severity indicator
 * - Call ambulance button (auto-fills correct number for country)
 * - "Open Bystander Coach" (Phase 4 — first aid guidance)
 * - How to drive there
 * - Good Samaritan legal protection reminder
 * - Dismiss button
 */

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Vibration,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SOSPacket } from '../services/MeshRelay/types';
import { Colors, Spacing, BorderRadius, Typography } from '../theme';

interface BystanderAlertProps {
  packet: SOSPacket | null;
  distanceM: number;
  emergencyAmbulanceNumber: string;
  onDismiss: () => void;
}

export function BystanderAlert({
  packet,
  distanceM,
  emergencyAmbulanceNumber,
  onDismiss,
}: BystanderAlertProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!packet) return;

    // Vibrate in emergency pattern when alert appears
    Vibration.vibrate([0, 300, 100, 300, 100, 300]);

    // Pulsing animation for the severity indicator
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      pulse.stop();
      Vibration.cancel();
    };
  }, [packet]);

  if (!packet) return null;

  // Format distance nicely
  const distanceText =
    distanceM < 1000
      ? `${Math.round(distanceM)} metres`
      : `${(distanceM / 1000).toFixed(1)} km`;

  // Format time since crash
  const minutesAgo = Math.round((Date.now() - packet.timestamp) / 60000);
  const timeText = minutesAgo === 0 ? 'Just now' : `${minutesAgo} min ago`;

  // Severity label
  const severityLabels = ['', 'Minor', 'Moderate', 'Serious', 'Severe', 'Critical'];
  const severityLabel = severityLabels[packet.severity] ?? 'Unknown';

  // Severity color
  const severityColor =
    packet.severity <= 2
      ? Colors.status.warning
      : packet.severity <= 3
      ? '#FF6B35'
      : Colors.brand.primary;

  function callAmbulance() {
    Linking.openURL(`tel:${emergencyAmbulanceNumber}`);
  }

  function navigateTocrash() {
    if (!packet) return;
    const url = `geo:${packet.lat},${packet.lng}?q=${packet.lat},${packet.lng}(Accident Scene)`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${packet.lat},${packet.lng}`);
    });
  }

  return (
    <Modal
      visible={!!packet}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>

          {/* Header */}
          <View style={styles.header}>
            <Animated.View style={[styles.alertIconContainer, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="warning" size={40} color="#FFFFFF" />
            </Animated.View>
            <Text style={styles.alertTitle}>ACCIDENT NEARBY</Text>
            <Text style={styles.alertSubtitle}>AETHER detected a crash</Text>
          </View>

          {/* Incident Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color={Colors.brand.accent} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Distance</Text>
                <Text style={styles.infoValue}>{distanceText} from you</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color={Colors.text.muted} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Reported</Text>
                <Text style={styles.infoValue}>{timeText}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Ionicons name="pulse" size={20} color={severityColor} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Severity</Text>
                <Text style={[styles.infoValue, { color: severityColor }]}>
                  {severityLabel} ({packet.severity}/5)
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Ionicons name="git-branch" size={20} color={Colors.text.muted} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Relay Hops</Text>
                <Text style={styles.infoValue}>
                  {packet.hopCount === 0 ? 'Direct (from victim phone)' : `${packet.hopCount} phone${packet.hopCount > 1 ? 's' : ''} away`}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity style={styles.callButton} onPress={callAmbulance}>
            <Ionicons name="call" size={24} color="#FFFFFF" />
            <Text style={styles.callButtonText}>Call {emergencyAmbulanceNumber} — Ambulance</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navigateButton} onPress={navigateTocrash}>
            <Ionicons name="navigate" size={20} color={Colors.brand.accent} />
            <Text style={styles.navigateButtonText}>Navigate to Crash Site</Text>
          </TouchableOpacity>

          {/* Legal reassurance */}
          <View style={styles.legalCard}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.brand.gold} />
            <Text style={styles.legalText}>
              <Text style={{ fontWeight: '700', color: Colors.brand.gold }}>Good Samaritan Law protects you.{'\n'}</Text>
              No police detention. You are eligible for ₹25,000 reward for helping.
              (Motor Vehicles Act, Section 134A)
            </Text>
          </View>

          {/* Incident ID for reference */}
          <Text style={styles.incidentId}>
            Incident ID: {packet.incidentId.toUpperCase()}
          </Text>

        </ScrollView>

        {/* Dismiss Button */}
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={styles.dismissText}>I cannot help right now</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0000',
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: 60,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  alertIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  alertTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.brand.primary,
    letterSpacing: 3,
    textAlign: 'center',
  },
  alertSubtitle: {
    fontSize: 14,
    color: Colors.text.muted,
    marginTop: 6,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    color: Colors.text.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginVertical: 4,
  },
  callButton: {
    backgroundColor: Colors.brand.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  callButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  navigateButton: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.brand.accent + '50',
  },
  navigateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.accent,
  },
  legalCard: {
    backgroundColor: Colors.brand.gold + '10',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.brand.gold + '30',
    padding: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  legalText: {
    fontSize: 13,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },
  incidentId: {
    fontSize: 10,
    color: Colors.text.muted,
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: Spacing.lg,
  },
  dismissButton: {
    backgroundColor: Colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    paddingVertical: 20,
    paddingBottom: 36,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    color: Colors.text.muted,
    fontWeight: '600',
  },
});