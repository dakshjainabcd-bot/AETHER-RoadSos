/**
 * BadgeCard.tsx — Displays one badge (earned or in progress)
 *
 * EARNED BADGE:
 * - Full color icon with golden border
 * - Shows the date it was earned
 * - Tappable to view the badge certificate
 *
 * LOCKED BADGE:
 * - Grayed out icon
 * - Progress bar showing current/threshold
 * - Not tappable (can't view certificate if not earned)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BadgeDefinition } from '../../services/Trust/BadgeTypes';
import { EarnedBadge } from '../../services/Trust/BadgeService';
import { Colors, BorderRadius, Shadows } from '../../theme';

interface BadgeCardProps {
  badge: BadgeDefinition;
  earnedBadge: EarnedBadge | null; // null = not yet earned
  progress: number;                 // current progress value
  onPress: (badgeId: string) => void;
}

export function BadgeCard({ badge, earnedBadge, progress, onPress }: BadgeCardProps) {
  const isEarned = earnedBadge !== null;

  // Show as "7/10" progress text, capped at threshold
  const progressValue = Math.min(progress, badge.threshold);
  const progressPercent = Math.min(
    100,
    Math.round((progressValue / badge.threshold) * 100)
  );

  // Format the earned date nicely
  const earnedDate = earnedBadge
    ? new Date(earnedBadge.earnedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isEarned ? styles.cardEarned : styles.cardLocked,
      ]}
      onPress={() => isEarned && onPress(badge.id)}
      activeOpacity={isEarned ? 0.75 : 1}
      disabled={!isEarned}
    >
      {/* Icon Circle */}
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: isEarned ? `${badge.color}25` : Colors.fill.tertiary },
        ]}
      >
        <Ionicons
          name={badge.icon as any}
          size={28}
          color={isEarned ? badge.color : Colors.label.tertiary}
        />
        {/* Checkmark badge for earned */}
        {isEarned && (
          <View style={[styles.checkBadge, { backgroundColor: badge.color }]}>
            <Ionicons name="checkmark" size={9} color="#FFF" />
          </View>
        )}
      </View>

      {/* Badge Name */}
      <Text
        style={[
          styles.badgeName,
          { color: isEarned ? Colors.label.primary : Colors.label.tertiary },
        ]}
        numberOfLines={2}
      >
        {badge.name}
      </Text>

      {/* Bottom: date if earned, progress bar if not */}
      {isEarned ? (
        <View style={styles.earnedRow}>
          <Ionicons name="star" size={10} color="#FFD700" />
          <Text style={styles.earnedDate}>{earnedDate}</Text>
        </View>
      ) : (
        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercent}%` as `${number}%` },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {progressValue}/{badge.threshold}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minHeight: 150,
    ...Shadows.xs,
  },
  cardEarned: {
    borderWidth: 1.5,
    borderColor: '#FFD700',
  },
  cardLocked: {
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    opacity: 0.75,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.background.elevated,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 16,
  },
  earnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  earnedDate: {
    fontSize: 10,
    color: '#B8860B',
    fontWeight: '600',
    textAlign: 'center',
  },
  progressSection: {
    width: '100%',
    gap: 3,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: Colors.fill.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.brand.accent,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 9,
    color: Colors.label.tertiary,
    fontWeight: '500',
  },
});