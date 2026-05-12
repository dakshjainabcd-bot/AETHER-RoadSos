/**
 * HospitalRegistry — Offline Hospital Capability Database
 *
 * WHY THIS EXISTS:
 * The POIDatabase from Phase 1 finds the NEAREST hospital.
 * That is wrong for emergencies. A head trauma victim sent to a clinic
 * with no CT scanner loses the golden hour during the fatal transfer.
 *
 * This registry finds the nearest hospital that ACTUALLY HAS the
 * capability the injury requires.
 *
 * HOW IT WORKS:
 * 1. Load hospital_registry.json (bundled in app — works offline)
 * 2. For a given injury type, look up which capabilities are needed
 * 3. Filter hospitals that have ALL required capabilities
 * 4. Sort by Haversine distance from crash GPS
 * 5. Return the closest match
 *
 * OFFLINE FIRST:
 * The JSON file is bundled with the app using require().
 * No API call, no internet. Works in zero signal.
 */

import { haversineDistance } from '../utils/haversine';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Hospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  phone: string;
  whatsapp: string;
  capabilities: string[];
  cashless: boolean;
  beds_icu: number;
  city: string;
  country_code: string;
}

export interface HospitalMatch extends Hospital {
  /** Distance from crash to this hospital in kilometres */
  distanceKm: number;
  /** Human-readable distance string e.g. "3.2 km" */
  distanceText: string;
  /** Rough ETA in minutes (assuming 40 km/h average ambulance speed in city) */
  etaMinutes: number;
  /** Which capabilities matched the injury requirement */
  matchedCapabilities: string[];
}

// ─── Load the JSON once at module level (no network, no async) ────────────────

// React Native's Metro bundler can require() JSON files directly.
// The file is embedded in the app bundle — no filesystem read at runtime.
// This is the same pattern used for mcc_emergency.json in Phase 1.
const registryData = require('../assets/data/hospital_registry.json') as {
  hospitals: Hospital[];
};

/**
 * Get all hospitals from the registry.
 * Returns a fresh copy of the array so callers cannot mutate the cache.
 */
export function getAllHospitals(): Hospital[] {
  return [...registryData.hospitals];
}

/**
 * Find hospitals near a GPS location, sorted by distance (nearest first).
 *
 * @param lat        Crash latitude
 * @param lng        Crash longitude
 * @param radiusKm   Search radius in km (default 150 — covers most metro areas)
 * @returns          Array of hospitals within radius, sorted nearest first, with distance info
 */
export function getHospitalsNearby(
  lat: number,
  lng: number,
  radiusKm: number = 150
): HospitalMatch[] {
  const all = getAllHospitals();

  const withDistance: HospitalMatch[] = all
    .map((h) => {
      const distanceKm = haversineDistance(lat, lng, h.lat, h.lng);
      const etaMinutes = Math.round((distanceKm / 40) * 60); // 40 km/h city ambulance speed
      return {
        ...h,
        distanceKm,
        distanceText: distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`,
        etaMinutes,
        matchedCapabilities: [],
      };
    })
    .filter((h) => h.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return withDistance;
}

/**
 * Find hospitals that have a specific capability, sorted by distance.
 *
 * Example:
 *   getHospitalsWithCapability(13.06, 80.26, 'neurosurgery')
 *   → [Apollo Greams Rd (2.1 km), Sri Ramachandra (8.4 km), ...]
 *
 * @param lat          Crash latitude
 * @param lng          Crash longitude
 * @param capability   One capability string from the list below
 * @param radiusKm     Search radius
 */
export function getHospitalsWithCapability(
  lat: number,
  lng: number,
  capability: string,
  radiusKm: number = 150
): HospitalMatch[] {
  return getHospitalsNearby(lat, lng, radiusKm).filter((h) =>
    h.capabilities.includes(capability)
  );
}

/**
 * Find hospitals that have ALL of a list of capabilities.
 *
 * Example:
 *   matchAllCapabilities(lat, lng, ['neurosurgery', 'ct_scan'])
 *   → Only hospitals with BOTH capabilities
 *
 * @param lat            Crash latitude
 * @param lng            Crash longitude
 * @param required       List of capabilities ALL of which must be present
 * @param radiusKm       Search radius
 */
export function matchAllCapabilities(
  lat: number,
  lng: number,
  required: string[],
  radiusKm: number = 150
): HospitalMatch[] {
  if (required.length === 0) {
    return getHospitalsNearby(lat, lng, radiusKm);
  }

  return getHospitalsNearby(lat, lng, radiusKm)
    .filter((h) => required.every((cap) => h.capabilities.includes(cap)))
    .map((h) => ({
      ...h,
      matchedCapabilities: required.filter((cap) => h.capabilities.includes(cap)),
    }));
}