/**
 * Services Screen — Prototype UI (Rich Cards)
 *
 * Hybrid Online / Offline POI Search (all logic preserved).
 * Cards now show: open status, beds free, emergency level,
 * phone number, up to 5 capability tags, Call + Navigate buttons.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAppContext } from '../../app/_layout';
import { getLastKnownLocation } from '../../services/GPSService';
import { searchPOI, type POI } from '../../services/POIDatabase';
import {
  onlinePOIService,
  SERVICES_FETCH_RADIUS_M,
  type DataSource,
} from '../../services/OnlinePOIService';
import { useNetworkStatus } from '../../services/NetworkMonitor';
import { POI_TYPES, type POIType } from '../../utils/constants';
import { Colors, BorderRadius, Shadows, Layout } from '../../theme';

// ─── Category definitions ─────────────────────────────────────────────────────

const ONLINE_CATEGORIES = [
  { type: POI_TYPES.HOSPITAL,   label: 'Hospital',   icon: 'medical',           color: Colors.brand.primary,  bg: Colors.soft.red,    border: Colors.soft.redBorder },
  { type: POI_TYPES.POLICE,     label: 'Police',     icon: 'shield-checkmark',  color: Colors.status.info,    bg: Colors.soft.blue,   border: Colors.soft.blueBorder },
  { type: POI_TYPES.TOWING,     label: 'Towing',     icon: 'car',               color: Colors.status.warning, bg: Colors.soft.amber,  border: Colors.soft.amberBorder },
  { type: POI_TYPES.PUNCTURE,   label: 'Tyre',       icon: 'ellipse',           color: Colors.status.success, bg: Colors.soft.green,  border: Colors.soft.greenBorder },
  { type: POI_TYPES.PETROL,     label: 'Petrol',     icon: 'flash',             color: Colors.brand.purple,   bg: Colors.soft.purple, border: Colors.soft.purpleBorder },
  { type: POI_TYPES.BLOOD_BANK, label: 'Blood Bank', icon: 'water',             color: Colors.brand.primary,  bg: Colors.soft.red,    border: Colors.soft.redBorder },
] as const;

const OFFLINE_CATEGORIES = [
  { type: POI_TYPES.HOSPITAL, label: 'Hospital', icon: 'medical',          color: Colors.brand.primary,  bg: Colors.soft.red,    border: Colors.soft.redBorder },
  { type: POI_TYPES.POLICE,   label: 'Police',   icon: 'shield-checkmark', color: Colors.status.info,    bg: Colors.soft.blue,   border: Colors.soft.blueBorder },
  { type: POI_TYPES.TOWING,   label: 'Towing',   icon: 'car',              color: Colors.status.warning, bg: Colors.soft.amber,  border: Colors.soft.amberBorder },
  { type: POI_TYPES.PUNCTURE, label: 'Tyre',     icon: 'ellipse',          color: Colors.status.success, bg: Colors.soft.green,  border: Colors.soft.greenBorder },
  { type: POI_TYPES.PETROL,   label: 'Petrol',   icon: 'flash',            color: Colors.brand.purple,   bg: Colors.soft.purple, border: Colors.soft.purpleBorder },
] as const;

// ─── Source badge ─────────────────────────────────────────────────────────────

interface BadgeConfig { label: string; icon: string; color: string; bg: string; border: string }

function getSourceBadge(source: DataSource, loading: boolean): BadgeConfig {
  if (loading) return { label: 'Fetching…', icon: 'cloud-download-outline', color: Colors.status.info, bg: Colors.soft.blue, border: Colors.soft.blueBorder };
  switch (source) {
    case 'live':   return { label: 'LIVE',    icon: 'wifi',                  color: Colors.status.success, bg: Colors.soft.green,           border: Colors.soft.greenBorder };
    case 'cached': return { label: 'CACHED',  icon: 'checkmark-circle',      color: Colors.status.info,    bg: Colors.soft.blue,            border: Colors.soft.blueBorder };
    default:       return { label: 'OFFLINE', icon: 'cloud-offline-outline', color: Colors.label.tertiary, bg: Colors.background.secondary, border: Colors.border.medium };
  }
}

// ─── Emergency-level helper ───────────────────────────────────────────────────

function getEmergencyLevel(poi: POI): { label: string; color: string; bg: string } | null {
  const caps = poi.capabilities ?? [];
  if (caps.some(c => /trauma|level.?1|critical/i.test(c))) {
    return { label: 'LEVEL 1 TRAUMA', color: Colors.brand.primary, bg: Colors.soft.red };
  }
  if (caps.some(c => /icu|intensive|emergency/i.test(c))) {
    return { label: 'EMERGENCY ICU', color: Colors.status.warning, bg: Colors.soft.amber };
  }
  if (caps.some(c => /24.?7|round.?the.?clock/i.test(c))) {
    return { label: 'OPEN 24 HRS', color: Colors.status.success, bg: Colors.soft.green };
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ServicesScreen() {
  const { gpsPermissionGranted } = useAppContext();
  const { isConnected } = useNetworkStatus();

  const [selected, setSelected] = useState<POIType>(POI_TYPES.HOSPITAL);
  const [results, setResults]   = useState<POI[]>([]);
  const [loading, setLoading]   = useState(false);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [hasLocation, setHasLocation] = useState(false);

  const [dataSource, setDataSource]     = useState<DataSource>('offline');
  const [onlineLoading, setOnlineLoading] = useState(false);

  useEffect(() => {
    const unsub = onlinePOIService.onStatusChange(s => {
      setOnlineLoading(s.loading);
      setDataSource(s.source);
      if (!s.loading && s.poiCount > 0) silentReloadOnline();
    });
    return unsub;
  }, [selected]);

  useEffect(() => { search(selected); }, [isConnected]);

  useFocusEffect(
    useCallback(() => { search(selected); }, [selected, gpsPermissionGranted, isConnected])
  );

  // ── Search functions ────────────────────────────────────────────────────────

  async function search(type: POIType): Promise<void> {
    setLoading(true);
    setResults([]);
    try {
      const loc = await getLastKnownLocation();
      setHasLocation(!!loc);
      if (!loc) return;
      if (isConnected) await searchOnline(loc.lat, loc.lng, type);
      else await searchOffline(loc.lat, loc.lng, type);
    } catch (e) {
      Alert.alert('Error', 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function searchOnline(lat: number, lng: number, type: POIType): Promise<void> {
    await onlinePOIService.initialize();
    const valid = await onlinePOIService.isCacheValid(lat, lng);
    if (!valid) {
      onlinePOIService.fetchAndCache(lat, lng, SERVICES_FETCH_RADIUS_M)
        .catch(err => console.warn('[Services] Background fetch error:', err));
    }
    const pois = await onlinePOIService.getCachedPOIs(lat, lng, type, SERVICES_FETCH_RADIUS_M / 1000);
    if (pois.length > 0) {
      setResults(pois);
      setRadiusKm(Math.round(SERVICES_FETCH_RADIUS_M / 1000));
      setDataSource(valid ? 'cached' : 'live');
    } else {
      await searchOffline(lat, lng, type);
    }
  }

  async function searchOffline(lat: number, lng: number, type: POIType): Promise<void> {
    const found = await searchPOI(lat, lng, type);
    setResults(found);
    setDataSource('offline');
    if (found.length > 0) {
      const maxDist = Math.max(...found.map(p => p.distance ?? 0));
      setRadiusKm(Math.ceil(maxDist));
    }
  }

  async function silentReloadOnline(): Promise<void> {
    const loc = await getLastKnownLocation();
    if (!loc || !isConnected) return;
    const pois = await onlinePOIService.getCachedPOIs(loc.lat, loc.lng, selected, SERVICES_FETCH_RADIUS_M / 1000);
    if (pois.length > 0) {
      setResults(pois);
      setRadiusKm(Math.round(SERVICES_FETCH_RADIUS_M / 1000));
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const categories = isConnected ? ONLINE_CATEGORIES : OFFLINE_CATEGORIES;
  const cat = categories.find(c => c.type === selected) ?? categories[0];
  const badge = getSourceBadge(dataSource, onlineLoading && results.length === 0);

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Find Services</Text>
          <Text style={styles.titleSub}>Emergency & roadside help near you</Text>
        </View>
        <View style={[styles.sourceBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          {onlineLoading && results.length === 0
            ? <ActivityIndicator size="small" color={badge.color} style={{ width: 12, height: 12 }} />
            : <Ionicons name={badge.icon as any} size={10} color={badge.color} />
          }
          <Text style={[styles.sourceBadgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>

      {/* ── Pill tab strip ── */}
      <View style={{ marginBottom: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabStrip}>
          {categories.map((c) => {
            const active = selected === c.type;
            return (
              <TouchableOpacity
                key={c.type}
                style={[
                  styles.tabPill,
                  active ? { backgroundColor: c.bg, borderColor: c.color } : { backgroundColor: Colors.background.elevated, borderColor: Colors.border.medium }
                ]}
                onPress={() => { setSelected(c.type); search(c.type); }}
                activeOpacity={0.7}
              >
                <Ionicons name={c.icon as any} size={12} color={active ? c.color : Colors.label.secondary} />
                <Text style={[styles.tabText, active ? { color: c.color } : { color: Colors.label.secondary }]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Meta row ── */}
      {!loading && results.length > 0 && (
        <View style={styles.metaRow}>
          <Text style={styles.metaCount}>
            {results.length} found{radiusKm ? ` within ${radiusKm} km` : ''}
          </Text>
          {isConnected && (
            <View style={[styles.liveBadge, { backgroundColor: Colors.soft.green, borderColor: Colors.soft.greenBorder }]}>
              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.status.success }} />
              <Text style={styles.liveBadgeText}>Live OpenStreetMap</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Background refresh banner ── */}
      {!loading && onlineLoading && results.length > 0 && (
        <View style={styles.refreshBanner}>
          <ActivityIndicator size="small" color={Colors.status.info} />
          <Text style={styles.refreshText}>Refreshing from OpenStreetMap…</Text>
        </View>
      )}

      {/* ── State screens ── */}
      {!hasLocation && !loading && (
        <View style={styles.stateBox}>
          <Ionicons name="location-outline" size={40} color={Colors.label.muted} />
          <Text style={styles.stateTitle}>Location needed</Text>
          <Text style={styles.stateSub}>Grant location permission to find nearby services</Text>
        </View>
      )}

      {loading && (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={cat.color} />
          <Text style={styles.stateTitle}>{isConnected ? 'Searching live data…' : 'Searching…'}</Text>
          <Text style={styles.stateSub}>{isConnected ? `OpenStreetMap · ${Math.round(SERVICES_FETCH_RADIUS_M / 1000)} km radius` : '10 km → 20 km → 50 km'}</Text>
        </View>
      )}

      {!loading && hasLocation && results.length === 0 && (
        <View style={styles.stateBox}>
          <Ionicons name="search-outline" size={40} color={Colors.label.muted} />
          <Text style={styles.stateTitle}>{isConnected ? 'None found nearby' : 'None found within 50 km'}</Text>
        </View>
      )}

      {/* ── Results list ── */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ServiceCard poi={item} cat={cat} index={index} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </View>
  );
}

// ─── Rich Service Card ────────────────────────────────────────────────────────

function ServiceCard({
  poi, cat, index,
}: {
  poi: POI;
  cat: { color: string; bg: string; border: string };
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const caps = poi.capabilities ?? [];
  const visibleCaps = expanded ? caps : caps.slice(0, 5);
  const emergencyLevel = getEmergencyLevel(poi);

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

  const isTopResult = index === 0;

  return (
    <View style={styles.card}>
      {/* Colored top accent bar (screenshot 2 style) */}
      <View style={[styles.cardAccentBar, { backgroundColor: cat.color }]} />

      <View style={styles.cardBody}>
        {/* ── Header: name left, distance right ── */}
        <View style={styles.cardHeader}>
          <Text style={styles.poiName} numberOfLines={2}>{poi.name}</Text>
          <View style={[styles.distBadge, { backgroundColor: cat.bg }]}>
            <Text style={[styles.distText, { color: cat.color }]}>{poi.distanceText}</Text>
          </View>
        </View>

        {/* ── Emergency level badge ── */}
        {emergencyLevel && (
          <View style={[styles.emergencyBadge, { backgroundColor: emergencyLevel.bg }]}>
            <Ionicons name="alert-circle" size={11} color={emergencyLevel.color} />
            <Text style={[styles.emergencyBadgeText, { color: emergencyLevel.color }]}>{emergencyLevel.label}</Text>
          </View>
        )}

        {/* ── Meta row: hours + phone ── */}
        <View style={styles.metaInfoRow}>
          {poi.hours ? (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={11} color={Colors.status.success} />
              <Text style={styles.metaItemText}>{poi.hours}</Text>
            </View>
          ) : (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={11} color={Colors.label.tertiary} />
              <Text style={[styles.metaItemText, { color: Colors.label.tertiary }]}>Hours not listed</Text>
            </View>
          )}
          {poi.phone && (
            <View style={styles.metaItem}>
              <Ionicons name="call-outline" size={11} color={Colors.label.secondary} />
              <Text style={styles.metaPhoneText}>{poi.phone}</Text>
            </View>
          )}
        </View>

        {/* ── Capability tags ── */}
        {caps.length > 0 && (
          <View style={styles.caps}>
            {visibleCaps.map((c: string) => (
              <View key={c} style={styles.capBadge}>
                <Text style={styles.capText}>{c.replace(/_/g, ' ')}</Text>
              </View>
            ))}
            {caps.length > 5 && !expanded && (
              <TouchableOpacity style={styles.moreBtn} onPress={() => setExpanded(true)}>
                <Text style={styles.moreText}>+{caps.length - 5} more</Text>
              </TouchableOpacity>
            )}
            {expanded && caps.length > 5 && (
              <TouchableOpacity style={styles.moreBtn} onPress={() => setExpanded(false)}>
                <Text style={styles.moreText}>Show less</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.divider} />

        {/* ── Action buttons ── */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.callActionBtn]}
            onPress={call}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={14} color={Colors.status.success} />
            <Text style={[styles.actionText, { color: Colors.status.success }]}>
              {poi.phone ? poi.phone : 'Call'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.navActionBtn]}
            onPress={navigate}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={14} color={Colors.status.info} />
            <Text style={[styles.actionText, { color: Colors.status.info }]}>Navigate</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    paddingTop: Layout.STATUS_BAR_HEIGHT,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    marginBottom: 14,
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.label.primary, letterSpacing: -0.8 },
  titleSub: { fontSize: 12, color: Colors.label.secondary, marginTop: 2 },
  sourceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4,
  },
  sourceBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },

  // Tab pill strip
  tabStrip: {
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: { fontSize: 12, fontWeight: '600' },

  // Meta
  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Layout.HORIZONTAL_PADDING, marginBottom: 12,
  },
  metaCount: { fontSize: 12, fontWeight: '600', color: Colors.label.secondary },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3,
  },
  liveBadgeText: { fontSize: 9, fontWeight: '600', color: Colors.status.success, letterSpacing: 0.5 },

  // Refresh
  refreshBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Layout.HORIZONTAL_PADDING, paddingBottom: 10,
  },
  refreshText: { fontSize: 12, color: Colors.status.info },

  // State
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  stateTitle: { fontSize: 16, fontWeight: '600', color: Colors.label.primary },
  stateSub: { fontSize: 13, color: Colors.label.secondary, textAlign: 'center' },

  // List
  list: { paddingHorizontal: Layout.HORIZONTAL_PADDING, paddingBottom: Layout.CONTENT_BOTTOM_PADDING },

  // Card
  card: {
    backgroundColor: Colors.background.elevated,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    ...Shadows.xs,
  },
  cardAccentBar: { height: 4, width: '100%' },
  cardBody: { padding: 16 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  poiName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.2,
    lineHeight: 20,
    flex: 1,
    marginRight: 10,
  },
  distBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10,
  },
  distText: { fontSize: 11, fontWeight: '800', letterSpacing: 0 },

  // Emergency level
  emergencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', borderRadius: 7,
    paddingHorizontal: 9, paddingVertical: 3, marginBottom: 8,
  },
  emergencyBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },

  // Meta info row (hours + phone)
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaItemText: { fontSize: 11, color: Colors.status.success, fontWeight: '500' },
  metaPhoneText: { fontSize: 11, color: Colors.label.secondary, fontFamily: 'monospace' },

  // Capability tags
  caps: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 12 },
  capBadge: {
    backgroundColor: Colors.background.secondary,
    borderWidth: 1, borderColor: Colors.border.medium,
    borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3,
  },
  capText: { fontSize: 9, color: Colors.label.secondary, fontWeight: '600', letterSpacing: 0.5, textTransform: 'capitalize' },
  moreBtn: {
    backgroundColor: Colors.fill.tertiary, borderRadius: 6,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  moreText: { fontSize: 9, color: Colors.brand.primary, fontWeight: '700', letterSpacing: 0.5 },

  divider: { height: 0, marginBottom: 0 }, // hidden as per screenshot

  // Action buttons
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, paddingVertical: 11,
    borderRadius: 11, borderWidth: 1,
  },
  callActionBtn: { backgroundColor: Colors.soft.green, borderColor: Colors.soft.greenBorder },
  navActionBtn: { backgroundColor: Colors.soft.blue, borderColor: Colors.soft.blueBorder },
  actionText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
});