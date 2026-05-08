/**
 * Root Layout — App Entry Point
 *
 * WHY THIS FILE EXISTS:
 * Expo Router uses file-based routing. _layout.tsx files wrap all screens
 * in the same folder. This is the ROOT layout — it wraps EVERYTHING.
 *
 * WHAT IT DOES:
 * 1. Initializes all services (GPS, MCC, Database) when app starts
 * 2. Sets up the navigation container
 * 3. Makes app-wide data (emergency numbers, GPS) available to all screens
 *    via React Context
 *
 * REACT CONTEXT:
 * Context is like a "global state" that any child component can access
 * without passing props down through every level.
 * We use it for: emergency numbers, current GPS, language preference.
 */

import { useEffect, useState, createContext, useContext } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { initializeMCCService, type EmergencyNumbers } from '../services/MCCService';
import { initializeDatabase } from '../services/POIDatabase';
import { requestLocationPermissions, startBackgroundTracking } from '../services/GPSService';
import { STORAGE_KEYS, DEFAULT_EMERGENCY, type LanguageCode } from '../utils/constants';
import { Colors } from '../theme';

// ─────────────────────────────────────────────────────────────
// GLOBAL APP CONTEXT
// Any screen can call useAppContext() to get emergency numbers, language, etc.
// ─────────────────────────────────────────────────────────────

interface AppContextType {
  emergencyNumbers: EmergencyNumbers;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  isInitialized: boolean;
  gpsPermissionGranted: boolean;
}

// Create the context with defaults (will be overwritten by actual values)
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
});

// Custom hook — screens call this instead of useContext(AppContext) directly
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
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize everything when app launches
  useEffect(() => {
    initializeApp();
  }, []);

  async function initializeApp() {
    try {
      console.log('[App] Starting initialization...');

      // Step 1: Load saved language preference (fast — AsyncStorage read)
      const savedLanguage = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
      if (savedLanguage) {
        setLanguageState(savedLanguage as LanguageCode);
      }

      // Step 2: Initialize SQLite database (creates tables if not exist)
      // This MUST happen before any POI searches
      await initializeDatabase();
      console.log('[App] Database initialized');

      // Step 3: Detect country via SIM MCC and load emergency numbers
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

      // All done — show the actual app
      setIsInitialized(true);
      console.log('[App] Initialization complete');

    } catch (error) {
      console.error('[App] Initialization failed:', error);
      setInitError('Failed to start AETHER. Please restart the app.');
      // Still set initialized to true so we show something (not blank screen)
      setIsInitialized(true);
    }
  }

  // Change language and persist to storage
  async function setLanguage(lang: LanguageCode): Promise<void> {
    setLanguageState(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
    console.log(`[App] Language changed to: ${lang}`);
  }

  // Show loading screen while initializing
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
      }}
    >
      <StatusBar style="light" />
      {/* Stack navigator — Expo Router uses file-based routing */}
      {/* The (tabs) folder becomes the main tab bar */}
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
  spinner: {
    marginBottom: 16,
  },
  loadingStatus: {
    fontSize: 13,
    color: Colors.text.muted,
  },
});
