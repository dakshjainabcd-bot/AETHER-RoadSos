/**
 * POIDatabase — Offline Point-of-Interest Search
 *
 * WHY SQLITE AND NOT AN API?
 * A hospital-finder that requires internet is USELESS on highways with no signal.
 * SQLite is a file-based database bundled inside the app.
 * No server needed. No internet needed. Works in airplane mode.
 *
 * THE DATABASE SCHEMA:
 *   poi(
 *     id         TEXT PRIMARY KEY,   -- Unique ID (OSM node ID)
 *     type       TEXT,               -- 'hospital' | 'police' | 'towing' | etc.
 *     name       TEXT,               -- Display name
 *     lat        REAL,               -- Latitude
 *     lng        REAL,               -- Longitude
 *     phone      TEXT,               -- Contact number
 *     hours      TEXT,               -- Opening hours
 *     capabilities TEXT,             -- JSON: ["neurosurgery", "ventilator"]
 *     country_code TEXT,             -- 'IN', 'US', etc.
 *     confidence REAL DEFAULT 1.0    -- Data quality score (crowdsourced)
 *   )
 *
 * ADAPTIVE RADIUS SEARCH:
 * Instead of always searching within 10km (bad in rural areas),
 * we expand the search radius if too few results are found:
 *   10km → 20km → 50km → "Nearest town" text fallback
 *
 * HAVERSINE IN SQLite:
 * SQLite doesn't have a built-in distance function.
 * We fetch a larger bounding box first (fast), then calculate
 * exact Haversine distance in JavaScript (accurate).
 * This two-step approach is much faster than checking every row.
 */

import * as SQLite from 'expo-sqlite';
import { haversineDistance, sortByDistance } from '../utils/haversine';
import { SEARCH_RADIUS, POI_TYPES, type POIType } from '../utils/constants';

// Define what a POI looks like in our app
export interface POI {
  id: string;
  type: POIType;
  name: string;
  lat: number;
  lng: number;
  phone: string | null;
  hours: string | null;
  capabilities: string[];  // Parsed from JSON string
  country_code: string;
  confidence: number;
  // These are added after the DB query (not stored in DB)
  distance?: number;
  distanceText?: string;
}

