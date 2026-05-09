import { useEffect, useState, createContext, useContext, useRef, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { initializeMCCService, type EmergencyNumbers } from '../services/MCCService';
import { initializeDatabase } from '../services/POIDatabase';
import { requestLocationPermissions, startBackgroundTracking } from '../services/GPSService';
import { meshRelayManager } from '../services/MeshRelay/MeshRelayManager';
import { SOSPacket } from '../services/MeshRelay/types';
import { STORAGE_KEYS, DEFAULT_EMERGENCY, type LanguageCode, CRASH_THRESHOLDS_CANCEL_WINDOW } from '../utils/constants';
import { Colors } from '../theme';

import { crashDetectionEngine } from '../services/CrashDetection/CrashDetectionEngine';
import { CrashCountdown } from '../components/CrashCountdown';
import type { CrashDetectionState, FusionScore } from '../services/CrashDetection/types';

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
  crashScore: FusionScore;
  currentGForce: number;
  isCountdownVisible: boolean;
  countdownSecondsRemaining: number;
  cancelCrashSOS: () => void;
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
  crashScore: { accelScore: 0, gyroScore: 0, acousticScore: 0, confidence: 0, gForce: 0 },
  currentGForce: 0,
  isCountdownVisible: false,
  countdownSecondsRemaining: 5,
  cancelCrashSOS: () => {},
});

export function useAppContext(): AppContextType { return useContext(AppContext); }

export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [emergencyNumbers, setEmergencyNumbers] = useState<EmergencyNumbers>({
    ...DEFAULT_EMERGENCY, country: 'Detecting...', country_code: 'XX', languages: ['en'],
  });
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [gpsPermissionGranted, setGpsPermissionGranted] = useState(false);
  const [activeBystanderAlert, setActiveBystanderAlert] = useState<{ packet: SOSPacket; distanceM: number } | null>(null);
  const [meshConnected, setMeshConnected] = useState(false);
  const [meshPeerCount, setMeshPeerCount] = useState(0);

  const [crashState, setCrashState] = useState<CrashDetectionState>('idle');
  const [crashScore, setCrashScore] = useState<FusionScore>({ accelScore:0, gyroScore:0, acousticScore:0, confidence:0, gForce:0 });
  const [currentGForce, setCurrentGForce] = useState(0);
  const [isCountdownVisible, setIsCountdownVisible] = useState(false);
  const [countdownSecondsRemaining, setCountdownSeconds] = useState(CRASH_THRESHOLDS_CANCEL_WINDOW);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { initializeApp(); }, []);

  useEffect(() => {
    const unsubSOS = meshRelayManager.on('SOS_RECEIVED', (event) => {
      if (event.packet && event.data?.['isNearby']) {
        setActiveBystanderAlert({ packet: event.packet, distanceM: (event.data['distanceM'] as number) ?? 0 });
      }
    });
    const unsubConn = meshRelayManager.on('SIMULATION_CONNECTED', (event) => {
      setMeshConnected(true);
      setMeshPeerCount((event.data?.['deviceCount'] as number) ?? 0);
    });
    const unsubDisc = meshRelayManager.on('SIMULATION_DISCONNECTED', () => {
      setMeshConnected(false); setMeshPeerCount(0);
    });
    return () => { unsubSOS(); unsubConn(); unsubDisc(); };
  }, []);

  useEffect(() => {
    const unsubScore = crashDetectionEngine.on('SCORE_UPDATED', (event) => {
      if (event.score) {
        setCrashScore(event.score);
        setCurrentGForce(event.score.gForce);
      }
    });
    const unsubState = crashDetectionEngine.on('STATE_CHANGED', (event) => {
      if (event.state) setCrashState(event.state);
    });
    const unsubConfirm = crashDetectionEngine.on('CRASH_CONFIRMED', (event) => {
      if (event.score) setCrashScore(event.score);
      startCountdown();
    });
    return () => {
      unsubScore();
      unsubState();
      unsubConfirm();
    };
  }, []);

  const startCountdown = useCallback(() => {
    setIsCountdownVisible(true);
    setCountdownSeconds(CRASH_THRESHOLDS_CANCEL_WINDOW);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          setIsCountdownVisible(false);
          crashDetectionEngine.dispatchSOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const cancelCrashSOS = useCallback(() => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setIsCountdownVisible(false);
    setCountdownSeconds(CRASH_THRESHOLDS_CANCEL_WINDOW);
    crashDetectionEngine.cancelSOS();
  }, []);

  async function initializeApp() {
    try {
      const savedLanguage = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
      if (savedLanguage) setLanguageState(savedLanguage as LanguageCode);
      await initializeDatabase();
      const numbers = await initializeMCCService();
      setEmergencyNumbers(numbers);
      const gpsGranted = await requestLocationPermissions();
      setGpsPermissionGranted(gpsGranted);
      if (gpsGranted) await startBackgroundTracking();
      await meshRelayManager.initialize();
      crashDetectionEngine.initialize();
      console.log('[App] Crash detection ready');
      setIsInitialized(true);
    } catch (error) {
      console.error('[App] Init failed:', error);
      setIsInitialized(true);
    }
  }

  async function setLanguage(lang: LanguageCode): Promise<void> {
    setLanguageState(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  }

  if (!isInitialized) {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" />
        <Text style={styles.loadingTitle}>AETHER</Text>
        <Text style={styles.loadingSubtitle}>Accident Emergency & Trauma Hyper-Response</Text>
        <ActivityIndicator size="large" color={Colors.brand.primary} style={styles.spinner} />
        <Text style={styles.loadingStatus}>Initializing systems...</Text>
      </View>
    );
  }

  return (
    <AppContext.Provider value={{
      emergencyNumbers, language, setLanguage, isInitialized, gpsPermissionGranted,
      activeBystanderAlert, clearBystanderAlert: () => setActiveBystanderAlert(null),
      meshConnected, meshPeerCount,
      crashState, crashScore, currentGForce, isCountdownVisible, countdownSecondsRemaining, cancelCrashSOS,
    }}>
      <StatusBar style="light" />
      <CrashCountdown
        visible={isCountdownVisible}
        secondsRemaining={countdownSecondsRemaining}
        totalSeconds={CRASH_THRESHOLDS_CANCEL_WINDOW}
        confidence={crashScore.confidence}
        onCancel={cancelCrashSOS}
        onCountdownComplete={() => {}}
      />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingTitle: { fontSize: 48, fontWeight: '800', color: '#FF3B30', letterSpacing: 4, marginBottom: 8 },
  loadingSubtitle: { fontSize: 13, color: '#8E8E93', textAlign: 'center', marginBottom: 48, letterSpacing: 1 },
  spinner: { marginBottom: 16 },
  loadingStatus: { fontSize: 13, color: '#8E8E93' },
});