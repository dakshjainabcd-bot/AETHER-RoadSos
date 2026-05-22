/**
 * HazardAlert — Phase 12
 *
 * Slides in from the top when a mesh-relayed hazard packet arrives
 * and the hazard is within 3km of the current location.
 *
 * VISUAL DIFFERENCE FROM BlackspotAlert:
 * - BlackspotAlert: red/orange/yellow circles on map (known danger zones)
 * - HazardAlert: blue banner (live report from another driver right now)
 *
 * Positioned slightly lower than BlackspotAlert to avoid overlap
 * if both happen to be visible simultaneously.
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
  pothole:    { icon: '🕳️', label: 'POTHOLE AHEAD',     color: Colors.status.warning },
  accident:   { icon: '💥', label: 'ACCIDENT REPORTED', color: Colors.brand.primary  },
  road_closed:{ icon: '🚧', label: 'ROAD CLOSED AHEAD', color: Colors.brand.primary  },
  debris:     { icon: '🪨', label: 'DEBRIS ON ROAD',    color: Colors.status.warning },
};

const AUTO_DISMISS_MS = 8000;

export function HazardAlert({ alert, onDismiss }: HazardAlertProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (alert) {
      // Slide in
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

      // Short double buzz to alert driver without startling
      Vibration.vibrate([0, 120, 80, 120]);

      // Auto-dismiss after 8 seconds
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
      Animated.timing(slideAnim, { toValue: -100, duration: 280, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }

  if (!alert) return null;

  const { packet, distanceM } = alert;
  const config = HAZARD_DISPLAY[packet.hazardType];
  const distText = distanceM < 1000 ? `${distanceM}m` : `${(distanceM / 1000).toFixed(1)}km`;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <Text style={styles.emoji}>{config.icon}</Text>

      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: config.color }]}>{config.label}</Text>
        <Text style={styles.subtitle}>
          {distText} away · reported {Math.round((Date.now() - packet.reportedAt) / 60000)}min ago
        </Text>
        <Text style={styles.meta}>Via AETHER mesh relay · {packet.hopCount} hop{packet.hopCount !== 1 ? 's' : ''}</Text>
      </View>

      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={18} color={Colors.label.tertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // Position below BlackspotAlert (which is at ~54px on iOS)
    top: Platform.OS === 'ios' ? 140 : 118,
    left: 16,
    right: 16,
    zIndex: 9998, // Slightly below BlackspotAlert's 9999
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.background.elevated,
    padding: 14,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: `${Colors.brand.accent}40`,
    shadowColor: Colors.brand.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
  },
  emoji: {
    fontSize: 26,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.label.primary,
    fontWeight: '500',
  },
  meta: {
    fontSize: 10,
    color: Colors.label.tertiary,
    marginTop: 1,
  },
});