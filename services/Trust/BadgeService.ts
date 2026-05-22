/**
 * BadgeService.ts — Phase 13: Badge Progress, Awarding & Claim Tracking
 *
 * HOW BADGE PROGRESS WORKS:
 * 1. App events (relay success, CPR stop, scene arrival, etc.) call methods here
 * 2. This service increments the progress counter for the relevant badge
 * 3. When progress >= threshold, the badge is "earned" and saved permanently
 * 4. Earned badges are never lost — even if progress resets, earned stays earned
 *
 * EXAMPLE FLOW (Relay Node badge — needs 10 relays):
 *   Relay 1: onRelaySuccess() → progress = 1/10
 *   Relay 5: onRelaySuccess() → progress = 5/10
 *   Relay 10: onRelaySuccess() → progress = 10/10 → BADGE AWARDED! 🏆
 *   Relay 11: onRelaySuccess() → badge already earned, nothing changes
 *
 * STORAGE:
 * - BADGE_PROGRESS_KEY: { relay_node: 7, cpr_hero: 45, ... }
 * - EARNED_BADGES_KEY: [{ badgeId: 'relay_node', earnedAt: 1234567890 }, ...]
 * - CLAIM_RECORDS_KEY: [{ incidentId: '...', status: 'submitted', ... }, ...]
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BadgeId, BADGE_DEFINITIONS } from './BadgeTypes';

// Storage keys
const BADGE_PROGRESS_KEY = 'aether_badge_progress_v1';
const EARNED_BADGES_KEY = 'aether_earned_badges_v1';
const CLAIM_RECORDS_KEY = 'aether_claim_records_v1';

// ── Types ──────────────────────────────────────────────────────────────────────

/** A badge that has been earned — stored permanently */
export interface EarnedBadge {
  badgeId: BadgeId;
  earnedAt: number;        // Unix ms timestamp
  incidentId?: string;     // Optional: which incident triggered this
}

/** Progress toward each badge: { 'relay_node': 7, 'cpr_hero': 45 } */
export type BadgeProgressMap = Partial<Record<BadgeId, number>>;

/** Status of a ₹25,000 reward claim */
export type ClaimStatus =
  | 'submitted'     // PDF generated, user says they filed it
  | 'acknowledged'  // Authority confirmed receipt
  | 'in_progress'   // Being processed
  | 'completed'     // Reward sent
  | 'rejected';     // Rejected (with reason)

/** A saved claim record */
export interface ClaimRecord {
  incidentId: string;
  submittedAt: number;      // When the PDF was generated
  status: ClaimStatus;
  lastUpdated: number;
  pdfUri?: string;           // Local file path to the PDF
  claimAmount: number;       // Always 25000 rupees
  notes?: string;            // Optional authority response
}

// ── Service Class ──────────────────────────────────────────────────────────────

class BadgeService {
  // ── Progress Tracking ────────────────────────────────────────────────────

