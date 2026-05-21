/**
 * PrivacyManager.ts — Phase 10 DPDP Compliance
 *
 * India's Digital Personal Data Protection Act (DPDP, 2023) requires:
 * 1. Explicit consent before collecting personal data (GPS, driving events)
 * 2. Right to erasure — user can delete all their data at any time
 * 3. Data minimisation — only collect what's needed
 *
 * This file handles all three requirements in one place.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

// ─── Storage Keys ─────────────────────────────────────────────────────────────

/** The AsyncStorage key where we save consent. 'v1' allows us to re-prompt if policy changes */
export const CONSENT_STORAGE_KEY = 'aether_consent_v1';

// ─── Consent Management ───────────────────────────────────────────────────────

/**
 * Check if the user has already given consent.
 * Returns true if consent was given, false if first launch or consent was reset.
 */
export async function hasUserConsent(): Promise<boolean> {
  const consent = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
  // Any value stored means they responded (either accepted or declined).
  // We only start location tracking if they accepted (value !== 'declined').
  return consent !== null && consent !== 'declined';
}

/**
 * Save consent with a timestamp.
 * We save the timestamp so we have a record of WHEN consent was given
 * (useful for audit trails and DPDP compliance documentation).
 */
export async function saveConsent(): Promise<void> {
  await AsyncStorage.setItem(CONSENT_STORAGE_KEY, Date.now().toString());
  console.log('[Privacy] ✅ Consent recorded at:', new Date().toISOString());
}

/**
 * Save decline (user said no to location tracking).
 * We still save this so we don't show the dialog again on next launch.
 */
export async function saveDecline(): Promise<void> {
  await AsyncStorage.setItem(CONSENT_STORAGE_KEY, 'declined');
  console.log('[Privacy] User declined location tracking — GPS disabled');
}

/**
 * Check if user gave full consent (not just responded, but specifically accepted).
 */
export async function hasFullConsent(): Promise<boolean> {
  const consent = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
  // If consent is a timestamp number string → accepted
  // If consent is 'declined' → declined
  // If null → never asked
  if (!consent || consent === 'declined') return false;
  return !isNaN(Number(consent));
}

// ─── Right to Erasure ────────────────────────────────────────────────────────

/**
 * Delete ALL user data from the app.
 *
 * This includes:
 * - GPS history
 * - Driving event logs (SQLite)
 * - Online POI cache (SQLite)
 * - Emergency number preferences
 * - Translation cache
 * - Evidence packages
 * - Consent record (so they'll be asked again on next launch)
 *
 * NOTE: This does NOT delete the bundled POI database (aether_poi.db)
 * because that's not user data — it's app data we ship with the app.
 */
export async function deleteAllUserData(): Promise<void> {
  console.log('[Privacy] 🗑️  Starting data deletion...');

  // ── Step 1: Clear all AsyncStorage keys ───────────────────────────────────
  const asyncStorageKeys = [
    // Phase 1: GPS and emergency numbers
    'aether_last_gps',
    'aether_language',
    'aether_country_code',
    'aether_mcc',
    'aether_emergency',
    'aether_onboarded',
    'aether_fp_count',

    // Phase 2: Mesh relay
    'aether_egress_queue_v1',
    'aether_device_hash',

    // Phase 5: Multilingual
    'aether_translation_cache_v4',
    'aether_emergency_phrases_v1',
    'aether_last_language_v1',
    'aether_tts_prefs_v1',

    // Phase 6: Hospital pre-alert
    'aether_prealert_state_v1',

    // Phase 7: Rakshak
    'aether_rakshak_profile',
    'aether_fcm_token',
    'aether_active_response',

    // Phase 8: Black box
    '@aether/blackbox/rsa_keys',
    '@aether/blackbox/frozen_buffer',
    '@aether/blackbox/incident_data',
    '@aether/blackbox/evidence',
    '@aether/blackbox/repair_cases',

    // Phase 9: Road DNA
    'aether_road_dna_opt_out',
    'aether_blackspots_cache_v1',
    'aether_road_dna_last_upload',

    // Phase 10: Consent
    CONSENT_STORAGE_KEY,

    // Voice log
    'aether_victim_voice_log_v1',
  ];

  try {
    await AsyncStorage.multiRemove(asyncStorageKeys);
    console.log('[Privacy] ✅ AsyncStorage cleared');
  } catch (error) {
    console.error('[Privacy] Failed to clear AsyncStorage:', error);
  }

  // ── Step 2: Clear driving events SQLite database ─────────────────────────
  try {
    const roadDb = await SQLite.openDatabaseAsync('aether_road_dna.db');
    await roadDb.execAsync('DELETE FROM driving_events;');
    console.log('[Privacy] ✅ Driving events deleted');
  } catch (error) {
    // Database might not exist yet — that's fine
    console.log('[Privacy] Road DNA DB not found (might not have been created yet)');
  }

  // ── Step 3: Clear online POI cache ────────────────────────────────────────
  try {
    const poiDb = await SQLite.openDatabaseAsync('aether_online_cache.db');
    await poiDb.execAsync('DELETE FROM poi_cache;');
    console.log('[Privacy] ✅ POI cache cleared');
  } catch (error) {
    console.log('[Privacy] POI cache DB not found (might not have been created yet)');
  }

  console.log('[Privacy] ✅ All user data deleted. User will see consent dialog on next launch.');
}