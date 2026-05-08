/**
 * Map Screen — Visual POI Display
 *
 * Shows hospitals, police stations on a real map with pins.
 * Uses react-native-maps (Google Maps on Android, Apple Maps on iOS).
 *
 * Phase 9 will add blackspot heatmap overlay here.
 * Phase 7 will add live ambulance tracking here.
 */

import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { getLastKnownLocation, type StoredLocation } from '../../services/GPSService';
import { searchPOI, type POI } from '../../services/POIDatabase';
import { POI_TYPES, type POIType } from '../../utils/constants';
import { Colors, Spacing, BorderRadius } from '../../theme';

const FILTER_OPTIONS: Array<{ type: POIType; label: string; color: string }> = [
  { type: POI_TYPES.HOSPITAL, label: 'Hospitals', color: Colors.brand.primary },
  { type: POI_TYPES.POLICE, label: 'Police', color: '#5856D6' },
  { type: POI_TYPES.TOWING, label: 'Towing', color: '#FF9500' },
];

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<StoredLocation | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [activeFilter, setActiveFilter] = useState<POIType>(POI_TYPES.HOSPITAL);
  const [isLoaded, setIsLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadMapData(activeFilter);
    }, [activeFilter])
  );

  async function loadMapData(type: POIType) {
    const loc = await getLastKnownLocation();
    setUserLocation(loc);

    if (loc) {
      const found = await searchPOI(loc.lat, loc.lng, type);
      setPois(found);
      setIsLoaded(true);

      // Center map on user
      mapRef.current?.animateToRegion({
        latitude: loc.lat,
        longitude: loc.lng,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      });
    }
  }

  const markerColor = FILTER_OPTIONS.find(f => f.type === activeFilter)?.color ?? Colors.brand.primary;

  return (
    <View style={styles.container}>
      {/* Filter chips overlay */}
      <View style={styles.filterOverlay}>
        {FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.type}
            style={[
              styles.filterChip,
              activeFilter === opt.type && { backgroundColor: opt.color, borderColor: opt.color },
            ]}
            onPress={() => setActiveFilter(opt.type)}
          >
            <Text
              style={[
                styles.filterLabel,
                activeFilter === opt.type && { color: '#fff', fontWeight: '700' },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        userInterfaceStyle="dark"
        showsUserLocation={true}
        showsMyLocationButton={true}
        initialRegion={{
          latitude: userLocation?.lat ?? 12.9716,
          longitude: userLocation?.lng ?? 77.5946,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
      >
        {/* 10km search radius circle */}
        {userLocation && (
          <Circle
            center={{ latitude: userLocation.lat, longitude: userLocation.lng }}
            radius={10000}  // 10km in meters
            fillColor="rgba(0, 212, 255, 0.05)"
            strokeColor="rgba(0, 212, 255, 0.3)"
            strokeWidth={1}
          />
        )}

        {/* POI Markers */}
        {pois.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.lat, longitude: poi.lng }}
            title={poi.name}
            description={`${poi.distanceText} • ${poi.phone ?? 'No phone'}`}
            pinColor={markerColor}
          />
        ))}
      </MapView>

      {/* POI count */}
      {isLoaded && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{pois.length} found</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  map: {
    flex: 1,
  },
  filterOverlay: {
    position: 'absolute',
    top: 60,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 10,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background.secondary + 'EE',
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  filterLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  countBadge: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: Colors.background.secondary + 'EE',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  countText: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
});
