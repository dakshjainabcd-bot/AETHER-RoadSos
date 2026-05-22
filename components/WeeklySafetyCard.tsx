/**
 * WeeklySafetyCard — Phase 12 Home Screen Widget
 *
 * Shows the driver's weekly safety score, trend, and coaching tip.
 * Has a "Simulate Trip" button for demo/hackathon testing.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { weeklyScoreService } from '../services/DriverIntelligence/WeeklyScoreService';
import { tripScoreService } from '../services/DriverIntelligence/TripScoreService';
import { WeeklySummary } from '../services/DriverIntelligence/types';
import { Colors, BorderRadius, Shadows } from '../theme';

export function WeeklySafetyCard() {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    loadSummary();
  }, []);

  async function loadSummary() {
    setLoading(true);
    try {
      const s = await weeklyScoreService.getWeeklySummary();
      setSummary(s);
    } catch (err) {
      console.error('[WeeklySafetyCard] Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSimulateTrip() {
    setSimulating(true);
    try {
      await tripScoreService.simulateTrip();
      // Reload summary after simulation
      await loadSummary();
      Alert.alert('Trip Simulated!', 'A demo trip score has been added. Check your updated weekly score.');
    } catch (err) {
      Alert.alert('Error', 'Could not simulate trip.');
    } finally {
      setSimulating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={Colors.brand.primary} />
      </View>
    );
  }

  if (!summary) return null;

  // Score color: green above 80, amber 60-79, red below 60
  const scoreColor =
    summary.weekScore >= 80 ? Colors.status.success :
    summary.weekScore >= 60 ? Colors.status.warning :
    summary.weekScore > 0 ? Colors.brand.primary :
    Colors.label.tertiary;

  const trendIcon =
    summary.trend === 'up' ? 'trending-up' :
    summary.trend === 'down' ? 'trending-down' :
    'remove';

  const trendColor =
    summary.trend === 'up' ? Colors.status.success :
    summary.trend === 'down' ? Colors.brand.primary :
    Colors.label.tertiary;

  const hasData = summary.weekScore > 0;

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="car-sport" size={16} color={Colors.brand.accent} />
          <Text style={styles.headerTitle}>Weekly Safety Score</Text>
        </View>
        {summary.streakDays > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {summary.streakDays}d streak</Text>
          </View>
        )}
      </View>

      {/* Score display */}
      {hasData ? (
        <>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNumber, { color: scoreColor }]}>
              {summary.weekScore}
            </Text>
            <Text style={styles.scoreMax}>/100</Text>

            {/* Trend arrow (only if we have data for comparison) */}
            {summary.tripCount > 0 && summary.lastWeekScore > 0 && (
              <View style={styles.trendBadge}>
                <Ionicons name={trendIcon as any} size={14} color={trendColor} />
                {summary.trendPoints > 0 && (
                  <Text style={[styles.trendText, { color: trendColor }]}>
                    {summary.trendPoints}pts
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${summary.weekScore}%` as any,
                  backgroundColor: scoreColor,
                },
              ]}
            />
          </View>

          {/* Trip count */}
          <Text style={styles.tripCount}>
            {summary.tripCount} trip{summary.tripCount !== 1 ? 's' : ''} this week
          </Text>

          {/* Tip */}
          <View style={styles.tipBox}>
            <Ionicons name="bulb-outline" size={13} color={Colors.brand.gold} />
            <Text style={styles.tipText} numberOfLines={2}>
              {summary.latestTip}
            </Text>
          </View>
        </>
      ) : (
        /* No data state */
        <View style={styles.noDataBox}>
          <Text style={styles.noDataText}>
            No trips recorded yet this week.
          </Text>
          <Text style={styles.noDataSub}>
            Drive to get your first safety score!
          </Text>
        </View>
      )}

      {/* Demo button (always visible for hackathon) */}
      <TouchableOpacity
        style={styles.demoBtn}
        onPress={handleSimulateTrip}
        disabled={simulating}
        activeOpacity={0.7}
      >
        {simulating
          ? <ActivityIndicator size="small" color={Colors.label.secondary} />
          : (
            <>
              <Ionicons name="flask-outline" size={12} color={Colors.label.secondary} />
              <Text style={styles.demoBtnText}>Simulate a Trip (Demo)</Text>
            </>
          )
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    ...Shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.2,
  },
  streakBadge: {
    backgroundColor: `${Colors.status.warning}15`,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${Colors.status.warning}30`,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.status.warning,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 10,
  },
  scoreNumber: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 56,
  },
  scoreMax: {
    fontSize: 18,
    color: Colors.label.tertiary,
    fontWeight: '500',
    marginBottom: 4,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 8,
    backgroundColor: Colors.background.secondary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.fill.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  tripCount: {
    fontSize: 12,
    color: Colors.label.tertiary,
    marginBottom: 12,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: `${Colors.brand.gold}10`,
    borderRadius: BorderRadius.md,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: `${Colors.brand.gold}25`,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: Colors.label.primary,
    lineHeight: 17,
  },
  noDataBox: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.label.secondary,
    marginBottom: 4,
  },
  noDataSub: {
    fontSize: 12,
    color: Colors.label.tertiary,
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border.subtle,
    marginTop: 4,
  },
  demoBtnText: {
    fontSize: 11,
    color: Colors.label.tertiary,
    fontWeight: '500',
  },
});