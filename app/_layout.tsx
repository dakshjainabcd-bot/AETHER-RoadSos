/**
 * Root Layout — App Entry Point (Updated for Phase 2)
 *
 * CHANGES FROM PHASE 1:
 * - Added meshRelayManager.initialize() to startup sequence
 * - Added activeBystanderAlert state to AppContext
 *   (so any screen can know when an SOS was received nearby)
 */

import { useEffect, useState, createContext, useContext, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { initializeMCCService, type EmergencyNumbers } from '../services/MCCService';
import { initializeDatabase } from '../services/POIDatabase';
import { requestLocationPermissions, startBackgroundTracking } from '../services/GPSService';
import { meshRelayManager } from '../services/MeshRelay/MeshRelayManager';
import { SOSPacket } from '../services/MeshRelay/types';
import { STORAGE_KEYS, DEFAULT_EMERGENCY, type LanguageCode } from '../utils/constants';
import { Colors } from '../theme';

// ─────────────────────────────────────────────────────────────
// GLOBAL APP CONTEXT (Phase 1 + Phase 2 additions)
// ─────────────────────────────────────────────────────────────

interface AppContextType {
  // Phase 1
  emergencyNumbers: EmergencyNumbers;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  isInitialized: boolean;
  gpsPermissionGranted: boolean;
  // Phase 2 — new additions
  activeBystanderAlert: { packet: SOSPacket; distanceM: number } | null;
  clearBystanderAlert: () => void;
  meshConnected: boolean;
  meshPeerCount: number;
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
});

export function useAppContext(): AppContextType {
  return useContext(AppContext);
}

// ─────────────────────────────────────────────────────────────
// ROOT LAYOUT COMPONENT
// ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [emergencyNumbers, setEmergencyNumbers] = useState<EmergencyNumbers>({
    ...DEFAULT_EMERGENCY,
    country: 'Detecting...',
    country_code: 'XX',
    languages: ['en'],
  });
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [gpsPermissionGranted, setGpsPermissionGranted] = useState(false);

  // Phase 2 state
  const [activeBystanderAlert, setActiveBystanderAlert] = useState<{
    packet: SOSPacket;
    distanceM: number;
  } | null>(null);
  const [meshConnected, setMeshConnected] = useState(false);
  const [meshPeerCount, setMeshPeerCount] = useState(0);

  useEffect(() => {
    initializeApp();
  }, []);

  // Set up mesh relay event listeners (after component mounts)
  useEffect(() => {
    // Listen for SOS received events from MeshRelayManager
    const unsubSOS = meshRelayManager.on('SOS_RECEIVED', (event) => {
      if (event.packet && event.data) {
        const isNearby = event.data['isNearby'] as boolean;
        const distanceM = (event.data['distanceM'] as number) ?? 0;

        if (isNearby) {
          console.log('[Layout] SOS nearby — showing bystander alert');
          setActiveBystanderAlert({ packet: event.packet, distanceM });
        }
      }
    });

    // Listen for simulation connection status
    const unsubConnected = meshRelayManager.on('SIMULATION_CONNECTED', (event) => {
      setMeshConnected(true);
      setMeshPeerCount((event.data?.['deviceCount'] as number) ?? 0);
    });

    const unsubDisconnected = meshRelayManager.on('SIMULATION_DISCONNECTED', () => {
      setMeshConnected(false);
      setMeshPeerCount(0);
    });

    return () => {
      unsubSOS();
      unsubConnected();
      unsubDisconnected();
    };
  }, []);

  async function initializeApp() {
    try {
      console.log('[App] Starting initialization...');

      // Step 1: Load saved language preference
      const savedLanguage = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
      if (savedLanguage) {
        setLanguageState(savedLanguage as LanguageCode);
      }

      // Step 2: Initialize SQLite database
      await initializeDatabase();
      console.log('[App] Database initialized');

      // Step 3: Detect country and load emergency numbers
      const numbers = await initializeMCCService();
      setEmergencyNumbers(numbers);
      console.log(`[App] Emergency numbers loaded for: ${numbers.country}`);

      // Step 4: Request GPS permissions and start tracking
      const gpsGranted = await requestLocationPermissions();
      setGpsPermissionGranted(gpsGranted);
      if (gpsGranted) {
        await startBackgroundTracking();
        console.log('[App] GPS tracking started');
      }

      // Step 5: Initialize Mesh Relay (Phase 2) ← NEW
      // We do this AFTER GPS so that crash location is available
      await meshRelayManager.initialize();
      console.log('[App] Mesh relay initialized');

      setIsInitialized(true);
      console.log('[App] ✅ Initialization complete');
    } catch (error) {
      console.error('[App] Initialization failed:', error);
      // Still show app, just with reduced functionality
      setIsInitialized(true);
    }
  }

  async function setLanguage(lang: LanguageCode): Promise<void> {
    setLanguageState(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  }

  function clearBystanderAlert(): void {
    setActiveBystanderAlert(null);
  }

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <Text style={styles.loadingTitle}>AETHER</Text>
        <Text style={styles.loadingSubtitle}>Accident Emergency & Trauma Hyper-Response</Text>
        <ActivityIndicator size="large" color={Colors.brand.primary} style={styles.spinner} />
        <Text style={styles.loadingStatus}>Initializing systems...</Text>
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
        clearBystanderAlert,
        meshConnected,
        meshPeerCount,
      }}
    >
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingTitle: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.brand.primary,
    letterSpacing: 4,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: Colors.text.muted,
    textAlign: 'center',
    marginBottom: 48,
    letterSpacing: 1,
  },
  spinner: { marginBottom: 16 },
  loadingStatus: {
    fontSize: 13,
    color: Colors.text.muted,
  },
});