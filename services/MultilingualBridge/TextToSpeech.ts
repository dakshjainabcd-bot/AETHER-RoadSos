/**
 * TextToSpeech — Voice Output in 22+ Languages (Expo Go Compatible)
 */

import * as Speech from 'expo-speech';
import { TTSRequest, SupportedLanguageCode, TTS_VOICE_MAPPING } from './Types';

interface SpeechQueueItem {
    request: TTSRequest;
    id: string;
}

class TextToSpeechService {
    private queue: SpeechQueueItem[] = [];
    private isSpeaking = false;
    private isInitialized = false;
    private availableVoices: Speech.Voice[] = [];

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            console.log('[TTS] Initializing...');
            const voices = await Speech.getAvailableVoicesAsync();
            this.availableVoices = voices;
            console.log('[TTS] Available voices:', this.availableVoices.length);
            this.isInitialized = true;
            console.log('[TTS] ✅ Initialized');
        } catch (error) {
            console.error('[TTS] Initialization failed:', error);
            this.isInitialized = true;
        }
    }

    async speak(request: TTSRequest): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const queueItem: SpeechQueueItem = {
            request,
            id: `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };

        this.addToQueue(queueItem);

        if (!this.isSpeaking) {
            this.processQueue();
        }
    }

    async stop(): Promise<void> {
        try {
            await Speech.stop();
            this.queue = [];
            this.isSpeaking = false;
            console.log('[TTS] Stopped and cleared queue');
        } catch (error) {
            console.error('[TTS] Failed to stop:', error);
        }
    }

    async pause(): Promise<void> {
        try {
            await Speech.stop();
            console.log('[TTS] Paused (Stopped in Expo Speech)');
        } catch (error) {
            console.error('[TTS] Failed to pause:', error);
        }
    }

    getSpeakingStatus(): boolean {
        return this.isSpeaking;
    }

    getQueueLength(): number {
        return this.queue.length;
    }

    private addToQueue(item: SpeechQueueItem): void {
        const priority = item.request.priority;

        if (priority === 'urgent') {
            this.queue.unshift(item);
        } else if (priority === 'high') {
            const firstNonUrgentIndex = this.queue.findIndex(
                (i) => i.request.priority !== 'urgent'
            );
            if (firstNonUrgentIndex === -1) {
                this.queue.push(item);
            } else {
                this.queue.splice(firstNonUrgentIndex, 0, item);
            }
        } else {
            this.queue.push(item);
        }
    }

    private async processQueue(): Promise<void> {
        if (this.queue.length === 0) return;
        if (this.isSpeaking) return;

        const item = this.queue.shift();
        if (!item) return;

        try {
            await this.speakNow(item.request);
        } catch (error) {
            console.error('[TTS] Failed to speak:', error);
            this.isSpeaking = false;
            this.processQueue();
        }
    }

    private async speakNow(request: TTSRequest): Promise<void> {
        const { text, language, rate, pitch } = request;
        console.log('[TTS] Speaking:', text.substring(0, 50) + '...');

        try {
            this.isSpeaking = true;
            const voiceId = this.getVoiceForLanguage(language);

            Speech.speak(text, {
                language: voiceId || undefined,
                rate: rate || 0.5,
                pitch: pitch || 1.0,
                onDone: () => {
                    this.isSpeaking = false;
                    this.processQueue();
                },
                onStopped: () => {
                    this.isSpeaking = false;
                    this.processQueue();
                },
                onError: (e) => {
                    console.error('[TTS] Error:', e);
                    this.isSpeaking = false;
                    this.processQueue();
                }
            });

        } catch (error) {
            console.error('[TTS] Speech failed:', error);
            this.isSpeaking = false;
            this.processQueue();
        }
    }

    private getVoiceForLanguage(language: SupportedLanguageCode): string | null {
        const preferredVoice = TTS_VOICE_MAPPING[language];
        if (this.availableVoices.some(v => v.identifier === preferredVoice)) {
            return preferredVoice;
        }

        const langCode = language.split('-')[0];
        const matchingVoice = this.availableVoices.find((v) => v.language.startsWith(langCode));

        if (matchingVoice) {
            return matchingVoice.language;
        }

        console.warn(`[TTS] No voice found for ${language}, using English`);
        return 'en-US';
    }

    async shutdown(): Promise<void> {
        await this.stop();
        this.isInitialized = false;
        console.log('[TTS] Shutdown complete');
    }
}

export const textToSpeech = new TextToSpeechService();