/**
 * Root Layout — Phase 12 Merged (Phase 9 + Phase 10 + Phase 12)
 *
 * Phase 9: Road DNA (blackspots, driving events, proximity alerts)
 * Phase 10: DPDP consent dialog (first‑time user)
 * Phase 12: Driver Intelligence (hazard mesh, trip scoring, badges)
 *
 * NO EXISTING FEATURE REMOVED — only additions.
 */

import { useEffect, useState, useRef, createContext, useContext } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Phase 10: Privacy & Consent
import { ConsentDialog } from '../components/ConsentDialog';
import { hasFullConsent, saveConsent, saveDecline } from '../utils/PrivacyManager';

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

// Phase 5 (PostSOSVoice)
import { postSOSVoice } from '../services/PostSOSVoice';

// ── PHASE 9 IMPORTS (Road DNA) ──────────────────────────────────────────────
import {
  initDrivingEventsDB,
  drivingEventLogger,
  blackspotUploader,
  proximityAlertService,
  computeBlackspots,
} from '../services/RoadDNA';
import type { BlackspotAlertState } from '../services/RoadDNA/types';
import { BlackspotAlert } from '../components/BlackspotAlert';
import { BystanderAlert } from '../components/BystanderAlert';

// ── PHASE 12 IMPORTS (Driver Intelligence) ──────────────────────────────────
import {
  tripScoreService,
  hazardBroadcaster,
  badgeService,
  type TripScore,
  type HazardAlertState,
} from '../services/DriverIntelligence';
import { HazardAlert } from '../components/HazardAlert';
import { TripSummaryModal } from '../components/TripSummaryModal';
// ────────────────────────────────────────────────────────────────────────────

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
  // Phase 9
  blackspotAlert: BlackspotAlertState | null;
  clearBlackspotAlert: () => void;
  roadDNAEnabled: boolean;
  // Phase 12
  hazardAlert: HazardAlertState | null;
  clearHazardAlert: () => void;
  latestTripScore: TripScore | null;
  clearLatestTripScore: () => void;
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
  // Phase 9 defaults
  blackspotAlert: null,
  clearBlackspotAlert: () => { },
  roadDNAEnabled: true,
  // Phase 12 defaults
  hazardAlert: null,
  clearHazardAlert: () => { },
  latestTripScore: null,
  clearLatestTripScore: () => { },
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

  // Phase 10: Consent state
  const [consentChecked, setConsentChecked] = useState<boolean | null>(null);
  const consentGrantedRef = useRef<boolean>(false);

  // Phase 9 state
  const [blackspotAlert, setBlackspotAlert] = useState<BlackspotAlertState | null>(null);
  const [roadDNAEnabled, setRoadDNAEnabled] = useState(true);

  // Phase 12 state
  const [hazardAlert, setHazardAlert] = useState<HazardAlertState | null>(null);
  const [latestTripScore, setLatestTripScore] = useState<TripScore | null>(null);

  const activeIncidentIdRef = useRef<string>('');
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Existing: Mesh relay subscriptions ─────────────────────────────────────
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

  // ── Existing: Crash detection subscriptions ────────────────────────────────
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
    });
    return () => {
      unsubConfirmed(); unsubState(); unsubScore();
      unsubCancelled(); unsubDispatched();
    };
  }, [language]);

  // ── Existing: HospitalPreAlert subscriptions ───────────────────────────────
  useEffect(() => {
    const unsub = hospitalPreAlert.subscribe((state) => {
      setPreAlertState({ ...state });
    });
    return () => unsub();
  }, []);

  // ── Existing: Phase 9 proximity alerts ─────────────────────────────────────
  useEffect(() => {
    const unsubProximity = proximityAlertService.onAlert((alert) => {
      if (alert) {
        setBlackspotAlert(alert);
      }
    });
    return () => unsubProximity();
  }, []);

  // ── NEW Phase 12: Hazard and trip score subscriptions ──────────────────────
  useEffect(() => {
    // Show hazard alert banner when a hazard is received
    const unsubHazard = hazardBroadcaster.onHazardAlert((alert) => {
      setHazardAlert(alert);
    });
    // Show trip summary modal when a trip completes
    const unsubTrip = tripScoreService.onTripComplete((score) => {
      setLatestTripScore(score);
    });
    return () => {
      unsubHazard();
      unsubTrip();
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

  // ── App initialization (Phase 10 consent + Phase 9 + Phase 12) ──────────────
  useEffect(() => {
    checkConsentAndInit();
  }, []);

  async function checkConsentAndInit() {
    const hasConsent = await hasFullConsent();
    consentGrantedRef.current = hasConsent;
    setConsentChecked(hasConsent);
    if (hasConsent) {
      initializeApp();
    }
  }

  async function handleConsentAccepted() {
    await saveConsent();
    consentGrantedRef.current = true;
    setConsentChecked(true);
    initializeApp();
  }

  async function handleConsentDeclined() {
    await saveDecline();
    consentGrantedRef.current = false;
    setConsentChecked(true);
    initializeApp();
  }

  async function initializeApp() {
    try {
      const savedLang = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
      if (savedLang) setLanguageState(savedLang as LanguageCode);

      await initializeDatabase();
      const numbers = await initializeMCCService();
      setEmergencyNumbers(numbers);

      let gpsGranted = false;
      if (consentGrantedRef.current) {
        gpsGranted = await requestLocationPermissions();
        setGpsGranted(gpsGranted);
        if (gpsGranted) await startBackgroundTracking();
      } else {
        console.log('[App] Location tracking skipped — user declined consent');
        setGpsGranted(false);
      }

      await meshRelayManager.initialize();
      crashDetectionEngine.initialize();

      // ── PHASE 9: Initialize Road DNA ──────────────────────────────────────
      await initDrivingEventsDB();
      blackspotUploader.startMonitoring();
      await proximityAlertService.start();
      if (gpsGranted) {
        await drivingEventLogger.start();
      }
      computeBlackspots().then((spots) => {
        console.log(`[RoadDNA] Startup computation: ${spots.length} blackspots found`);
        proximityAlertService.refreshBlackspots();
      });
      // ───────────────────────────────────────────────────────────────────────

      // ── PHASE 12: Initialize Driver Intelligence (after mesh) ──────────────
      // hazardBroadcaster needs the WebSocket bridge (already set up by meshRelayManager)
      await hazardBroadcaster.initialize();
      tripScoreService.start();  // begins 30s GPS poll for trip scoring
      // badgeService is auto‑initialized by tripScoreService, no separate call needed
      // ───────────────────────────────────────────────────────────────────────

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
    hospitalPreAlert.reset();
    setPreAlertState(hospitalPreAlert.getState());
    activeIncidentIdRef.current = '';
  }

  // Phase 10: While checking consent
  if (consentChecked === null) {
    return <View style={{ flex: 1, backgroundColor: Colors.background.primary }} />;
  }

  if (consentChecked === false) {
    return (
      <ConsentDialog
        onAccept={handleConsentAccepted}
        onDecline={handleConsentDeclined}
      />
    );
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
        // Phase 9
        blackspotAlert,
        clearBlackspotAlert: () => setBlackspotAlert(null),
        roadDNAEnabled,
        // Phase 12
        hazardAlert,
        clearHazardAlert: () => setHazardAlert(null),
        latestTripScore,
        clearLatestTripScore: () => setLatestTripScore(null),
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

      {/* Phase 9: Blackspot proximity alert banner */}
      <BlackspotAlert
        alert={blackspotAlert}
        onDismiss={() => setBlackspotAlert(null)}
      />

      {/* Phase 12: Hazard alert banner */}
      <HazardAlert
        alert={hazardAlert}
        onDismiss={() => setHazardAlert(null)}
      />

      {/* Phase 12: Trip summary modal (shown after trip ends) */}
      <TripSummaryModal
        visible={latestTripScore !== null}
        tripScore={latestTripScore}
        onDismiss={() => setLatestTripScore(null)}
      />

      <BystanderAlert
        packet={activeBystanderAlert?.packet ?? null}
        distanceM={activeBystanderAlert?.distanceM ?? 0}
        emergencyAmbulanceNumber={emergencyNumbers.ambulance}
        onDismiss={() => setAlert(null)}
        onHelpPress={() => {
          setAlert(null);
          router.push({
            pathname: '/bystander',
            params: { incidentTimestamp: activeBystanderAlert?.packet?.timestamp?.toString() ?? '' },
          });
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