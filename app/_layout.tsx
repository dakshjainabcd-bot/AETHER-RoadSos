/**
 * Root Layout — Phase 6 Integration
 *
 * Phase 1: MCC, GPS, SQLite
 * Phase 2: Mesh Relay
 * Phase 3: Crash Detection
 * Phase 6: Hospital Pre-Alert (HPP) — NEW
 *   - injuryType state
 *   - setInjuryType() calls TraumaMatch + HospitalPreAlert
 *   - preAlertState exposed via context
 */

import { getBlackBoxManager } from '@/services/BlackBox';
import { useEffect, useState, useRef, createContext, useContext } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { initializeMCCService, type EmergencyNumbers } from '../services/MCCService';
import { initializeDatabase } from '../services/POIDatabase';
import { requestLocationPermissions, startBackgroundTracking, getLastKnownLocation } from '../services/GPSService';
import { meshRelayManager } from '../services/MeshRelay/MeshRelayManager';
import { SOSPacket } from '../services/MeshRelay/types';
import { crashDetectionEngine } from '../services/CrashDetection/CrashDetectionEngine';
import { multilingualBridge } from '../services/MultilingualBridge';
import type { CrashDetectionState } from '../services/CrashDetection/types';
import { CrashCountdown } from '../components/CrashCountdown';
import { STORAGE_KEYS, DEFAULT_EMERGENCY, type LanguageCode } from '../utils/constants';
import { Colors } from '../theme';

// ── Phase 6 imports ───────────────────────────────────────────────────────────
import { hospitalPreAlert, type PreAlertState } from '../services/HospitalPreAlert';
import { matchHospital, type InjuryType } from '../services/TraumaMatch';

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL APP CONTEXT — Phase 6 extended
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
  // Phase 6 — NEW
  injuryType: InjuryType | null;
  setInjuryType: (type: InjuryType) => Promise<void>;
  preAlertState: PreAlertState;
  clearPreAlert: () => void;
}

const DEFAULT_PREALERT_STATE: PreAlertState = {
  status: 'idle',
  hospitalName: '',
  hospitalPhone: '',
  distanceText: '',
  etaMinutes: 0,
  injuryType: '',
  sentAt: null,
  acknowledgedAt: null,
  incidentId: '',
};

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
  injuryType: null,
  setInjuryType: async () => {},
  preAlertState: DEFAULT_PREALERT_STATE,
  clearPreAlert: () => {},
});

export function useAppContext(): AppContextType {
  return useContext(AppContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT LAYOUT
// ─────────────────────────────────────────────────────────────────────────────

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

  // Phase 3
  const [crashState, setCrashState]              = useState<CrashDetectionState>('idle');
  const [crashConfidence, setCrashConfidence]    = useState(0);
  const [countdownVisible, setCountdownVisible]  = useState(false);
  const [secondsRemaining, setSecondsRemaining]  = useState(5);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phase 6 — NEW
  const [injuryType, setInjuryTypeState]         = useState<InjuryType | null>(null);
  const [preAlertState, setPreAlertState]        = useState<PreAlertState>(
    hospitalPreAlert.getState()
  );

  // ── Mesh relay event subscriptions ───────────────────────────────────
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

  // ── Phase 3: Crash detection event subscriptions ─────────────────────
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

  // ── Phase 6: Subscribe to HospitalPreAlert state changes ─────────────
  useEffect(() => {
    const unsub = hospitalPreAlert.subscribe((state) => {
      setPreAlertState({ ...state });
    });
    return () => unsub();
  }, []);

  function startCountdownTimer() {
    stopCountdownTimer();
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
      crashDetectionEngine.initialize();

      setIsInitialized(true);
    } catch (error) {
      console.error('[App] Init failed:', error);
      setIsInitialized(true);
    }
  }

  // ── Phase 7: Initialize Black Box system (separate useEffect) ──
  // TEMPORARILY DISABLED for debugging - will enable after testing core app
  /*
  useEffect(() => {
    if (!isInitialized) return;
    
    const initBlackBox = async () => {
      try {
        console.log('[App] Initializing Black Box...');
        const blackBox = getBlackBoxManager();
        console.log('[App] BlackBox manager retrieved');
        
        await blackBox.initialize();
        console.log('[App] Black Box initialized');

        // Start recording automatically
        await blackBox.startRecording();
        console.log('[App] Black Box recording started');
      } catch (error) {
        console.error('[App] Black Box initialization failed:', error);
        console.error('[App] Stack:', (error as any).stack);
      }
    };

    initBlackBox();
  }, [isInitialized]);
  */

  async function setLanguage(lang: LanguageCode) {
    setLanguageState(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  }

  // ── Phase 6: setInjuryType ────────────────────────────────────────────
  // Called when bystander taps an injury chip.
  // Runs TraumaMatch → finds hospital → sends pre-alert.
  async function setInjuryType(type: InjuryType) {
    setInjuryTypeState(type);

    // Get crash GPS
    const loc = await getLastKnownLocation();
    if (!loc) {
      console.warn('[HPP] No GPS available for hospital match — using demo coords');
      // Demo fallback: use Chennai coords so the registry always returns results
      const demoLat = 13.0585;
      const demoLng = 80.2596;
      const result = matchHospital(demoLat, demoLng, type);
      const incidentId = `hpptest_${Date.now()}`;
      await hospitalPreAlert.sendPreAlert(result, incidentId, 3);
      return;
    }

    const result = matchHospital(loc.lat, loc.lng, type);
    const incidentId = `hpptest_${Date.now()}`;
    await hospitalPreAlert.sendPreAlert(result, incidentId, 3);
  }

  // ── Phase 6: clearPreAlert ─────────────────────────────────────────────
  // Resets injury selector and pre-alert state.
  function clearPreAlert() {
    setInjuryTypeState(null);
    hospitalPreAlert.reset();
    setPreAlertState(hospitalPreAlert.getState());
  }

  // ── Loading screen ─────────────────────────────────────────────────────
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
        // Phase 6
        injuryType,
        setInjuryType,
        preAlertState,
        clearPreAlert,
      }}
    >
      <StatusBar style="dark" />

      {/* Phase 3: Crash Countdown — mounted at root so it overlays everything */}
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