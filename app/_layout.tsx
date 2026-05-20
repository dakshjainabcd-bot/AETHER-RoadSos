/**
 * Root Layout — Phase 9 Updated
 *
 * CHANGES FROM PREVIOUS VERSION:
 * 1. Initialize RoadDNA services on app startup:
 *    - initDrivingEventsDB() — creates SQLite table
 *    - drivingEventLogger.start() — begins sensor monitoring
 *    - blackspotUploader.startMonitoring() — watches for WiFi
 *    - proximityAlertService.start() — begins 5s geofence polls
 * 2. Subscribe to proximity alerts → show BlackspotAlert banner
 * 3. Added blackspotAlert state and clearBlackspotAlert to AppContext
 * 4. BlackspotAlert rendered at root level (above all screens)
 *
 * EVERYTHING ELSE IS IDENTICAL TO THE PREVIOUS _layout.tsx.
 * We only ADD — we never remove or break existing functionality.
 *
 * IMPORTANT: The Phase 9 additions are clearly marked with
 * "── PHASE 9" comments so you can find them instantly.
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

// PostSOSVoice
import { postSOSVoice } from '../services/PostSOSVoice';

// ── PHASE 9 IMPORTS ──────────────────────────────────────────────────────────
import {
  initDrivingEventsDB,
  drivingEventLogger,
  blackspotUploader,
  proximityAlertService,
  computeBlackspots,
} from '../services/RoadDNA';
import type { BlackspotAlertState } from '../services/RoadDNA/types';
import { BlackspotAlert } from '../components/BlackspotAlert';
// ─────────────────────────────────────────────────────────────────────────────

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
  // ── PHASE 9 ────────────────────────────────────────────────────────────────
  blackspotAlert: BlackspotAlertState | null;
  clearBlackspotAlert: () => void;
  roadDNAEnabled: boolean;
  // ───────────────────────────────────────────────────────────────────────────
}

const DEFAULT_PREALERT_STATE: PreAlertState = {
  status: 'idle', hospitalName: '', hospitalPhone: '',
  distanceText: '', etaMinutes: 0, injuryType: '',
  sentAt: null, acknowledgedAt: null, incidentId: '',
};

const AppContext = createContext<AppContextType>({
  emergencyNumbers: { ...DEFAULT_EMERGENCY, country: 'Unknown', country_code: 'XX', languages: ['en'] },
  language: 'en',
  setLanguage: async () => { },
  isInitialized: false,
  gpsPermissionGranted: false,
  activeBystanderAlert: null,
  clearBystanderAlert: () => { },
  meshConnected: false,
  meshPeerCount: 0,
  crashState: 'idle',
  crashConfidence: 0,
  injuryType: null,
  setInjuryType: async () => { },
  preAlertState: DEFAULT_PREALERT_STATE,
  clearPreAlert: () => { },
  // ── PHASE 9 defaults ────────────────────────────────────────────────────────
  blackspotAlert: null,
  clearBlackspotAlert: () => { },
  roadDNAEnabled: true,
  // ───────────────────────────────────────────────────────────────────────────
});

export function useAppContext(): AppContextType {
  return useContext(AppContext);
}

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [emergencyNumbers, setEmergencyNumbers] = useState<EmergencyNumbers>({
    ...DEFAULT_EMERGENCY, country: 'Detecting…', country_code: 'XX', languages: ['en'],
  });
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [gpsPermissionGranted, setGpsGranted] = useState(false);
  const [activeBystanderAlert, setAlert] = useState<{ packet: SOSPacket; distanceM: number } | null>(null);
  const [meshConnected, setMeshConnected] = useState(false);
  const [meshPeerCount, setMeshPeerCount] = useState(0);
  const [crashState, setCrashState] = useState<CrashDetectionState>('idle');
  const [crashConfidence, setCrashConfidence] = useState(0);
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [injuryType, setInjuryTypeState] = useState<InjuryType | null>(null);
  const [preAlertState, setPreAlertState] = useState<PreAlertState>(hospitalPreAlert.getState());

  // ── PHASE 9 STATE ──────────────────────────────────────────────────────────
  const [blackspotAlert, setBlackspotAlert] = useState<BlackspotAlertState | null>(null);
  const [roadDNAEnabled, setRoadDNAEnabled] = useState(true);
  // ───────────────────────────────────────────────────────────────────────────

  const activeIncidentIdRef = useRef<string>('');
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Mesh relay subscriptions (unchanged) ─────────────────────────────────
  useEffect(() => {
    const unsubSOS = meshRelayManager.on('SOS_RECEIVED', (event) => {
      if (event.packet && event.data) {
        const isNearby = event.data['isNearby'] as boolean;
        const distanceM = (event.data['distanceM'] as number) ?? 0;
        if (isNearby) setAlert({ packet: event.packet, distanceM });
      }
    });
    const unsubOn = meshRelayManager.on('SIMULATION_CONNECTED', (e) => {
      setMeshConnected(true);
      setMeshPeerCount((e.data?.['deviceCount'] as number) ?? 0);
    });
    const unsubOff = meshRelayManager.on('SIMULATION_DISCONNECTED', () => {
      setMeshConnected(false);
      setMeshPeerCount(0);
    });
    return () => { unsubSOS(); unsubOn(); unsubOff(); };
  }, []);

  // ── Crash detection subscriptions (unchanged) ────────────────────────────
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
    const unsubDispatched = crashDetectionEngine.on('SOS_DISPATCHED', (event) => {
      stopCountdownTimer();
      setCountdownVisible(false);
      setSecondsRemaining(5);
      const incidentId = event.crashEvent?.incidentId ?? `local_${Date.now()}`;
      activeIncidentIdRef.current = incidentId;
      postSOSVoice.setCallbacks({
        onInjuryDetected: async (result) => {
          if (result.injuryType && !result.unclear) {
            await handleSetInjuryType(result.injuryType);
          }
        },
        onUnclear: () => { },
        onStateChange: () => { },
        onError: () => { },
      });
      postSOSVoice.start(incidentId, language).catch((err) => {
        console.error('[Layout] PostSOSVoice start error:', err);
      });
    });
    return () => {
      unsubConfirmed(); unsubState(); unsubScore();
      unsubCancelled(); unsubDispatched();
    };
  }, [language]);

  // ── HospitalPreAlert subscriptions (unchanged) ───────────────────────────
  useEffect(() => {
    const unsub = hospitalPreAlert.subscribe((state) => {
      setPreAlertState({ ...state });
    });
    return () => unsub();
  }, []);

  // ── PHASE 9: Subscribe to proximity alerts ─────────────────────────────────
  useEffect(() => {
    const unsubProximity = proximityAlertService.onAlert((alert) => {
      if (alert) {
        setBlackspotAlert(alert);
      }
      // We do NOT clear the alert automatically here —
      // BlackspotAlert component auto-dismisses after 8 seconds
    });
    return () => unsubProximity();
  }, []);
  // ───────────────────────────────────────────────────────────────────────────

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

      // ── PHASE 9: Initialize Road DNA ──────────────────────────────────────
      await initDrivingEventsDB();
      blackspotUploader.startMonitoring();

      // Start proximity service (loads cached blackspots)
      await proximityAlertService.start();

      // Start driving event logger only if GPS granted
      if (gpsGranted) {
        await drivingEventLogger.start();
      }

      // Run blackspot computation once at startup (background, non-blocking)
      computeBlackspots().then((spots) => {
        console.log(`[RoadDNA] Startup computation: ${spots.length} blackspots found`);
        // Refresh proximity service with latest blackspots
        proximityAlertService.refreshBlackspots();
      });
      // ─────────────────────────────────────────────────────────────────────

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

  async function handleSetInjuryType(type: InjuryType) {
    setInjuryTypeState(type);
    const loc = await getLastKnownLocation();
    const lat = loc?.lat ?? 13.0585;
    const lng = loc?.lng ?? 80.2596;
    const result = matchHospital(lat, lng, type);
    const incidentId = activeIncidentIdRef.current || `hpptest_${Date.now()}`;
    await hospitalPreAlert.sendPreAlert(result, incidentId, 3);
  }

  function clearPreAlert() {
    setInjuryTypeState(null);
    postSOSVoice.reset();
    hospitalPreAlert.reset();
    setPreAlertState(hospitalPreAlert.getState());
    activeIncidentIdRef.current = '';
  }

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
        // ── PHASE 9 ─────────────────────────────────────────────────────────
        blackspotAlert,
        clearBlackspotAlert: () => setBlackspotAlert(null),
        roadDNAEnabled,
        // ────────────────────────────────────────────────────────────────────
      }}
    >
      <StatusBar style="dark" />

      {/* Crash countdown (unchanged) */}
      <CrashCountdown
        visible={countdownVisible}
        secondsRemaining={secondsRemaining}
        totalSeconds={5}
        confidence={crashConfidence}
        onCancel={() => crashDetectionEngine.cancelSOS()}
        onCountdownComplete={() => crashDetectionEngine.dispatchSOS()}
      />

      {/* ── PHASE 9: Blackspot proximity alert banner ─────────────────────── */}
      <BlackspotAlert
        alert={blackspotAlert}
        onDismiss={() => setBlackspotAlert(null)}
      />
      {/* ─────────────────────────────────────────────────────────────────── */}

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