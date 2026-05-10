/**
 * AETHER App-Wide Constants
 *
 * WHY: Magic numbers scattered in code are bad.
 * If the search radius needs to change from 10km to 15km,
 * you'd have to find every place it appears. Here, change it once.
 */

// POI Search radius steps (adaptive search — expands if too few results found)
export const SEARCH_RADIUS = {
  INITIAL_KM: 10,      // First try: find hospitals within 10km
  EXPANDED_KM: 20,     // If fewer than MIN_RESULTS found, expand to 20km
  MAX_KM: 50,          // If still too few, expand to 50km
  MIN_RESULTS: 3,      // Minimum number of results before expanding radius
};

// GPS settings
export const GPS = {
  UPDATE_INTERVAL_MS: 10000,   // Store GPS every 10 seconds to AsyncStorage
  ACCURACY_THRESHOLD_M: 50,    // Consider GPS "good" if accuracy < 50 meters
  BLACKSPOT_ALERT_RADIUS_M: 300, // Warn driver when within 300m of a blackspot
  BYSTANDER_NOTIFY_RADIUS_M: 500, // Notify bystanders within 500m of crash
};

// AsyncStorage keys — consistent naming prevents typos
export const STORAGE_KEYS = {
  LAST_GPS: 'aether_last_gps',           // Last known GPS: {lat, lng, timestamp}
  LANGUAGE: 'aether_language',           // User's selected language code
  COUNTRY_CODE: 'aether_country_code',   // Detected/selected country
  MCC: 'aether_mcc',                     // SIM Mobile Country Code
  EMERGENCY_NUMBERS: 'aether_emergency', // Emergency numbers for current country
  ONBOARDING_DONE: 'aether_onboarded',  // Has user completed onboarding?
  FALSE_POSITIVE_COUNT: 'aether_fp_count', // For crash detector improvement
};

// POI types — must match OpenStreetMap tags used in the Python build script
export const POI_TYPES = {
  HOSPITAL: 'hospital',
  POLICE: 'police',
  AMBULANCE: 'ambulance',
  TOWING: 'towing',
  PUNCTURE: 'puncture',
  PETROL: 'petrol',
  BLOOD_BANK: 'blood_bank',
} as const;

export type POIType = typeof POI_TYPES[keyof typeof POI_TYPES];

// Supported languages
export const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာဘာသာ' },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
] as const;

export type LanguageCode = typeof LANGUAGES[number]['code'];

// Default emergency numbers (fallback if MCC lookup fails)
export const DEFAULT_EMERGENCY = {
  police: '112',
  ambulance: '108',
  fire: '101',
  unified: '112',
};

// App metadata
export const APP = {
  NAME: 'AETHER',
  VERSION: '1.0.0',
  TAGLINE: 'Accident Emergency & Trauma Hyper-Response',
};

// ─── Phase 2: Mesh Relay Constants ───────────────────────────────────────────

export const MESH = {
  MAX_HOPS: 30,                    // Stop relaying after 30 hops (infinite loop prevention)
  BYSTANDER_RADIUS_M: 500,         // Only show alert if crash is within 500m
  DEDUP_WINDOW_MS: 5 * 60 * 1000, // Remember seen packets for 5 minutes
  RELAY_JITTER_MAX_MS: 200,        // Random delay before relaying (0-200ms) to prevent collisions
  BLE_SERVICE_UUID: 'AETHER-SOS-001', // Bluetooth GATT service ID (for production BLE)
};

/**
 * SIMULATION SERVER URL — UPDATE THIS TO YOUR LAPTOP'S IP
 *
 * HOW TO FIND YOUR IP (Windows):
 *   1. Open a NEW terminal window
 *   2. Run: ipconfig
 *   3. Look under "Wireless LAN adapter Wi-Fi:" (or your WiFi adapter name)
 *   4. Copy the "IPv4 Address" line (e.g., 192.168.1.105)
 *   5. Replace 192.168.1.100 below with your actual IP
 *
 * EXAMPLE: ws://192.168.1.105:3001
 *
 * Keep the port as 3001. Only change the IP.
 */
export const SIMULATION_SERVER_URL = 'ws://172.17.11.42:3001'; // ← CHANGE THIS IP

// Re-exported for use in _layout.tsx (countdown seconds)
export const CRASH_THRESHOLDS_CANCEL_WINDOW = 5;

export const CRASH_DETECTION = {
  COOLDOWN_MS: 30 * 60 * 1000, // 30 minute cooldown between SOS events
  SEVERITY_THRESHOLDS: { MINOR: 3, LOW: 5, MODERATE: 8, SEVERE: 12 }, // g-force thresholds for severity 1-5
};