// Database instance — module-level singleton
let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize SQLite database
 *
 * This opens (or creates) the database file.
 * Creates the POI table if it doesn't exist yet.
 * Called once when the app starts.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Open the database file — stored in app's private storage
    // 'aether_poi.db' is the filename — Expo handles the path
    db = await SQLite.openDatabaseAsync('aether_poi.db');

    // Create table if it doesn't exist
    // The IF NOT EXISTS means this is safe to run on every launch
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS poi (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        phone TEXT,
        hours TEXT,
        capabilities TEXT DEFAULT '[]',
        country_code TEXT DEFAULT 'XX',
        confidence REAL DEFAULT 1.0
      );

      -- Index on type for fast filtering (e.g., "show only hospitals")
      CREATE INDEX IF NOT EXISTS idx_poi_type ON poi(type);

      -- Index on lat/lng for fast bounding box queries
      CREATE INDEX IF NOT EXISTS idx_poi_location ON poi(lat, lng);

      -- Index on country for country-specific filtering
      CREATE INDEX IF NOT EXISTS idx_poi_country ON poi(country_code);
    `);

    const count = await getPoiCount();
    console.log(`[POIDatabase] Initialized. ${count} POIs in database.`);

    // If database is empty, seed with sample data so app works immediately
    if (count === 0) {
      await seedSampleData();
    }
  } catch (error) {
    console.error('[POIDatabase] Initialization failed:', error);
    throw error;
  }
}

/**
 * MAIN SEARCH FUNCTION — Adaptive Radius POI Search
 *
 * This is the heart of Vertical B.
 * It expands the search radius until enough results are found.
 *
 * @param userLat - User's current latitude
 * @param userLng - User's current longitude
 * @param type - What to search for ('hospital', 'police', etc.)
 * @param minResults - Minimum number of results before stopping expansion
 * @returns Sorted array of POIs (nearest first) with distance
 */
export async function searchPOI(
  userLat: number,
  userLng: number,
  type: POIType,
  minResults: number = SEARCH_RADIUS.MIN_RESULTS
): Promise<POI[]> {
  if (!db) {
    console.error('[POIDatabase] Database not initialized');
    return [];
  }

  // Try each radius step: 10km → 20km → 50km
  const radiusSteps = [
    SEARCH_RADIUS.INITIAL_KM,
    SEARCH_RADIUS.EXPANDED_KM,
    SEARCH_RADIUS.MAX_KM,
  ];

  for (const radiusKm of radiusSteps) {
    const results = await searchWithinRadius(userLat, userLng, type, radiusKm);

    if (results.length >= minResults) {
      console.log(`[POIDatabase] Found ${results.length} ${type}(s) within ${radiusKm}km`);
      return results;
    }

    console.log(`[POIDatabase] Only ${results.length} results within ${radiusKm}km, expanding...`);
  }

  // Final fallback — return whatever we found within 50km, even if < 3
  const finalResults = await searchWithinRadius(userLat, userLng, type, SEARCH_RADIUS.MAX_KM);
  console.log(`[POIDatabase] Final result: ${finalResults.length} ${type}(s) within ${SEARCH_RADIUS.MAX_KM}km`);
  return finalResults;
}

/**
 * Search within a specific radius (internal helper)
 *
 * HOW THE BOUNDING BOX WORKS:
 * Exact circle queries are slow. Instead:
 * 1. Calculate a square bounding box around the user (fast, uses SQL index)
 * 2. Filter results through Haversine in JS (accurate, runs on fewer rows)
 *
 * 1 degree latitude ≈ 111km
 * 1 degree longitude ≈ 111km × cos(latitude) — varies by location
 */
async function searchWithinRadius(
  lat: number,
  lng: number,
  type: POIType,
  radiusKm: number
): Promise<POI[]> {
  if (!db) return [];

  // Calculate bounding box (slightly oversized to ensure no edge cases)
  // 0.01 degrees latitude ≈ 1.11km, so radiusKm/111 gives degrees
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  // SQL query: fast bounding box filter using the lat/lng index
  const rows = await db.getAllAsync<{
    id: string;
    type: string;
    name: string;
    lat: number;
    lng: number;
    phone: string | null;
    hours: string | null;
    capabilities: string;
    country_code: string;
    confidence: number;
  }>(
    `SELECT id, type, name, lat, lng, phone, hours, capabilities, country_code, confidence
     FROM poi
     WHERE type = ?
       AND lat BETWEEN ? AND ?
       AND lng BETWEEN ? AND ?
     ORDER BY confidence DESC
     LIMIT 50`,
    [type, minLat, maxLat, minLng, maxLng]
  );

  // Parse each row and calculate exact Haversine distance
  const pois: POI[] = rows.map((row) => ({
    id: row.id,
    type: row.type as POIType,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    phone: row.phone,
    hours: row.hours,
    capabilities: safeParseJSON(row.capabilities, []),
    country_code: row.country_code,
    confidence: row.confidence,
  }));

  // Sort by actual distance and filter to exact circle (not bounding box)
  const sorted = sortByDistance(pois, lat, lng);
  return sorted.filter((poi) => poi.distance <= radiusKm);
}

/**
 * Insert or update a POI in the database
 * Used by the Python build script and crowdsourced updates
 */
export async function upsertPOI(poi: Omit<POI, 'distance' | 'distanceText'>): Promise<void> {
  if (!db) return;

  await db.runAsync(
    `INSERT OR REPLACE INTO poi
     (id, type, name, lat, lng, phone, hours, capabilities, country_code, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      poi.id,
      poi.type,
      poi.name,
      poi.lat,
      poi.lng,
      poi.phone ?? null,
      poi.hours ?? null,
      JSON.stringify(poi.capabilities),
      poi.country_code,
      poi.confidence,
    ]
  );
}

