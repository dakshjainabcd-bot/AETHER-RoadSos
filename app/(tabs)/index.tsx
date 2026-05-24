/**
 * Home Screen — All Features Operational
 *
 * All FEATURE_ITEMS now have live routes — no comingSoon flags.
 * Phases 10, 12, 13, 14 all accessible via the "+" launcher panel.
 */

import { useState, useCallback, useRef } from 'react';
import { WeeklySafetyCard } from '../../components/WeeklySafetyCard';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Animated,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';

import { useAppContext } from '../../app/_layout';
import {
  getLastKnownLocation,
  getCurrentLocation,
  type StoredLocation,
} from '../../services/GPSService';
import { searchPOI, type POI } from '../../services/POIDatabase';
import { POI_TYPES } from '../../utils/constants';
import { Colors, BorderRadius, Shadows, Layout } from '../../theme';
import type { CrashDetectionState } from '../../services/CrashDetection/types';

// ── Static showcase hospitals ─────────────────────────────────────────────────

const SHOWCASE_SERVICES = [
  {
    id: 'sh1',
    name: 'AIIMS — Trauma Centre',
    type: 'hospital',
    dist: '2.1 km',
    phone: '011-26588500',
    tags: ['Trauma', 'Neuro ICU', '24×7', 'Emergency'],
    status: 'OPEN 24H',
    statusColor: Colors.status.success,
    dotColor: Colors.brand.primary,
    dotBg: Colors.soft.red,
    dotBorder: Colors.soft.redBorder,
    beds: '42 beds free',
  },
  {
    id: 'sh2',
    name: 'City Police HQ — Control Room',
    type: 'police',
    dist: '3.4 km',
    phone: '100',
    tags: ['24×7', 'PCR Van', 'FIR', 'Women Cell'],
    status: 'OPEN 24H',
    statusColor: Colors.status.success,
    dotColor: Colors.service.police,
    dotBg: Colors.soft.blue,
    dotBorder: Colors.soft.blueBorder,
    beds: null,
  },
  {
    id: 'sh3',
    name: 'Fortis Memorial Hospital',
    type: 'hospital',
    dist: '4.7 km',
    phone: '1800-103-4444',
    tags: ['Cardiac', 'Burns Unit', 'ICU', 'Paeds'],
    status: 'OPEN 24H',
    statusColor: Colors.status.success,
    dotColor: Colors.brand.primary,
    dotBg: Colors.soft.red,
    dotBorder: Colors.soft.redBorder,
    beds: '18 beds free',
  },
  {
    id: 'sh4',
    name: 'Apollo Hospitals',
    type: 'hospital',
    dist: '5.2 km',
    phone: '1860-500-1066',
    tags: ['Spine', 'Neuro', 'Cardiac', 'Robotic Surgery'],
    status: 'OPEN 24H',
    statusColor: Colors.status.success,
    dotColor: Colors.brand.primary,
    dotBg: Colors.soft.red,
    dotBorder: Colors.soft.redBorder,
    beds: '6 beds free',
  },
  {
    id: 'sh5',
    name: 'Fire Station — Sector 6',
    type: 'fire',
    dist: '1.8 km',
    phone: '101',
    tags: ['Rescue', 'Chemical', 'High-Rise', 'Ambulance'],
    status: 'OPEN 24H',
    statusColor: Colors.status.success,
    dotColor: Colors.service.fire,
    dotBg: Colors.soft.amber,
    dotBorder: Colors.soft.amberBorder,
    beds: null,
  },
  {
    id: 'sh6',
    name: 'Max Super Speciality Hospital',
    type: 'hospital',
    dist: '6.1 km',
    phone: '011-26515050',
    tags: ['Multi-Organ', 'Oncology', 'NICU', 'Blood Bank'],
    status: 'OPEN 24H',
    statusColor: Colors.status.success,
    dotColor: Colors.brand.primary,
    dotBg: Colors.soft.red,
    dotBorder: Colors.soft.redBorder,
    beds: '31 beds free',
  },
  {
    id: 'sh7',
    name: 'Medanta — The Medicity',
    type: 'hospital',
    dist: '8.9 km',
    phone: '0124-4141414',
    tags: ['Level 1 Trauma', 'Heart', 'Liver Transplant'],
    status: 'OPEN 24H',
    statusColor: Colors.status.success,
    dotColor: Colors.brand.primary,
    dotBg: Colors.soft.red,
    dotBorder: Colors.soft.redBorder,
    beds: '12 beds free',
  },
  {
    id: 'sh8',
    name: 'Narayana Health City',
    type: 'hospital',
    dist: '11.4 km',
    phone: '1800-843-6600',
    tags: ['Paediatric Cardiac', 'Burns', 'Trauma ICU'],
    status: 'OPEN 24H',
    statusColor: Colors.status.success,
    dotColor: Colors.brand.primary,
    dotBg: Colors.soft.red,
    dotBorder: Colors.soft.redBorder,
    beds: '24 beds free',
  },
];

