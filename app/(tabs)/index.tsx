/**
 * Home Screen — First Thing Users See
 *
 * CONTENT:
 * 1. Emergency numbers for the detected country (big, readable, one-tap-to-call)
 * 2. GPS status indicator (green/yellow/red)
 * 3. Quick-access nearest hospital and police (from SQLite)
 * 4. Offline status badge (reassures user the app works without internet)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { useAppContext } from '../_layout';
import { getLastKnownLocation, getCurrentLocation, getAccuracyLevel, type StoredLocation } from '../../services/GPSService';
import { searchPOI, type POI } from '../../services/POIDatabase';
import { POI_TYPES } from '../../utils/constants';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../theme';

export default function HomeScreen() {
  const { emergencyNumbers, gpsPermissionGranted } = useAppContext();

  const [location, setLocation] = useState<StoredLocation | null>(null);
  const [nearestHospital, setNearestHospital] = useState<POI | null>(null);
  const [nearestPolice, setNearestPolice] = useState<POI | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState(false);

  // Load data whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadLocationAndPOIs();
    }, [gpsPermissionGranted])
  );

  async function loadLocationAndPOIs() {
    setIsLoadingPOIs(true);
    try {
      // Get current location
      const loc = await getLastKnownLocation() ?? await getCurrentLocation();
      setLocation(loc);

      if (loc) {
        // Fetch nearest hospital and police in parallel
        const [hospitals, police] = await Promise.all([
          searchPOI(loc.lat, loc.lng, POI_TYPES.HOSPITAL, 1),
          searchPOI(loc.lat, loc.lng, POI_TYPES.POLICE, 1),
        ]);

        setNearestHospital(hospitals[0] ?? null);
        setNearestPolice(police[0] ?? null);
      }
    } catch (error) {
      console.error('[HomeScreen] Failed to load data:', error);
    } finally {
      setIsLoadingPOIs(false);
    }
  }

  async function onRefresh() {
    setIsRefreshing(true);
    await loadLocationAndPOIs();
    setIsRefreshing(false);
  }

  // Dial an emergency number
  function dialNumber(number: string, label: string) {
    Alert.alert(
      `Call ${label}`,
      `Calling ${number}...`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Call ${number}`,
          style: 'destructive',
          onPress: () => Linking.openURL(`tel:${number}`),
        },
      ]
    );
  }

  const accuracyLevel = location ? getAccuracyLevel(location.accuracy) : 'none';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={Colors.brand.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AETHER</Text>
          <Text style={styles.headerSubtitle}>{emergencyNumbers.country}</Text>
        </View>
        <GPSIndicator level={accuracyLevel} location={location} />
      </View>

      {/* Offline Badge — reassures user */}
      <View style={styles.offlineBadge}>
        <Ionicons name="wifi-outline" size={12} color={Colors.status.success} />
        <Text style={styles.offlineBadgeText}>Works Offline • No internet needed</Text>
      </View>

      {/* Emergency Numbers Section */}
      <Text style={styles.sectionTitle}>Emergency Numbers</Text>

      <View style={styles.emergencyGrid}>
        <EmergencyButton
          label="Police"
          number={emergencyNumbers.police}
          icon="shield"
          color="#5856D6"
          onPress={() => dialNumber(emergencyNumbers.police, 'Police')}
        />
        <EmergencyButton
          label="Ambulance"
          number={emergencyNumbers.ambulance}
          icon="medkit"
          color={Colors.brand.primary}
          onPress={() => dialNumber(emergencyNumbers.ambulance, 'Ambulance')}
        />
        <EmergencyButton
          label="Fire"
          number={emergencyNumbers.fire}
          icon="flame"
          color="#FF9500"
          onPress={() => dialNumber(emergencyNumbers.fire, 'Fire')}
        />
        <EmergencyButton
          label="Universal"
          number={emergencyNumbers.unified}
          icon="call"
          color="#34C759"
          onPress={() => dialNumber(emergencyNumbers.unified, 'Emergency')}
        />
      </View>

      {/* Nearest Services */}
      <Text style={styles.sectionTitle}>Nearest Services</Text>

      {!gpsPermissionGranted && (
        <View style={styles.gpsWarning}>
          <Ionicons name="location-outline" size={16} color={Colors.status.warning} />
          <Text style={styles.gpsWarningText}>
            Enable location permission to find nearby services
          </Text>
        </View>
      )}

      {nearestHospital && (
        <NearbyCard
          poi={nearestHospital}
          icon="medical"
          color={Colors.brand.primary}
        />
      )}

      {nearestPolice && (
        <NearbyCard
          poi={nearestPolice}
          icon="shield-checkmark"
          color="#5856D6"
        />
      )}

      {isLoadingPOIs && !nearestHospital && (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Searching nearby services...</Text>
        </View>
      )}

      {/* Bottom padding for tab bar */}
      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

