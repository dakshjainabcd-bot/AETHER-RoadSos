/**
 * AETHER App-Wide Constants
 */

export const SEARCH_RADIUS = {
  INITIAL_KM: 10,
  EXPANDED_KM: 20,
  MAX_KM: 50,
  MIN_RESULTS: 3,
};

export const GPS = {
  UPDATE_INTERVAL_MS: 10000,
  ACCURACY_THRESHOLD_M: 50,
  BLACKSPOT_ALERT_RADIUS_M: 300,
  BYSTANDER_NOTIFY_RADIUS_M: 500,
};

export const STORAGE_KEYS = {
  LAST_GPS: 'aether_last_gps',
  LANGUAGE: 'aether_language',
  COUNTRY_CODE: 'aether_country_code',
  MCC: 'aether_mcc',
  EMERGENCY_NUMBERS: 'aether_emergency',
  ONBOARDING_DONE: 'aether_onboarded',
  FALSE_POSITIVE_COUNT: 'aether_fp_count',
};

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

export const DEFAULT_EMERGENCY = {
  police: '112',
  ambulance: '108',
  fire: '101',
  unified: '112',
};

export const APP = {
  NAME: 'AETHER',
  VERSION: '1.0.0',
  TAGLINE: 'Accident Emergency & Trauma Hyper-Response',
};

export const MESH = {
  MAX_HOPS: 30,
  BYSTANDER_RADIUS_M: 500,
  DEDUP_WINDOW_MS: 5 * 60 * 1000,
  RELAY_JITTER_MAX_MS: 200,
  BLE_SERVICE_UUID: 'AETHER-SOS-001',
};

/**
 * SIMULATION SERVER URL
 * Replace IP with your laptop's local IP.
 * Windows: ipconfig → IPv4 Address under Wi-Fi
 * Mac/Linux: ifconfig → inet under en0/wlan0
 */
export const SIMULATION_SERVER_URL = 'ws://172.17.10.251:3001'; // ← CHANGE IP

export const CRASH_THRESHOLDS_CANCEL_WINDOW = 5;

export const CRASH_DETECTION = {
  COOLDOWN_MS: 30 * 60 * 1000,
  SEVERITY_THRESHOLDS: { MINOR: 3, LOW: 5, MODERATE: 8, SEVERE: 12 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5: OpenAI Whisper API Key
// ─────────────────────────────────────────────────────────────────────────────
//
// HOW TO GET YOUR KEY (free tier available):
//   1. Go to https://platform.openai.com/api-keys
//   2. Sign up / log in
//   3. Click "Create new secret key"
//   4. Paste it below (starts with "sk-")
//
// WHAT IT IS USED FOR:
//   - Speech-to-Text via OpenAI Whisper API (same model as the open-source repo)
//   - Model: whisper-1 (≈ large-v2) — supports 99 languages
//   - Endpoint: POST https://api.openai.com/v1/audio/transcriptions
//
// COST:
//   - $0.006 per minute of audio (~1 cent per 1.6 minutes)
//   - Free tier: $5 of credits on new accounts
//   - For a hackathon / emergency app: essentially free
//
// SECURITY:
//   - This is fine for hackathon / demo use
//   - For production: move to a backend proxy so the key isn't in the app bundle
//
export const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE'; // ← PASTE YOUR KEY HERE

// ─────────────────────────────────────────────────────────────────────────────
// Gemini (kept for BystAI vision analysis only — NOT used for STT anymore)
// ─────────────────────────────────────────────────────────────────────────────
export const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
export const GEMINI_STT_MODEL = 'gemini-1.5-flash'; // kept for vision in BystAI only