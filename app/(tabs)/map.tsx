/**
 * Map Screen — Phase 9 Updated
 *
 * CHANGES FROM PREVIOUS VERSION:
 * 1. Added BlackspotMapLayer — renders danger zones as colored circles
 * 2. Added blackspot filter chip "Danger Zones" in the filter bar
 * 3. Added showBlackspots toggle state
 * 4. Loads cached blackspots on screen focus
 *
 * Everything else is IDENTICAL to the original map.tsx.
 * We only ADD — we never remove or break existing functionality.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import MapView, { Marker, Callout, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAppContext } from '../_layout';
import { getLastKnownLocation, type StoredLocation } from '../../services/GPSService';
import { searchPOI, type POI } from '../../services/POIDatabase';
import {
  onlinePOIService,
  MAP_FETCH_RADIUS_M,
  type DataSource,
} from '../../services/OnlinePOIService';
import { useNetworkStatus } from '../../services/NetworkMonitor';
import { POI_TYPES, type POIType } from '../../utils/constants';
import { Colors, BorderRadius, Shadows, Layout } from '../../theme';

// ── PHASE 9 IMPORTS ──────────────────────────────────────────────────────────
import { BlackspotMapLayer } from '../../components/BlackspotMapLayer';
import { loadCachedBlackspots } from '../../services/RoadDNA/BlackspotEngine';
import type { Blackspot } from '../../services/RoadDNA/types';

// ─── Filter config (unchanged from original) ──────────────────────────────────

const CORE_FILTERS: Array<{ type: POIType; label: string; color: string }> = [
  { type: POI_TYPES.HOSPITAL, label: 'Hospital', color: Colors.brand.primary },
  { type: POI_TYPES.POLICE, label: 'Police', color: Colors.brand.accent },
  { type: POI_TYPES.TOWING, label: 'Towing', color: Colors.brand.gold },
];

const ONLINE_ONLY_FILTERS: Array<{ type: POIType; label: string; color: string }> = [
  { type: POI_TYPES.PETROL, label: 'Petrol', color: Colors.brand.purple },
  { type: POI_TYPES.PUNCTURE, label: 'Tyre', color: Colors.status.success },
];

const MARKER_COLOR: Record<string, string> = {
  [POI_TYPES.HOSPITAL]: Colors.brand.primary,
  [POI_TYPES.POLICE]: Colors.status.info,
  [POI_TYPES.TOWING]: Colors.status.warning,
  [POI_TYPES.PETROL]: Colors.brand.purple,
  [POI_TYPES.PUNCTURE]: Colors.status.success,
  [POI_TYPES.BLOOD_BANK]: Colors.brand.primary,
};

const TYPE_LABEL: Record<string, string> = {
  [POI_TYPES.HOSPITAL]: 'Hospital',
  [POI_TYPES.POLICE]: 'Police Station',
  [POI_TYPES.TOWING]: 'Towing Service',
  [POI_TYPES.PETROL]: 'Petrol Station',
  [POI_TYPES.PUNCTURE]: 'Tyre Shop',
  [POI_TYPES.BLOOD_BANK]: 'Blood Bank',
};

// ─── Source badge (unchanged) ─────────────────────────────────────────────────

interface BadgeConfig { label: string; icon: string; color: string; bg: string }

function getBadgeConfig(source: DataSource, loading: boolean): BadgeConfig {
  if (loading) return {
    label: 'Fetching…', icon: 'cloud-download-outline',
    color: Colors.brand.accent, bg: `${Colors.brand.accent}12`,
  };
  switch (source) {
    case 'live': return { label: 'LIVE', icon: 'wifi', color: Colors.status.success, bg: `${Colors.status.success}12` };
    case 'cached': return { label: 'CACHED', icon: 'checkmark-circle', color: Colors.brand.accent, bg: `${Colors.brand.accent}12` };
    default: return { label: 'OFFLINE', icon: 'cloud-offline-outline', color: Colors.status.neutral, bg: `${Colors.status.neutral}12` };
  }
}

// ─── Navigation helpers (unchanged) ──────────────────────────────────────────

function navigateToPOI(poi: POI): void {
  const label = encodeURIComponent(poi.name);
  if (Platform.OS === 'ios') {
    const apple = `maps:0,0?daddr=${poi.lat},${poi.lng}&q=${label}`;
    Linking.canOpenURL(apple)
      .then(ok => ok
        ? Linking.openURL(apple)
        : Linking.openURL(`https://maps.google.com/maps?daddr=${poi.lat},${poi.lng}`)
      )
      .catch(() => Linking.openURL(`https://maps.google.com/maps?daddr=${poi.lat},${poi.lng}`));
  } else {
    Linking.openURL(`geo:${poi.lat},${poi.lng}?q=${poi.lat},${poi.lng}(${label})`)
      .catch(() => Linking.openURL(`https://maps.google.com/maps?daddr=${poi.lat},${poi.lng}`));
  }
}

function callPOI(phone: string): void {
  Linking.openURL(`tel:${phone}`).catch(() =>
    Alert.alert('Cannot call', 'Unable to open the phone dialler.')
  );
}

// ─── Floating POI Card (unchanged) ───────────────────────────────────────────

interface POICardProps { poi: POI; onDismiss: () => void; }

function POIActionCard({ poi, onDismiss }: POICardProps) {
  const slideAnim = useRef(new Animated.Value(120)).current;
  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }, []);
  const pinColor = MARKER_COLOR[poi.type] ?? Colors.brand.primary;
  const typeLabel = TYPE_LABEL[poi.type] ?? poi.type;

  return (
    <Animated.View style={[cardStyles.wrapper, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={cardStyles.handleArea} onPress={onDismiss} activeOpacity={1}>
        <View style={cardStyles.handle} />
      </TouchableOpacity>
      <View style={cardStyles.header}>
        <View style={[cardStyles.typeTag, { backgroundColor: `${pinColor}15` }]}>
          <Text style={[cardStyles.typeText, { color: pinColor }]}>{typeLabel}</Text>
        </View>
        {poi.distanceText ? <Text style={cardStyles.distance}>{poi.distanceText}</Text> : null}
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close-circle" size={22} color={Colors.label.tertiary} />
        </TouchableOpacity>
      </View>
      <Text style={cardStyles.name} numberOfLines={2}>{poi.name}</Text>
      {poi.hours ? (
        <View style={cardStyles.hoursRow}>
          <Ionicons name="time-outline" size={12} color={Colors.label.tertiary} />
          <Text style={cardStyles.hours}>{poi.hours}</Text>
        </View>
      ) : null}
      {poi.capabilities && poi.capabilities.length > 0 && (
        <View style={cardStyles.caps}>
          {poi.capabilities.slice(0, 4).map(cap => (
            <View key={cap} style={cardStyles.capBadge}>
              <Text style={cardStyles.capText}>{cap.replace(/_/g, ' ')}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={cardStyles.divider} />
      <View style={cardStyles.actions}>
        <TouchableOpacity style={[cardStyles.btn, cardStyles.btnNavigate]} onPress={() => navigateToPOI(poi)} activeOpacity={0.8}>
          <Ionicons name="navigate" size={17} color="#FFFFFF" />
          <Text style={cardStyles.btnNavigateText}>Navigate</Text>
        </TouchableOpacity>
        {poi.phone ? (
          <TouchableOpacity style={[cardStyles.btn, cardStyles.btnCall]} onPress={() => callPOI(poi.phone!)} activeOpacity={0.8}>
            <Ionicons name="call" size={17} color={Colors.status.success} />
            <Text style={cardStyles.btnCallText}>Call</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {poi.phone ? <Text style={cardStyles.phoneHint}>{poi.phone}</Text> : null}
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { activeBystanderAlert } = useAppContext();
  const { isConnected } = useNetworkStatus();

  const [userLoc, setUserLoc] = useState<StoredLocation | null>(null);
  const [offlinePOIs, setOfflinePOIs] = useState<POI[]>([]);
  const [filter, setFilter] = useState<POIType>(POI_TYPES.HOSPITAL);
  const [loaded, setLoaded] = useState(false);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [onlinePOIs, setOnlinePOIs] = useState<POI[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>('offline');
  const [onlineLoading, setOnlineLoading] = useState(false);

  // ── PHASE 9: Blackspot state ─────────────────────────────────────────────
  const [blackspots, setBlackspots] = useState<Blackspot[]>([]);
  const [showBlackspots, setShowBlackspots] = useState(true);

  useEffect(() => {
    const unsub = onlinePOIService.onStatusChange(s => {
      setOnlineLoading(s.loading);
      setDataSource(s.source);
    });
    return unsub;
  }, []);

  // Load blackspots when screen focuses
  useFocusEffect(
    useCallback(() => {
      if (isConnected) loadOnlineData();
      else loadOfflineData(filter);

      // ── PHASE 9: Load cached blackspots ────────────────────────────────
      loadCachedBlackspots().then(setBlackspots);
    }, [filter, isConnected])
  );

  useEffect(() => {
    if (isConnected) loadOnlineData();
    else { setOnlinePOIs([]); setDataSource('offline'); loadOfflineData(filter); }
  }, [isConnected]);

  async function loadOnlineData(): Promise<void> {
    const loc = await getLastKnownLocation();
    if (!loc) { loadOfflineData(filter); return; }
    setUserLoc(loc);
    centreMap(loc);
    await onlinePOIService.initialize();
    const cacheValid = await onlinePOIService.isCacheValid(loc.lat, loc.lng);
    if (!cacheValid) {
      onlinePOIService.fetchAndCache(loc.lat, loc.lng, MAP_FETCH_RADIUS_M)
        .then(() => refreshCachedPOIs(loc))
        .catch(() => loadOfflineData(filter));
    }
    await refreshCachedPOIs(loc);
    if (onlinePOIs.length === 0 && !onlineLoading) loadOfflineData(filter);
    setLoaded(true);
  }

  async function refreshCachedPOIs(loc: StoredLocation): Promise<void> {
    const pois = await onlinePOIService.getCachedPOIs(loc.lat, loc.lng, 'all', MAP_FETCH_RADIUS_M / 1000);
    if (pois.length > 0) { setOnlinePOIs(pois); setDataSource('cached'); }
  }

  async function loadOfflineData(type: POIType): Promise<void> {
    const loc = await getLastKnownLocation();
    setUserLoc(loc);
    if (!loc) return;
    centreMap(loc);
    const found = await searchPOI(loc.lat, loc.lng, type);
    setOfflinePOIs(found);
    setLoaded(true);
  }

  function onFilterChange(type: POIType): void {
    setSelectedPOI(null);
    setFilter(type);
    if (isConnected && onlinePOIs.length > 0) return;
    loadOfflineData(type);
  }

  function centreMap(loc: StoredLocation): void {
    mapRef.current?.animateToRegion({
      latitude: loc.lat, longitude: loc.lng,
      latitudeDelta: 0.12, longitudeDelta: 0.12,
    });
  }

  const displayPOIs: POI[] = isConnected && onlinePOIs.length > 0
    ? onlinePOIs.filter(p => p.type === filter)
    : offlinePOIs;

  const allFilters = isConnected ? [...CORE_FILTERS, ...ONLINE_ONLY_FILTERS] : CORE_FILTERS;
  const filterColor = allFilters.find(f => f.type === filter)?.color ?? Colors.brand.primary;
  const badge = getBadgeConfig(isConnected ? dataSource : 'offline', onlineLoading);
  const activeCrash = activeBystanderAlert?.packet ?? null;

  return (
    <View style={styles.container}>

      {/* Filter chips + source badge */}
      <View style={styles.filterBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
          {allFilters.map(f => (
            <TouchableOpacity
              key={f.type}
              style={[
                styles.filterChip,
                filter === f.type
                  ? { backgroundColor: f.color, borderColor: f.color }
                  : { backgroundColor: Colors.background.elevated, borderColor: Colors.border.medium },
              ]}
              onPress={() => onFilterChange(f.type)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, filter === f.type ? { color: '#FFFFFF', fontWeight: '600' } : { color: Colors.label.secondary }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* ── PHASE 9: Danger Zones toggle chip ──────────────────────── */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              showBlackspots
                ? { backgroundColor: '#CC0000', borderColor: '#CC0000' }
                : { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: 'rgba(0,0,0,0.08)' },
            ]}
            onPress={() => setShowBlackspots(!showBlackspots)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, showBlackspots ? { color: '#FFFFFF', fontWeight: '600' } : { color: Colors.label.secondary }]}>
              ⚠ Danger
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={[styles.sourceBadge, { backgroundColor: badge.bg }]}>
          {onlineLoading
            ? <ActivityIndicator size="small" color={badge.color} style={{ width: 12, height: 12 }} />
            : <Ionicons name={badge.icon as any} size={11} color={badge.color} />
          }
          <Text style={[styles.sourceBadgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>

      {/* Live incident badge */}
      {activeCrash && (
        <View style={styles.incidentBadge}>
          <View style={styles.incidentDot} />
          <Text style={styles.incidentBadgeText}>
            Live Incident · {activeBystanderAlert?.distanceM ? `${Math.round(activeBystanderAlert.distanceM)}m away` : 'Nearby'}
          </Text>
        </View>
      )}

      {/* ── PHASE 9: Blackspot count badge ─────────────────────────────── */}
      {showBlackspots && blackspots.length > 0 && (
        <View style={styles.blackspotBadge}>
          <Ionicons name="warning" size={11} color="#CC0000" />
          <Text style={styles.blackspotBadgeText}>
            {blackspots.length} danger zone{blackspots.length !== 1 ? 's' : ''} nearby
          </Text>
        </View>
      )}

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        userInterfaceStyle="light"
        showsUserLocation
        showsMyLocationButton={false}
        onPress={() => setSelectedPOI(null)}
        initialRegion={{
          latitude: userLoc?.lat ?? 12.9716,
          longitude: userLoc?.lng ?? 77.5946,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        }}
      >
        {/* Search radius */}
        {userLoc && (
          <Circle
            center={{ latitude: userLoc.lat, longitude: userLoc.lng }}
            radius={isConnected ? MAP_FETCH_RADIUS_M : 10000}
            fillColor="rgba(22, 72, 208, 0.04)"
            strokeColor="rgba(22, 72, 208, 0.18)"
            strokeWidth={1}
          />
        )}

        {/* POI markers (unchanged) */}
        {displayPOIs.map(poi => {
          const pinColor = isConnected && onlinePOIs.length > 0 ? (MARKER_COLOR[poi.type] ?? filterColor) : filterColor;
          const isSelected = selectedPOI?.id === poi.id;
          return (
            <Marker
              key={poi.id}
              coordinate={{ latitude: poi.lat, longitude: poi.lng }}
              pinColor={isSelected ? '#FFD700' : pinColor}
              tracksViewChanges={false}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedPOI(selectedPOI?.id === poi.id ? null : poi);
              }}
            >
              <Callout tooltip={false}>
                <View style={styles.simpleCallout}>
                  <Text style={styles.simpleCalloutText} numberOfLines={1}>{poi.name}</Text>
                  <Text style={styles.simpleCalloutHint}>Tap for options</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* ── PHASE 9: Blackspot danger zones ──────────────────────────── */}
        {showBlackspots && <BlackspotMapLayer blackspots={blackspots} />}

        {/* Red incident overlay (unchanged) */}
        {activeCrash && (
          <>
            <Circle
              center={{ latitude: activeCrash.lat, longitude: activeCrash.lng }}
              radius={600} fillColor="rgba(239,62,40,0.06)" strokeColor="transparent"
            />
            <Circle
              center={{ latitude: activeCrash.lat, longitude: activeCrash.lng }}
              radius={300} fillColor="rgba(239,62,40,0.12)"
              strokeColor="rgba(239,62,40,0.30)" strokeWidth={1.5}
            />
            <Circle
              center={{ latitude: activeCrash.lat, longitude: activeCrash.lng }}
              radius={100} fillColor="rgba(239,62,40,0.25)"
              strokeColor="rgba(239,62,40,0.50)" strokeWidth={2}
            />
            <Marker
              coordinate={{ latitude: activeCrash.lat, longitude: activeCrash.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.incidentPin}>
                <View style={styles.incidentPinCore} />
              </View>
            </Marker>
          </>
        )}
      </MapView>

      {/* Legend (unchanged) */}
      {isConnected && onlinePOIs.length > 0 && !selectedPOI && (
        <View style={styles.legend}>
          {[...CORE_FILTERS, ...ONLINE_ONLY_FILTERS].map(f => (
            <View key={f.type} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: f.color }]} />
              <Text style={styles.legendText}>{f.label}</Text>
            </View>
          ))}
          {/* ── PHASE 9: Legend entry for blackspots ─────────────────── */}
          {showBlackspots && blackspots.length > 0 && (
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#CC0000' }]} />
              <Text style={styles.legendText}>Danger Zone</Text>
            </View>
          )}
        </View>
      )}

      {/* Count badge (unchanged) */}
      {loaded && !selectedPOI && (
        <View style={styles.countBadge}>
          <Ionicons name="location-outline" size={11} color={Colors.label.secondary} />
          <Text style={styles.countText}>{displayPOIs.length} found · tap a pin for options</Text>
        </View>
      )}

      {/* My location button (unchanged) */}
      {userLoc && (
        <TouchableOpacity
          style={[styles.myLocBtn, selectedPOI ? { bottom: Layout.CONTENT_BOTTOM_PADDING + 200 } : {}]}
          onPress={() => mapRef.current?.animateToRegion({ latitude: userLoc.lat, longitude: userLoc.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 })}
        >
          <Ionicons name="locate" size={20} color={Colors.brand.accent} />
        </TouchableOpacity>
      )}

      {/* Floating POI action card (unchanged) */}
      {selectedPOI && <POIActionCard poi={selectedPOI} onDismiss={() => setSelectedPOI(null)} />}
    </View>
  );
}

// ─── Card styles (unchanged) ──────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background.elevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Layout.CONTENT_BOTTOM_PADDING - 20,
    ...Shadows.lg,
    // Ensure the card sits above the tab bar
    zIndex: 20,
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  typeTag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  distance: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.label.secondary,
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.4,
    marginBottom: 6,
    lineHeight: 26,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  hours: {
    fontSize: 12,
    color: Colors.label.tertiary,
  },
  caps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
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
    fontWeight: '500',
  },
  capMore: {
    fontSize: 10,
    color: Colors.label.tertiary,
    alignSelf: 'center',
  },
  divider: {
    height: 0.5,
    backgroundColor: Colors.separator.nonOpaque,
    marginVertical: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnNavigate: {
    backgroundColor: Colors.brand.accent,
    shadowColor: Colors.brand.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 6,
  },
  btnNavigateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnCall: {
    backgroundColor: `${Colors.status.success}12`,
    borderWidth: 1.5,
    borderColor: `${Colors.status.success}40`,
  },
  btnCallText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.status.success,
  },
  phoneHint: {
    fontSize: 11,
    color: Colors.label.tertiary,
    textAlign: 'center',
  },
});

