/**
 * Haversine Distance Formula
 *
 * Calculates the great-circle distance between two GPS coordinates.
 *
 * WHY HAVERSINE?
 * GPS coordinates are on a sphere. Simple Euclidean (flat) distance
 * is wrong — it doesn't account for the Earth's curvature.
 * At short distances (<1km) the error is tiny (~0.001%), but our
 * ProximityAlertService needs to be precise at 300m, so we use
 * the correct spherical formula.
 *
 * RETURNS: Distance in kilometres (multiply by 1000 for metres)
 *
 * USAGE:
 *   import { haversineDistance } from '../../utils/haversine';
 *   const distKm = haversineDistance(lat1, lng1, lat2, lng2);
 *   const distM  = distKm * 1000;
 */

const EARTH_RADIUS_KM = 6371;

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Format distance for display
 * - Below 1km: show in meters (e.g., "800 m")
 * - Above 1km: show in kilometers (e.g., "5.2 km")
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Sort a list of POIs by distance from the user's current location
 * Returns a new sorted array (doesn't modify the original)
 */
export function sortByDistance<T extends { lat: number; lng: number }>(
  items: T[],
  userLat: number,
  userLng: number
): (T & { distance: number; distanceText: string })[] {
  return items
    .map((item) => {
      const distance = haversineDistance(userLat, userLng, item.lat, item.lng);
      return {
        ...item,
        distance,
        distanceText: formatDistance(distance),
      };
    })
    .sort((a, b) => a.distance - b.distance);
}