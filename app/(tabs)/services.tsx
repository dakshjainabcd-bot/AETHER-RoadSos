/**
 * Services Screen — Find Nearby Emergency Services
 *
 * This implements Verticals A and B of Phase 1:
 * - Find hospitals, police, ambulance, towing, puncture shops
 * - SQLite adaptive radius search (10km → 20km → 50km)
 * - Works fully offline — no internet required
 * - One-tap to call any result
 */

import { useState, useCallback } from 'react';
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
import { POI_TYPES, type POIType } from '../../utils/constants';
import { Colors, Spacing, BorderRadius, Shadows } from '../../theme';

// Service categories shown in the tab selector
const SERVICE_CATEGORIES = [
  { type: POI_TYPES.HOSPITAL, label: 'Hospitals', icon: 'medical', color: Colors.brand.primary },
  { type: POI_TYPES.POLICE, label: 'Police', icon: 'shield-checkmark', color: '#5856D6' },
  { type: POI_TYPES.TOWING, label: 'Towing', icon: 'car', color: '#FF9500' },
  { type: POI_TYPES.PUNCTURE, label: 'Puncture', icon: 'ellipse', color: '#34C759' },
  { type: POI_TYPES.PETROL, label: 'Petrol', icon: 'flash', color: '#FFD700' },
] as const;