// ─── Map styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
  map: { flex: 1 },
  filterBarWrapper: { position: 'absolute', top: Layout.STATUS_BAR_HEIGHT + 4, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Layout.HORIZONTAL_PADDING, gap: 8 },
  filterBar: { flexDirection: 'row', gap: 8, paddingRight: 4, flexGrow: 0 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: BorderRadius.full, borderWidth: 1, ...Shadows.sm },
  filterText: { fontSize: 13, fontWeight: '500' },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: BorderRadius.full, ...Shadows.sm },
  sourceBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  incidentBadge: {
    position: 'absolute',
    top: Layout.STATUS_BAR_HEIGHT + 52,
    alignSelf: 'center',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: `${Colors.brand.primary}30`,
    ...Shadows.sm,
  },
  incidentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.brand.primary },
  incidentBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.brand.primary },

  incidentPin: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,59,48,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  incidentPinCore: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.brand.primary,
    borderWidth: 2, borderColor: '#FFFFFF',
  },

  // Simple callout — name only, no buttons
  simpleCallout: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 200,
    ...Shadows.sm,
  },
  simpleCalloutText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.label.primary,
  },
  simpleCalloutHint: {
    fontSize: 10,
    color: Colors.label.tertiary,
    marginTop: 2,
  },

  legend: {
    position: 'absolute',
    bottom: Layout.CONTENT_BOTTOM_PADDING + 70,
    left: Layout.HORIZONTAL_PADDING,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    padding: 10,
    gap: 5,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.label.secondary, fontWeight: '500' },

  countBadge: {
    position: 'absolute',
    bottom: Layout.CONTENT_BOTTOM_PADDING + 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  countText: { fontSize: 13, color: Colors.label.primary, fontWeight: '500' },

  myLocBtn: {
    position: 'absolute',
    bottom: Layout.CONTENT_BOTTOM_PADDING + 60,
    right: Layout.HORIZONTAL_PADDING,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.background.elevated,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
    zIndex: 10,
  },
});