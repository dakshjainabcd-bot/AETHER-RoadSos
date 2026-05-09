/**
 * Map Screen — Premium with Red Incident Overlay
 *
 * Clean Apple Maps-style interface.
 * When a crash is nearby (activeBystanderAlert), renders a red
 * radial glow centered on the incident GPS — matching the
 * safety-app reference screenshot.
 */

import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker, Circle, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAppContext } from '../_layout';
import { getLastKnownLocation, type StoredLocation } from '../../services/GPSService';
import { searchPOI, type POI } from '../../services/POIDatabase';
import { POI_TYPES, type POIType } from '../../utils/constants';
import { Colors, BorderRadius, Shadows, Layout } from '../../theme';

const FILTERS: Array<{ type: POIType; label: string; color: string }> = [
  { type: POI_TYPES.HOSPITAL, label: 'Hospital', color: Colors.brand.primary },
  { type: POI_TYPES.POLICE,   label: 'Police',   color: Colors.brand.accent  },
  { type: POI_TYPES.TOWING,   label: 'Towing',   color: Colors.brand.gold    },
];

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { activeBystanderAlert } = useAppContext();

  const [userLoc, setUserLoc] = useState<StoredLocation | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [filter, setFilter] = useState<POIType>(POI_TYPES.HOSPITAL);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => { loadData(filter); }, [filter])
  );

  async function loadData(type: POIType) {
    const loc = await getLastKnownLocation();
    setUserLoc(loc);
    if (loc) {
      const found = await searchPOI(loc.lat, loc.lng, type);
      setPois(found);
      setLoaded(true);
      mapRef.current?.animateToRegion({
        latitude: loc.lat,
        longitude: loc.lng,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      });
    }
  }

  const activeCrash = activeBystanderAlert?.packet ?? null;
  const filterColor = FILTERS.find(f => f.type === filter)?.color ?? Colors.brand.primary;

  return (
    <View style={styles.container}>
      {/* ── Filter chips — floats over map ──────────────────────── */}
      <View style={styles.filterBar}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.type}
            style={[
              styles.filterChip,
              filter === f.type
                ? { backgroundColor: f.color, borderColor: f.color }
                : { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: 'rgba(0,0,0,0.08)' },
            ]}
            onPress={() => setFilter(f.type)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.type ? { color: '#FFFFFF', fontWeight: '600' } : { color: Colors.label.secondary },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Live incident badge ──────────────────────────────────── */}
      {activeCrash && (
        <View style={styles.incidentBadge}>
          <View style={styles.incidentDot} />
          <Text style={styles.incidentBadgeText}>
            Live Incident · {activeBystanderAlert?.distanceM
              ? `${Math.round(activeBystanderAlert.distanceM)}m away`
              : 'Nearby'}
          </Text>
        </View>
      )}

      {/* ── Map ─────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        userInterfaceStyle="light"
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={{
          latitude: userLoc?.lat ?? 12.9716,
          longitude: userLoc?.lng ?? 77.5946,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        }}
      >
        {/* ── 10 km search radius ─── */}
        {userLoc && (
          <Circle
            center={{ latitude: userLoc.lat, longitude: userLoc.lng }}
            radius={10000}
            fillColor="rgba(0, 122, 255, 0.04)"
            strokeColor="rgba(0, 122, 255, 0.20)"
            strokeWidth={1}
          />
        )}

        {/* ── POI markers ─── */}
        {pois.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.lat, longitude: poi.lng }}
            title={poi.name}
            description={`${poi.distanceText} · ${poi.phone ?? 'No phone'}`}
            pinColor={filterColor}
          />
        ))}

        {/* ── RED INCIDENT OVERLAY (like safety-app reference) ─── */}
        {activeCrash && (
          <>
            {/* Outermost glow — very transparent */}
            <Circle
              center={{ latitude: activeCrash.lat, longitude: activeCrash.lng }}
              radius={600}
              fillColor="rgba(255, 59, 48, 0.06)"
              strokeColor="transparent"
            />
            {/* Mid ring */}
            <Circle
              center={{ latitude: activeCrash.lat, longitude: activeCrash.lng }}
              radius={300}
              fillColor="rgba(255, 59, 48, 0.12)"
              strokeColor="rgba(255, 59, 48, 0.30)"
              strokeWidth={1.5}
            />
            {/* Inner circle — more opaque */}
            <Circle
              center={{ latitude: activeCrash.lat, longitude: activeCrash.lng }}
              radius={100}
              fillColor="rgba(255, 59, 48, 0.25)"
              strokeColor="rgba(255, 59, 48, 0.50)"
              strokeWidth={2}
            />
            {/* Center pin */}
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

      {/* ── POI count badge ─────────────────────────────────────── */}
      {loaded && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{pois.length} found</Text>
        </View>
      )}

      {/* ── My location button ──────────────────────────────────── */}
      {userLoc && (
        <TouchableOpacity
          style={styles.myLocBtn}
          onPress={() =>
            mapRef.current?.animateToRegion({
              latitude: userLoc.lat,
              longitude: userLoc.lng,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            })
          }
        >
          <Ionicons name="locate" size={20} color={Colors.brand.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  map: { flex: 1 },

  // Filter chips — float at top
  filterBar: {
    position: 'absolute',
    top: Layout.STATUS_BAR_HEIGHT + 4,
    left: Layout.HORIZONTAL_PADDING,
    right: Layout.HORIZONTAL_PADDING,
    zIndex: 10,
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    ...Shadows.sm,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Incident badge — below filter bar
  incidentBadge: {
    position: 'absolute',
    top: Layout.STATUS_BAR_HEIGHT + 52,
    alignSelf: 'center',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: `${Colors.brand.primary}30`,
    ...Shadows.sm,
  },
  incidentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.brand.primary,
  },
  incidentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand.primary,
  },

  // Incident pin (center dot on the red overlay)
  incidentPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incidentPinCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.brand.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // Count badge
  countBadge: {
    position: 'absolute',
    bottom: Layout.CONTENT_BOTTOM_PADDING + 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  countText: {
    fontSize: 13,
    color: Colors.label.primary,
    fontWeight: '500',
  },

  // My location button
  myLocBtn: {
    position: 'absolute',
    bottom: Layout.CONTENT_BOTTOM_PADDING + 60,
    right: Layout.HORIZONTAL_PADDING,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
});