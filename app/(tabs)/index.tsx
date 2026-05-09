/**
 * Home Screen — Premium iOS Design
 *
 * Design language: Apple Health / Apple Music home screen.
 * White background, large bold AETHER title, colored emergency number cards,
 * clean nearest-services list, floating nav clearance at bottom.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { useAppContext } from '../_layout';
import {
  getLastKnownLocation,
  getCurrentLocation,
  type StoredLocation,
} from '../../services/GPSService';
import { searchPOI, type POI } from '../../services/POIDatabase';
import { POI_TYPES } from '../../utils/constants';
import { Colors, Spacing, BorderRadius, Shadows, Layout } from '../../theme';
import { BystanderAlert } from '../../components/BystanderAlert';
import { EmergencyNumbers } from '../../components/EmergencyNumbers';
import { GPSIndicator } from '../../components/GPSIndicator';
import { POICard } from '../../components/POICard';

export default function HomeScreen() {
  const {
    emergencyNumbers,
    gpsPermissionGranted,
    activeBystanderAlert,
    clearBystanderAlert,
    meshConnected,
    meshPeerCount,
    crashState,
  } = useAppContext();

  const [location, setLocation] = useState<StoredLocation | null>(null);
  const [nearestHospital, setNearestHospital] = useState<POI | null>(null);
  const [nearestPolice, setNearestPolice] = useState<POI | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [gpsPermissionGranted])
  );

  async function loadData() {
    try {
      const loc = (await getLastKnownLocation()) ?? (await getCurrentLocation());
      setLocation(loc);
      if (loc) {
        const [hospitals, police] = await Promise.all([
          searchPOI(loc.lat, loc.lng, POI_TYPES.HOSPITAL, 1),
          searchPOI(loc.lat, loc.lng, POI_TYPES.POLICE, 1),
        ]);
        setNearestHospital(hospitals[0] ?? null);
        setNearestPolice(police[0] ?? null);
      }
    } catch (e) {
      console.error('[Home] load error:', e);
    }
  }

  async function onRefresh() {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }

  return (
    <>
      {/* Bystander Alert modal — unchanged logic */}
      <BystanderAlert
        packet={activeBystanderAlert?.packet ?? null}
        distanceM={activeBystanderAlert?.distanceM ?? 0}
        emergencyAmbulanceNumber={emergencyNumbers.ambulance}
        onDismiss={clearBystanderAlert}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.brand.primary}
          />
        }
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            {/* Large title like Apple Music "Home" */}
            <Text style={styles.brandName}>AETHER</Text>
            <Text style={styles.brandSub}>{emergencyNumbers.country}</Text>
          </View>
          <GPSIndicator location={location} />
        </View>

        {/* ── Mesh Status Pill ────────────────────────────────── */}
        <MeshPill connected={meshConnected} peers={meshPeerCount} />

        {/* ── Crash Detection Pill ─────────────────────────────── */}
        <CrashDetectionPill state={crashState} />

        {/* ── Emergency Numbers ───────────────────────────────── */}
        <Text style={styles.sectionHeader}>Emergency Numbers</Text>
        <EmergencyNumbers emergencyNumbers={emergencyNumbers} />

        {/* ── Nearest Services ────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Nearest</Text>

        {!gpsPermissionGranted && (
          <LocationWarning />
        )}

        <View style={styles.poiList}>
          {nearestHospital && <POICard poi={nearestHospital} />}
          {nearestPolice && (
            <View style={styles.poiGap}>
              <POICard poi={nearestPolice} />
            </View>
          )}
          {!nearestHospital && !nearestPolice && gpsPermissionGranted && (
            <View style={styles.emptyPOI}>
              <Text style={styles.emptyPOIText}>Searching nearby services…</Text>
            </View>
          )}
        </View>

        {/* ── Offline Badge ───────────────────────────────────── */}
        <View style={styles.offlineBadge}>
          <Ionicons name="wifi-outline" size={11} color={Colors.status.success} />
          <Text style={styles.offlineBadgeText}>Works fully offline · No internet required</Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MeshPill({ connected, peers }: { connected: boolean; peers: number }) {
  const color = connected ? Colors.brand.accent : Colors.status.neutral;
  const text = connected
    ? `Mesh active · ${peers} device${peers !== 1 ? 's' : ''} online`
    : 'Mesh offline';
  return (
    <View style={[styles.meshPill, { borderColor: `${color}30`, backgroundColor: `${color}0D` }]}>
      <View style={[styles.meshDot, { backgroundColor: connected ? color : Colors.status.neutral }]} />
      <Text style={[styles.meshText, { color }]}>{text}</Text>
    </View>
  );
}

function CrashDetectionPill({ state }: { state: string }) {
  const isCandidate = state === 'candidate';
  const isEmergency = state === 'countdown' || state === 'dispatching' || state === 'active_sos';
  const color = isEmergency
    ? Colors.brand.primary
    : isCandidate
    ? Colors.status.warning
    : Colors.status.success;
  const label = isEmergency
    ? '🚨 Crash Detected'
    : isCandidate
    ? '⚠️ Impact candidate'
    : '🛡  Crash Detection · Monitoring';
  return (
    <View style={[styles.meshPill, { borderColor: `${color}30`, backgroundColor: `${color}0D`, marginBottom: 20 }]}>
      <View style={[styles.meshDot, { backgroundColor: color }]} />
      <Text style={[styles.meshText, { color }]}>{label}</Text>
    </View>
  );
}

function LocationWarning() {
  return (
    <View style={styles.locationWarn}>
      <Ionicons name="location-outline" size={14} color={Colors.status.warning} />
      <Text style={styles.locationWarnText}>Enable location to find nearby services</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background.grouped,
  },
  content: {
    paddingTop: Layout.STATUS_BAR_HEIGHT + 4,
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    paddingBottom: Layout.CONTENT_BOTTOM_PADDING,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  titleBlock: {
    gap: 2,
  },
  // Large title — matches "Home" placement in Apple Music
  brandName: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.label.primary,
    letterSpacing: -1.5,
    lineHeight: 44,
  },
  brandSub: {
    fontSize: 13,
    color: Colors.label.secondary,
    fontWeight: '400',
    letterSpacing: -0.1,
  },

  // Mesh pill
  meshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: 28,
  },
  meshDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  meshText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: -0.1,
  },

  // Section header (like "EMERGENCY NUMBERS" in the sketch)
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.label.secondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },

  // POI list
  poiList: {
    gap: 10,
    marginBottom: 28,
  },
  poiGap: {},

  emptyPOI: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 20,
    alignItems: 'center',
    ...Shadows.xs,
  },
  emptyPOIText: {
    fontSize: 14,
    color: Colors.label.secondary,
  },

  // Offline badge
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: `${Colors.status.success}12`,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: `${Colors.status.success}25`,
  },
  offlineBadgeText: {
    fontSize: 11,
    color: Colors.status.success,
    fontWeight: '500',
  },

  // Location warning
  locationWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Colors.status.warning}12`,
    borderRadius: BorderRadius.md,
    padding: 12,
    marginBottom: 10,
  },
  locationWarnText: {
    fontSize: 13,
    color: Colors.status.warning,
    fontWeight: '500',
  },
});