export default function ServicesScreen() {
  const { gpsPermissionGranted } = useAppContext();

  const [selectedType, setSelectedType] = useState<POIType>(POI_TYPES.HOSPITAL);
  const [results, setResults] = useState<POI[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchRadius, setSearchRadius] = useState<number | null>(null);
  const [locationAvailable, setLocationAvailable] = useState(false);

  // Re-search whenever screen is focused or category changes
  useFocusEffect(
    useCallback(() => {
      performSearch(selectedType);
    }, [selectedType, gpsPermissionGranted])
  );

  async function performSearch(type: POIType) {
    setIsLoading(true);
    setResults([]);

    try {
      const location = await getLastKnownLocation();
      setLocationAvailable(!!location);

      if (!location) {
        setIsLoading(false);
        return;
      }

      // The adaptive radius search is inside searchPOI
      // It will try 10km → 20km → 50km automatically
      const found = await searchPOI(location.lat, location.lng, type);
      setResults(found);

      // Show the radius that was actually used
      if (found.length > 0) {
        const maxDist = Math.max(...found.map(p => p.distance ?? 0));
        setSearchRadius(Math.ceil(maxDist));
      }

    } catch (error) {
      console.error('[ServicesScreen] Search failed:', error);
      Alert.alert('Search Error', 'Could not search for services. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const selectedCategory = SERVICE_CATEGORIES.find(c => c.type === selectedType)!;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Find Services</Text>
        <View style={styles.offlinePill}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlinePillText}>Offline</Text>
        </View>
      </View>

      {/* Category Selector */}
      <View style={styles.categoryScroll}>
        {SERVICE_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.type}
            style={[
              styles.categoryChip,
              selectedType === cat.type && {
                backgroundColor: cat.color + '25',
                borderColor: cat.color,
              },
            ]}
            onPress={() => setSelectedType(cat.type)}
          >
            <Ionicons
              name={cat.icon as any}
              size={16}
              color={selectedType === cat.type ? cat.color : Colors.text.muted}
            />
            <Text
              style={[
                styles.categoryLabel,
                selectedType === cat.type && { color: cat.color, fontWeight: '700' },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Result count and radius info */}
      {!isLoading && results.length > 0 && (
        <Text style={styles.resultsMeta}>
          {results.length} found{searchRadius ? ` within ${searchRadius}km` : ''}
        </Text>
      )}

      {/* No GPS warning */}
      {!locationAvailable && !isLoading && (
        <View style={styles.noGPS}>
          <Ionicons name="location-outline" size={40} color={Colors.text.muted} />
          <Text style={styles.noGPSTitle}>Location needed</Text>
          <Text style={styles.noGPSSubtitle}>
            Enable location permission to find nearby services
          </Text>
        </View>
      )}

      {/* Loading */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={selectedCategory.color} />
          <Text style={styles.loadingText}>Searching for {selectedCategory.label.toLowerCase()}...</Text>
          <Text style={styles.loadingSubtext}>10km → 20km → 50km</Text>
        </View>
      )}

      {/* Results */}
      {!isLoading && locationAvailable && results.length === 0 && (
        <View style={styles.noResults}>
          <Ionicons name="search-outline" size={40} color={Colors.text.muted} />
          <Text style={styles.noResultsTitle}>None found within 50km</Text>
          <Text style={styles.noResultsSubtitle}>
            Try calling the national emergency number
          </Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <POIResultCard poi={item} accentColor={selectedCategory.color} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ── POI Result Card ──────────────────────────────────────────

function POIResultCard({ poi, accentColor }: { poi: POI; accentColor: string }) {
  function call() {
    if (poi.phone) {
      Linking.openURL(`tel:${poi.phone}`);
    } else {
      Alert.alert('No number', 'No phone number available for this location.');
    }
  }

  function navigate() {
    const url = `geo:${poi.lat},${poi.lng}?q=${poi.lat},${poi.lng}(${encodeURIComponent(poi.name)})`;
    Linking.openURL(url).catch(() => {
      // Fallback: Google Maps URL
      Linking.openURL(`https://maps.google.com/?q=${poi.lat},${poi.lng}`);
    });
  }

  return (
    <View style={styles.card}>
      {/* Distance badge */}
      <View style={[styles.distanceBadge, { backgroundColor: accentColor + '20' }]}>
        <Text style={[styles.distanceText, { color: accentColor }]}>
          {poi.distanceText}
        </Text>
      </View>

      <Text style={styles.poiName}>{poi.name}</Text>

      {poi.hours && (
        <View style={styles.hoursRow}>
          <Ionicons name="time-outline" size={12} color={Colors.text.muted} />
          <Text style={styles.hoursText}>{poi.hours}</Text>
        </View>
      )}

      {poi.capabilities && poi.capabilities.length > 0 && (
        <View style={styles.capabilitiesRow}>
          {poi.capabilities.slice(0, 3).map((cap) => (
            <View key={cap} style={styles.capBadge}>
              <Text style={styles.capText}>{cap.replace(/_/g, ' ')}</Text>
            </View>
          ))}
          {poi.capabilities.length > 3 && (
            <Text style={styles.moreCapText}>+{poi.capabilities.length - 3} more</Text>
          )}
        </View>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: Colors.status.success + '20' }]}
          onPress={call}
        >
          <Ionicons name="call" size={16} color={Colors.status.success} />
          <Text style={[styles.actionLabel, { color: Colors.status.success }]}>
            {poi.phone ?? 'Call'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: Colors.brand.accent + '20' }]}
          onPress={navigate}
        >
          <Ionicons name="navigate" size={16} color={Colors.brand.accent} />
          <Text style={[styles.actionLabel, { color: Colors.brand.accent }]}>Navigate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    paddingTop: 56,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.status.success + '15',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  offlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.status.success,
  },
  offlinePillText: {
    fontSize: 11,
    color: Colors.status.success,
    fontWeight: '600',
  },
  categoryScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: 8,
    marginBottom: Spacing.lg,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  categoryLabel: {
    fontSize: 13,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  resultsMeta: {
    fontSize: 12,
    color: Colors.text.muted,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.text.secondary,
  },
  loadingSubtext: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  noGPS: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['4xl'],
    gap: 12,
  },
  noGPSTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  noGPSSubtitle: {
    fontSize: 14,
    color: Colors.text.muted,
    textAlign: 'center',
  },
  noResults: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['4xl'],
    gap: 12,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  noResultsSubtitle: {
    fontSize: 14,
    color: Colors.text.muted,
    textAlign: 'center',
  },
  list: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  distanceBadge: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  poiName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  hoursText: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  capabilitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  capBadge: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  capText: {
    fontSize: 10,
    color: Colors.text.muted,
    textTransform: 'capitalize',
  },
  moreCapText: {
    fontSize: 10,
    color: Colors.text.muted,
    alignSelf: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
