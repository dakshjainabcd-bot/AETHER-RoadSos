/**
 * Services Screen — Premium iOS Design
 *
 * iOS-style category chips + clean card list.
 * All logic unchanged — only visual layer upgraded.
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
import { Colors, Spacing, BorderRadius, Shadows, Layout } from '../../theme';

const CATEGORIES = [
  { type: POI_TYPES.HOSPITAL, label: 'Hospital', icon: 'medical',          color: Colors.brand.primary,    tint: Colors.tint.ambulance },
  { type: POI_TYPES.POLICE,   label: 'Police',   icon: 'shield-checkmark', color: Colors.brand.accent,     tint: Colors.tint.police    },
  { type: POI_TYPES.TOWING,   label: 'Towing',   icon: 'car',              color: Colors.brand.gold,       tint: Colors.tint.fire      },
  { type: POI_TYPES.PUNCTURE, label: 'Tyre',     icon: 'ellipse',          color: Colors.status.success,   tint: Colors.tint.universal },
  { type: POI_TYPES.PETROL,   label: 'Petrol',   icon: 'flash',            color: Colors.brand.purple,     tint: Colors.tint.towing    },
] as const;

export default function ServicesScreen() {
  const { gpsPermissionGranted } = useAppContext();

  const [selected, setSelected] = useState<POIType>(POI_TYPES.HOSPITAL);
  const [results, setResults]   = useState<POI[]>([]);
  const [loading, setLoading]   = useState(false);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [hasLocation, setHasLocation] = useState(false);

  useFocusEffect(
    useCallback(() => { search(selected); }, [selected, gpsPermissionGranted])
  );

  async function search(type: POIType) {
    setLoading(true);
    setResults([]);
    try {
      const loc = await getLastKnownLocation();
      setHasLocation(!!loc);
      if (!loc) { setLoading(false); return; }

      const found = await searchPOI(loc.lat, loc.lng, type);
      setResults(found);
      if (found.length > 0) {
        const max = Math.max(...found.map(p => p.distance ?? 0));
        setRadiusKm(Math.ceil(max));
      }
    } catch (e) {
      Alert.alert('Error', 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const cat = CATEGORIES.find(c => c.type === selected)!;

  return (
    <View style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Find Services</Text>
        {/* Offline indicator */}
        <View style={styles.offlinePill}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlinePillText}>Offline</Text>
        </View>
      </View>

      {/* ── Category chips (horizontal scroll via wrapping) ──────── */}
      <View style={styles.chips}>
        {CATEGORIES.map((c) => {
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
              onPress={() => setSelected(c.type)}
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
          {results.length} found{radiusKm ? ` within ${radiusKm} km` : ''}
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
          <Text style={styles.stateTitle}>Searching…</Text>
          <Text style={styles.stateSub}>10 km → 20 km → 50 km</Text>
        </View>
      )}

      {!loading && hasLocation && results.length === 0 && (
        <View style={styles.stateBox}>
          <Ionicons name="search-outline" size={36} color={Colors.label.tertiary} />
          <Text style={styles.stateTitle}>None found within 50 km</Text>
          <Text style={styles.stateSub}>Call the national emergency number</Text>
        </View>
      )}

      {/* ── Results ─────────────────────────────────────────────── */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <POIResultCard poi={item} accentColor={cat.color} tint={cat.tint} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

// ── POI Result Card ─────────────────────────────────────────────────────────

function POIResultCard({ poi, accentColor, tint }: { poi: POI; accentColor: string; tint: string }) {
  function call() {
    if (poi.phone) Linking.openURL(`tel:${poi.phone}`);
    else Alert.alert('No number', 'No phone number available.');
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
        {/* Distance badge */}
        <View style={[styles.distBadge, { backgroundColor: tint }]}>
          <Text style={[styles.distText, { color: accentColor }]}>{poi.distanceText}</Text>
        </View>
        {/* POI name */}
        <Text style={styles.poiName}>{poi.name}</Text>
        {/* Hours */}
        {poi.hours ? (
          <View style={styles.hoursRow}>
            <Ionicons name="time-outline" size={11} color={Colors.label.tertiary} />
            <Text style={styles.hoursText}>{poi.hours}</Text>
          </View>
        ) : null}
      </View>

      {/* Capability badges */}
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

      {/* Action buttons */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: `${Colors.status.success}12`, borderColor: `${Colors.status.success}30` }]}
          onPress={call}
        >
          <Ionicons name="call" size={15} color={Colors.status.success} />
          <Text style={[styles.actionText, { color: Colors.status.success }]}>
            {poi.phone ?? 'Call'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: `${Colors.brand.accent}10`, borderColor: `${Colors.brand.accent}25` }]}
          onPress={navigate}
        >
          <Ionicons name="navigate" size={15} color={Colors.brand.accent} />
          <Text style={[styles.actionText, { color: Colors.brand.accent }]}>Navigate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.grouped,
    paddingTop: Layout.STATUS_BAR_HEIGHT + 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    marginBottom: 18,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.8,
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${Colors.status.success}12`,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  offlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.status.success },
  offlinePillText: { fontSize: 11, color: Colors.status.success, fontWeight: '600' },

  // Chips
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    gap: 8,
    marginBottom: 16,
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

  meta: {
    fontSize: 12,
    color: Colors.label.secondary,
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    marginBottom: 10,
  },

  // States
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 10,
  },
  stateTitle: { fontSize: 17, fontWeight: '600', color: Colors.label.primary },
  stateSub: { fontSize: 14, color: Colors.label.secondary, textAlign: 'center' },

  // List
  list: {
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    paddingBottom: Layout.CONTENT_BOTTOM_PADDING,
  },

  // Card
  card: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    ...Shadows.sm,
  },
  cardTop: { marginBottom: 10 },
  distBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginBottom: 8,
  },
  distText: { fontSize: 11, fontWeight: '700' },
  poiName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.label.primary,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hoursText: { fontSize: 11, color: Colors.label.tertiary },

  caps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  capBadge: {
    backgroundColor: Colors.background.grouped,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  capText: { fontSize: 10, color: Colors.label.secondary, textTransform: 'capitalize' },
  capMore: { fontSize: 10, color: Colors.label.tertiary, alignSelf: 'center' },

  cardActions: { flexDirection: 'row', gap: 10 },
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
  actionText: { fontSize: 13, fontWeight: '600' },
});