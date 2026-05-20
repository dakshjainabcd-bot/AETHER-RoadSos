/**
 * Root Layout — PostSOSVoice integrated
 *
 * Change from previous version:
 * When crashState transitions to 'active_sos', we automatically start
 * postSOSVoice.start() — the mic is already free at this point because
 * CrashDetectionEngine called acousticDetector.setEnabled(false) in dispatchSOS().
 *
 * The voice result flows back via AppContext:
 *   postSOSVoice.onInjuryDetected → setInjuryType() → TraumaMatch → HospitalPreAlert
 *
 * Everything else is identical to the previous _layout.tsx.
 */

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
import type { CrashDetectionState } from '../services/CrashDetection/types';
import { CrashCountdown } from '../components/CrashCountdown';
import { STORAGE_KEYS, DEFAULT_EMERGENCY, type LanguageCode } from '../utils/constants';
import { Colors } from '../theme';

// Phase 6
import { hospitalPreAlert, type PreAlertState } from '../services/HospitalPreAlert';
import { matchHospital, type InjuryType } from '../services/TraumaMatch';

// PostSOSVoice — NEW
import { postSOSVoice } from '../services/PostSOSVoice';

// ─── App Context ──────────────────────────────────────────────────────────────

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
  crashState: CrashDetectionState;
  crashConfidence: number;
  injuryType: InjuryType | null;
  setInjuryType: (type: InjuryType) => Promise<void>;
  preAlertState: PreAlertState;
  clearPreAlert: () => void;
}

