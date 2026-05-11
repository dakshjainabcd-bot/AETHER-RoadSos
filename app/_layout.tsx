/**
 * Root Layout — Phase 4 Integration
 *
 * Phase 2: MeshRelay events, BystanderAlert
 * Phase 3: CrashDetectionEngine, CrashCountdown modal
 * Phase 4 additions:
 *  - bystAIVisible + bystAIPacket state
 *  - BystAIModal mounted here at ROOT (same pattern as CrashCountdown)
 *    so it sits above the tab navigator and never gets clipped
 *  - openBystAI / closeBystAI exposed via AppContext
 *  - BystanderAlert receives onHelpPress → openBystAI
 */

import { useEffect, useState, useRef, createContext, useContext } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { initializeMCCService, type EmergencyNumbers } from '../services/MCCService';
import { initializeDatabase } from '../services/POIDatabase';
import { requestLocationPermissions, startBackgroundTracking } from '../services/GPSService';
import { meshRelayManager } from '../services/MeshRelay/MeshRelayManager';
import { SOSPacket } from '../services/MeshRelay/types';
import { crashDetectionEngine } from '../services/CrashDetection/CrashDetectionEngine';
import type { CrashDetectionState } from '../services/CrashDetection/types';
import { CrashCountdown } from '../components/CrashCountdown';
import { BystanderAlert } from '../components/BystanderAlert';
import { BystAIModal } from '../components/BystAIModal';       // ← Phase 4
import { STORAGE_KEYS, DEFAULT_EMERGENCY, type LanguageCode } from '../utils/constants';
import { Colors } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL APP CONTEXT — Phase 4 extended
// ─────────────────────────────────────────────────────────────────────────────

interface AppContextType {
  emergencyNumbers: EmergencyNumbers;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  isInitialized: boolean;
  gpsPermissionGranted: boolean;
  activeBystanderAlert: { packet: SOSPacket; distanceM: number } | null;
  clearBystanderAlert: () => void;
  meshConnected: boolean;
  meshPeerCount: number;
  // Phase 3
  crashState: CrashDetectionState;
  crashConfidence: number;
  // Phase 4 — BystAI
  openBystAI: (packet: SOSPacket) => void;
  closeBystAI: () => void;
}

const AppContext = createContext<AppContextType>({
  emergencyNumbers: {
    ...DEFAULT_EMERGENCY,
    country: 'Unknown',
    country_code: 'XX',
    languages: ['en'],
  },
  language: 'en',
  setLanguage: async () => {},
  isInitialized: false,
  gpsPermissionGranted: false,
  activeBystanderAlert: null,
  clearBystanderAlert: () => {},
  meshConnected: false,
  meshPeerCount: 0,
  crashState: 'idle',
  crashConfidence: 0,
  openBystAI: () => {},
  closeBystAI: () => {},
});

