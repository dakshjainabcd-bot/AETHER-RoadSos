/**
 * TrustScoreService.ts — Phase 13: Device Trust & Reputation
 *
 * WHY TRUST SCORES EXIST:
 * In a real mesh network, any phone could relay SOS packets.
 * But not all phones behave well — some might have buggy apps,
 * weak signals, or even malicious modifications. Trust scores
 * let well-behaved devices get preferred as relay nodes.
 *
 * HOW SCORES WORK:
 * - Every device STARTS at 50 (neutral standing)
 * - Range is 0 to 100
 * - Good actions raise your score, bad actions lower it
 *
 * YOUR OWN SCORE:
 * +2  per successful SOS relay
 * +5  per verified on-scene help / Lifesaver event
 * -10 per false SOS (user cancelled countdown)
 * -5  per tampered packet detected
 *
 * OTHER DEVICES' SCORES:
 * We also track how much we trust OTHER devices in the mesh.
 * When deciding which phone to relay through, we check their score.
 *
 * STORAGE:
 * Uses AsyncStorage — survives app restarts, no internet needed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys — unique to avoid colliding with other AsyncStorage keys
const MY_SCORE_KEY = 'aether_my_trust_score_v1';
const DEVICE_SCORES_KEY = 'aether_device_trust_scores_v1';

// Limits and defaults (from master document)
const MIN_SCORE = 0;
const MAX_SCORE = 100;
const STARTING_SCORE = 50;

// Score changes (from master document Phase 13 spec)
const RELAY_BONUS = 2;
const ONSCENE_BONUS = 5;
const FALSE_POSITIVE_PENALTY = 10;
const TAMPER_PENALTY = 5;

class TrustScoreService {
  // ── This Device's Own Score ───────────────────────────────────────────────

  /**
   * Get this device's current trust score.
   * Returns 50 (the neutral starting value) if never stored before.
   */
  async getMyScore(): Promise<number> {
    try {
      const stored = await AsyncStorage.getItem(MY_SCORE_KEY);
      if (stored === null) return STARTING_SCORE; // First time = neutral
      const score = parseInt(stored, 10);
      return isNaN(score) ? STARTING_SCORE : score;
    } catch {
      return STARTING_SCORE; // Safe fallback if AsyncStorage fails
    }
  }

  /**
   * Internal: save the score, clamping it between 0 and 100.
   */
  private async setMyScore(score: number): Promise<number> {
    const clamped = Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(score)));
    await AsyncStorage.setItem(MY_SCORE_KEY, String(clamped));
    return clamped;
  }

  /**
   * Call this when this device successfully relays an SOS packet.
   * Awards +2 points. Returns the new score.
   */
  async onSuccessfulRelay(): Promise<number> {
    const current = await this.getMyScore();
    const newScore = await this.setMyScore(current + RELAY_BONUS);
    console.log(`[TrustScore] ✅ +${RELAY_BONUS} relay bonus. Score: ${current} → ${newScore}`);
    return newScore;
  }

  /**
   * Call this when this device's Rakshak helps on scene (verified arrival).
   * Awards +5 points. Returns the new score.
   */
  async onOnSceneHelp(): Promise<number> {
    const current = await this.getMyScore();
    const newScore = await this.setMyScore(current + ONSCENE_BONUS);
    console.log(`[TrustScore] ✅ +${ONSCENE_BONUS} on-scene bonus. Score: ${current} → ${newScore}`);
    return newScore;
  }

  /**
   * Call this when the user CANCELS an SOS countdown (false positive).
   * Deducts 10 points. Returns the new score.
   */
  async onFalsePositive(): Promise<number> {
    const current = await this.getMyScore();
    const newScore = await this.setMyScore(current - FALSE_POSITIVE_PENALTY);
    console.log(
      `[TrustScore] ⚠️ -${FALSE_POSITIVE_PENALTY} false positive penalty. Score: ${current} → ${newScore}`
    );
    return newScore;
  }

  /**
   * Call this on a Lifesaver event (hospital confirms READY).
   * Treated the same as on-scene help (+5).
   */
  async onLifesaverEvent(): Promise<number> {
    return this.onOnSceneHelp();
  }

  // ── Other Devices' Scores ─────────────────────────────────────────────────

  /**
   * Get the trust score for a specific device hash.
   * Returns 50 (neutral) if we've never seen this device before.
   */
  async getDeviceScore(deviceHash: string): Promise<number> {
    try {
      const stored = await AsyncStorage.getItem(DEVICE_SCORES_KEY);
      if (!stored) return STARTING_SCORE;
      const scores: Record<string, number> = JSON.parse(stored);
      return scores[deviceHash] ?? STARTING_SCORE;
    } catch {
      return STARTING_SCORE;
    }
  }

  /**
   * Update the trust score for another device (positive or negative delta).
   */
  async updateDeviceScore(deviceHash: string, delta: number): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(DEVICE_SCORES_KEY);
      const scores: Record<string, number> = stored ? JSON.parse(stored) : {};
      const current = scores[deviceHash] ?? STARTING_SCORE;
      scores[deviceHash] = Math.max(
        MIN_SCORE,
        Math.min(MAX_SCORE, Math.round(current + delta))
      );
      await AsyncStorage.setItem(DEVICE_SCORES_KEY, JSON.stringify(scores));
    } catch (err) {
      console.error('[TrustScore] Failed to update device score:', err);
    }
  }

  /**
   * Reward another device for a successful relay (+2).
   */
  async onDeviceRelaySuccess(deviceHash: string): Promise<void> {
    await this.updateDeviceScore(deviceHash, RELAY_BONUS);
  }

  /**
   * Penalise another device for tampered packet (-5).
   */
  async onDeviceTampering(deviceHash: string): Promise<void> {
    await this.updateDeviceScore(deviceHash, -TAMPER_PENALTY);
    console.warn(
      `[TrustScore] 🚫 Tamper detected from ${deviceHash.substring(0, 8)}... Penalised -${TAMPER_PENALTY}.`
    );
  }

  /**
   * Get all device trust scores (for the Settings debug panel).
   */
  async getAllDeviceScores(): Promise<Record<string, number>> {
    try {
      const stored = await AsyncStorage.getItem(DEVICE_SCORES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Reset this device's score to 50 (for testing only).
   */
  async resetMyScore(): Promise<void> {
    await AsyncStorage.removeItem(MY_SCORE_KEY);
    console.log('[TrustScore] Score reset to 50');
  }
}

// Singleton — one shared instance for the whole app
export const trustScoreService = new TrustScoreService();