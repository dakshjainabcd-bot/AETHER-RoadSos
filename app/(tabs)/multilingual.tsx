/**
 * Multilingual Test Screen — Phase 5 Testing Interface
 * 
 * This screen lets you test all Phase 5 features:
 * - Speech-to-Text
 * - Translation
 * - Text-to-Speech
 * - End-to-end workflows
 */

import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../_layout';
import { multilingualBridge, SupportedLanguageCode, EMERGENCY_PHRASES, translationService } from '../../services/MultilingualBridge';
import { Colors, BorderRadius, Shadows, Layout } from '../../theme';

export default function MultilingualScreen() {
    const { language } = useAppContext();

    // State
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [translation, setTranslation] = useState('');
    const [testText, setTestText] = useState('Call ambulance immediately');
    const [status, setStatus] = useState('Ready');

    // Initialize on mount
    useEffect(() => {
        initializeMultilingual();
    }, []);

    async function initializeMultilingual() {
        try {
            setStatus('Initializing...');
            await multilingualBridge.initialize(language);
            setStatus('✅ Ready');
        } catch (error) {
            setStatus('❌ Failed to initialize');
            console.error(error);
        }
    }

    // ══════════════════════════════════════════════════════════════
    // TEST FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    async function testVoiceRecording() {
        try {
            if (isRecording) {
                // Stop recording
                setStatus('Processing...');
                const result = await multilingualBridge.stopVoiceRecording();

                setTranscription(result.transcript);
                setStatus(`✅ Detected: ${result.language}`);
                setIsRecording(false);

                if (result.isTriggerPhrase) {
                    Alert.alert('Trigger Detected!', 'Voice SOS would activate');
                }
            } else {
                // Start recording
                setStatus('🎤 Recording...');
                await multilingualBridge.recordVoiceCommand();
                setIsRecording(true);
            }
        } catch (error) {
            setStatus('❌ Recording failed');
            setIsRecording(false);
            Alert.alert('Error', String(error));
        }
    }

    async function testTranslation() {
        try {
            setStatus('Translating...');
            const result = await multilingualBridge.translateText(
                testText,
                'en',
                language as SupportedLanguageCode
            );

            setTranslation(result.translatedText);
            setStatus(`✅ Translated (cached: ${result.cached})`);
        } catch (error) {
            setStatus('❌ Translation failed');
            Alert.alert('Error', String(error));
        }
    }

    async function testTextToSpeech() {
        try {
            setStatus('🔊 Speaking...');
            await multilingualBridge.speakText(
                translation || testText,
                language as SupportedLanguageCode,
                'normal'
            );
            setStatus('✅ Speech complete');
        } catch (error) {
            setStatus('❌ TTS failed');
            Alert.alert('Error', String(error));
        }
    }

    async function testEmergencyPhrase(phraseKey: keyof typeof EMERGENCY_PHRASES) {
        try {
            setStatus('🚨 Announcing...');
            await multilingualBridge.announceEmergencyPhrase(phraseKey);
            setStatus('✅ Announced');
        } catch (error) {
            setStatus('❌ Announcement failed');
            Alert.alert('Error', String(error));
        }
    }

    async function testEndToEnd() {
        try {
            setStatus('Testing end-to-end...');

            // 1. Translate English to Target Language
            const step1 = await multilingualBridge.translateText(
                testText,
                'en',
                language as SupportedLanguageCode
            );
            setTranslation(step1.translatedText);

            // 2. Speak the translation
            await multilingualBridge.speakText(step1.translatedText, language as SupportedLanguageCode, 'urgent');

            setStatus('✅ End-to-end test complete');
        } catch (error) {
            setStatus('❌ Test failed');
            Alert.alert('Error', String(error));
        }
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Multilingual Bridge</Text>
                <Text style={styles.subtitle}>Phase 5 Testing</Text>
            </View>

            {/* Status */}
            <View style={styles.statusCard}>
                <Text style={styles.statusText}>Status: {status}</Text>
                <Text style={[styles.statusText, { marginTop: 4, color: Colors.brand.primary }]}>
                    Current Language: {language.toUpperCase()}
                </Text>
            </View>

            {/* Section 1: Voice Recording */}
            <Text style={styles.sectionTitle}>Speech-to-Text</Text>
            <TouchableOpacity
                style={[styles.button, isRecording && styles.buttonRecording]}
                onPress={testVoiceRecording}
            >
                <Ionicons
                    name={isRecording ? 'stop-circle' : 'mic'}
                    size={24}
                    color="#FFF"
                />
                <Text style={styles.buttonText}>
                    {isRecording ? 'Stop Recording' : 'Start Voice Recording'}
                </Text>
            </TouchableOpacity>

            {transcription ? (
                <View style={styles.resultCard}>
                    <Text style={styles.resultLabel}>Transcription:</Text>
                    <Text style={styles.resultText}>{transcription}</Text>
                </View>
            ) : null}

            {/* Section 2: Translation */}
            <Text style={styles.sectionTitle}>Translation</Text>

            <TextInput
                style={styles.input}
                value={testText}
                onChangeText={setTestText}
                placeholder="Enter text to translate"
                multiline
            />

            <View style={styles.langRow}>
                <View style={styles.langButton}>
                    <Text style={styles.langText}>EN</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={Colors.label.secondary} />
                <View style={styles.langButton}>
                    <Text style={styles.langText}>{language.toUpperCase()}</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={testTranslation}>
                <Ionicons name="language" size={24} color="#FFF" />
                <Text style={styles.buttonText}>Translate</Text>
            </TouchableOpacity>

            {translation ? (
                <View style={styles.resultCard}>
                    <Text style={styles.resultLabel}>Translation:</Text>
                    <Text style={styles.resultText}>{translation}</Text>
                </View>
            ) : null}

            {/* Section 3: Text-to-Speech */}
            <Text style={styles.sectionTitle}>Text-to-Speech</Text>
            <TouchableOpacity style={styles.button} onPress={testTextToSpeech}>
                <Ionicons name="volume-high" size={24} color="#FFF" />
                <Text style={styles.buttonText}>Speak Translation</Text>
            </TouchableOpacity>

            {/* Section 4: Emergency Phrases */}
            <Text style={styles.sectionTitle}>Emergency Phrases (in {language.toUpperCase()})</Text>
            <View style={styles.phraseGrid}>
                <TouchableOpacity
                    style={styles.phraseButton}
                    onPress={() => testEmergencyPhrase('call_ambulance')}
                >
                    <Text style={styles.phraseText}>Call Ambulance</Text>
                    <Text style={styles.phraseTranslation}>
                        {translationService.getEmergencyPhrase('call_ambulance', language as SupportedLanguageCode)}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.phraseButton}
                    onPress={() => testEmergencyPhrase('help_needed')}
                >
                    <Text style={styles.phraseText}>Help Needed</Text>
                    <Text style={styles.phraseTranslation}>
                        {translationService.getEmergencyPhrase('help_needed', language as SupportedLanguageCode)}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.phraseButton}
                    onPress={() => testEmergencyPhrase('stay_calm')}
                >
                    <Text style={styles.phraseText}>Stay Calm</Text>
                    <Text style={styles.phraseTranslation}>
                        {translationService.getEmergencyPhrase('stay_calm', language as SupportedLanguageCode)}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.phraseButton}
                    onPress={() => testEmergencyPhrase('apply_pressure')}
                >
                    <Text style={styles.phraseText}>Stop Bleeding</Text>
                    <Text style={styles.phraseTranslation}>
                        {translationService.getEmergencyPhrase('apply_pressure', language as SupportedLanguageCode)}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Section 5: End-to-End Test */}
            <Text style={styles.sectionTitle}>Integration Test</Text>
            <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={testEndToEnd}>
                <Ionicons name="flash" size={24} color="#FFF" />
                <Text style={styles.buttonText}>Run End-to-End Test</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background.grouped,
    },
    content: {
        paddingTop: Layout.STATUS_BAR_HEIGHT + 4,
        paddingHorizontal: Layout.HORIZONTAL_PADDING,
        paddingBottom: Layout.CONTENT_BOTTOM_PADDING,
    },
    header: {
        marginBottom: 20,
    },
    title: {
        fontSize: 34,
        fontWeight: '700',
        color: Colors.label.primary,
        letterSpacing: -0.8,
    },
    subtitle: {
        fontSize: 15,
        color: Colors.label.secondary,
        marginTop: 4,
    },
    statusCard: {
        backgroundColor: Colors.background.elevated,
        borderRadius: BorderRadius.lg,
        padding: 16,
        marginBottom: 20,
        ...Shadows.sm,
    },
    statusText: {
        fontSize: 14,
        color: Colors.label.primary,
        textAlign: 'center',
        fontWeight: '500',
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.label.secondary,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginTop: 20,
        marginBottom: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: Colors.brand.accent,
        borderRadius: BorderRadius.xl,
        paddingVertical: 14,
        marginBottom: 12,
        ...Shadows.sm,
    },
    buttonRecording: {
        backgroundColor: Colors.brand.primary,
    },
    buttonPrimary: {
        backgroundColor: Colors.brand.primary,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
    },
    input: {
        backgroundColor: Colors.background.elevated,
        borderRadius: BorderRadius.lg,
        padding: 14,
        fontSize: 15,
        color: Colors.label.primary,
        marginBottom: 12,
        minHeight: 80,
        textAlignVertical: 'top',
        ...Shadows.xs,
    },
    langRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        marginBottom: 12,
    },
    langButton: {
        backgroundColor: Colors.background.elevated,
        borderRadius: BorderRadius.md,
        paddingHorizontal: 20,
        paddingVertical: 10,
        ...Shadows.xs,
    },
    langText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.brand.accent,
    },
    resultCard: {
        backgroundColor: Colors.background.elevated,
        borderRadius: BorderRadius.lg,
        padding: 14,
        marginBottom: 12,
        ...Shadows.xs,
    },
    resultLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.label.secondary,
        marginBottom: 6,
    },
    resultText: {
        fontSize: 15,
        color: Colors.label.primary,
        lineHeight: 22,
    },
    phraseGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    phraseButton: {
        backgroundColor: `${Colors.brand.gold}15`,
        borderRadius: BorderRadius.md,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: `${Colors.brand.gold}30`,
    },
    phraseText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.brand.gold,
    },
    phraseTranslation: {
        fontSize: 12,
        color: Colors.label.secondary,
        marginTop: 4,
    },
});