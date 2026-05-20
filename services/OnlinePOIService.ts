/**
 * OnlinePOIService — Live POI Fetching via OpenStreetMap Overpass API
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY OVERPASS API?
 * ═══════════════════════════════════════════════════════════════════════
 * - Free, no API key, no billing surprises
 * - Same data source as our bundled SQLite DB (OpenStreetMap)
 * - Global coverage — every OSM-mapped location on Earth
 * - Updated daily by 8 million+ volunteers
 * - One query fetches ALL POI types simultaneously
 *
 * ═══════════════════════════════════════════════════════════════════════
 * HYBRID STRATEGY (Online + Offline)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                     App Opens / Focus                           │
 *   │                            │                                    │
 *   │               ┌────────────┴────────────┐                       │
 *   │           ONLINE                     OFFLINE                    │
 *   │               │                         │                       │
 *   │    ┌──────────▼──────────┐    ┌─────────▼──────────┐           │
 *   │    │ Cache valid (<24h   │    │  Bundled SQLite DB  │           │
 *   │    │ AND <2km from last  │    │  (Phase 1 POI data) │           │
 *   │    │ fetch point)?       │    │  Works in airplane  │           │
 *   │    └──────┬──────┬───────┘    │  mode, always ready │           │
 *   │         YES     NO            └─────────────────────┘           │
 *   │           │      │                                              │
 *   │    Use    │    Fetch from Overpass API → cache → use            │
 *   │    cache  │    (background fetch; show stale cache meanwhile)   │
 *   └───────────┴────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SEPARATE SQLITE DATABASE
 * ═══════════════════════════════════════════════════════════════════════
 * This service manages its own `aether_online_cache.db` — completely
 * separate from the bundled `aether_poi.db`. This means:
 *
 * - Bundled DB is NEVER modified (stays clean for offline fallback)
 * - Cache can be cleared/rebuilt without affecting offline data
 * - No schema migrations needed on the core DB
 *
 * ═══════════════════════════════════════════════════════════════════════
 * CACHE INVALIDATION RULES
 * ═══════════════════════════════════════════════════════════════════════
 * Cache is considered STALE (needs refetch) when EITHER:
 *   1. Age > 24 hours (data may be outdated)
 *   2. User moved > 2km from the fetch origin (new POIs in range)
 */

import * as SQLite from 'expo-sqlite';
import { POI } from './POIDatabase';
import { POI_TYPES, type POIType } from '../utils/constants';
import { runInDbQueue } from '../utils/dbQueue';
import { haversineDistance, sortByDistance } from '../utils/haversine';

// ─── Constants ────────────────────────────────────────────────────────────────

/** OpenStreetMap Overpass API — free, no key required */
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/** Cache expires after 24 hours */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Re-fetch if user moves more than 2km from last fetch point */
const STALE_DISTANCE_KM = 2.0;

/** Default fetch radius for map view */
export const MAP_FETCH_RADIUS_M = 5000; // 5km

/** Extended radius for services search */
export const SERVICES_FETCH_RADIUS_M = 10000; // 10km

// ─── Types ────────────────────────────────────────────────────────────────────

export type DataSource = 'live' | 'cached' | 'offline';

export interface OnlinePOIStatus {
  /** Is a fetch in progress right now? */
  loading: boolean;
  /** Last error message (null = no error) */
  error: string | null;
  /** Where the current data came from */
  source: DataSource;
  /** Total POIs in the cache */
  poiCount: number;
  /** Unix timestamp of the last successful fetch */
  fetchedAt: number | null;
}

type StatusListener = (status: OnlinePOIStatus) => void;

// ─── Raw Overpass element types ───────────────────────────────────────────────

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;    // Present on nodes
  lon?: number;
  center?: { lat: number; lon: number }; // Present on ways/relations
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// ─── Service Class ────────────────────────────────────────────────────────────

