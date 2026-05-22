/**
 * TripSummaryModal — Phase 12
 *
 * Appears from the bottom of the screen when a trip ends.
 * Shows score, events breakdown, and coaching tip.
 *
 * WHEN IT APPEARS:
 * In _layout.tsx, tripScoreService.onTripComplete() fires.
 * _layout.tsx updates latestTripScore state.
 * This component receives that state and shows itself.
 */

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TripScore } from '../services/DriverIntelligence/types';
import { Colors, BorderRadius, Shadows } from '../theme';

interface TripSummaryModalProps {
  visible: boolean;
  tripScore: TripScore | null;
  onDismiss: () => void;
}

export function TripSummaryModal({ visible, tripScore, onDismiss }: TripSummaryModalProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!tripScore) return null;

  const score = tripScore.score;
  const scoreColor =
    score >= 80 ? Colors.status.success :
    score >= 60 ? Colors.status.warning :
    Colors.brand.primary;

  const scoreEmoji =
    score >= 95 ? '🌟' :
    score >= 80 ? '✅' :
    score >= 60 ? '⚠️' : '❌';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} onPress={onDismiss} activeOpacity={1} />

      {/* Bottom sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <Text style={styles.heading}>Trip Complete! {scoreEmoji}</Text>

        {/* Score circle */}
        <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
          <Text style={[styles.scoreNum, { color: scoreColor }]}>{score}</Text>
          <Text style={styles.scoreLabel}>out of 100</Text>
        </View>

        {/* Events breakdown */}
        <View style={styles.eventsRow}>
          <EventChip
            icon="close-circle"
            count={tripScore.events.hardBrakes}
            label="Hard Brakes"
            color={Colors.brand.primary}
          />
          <EventChip
            icon="swap-horizontal"
            count={tripScore.events.swerves}
            label="Swerves"
            color={Colors.status.warning}
          />
          <EventChip
            icon="refresh"
            count={tripScore.events.headingChanges}
            label="Sharp Turns"
            color={Colors.status.info}
          />
        </View>

        {/* Extras */}
        <View style={styles.extrasRow}>
          {tripScore.isNightDriving && (
            <View style={styles.extraBadge}>
              <Ionicons name="moon" size={12} color={Colors.brand.purple} />
              <Text style={styles.extraText}>Night Driving</Text>
            </View>
          )}
          {tripScore.events.hardBrakes + tripScore.events.swerves + tripScore.events.headingChanges === 0 && (
            <View style={[styles.extraBadge, { backgroundColor: `${Colors.status.success}12` }]}>
              <Ionicons name="star" size={12} color={Colors.status.success} />
              <Text style={[styles.extraText, { color: Colors.status.success }]}>Clean Trip!</Text>
            </View>
          )}
        </View>

        {/* Tip */}
        <View style={styles.tipBox}>
          <Ionicons name="bulb-outline" size={14} color={Colors.brand.gold} />
          <Text style={styles.tipText}>{tripScore.tip}</Text>
        </View>

        {/* Dismiss */}
        <TouchableOpacity style={styles.okBtn} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={styles.okBtnText}>Got it!</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

function EventChip({ icon, count, label, color }: {
  icon: string; count: number; label: string; color: string;
}) {
  return (
    <View style={[styles.eventChip, { borderColor: `${color}30` }]}>
      <Ionicons name={icon as any} size={16} color={count > 0 ? color : Colors.label.tertiary} />
      <Text style={[styles.eventCount, { color: count > 0 ? color : Colors.label.tertiary }]}>
        {count}
      </Text>
      <Text style={styles.eventLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background.elevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
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
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.label.primary,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 20,
  },
  scoreCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  scoreNum: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 56,
  },
  scoreLabel: {
    fontSize: 12,
    color: Colors.label.tertiary,
    fontWeight: '500',
  },
  eventsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  eventChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    gap: 4,
    backgroundColor: Colors.background.secondary,
  },
  eventCount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  eventLabel: {
    fontSize: 9,
    color: Colors.label.tertiary,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  extrasRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  extraBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${Colors.brand.purple}12`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  extraText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.brand.purple,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: `${Colors.brand.gold}10`,
    borderRadius: BorderRadius.lg,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${Colors.brand.gold}25`,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: Colors.label.primary,
    lineHeight: 19,
  },
  okBtn: {
    backgroundColor: Colors.brand.accent,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    alignItems: 'center',
    ...Shadows.sm,
  },
  okBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});