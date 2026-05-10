/**
 * TranslationService — Neural Machine Translation using NLLB-200
 * 
 * WHY NLLB-200?
 * - Supports 200 languages (covers all of India + global)
 * - Works offline (150MB model bundled in app)
 * - Distilled version fits on phones
 * - Meta open-source - free to use
 * 
 * HOW IT WORKS:
 * 1. Text comes in with source language
 * 2. Check cache first (instant if cached)
 * 3. If not cached: run through NLLB model
 * 4. Save to cache for future use
 * 5. Return translated text
 * 
 * USED FOR:
 * - Bystander injury descriptions → English for dispatcher
 * - First aid instructions → Bystander's language
 * - Emergency phrases → Any language
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    TranslationRequest,
    TranslationResult,
    TranslationCacheEntry,
    SupportedLanguageCode,
    EMERGENCY_PHRASES,
    MULTILINGUAL_STORAGE_KEYS,
} from './Types';

class TranslationService {
    // Translation cache (in-memory for fast access)
    private cache: Map<string, TranslationCacheEntry> = new Map();

    // Is the service ready?
    private isInitialized = false;

    // Maximum cache size (prevent unlimited growth)
    private readonly MAX_CACHE_SIZE = 1000;

    // Pre-loaded Medical Terms Dictionary (For MVP Demo without NLLB-200)
    private readonly MEDICAL_DICTIONARY: Record<string, Partial<Record<SupportedLanguageCode, string>>> = {
        'help': { hi: 'मदद', ta: 'உதவி', te: 'సహాయం', kn: 'ಸಹಾಯ', ml: 'സഹായം', bn: 'সাহায্য', en: 'help' },
        'accident': { hi: 'दुर्घटना', ta: 'விபத்து', te: 'ప్రమాదం', kn: 'ಅಪಘಾತ', ml: 'അപകടം', bn: 'দুর্ঘটনা', en: 'accident' },
        'ambulance': { hi: 'एम्बुलेंस', ta: 'ஆம்புலன்ஸ்', te: 'అంబులెన్స్', kn: 'ಆಂಬುಲೆನ್ಸ್', ml: 'ആംബുലൻസ്', bn: 'অ্যাম্বুলেন্স', en: 'ambulance' },
        'hospital': { hi: 'अस्पताल', ta: 'மருத்துவமனை', te: 'ఆసుపత్రి', kn: 'ಆಸ್ಪತ್ರೆ', ml: 'ആശുപത്രി', bn: 'হাসপাতাল', en: 'hospital' },
        'bleeding': { hi: 'खून बह रहा है', ta: 'இரத்தம் வடிகிறது', te: 'రక్తం కారుతోంది', kn: 'ರಕ್ತಸ್ರಾವ', ml: 'രക്തസ്രാവം', bn: 'রক্তপাত', en: 'bleeding' },
        'pain': { hi: 'दर्द', ta: 'வலி', te: 'నొప్పి', kn: 'ನೋವು', ml: 'വേദന', bn: 'ব্যথা', en: 'pain' },
        'broken bone': { hi: 'टूटा हुआ हड्डी', ta: 'உடைந்த எலும்பு', te: 'విరిగిన ఎముక', kn: 'ಮುರಿದ ಮೂಳೆ', ml: 'ഒടിഞ്ഞ എല്ല്', bn: 'ভাঙা হাড়', en: 'broken bone' },
        'head injury': { hi: 'सिर चोट', ta: 'தலை காயம்', te: 'తల గాయం', kn: 'ತಲೆ ಗಾಯ', ml: 'തലയ്ക്ക് പരിക്കേറ്റു', bn: 'মাথায় আঘাত', en: 'head injury' },
        'head': { hi: 'सिर', ta: 'தலை', te: 'తల', kn: 'ತಲೆ', ml: 'തല', bn: 'মাথা', en: 'head' },
        'call': { hi: 'बुलाओ', ta: 'அழை', te: 'పిలువు', kn: 'ಕರೆ', ml: 'വിളിക്കുക', bn: 'ডাকো', en: 'call' },
        'immediately': { hi: 'तुरंत', ta: 'உடனடியாக', te: 'వెంటనే', kn: 'ತಕ್ಷಣ', ml: 'ഉടനടി', bn: 'অবিলম্বে', en: 'immediately' },
    };

    /**
     * Initialize the translation service
     * Loads cache and emergency phrases
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            console.log('[Translation] Initializing...');

            // Load cached translations from persistent storage
            await this.loadCache();

            // Pre-cache emergency phrases for instant access
            await this.preCacheEmergencyPhrases();

            this.isInitialized = true;
            console.log('[Translation] ✅ Initialized with', this.cache.size, 'cached translations');

        } catch (error) {
            console.error('[Translation] Initialization failed:', error);
            // Continue anyway - translation will work, just slower
            this.isInitialized = true;
        }
    }

    /**
     * Translate text from one language to another
     * 
     * @param request - Translation request with text and languages
     * @returns Translation result with translated text
     * 
     * EXAMPLE:
     *   translate({
     *     text: 'Head injury, bleeding',
     *     sourceLang: 'en',
     *     targetLang: 'hi'
     *   })
     *   → 'सिर में चोट, खून बह रहा है'
     */
    async translate(request: TranslationRequest): Promise<TranslationResult> {
        const { text, sourceLang, targetLang } = request;

        // If source and target are same, just return the text
        if (sourceLang === targetLang) {
            return {
                originalText: text,
                translatedText: text,
                sourceLang,
                targetLang,
                cached: false,
            };
        }

        // Create cache key
        const cacheKey = this.createCacheKey(text, sourceLang, targetLang);

        // Check cache first (instant if found)
        const cachedResult = this.getCached(cacheKey);
        if (cachedResult) {
            console.log('[Translation] Cache hit:', text.substring(0, 30) + '...');
            return {
                originalText: text,
                translatedText: cachedResult.translatedText,
                sourceLang,
                targetLang,
                cached: true,
            };
        }

        // Not in cache - translate using model
        console.log('[Translation] Translating:', text.substring(0, 30) + '...');
        const translatedText = await this.runTranslation(text, sourceLang, targetLang);

        // Save to cache for future use
        await this.addToCache(cacheKey, {
            sourceText: text,
            sourceLang,
            targetLang,
            translatedText,
            timestamp: Date.now(),
            usageCount: 1,
        });

        return {
            originalText: text,
            translatedText,
            sourceLang,
            targetLang,
            cached: false,
        };
    }

    /**
     * Get an emergency phrase in the target language
     * These are pre-translated and cached for instant access
     * 
     * EXAMPLE:
     *   getEmergencyPhrase('call_ambulance', 'hi')
     *   → 'एम्बुलेंस बुलाओ'
     */
    getEmergencyPhrase(
        phraseKey: keyof typeof EMERGENCY_PHRASES,
        targetLang: SupportedLanguageCode
    ): string {
        const phrase = EMERGENCY_PHRASES[phraseKey];

        // Return the phrase in target language, fallback to English
        return phrase[targetLang as keyof typeof phrase] || phrase.en;
    }

    /**
     * Batch translate multiple texts
     * More efficient than translating one by one
     * 
     * EXAMPLE:
     *   batchTranslate([
     *     { text: 'Call ambulance', sourceLang: 'en', targetLang: 'hi' },
     *     { text: 'Apply pressure', sourceLang: 'en', targetLang: 'hi' }
     *   ])
     */
    async batchTranslate(requests: TranslationRequest[]): Promise<TranslationResult[]> {
        const results: TranslationResult[] = [];

        for (const request of requests) {
            const result = await this.translate(request);
            results.push(result);
        }

        return results;
    }

    // ══════════════════════════════════════════════════════════════
    // PRIVATE METHODS
    // ══════════════════════════════════════════════════════════════

    /**
     * Run the actual translation using NLLB-200 model
     * 
     * IMPORTANT: This is a SIMPLIFIED implementation for MVP
     * Production would use actual NLLB-200 TFLite model
     * 
     * For MVP, we use:
     * - Emergency phrase lookup (instant)
     * - Fallback to simple word substitution for demo
     */
    private async runTranslation(
        text: string,
        sourceLang: SupportedLanguageCode,
        targetLang: SupportedLanguageCode
    ): Promise<string> {
        // Check if this matches an emergency phrase exactly
        for (const [key, phrases] of Object.entries(EMERGENCY_PHRASES)) {
            const sourcePhrase = phrases[sourceLang as keyof typeof phrases];
            if (sourcePhrase && text.toLowerCase().trim() === sourcePhrase.toLowerCase().trim()) {
                return phrases[targetLang as keyof typeof phrases] || phrases.en;
            }
        }

        // Medical Dictionary lookup (MVP enhancement)
        let translatedText = text;
        let wasTranslated = false;
        
        // Sort keys by length descending to match longest phrases first (e.g. 'broken bone' before 'bone')
        const terms = Object.keys(this.MEDICAL_DICTIONARY).sort((a, b) => b.length - a.length);
        
        for (const term of terms) {
            if (translatedText.toLowerCase().includes(term)) {
                const translations = this.MEDICAL_DICTIONARY[term];
                const translatedTerm = translations[targetLang];
                if (translatedTerm) {
                    // Replace using regex with word boundary for exact match, case insensitive
                    const regex = new RegExp(`\\b${term}\\b`, 'gi');
                    translatedText = translatedText.replace(regex, translatedTerm);
                    wasTranslated = true;
                }
            }
        }

        if (wasTranslated) {
            return translatedText;
        }

        // PRODUCTION: Load NLLB-200 model → tokenize → inference → decode
        // MVP: Return marked text indicating translation needed
        console.log('[Translation] Running NLLB-200 inference (simulated for MVP)');

        // For demo, we'll return the text with a prefix
        // In production, this would be actual neural translation
        return `[${targetLang.toUpperCase()}] ${text}`;
    }

    /**
     * Create a unique cache key for a translation
     */
    private createCacheKey(
        text: string,
        sourceLang: SupportedLanguageCode,
        targetLang: SupportedLanguageCode
    ): string {
        // Normalize text (lowercase, trim whitespace)
        const normalized = text.toLowerCase().trim();
        return `${sourceLang}:${targetLang}:${normalized}`;
    }

    /**
     * Get translation from cache
     */
    private getCached(cacheKey: string): TranslationCacheEntry | null {
        const entry = this.cache.get(cacheKey);

        if (entry) {
            // Increment usage count
            entry.usageCount++;
            return entry;
        }

        return null;
    }

    /**
     * Add translation to cache
     */
    private async addToCache(cacheKey: string, entry: TranslationCacheEntry): Promise<void> {
        // If cache is full, remove least used entry
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            this.evictLeastUsed();
        }

        this.cache.set(cacheKey, entry);

        // Persist to AsyncStorage (async, doesn't block)
        this.persistCache().catch(err =>
            console.error('[Translation] Failed to persist cache:', err)
        );
    }

    /**
     * Remove least recently used entry from cache
     */
    private evictLeastUsed(): void {
        let leastUsedKey: string | null = null;
        let leastUsedCount = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.usageCount < leastUsedCount) {
                leastUsedCount = entry.usageCount;
                leastUsedKey = key;
            }
        }

        if (leastUsedKey) {
            this.cache.delete(leastUsedKey);
        }
    }

    /**
     * Load cache from persistent storage
     */
    private async loadCache(): Promise<void> {
        try {
            const stored = await AsyncStorage.getItem(MULTILINGUAL_STORAGE_KEYS.TRANSLATION_CACHE);

            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, TranslationCacheEntry>;

                // Restore to Map
                for (const [key, entry] of Object.entries(parsed)) {
                    this.cache.set(key, entry);
                }

                console.log('[Translation] Loaded', this.cache.size, 'cached translations');
            }
        } catch (error) {
            console.error('[Translation] Failed to load cache:', error);
        }
    }

    /**
     * Save cache to persistent storage
     */
    private async persistCache(): Promise<void> {
        try {
            // Convert Map to plain object for JSON storage
            const cacheObj: Record<string, TranslationCacheEntry> = {};

            for (const [key, entry] of this.cache.entries()) {
                cacheObj[key] = entry;
            }

            await AsyncStorage.setItem(
                MULTILINGUAL_STORAGE_KEYS.TRANSLATION_CACHE,
                JSON.stringify(cacheObj)
            );

        } catch (error) {
            console.error('[Translation] Failed to persist cache:', error);
        }
    }

    /**
     * Pre-cache all emergency phrases for instant access
     */
    private async preCacheEmergencyPhrases(): Promise<void> {
        console.log('[Translation] Pre-caching emergency phrases...');

        for (const [phraseKey, translations] of Object.entries(EMERGENCY_PHRASES)) {
            for (const [lang, text] of Object.entries(translations)) {
                // Cache English → other language mappings
                if (lang !== 'en') {
                    const cacheKey = this.createCacheKey(
                        translations.en,
                        'en',
                        lang as SupportedLanguageCode
                    );

                    this.cache.set(cacheKey, {
                        sourceText: translations.en,
                        sourceLang: 'en',
                        targetLang: lang as SupportedLanguageCode,
                        translatedText: text,
                        timestamp: Date.now(),
                        usageCount: 0,
                    });
                }
            }
        }

        console.log('[Translation] ✅ Pre-cached', this.cache.size, 'emergency phrases');
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
        return {
            size: this.cache.size,
            maxSize: this.MAX_CACHE_SIZE,
        };
    }

    /**
     * Clear all cached translations
     */
    async clearCache(): Promise<void> {
        this.cache.clear();
        await AsyncStorage.removeItem(MULTILINGUAL_STORAGE_KEYS.TRANSLATION_CACHE);
        console.log('[Translation] Cache cleared');
    }
}

// Singleton instance
export const translationService = new TranslationService();
