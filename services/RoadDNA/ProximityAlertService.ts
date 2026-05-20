/**
 * Phase 9 — ProximityAlertService
 *
 * WHAT THIS DOES:
 * Polls the user's GPS every 5 seconds and checks if they are
 * within 300m of any known blackspot. If they are, it fires an alert.
 *
 * WHY POLLING INSTEAD OF expo-location GEOFENCING?
 * expo-location's built-in geofencing requires a custom dev build (not Expo Go).
 * Our manual polling approach works perfectly in Expo Go and uses the same
 * GPS location we're already tracking in Phase 1 (GPSService).
 * At 60 km/h, 5 seconds = 83m of travel — well within our 300m alert zone.
 *
 * ALERT COOLDOWN:
 * Once an alert fires for a blackspot, we wait 60 seconds before alerting
 * for the SAME blackspot again. This prevents the alert from firing on every
 * poll while the driver is near the spot.
 *
 * HOW IT CONNECTS TO THE REST OF THE APP:
 * ProximityAlertService emits events that _layout.tsx (root layout) subscribes
 * to. _layout.tsx updates AppContext with the blackspot alert state, which the
 * home screen and map screen can display.
 */

import { getLastKnownLocation } from '../GPSService';
import { loadCachedBlackspots } from './BlackspotEngine';
import { haversineDistance } from '../../utils/haversine';
import { ROAD_DNA_CONFIG } from './types';
import type { Blackspot, BlackspotAlertState } from './types';

type AlertCallback = (alert: BlackspotAlertState | null) => void;

class ProximityAlertService {
    private pollingTimer: ReturnType<typeof setInterval> | null = null;
    private blackspots: Blackspot[] = [];
    private listeners: AlertCallback[] = [];

    // Track when we last alerted for each blackspot (by id)
    private lastAlertTime: Record<string, number> = {};

    // 60 seconds cooldown per blackspot
    private readonly ALERT_COOLDOWN_MS = 60_000;

    /**
     * Start the proximity check loop.
     * Call once at app startup from _layout.tsx.
     */
    async start(): Promise<void> {
        // Load blackspots from cache
        this.blackspots = await loadCachedBlackspots();
        console.log(
            `[RoadDNA] Proximity service started — monitoring ${this.blackspots.length} blackspots`
        );

        // Check immediately, then every 5 seconds
        this.checkProximity();
        this.pollingTimer = setInterval(() => {
            this.checkProximity();
        }, ROAD_DNA_CONFIG.GEOFENCE_CHECK_INTERVAL_MS);
    }

    /**
     * Reload blackspots from cache (call after computeBlackspots() runs).
     */
    async refreshBlackspots(): Promise<void> {
        this.blackspots = await loadCachedBlackspots();
        console.log(`[RoadDNA] Blackspots refreshed: ${this.blackspots.length} zones`);
    }

    /**
     * Stop monitoring.
     */
    stop(): void {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
        console.log('[RoadDNA] Proximity service stopped');
    }

    /**
     * Subscribe to proximity alerts.
     * Callback receives a BlackspotAlertState when near a blackspot, null when safe.
     * Returns an unsubscribe function.
     */
    onAlert(callback: AlertCallback): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter((cb) => cb !== callback);
        };
    }

    /**
     * Core proximity check.
     * Gets current GPS, compares to all blackspot centres.
     * Fires alert if within ALERT_RADIUS_M and cooldown has passed.
     */
    private async checkProximity(): Promise<void> {
        if (this.blackspots.length === 0) return;

        const location = await getLastKnownLocation();
        if (!location) return;

        const now = Date.now();
        let closestAlert: BlackspotAlertState | null = null;
        let closestDistance = Infinity;

        for (const spot of this.blackspots) {
            const distKm = haversineDistance(location.lat, location.lng, spot.lat, spot.lng);
            const distM = distKm * 1000;

            if (distM <= ROAD_DNA_CONFIG.ALERT_RADIUS_M) {
                // Within alert zone — check cooldown
                const lastAlert = this.lastAlertTime[spot.id] ?? 0;
                const cooldownPassed = now - lastAlert >= this.ALERT_COOLDOWN_MS;

                if (cooldownPassed && distM < closestDistance) {
                    closestDistance = distM;
                    closestAlert = { blackspot: spot, distanceM: Math.round(distM) };
                    this.lastAlertTime[spot.id] = now;
                }
            }
        }

        if (closestAlert) {
            console.log(
                `[RoadDNA] ⚠️ Blackspot ahead! ${closestAlert.distanceM}m away ` +
                `(${closestAlert.blackspot.severity} severity, ${closestAlert.blackspot.event_count} events)`
            );
        }

        // Emit to all listeners (including null = no alert = safe)
        this.listeners.forEach((cb) => {
            try { cb(closestAlert); } catch { /* ignore listener errors */ }
        });
    }
}

// Singleton
export const proximityAlertService = new ProximityAlertService();