/**
 * Phase 12 — WeeklyScoreService
 *
 * Reads all saved TripScores and computes:
 * - This week's average score
 * - Last week's average score (for trend)
 * - Current safe-driving streak in days
 *
 * WHY STREAK?
 * Streaks are the most effective gamification tool — they create
 * daily motivation ("don't break the chain"). Even one unsafe day
 * resets the streak, which is a strong incentive to drive safely.
 */

import { TripScore, WeeklySummary } from './types';
import { tripScoreService } from './TripScoreService';

// Returns the Monday and Sunday timestamps for a given week
// offsetWeeks=0 → this week, offsetWeeks=1 → last week
function getWeekBounds(offsetWeeks: number = 0): { start: number; end: number } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  // Days since last Monday
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);

  const weekStart = monday.getTime() - offsetWeeks * 7 * 24 * 60 * 60 * 1000;
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;

  return { start: weekStart, end: weekEnd };
}

function averageScore(scores: TripScore[]): number {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, t) => sum + t.score, 0) / scores.length);
}

/**
 * Count consecutive days where the driver had at least one trip with avg score ≥ 70.
 * Counts backward from today.
 */
function calculateStreakDays(allScores: TripScore[]): number {
  if (allScores.length === 0) return 0;

  let streak = 0;

  for (let daysAgo = 0; daysAgo < 90; daysAgo++) {
    const dayEnd = new Date();
    dayEnd.setDate(dayEnd.getDate() - daysAgo);
    dayEnd.setHours(23, 59, 59, 999);
    const dayStart = new Date(dayEnd);
    dayStart.setHours(0, 0, 0, 0);

    const dayTs_start = dayStart.getTime();
    const dayTs_end = dayEnd.getTime();

    const dayScores = allScores.filter(
      s => s.endTime >= dayTs_start && s.endTime <= dayTs_end
    );

    // No driving today → streak is broken
    if (dayScores.length === 0) break;

    // Average score below 70 → streak is broken
    const avg = averageScore(dayScores);
    if (avg < 70) break;

    streak++;
  }

  return streak;
}

class WeeklyScoreService {
  async getWeeklySummary(): Promise<WeeklySummary> {
    const allScores = await tripScoreService.loadTripScores();
    const latest = await tripScoreService.getLatestTripScore();

    const thisWeek = getWeekBounds(0);
    const lastWeek = getWeekBounds(1);

    const thisWeekScores = allScores.filter(
      s => s.endTime >= thisWeek.start && s.endTime < thisWeek.end
    );
    const lastWeekScores = allScores.filter(
      s => s.endTime >= lastWeek.start && s.endTime < lastWeek.end
    );

    const weekScore = averageScore(thisWeekScores);
    const lastWeekScore = averageScore(lastWeekScores);
    const diff = weekScore - lastWeekScore;

    // Trend: only meaningful if we have data for both weeks
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (thisWeekScores.length > 0 && lastWeekScores.length > 0) {
      if (diff >= 3) trend = 'up';
      else if (diff <= -3) trend = 'down';
    }

    const streakDays = calculateStreakDays(allScores);

    return {
      weekScore: thisWeekScores.length > 0 ? weekScore : 0,
      lastWeekScore: lastWeekScores.length > 0 ? lastWeekScore : 0,
      trend,
      trendPoints: Math.abs(diff),
      tripCount: thisWeekScores.length,
      latestTip: latest?.tip ?? 'Start driving to get your first safety score!',
      streakDays,
    };
  }
}

export const weeklyScoreService = new WeeklyScoreService();