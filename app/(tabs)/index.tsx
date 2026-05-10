/**
 * Home Screen — Matches screenshot design exactly.
 * All backend logic preserved. Only UI/layout changed.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
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
import { Colors, Layout } from '../../theme';
import { EmergencyNumbers } from '../../components/EmergencyNumbers';
import { POICard } from '../../components/POICard';

export default function HomeScreen() {
  const {
    emergencyNumbers,
    gpsPermissionGranted,
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
        {/* ── AETHER Header ──────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.brandName}>AETHER</Text>
        </View>

        {/* ── Emergency Numbers ──────────────────────────────── */}
        <Text style={styles.sectionLabel}>EMERGENCY NUMBERS</Text>
        <EmergencyNumbers emergencyNumbers={emergencyNumbers} />

        {/* ── Nearest row: label + Quick Contacts card ───────── */}
        <View style={styles.nearestRow}>
          <Text style={styles.nearestLabel}>NEAREST</Text>
          <QuickContactsCard />
        </View>

        {/* ── Location warning ───────────────────────────────── */}
        {!gpsPermissionGranted && <LocationWarning />}

        {/* ── POI Cards ──────────────────────────────────────── */}
        {nearestHospital && (
          <View style={styles.poiWrap}>
            <POICard poi={nearestHospital} />
          </View>
        )}
        {nearestPolice && (
          <View style={styles.poiWrap}>
            <POICard poi={nearestPolice} />
          </View>
        )}
        {!nearestHospital && !nearestPolice && gpsPermissionGranted && (
          <View style={styles.poiWrap}>
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Searching nearby services…</Text>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
  );
}

// ── Quick Status & Contacts card ─────────────────────────────────────────────

function QuickContactsCard() {
  return (
    <View style={styles.quickCard}>
      {/* Left: person icon + text */}
      <View style={styles.quickLeft}>
        <View style={styles.quickIconWrap}>
          <Ionicons name="person-outline" size={17} color="#666666" />
        </View>
        <View style={styles.quickTexts}>
          <Text style={styles.quickTitle} numberOfLines={1}>
            Quick Status & Contacts
          </Text>
          <Text style={styles.quickSub} numberOfLines={1}>
            Your Emergency Contacts (3)
          </Text>
        </View>
      </View>
      {/* Right: small chart decoration */}
      <MiniChart />
    </View>
  );
}

// Purely decorative mini chart matching screenshot
function MiniChart() {
  const bars = [
    { height: 10, color: Colors.brand.gold },
    { height: 18, color: Colors.brand.primary },
    { height: 14, color: Colors.status.success },
    { height: 22, color: Colors.brand.primary },
    { height: 12, color: Colors.brand.gold },
    { height: 8,  color: Colors.status.success },
  ];
  return (
    <View style={styles.miniChart}>
      {bars.map((b, i) => (
        <View
          key={i}
          style={[
            styles.miniBar,
            { height: b.height, backgroundColor: b.color },
          ]}
        />
      ))}
    </View>
  );
}

// ── Location warning row ──────────────────────────────────────────────────────

function LocationWarning() {
  return (
    <View style={styles.locationWarn}>
      <Ionicons name="location-outline" size={14} color="#888888" />
      <Text style={styles.locationWarnText}>
        Enable location to find nearby services
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F0EDE8',
  },
  content: {
    paddingTop: Layout.STATUS_BAR_HEIGHT + 4,
    paddingHorizontal: 20,
    paddingBottom: Layout.CONTENT_BOTTOM_PADDING,
  },

  // ── Header ───────────────────────────────────────────────────
  header: {
    marginBottom: 22,
  },
  brandName: {
    fontSize: 50,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -1.5,
    lineHeight: 56,
  },

  // ── Section label ─────────────────────────────────────────────
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.4,
    marginBottom: 12,
  },

  // ── Nearest row ───────────────────────────────────────────────
  nearestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 12,
    gap: 14,
  },
  nearestLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.4,
  },

  // ── Quick contacts card ───────────────────────────────────────
  quickCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
    justifyContent: 'space-between',
  },
  quickLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  quickIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTexts: {
    flex: 1,
  },
  quickTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: -0.1,
  },
  quickSub: {
    fontSize: 10,
    color: '#888888',
    marginTop: 1,
  },

  // ── Mini chart ────────────────────────────────────────────────
  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 24,
  },
  miniBar: {
    width: 4,
    borderRadius: 2,
  },

  // ── POI card wrapper ──────────────────────────────────────────
  poiWrap: {
    marginBottom: 12,
  },

  // ── Empty state ───────────────────────────────────────────────
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#888888',
  },

  // ── Location warning ──────────────────────────────────────────
  locationWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  locationWarnText: {
    fontSize: 13,
    color: '#888888',
  },
});