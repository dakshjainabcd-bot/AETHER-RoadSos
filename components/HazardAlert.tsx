/**
 * HazardAlert — Phase 12 (Updated with report count credibility)
 *
 * Shows report count and credibility level so drivers know whether
 * to trust the warning ("1 person" vs "5 people reported this").
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  Vibration,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '../theme';
import { HazardAlertState, HazardType } from '../services/DriverIntelligence/types';

interface HazardAlertProps {
  alert: HazardAlertState | null;
  onDismiss: () => void;
}

const HAZARD_DISPLAY: Record<HazardType, { icon: string; label: string; color: string }> = {
  pothole:     { icon: '🕳️', label: 'POTHOLE AHEAD',     color: Colors.status.warning },
  accident:    { icon: '💥', label: 'ACCIDENT REPORTED', color: Colors.brand.primary  },
  road_closed: { icon: '🚧', label: 'ROAD CLOSED AHEAD', color: Colors.brand.primary  },
  debris:      { icon: '🪨', label: 'DEBRIS ON ROAD',    color: Colors.status.warning },
};

const CREDIBILITY_CONFIG = {
  low: {
    color: '#8E8E93',
    bg: 'rgba(142,142,147,0.12)',
    border: 'rgba(142,142,147,0.30)',
    label: 'Unverified',
    icon: 'help-circle-outline' as const,
  },
  medium: {
    color: Colors.status.warning,
    bg: 'rgba(255,149,0,0.12)',
    border: 'rgba(255,149,0,0.35)',
    label: 'Likely Real',
    icon: 'warning-outline' as const,
  },
  high: {
    color: '#FF3B30',
    bg: 'rgba(255,59,48,0.12)',
    border: 'rgba(255,59,48,0.35)',
    label: 'Confirmed',
    icon: 'alert-circle' as const,
  },
};

const AUTO_DISMISS_MS = 8000;

export function HazardAlert({ alert, onDismiss }: HazardAlertProps) {
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (alert) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Stronger vibration for high-credibility hazards
      if (alert.credibilityLevel === 'high') {
        Vibration.vibrate([0, 200, 100, 200]);
      } else {
        Vibration.vibrate([0, 120, 80, 120]);
      }

      autoDismissTimer.current = setTimeout(() => {
        dismiss();
      }, AUTO_DISMISS_MS);
    } else {
      dismiss();
    }

    return () => {
      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    };
  }, [alert?.packet.hazardId]);

  function dismiss() {
    if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -120, duration: 280, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }

  if (!alert) return null;

  const { packet, distanceM, reportCount, credibilityLevel } = alert;
  const config = HAZARD_DISPLAY[packet.hazardType];
  const credConfig = CREDIBILITY_CONFIG[credibilityLevel];
  const distText = distanceM < 1000 ? `${distanceM}m` : `${(distanceM / 1000).toFixed(1)}km`;
  const minutesAgo = Math.round((Date.now() - packet.reportedAt) / 60000);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
          borderColor: credConfig.border,
          backgroundColor: credConfig.bg,
        },
      ]}
    >
      {/* Left: Emoji */}
      <Text style={styles.emoji}>{config.icon}</Text>

      {/* Middle: Details */}
      <View style={styles.textBlock}>
        {/* Hazard type + credibility badge on same line */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: config.color }]}>{config.label}</Text>
          <View style={[styles.credBadge, { backgroundColor: `${credConfig.color}20` }]}>
            <Ionicons name={credConfig.icon} size={10} color={credConfig.color} />
            <Text style={[styles.credLabel, { color: credConfig.color }]}>
              {credConfig.label}
            </Text>
          </View>
        </View>

        {/* Distance */}
        <Text style={styles.subtitle}>
          {distText} away{minutesAgo > 0 ? ` · ${minutesAgo}m ago` : ' · Just now'}
        </Text>

        {/* Report count — the key new element */}
        <View style={styles.reportRow}>
          <Ionicons name="people" size={12} color={credConfig.color} />
          <Text style={[styles.reportCount, { color: credConfig.color }]}>
            {reportCount === 1
              ? '1 person reported this'
              : `${reportCount} people reported this`}
          </Text>
        </View>

        <Text style={styles.meta}>
          Via AETHER mesh · {packet.hopCount} hop{packet.hopCount !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Right: Dismiss */}
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={18} color={Colors.label.tertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 140 : 118,
    left: 16,
    right: 16,
    zIndex: 9998,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  emoji: {
    fontSize: 28,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  credBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  credLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reportCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    fontSize: 10,
    color: Colors.label.tertiary,
  },
});