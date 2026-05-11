/**
 * GoldenHourClock — Time Since Incident Counter
 *
 * WHY THIS MATTERS:
 * The "golden hour" is a medical concept: trauma patients who receive
 * definitive care within 60 minutes of injury have dramatically better
 * survival rates. By showing this clock to the bystander, ambulance,
 * AND hospital simultaneously (via cloud), all parties understand
 * the urgency level without needing to ask.
 *
 * The clock counts UP from the moment of crash detection (not from when
 * the bystander opened the app). This is critical — it reflects true
 * elapsed time without reset.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '../../theme';

interface GoldenHourClockProps {
  incidentTimestamp: number; // Unix ms when crash was detected
  compact?: boolean;         // true = small pill for header, false = large display
}

export function GoldenHourClock({ incidentTimestamp, compact = false }: GoldenHourClockProps) {
  const [elapsedMs, setElapsedMs] = useState(Date.now() - incidentTimestamp);

  useEffect(() => {
    // Update every second
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - incidentTimestamp);
    }, 1000);

    return () => clearInterval(interval);
  }, [incidentTimestamp]);

  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // Golden hour = 3600 seconds. Remaining = how long until the hour is up.
  const GOLDEN_HOUR_SECONDS = 3600;
  const remaining = Math.max(GOLDEN_HOUR_SECONDS - totalSeconds, 0);
  const remainingMin = Math.floor(remaining / 60);
  const remainingSec = remaining % 60;

  // Color changes as time runs out
  const isUrgent = minutes >= 30; // Red after 30 minutes
  const isWarning = minutes >= 15 && !isUrgent; // Orange after 15 minutes
  const color = isUrgent
    ? Colors.brand.primary
    : isWarning
    ? Colors.brand.gold
    : Colors.status.success;

  if (compact) {
    // Small version for the screen header
    return (
      <View style={[styles.pill, { borderColor: `${color}40`, backgroundColor: `${color}15` }]}>
        <Ionicons name="timer-outline" size={11} color={color} />
        <Text style={[styles.pillText, { color }]}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </Text>
      </View>
    );
  }

  // Large version for display within screen
  return (
    <View style={[styles.card, { borderColor: `${color}30` }]}>
      <View style={styles.cardTop}>
        <Ionicons name="timer" size={18} color={color} />
        <Text style={[styles.cardTitle, { color }]}>Golden Hour</Text>
      </View>

      <View style={styles.timesRow}>
        <View style={styles.timeBlock}>
          <Text style={[styles.timeValue, { color }]}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </Text>
          <Text style={styles.timeLabel}>ELAPSED</Text>
        </View>

        <View style={styles.timeDivider} />

        <View style={styles.timeBlock}>
          <Text style={[styles.timeValue, { color: Colors.label.secondary }]}>
            {String(remainingMin).padStart(2, '0')}:{String(remainingSec).padStart(2, '0')}
          </Text>
          <Text style={styles.timeLabel}>REMAINING</Text>
        </View>
      </View>

      {isUrgent && (
        <Text style={styles.urgentNote}>
          ⚠ Over 30 minutes — hospital pre-alert critical
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Compact pill for header
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Full card
  card: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBlock: {
    flex: 1,
    alignItems: 'center',
  },
  timeDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border.subtle,
  },
  timeValue: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  timeLabel: {
    fontSize: 9,
    color: Colors.label.tertiary,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 2,
  },
  urgentNote: {
    fontSize: 11,
    color: Colors.brand.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
});