  /** Get current progress for all badges */
  async getProgress(): Promise<BadgeProgressMap> {
    try {
      const stored = await AsyncStorage.getItem(BADGE_PROGRESS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /** Get progress for one specific badge */
  async getProgressForBadge(badgeId: BadgeId): Promise<number> {
    const progress = await this.getProgress();
    return progress[badgeId] ?? 0;
  }

  /**
   * Internal core method — add progress to a badge and award if threshold met.
   *
   * @param badgeId    - Which badge to update
   * @param increment  - How much to add (usually 1, but CPR uses seconds)
   * @param incidentId - Optional link to an incident
   * @returns The awarded badge if earned this call, or null
   */
  private async recordProgress(
    badgeId: BadgeId,
    increment: number,
    incidentId?: string
  ): Promise<EarnedBadge | null> {
    try {
      // Step 1: Load current progress
      const progress = await this.getProgress();
      const current = progress[badgeId] ?? 0;
      const newProgress = current + increment;

      // Step 2: Save updated progress
      progress[badgeId] = newProgress;
      await AsyncStorage.setItem(BADGE_PROGRESS_KEY, JSON.stringify(progress));

      // Step 3: Find the badge definition to get threshold
      const badgeDef = BADGE_DEFINITIONS.find((b) => b.id === badgeId);
      if (!badgeDef) return null;

      // Step 4: Don't award twice if already earned
      const alreadyEarned = await this.isBadgeEarned(badgeId);
      if (alreadyEarned) return null;

      console.log(
        `[BadgeService] ${badgeId}: ${newProgress}/${badgeDef.threshold} ` +
          `(${Math.min(100, Math.round((newProgress / badgeDef.threshold) * 100))}%)`
      );

      // Step 5: Award if threshold reached
      if (newProgress >= badgeDef.threshold) {
        return await this.awardBadge(badgeId, incidentId);
      }

      return null;
    } catch (err) {
      console.error('[BadgeService] recordProgress error:', err);
      return null;
    }
  }

  /** Save an earned badge permanently */
  private async awardBadge(
    badgeId: BadgeId,
    incidentId?: string
  ): Promise<EarnedBadge> {
    const badge: EarnedBadge = {
      badgeId,
      earnedAt: Date.now(),
      incidentId,
    };

    const existing = await this.getEarnedBadges();
    existing.push(badge);
    await AsyncStorage.setItem(EARNED_BADGES_KEY, JSON.stringify(existing));

    const def = BADGE_DEFINITIONS.find((b) => b.id === badgeId);
    console.log(`[BadgeService] 🏆 BADGE EARNED: ${def?.name ?? badgeId}!`);
    return badge;
  }

  /** Check if a badge has already been earned */
  async isBadgeEarned(badgeId: BadgeId): Promise<boolean> {
    const earned = await this.getEarnedBadges();
    return earned.some((b) => b.badgeId === badgeId);
  }

  /** Get all earned badges */
  async getEarnedBadges(): Promise<EarnedBadge[]> {
    try {
      const stored = await AsyncStorage.getItem(EARNED_BADGES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /** Get one specific earned badge (or null if not earned) */
  async getEarnedBadge(badgeId: BadgeId): Promise<EarnedBadge | null> {
    const earned = await this.getEarnedBadges();
    return earned.find((b) => b.badgeId === badgeId) ?? null;
  }

  // ── Badge Trigger Methods ─────────────────────────────────────────────────
  // These are called by other parts of the app when relevant events happen.

  /**
   * Call when this device successfully relays an SOS packet.
   * → Relay Node badge progress (+1 relay)
   */
  async onRelaySuccess(): Promise<EarnedBadge | null> {
    return this.recordProgress('relay_node', 1);
  }

  /**
   * Call when the CPR coach is stopped.
   * Pass the total seconds CPR was active.
   * → CPR Hero badge progress (+seconds)
   * Note: 120 seconds across ALL sessions earns the badge.
   */
  async onCPRSeconds(seconds: number): Promise<EarnedBadge | null> {
    if (seconds <= 0) return null;
    console.log(`[BadgeService] CPR seconds logged: ${seconds}s`);
    return this.recordProgress('cpr_hero', seconds);
  }

  /**
   * Call when a Rakshak arrives at the crash scene.
   * minutesSinceAlert: time between SOS received and Rakshak arrival.
   * → First Responder badge if arrived within 10 minutes
   */
  async onSceneArrival(
    minutesSinceAlert: number,
    incidentId?: string
  ): Promise<EarnedBadge | null> {
    if (minutesSinceAlert <= 10) {
      return this.recordProgress('first_responder', 1, incidentId);
    }
    console.log(
      `[BadgeService] Scene arrival: ${minutesSinceAlert} min (>10 min, no First Responder badge)`
    );
    return null;
  }

  /**
   * Call when a road hazard is reported.
   * → Blackspot Reporter badge progress (+1 report)
   */
  async onHazardReport(): Promise<EarnedBadge | null> {
    return this.recordProgress('blackspot_reporter', 1);
  }

  /**
   * Call when the Multilingual Bridge is used to help a victim.
   * → Multilingual Helper badge
   */
  async onMultilingualHelp(incidentId?: string): Promise<EarnedBadge | null> {
    return this.recordProgress('multilingual_helper', 1, incidentId);
  }

  /**
   * Call when the user donates sensor data as a Black Box witness.
   * → Evidence Witness badge progress (+1 contribution)
   */
  async onEvidenceContribution(incidentId?: string): Promise<EarnedBadge | null> {
    return this.recordProgress('evidence_witness', 1, incidentId);
  }

  /**
   * Call daily when no crash events occurred.
   * → Safe Driver badge progress (+1 day)
   */
  async onSafeDrivingDay(): Promise<EarnedBadge | null> {
    return this.recordProgress('safe_driver', 1);
  }

  /**
   * Call when hospital sends READY response for a victim this user helped.
   * → Lifesaver badge
   */
  async onLifesaverEvent(incidentId?: string): Promise<EarnedBadge | null> {
    return this.recordProgress('lifesaver', 1, incidentId);
  }

  // ── Claim Tracking ────────────────────────────────────────────────────────

  /**
   * Record that a PDF claim was generated for an incident.
   * Status starts as 'submitted' (user claims they filed it).
   */
  async recordClaimSubmission(incidentId: string, pdfUri?: string): Promise<void> {
    try {
      const records = await this.getClaimRecords();

      // Avoid duplicate entries for the same incident
      if (records.find((r) => r.incidentId === incidentId)) {
        console.log(`[BadgeService] Claim already recorded for ${incidentId}`);
        return;
      }

      const record: ClaimRecord = {
        incidentId,
        submittedAt: Date.now(),
        status: 'submitted',
        lastUpdated: Date.now(),
        pdfUri,
        claimAmount: 25000,
      };

      records.push(record);
      await AsyncStorage.setItem(CLAIM_RECORDS_KEY, JSON.stringify(records));
      console.log(`[BadgeService] Claim recorded for incident ${incidentId}`);
    } catch (err) {
      console.error('[BadgeService] recordClaimSubmission error:', err);
    }
  }

  /**
   * Update the status of a claim (e.g., when authority responds).
   */
  async updateClaimStatus(
    incidentId: string,
    status: ClaimStatus,
    notes?: string
  ): Promise<void> {
    try {
      const records = await this.getClaimRecords();
      const index = records.findIndex((r) => r.incidentId === incidentId);
      if (index === -1) return;

      records[index].status = status;
      records[index].lastUpdated = Date.now();
      if (notes) records[index].notes = notes;

      await AsyncStorage.setItem(CLAIM_RECORDS_KEY, JSON.stringify(records));
    } catch (err) {
      console.error('[BadgeService] updateClaimStatus error:', err);
    }
  }

  /** Get all claim records */
  async getClaimRecords(): Promise<ClaimRecord[]> {
    try {
      const stored = await AsyncStorage.getItem(CLAIM_RECORDS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /** Get one claim record by incident ID */
  async getClaimRecord(incidentId: string): Promise<ClaimRecord | null> {
    const records = await this.getClaimRecords();
    return records.find((r) => r.incidentId === incidentId) ?? null;
  }

  /**
   * Reset all badge data — USE ONLY FOR TESTING.
   */
  async resetAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      BADGE_PROGRESS_KEY,
      EARNED_BADGES_KEY,
      CLAIM_RECORDS_KEY,
    ]);
    console.log('[BadgeService] All badge data cleared');
  }
}

// Singleton — shared by the whole app
export const badgeService = new BadgeService();