// ── Sub-components ──────────────────────────────────────────

function GPSIndicator({ level, location }: { level: string; location: StoredLocation | null }) {
  const dotColor = {
    good: Colors.status.success,
    fair: Colors.status.warning,
    poor: Colors.status.danger,
    none: Colors.status.neutral,
  }[level] ?? Colors.status.neutral;

  const label = {
    good: `±${location ? Math.round(location.accuracy) : '?'}m`,
    fair: 'Weak GPS',
    poor: 'Poor GPS',
    none: 'No GPS',
  }[level] ?? 'No GPS';

  return (
    <View style={styles.gpsIndicator}>
      <View style={[styles.gpsDot, { backgroundColor: dotColor }]} />
      <Text style={[styles.gpsLabel, { color: dotColor }]}>{label}</Text>
    </View>
  );
}

function EmergencyButton({
  label,
  number,
  icon,
  color,
  onPress,
}: {
  label: string;
  number: string;
  icon: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.emergencyButton, { borderColor: color + '40' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.emergencyIconBg, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={[styles.emergencyNumber, { color }]}>{number}</Text>
      <Text style={styles.emergencyLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function NearbyCard({ poi, icon, color }: { poi: POI; icon: string; color: string }) {
  function callPOI() {
    if (poi.phone) {
      Linking.openURL(`tel:${poi.phone}`);
    }
  }

  return (
    <View style={styles.nearbyCard}>
      <View style={[styles.nearbyIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <View style={styles.nearbyInfo}>
        <Text style={styles.nearbyName} numberOfLines={1}>{poi.name}</Text>
        <Text style={styles.nearbyDistance}>{poi.distanceText} away</Text>
        {poi.phone && (
          <Text style={styles.nearbyPhone}>{poi.phone}</Text>
        )}
      </View>
      {poi.phone && (
        <TouchableOpacity style={styles.callButton} onPress={callPOI}>
          <Ionicons name="call" size={18} color={Colors.status.success} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: 56, // Account for status bar
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.brand.primary,
    letterSpacing: 3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.text.muted,
    marginTop: 2,
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.full,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gpsLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.status.success + '15',
    borderColor: Colors.status.success + '30',
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: Spacing['2xl'],
  },
  offlineBadgeText: {
    fontSize: 11,
    color: Colors.status.success,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  emergencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing['2xl'],
  },
  emergencyButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 8,
  },
  emergencyIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyNumber: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  emergencyLabel: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  gpsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.status.warning + '15',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  gpsWarningText: {
    fontSize: 13,
    color: Colors.status.warning,
    flex: 1,
  },
  nearbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  nearbyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyInfo: {
    flex: 1,
  },
  nearbyName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  nearbyDistance: {
    fontSize: 12,
    color: Colors.brand.accent,
    fontWeight: '600',
  },
  nearbyPhone: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.status.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing['2xl'],
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.text.muted,
    fontSize: 14,
  },
});
