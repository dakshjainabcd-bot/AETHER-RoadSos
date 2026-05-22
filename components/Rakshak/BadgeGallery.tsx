/**
 * BadgeGallery.tsx — Full badge display for the Rakshak Dashboard
 *
 * Shows:
 * 1. Trust Score Card (your mesh reputation score)
 * 2. 2-column grid of all 8 badges
 * 3. Celebration banner if all badges are earned
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { BADGE_DEFINITIONS } from '../../services/Trust/BadgeTypes';
import {
  badgeService,
  EarnedBadge,
  BadgeProgressMap,
} from '../../services/Trust/BadgeService';
import { trustScoreService } from '../../services/Trust/TrustScoreService';
import { BadgeCard } from './BadgeCard';
import { Colors, BorderRadius, Shadows } from '../../theme';

export function BadgeGallery() {
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [progress, setProgress] = useState<BadgeProgressMap>({});
  const [trustScore, setTrustScore] = useState(50);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [earned, prog, score] = await Promise.all([
        badgeService.getEarnedBadges(),
        badgeService.getProgress(),
        trustScoreService.getMyScore(),
      ]);
      setEarnedBadges(earned);
      setProgress(prog);
      setTrustScore(score);
    } catch (err) {
      console.error('[BadgeGallery] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBadgePress = (badgeId: string) => {
    // Navigate to the badge certificate screen, passing the badge ID as a param
    router.push({ pathname: '/badge-certificate', params: { badgeId } });
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={Colors.brand.primary} />
      </View>
    );
  }

  const earnedCount = earnedBadges.length;

  // Determine trust score color
  const trustColor =
    trustScore >= 75
      ? Colors.status.success
      : trustScore >= 50
      ? Colors.brand.gold
      : Colors.brand.primary;

  // Build rows of 2 badges each
  const badgeRows: (typeof BADGE_DEFINITIONS)[] = [];
  for (let i = 0; i < BADGE_DEFINITIONS.length; i += 2) {
    badgeRows.push(BADGE_DEFINITIONS.slice(i, i + 2));
  }

  return (
    <View style={styles.container}>
      {/* ── Trust Score Card ────────────────────────────────────────────── */}
      <View style={styles.trustCard}>
        <View style={styles.trustInfo}>
          <Text style={styles.trustLabel}>MESH TRUST SCORE</Text>
          <Text style={[styles.trustScore, { color: trustColor }]}>
            {trustScore}
            <Text style={styles.trustMax}>/100</Text>
          </Text>
          <Text style={styles.trustDesc}>
            {trustScore >= 75
              ? '🏆 High trust — preferred relay node'
              : trustScore >= 50
              ? '✅ Good standing in the mesh network'
              : '⚠️ Low trust — help more to rebuild'}
          </Text>
        </View>
        {/* Visual trust bar */}
        <View style={styles.trustBarContainer}>
          <View style={styles.trustBarTrack}>
            <View
              style={[
                styles.trustBarFill,
                {
                  height: `${trustScore}%` as `${number}%`,
                  backgroundColor: trustColor,
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* ── Badge Section Header ─────────────────────────────────────────── */}
      <View style={styles.badgeHeader}>
        <Text style={styles.sectionTitle}>YOUR BADGES</Text>
        <View style={[styles.countChip, { backgroundColor: `${Colors.brand.gold}15` }]}>
          <Text style={[styles.countText, { color: Colors.brand.gold }]}>
            {earnedCount}/{BADGE_DEFINITIONS.length} earned
          </Text>
        </View>
      </View>

      {/* ── 2-Column Badge Grid ──────────────────────────────────────────── */}
      {badgeRows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.badgeRow}>
          {row.map((badgeDef) => {
            const earned = earnedBadges.find((e) => e.badgeId === badgeDef.id) ?? null;
            const prog = progress[badgeDef.id] ?? 0;
            return (
              <BadgeCard
                key={badgeDef.id}
                badge={badgeDef}
                earnedBadge={earned}
                progress={prog}
                onPress={handleBadgePress}
              />
            );
          })}
        </View>
      ))}

      {/* ── All Earned Celebration ───────────────────────────────────────── */}
      {earnedCount === BADGE_DEFINITIONS.length && (
        <View style={styles.allEarnedBanner}>
          <Text style={styles.allEarnedText}>
            🎉 Incredible! You've earned all 8 badges. You are a true AETHER
            Guardian — a life-saving hero of the road.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },

  loadingWrap: { paddingVertical: 20, alignItems: 'center' },

  // Trust Score Card
  trustCard: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    ...Shadows.sm,
  },
  trustInfo: { flex: 1, gap: 4 },
  trustLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.label.tertiary,
    letterSpacing: 1,
  },
  trustScore: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  trustMax: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.label.tertiary,
  },
  trustDesc: {
    fontSize: 11,
    color: Colors.label.secondary,
    lineHeight: 16,
  },
  trustBarContainer: { alignItems: 'center' },
  trustBarTrack: {
    width: 20,
    height: 80,
    backgroundColor: Colors.fill.tertiary,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  trustBarFill: {
    width: '100%',
    borderRadius: 10,
    minHeight: 4,
  },

  // Badge section
  badgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.label.secondary,
    letterSpacing: 0.8,
  },
  countChip: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: { fontSize: 11, fontWeight: '600' },

  badgeRow: { flexDirection: 'row', gap: 10 },

  // All earned banner
  allEarnedBanner: {
    backgroundColor: `${'#FFD700'}12`,
    borderRadius: BorderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: `${'#FFD700'}35`,
  },
  allEarnedText: {
    fontSize: 13,
    color: '#8B6914',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
});