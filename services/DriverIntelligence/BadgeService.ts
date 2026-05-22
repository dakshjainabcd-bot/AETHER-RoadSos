/**
 * Phase 12 — BadgeService
 *
 * Checks streak data and awards badges when thresholds are crossed.
 * Badges are stored in AsyncStorage — they persist forever once earned.
 *
 * WHY ONLY ON TRIP COMPLETE?
 * We check for new badges only when a trip ends (called from _layout.tsx).
 * This keeps battery usage minimal — no background badge polling.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Badge, BadgeType, DRIVER_INTEL_STORAGE_KEYS } from './types';
import { weeklyScoreService } from './WeeklyScoreService';

const BADGE_DEFINITIONS: Record<BadgeType, Omit<Badge, 'earnedAt'>> = {
  safe_7_days: {
    type: 'safe_7_days',
    label: '7-Day Safe Driver',
    description: '7 consecutive safe driving days (avg score ≥ 70)',
    icon: '🛡️',
  },
  safe_30_days: {
    type: 'safe_30_days',
    label: '30-Day Safe Driver',
    description: '30 consecutive safe driving days — Excellent!',
    icon: '⭐',
  },
  safe_90_days: {
    type: 'safe_90_days',
    label: 'Elite Safe Driver',
    description: '90 consecutive days of safe driving — Elite status!',
    icon: '🏆',
  },
};

class BadgeService {
  /**
   * Check if any new badges should be awarded.
   * Called after every trip completes.
   * Returns the newly earned badges (empty array if none).
   */
  async checkAndAwardBadges(): Promise<Badge[]> {
    try {
      const summary = await weeklyScoreService.getWeeklySummary();
      const { streakDays } = summary;

      const existing = await this.loadBadges();
      const earnedTypes = new Set(existing.map(b => b.type));
      const newBadges: Badge[] = [];

      const check = (type: BadgeType, requiredDays: number) => {
        if (streakDays >= requiredDays && !earnedTypes.has(type)) {
          newBadges.push({
            ...BADGE_DEFINITIONS[type],
            earnedAt: Date.now(),
          });
        }
      };

      check('safe_7_days', 7);
      check('safe_30_days', 30);
      check('safe_90_days', 90);

      if (newBadges.length > 0) {
        const allBadges = [...existing, ...newBadges];
        await AsyncStorage.setItem(
          DRIVER_INTEL_STORAGE_KEYS.BADGES,
          JSON.stringify(allBadges)
        );
        console.log('[Badges] New badges earned:', newBadges.map(b => b.label).join(', '));
      }

      return newBadges;
    } catch (err) {
      console.error('[Badges] Check error:', err);
      return [];
    }
  }

  async loadBadges(): Promise<Badge[]> {
    try {
      const raw = await AsyncStorage.getItem(DRIVER_INTEL_STORAGE_KEYS.BADGES);
      return raw ? (JSON.parse(raw) as Badge[]) : [];
    } catch {
      return [];
    }
  }
}

export const badgeService = new BadgeService();