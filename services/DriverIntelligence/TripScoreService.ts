/**
 * Phase 12 — TripScoreService
 *
 * HOW TRIP DETECTION WORKS:
 * We poll the GPS every 30 seconds via getLastKnownLocation().
 * If the position changed from last poll → vehicle is moving → trip is active.
 * If position hasn't changed for 3 minutes → vehicle stopped → trip ended.
 *
 * WHY NOT USE SPEED DIRECTLY?
 * The StoredLocation from GPSService doesn't include speed (a design choice
 * in Phase 1 to save storage). Instead, we compare consecutive GPS positions.
 * At 60 km/h, the vehicle moves ~500m in 30 seconds — clearly detectable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLastKnownLocation } from '../GPSService';
import { getAllLocalEvents } from '../RoadDNA/DrivingEventLogger';
import {
  TripScore,
  DRIVER_INTEL_STORAGE_KEYS,
  DRIVER_INTEL_CONFIG,
} from './types';

// ── Coaching Tips ─────────────────────────────────────────────────────────────

const GENERIC_TIPS = [
  'Smooth braking saves fuel and reduces wear on brake pads.',
  'Maintain a 3-second following distance to avoid emergency braking.',
  'Look 12 seconds ahead — anticipate traffic changes early.',
  'Reduce speed before curves, not during them.',
  'Check mirrors every 5–8 seconds to stay aware of surroundings.',
  'Avoid phone use while driving — even hands-free cuts attention by 37%.',
];

function getSmartTip(hardBrakes: number, swerves: number, score: number): string {
  if (score >= 100) return '🌟 Perfect trip! Zero incidents — excellent driving!';
  if (hardBrakes > 2) return 'Multiple hard brakes detected. Try anticipating traffic flow earlier.';
  if (swerves > 2) return 'Frequent swerves detected. Maintain safe lane discipline.';
  if (score >= 85) return 'Great drive! A little smoother braking will push you to 100.';
  return GENERIC_TIPS[Math.floor(Math.random() * GENERIC_TIPS.length)];
}

function isNightTime(timestamp: number): boolean {
  const hour = new Date(timestamp).getHours();
  return hour >= DRIVER_INTEL_CONFIG.NIGHT_START_HOUR || hour < DRIVER_INTEL_CONFIG.NIGHT_END_HOUR;
}

function generateTripId(): string {
  return `trip_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

// ── Service Class ─────────────────────────────────────────────────────────────

class TripScoreService {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private tripStartTime: number | null = null;
  private stationaryStartTime: number | null = null;
  private isInTrip = false;
  private listeners: Array<(score: TripScore) => void> = [];
  private lastLat: number | null = null;
  private lastLng: number | null = null;

  /**
   * Start monitoring.
   * Call once at app startup in _layout.tsx.
   */
  start(): void {
    if (this.pollTimer) return;
    console.log('[TripScore] Starting trip monitor (every 30s)');

    // First poll immediately, then repeat
    this.pollLocation();
    this.pollTimer = setInterval(() => {
      this.pollLocation();
    }, DRIVER_INTEL_CONFIG.POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollLocation(): Promise<void> {
    try {
      const loc = await getLastKnownLocation();
      if (!loc) return;

      const now = Date.now();

      // First poll — just record position, nothing to compare yet
      if (this.lastLat === null || this.lastLng === null) {
        this.lastLat = loc.lat;
        this.lastLng = loc.lng;
        return;
      }

      // How much did we move since last poll?
      const latDiff = Math.abs(loc.lat - this.lastLat);
      const lngDiff = Math.abs(loc.lng - this.lastLng);
      const totalMovement = latDiff + lngDiff;
      const isMoving = totalMovement > DRIVER_INTEL_CONFIG.TRIP_END_MOVEMENT_THRESHOLD;

      if (isMoving) {
        // ── Vehicle is moving ──────────────────────────────────────────────
        this.stationaryStartTime = null; // Reset stationary timer

        if (!this.isInTrip) {
          // Only start a trip if movement is significant (not GPS drift)
          if (totalMovement > DRIVER_INTEL_CONFIG.TRIP_START_MOVEMENT_THRESHOLD) {
            this.tripStartTime = now;
            this.isInTrip = true;
            console.log('[TripScore] ▶️ Trip started at', new Date(now).toLocaleTimeString());
          }
        }
      } else {
        // ── Vehicle is stationary ──────────────────────────────────────────
        if (this.stationaryStartTime === null) {
          this.stationaryStartTime = now;
        }

        const stationaryDuration = now - this.stationaryStartTime;

        // If trip is active and we've been stopped for 3+ minutes → trip ended
        if (this.isInTrip && stationaryDuration >= DRIVER_INTEL_CONFIG.TRIP_END_DURATION_MS) {
          await this.finalizeTrip();
        }
      }

      this.lastLat = loc.lat;
      this.lastLng = loc.lng;
    } catch (error) {
      console.error('[TripScore] Poll error:', error);
    }
  }

  private async finalizeTrip(): Promise<void> {
    if (!this.tripStartTime) {
      this.resetState();
      return;
    }

    const endTime = Date.now();
    const durationMs = endTime - this.tripStartTime;

    // Ignore very short "trips" (under 2 min) — likely GPS drift or brief movements
    if (durationMs < DRIVER_INTEL_CONFIG.MIN_TRIP_DURATION_MS) {
      console.log('[TripScore] Trip too short — ignoring');
      this.resetState();
      return;
    }

    console.log(`[TripScore] ⏹️ Trip ended — ${(durationMs / 60000).toFixed(1)} minutes`);

    // Query driving events from Phase 9 that happened during THIS trip
    let hardBrakes = 0;
    let swerves = 0;
    let headingChanges = 0;

    try {
      const allEvents = await getAllLocalEvents();
      const tripStartTime = this.tripStartTime; // capture for filter closure
      const tripEvents = allEvents.filter(
        e => e.timestamp >= tripStartTime && e.timestamp <= endTime
      );
      hardBrakes = tripEvents.filter(e => e.event_type === 'hard_brake').length;
      swerves = tripEvents.filter(e => e.event_type === 'lateral_swerve').length;
      headingChanges = tripEvents.filter(e => e.event_type === 'heading_change').length;
    } catch (err) {
      console.warn('[TripScore] Could not load events from Phase 9 DB:', err);
    }

    // ── Calculate Score ─────────────────────────────────────────────────────
    let score: number = DRIVER_INTEL_CONFIG.BASE_SCORE;
    score -= hardBrakes * DRIVER_INTEL_CONFIG.HARD_BRAKE_PENALTY;
    score -= swerves * DRIVER_INTEL_CONFIG.SWERVE_PENALTY;
    score -= headingChanges * DRIVER_INTEL_CONFIG.HEADING_CHANGE_PENALTY;

    const nightDriving = isNightTime(this.tripStartTime);
    const totalIncidents = hardBrakes + swerves + headingChanges;

    if (totalIncidents === 0) {
      score += DRIVER_INTEL_CONFIG.CLEAN_TRIP_BONUS; // Bonus for perfect drive
    }
    if (nightDriving && totalIncidents === 0) {
      score += DRIVER_INTEL_CONFIG.NIGHT_DRIVING_BONUS; // Extra bonus for safe night driving
    }

    score = Math.max(0, Math.min(100, score)); // Clamp to 0–100

    const tripScore: TripScore = {
      id: generateTripId(),
      startTime: this.tripStartTime,
      endTime,
      score,
      events: { hardBrakes, swerves, headingChanges },
      isNightDriving: nightDriving,
      tip: getSmartTip(hardBrakes, swerves, score),
    };

    console.log(
      `[TripScore] Score: ${score}/100 | ` +
      `HB:${hardBrakes} SW:${swerves} HC:${headingChanges}`
    );

    await this.saveTripScore(tripScore);

    // Notify all listeners (e.g., _layout.tsx shows TripSummaryModal)
    this.listeners.forEach(cb => { try { cb(tripScore); } catch {} });

    this.resetState();
  }

  private resetState(): void {
    this.isInTrip = false;
    this.tripStartTime = null;
    this.stationaryStartTime = null;
  }

  private async saveTripScore(score: TripScore): Promise<void> {
    try {
      const existing = await this.loadTripScores();
      existing.push(score);
      // Keep only last 90 days to prevent unbounded storage growth
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const trimmed = existing.filter(s => s.endTime > cutoff);
      await AsyncStorage.setItem(
        DRIVER_INTEL_STORAGE_KEYS.TRIP_SCORES,
        JSON.stringify(trimmed)
      );
    } catch (err) {
      console.error('[TripScore] Save error:', err);
    }
  }

  async loadTripScores(): Promise<TripScore[]> {
    try {
      const raw = await AsyncStorage.getItem(DRIVER_INTEL_STORAGE_KEYS.TRIP_SCORES);
      return raw ? (JSON.parse(raw) as TripScore[]) : [];
    } catch {
      return [];
    }
  }

  async getLatestTripScore(): Promise<TripScore | null> {
    const scores = await this.loadTripScores();
    return scores.length > 0 ? scores[scores.length - 1] : null;
  }

  /**
   * Subscribe to trip completion events.
   * _layout.tsx uses this to show TripSummaryModal.
   * Returns an unsubscribe function (call in useEffect cleanup).
   */
  onTripComplete(callback: (score: TripScore) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Simulate a completed trip for hackathon demos and testing.
   * Generates random events, calculates a score, and fires the callback.
   * Accessible from the WeeklySafetyCard debug button.
   */
  async simulateTrip(): Promise<void> {
    const hardBrakes = Math.floor(Math.random() * 3);   // 0–2
    const swerves = Math.floor(Math.random() * 2);       // 0–1
    const headingChanges = Math.floor(Math.random() * 2); // 0–1

    let score: number = DRIVER_INTEL_CONFIG.BASE_SCORE;
    score -= hardBrakes * DRIVER_INTEL_CONFIG.HARD_BRAKE_PENALTY;
    score -= swerves * DRIVER_INTEL_CONFIG.SWERVE_PENALTY;
    score -= headingChanges * DRIVER_INTEL_CONFIG.HEADING_CHANGE_PENALTY;
    const totalIncidents = hardBrakes + swerves + headingChanges;
    if (totalIncidents === 0) score += DRIVER_INTEL_CONFIG.CLEAN_TRIP_BONUS;
    score = Math.max(0, Math.min(100, score));

    const fakeTrip: TripScore = {
      id: generateTripId(),
      startTime: Date.now() - 20 * 60 * 1000, // pretend it started 20 min ago
      endTime: Date.now(),
      score,
      events: { hardBrakes, swerves, headingChanges },
      isNightDriving: false,
      tip: getSmartTip(hardBrakes, swerves, score),
    };

    await this.saveTripScore(fakeTrip);
    this.listeners.forEach(cb => { try { cb(fakeTrip); } catch {} });
    console.log(`[TripScore] Simulated trip — Score: ${score}/100`);
  }
}

export const tripScoreService = new TripScoreService();