class OnlinePOIService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initialized = false;
  private fetching = false;


  private status: OnlinePOIStatus = {
    loading: false,
    error: null,
    source: 'offline',
    poiCount: 0,
    fetchedAt: null,
  };
  private listeners: StatusListener[] = [];

  // ════════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Open/create the cache SQLite database.
   * Safe to call multiple times — idempotent.
   *
   * Call this before any other method. It's called automatically inside
   * fetchAndCache() and getCachedPOIs(), so explicit calls are optional
   * but recommended at app startup for faster first-use.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Note: expo-sqlite returns the SAME connection for the same filename.
      // This is safe to call from multiple places.
      this.db = await SQLite.openDatabaseAsync('aether_online_cache.db');

      await runInDbQueue(() => this.db!.execAsync(`
        -- Main cache table — mirrors the bundled poi table schema
        -- plus cache metadata (cached_at, fetch origin lat/lng)
        CREATE TABLE IF NOT EXISTS poi_cache (
          id            TEXT    PRIMARY KEY,
          type          TEXT    NOT NULL,
          name          TEXT    NOT NULL,
          lat           REAL    NOT NULL,
          lng           REAL    NOT NULL,
          phone         TEXT,
          hours         TEXT,
          capabilities  TEXT    DEFAULT '[]',
          country_code  TEXT    DEFAULT 'XX',
          confidence    REAL    DEFAULT 1.0,
          cached_at     INTEGER NOT NULL,
          fetch_lat     REAL    NOT NULL,
          fetch_lng     REAL    NOT NULL
        );

        -- Indexes for fast spatial queries
        CREATE INDEX IF NOT EXISTS idx_cache_type ON poi_cache(type);
        CREATE INDEX IF NOT EXISTS idx_cache_loc  ON poi_cache(lat, lng);
        CREATE INDEX IF NOT EXISTS idx_cache_age  ON poi_cache(cached_at);
      `));

      // Purge expired entries from previous sessions
      await this.purgeExpired();

      // Count what's already in cache
      const row = await runInDbQueue(() => this.db!.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) as n FROM poi_cache'
      ));
      const count = row?.n ?? 0;
      if (count > 0) {
        this.emit({ source: 'cached', poiCount: count });
      }

      this.initialized = true;
      console.log(`[OnlinePOI] Cache DB ready — ${count} POIs in cache`);
    } catch (err) {
      console.error('[OnlinePOI] Init failed:', err);
      // Non-fatal: app still works with bundled offline data
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // OVERPASS API FETCH
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Build an Overpass QL query for ALL AETHER POI types within radius.
   *
   * We fetch everything in one request (hospitals, police, fuel, etc.)
   * to minimize API calls and avoid multiple Overpass rate-limit hits.
   * Overpass handles mixed-type queries efficiently server-side.
   */
  private buildQuery(lat: number, lng: number, radiusM: number): string {
    // `around:radius,lat,lng` is more accurate than bounding box
    // because it uses true distance, not a square approximation
    return `[out:json][timeout:30];
(
  node["amenity"="hospital"](around:${radiusM},${lat},${lng});
  way["amenity"="hospital"](around:${radiusM},${lat},${lng});
  node["amenity"="clinic"](around:${radiusM},${lat},${lng});
  way["amenity"="clinic"](around:${radiusM},${lat},${lng});
  node["amenity"="police"](around:${radiusM},${lat},${lng});
  way["amenity"="police"](around:${radiusM},${lat},${lng});
  node["amenity"="fuel"](around:${radiusM},${lat},${lng});
  way["amenity"="fuel"](around:${radiusM},${lat},${lng});
  node["amenity"="blood_bank"](around:${radiusM},${lat},${lng});
  node["shop"="tyres"](around:${radiusM},${lat},${lng});
  way["shop"="tyres"](around:${radiusM},${lat},${lng});
  node["service:vehicle:towing"="yes"](around:${radiusM},${lat},${lng});
);
out body center;`;
  }

  /** Map OSM tags → AETHER POI type (mirrors build_poi_db.py logic) */
  private getType(tags: Record<string, string>): POIType | null {
    const amenity = tags.amenity ?? '';
    if (amenity === 'hospital' || amenity === 'clinic') return POI_TYPES.HOSPITAL;
    if (amenity === 'police') return POI_TYPES.POLICE;
    if (amenity === 'fuel') return POI_TYPES.PETROL;
    if (amenity === 'blood_bank') return POI_TYPES.BLOOD_BANK;
    if (tags.shop === 'tyres') return POI_TYPES.PUNCTURE;
    if (tags['service:vehicle:towing'] === 'yes') return POI_TYPES.TOWING;
    return null;
  }

  /** Extract hospital capabilities from OSM tags (mirrors Python script logic) */
  private getCapabilities(tags: Record<string, string>): string[] {
    const caps: string[] = [];
    const spec = tags['healthcare:speciality'] ?? '';
    if (spec.includes('neurology') || spec.includes('neurosurgery')) caps.push('neurosurgery');
    if (tags.emergency === 'yes') caps.push('emergency');
    if (tags['blood_bank'] === 'yes') caps.push('blood_bank');
    if (spec.includes('paediatric') || spec.includes('pediatric')) caps.push('paediatric_icu');
    if (spec.includes('cardiology')) caps.push('cath_lab');
    if (spec.includes('burn')) caps.push('burn_unit');
    const beds = parseInt(tags.beds ?? '0', 10);
    if (beds > 100) caps.push('ventilator');
    return caps;
  }

  /** Convert raw Overpass elements into our normalized POI format */
  private parseElements(elements: OverpassElement[]): Omit<POI, 'distance' | 'distanceText'>[] {
    const result: Omit<POI, 'distance' | 'distanceText'>[] = [];
    const seen = new Set<string>(); // Deduplicate by name+lat+lng

    for (const el of elements) {
      const tags = el.tags ?? {};
      const type = this.getType(tags);
      if (!type) continue;

      // Extract coordinates — nodes have lat/lon directly; ways have center
      let lat: number, lng: number;
      if (el.type === 'node' && el.lat != null && el.lon != null) {
        lat = el.lat; lng = el.lon;
      } else if (el.center) {
        lat = el.center.lat; lng = el.center.lon;
      } else {
        continue; // No coordinates — skip
      }

      // Prefer English name, fall back to any name
      const name = (
        tags['name:en'] ?? tags.name ?? tags.official_name ??
        `${type.charAt(0).toUpperCase()}${type.slice(1)}`
      ).trim();
      if (!name) continue;

      // Deduplicate (Overpass can return the same place as both node + way)
      const dedupeKey = `${name.toLowerCase()}_${lat.toFixed(4)}_${lng.toFixed(4)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const phone =
        tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'] ?? null;
      const hours = tags.opening_hours ?? null;
      const capabilities =
        type === POI_TYPES.HOSPITAL ? this.getCapabilities(tags) : [];

      // Confidence: has phone = 0.9, just named = 0.7, no name = 0.5
      const confidence = phone ? 0.9 : tags.name ? 0.7 : 0.5;

      result.push({
        id: `online_${el.type}_${el.id}`,
        type,
        name,
        lat,
        lng,
        phone,
        hours,
        capabilities,
        country_code: 'XX', // MCC-derived country is handled offline; here we flag as unknown
        confidence,
      });
    }

    return result;
  }

  /**
   * Fetch ALL POI types from Overpass API and save to SQLite cache.
   *
   * This is the PRIMARY method — call it when internet is available.
   * It runs a single Overpass query for all POI types at once.
   *
   * @param lat      Centre latitude for the search
   * @param lng      Centre longitude
   * @param radiusM  Search radius in metres (default: 5000m = 5km)
   * @returns        Number of POIs fetched (0 if fetch failed)
   */
  async fetchAndCache(
    lat: number,
    lng: number,
    radiusM: number = MAP_FETCH_RADIUS_M
  ): Promise<number> {
    // Prevent concurrent fetches (debounce)
    if (this.fetching) return 0;

    // Auto-initialize if needed
    if (!this.initialized) await this.initialize();
    if (!this.db) return 0;

    this.fetching = true;
    this.emit({ loading: true, error: null, source: 'live' });
    console.log(`[OnlinePOI] Fetching POIs — radius: ${radiusM}m at (${lat.toFixed(4)}, ${lng.toFixed(4)})`);

    try {
      const query = this.buildQuery(lat, lng, radiusM);

      // POST query to Overpass (GET would exceed URL length limits)
      const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass requires a User-Agent header to identify the application
          'User-Agent': 'AETHER-RoadSOS/1.0 (road-safety-hackathon)',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`Overpass HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as OverpassResponse;
      const elements = data.elements ?? [];
      const pois = this.parseElements(elements);

      // Write to SQLite cache in a single transaction for speed
      if (pois.length > 0) {
        const now = Date.now();
        await runInDbQueue(async () => {
          for (const poi of pois) {
            await this.db!.runAsync(
              `INSERT OR REPLACE INTO poi_cache
               (id, type, name, lat, lng, phone, hours, capabilities,
                country_code, confidence, cached_at, fetch_lat, fetch_lng)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                poi.id, poi.type, poi.name, poi.lat, poi.lng,
                poi.phone ?? null, poi.hours ?? null,
                JSON.stringify(poi.capabilities),
                poi.country_code, poi.confidence,
                now, lat, lng,
              ]
            );
          }
        });
      }

      const finalCount = pois.length;
      this.emit({
        loading: false,
        error: null,
        source: 'live',
        poiCount: finalCount,
        fetchedAt: Date.now(),
      });

      console.log(`[OnlinePOI] ✅ Cached ${finalCount} POIs from Overpass`);
      return finalCount;

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown fetch error';
      console.warn('[OnlinePOI] ⚠️ Fetch failed:', msg);
      this.emit({ loading: false, error: msg, source: 'cached' });
      return 0;

    } finally {
      this.fetching = false;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CACHE READS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Check whether the current cache is still valid for this location.
   *
   * Returns `false` (stale) if:
   *   - No cache exists yet
   *   - Cache is older than 24 hours
   *   - User has moved > 2km from the last fetch origin
   */
  async isCacheValid(lat: number, lng: number): Promise<boolean> {
    if (!this.initialized) await this.initialize();
    if (!this.db) return false;

    try {
      const row = await runInDbQueue(() => this.db!.getFirstAsync<{
        cached_at: number;
        fetch_lat: number;
        fetch_lng: number;
      }>('SELECT cached_at, fetch_lat, fetch_lng FROM poi_cache ORDER BY cached_at DESC LIMIT 1'));

      if (!row) return false;

      // Age check
      if (Date.now() - row.cached_at > CACHE_TTL_MS) {
        console.log('[OnlinePOI] Cache expired (>24h)');
        return false;
      }

      // Distance check — has user moved significantly?
      const distKm = haversineDistance(lat, lng, row.fetch_lat, row.fetch_lng);
      if (distKm > STALE_DISTANCE_KM) {
        console.log(`[OnlinePOI] Cache stale — user moved ${distKm.toFixed(1)}km from fetch origin`);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cached POIs near a location, optionally filtered by type.
   *
   * Uses a two-step approach:
   * 1. Fast bounding-box SQL query (uses lat/lng index)
   * 2. Exact Haversine distance filter in JavaScript
   *
   * @param userLat   User's current latitude
   * @param userLng   User's current longitude
   * @param type      POI type to return, or 'all' for every type
   * @param radiusKm  Maximum distance to include (km)
   * @returns         Sorted array of POIs (nearest first) with distance attached
   */
  async getCachedPOIs(
    userLat: number,
    userLng: number,
    type: POIType | 'all',
    radiusKm: number
  ): Promise<POI[]> {
    if (!this.initialized) await this.initialize();
    if (!this.db) return [];

    try {
      // Bounding box: slightly oversized to ensure no edge-case misses
      const latDelta = radiusKm / 111;
      const lngDelta = radiusKm / (111 * Math.cos((userLat * Math.PI) / 180));

      // Build query conditionally — 'all' skips the type filter
      let rows: Array<{
        id: string; type: string; name: string; lat: number; lng: number;
        phone: string | null; hours: string | null; capabilities: string;
        country_code: string; confidence: number;
      }>;

      if (type === 'all') {
        rows = await runInDbQueue(() => this.db!.getAllAsync(
          `SELECT id, type, name, lat, lng, phone, hours, capabilities, country_code, confidence
           FROM poi_cache
           WHERE lat BETWEEN ? AND ?
             AND lng BETWEEN ? AND ?
           ORDER BY confidence DESC
           LIMIT 500`,
          [
            userLat - latDelta, userLat + latDelta,
            userLng - lngDelta, userLng + lngDelta,
          ]
        ));
      } else {
        rows = await runInDbQueue(() => this.db!.getAllAsync(
          `SELECT id, type, name, lat, lng, phone, hours, capabilities, country_code, confidence
           FROM poi_cache
           WHERE type = ?
             AND lat BETWEEN ? AND ?
             AND lng BETWEEN ? AND ?
           ORDER BY confidence DESC
           LIMIT 200`,
          [
            type,
            userLat - latDelta, userLat + latDelta,
            userLng - lngDelta, userLng + lngDelta,
          ]
        ));
      }

      // Parse and attach Haversine distance
      const pois: POI[] = rows.map(row => ({
        id: row.id,
        type: row.type as POIType,
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        phone: row.phone,
        hours: row.hours,
        capabilities: this.safeParseJSON(row.capabilities),
        country_code: row.country_code,
        confidence: row.confidence,
      }));

      // Sort nearest-first and trim to exact radius (bounding box is slightly larger)
      return sortByDistance(pois, userLat, userLng)
        .filter(p => (p.distance ?? Infinity) <= radiusKm);

    } catch (err) {
      console.error('[OnlinePOI] Cache read error:', err);
      return [];
    }
  }

  /**
   * Check whether any cached data exists for the area around a location.
   * Used to decide if we should show "Cached" badge without triggering a read.
   */
  async hasCachedData(lat: number, lng: number): Promise<boolean> {
    if (!this.initialized) await this.initialize();
    if (!this.db) return false;
    try {
      const row = await runInDbQueue(() => this.db!.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) as n FROM poi_cache LIMIT 1'
      ));
      return (row?.n ?? 0) > 0;
    } catch {
      return false;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CACHE MAINTENANCE
  // ════════════════════════════════════════════════════════════════════════════

  /** Delete cache entries older than TTL (called on initialize) */
  private async purgeExpired(): Promise<void> {
    if (!this.db) return;
    try {
      const cutoff = Date.now() - CACHE_TTL_MS;
      const result = await runInDbQueue(() => this.db!.runAsync(
        'DELETE FROM poi_cache WHERE cached_at < ?', [cutoff]
      ));
      if (result.changes > 0) {
        console.log(`[OnlinePOI] Purged ${result.changes} expired cache entries`);
      }
    } catch (err) {
      console.warn('[OnlinePOI] Cache purge error:', err);
    }
  }

  /** Manually clear the entire cache (for Settings / debug) */
  async clearCache(): Promise<void> {
    if (!this.db) return;
    try {
      await runInDbQueue(() => this.db!.runAsync('DELETE FROM poi_cache'));
      this.emit({ source: 'offline', poiCount: 0, fetchedAt: null });
      console.log('[OnlinePOI] Cache cleared');
    } catch (err) {
      console.warn('[OnlinePOI] Clear cache error:', err);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STATUS & EVENT SYSTEM
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to real-time status changes.
   *
   * Fires immediately with current status, then on every change.
   *
   * Usage:
   *   const unsub = onlinePOIService.onStatusChange((s) => {
   *     setIsLoading(s.loading);
   *     setDataSource(s.source);
   *   });
   *   // Call unsub() in useEffect cleanup
   *
   * @returns Unsubscribe function
   */
  onStatusChange(cb: StatusListener): () => void {
    this.listeners.push(cb);
    // Immediately emit current status so subscriber has initial value
    try { cb(this.status); } catch {}
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private emit(update: Partial<OnlinePOIStatus>): void {
    this.status = { ...this.status, ...update };
    this.listeners.forEach(cb => {
      try { cb(this.status); } catch {}
    });
  }

  get isLoading(): boolean { return this.status.loading; }
  get currentSource(): DataSource { return this.status.source; }
  get isFetching(): boolean { return this.fetching; }

  // ════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  private safeParseJSON(json: string | null): string[] {
    if (!json) return [];
    try { return JSON.parse(json) as string[]; } catch { return []; }
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────
// One instance shared by map.tsx, services.tsx, and any future consumers.
export const onlinePOIService = new OnlinePOIService();