/**
 * Get total number of POIs (used for diagnostics and exit checklist verification)
 */
export async function getPoiCount(): Promise<number> {
  if (!db) return 0;
  const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM poi');
  return result?.count ?? 0;
}

/**
 * Get POI count by type (for debugging)
 */
export async function getPoiCountByType(): Promise<Record<string, number>> {
  if (!db) return {};
  const rows = await db.getAllAsync<{ type: string; count: number }>(
    'SELECT type, COUNT(*) as count FROM poi GROUP BY type'
  );
  return rows.reduce((acc, row) => ({ ...acc, [row.type]: row.count }), {});
}

/**
 * Seed with sample data so the app is usable immediately after install
 * The Python script will populate with real OSM data
 */
async function seedSampleData(): Promise<void> {
  console.log('[POIDatabase] Seeding sample data for development...');

  const samplePOIs: Omit<POI, 'distance' | 'distanceText'>[] = [
    // Bangalore area hospitals
    {
      id: 'sample_h1',
      type: POI_TYPES.HOSPITAL,
      name: 'Manipal Hospital (Whitefield)',
      lat: 12.9716,
      lng: 77.7494,
      phone: '080-25024444',
      hours: '24/7',
      capabilities: ['neurosurgery', 'ventilator', 'blood_bank', 'ct_scan'],
      country_code: 'IN',
      confidence: 0.9,
    },
    {
      id: 'sample_h2',
      type: POI_TYPES.HOSPITAL,
      name: 'St. John\'s Medical College Hospital',
      lat: 12.9253,
      lng: 77.6175,
      phone: '080-22065000',
      hours: '24/7',
      capabilities: ['neurosurgery', 'ventilator', 'blood_bank', 'burn_unit', 'paediatric_icu'],
      country_code: 'IN',
      confidence: 0.95,
    },
    {
      id: 'sample_h3',
      type: POI_TYPES.HOSPITAL,
      name: 'Victoria Hospital',
      lat: 12.9634,
      lng: 77.5696,
      phone: '080-26701150',
      hours: '24/7',
      capabilities: ['neurosurgery', 'ventilator', 'blood_bank'],
      country_code: 'IN',
      confidence: 0.85,
    },
    // Police stations
    {
      id: 'sample_p1',
      type: POI_TYPES.POLICE,
      name: 'Whitefield Police Station',
      lat: 12.9698,
      lng: 77.7500,
      phone: '080-22944444',
      hours: '24/7',
      capabilities: [],
      country_code: 'IN',
      confidence: 0.9,
    },
    {
      id: 'sample_p2',
      type: POI_TYPES.POLICE,
      name: 'Indiranagar Police Station',
      lat: 12.9716,
      lng: 77.6412,
      phone: '080-22294400',
      hours: '24/7',
      capabilities: [],
      country_code: 'IN',
      confidence: 0.9,
    },
    // Towing services
    {
      id: 'sample_t1',
      type: POI_TYPES.TOWING,
      name: 'City Towing Services',
      lat: 12.9800,
      lng: 77.6200,
      phone: '9876543210',
      hours: '24/7',
      capabilities: [],
      country_code: 'IN',
      confidence: 0.7,
    },
    // Puncture shops
    {
      id: 'sample_pt1',
      type: POI_TYPES.PUNCTURE,
      name: 'Quick Fix Tyres',
      lat: 12.9750,
      lng: 77.6300,
      phone: '9876543211',
      hours: '6AM-10PM',
      capabilities: [],
      country_code: 'IN',
      confidence: 0.7,
    },
  ];

  for (const poi of samplePOIs) {
    await upsertPOI(poi);
  }

  console.log(`[POIDatabase] Seeded ${samplePOIs.length} sample POIs`);
}

// Safe JSON parse with fallback
function safeParseJSON<T>(jsonString: string | null, fallback: T): T {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}
