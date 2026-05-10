/**
 * Phase 5 — Multilingual Communication Bridge Types
 * 
 * Shared types and constants for the multilingual system
 */

/**
 * Supported language codes (ISO 639-1)
 * These map to languages in constants.ts LANGUAGES array
 */
export type SupportedLanguageCode =
    | 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'ml' | 'mr' | 'bn'
    | 'gu' | 'pa' | 'ur' | 'or' | 'as' | 'ne' | 'si' | 'my'
    | 'th' | 'fr' | 'ar' | 'zh' | 'es' | 'pt';

/**
 * Translation cache entry
 */
export interface TranslationCacheEntry {
    sourceText: string;
    sourceLang: SupportedLanguageCode;
    targetLang: SupportedLanguageCode;
    translatedText: string;
    timestamp: number;
    usageCount: number;
}

/**
 * Speech recognition result
 */
export interface SpeechRecognitionResult {
    transcript: string;
    confidence: number;
    language: SupportedLanguageCode;
    alternativeTranscripts?: string[];
}

/**
 * Translation request
 */
export interface TranslationRequest {
    text: string;
    sourceLang: SupportedLanguageCode;
    targetLang: SupportedLanguageCode;
    priority?: 'low' | 'normal' | 'high';
}

/**
 * Translation result
 */
export interface TranslationResult {
    originalText: string;
    translatedText: string;
    sourceLang: SupportedLanguageCode;
    targetLang: SupportedLanguageCode;
    cached: boolean;
    confidence?: number;
}

/**
 * TTS speech request
 */
export interface TTSRequest {
    text: string;
    language: SupportedLanguageCode;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    rate?: number;        // Speech rate (0.5 - 2.0)
    pitch?: number;       // Voice pitch (0.5 - 2.0)
    volume?: number;      // Volume (0 - 1.0)
}

/**
 * Multilingual bridge status
 */
export interface MultilingualBridgeStatus {
    sttReady: boolean;
    translationReady: boolean;
    ttsReady: boolean;
    currentLanguage: SupportedLanguageCode;
    cacheSize: number;
    lastError?: string;
}

/**
 * Common emergency phrases (pre-translated and cached)
 * These are loaded at app startup for instant access
 */
export const EMERGENCY_PHRASES = {
    call_ambulance: {
        en: 'Call ambulance',
        hi: 'एम्बुलेंस बुलाओ',
        ta: 'ஆம்புலன்ஸை அழைக்கவும்',
        te: 'అంబులెన్స్‌ను పిలవండి',
        kn: 'ಆಂಬುಲೆನ್ಸ್ ಕರೆ ಮಾಡಿ',
        ml: 'ആംബുലൻസ് വിളിക്കുക',
        bn: 'অ্যাম্বুলেন্স ডাকুন',
    },
    help_needed: {
        en: 'Help needed',
        hi: 'मदद चाहिए',
        ta: 'உதவி தேவை',
        te: 'సహాయం కావాలి',
        kn: 'ಸಹಾಯ ಬೇಕಾಗಿದೆ',
        ml: 'സഹായം ആവശ്യമാണ്',
        bn: 'সাহায্য প্রয়োজন',
    },
    accident_here: {
        en: 'Accident here',
        hi: 'यहाँ दुर्घटना हुई',
        ta: 'இங்கே விபத்து',
        te: 'ఇక్కడ ప్రమాదం',
        kn: 'ಇಲ್ಲಿ ಅಪಘಾತ',
        ml: 'ഇവിടെ അപകടം',
        bn: 'এখানে দুর্ঘটনা',
    },
    stay_calm: {
        en: 'Stay calm',
        hi: 'शांत रहें',
        ta: 'அமைதியாக இருங்கள்',
        te: 'ప్రశాంతంగా ఉండండి',
        kn: 'ಶಾಂತವಾಗಿರಿ',
        ml: 'ശാന്തമായിരിക്കുക',
        bn: 'শান্ত থাকুন',
    },
    do_not_move: {
        en: 'Do not move the victim',
        hi: 'पीड़ित को न हिलाएं',
        ta: 'பாதிக்கப்பட்டவரை நகர்த்தாதீர்கள்',
        te: 'బాధితుడిని కదల్చకండి',
        kn: 'ಬಲಿಪಶುವನ್ನು ಸರಿಸಬೇಡಿ',
        ml: 'ഇരയെ ചലിപ്പിക്കരുത്',
        bn: 'ভুক্তভোগীকে নাড়াবেন না',
    },
    apply_pressure: {
        en: 'Apply pressure to stop bleeding',
        hi: 'खून बहना रोकने के लिए दबाव डालें',
        ta: 'இரத்தப்போக்கை நிறுத்த அழுத்தம் கொடுங்கள்',
        te: 'రక్తస్రావం ఆపడానికి ఒత్తిడి వేయండి',
        kn: 'ರಕ್ತಸ್ರಾವವನ್ನು ನಿಲ್ಲಿಸಲು ಒತ್ತಡ ಹಾಕಿ',
        ml: 'രക്തസ്രാവം നിർത്താൻ സമ്മർദ്ദം ചെലുത്തുക',
        bn: 'রক্তপাত বন্ধ করতে চাপ দিন',
    },
} as const;

/**
 * Language-to-voice mapping for TTS
 * Maps language codes to native TTS voice identifiers
 */
export const TTS_VOICE_MAPPING: Record<SupportedLanguageCode, string> = {
    en: 'en-US',
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    mr: 'mr-IN',
    bn: 'bn-IN',
    gu: 'gu-IN',
    pa: 'pa-IN',
    ur: 'ur-PK',
    or: 'en-IN', // Fallback - Odia TTS not widely available
    as: 'en-IN', // Fallback - Assamese TTS not widely available
    ne: 'ne-NP',
    si: 'si-LK',
    my: 'my-MM',
    th: 'th-TH',
    fr: 'fr-FR',
    ar: 'ar-SA',
    zh: 'zh-CN',
    es: 'es-ES',
    pt: 'pt-BR',
};

/**
 * Storage keys for caching
 */
export const MULTILINGUAL_STORAGE_KEYS = {
    TRANSLATION_CACHE: 'aether_translation_cache_v4',
    EMERGENCY_PHRASES_CACHE: 'aether_emergency_phrases_v1',
    LAST_USED_LANGUAGE: 'aether_last_language_v1',
    TTS_PREFERENCES: 'aether_tts_prefs_v1',
} as const;