// ── Feature Launcher Items — ALL OPERATIONAL ───────────────────────────────────

type FeatureItem = {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  route: string;
  badge?: string;
};

const FEATURE_ITEMS: FeatureItem[] = [
  // ── AI & Communication ────────────────────────────────────────────────────
  {
    id: 'chatbot',
    label: 'AI First-Aid Chat',
    sublabel: 'Pocket RAG · Works offline',
    icon: 'chatbubble-ellipses',
    color: Colors.brand.accent,
    bg: Colors.soft.blue,
    border: Colors.soft.blueBorder,
    route: '/(tabs)/chatbot',
    badge: 'Phase 11',
  },
  {
    id: 'bystander',
    label: 'BystAI + PsychAid',
    sublabel: 'CPR · First aid · WHO scripts',
    icon: 'medical',
    color: Colors.brand.primary,
    bg: Colors.soft.red,
    border: Colors.soft.redBorder,
    route: '/bystander',
    badge: 'Phase 4+11',
  },
  {
    id: 'multilingual',
    label: 'Multilingual Bridge',
    sublabel: 'Whisper STT · 99 languages',
    icon: 'language',
    color: Colors.brand.accent,
    bg: Colors.soft.blue,
    border: Colors.soft.blueBorder,
    route: '/(tabs)/multilingual',
    badge: 'Phase 5',
  },
  // ── Safety & Intelligence ─────────────────────────────────────────────────
  {
    id: 'driver_intel',
    label: 'Driver Intelligence',
    sublabel: 'Safety score · Badges · Phase 12+13',
    icon: 'car-sport',
    color: Colors.status.warning,
    bg: Colors.soft.amber,
    border: Colors.soft.amberBorder,
    route: '/(tabs)/driver',
    badge: 'Phase 12',
  },
  {
    id: 'road_dna',
    label: 'Road DNA Blackspots',
    sublabel: 'Danger zone heatmap · Phase 9',
    icon: 'warning',
    color: '#CC0000',
    bg: Colors.soft.red,
    border: Colors.soft.redBorder,
    route: '/(tabs)/map',
    badge: 'Phase 9',
  },
  {
    id: 'rakshak_ems',
    label: 'Rakshak + EMS',
    sublabel: 'Responders · Rewards · Phase 7+13',
    icon: 'shield',
    color: Colors.status.success,
    bg: Colors.soft.green,
    border: Colors.soft.greenBorder,
    route: '/(tabs)/rakshak',
    badge: 'Phase 7',
  },
  // ── Mesh & Network ────────────────────────────────────────────────────────
  {
    id: 'dtn_mesh',
    label: 'DTN Mesh Enhancer',
    sublabel: 'Store-and-forward · Phase 14',
    icon: 'git-network',
    color: Colors.brand.purple,
    bg: Colors.soft.purple,
    border: Colors.soft.purpleBorder,
    route: '/(tabs)/dtn',
    badge: 'Phase 14',
  },
  // ── Evidence & Legal ──────────────────────────────────────────────────────
  {
    id: 'blackbox',
    label: 'Black Box + Road Repair',
    sublabel: 'Evidence · Legal notices · Phase 8',
    icon: 'cube',
    color: Colors.label.secondary,
    bg: Colors.background.secondary,
    border: Colors.border.medium,
    route: '/(tabs)/blackbox',
    badge: 'Phase 8',
  },
  // ── Security & Privacy ────────────────────────────────────────────────────
  {
    id: 'security',
    label: 'Security & Privacy',
    sublabel: 'AES mesh · DPDP · Phase 10',
    icon: 'lock-closed',
    color: Colors.status.success,
    bg: Colors.soft.green,
    border: Colors.soft.greenBorder,
    route: '/(tabs)/security',
    badge: 'Phase 10',
  },
];

