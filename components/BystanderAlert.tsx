/**
 * BystanderAlert — Premium Light-theme full-screen modal
 *
 * Shown when a crash is detected within 500m.
 * White card design matching the new light iOS aesthetic.
 * Emergency red accent for urgency.
 * Logic unchanged from original.
 */

import React, { useEffect, useRef } from 'react';
import { router } from 'expo-router';
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
import { Colors, BorderRadius, Shadows, Layout } from '../theme';

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
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim  = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!packet) return;

    Vibration.vibrate([0, 300, 100, 300, 100, 300]);

    // Slide-in entrance
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // Pulse the alert icon
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      pulse.stop();
      Vibration.cancel();
      slideAnim.setValue(60);
      opacityAnim.setValue(0);
    };
  }, [packet]);

  if (!packet) return null;

  const distanceText =
    distanceM < 1000
      ? `${Math.round(distanceM)} m away`
      : `${(distanceM / 1000).toFixed(1)} km away`;

  const minutesAgo = Math.round((Date.now() - packet.timestamp) / 60000);
  const timeText   = minutesAgo === 0 ? 'Just now' : `${minutesAgo} min ago`;

  const severityLabels = ['', 'Minor', 'Moderate', 'Serious', 'Severe', 'Critical'];
  const severityColors = ['', Colors.status.success, Colors.status.warning, '#FF6B35', Colors.brand.primary, '#CC0000'];
  const severityLabel  = severityLabels[packet.severity] ?? 'Unknown';
  const severityColor  = severityColors[packet.severity] ?? Colors.brand.primary;

  function handleOpenBystAI() {
    router.push({
      pathname: '/bystander' as any,
      params: { incidentTimestamp: packet!.timestamp.toString() },
    });
  }

  return (
    <Modal visible={!!packet} animationType="none" transparent statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]} />

      {/* Bottom sheet card */}
      <View style={styles.sheetWrap}>
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Sheet handle */}
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Alert header */}
            <View style={styles.alertHeader}>
              <Animated.View
                style={[styles.alertIconWrap, { transform: [{ scale: pulseAnim }] }]}
              >
                <Ionicons name="warning" size={28} color="#FFFFFF" />
              </Animated.View>
              <View style={styles.alertHeaderText}>
                <Text style={styles.alertTitle}>Accident Nearby</Text>
                <Text style={styles.alertSub}>AETHER detected a crash</Text>
              </View>
            </View>

            {/* Info cards — two-col grid */}
            <View style={styles.infoGrid}>
              <InfoTile icon="location" color={Colors.brand.accent} label="Distance" value={distanceText} />
              <InfoTile icon="time"     color={Colors.label.secondary} label="Reported" value={timeText} />
              <InfoTile icon="pulse"    color={severityColor}          label="Severity"  value={`${severityLabel} (${packet.severity}/5)`} valueColor={severityColor} />
              <InfoTile icon="git-branch" color={Colors.label.secondary} label="Via" value={packet.hopCount === 0 ? 'Direct' : `${packet.hopCount} relay hop${packet.hopCount > 1 ? 's' : ''}`} />
            </View>

            {/* Primary CTA */}
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => Linking.openURL(`tel:${emergencyAmbulanceNumber}`)}
              activeOpacity={0.85}
            >
              <Ionicons name="call" size={20} color="#FFFFFF" />
              <Text style={styles.callBtnText}>Call {emergencyAmbulanceNumber} — Ambulance</Text>
            </TouchableOpacity>

            {/* Navigate */}
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => {
                const url = `geo:${packet.lat},${packet.lng}?q=${packet.lat},${packet.lng}(Accident)`;
                Linking.openURL(url).catch(() =>
                  Linking.openURL(`https://maps.google.com/?q=${packet.lat},${packet.lng}`)
                );
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="navigate-outline" size={18} color={Colors.brand.accent} />
              <Text style={styles.navBtnText}>Navigate to Crash Site</Text>
            </TouchableOpacity>

            {/* BystAI — First Aid Coach */}
            <TouchableOpacity
              style={styles.bystAIBtn}
              onPress={handleOpenBystAI}
              activeOpacity={0.85}
            >
              <Ionicons name="medical" size={20} color={Colors.status.success} />
              <Text style={styles.bystAIBtnText}>Guide Me — First Aid Coach</Text>
            </TouchableOpacity>

            {/* Good Samaritan banner */}
            <View style={styles.samaritanCard}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.brand.gold} />
              <Text style={styles.samaritanText}>
                <Text style={{ fontWeight: '700', color: Colors.brand.gold }}>
                  Good Samaritan Law protects you.{'\n'}
                </Text>
                No police detention. Eligible for ₹25,000 reward. (MV Act §134A)
              </Text>
            </View>

            {/* Incident ID */}
            <Text style={styles.incidentId}>ID: {packet.incidentId.toUpperCase()}</Text>
          </ScrollView>

          {/* Dismiss */}
          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.dismissText}>I cannot help right now</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Sub-component ───────────────────────────────────────────────────────────

function InfoTile({
  icon, color, label, value, valueColor,
}: {
  icon: string; color: string; label: string; value: string; valueColor?: string;
}) {
  return (
    <View style={styles.infoTile}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={styles.infoTileLabel}>{label}</Text>
      <Text style={[styles.infoTileValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.40)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background.elevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    maxHeight: '92%',
    ...Shadows.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.separator.opaque,
    alignSelf: 'center',
    marginBottom: 20,
  },

  // Alert header
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  alertIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 8,
  },
  alertHeaderText: { flex: 1 },
  alertTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.4,
  },
  alertSub: {
    fontSize: 13,
    color: Colors.label.secondary,
    marginTop: 2,
  },

  // Info grid
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  infoTile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.background.grouped,
    borderRadius: BorderRadius.lg,
    padding: 14,
    gap: 4,
  },
  infoTileLabel: {
    fontSize: 11,
    color: Colors.label.secondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  infoTileValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.label.primary,
    letterSpacing: -0.2,
  },

  // Buttons
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.brand.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 14,
    elevation: 10,
  },
  callBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${Colors.brand.accent}0F`,
    borderRadius: BorderRadius.xl,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: `${Colors.brand.accent}25`,
    marginBottom: 16,
  },
  navBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.accent,
  },

  bystAIBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${Colors.status.success}12`,
    borderRadius: BorderRadius.xl,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: `${Colors.status.success}30`,
    marginBottom: 12,
  },
  bystAIBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.status.success,
  },

  // Good Samaritan
  samaritanCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: `${Colors.brand.gold}0F`,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: `${Colors.brand.gold}25`,
    padding: 14,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  samaritanText: {
    flex: 1,
    fontSize: 13,
    color: Colors.label.primary,
    lineHeight: 19,
  },

  incidentId: {
    fontSize: 10,
    color: Colors.label.tertiary,
    textAlign: 'center',
    fontFamily: 'Courier',
    marginBottom: 16,
  },

  // Dismiss
  dismissBtn: {
    paddingVertical: 16,
    paddingBottom: 32,
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: Colors.border.subtle,
    marginTop: 4,
  },
  dismissText: {
    fontSize: 15,
    color: Colors.label.secondary,
    fontWeight: '500',
  },
});