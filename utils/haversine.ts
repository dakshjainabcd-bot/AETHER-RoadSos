/**
 * Haversine Distance Formula
 *
 * WHY DO WE NEED THIS?
 * GPS gives us coordinates (latitude, longitude).
 * To find "hospitals within 10km", we need to calculate
 * the distance between two GPS points on a sphere (the Earth).
 *
 * The Haversine formula accounts for the Earth's curvature.
 * Simple Pythagoras (flat earth distance) would be wrong by 10-20% at this scale.
 *
 * HOW IT WORKS:
 * 1. Convert degrees to radians (math works in radians, not degrees)
 * 2. Calculate the angular distance between the two points
 * 3. Multiply by Earth's radius (6371 km) to get real-world distance
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians
 * (standard math conversion: radians = degrees × π/180)
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two GPS coordinates
 *
 * @param lat1 - Latitude of point 1 (your location)
 * @param lon1 - Longitude of point 1 (your location)
 * @param lat2 - Latitude of point 2 (hospital/POI location)
 * @param lon2 - Longitude of point 2 (hospital/POI location)
 * @returns Distance in kilometers
 *
 * Example:
 *   haversineDistance(12.9716, 77.5946, 12.9784, 77.6408)
 *   → ~5.2 km (Bangalore city center to Indiranagar)
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Convert all coordinates from degrees to radians
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1); // Difference in latitudes
  const Δλ = toRadians(lon2 - lon1); // Difference in longitudes

  // Haversine formula
  // 'a' is the square of half the chord length between the points
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  // 'c' is the angular distance in radians
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Distance = radius × angular distance
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
    .sort((a, b) => a.distance - b.distance); // Ascending: nearest first
}
