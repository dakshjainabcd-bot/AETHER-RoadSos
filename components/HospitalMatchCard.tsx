/**
 * HospitalMatchCard — Shows matched hospital + pre-alert status
 *
 * Shown on the SOS screen after injury type is selected.
 * Replaces InjuryTypeSelector once a hospital is found.
 *
 * States it displays:
 *   sending      → Pulsing "Alerting hospital..." row
 *   sent         → "Alert sent. Waiting for reply..."
 *   acknowledged → Green READY banner + ETA + Call button
 *   failed       → Red warning + "Try calling directly" button
 *   no_hospital  → Orange warning "No specialist hospital within range"
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PreAlertState } from '../services/HospitalPreAlert';
import { formatCapability } from '../services/TraumaMatch';
import { Colors, BorderRadius, Shadows } from '../theme';

interface HospitalMatchCardProps {
  alertState: PreAlertState;
  /** Whether this is a specialist match (vs generic fallback) */
  isSpecialistMatch?: boolean;
  /** Required capabilities that were searched for */
  requiredCapabilities?: string[];
}

export function HospitalMatchCard({
  alertState,
  isSpecialistMatch = true,
  requiredCapabilities = [],
}: HospitalMatchCardProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse the status dot while sending/sent
  useEffect(() => {
    if (alertState.status === 'sending' || alertState.status === 'sent') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [alertState.status]);

  if (alertState.status === 'idle') return null;

  if (alertState.status === 'no_hospital') {
    return (
      <View style={[styles.card, styles.cardWarning]}>
        <Ionicons name="warning-outline" size={20} color={Colors.status.warning} />
        <Text style={styles.warningText}>
          No specialist hospital found within 150 km.
          Please call 108 for dispatch guidance.
        </Text>
      </View>
    );
  }

  const isReady = alertState.status === 'acknowledged';
  const isFailed = alertState.status === 'failed';

  return (
    <View style={[styles.card, isReady && styles.cardReady, isFailed && styles.cardFailed]}>

      {/* ── Hospital name row ──────────────────────────────────────────── */}
      <View style={styles.nameRow}>
        {/* Hospital icon */}
        <View style={[styles.hospitalIcon, { backgroundColor: isReady ? `${Colors.status.success}15` : Colors.fill.tertiary }]}>
          <Ionicons
            name="medical"
            size={18}
            color={isReady ? Colors.status.success : Colors.brand.primary}
          />
        </View>

        <View style={styles.nameBlock}>
          <Text style={styles.hospitalName} numberOfLines={2}>
            {alertState.hospitalName}
          </Text>
          <View style={styles.distRow}>
            <Ionicons name="location-outline" size={11} color={Colors.label.tertiary} />
            <Text style={styles.distText}>
              {alertState.distanceText} · ETA {alertState.etaMinutes} min
            </Text>
          </View>
        </View>

        {/* ETA badge */}
        <View style={[styles.etaBadge, { backgroundColor: isReady ? `${Colors.status.success}15` : Colors.fill.secondary }]}>
          <Text style={[styles.etaNumber, { color: isReady ? Colors.status.success : Colors.label.primary }]}>
            {alertState.etaMinutes}
          </Text>
          <Text style={[styles.etaUnit, { color: isReady ? Colors.status.success : Colors.label.tertiary }]}>min</Text>
        </View>
      </View>

      {/* ── Required capabilities row ──────────────────────────────────── */}
      {requiredCapabilities.length > 0 && (
        <View style={styles.capsRow}>
          {requiredCapabilities.map((cap) => (
            <View key={cap} style={styles.capBadge}>
              <Text style={styles.capText}>{formatCapability(cap)}</Text>
            </View>
          ))}
          {!isSpecialistMatch && (
            <View style={[styles.capBadge, styles.capBadgeFallback]}>
              <Text style={[styles.capText, { color: Colors.status.warning }]}>Fallback</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Status row ────────────────────────────────────────────────── */}
      <View style={styles.statusRow}>
        {/* Animated status dot */}
        <Animated.View
          style={[
            styles.statusDot,
            {
              backgroundColor: isReady
                ? Colors.status.success
                : isFailed
                ? Colors.status.danger
                : Colors.brand.gold,
              opacity: pulseAnim,
            },
          ]}
        />

        <Text
          style={[
            styles.statusText,
            {
              color: isReady
                ? Colors.status.success
                : isFailed
                ? Colors.status.danger
                : Colors.label.secondary,
            },
          ]}
        >
          {isReady
            ? '✓  Hospital READY — trauma team alerted'
            : isFailed
            ? '⚠️  Alert failed — call hospital directly'
            : alertState.status === 'sending'
            ? 'Alerting hospital...'
            : 'Alert sent — waiting for hospital reply...'}
        </Text>
      </View>

      {/* ── Action buttons ────────────────────────────────────────────── */}
      <View style={styles.actions}>
        {/* Always show Call Hospital */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: `${Colors.status.success}12`, borderColor: `${Colors.status.success}30` }]}
          onPress={() => Linking.openURL(`tel:${alertState.hospitalPhone}`)}
          activeOpacity={0.7}
        >
          <Ionicons name="call" size={14} color={Colors.status.success} />
          <Text style={[styles.btnText, { color: Colors.status.success }]}>Call Hospital</Text>
        </TouchableOpacity>

        {/* Navigate to hospital */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: `${Colors.brand.accent}10`, borderColor: `${Colors.brand.accent}25` }]}
          onPress={() => {
            // In production: we have the hospital lat/lng from HospitalMatch
            // For demo we open a search by name
            const query = encodeURIComponent(alertState.hospitalName);
            Linking.openURL(`https://maps.google.com/?q=${query}`).catch(() => {});
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="navigate-outline" size={14} color={Colors.brand.accent} />
          <Text style={[styles.btnText, { color: Colors.brand.accent }]}>Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: 12,
    ...Shadows.sm,
  },
  cardReady: {
    borderColor: `${Colors.status.success}40`,
    backgroundColor: `${Colors.status.success}06`,
  },
  cardFailed: {
    borderColor: `${Colors.status.danger}40`,
  },
  cardWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderColor: `${Colors.status.warning}40`,
    backgroundColor: `${Colors.status.warning}08`,
  },

  // Hospital name row
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hospitalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBlock: {
    flex: 1,
    gap: 3,
  },
  hospitalName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.2,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distText: {
    fontSize: 11,
    color: Colors.label.tertiary,
  },

  // ETA badge (top right)
  etaBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: BorderRadius.md,
    minWidth: 48,
  },
  etaNumber: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  etaUnit: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Capability badges
  capsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  capBadge: {
    backgroundColor: Colors.fill.tertiary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  capBadgeFallback: {
    backgroundColor: `${Colors.status.warning}15`,
  },
  capText: {
    fontSize: 10,
    color: Colors.label.secondary,
    fontWeight: '500',
  },

  // Status row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },

  // Action buttons
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  warningText: {
    flex: 1,
    fontSize: 13,
    color: Colors.status.warning,
    lineHeight: 18,
  },
});