const DEFAULT_PREALERT_STATE: PreAlertState = {
  status: 'idle', hospitalName: '', hospitalPhone: '',
  distanceText: '', etaMinutes: 0, injuryType: '',
  sentAt: null, acknowledgedAt: null, incidentId: '',
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

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [isInitialized, setIsInitialized]      = useState(false);
  const [emergencyNumbers, setEmergencyNumbers] = useState<EmergencyNumbers>({
    ...DEFAULT_EMERGENCY, country: 'Detecting…', country_code: 'XX', languages: ['en'],
  });
  const [language, setLanguageState]            = useState<LanguageCode>('en');
  const [gpsPermissionGranted, setGpsGranted]   = useState(false);
  const [activeBystanderAlert, setAlert]        = useState<{ packet: SOSPacket; distanceM: number } | null>(null);
  const [meshConnected, setMeshConnected]       = useState(false);
  const [meshPeerCount, setMeshPeerCount]       = useState(0);
  const [crashState, setCrashState]             = useState<CrashDetectionState>('idle');
  const [crashConfidence, setCrashConfidence]   = useState(0);
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [injuryType, setInjuryTypeState]        = useState<InjuryType | null>(null);
  const [preAlertState, setPreAlertState]       = useState<PreAlertState>(hospitalPreAlert.getState());

  // Track the active SOS incident ID for PostSOSVoice
  const activeIncidentIdRef = useRef<string>('');

  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Mesh relay subscriptions ──────────────────────────────────────────────
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

  // ── Crash detection subscriptions ─────────────────────────────────────────
  useEffect(() => {
    const unsubConfirmed = crashDetectionEngine.on('CRASH_CONFIRMED', () => {
      setSecondsRemaining(5);
      setCountdownVisible(true);
      startCountdownTimer();
    });

    const unsubState = crashDetectionEngine.on('STATE_CHANGED', (event) => {
      if (event.state) {
        setCrashState(event.state);
      }
    });

    const unsubScore = crashDetectionEngine.on('SCORE_UPDATED', (event) => {
      if (event.score) setCrashConfidence(event.score.confidence);
    });

    const unsubCancelled = crashDetectionEngine.on('CRASH_CANCELLED', () => {
      stopCountdownTimer();
      setCountdownVisible(false);
      setSecondsRemaining(5);
    });

    // ── NEW: Start PostSOSVoice when SOS is dispatched ─────────────────────
    const unsubDispatched = crashDetectionEngine.on('SOS_DISPATCHED', (event) => {
      stopCountdownTimer();
      setCountdownVisible(false);
      setSecondsRemaining(5);

      // Capture incident ID for voice log storage
      const incidentId = event.crashEvent?.incidentId ?? `local_${Date.now()}`;
      activeIncidentIdRef.current = incidentId;

      // Wire up voice callbacks before starting
      postSOSVoice.setCallbacks({
        onInjuryDetected: async (result) => {
          if (result.injuryType && !result.unclear) {
            // Auto-detected from voice — fire the hospital pre-alert
            await handleSetInjuryType(result.injuryType);
          }
          // If unclear, sos.tsx will show the transcript and manual selector
        },
        onUnclear: () => {
          // sos.tsx handles this — shows transcript + manual chip selector
        },
        onStateChange: () => {
          // sos.tsx subscribes directly to postSOSVoice for UI updates
        },
        onError: () => {
          // sos.tsx shows error state and falls back to manual selection
        },
      });

      // Start voice — mic is free because acousticDetector was disabled in dispatchSOS()
      postSOSVoice.start(incidentId, language).catch((err) => {
        console.error('[Layout] PostSOSVoice start error:', err);
      });
    });

    return () => {
      unsubConfirmed();
      unsubState();
      unsubScore();
      unsubCancelled();
      unsubDispatched();
    };
  }, [language]); // language dependency so Whisper gets the right hint

  // ── HospitalPreAlert subscriptions ────────────────────────────────────────
  useEffect(() => {
    const unsub = hospitalPreAlert.subscribe((state) => {
      setPreAlertState({ ...state });
    });
    return () => unsub();
  }, []);

  // ── Countdown timer helpers ───────────────────────────────────────────────
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

  // ── Language setter ───────────────────────────────────────────────────────
  async function setLanguage(lang: LanguageCode) {
    setLanguageState(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  }

  // ── Injury type setter (shared between voice and manual) ──────────────────
  async function handleSetInjuryType(type: InjuryType) {
    setInjuryTypeState(type);

    const loc = await getLastKnownLocation();
    const lat = loc?.lat ?? 13.0585; // fallback to Chennai demo coords
    const lng = loc?.lng ?? 80.2596;

    const result = matchHospital(lat, lng, type);
    const incidentId = activeIncidentIdRef.current || `hpptest_${Date.now()}`;
    await hospitalPreAlert.sendPreAlert(result, incidentId, 3);
  }

  // ── Clear pre-alert (dismiss SOS) ─────────────────────────────────────────
  function clearPreAlert() {
    setInjuryTypeState(null);
    postSOSVoice.reset();
    hospitalPreAlert.reset();
    setPreAlertState(hospitalPreAlert.getState());
    activeIncidentIdRef.current = '';
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
        emergencyNumbers, language, setLanguage,
        isInitialized, gpsPermissionGranted,
        activeBystanderAlert,
        clearBystanderAlert: () => setAlert(null),
        meshConnected, meshPeerCount,
        crashState, crashConfidence,
        injuryType,
        setInjuryType: handleSetInjuryType,
        preAlertState, clearPreAlert,
      }}
    >
      <StatusBar style="dark" />

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
    flex: 1, backgroundColor: Colors.background.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  loadingInner: { alignItems: 'center', gap: 8, paddingHorizontal: 40 },
  loadingBrand: {
    fontSize: 44, fontWeight: '800', color: Colors.brand.primary,
    letterSpacing: -1.5, marginBottom: 4,
  },
  loadingSub: {
    fontSize: 13, color: Colors.label.secondary, textAlign: 'center',
    lineHeight: 18, letterSpacing: -0.1, marginBottom: 32,
  },
  spinner: { marginBottom: 12 },
  loadingStatus: { fontSize: 13, color: Colors.label.tertiary },
});