/**
 * Services Screen — Hybrid Online / Offline POI Search
 *
 * ONLINE MODE (internet available):
 *   • Uses OnlinePOIService cache (Overpass API data)
 *   • Shows ALL service types including petrol + tyre shops
 *   • Results update automatically when cache refreshes
 *   • "LIVE" / "CACHED" badge shows data freshness
 *   • Coverage: every OSM-mapped location on Earth within 10km
 *
 * OFFLINE MODE (no internet / airplane mode):
 *   • Falls back to bundled SQLite DB (Phase 1 behaviour — unchanged)
 *   • "OFFLINE" badge shown prominently
 *   • Adaptive radius: 10km → 20km → 50km
 *   • Always works, even with no SIM card
 *
 * DESIGN DECISION — WHY NOT ALWAYS USE OVERPASS ONLINE?
 * ──────────────────────────────────────────────────────
 * Overpass API has rate limits and can be slow on 2G.
 * We cache aggressively (24h, invalidated by 2km movement) so that:
 *   - First open on WiFi: fetch once, fast
 *   - Subsequent opens: instant cache reads
 *   - On a highway with intermittent signal: stale cache beats no data
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAppContext } from '../_layout';
import { getLastKnownLocation } from '../../services/GPSService';
import { searchPOI, type POI } from '../../services/POIDatabase';
import {
  onlinePOIService,
  SERVICES_FETCH_RADIUS_M,
  type DataSource,
} from '../../services/OnlinePOIService';
import { useNetworkStatus } from '../../services/NetworkMonitor';
import { POI_TYPES, type POIType } from '../../utils/constants';
import { Colors, Spacing, BorderRadius, Shadows, Layout } from '../../theme';

// ─── Category definitions ────────────────────────────────────────────────────

/**
 * Full category list shown when online.
 * Extra types (petrol, tyre, blood bank) come from live Overpass data
 * which covers them globally — the bundled SQLite DB may not have them
 * everywhere, so we only show them when live/cached data is available.
 */
const ONLINE_CATEGORIES = [
  { type: POI_TYPES.HOSPITAL,   label: 'Hospital',   icon: 'medical',           color: Colors.brand.primary,  tint: Colors.tint.ambulance },
  { type: POI_TYPES.POLICE,     label: 'Police',     icon: 'shield-checkmark',  color: Colors.brand.accent,   tint: Colors.tint.police    },
  { type: POI_TYPES.TOWING,     label: 'Towing',     icon: 'car',               color: Colors.brand.gold,     tint: Colors.tint.fire      },
  { type: POI_TYPES.PUNCTURE,   label: 'Tyre',       icon: 'ellipse',           color: Colors.status.success, tint: Colors.tint.universal },
  { type: POI_TYPES.PETROL,     label: 'Petrol',     icon: 'flash',             color: Colors.brand.purple,   tint: Colors.tint.petrol    },
  { type: POI_TYPES.BLOOD_BANK, label: 'Blood Bank', icon: 'water',             color: Colors.brand.primary,  tint: Colors.tint.ambulance },
] as const;

/** Subset shown offline (bundled DB has good coverage for these) */
const OFFLINE_CATEGORIES = [
  { type: POI_TYPES.HOSPITAL, label: 'Hospital', icon: 'medical',          color: Colors.brand.primary,  tint: Colors.tint.ambulance },
  { type: POI_TYPES.POLICE,   label: 'Police',   icon: 'shield-checkmark', color: Colors.brand.accent,   tint: Colors.tint.police    },
  { type: POI_TYPES.TOWING,   label: 'Towing',   icon: 'car',              color: Colors.brand.gold,     tint: Colors.tint.fire      },
  { type: POI_TYPES.PUNCTURE, label: 'Tyre',     icon: 'ellipse',          color: Colors.status.success, tint: Colors.tint.universal },
  { type: POI_TYPES.PETROL,   label: 'Petrol',   icon: 'flash',            color: Colors.brand.purple,   tint: Colors.tint.petrol    },
] as const;

// ─── Source badge ─────────────────────────────────────────────────────────────

interface BadgeConfig { label: string; icon: string; color: string; bg: string }