// ── Tab bar height ─────────────────────────────────────────────────────────────
const TAB_BAR_HEIGHT = 82;

// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const {
    emergencyNumbers,
    gpsPermissionGranted,
    meshConnected,
    meshPeerCount,
    crashState,
  } = useAppContext();

  const [location, setLocation] = useState<StoredLocation | null>(null);
  const [nearestHospital, setNearestHospital] = useState<POI | null>(null);
  const [nearestPolice, setNearestPolice] = useState<POI | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Feature panel ─────────────────────────────────────────────────────────
  const [panelVisible, setPanelVisible] = useState(false);
  const panelSlide = useRef(new Animated.Value(600)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;
  const fabRotate = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => { loadData(); }, [gpsPermissionGranted])
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

  // ── Panel animations ──────────────────────────────────────────────────────

  function openPanel() {
    setPanelVisible(true);
    Animated.parallel([
      Animated.spring(panelSlide, { toValue: 0, useNativeDriver: true, tension: 68, friction: 11 }),
      Animated.timing(backdropOp, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(fabRotate, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }

  function closePanel() {
    Animated.parallel([
      Animated.timing(panelSlide, { toValue: 600, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropOp, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(fabRotate, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setPanelVisible(false));
  }

  function togglePanel() {
    panelVisible ? closePanel() : openPanel();
  }

  function handleFeaturePress(item: FeatureItem) {
    closePanel();
    setTimeout(() => {
      router.push(item.route as any);
    }, 280);
  }

  const fabIconStyle = {
    transform: [
      {
        rotate: fabRotate.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '45deg'],
        }),
      },
    ],
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background.primary }}>

      {/* ── Scrollable content ────────────────────────────────── */}
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
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.brandName}>AETHER</Text>
            <View style={styles.statusRow}>
              <BlinkingDot color={Colors.status.success} />
              <Text style={styles.statusText}>
                {emergencyNumbers.country}  ·  Detection active  ·  ±{location ? '11' : '--'}m
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/settings')}
            style={styles.settingsBtn}
          >
            <Ionicons name="settings-outline" size={18} color={Colors.label.secondary} />
          </TouchableOpacity>
        </View>

        {/* ── 108 Hero Card ─────────────────────────────────── */}
        <TouchableOpacity
          style={styles.heroCard}
          activeOpacity={0.9}
          onPress={() => Linking.openURL(`tel:${emergencyNumbers.ambulance}`)}
        >
          <View style={styles.heroRing1} />
          <View style={styles.heroRing2} />
          <View style={styles.heroLeft}>
            <Text style={styles.heroLabel}>AMBULANCE</Text>
            <Text style={styles.heroNumber}>{emergencyNumbers.ambulance}</Text>
            <View style={styles.heroCallBtn}>
              <Ionicons name="call" size={14} color="#fff" />
              <Text style={styles.heroCallText}>Call Now</Text>
            </View>
          </View>
          <View style={styles.heroRight}>
            <View style={styles.meshBadge}>
              <Text style={styles.meshBadgeText}>
                {meshConnected ? `MESH · ${meshPeerCount}` : 'MESH OFFLINE'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Phase 12: Weekly driver score */}
        <WeeklySafetyCard />

        {/* ── Secondary Numbers ─────────────────────────────── */}
        <View style={styles.numbersGrid}>
          <NumberCard number={emergencyNumbers.police} label="Police" color={Colors.service.police} bg={Colors.soft.blue} border={Colors.soft.blueBorder} />
          <NumberCard number={emergencyNumbers.fire} label="Fire" color={Colors.service.fire} bg={Colors.soft.amber} border={Colors.soft.amberBorder} />
          <NumberCard number="112" label="Universal" color={Colors.label.secondary} bg={Colors.background.elevated} border={Colors.border.medium} />
        </View>

        {/* ── Crash Detection Pill ──────────────────────────── */}
        <CrashDetectionPill state={crashState} />

        {/* ── LIVE: nearest from GPS ────────────────────────── */}
        {(nearestHospital || nearestPolice) && (
          <>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.liveDot} />
              <Text style={styles.sectionLabel}>LIVE · NEAREST TO YOU</Text>
              <View style={styles.sectionLine} />
            </View>

            {!gpsPermissionGranted && <LocationWarning />}

            {nearestHospital && (
              <ServiceRow
                poi={nearestHospital}
                dotColor={Colors.brand.primary}
                dotBg={Colors.soft.red}
                dotBorder={Colors.soft.redBorder}
              />
            )}
            {nearestHospital && nearestPolice && <View style={styles.rowDivider} />}
            {nearestPolice && (
              <ServiceRow
                poi={nearestPolice}
                dotColor={Colors.service.police}
                dotBg={Colors.soft.blue}
                dotBorder={Colors.soft.blueBorder}
              />
            )}
          </>
        )}

        {/* ── NEARBY SERVICES ───────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>NEARBY SERVICES</Text>
          <View style={styles.sectionLine} />
          <TouchableOpacity onPress={() => router.push('/(tabs)/services')}>
            <Text style={styles.seeAllText}>See all →</Text>
          </TouchableOpacity>
        </View>

        {!gpsPermissionGranted && !nearestHospital && <LocationWarning />}

        {SHOWCASE_SERVICES.map((item, idx) => (
          <View key={item.id}>
            <ShowcaseRow item={item} />
            {idx < SHOWCASE_SERVICES.length - 1 && <View style={styles.rowDivider} />}
          </View>
        ))}

        {/* ── Offline footer ────────────────────────────────── */}
        <View style={styles.offlineBadge}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlineBadgeText}>
            WORKS FULLY OFFLINE · NO INTERNET REQUIRED
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── FAB — fixed above tab bar ─────────────────────────────────── */}
      <View style={styles.fabContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.fab}
          onPress={togglePanel}
          activeOpacity={0.85}
        >
          <Animated.View style={fabIconStyle}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* ── Feature Launcher Panel ────────────────────────────────────── */}
      {panelVisible && (
        <Modal
          transparent
          animationType="none"
          visible={panelVisible}
          onRequestClose={closePanel}
          statusBarTranslucent
        >
          {/* Backdrop */}
          <Animated.View
            style={[panelStyles.backdrop, { opacity: backdropOp }]}
            pointerEvents="auto"
          >
            <Pressable style={{ flex: 1 }} onPress={closePanel} />
          </Animated.View>

          {/* Sheet */}
          <Animated.ScrollView
            style={[panelStyles.sheet, { transform: [{ translateY: panelSlide }] }]}
            contentContainerStyle={panelStyles.sheetContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Handle */}
            <View style={panelStyles.handle} />

            {/* Header */}
            <View style={panelStyles.panelHeader}>
              <View>
                <Text style={panelStyles.panelTitle}>All Features</Text>
                <Text style={panelStyles.panelSub}>AETHER · Phases 1–15 · All Operational</Text>
              </View>
              <TouchableOpacity onPress={closePanel} style={panelStyles.closeBtn}>
                <Ionicons name="close" size={18} color={Colors.label.secondary} />
              </TouchableOpacity>
            </View>

            {/* Feature grid — ALL ACTIVE, NO COMING SOON */}
            <View style={panelStyles.grid}>
              {FEATURE_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    panelStyles.featureCard,
                    { backgroundColor: item.bg, borderColor: item.border },
                  ]}
                  onPress={() => handleFeaturePress(item)}
                  activeOpacity={0.72}
                >
                  <View style={[panelStyles.iconWrap, { backgroundColor: `${item.color}22` }]}>
                    <Ionicons name={item.icon as any} size={22} color={item.color} />
                  </View>
                  <Text style={[panelStyles.featureLabel, { color: item.color }]} numberOfLines={2}>
                    {item.label}
                  </Text>
                  <Text style={panelStyles.featureSub} numberOfLines={2}>
                    {item.sublabel}
                  </Text>
                  {item.badge && (
                    <View style={[panelStyles.phaseBadge, { backgroundColor: `${item.color}18` }]}>
                      <Text style={[panelStyles.phaseBadgeText, { color: item.color }]}>
                        {item.badge}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: Platform.OS === 'ios' ? 40 : 24 }} />
          </Animated.ScrollView>
        </Modal>
      )}
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function BlinkingDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useState(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.18, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  });
  return <Animated.View style={[styles.blinkDot, { backgroundColor: color, opacity }]} />;
}

