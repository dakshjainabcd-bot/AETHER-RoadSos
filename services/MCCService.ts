/**
 * MCCService — Mobile Country Code Detection
 *
 * WHY: Every SIM card contains an MCC (Mobile Country Code).
 * India = 404 or 405, UK = 234, USA = 310/311, etc.
 *
 * By reading this code, AETHER automatically knows:
 * - Which country the user is in
 * - What emergency numbers to show (108 in India, 999 in UK, 911 in USA)
 * - What language to default to
 *
 * This works even OFFLINE — MCC is read from the SIM, not the internet.
 *
 * FLOW:
 * 1. Read MCC from SIM card using react-native-sim-info
 * 2. Look up MCC in our bundled JSON table (mcc_emergency.json)
 * 3. Return the emergency numbers and country info
 * 4. Save to AsyncStorage so it persists between app launches
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, DEFAULT_EMERGENCY } from '../utils/constants';

// Import the JSON file we created — this is bundled WITH the app, no internet needed
import mccData from '../assets/data/mcc_emergency.json';

export interface EmergencyNumbers {
  police: string;
  ambulance: string;
  fire: string;
  unified: string;
  country: string;
  country_code: string;
  languages: string[];
}

/**
 * Get emergency numbers from the MCC JSON table
 *
 * @param mcc - Mobile Country Code (e.g., "404" for India)
 * @returns Emergency numbers and country info
 */
function lookupMCC(mcc: string): EmergencyNumbers {
  // TypeScript needs us to tell it that mccData can be indexed by string
  const data = mccData as Record<string, EmergencyNumbers>;

  // First try exact MCC match
  if (data[mcc]) {
    return data[mcc];
  }

  // Try first 3 digits (some networks use 4+ digit MCCs)
  const shortMcc = mcc.substring(0, 3);
  if (data[shortMcc]) {
    return data[shortMcc];
  }

  // No match — return international defaults (112 works in most countries)
  console.warn(`[MCCService] Unknown MCC: ${mcc}, using defaults`);
  return data['DEFAULT'] as EmergencyNumbers;
}

/**
 * Initialize the MCC service on app startup
 *
 * Tries to read SIM card MCC. Falls back gracefully if:
 * - No SIM inserted (WiFi-only tablet)
 * - Permission denied
 * - react-native-sim-info fails (simulator)
 */
export async function initializeMCCService(): Promise<EmergencyNumbers> {
  try {
    // Try to import SimInfo — this reads the actual SIM card
    // We use dynamic import so the app doesn't crash if this module fails
    let mcc = '404'; // Default to India if SIM reading fails

    try {
      // react-native-sim-info reads the MCC from the device's SIM
      const SimInfo = require('react-native-sim-info').default;
      const simDetails = SimInfo.getSimInfo();

      if (simDetails && simDetails.mobileCountryCode) {
        mcc = simDetails.mobileCountryCode;
        console.log(`[MCCService] SIM MCC detected: ${mcc}`);
      } else {
        // Check if there's a stored preference from last session
        const storedMCC = await AsyncStorage.getItem(STORAGE_KEYS.MCC);
        if (storedMCC) {
          mcc = storedMCC;
          console.log(`[MCCService] Using stored MCC: ${mcc}`);
        }
      }
    } catch (simError) {
      // SimInfo failed — running in simulator or no SIM
      console.log('[MCCService] SimInfo not available, using stored/default MCC');
      const storedMCC = await AsyncStorage.getItem(STORAGE_KEYS.MCC);
      if (storedMCC) {
        mcc = storedMCC;
      }
    }

    const emergencyNumbers = lookupMCC(mcc);

    // Save to AsyncStorage for offline use on next launch
    await AsyncStorage.setItem(STORAGE_KEYS.MCC, mcc);
    await AsyncStorage.setItem(
      STORAGE_KEYS.EMERGENCY_NUMBERS,
      JSON.stringify(emergencyNumbers)
    );
    await AsyncStorage.setItem(STORAGE_KEYS.COUNTRY_CODE, emergencyNumbers.country_code);

    console.log(`[MCCService] Country: ${emergencyNumbers.country}, Ambulance: ${emergencyNumbers.ambulance}`);
    return emergencyNumbers;

  } catch (error) {
    console.error('[MCCService] Failed to initialize:', error);

    // Last resort — check AsyncStorage for cached data from previous launch
    const cached = await AsyncStorage.getItem(STORAGE_KEYS.EMERGENCY_NUMBERS);
    if (cached) {
      return JSON.parse(cached) as EmergencyNumbers;
    }

    // Absolute fallback — international emergency numbers
    return {
      ...DEFAULT_EMERGENCY,
      country: 'Unknown',
      country_code: 'XX',
      languages: ['en'],
    };
  }
}

/**
 * Allow user to manually override country (for travelers)
 * Example: Indian SIM card in UK — user can manually set UK emergency numbers
 *
 * @param mcc - MCC string for the desired country (e.g., "234" for UK)
 */
export async function setManualCountry(mcc: string): Promise<EmergencyNumbers> {
  const emergencyNumbers = lookupMCC(mcc);

  await AsyncStorage.setItem(STORAGE_KEYS.MCC, mcc);
  await AsyncStorage.setItem(
    STORAGE_KEYS.EMERGENCY_NUMBERS,
    JSON.stringify(emergencyNumbers)
  );
  await AsyncStorage.setItem(STORAGE_KEYS.COUNTRY_CODE, emergencyNumbers.country_code);

  console.log(`[MCCService] Manually set to: ${emergencyNumbers.country}`);
  return emergencyNumbers;
}

/**
 * Get currently saved emergency numbers without re-reading SIM
 * Useful for components that need emergency numbers without triggering SIM read
 */
export async function getCachedEmergencyNumbers(): Promise<EmergencyNumbers | null> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEYS.EMERGENCY_NUMBERS);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

/**
 * Get all supported countries for the manual override picker
 */
export function getAllCountries(): Array<{ mcc: string; country: string; country_code: string }> {
  const data = mccData as Record<string, EmergencyNumbers & { country: string; country_code: string }>;

  return Object.entries(data)
    .filter(([key]) => key !== 'DEFAULT')
    .map(([mcc, info]) => ({
      mcc,
      country: info.country,
      country_code: info.country_code,
    }))
    .sort((a, b) => a.country.localeCompare(b.country));
}