function getSourceBadge(source: DataSource, loading: boolean): BadgeConfig {
  if (loading) return {
    label: 'Fetching…',
    icon: 'cloud-download-outline',
    color: Colors.brand.accent,
    bg: `${Colors.brand.accent}12`,
  };
  switch (source) {
    case 'live':   return { label: 'LIVE',    icon: 'wifi',               color: Colors.status.success, bg: `${Colors.status.success}12` };
    case 'cached': return { label: 'CACHED',  icon: 'checkmark-circle',   color: Colors.brand.accent,   bg: `${Colors.brand.accent}12`   };
    default:       return { label: 'OFFLINE', icon: 'cloud-offline-outline', color: Colors.status.neutral, bg: `${Colors.status.neutral}12` };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ServicesScreen() {
  const { gpsPermissionGranted } = useAppContext();
  const { isConnected } = useNetworkStatus();

  // ── Common state ──────────────────────────────────────────────────────
  const [selected, setSelected] = useState<POIType>(POI_TYPES.HOSPITAL);
  const [results, setResults]   = useState<POI[]>([]);
  const [loading, setLoading]   = useState(false);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [hasLocation, setHasLocation] = useState(false);

  // ── Online state ──────────────────────────────────────────────────────
  const [dataSource, setDataSource] = useState<DataSource>('offline');
  const [onlineLoading, setOnlineLoading] = useState(false);

  // Subscribe to service status
  useEffect(() => {
    const unsub = onlinePOIService.onStatusChange(s => {
      setOnlineLoading(s.loading);
      setDataSource(s.source);
      // When a background fetch finishes, reload results for current type
      if (!s.loading && s.poiCount > 0) {
        silentReloadOnline();
      }
    });
    return unsub;
  }, [selected]);

  // ── Reload when connectivity changes ──────────────────────────────────
  useEffect(() => {
    search(selected);
  }, [isConnected]);

  // ── Reload on focus ───────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => { search(selected); }, [selected, gpsPermissionGranted, isConnected])
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SEARCH FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Main search entry point.
   * Routes to online or offline path based on connectivity.
   */
  async function search(type: POIType): Promise<void> {
    setLoading(true);
    setResults([]);

    try {
      const loc = await getLastKnownLocation();
      setHasLocation(!!loc);
      if (!loc) return;

      if (isConnected) {
        await searchOnline(loc.lat, loc.lng, type);
      } else {
        await searchOffline(loc.lat, loc.lng, type);
      }
    } catch (e) {
      Alert.alert('Error', 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * ONLINE SEARCH:
   * 1. Initialize cache DB
   * 2. Check validity — if stale, trigger background fetch
   * 3. Read matching type from cache
   * 4. Fall back to offline if cache is empty
   */
  async function searchOnline(
    lat: number,
    lng: number,
    type: POIType
  ): Promise<void> {
    await onlinePOIService.initialize();

    const valid = await onlinePOIService.isCacheValid(lat, lng);
    if (!valid) {
      // Non-blocking fetch — results will trickle in via status listener
      onlinePOIService
        .fetchAndCache(lat, lng, SERVICES_FETCH_RADIUS_M)
        .catch(err => console.warn('[Services] Background fetch error:', err));
    }

    const pois = await onlinePOIService.getCachedPOIs(
      lat, lng, type,
      SERVICES_FETCH_RADIUS_M / 1000  // metres → km
    );

    if (pois.length > 0) {
      setResults(pois);
      setRadiusKm(Math.round(SERVICES_FETCH_RADIUS_M / 1000));
      setDataSource(valid ? 'cached' : 'live');
    } else {
      // Cache empty (first run) — fall back to offline while fetch runs
      await searchOffline(lat, lng, type);
    }
  }

  /**
   * OFFLINE SEARCH (Phase 1 unchanged):
   * Adaptive radius on bundled SQLite DB.
   */
  async function searchOffline(
    lat: number,
    lng: number,
    type: POIType
  ): Promise<void> {
    const found = await searchPOI(lat, lng, type);
    setResults(found);
    setDataSource('offline');
    if (found.length > 0) {
      const maxDist = Math.max(...found.map(p => p.distance ?? 0));
      setRadiusKm(Math.ceil(maxDist));
    }
  }

  /**
   * Silent reload after a background fetch completes.
   * Doesn't show the loading spinner — results just update in place.
   */
  async function silentReloadOnline(): Promise<void> {
    const loc = await getLastKnownLocation();
    if (!loc || !isConnected) return;

    const pois = await onlinePOIService.getCachedPOIs(
      loc.lat, loc.lng, selected,
      SERVICES_FETCH_RADIUS_M / 1000
    );
    if (pois.length > 0) {
      setResults(pois);
      setRadiusKm(Math.round(SERVICES_FETCH_RADIUS_M / 1000));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const categories = isConnected ? ONLINE_CATEGORIES : OFFLINE_CATEGORIES;
  const cat = categories.find(c => c.type === selected) ?? categories[0];
  const badge = getSourceBadge(dataSource, onlineLoading && results.length === 0);

  return (
    <View style={styles.container}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Find Services</Text>

        {/* Source badge */}
        <View style={[styles.sourcePill, { backgroundColor: badge.bg }]}>
          {onlineLoading && results.length === 0
            ? <ActivityIndicator size="small" color={badge.color} style={{ width: 12, height: 12 }} />
            : <Ionicons name={badge.icon as any} size={11} color={badge.color} />
          }
          <Text style={[styles.sourcePillText, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
      </View>

      {/* ── Online notice banner ─────────────────────────────────── */}
      {isConnected && (
        <View style={styles.noticeBanner}>
          <Ionicons name="globe-outline" size={13} color={Colors.brand.accent} />
          <Text style={styles.noticeText}>
            Showing live OpenStreetMap data · {Math.round(SERVICES_FETCH_RADIUS_M / 1000)}km radius
          </Text>
        </View>
      )}

      {/* ── Category chips ───────────────────────────────────────── */}
      <View style={styles.chips}>
        {categories.map((c) => {
          const active = selected === c.type;
          return (
            <TouchableOpacity
              key={c.type}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: c.tint, borderColor: `${c.color}40` }
                  : { backgroundColor: Colors.background.elevated, borderColor: Colors.border.subtle },
              ]}
              onPress={() => {
                setSelected(c.type);
                search(c.type);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name={c.icon as any} size={15} color={active ? c.color : Colors.label.secondary} />
              <Text style={[styles.chipText, active && { color: c.color, fontWeight: '600' }]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Result meta ─────────────────────────────────────────── */}
      {!loading && results.length > 0 && (
        <Text style={styles.meta}>
          {results.length} found
          {radiusKm ? ` within ${radiusKm} km` : ''}
          {isConnected ? ' · Live OpenStreetMap' : ' · Bundled database'}
        </Text>
      )}

      {/* ── States ──────────────────────────────────────────────── */}
      {!hasLocation && !loading && (
        <View style={styles.stateBox}>
          <Ionicons name="location-outline" size={36} color={Colors.label.tertiary} />
          <Text style={styles.stateTitle}>Location needed</Text>
          <Text style={styles.stateSub}>Grant location permission to find nearby services</Text>
        </View>
      )}

      {loading && (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={cat.color} />
          <Text style={styles.stateTitle}>
            {isConnected ? 'Searching live data…' : 'Searching…'}
          </Text>
          <Text style={styles.stateSub}>
            {isConnected
              ? `OpenStreetMap · ${Math.round(SERVICES_FETCH_RADIUS_M / 1000)} km radius`
              : '10 km → 20 km → 50 km'}
          </Text>
        </View>
      )}

      {/* Background fetch spinner (results visible, new data loading) */}
      {!loading && onlineLoading && results.length > 0 && (
        <View style={styles.refreshBanner}>
          <ActivityIndicator size="small" color={Colors.brand.accent} />
          <Text style={styles.refreshText}>Refreshing from OpenStreetMap…</Text>
        </View>
      )}

      {!loading && hasLocation && results.length === 0 && (
        <View style={styles.stateBox}>
          <Ionicons name="search-outline" size={36} color={Colors.label.tertiary} />
          <Text style={styles.stateTitle}>
            {isConnected ? 'None found nearby' : 'None found within 50 km'}
          </Text>
          <Text style={styles.stateSub}>
            {isConnected
              ? 'No OpenStreetMap data in this area. Try offline mode.'
              : 'Call the national emergency number'}
          </Text>
        </View>
      )}

      {/* ── Results ─────────────────────────────────────────────── */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <POIResultCard
            poi={item}
            accentColor={cat.color}
            tint={cat.tint}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

// ─── POI Result Card (identical to original) ──────────────────────────────────

function POIResultCard({
  poi,
  accentColor,
  tint,
}: {
  poi: POI;
  accentColor: string;
  tint: string;
}) {
  function call() {
    if (poi.phone) Linking.openURL(`tel:${poi.phone}`);
    else Alert.alert('No number', 'No phone number available for this location.');
  }

  function navigate() {
    const url = `geo:${poi.lat},${poi.lng}?q=${poi.lat},${poi.lng}(${encodeURIComponent(poi.name)})`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${poi.lat},${poi.lng}`)
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.distBadge, { backgroundColor: tint }]}>
          <Text style={[styles.distText, { color: accentColor }]}>{poi.distanceText}</Text>
        </View>
        <Text style={styles.poiName}>{poi.name}</Text>
        {poi.hours ? (
          <View style={styles.hoursRow}>
            <Ionicons name="time-outline" size={11} color={Colors.label.tertiary} />
            <Text style={styles.hoursText}>{poi.hours}</Text>
          </View>
        ) : null}
      </View>

      {poi.capabilities?.length > 0 && (
        <View style={styles.caps}>
          {poi.capabilities.slice(0, 3).map((c) => (
            <View key={c} style={styles.capBadge}>
              <Text style={styles.capText}>{c.replace(/_/g, ' ')}</Text>
            </View>
          ))}
          {poi.capabilities.length > 3 && (
            <Text style={styles.capMore}>+{poi.capabilities.length - 3}</Text>
          )}
        </View>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: `${Colors.status.success}12`, borderColor: `${Colors.status.success}30` },
          ]}
          onPress={call}
        >
          <Ionicons name="call" size={15} color={Colors.status.success} />
          <Text style={[styles.actionText, { color: Colors.status.success }]}>
            {poi.phone ?? 'Call'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: `${Colors.brand.accent}10`, borderColor: `${Colors.brand.accent}25` },
          ]}
          onPress={navigate}
        >
          <Ionicons name="navigate" size={15} color={Colors.brand.accent} />
          <Text style={[styles.actionText, { color: Colors.brand.accent }]}>Navigate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.grouped,
    paddingTop: Layout.STATUS_BAR_HEIGHT + 4,
  },

  // ── Header ───────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.8,
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sourcePillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Online notice banner ──────────────────────────────────────────────
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: Layout.HORIZONTAL_PADDING,
    marginBottom: 10,
    backgroundColor: `${Colors.brand.accent}0A`,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: `${Colors.brand.accent}20`,
  },
  noticeText: {
    fontSize: 12,
    color: Colors.brand.accent,
    fontWeight: '500',
  },

  // ── Chips ─────────────────────────────────────────────────────────────
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    color: Colors.label.secondary,
    fontWeight: '500',
  },

  // ── Meta / refresh ────────────────────────────────────────────────────
  meta: {
    fontSize: 12,
    color: Colors.label.secondary,
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    marginBottom: 10,
  },
  refreshBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    paddingBottom: 8,
  },
  refreshText: {
    fontSize: 12,
    color: Colors.brand.accent,
  },

  // ── State screens ─────────────────────────────────────────────────────
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 10,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.label.primary,
  },
  stateSub: {
    fontSize: 14,
    color: Colors.label.secondary,
    textAlign: 'center',
  },

  // ── List ──────────────────────────────────────────────────────────────
  list: {
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    paddingBottom: Layout.CONTENT_BOTTOM_PADDING,
  },

  // ── Card ──────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    ...Shadows.sm,
  },
  cardTop: {
    marginBottom: 10,
  },
  distBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginBottom: 8,
  },
  distText: {
    fontSize: 11,
    fontWeight: '700',
  },
  poiName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.label.primary,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hoursText: {
    fontSize: 11,
    color: Colors.label.tertiary,
  },

  // ── Capability badges ──────────────────────────────────────────────────
  caps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  capBadge: {
    backgroundColor: Colors.background.grouped,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  capText: {
    fontSize: 10,
    color: Colors.label.secondary,
    textTransform: 'capitalize',
  },
  capMore: {
    fontSize: 10,
    color: Colors.label.tertiary,
    alignSelf: 'center',
  },

  // ── Action buttons ────────────────────────────────────────────────────
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});