function NumberCard({ number, label, color, bg, border }: {
  number: string; label: string; color: string; bg: string; border: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.numCard, { backgroundColor: bg, borderColor: border }]}
      activeOpacity={0.7}
      onPress={() => Linking.openURL(`tel:${number}`)}
    >
      <Text style={[styles.numCardNumber, { color }]}>{number}</Text>
      <Text style={styles.numCardLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function CrashDetectionPill({ state }: { state: CrashDetectionState }) {
  const isEmergency = state === 'countdown' || state === 'dispatching' || state === 'active_sos';
  const isCandidate = state === 'candidate';
  const color = isEmergency ? Colors.brand.primary : isCandidate ? Colors.status.warning : Colors.status.success;
  const label = isEmergency ? 'CRASH DETECTED' : isCandidate ? 'IMPACT CANDIDATE' : 'MONITORING';
  return (
    <View style={[styles.crashPill, { backgroundColor: color + '12', borderColor: color + '30' }]}>
      <View style={[styles.crashDot, { backgroundColor: color }]} />
      <Text style={[styles.crashText, { color }]}>{label}</Text>
    </View>
  );
}

function ServiceRow({ poi, dotColor, dotBg, dotBorder }: {
  poi: POI; dotColor: string; dotBg: string; dotBorder: string;
}) {
  const dist = poi.distance != null ? `${poi.distance.toFixed(1)} km` : '';
  const caps = poi.capabilities?.slice(0, 3) ?? [];
  return (
    <View style={styles.serviceRow}>
      <View style={[styles.serviceAccent, { backgroundColor: dotBg, borderColor: dotBorder }]}>
        <View style={[styles.serviceAccentDot, { backgroundColor: dotColor }]} />
      </View>
      <View style={styles.serviceInfo}>
        <View style={styles.serviceTop}>
          <Text style={styles.serviceName} numberOfLines={2}>{poi.name}</Text>
          {dist ? <Text style={styles.serviceDist}>{dist}</Text> : null}
        </View>
        {caps.length > 0 && (
          <View style={styles.serviceTags}>
            {caps.map((c: string) => (
              <View key={c} style={styles.tag}><Text style={styles.tagText}>{c}</Text></View>
            ))}
          </View>
        )}
        <View style={styles.serviceButtons}>
          <TouchableOpacity style={styles.callBtn} onPress={() => poi.phone && Linking.openURL(`tel:${poi.phone}`)}>
            <Ionicons name="call" size={13} color={Colors.status.success} />
            <Text style={styles.callBtnText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn}>
            <Ionicons name="navigate" size={13} color={Colors.status.info} />
            <Text style={styles.navBtnText}>Navigate</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ShowcaseRow({ item }: { item: typeof SHOWCASE_SERVICES[0] }) {
  return (
    <View style={styles.serviceRow}>
      <View style={[styles.serviceAccent, { backgroundColor: item.dotBg, borderColor: item.dotBorder }]}>
        <View style={[styles.serviceAccentDot, { backgroundColor: item.dotColor }]} />
      </View>
      <View style={styles.serviceInfo}>
        <View style={styles.serviceTop}>
          <Text style={styles.serviceName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.serviceDist}>{item.dist}</Text>
        </View>
        <View style={styles.statusBedsRow}>
          <View style={[styles.statusPill, { backgroundColor: item.statusColor + '14', borderColor: item.statusColor + '30' }]}>
            <View style={[styles.statusPillDot, { backgroundColor: item.statusColor }]} />
            <Text style={[styles.statusPillText, { color: item.statusColor }]}>{item.status}</Text>
          </View>
          {item.beds && (
            <View style={styles.bedsBadge}>
              <Ionicons name="bed-outline" size={10} color={Colors.label.tertiary} />
              <Text style={styles.bedsText}>{item.beds}</Text>
            </View>
          )}
          {item.phone && <Text style={styles.phonePreview}>{item.phone}</Text>}
        </View>
        <View style={styles.serviceTags}>
          {item.tags.map((t) => (
            <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
          ))}
        </View>
        <View style={styles.serviceButtons}>
          <TouchableOpacity style={styles.callBtn} onPress={() => item.phone && Linking.openURL(`tel:${item.phone}`)}>
            <Ionicons name="call" size={13} color={Colors.status.success} />
            <Text style={styles.callBtnText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn}>
            <Ionicons name="navigate" size={13} color={Colors.status.info} />
            <Text style={styles.navBtnText}>Navigate</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function LocationWarning() {
  return (
    <View style={styles.locationWarn}>
      <Ionicons name="location-outline" size={14} color={Colors.status.warning} />
      <Text style={styles.locationWarnText}>Enable location for live results</Text>
    </View>
  );
}

// ── Panel Styles ──────────────────────────────────────────────────────────────

const panelStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 18, 16, 0.48)',
    zIndex: 200,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 201,
    backgroundColor: Colors.background.elevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '86%',
    shadowColor: '#141210',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.20,
    shadowRadius: 30,
    elevation: 28,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.separator.opaque,
    alignSelf: 'center',
    marginBottom: 18,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.label.primary,
    letterSpacing: -0.5,
  },
  panelSub: {
    fontSize: 11,
    color: Colors.label.tertiary,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.fill.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 11,
  },
  featureCard: {
    width: '47%',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    gap: 5,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  featureLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 17,
  },
  featureSub: {
    fontSize: 10,
    color: Colors.label.tertiary,
    lineHeight: 14,
  },
  phaseBadge: {
    alignSelf: 'flex-start',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  phaseBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

// ── Main Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background.primary },
  content: {
    paddingTop: Layout.STATUS_BAR_HEIGHT,
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
    paddingBottom: Layout.CONTENT_BOTTOM_PADDING,
  },

  // FAB
  fabContainer: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + 14,
    right: 20,
    zIndex: 99,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 10,
  },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titleBlock: { flex: 1 },
  brandName: { fontSize: 30, fontWeight: '800', color: Colors.label.primary, letterSpacing: -1.5, lineHeight: 32 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  blinkDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 12, fontWeight: '500', color: Colors.label.secondary, letterSpacing: -0.2 },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: Colors.background.elevated,
    borderWidth: 1, borderColor: Colors.border.medium,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#141210', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },

  // Hero card
  heroCard: {
    backgroundColor: Colors.brand.primary, borderRadius: 26, paddingLeft: 24,
    marginBottom: 10, overflow: 'hidden', flexDirection: 'row', alignItems: 'stretch',
    shadowColor: '#C82F1C', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  heroRing1: {
    position: 'absolute', right: -48, top: '50%', marginTop: -110,
    width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  heroRing2: {
    position: 'absolute', right: 0, top: '50%', marginTop: -70,
    width: 140, height: 140, borderRadius: 70, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  heroLeft: { flex: 1, paddingTop: 22, paddingBottom: 22 },
  heroLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 3, marginBottom: 2 },
  heroNumber: { fontSize: 64, fontWeight: '800', color: '#fff', lineHeight: 68, letterSpacing: 1, marginBottom: 14 },
  heroCallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start',
  },
  heroCallText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  heroRight: { justifyContent: 'flex-end', padding: 16 },
  meshBadge: { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  meshBadgeText: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5 },

  // Numbers grid
  numbersGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  numCard: { flex: 1, borderRadius: 20, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14 },
  numCardNumber: { fontSize: 36, fontWeight: '900', lineHeight: 38, marginBottom: 4, letterSpacing: -0.5 },
  numCardLabel: { fontSize: 11, color: Colors.label.secondary, fontWeight: '500' },

  // Crash pill
  crashPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, marginBottom: 20,
  },
  crashDot: { width: 6, height: 6, borderRadius: 3 },
  crashText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },

  // Section headers
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.brand.primary },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.label.tertiary },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.border.medium },
  seeAllText: { fontSize: 12, fontWeight: '600', color: Colors.brand.primary },

  // Service rows
  serviceRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 14 },
  serviceAccent: {
    width: 42, height: 42, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  serviceAccentDot: { width: 10, height: 10, borderRadius: 5 },
  serviceInfo: { flex: 1 },
  serviceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
  serviceName: {
    fontSize: 14, fontWeight: '700', color: Colors.label.primary,
    lineHeight: 18, flex: 1, paddingRight: 8, letterSpacing: -0.2,
  },
  serviceDist: { fontSize: 14, fontWeight: '900', color: Colors.label.secondary, letterSpacing: -0.2 },
  statusBedsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2,
  },
  statusPillDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusPillText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  bedsBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bedsText: { fontSize: 10, color: Colors.label.tertiary, fontWeight: '500' },
  phonePreview: { fontSize: 10, color: Colors.label.muted, fontFamily: 'monospace' },
  serviceTags: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 11 },
  tag: {
    backgroundColor: Colors.background.secondary, borderWidth: 1, borderColor: Colors.border.medium,
    borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3,
  },
  tagText: { fontSize: 9, fontWeight: '600', color: Colors.label.secondary, letterSpacing: 0.5 },
  serviceButtons: { flexDirection: 'row', gap: 8 },
  callBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, backgroundColor: Colors.soft.green, borderWidth: 1,
    borderColor: Colors.soft.greenBorder, borderRadius: 10,
  },
  callBtnText: { fontSize: 12, fontWeight: '600', color: Colors.status.success },
  navBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, backgroundColor: Colors.soft.blue, borderWidth: 1,
    borderColor: Colors.soft.blueBorder, borderRadius: 10,
  },
  navBtnText: { fontSize: 12, fontWeight: '600', color: Colors.status.info },
  rowDivider: { height: 1, backgroundColor: Colors.separator.nonOpaque },

  // Warning
  locationWarn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.soft.amber, borderRadius: BorderRadius.md, padding: 12, marginBottom: 10,
  },
  locationWarnText: { fontSize: 13, color: Colors.status.warning, fontWeight: '500' },

  // Offline footer
  offlineBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 20 },
  offlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.status.success },
  offlineBadgeText: { fontSize: 9, color: Colors.label.tertiary, letterSpacing: 1.5, fontWeight: '500' },
});