export function useAppContext(): AppContextType {
  return useContext(AppContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT LAYOUT
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [isInitialized, setIsInitialized]      = useState(false);
  const [emergencyNumbers, setEmergencyNumbers] = useState<EmergencyNumbers>({
    ...DEFAULT_EMERGENCY,
    country: 'Detecting…',
    country_code: 'XX',
    languages: ['en'],
  });
  const [language, setLanguageState]            = useState<LanguageCode>('en');
  const [gpsPermissionGranted, setGpsGranted]   = useState(false);
  const [activeBystanderAlert, setAlert]        = useState<{
    packet: SOSPacket;
    distanceM: number;
  } | null>(null);
  const [meshConnected, setMeshConnected]       = useState(false);
  const [meshPeerCount, setMeshPeerCount]       = useState(0);

  // Phase 3 crash state
  const [crashState, setCrashState]             = useState<CrashDetectionState>('idle');
  const [crashConfidence, setCrashConfidence]   = useState(0);
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Phase 4: BystAI state ─────────────────────────────────────────────────
  const [bystAIVisible, setBystAIVisible]       = useState(false);
  const [bystAIPacket, setBystAIPacket]         = useState<SOSPacket | null>(null);

  const openBystAI = (packet: SOSPacket) => {
    setBystAIPacket(packet);
    setBystAIVisible(true);
  };

  const closeBystAI = () => {
    setBystAIVisible(false);
    // Keep the packet for a tick so the modal can animate out gracefully
    setTimeout(() => setBystAIPacket(null), 400);
  };

  // ── Mesh relay event subscriptions ───────────────────────────────────────
  useEffect(() => {
    const unsubSOS = meshRelayManager.on('SOS_RECEIVED', (event) => {
      if (event.packet && event.data) {
        const isNearby  = event.data['isNearby'] as boolean;
        const distanceM = (event.data['distanceM'] as number) ?? 0;
        if (isNearby) setAlert({ packet: event.packet, distanceM });
      }
    });
    const unsubOn  = meshRelayManager.on('SIMULATION_CONNECTED', (e) => {
      setMeshConnected(true);
      setMeshPeerCount((e.data?.['deviceCount'] as number) ?? 0);
    });
    const unsubOff = meshRelayManager.on('SIMULATION_DISCONNECTED', () => {
      setMeshConnected(false);
      setMeshPeerCount(0);
    });
    return () => { unsubSOS(); unsubOn(); unsubOff(); };
  }, []);

  // ── Phase 3: Crash detection event subscriptions ─────────────────────────
  useEffect(() => {
    const unsubConfirmed = crashDetectionEngine.on('CRASH_CONFIRMED', () => {
      setSecondsRemaining(5);
      setCountdownVisible(true);
      startCountdownTimer();
    });

    const unsubState = crashDetectionEngine.on('STATE_CHANGED', (event) => {
      if (event.state) setCrashState(event.state);
    });

    const unsubScore = crashDetectionEngine.on('SCORE_UPDATED', (event) => {
      if (event.score) setCrashConfidence(event.score.confidence);
    });

    const unsubCancelled = crashDetectionEngine.on('CRASH_CANCELLED', () => {
      stopCountdownTimer();
      setCountdownVisible(false);
      setSecondsRemaining(5);
    });

    const unsubDispatched = crashDetectionEngine.on('SOS_DISPATCHED', () => {
      stopCountdownTimer();
      setCountdownVisible(false);
      setSecondsRemaining(5);
    });

    return () => {
      unsubConfirmed();
      unsubState();
      unsubScore();
      unsubCancelled();
      unsubDispatched();
    };
  }, []);

  function startCountdownTimer() {
    stopCountdownTimer();
    let secs = 5;
    countdownIntervalRef.current = setInterval(() => {
      secs -= 1;
      setSecondsRemaining(secs);
      if (secs <= 0) stopCountdownTimer();
    }, 1000);
  }

  function stopCountdownTimer() {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }

  // ── App initialization ────────────────────────────────────────────────────
  useEffect(() => { initializeApp(); }, []);

  async function initializeApp() {
    try {
      const savedLang = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
      if (savedLang) setLanguageState(savedLang as LanguageCode);

      await initializeDatabase();
      const numbers = await initializeMCCService();
      setEmergencyNumbers(numbers);

      const gpsGranted = await requestLocationPermissions();
      setGpsGranted(gpsGranted);
      if (gpsGranted) await startBackgroundTracking();

      await meshRelayManager.initialize();

      crashDetectionEngine.initialize();

      setIsInitialized(true);
    } catch (error) {
      console.error('[App] Init failed:', error);
      setIsInitialized(true);
    }
  }

  async function setLanguage(lang: LanguageCode) {
    setLanguageState(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  }

  // ── Loading screen ────────────────────────────────────────────────────────
  if (!isInitialized) {
    return (
      <View style={styles.loading}>
        <StatusBar style="dark" />
        <View style={styles.loadingInner}>
          <Text style={styles.loadingBrand}>AETHER</Text>
          <Text style={styles.loadingSub}>Accident Emergency & Trauma Hyper-Response</Text>
          <ActivityIndicator size="large" color={Colors.brand.primary} style={styles.spinner} />
          <Text style={styles.loadingStatus}>Initialising systems…</Text>
        </View>
      </View>
    );
  }

  return (
    <AppContext.Provider
      value={{
        emergencyNumbers,
        language,
        setLanguage,
        isInitialized,
        gpsPermissionGranted,
        activeBystanderAlert,
        clearBystanderAlert: () => setAlert(null),
        meshConnected,
        meshPeerCount,
        crashState,
        crashConfidence,
        openBystAI,
        closeBystAI,
      }}
    >
      <StatusBar style="dark" />

      {/* ── Phase 3: CrashCountdown — overlays everything ───────────────── */}
      <CrashCountdown
        visible={countdownVisible}
        secondsRemaining={secondsRemaining}
        totalSeconds={5}
        confidence={crashConfidence}
        onCancel={() => crashDetectionEngine.cancelSOS()}
        onCountdownComplete={() => crashDetectionEngine.dispatchSOS()}
      />

      {/* ── Phase 4: BystAI modal — mounted at root, above tab nav ─────── */}
      {/*
        Mounted HERE (not inside a tab screen) for two reasons:
        1. It must overlay the entire app including the floating tab bar
        2. It receives state from AppContext and can be opened from anywhere
           (BystanderAlert, future SOS screen, etc.)
      */}
      <BystAIModal
        visible={bystAIVisible}
        packet={bystAIPacket}
        emergencyAmbulanceNumber={emergencyNumbers.ambulance}
        onClose={closeBystAI}
      />

      {/*
        ── Phase 4: BystanderAlert — also at root ──────────────────────────
        Moved from inside index.tsx to here so it shares the same stacking
        context as BystAIModal. onHelpPress opens BystAI with the packet.
      */}
      <BystanderAlert
        packet={activeBystanderAlert?.packet ?? null}
        distanceM={activeBystanderAlert?.distanceM ?? 0}
        emergencyAmbulanceNumber={emergencyNumbers.ambulance}
        onDismiss={() => setAlert(null)}
        onHelpPress={() => {
          if (activeBystanderAlert?.packet) {
            openBystAI(activeBystanderAlert.packet);
          }
        }}
      />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingInner: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 40,
  },
  loadingBrand: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.brand.primary,
    letterSpacing: -1.5,
    marginBottom: 4,
  },
  loadingSub: {
    fontSize: 13,
    color: Colors.label.secondary,
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: -0.1,
    marginBottom: 32,
  },
  spinner: { marginBottom: 12 },
  loadingStatus: {
    fontSize: 13,
    color: Colors.label.tertiary,
  },
});