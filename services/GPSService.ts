/**
 * GPSService — Location Tracking
 *
 * WHY THIS IS CRITICAL FOR AETHER:
 * When a crash happens, the victim's phone might be:
 * - Locked with screen off
 * - Low on battery
 * - Under debris (GPS signal weak)
 *
 * We store GPS every 10 seconds in AsyncStorage.
 * So even if GPS takes 30 seconds to fix after the crash,
 * we already have a location from 10 seconds ago — accurate enough.
 *
 * BACKGROUND TRACKING:
 * The app uses expo-location's background mode.
 * This means even with the screen OFF, GPS updates continue.
 * The phone must grant "Always Allow" location permission for this.
 *
 * ACCURACY LEVELS:
 * - Green: < 50m accuracy (safe to use for crash location)
 * - Yellow: 50–200m (usable but imprecise)
 * - Red: > 200m or no fix (unreliable — notify user)
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, GPS } from '../utils/constants';

export interface StoredLocation {
  lat: number;
  lng: number;
  accuracy: number;      // In meters — lower = better
  altitude: number | null;
  timestamp: number;     // Unix timestamp (ms)
  source: 'live' | 'cached';
}

export type GPSAccuracyLevel = 'good' | 'fair' | 'poor' | 'none';

// Internal state — module-level variable (singleton pattern)
let locationSubscription: Location.LocationSubscription | null = null;
let lastKnownLocation: StoredLocation | null = null;
let backgroundIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Request all required location permissions
 *
 * On Android: asks for FINE + COARSE first, then BACKGROUND
 * On iOS: asks for "Always Allow" permission
 *
 * Returns true if we have enough permissions to proceed
 */
export async function requestLocationPermissions(): Promise<boolean> {
  try {
    // Step 1: Ask for foreground permission first (required before background)
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();

    if (fgStatus !== 'granted') {
      console.warn('[GPSService] Foreground location permission denied');
      return false;
    }

    console.log('[GPSService] Foreground permission granted');

    // Step 2: Ask for background permission (needed for crash detection with screen off)
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

    if (bgStatus !== 'granted') {
      // Not a fatal error — app works with foreground only, just less reliable
      console.warn('[GPSService] Background location permission denied — crash detection less reliable');
    } else {
      console.log('[GPSService] Background permission granted');
    }

    return true;
  } catch (error) {
    console.error('[GPSService] Permission request failed:', error);
    return false;
  }
}

/**
 * Get current GPS location (one-time read, not continuous)
 * Used when user opens the app and we need immediate location
 */
export async function getCurrentLocation(): Promise<StoredLocation | null> {
  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,  // Use high accuracy (GPS chip, not just cell towers)
    });

    const location: StoredLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy || 999,
      altitude: position.coords.altitude,
      timestamp: position.timestamp,
      source: 'live',
    };

    // Update our in-memory cache immediately
    lastKnownLocation = location;

    // Save to persistent storage
    await saveLocationToStorage(location);

    return location;
  } catch (error) {
    console.error('[GPSService] getCurrentLocation failed:', error);

    // Try to return cached location if live read fails
    return await getCachedLocation();
  }
}

/**
 * Start continuous background GPS tracking
 *
 * This runs a timer every GPS.UPDATE_INTERVAL_MS (10 seconds)
 * that stores the current position to AsyncStorage.
 *
 * WHY STORE EVERY 10 SECONDS?
 * If a crash happens at 10:00:00, we might have a GPS fix from 09:59:52.
 * That's 8 seconds old — the car has moved maybe 50–100m at highway speeds.
 * Still accurate enough to dispatch ambulance to the right area.
 */
export async function startBackgroundTracking(): Promise<void> {
  // Don't start multiple subscriptions
  if (locationSubscription) {
    console.log('[GPSService] Already tracking');
    return;
  }

  try {
    // Real-time subscription for immediate crash detection
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,      // Update every 5 seconds minimum
        distanceInterval: 10,    // OR when moved 10 meters (whichever comes first)
      },
      (position) => {
        // This callback fires every time position updates
        const location: StoredLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy || 999,
          altitude: position.coords.altitude,
          timestamp: position.timestamp,
          source: 'live',
        };

        // Update in-memory cache (synchronous — no async overhead)
        lastKnownLocation = location;
      }
    );

    // Separate 10-second interval to PERSIST to AsyncStorage
    // We don't do this on every GPS update (every 5s) because AsyncStorage writes have overhead
    backgroundIntervalId = setInterval(async () => {
      if (lastKnownLocation) {
        await saveLocationToStorage(lastKnownLocation);
        console.log(`[GPSService] Stored location: ${lastKnownLocation.lat.toFixed(4)}, ${lastKnownLocation.lng.toFixed(4)} ±${lastKnownLocation.accuracy}m`);
      }
    }, GPS.UPDATE_INTERVAL_MS); // 10,000 ms = 10 seconds

    console.log('[GPSService] Background tracking started');
  } catch (error) {
    console.error('[GPSService] Failed to start tracking:', error);
  }
}

/**
 * Stop background GPS tracking
 * Called when app is fully closed or user opts out
 */
export function stopBackgroundTracking(): void {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
  if (backgroundIntervalId) {
    clearInterval(backgroundIntervalId);
    backgroundIntervalId = null;
  }
  console.log('[GPSService] Background tracking stopped');
}

/**
 * Get the last known location (fastest — no GPS read, just memory/storage)
 *
 * Priority order:
 * 1. In-memory cache (milliseconds, most recent)
 * 2. AsyncStorage (from last 10-second save)
 * 3. null (no location available)
 */
export async function getLastKnownLocation(): Promise<StoredLocation | null> {
  // Check in-memory first (fastest)
  if (lastKnownLocation) {
    return { ...lastKnownLocation, source: 'live' };
  }

  // Fall back to AsyncStorage
  return await getCachedLocation();
}

/**
 * Get GPS accuracy level for UI display
 * Used by the GPSIndicator component (green/yellow/red dot)
 */
export function getAccuracyLevel(accuracyMeters: number): GPSAccuracyLevel {
  if (accuracyMeters < GPS.ACCURACY_THRESHOLD_M) return 'good';    // Green
  if (accuracyMeters < 200) return 'fair';                          // Yellow
  if (accuracyMeters < 500) return 'poor';                          // Red
  return 'none';
}

// --- PRIVATE HELPERS ---

async function saveLocationToStorage(location: StoredLocation): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_GPS, JSON.stringify(location));
  } catch (error) {
    console.error('[GPSService] Failed to save location:', error);
  }
}

async function getCachedLocation(): Promise<StoredLocation | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.LAST_GPS);
    if (!stored) return null;

    const location = JSON.parse(stored) as StoredLocation;
    return { ...location, source: 'cached' };
  } catch {
    return null;
  }
}
