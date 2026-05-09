/**
 * Root Layout — Phase 3 Integration
 *
 * All Phase 2 logic preserved.
 * Phase 3 additions:
 *  - crashDetectionEngine initialized after mesh relay
 *  - CrashCountdown modal rendered at root (always mounted, shown via `visible`)
 *  - crashState + crashConfidence exposed via AppContext
 *  - Countdown timer managed here; cancel/dispatch delegated to engine
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
import { STORAGE_KEYS, DEFAULT_EMERGENCY, type LanguageCode } from '../utils/constants';
import { Colors } from '../theme';

// ─────────────────────────────────────────────────────────────
// GLOBAL APP CONTEXT — Phase 3 extended
// ─────────────────────────────────────────────────────────────

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
  // ── Phase 3 ──────────────────────────────────────────────
  crashState: CrashDetectionState;
  crashConfidence: number;
}

const AppContext = createContext<AppContextType>({
  emergencyNumbers: { ...DEFAULT_EMERGENCY, country: 'Unknown', country_code: 'XX', languages: ['en'] },
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
});

export function useAppContext(): AppContextType {
  return useContext(AppContext);
}

// ─────────────────────────────────────────────────────────────
// ROOT LAYOUT
// ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [isInitialized, setIsInitialized]       = useState(false);
  const [emergencyNumbers, setEmergencyNumbers]  = useState<EmergencyNumbers>({
    ...DEFAULT_EMERGENCY,
    country: 'Detecting…',
    country_code: 'XX',
    languages: ['en'],
  });
  const [language, setLanguageState]             = useState<LanguageCode>('en');
  const [gpsPermissionGranted, setGpsGranted]    = useState(false);
  const [activeBystanderAlert, setAlert]         = useState<{ packet: SOSPacket; distanceM: number } | null>(null);
  const [meshConnected, setMeshConnected]        = useState(false);
  const [meshPeerCount, setMeshPeerCount]        = useState(0);

  // ── Phase 3 crash detection state ────────────────────────
  const [crashState, setCrashState]              = useState<CrashDetectionState>('idle');
  const [crashConfidence, setCrashConfidence]    = useState(0);
  const [countdownVisible, setCountdownVisible]  = useState(false);
  const [secondsRemaining, setSecondsRemaining]  = useState(5);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Mesh relay event subscriptions ───────────────────────
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

  // ── Phase 3: Crash detection event subscriptions ─────────
  useEffect(() => {
    const unsubConfirmed = crashDetectionEngine.on('CRASH_CONFIRMED', () => {
      // Start the 5-second countdown
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
    stopCountdownTimer(); // Guard against double-start
    let secs = 5;
    countdownIntervalRef.current = setInterval(() => {
      secs -= 1;
      setSecondsRemaining(secs);
      if (secs <= 0) {
        stopCountdownTimer();
      }
    }, 1000);
  }

  function stopCountdownTimer() {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }

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

      // ── Phase 3: Initialize crash detection AFTER mesh relay ──
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

  // ── Loading screen ─────────────────────────────────────────
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
      }}
    >
      <StatusBar style="dark" />

      {/* ── Phase 3: Crash Countdown — mounted at root so it overlays everything ── */}
      <CrashCountdown
        visible={countdownVisible}
        secondsRemaining={secondsRemaining}
        totalSeconds={5}
        confidence={crashConfidence}
        onCancel={() => crashDetectionEngine.cancelSOS()}
        onCountdownComplete={() => crashDetectionEngine.dispatchSOS()}
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