/**
 * Phase 7: Black Box System - Test UI
 * 
 * This screen provides a test interface for the Black Box system.
 * Use this to verify all components are working correctly.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { getBlackBoxManager, BlackBoxState } from '@/services/BlackBox';

export default function BlackBoxScreen() {
    const [blackBox] = useState(() => getBlackBoxManager());
    const [state, setState] = useState<BlackBoxState>({
        isRecording: false,
        bufferSize: 0,
        crashDetected: false,
    });
    const [initialized, setInitialized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    // Initialize black box on mount
    useEffect(() => {
        // Don't auto-initialize - let user manually tap the button
        // This prevents blocking the UI thread
        addLog('Black Box ready. Tap "Initialize System" to begin.');
    }, []);

    // Subscribe to state changes
useEffect(() => {
  blackBox.onStateChange((newState) => {
    setState(newState);
  });

  // Also poll state every 2 seconds as backup
  const intervalId = setInterval(() => {
    setState(blackBox.getState());
  }, 2000);

  return () => clearInterval(intervalId);
}, []);
    const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 20));
    };

    const initializeBlackBox = async () => {
        try {
            setLoading(true);
            addLog('Initializing Black Box system...');

            const success = await blackBox.initialize();

            if (success) {
                setInitialized(true);
                addLog('✅ Black Box initialized successfully');
                setState(blackBox.getState());
            } else {
                addLog('❌ Initialization failed');
                Alert.alert('Error', 'Failed to initialize Black Box system');
            }
        } catch (error) {
            addLog(`❌ Error: ${error}`);
            Alert.alert('Error', String(error));
        } finally {
            setLoading(false);
        }
    };

    const handleStartRecording = async () => {
        try {
            setLoading(true);
            addLog('Starting sensor recording...');
            await blackBox.startRecording();
            addLog('✅ Recording started');
        } catch (error) {
            addLog(`❌ Error: ${error}`);
            Alert.alert('Error', String(error));
        } finally {
            setLoading(false);
        }
    };

    const handleStopRecording = () => {
        addLog('Stopping recording...');
        blackBox.stopRecording();
        addLog('✅ Recording stopped');
    };

    const handleSimulateCrash = async () => {
        if (!state.isRecording) {
            Alert.alert('Error', 'Start recording first!');
            return;
        }

        Alert.alert(
            'Simulate Crash',
            'This will freeze the buffer and create an evidence package.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Simulate',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            addLog('🚨 Simulating crash...');

                            const incidentId = await blackBox.onCrashDetected(
                                7, // Severity 7/10
                                { latitude: 28.8955, longitude: 76.6066 } // Rohtak
                            );

                            addLog(`✅ Crash detected! Incident: ${incidentId}`);
                            Alert.alert('Crash Detected', `Incident ID: ${incidentId.substring(0, 20)}...`);
                        } catch (error) {
                            addLog(`❌ Error: ${error}`);
                            Alert.alert('Error', String(error));
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleTestSystems = async () => {
        try {
            setLoading(true);
            addLog('🧪 Testing all systems...');

            const results = await blackBox.testSystems();

            const passedTests = Object.entries(results)
                .filter(([_, passed]) => passed)
                .map(([name]) => name);
            const failedTests = Object.entries(results)
                .filter(([_, passed]) => !passed)
                .map(([name]) => name);

            addLog(`✅ Passed: ${passedTests.join(', ')}`);
            if (failedTests.length > 0) {
                addLog(`❌ Failed: ${failedTests.join(', ')}`);
            }

            Alert.alert(
                'System Test Results',
                `Passed: ${passedTests.length}/${Object.keys(results).length}\n\n` +
                `✅ ${passedTests.join('\n✅ ')}\n\n` +
                (failedTests.length > 0 ? `❌ ${failedTests.join('\n❌ ')}` : '')
            );
        } catch (error) {
            addLog(`❌ Error: ${error}`);
            Alert.alert('Error', String(error));
        } finally {
            setLoading(false);
        }
    };

    const handleFinalizeEvidence = async () => {
        if (!state.crashDetected) {
            Alert.alert('Error', 'No crash detected yet!');
            return;
        }

        try {
            setLoading(true);
            addLog('📋 Finalizing evidence package...');

            const evidence = await blackBox.finalizeEvidence();

            if (evidence) {
                addLog('✅ Evidence finalized');
                addLog(`Witnesses: ${evidence.witnessContributions.length}`);
                addLog(`Cloud URL: ${evidence.cloudUrl || 'Pending'}`);

                Alert.alert(
                    'Evidence Finalized',
                    `Incident: ${evidence.incidentId}\n` +
                    `Witnesses: ${evidence.witnessContributions.length}\n` +
                    `Uploaded: ${evidence.uploadedToCloud ? 'Yes' : 'No'}`
                );
            } else {
                addLog('❌ Evidence finalization failed');
            }
        } catch (error) {
            addLog(`❌ Error: ${error}`);
            Alert.alert('Error', String(error));
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateLegalNotice = async () => {
        try {
            setLoading(true);
            addLog('⚖️ Generating legal notice...');

            const notice = await blackBox.generateLegalNotice(
                'Accident caused by pothole on road. Vehicle lost control due to poor road conditions.'
            );

            if (notice) {
                addLog('✅ Legal notice generated');
                Alert.alert(
                    'Legal Notice Generated',
                    'Notice prepared for road authority.\n\nCheck console logs for full text.',
                    [{ text: 'OK' }]
                );
                console.log('=== LEGAL NOTICE ===');
                console.log(notice);
                console.log('===================');
            }
        } catch (error) {
            addLog(`❌ Error: ${error}`);
            Alert.alert('Error', String(error));
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        Alert.alert('Reset System', 'This will delete all data. Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Reset',
                style: 'destructive',
                onPress: async () => {
                    await blackBox.reset();
                    addLog('🔄 System reset');
                    setState(blackBox.getState());
                },
            },
        ]);
    };

    const bufferSeconds = (state.bufferSize / 10).toFixed(1);
    const bufferPercent = (state.bufferSize / 900) * 100;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Black Box System</Text>
                <Text style={styles.subtitle}>Phase 7 Test Interface</Text>
            </View>

            {/* Status Card */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>System Status</Text>
                <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Initialized:</Text>
                    <Text style={[styles.statusValue, initialized && styles.statusActive]}>
                        {initialized ? '✅ YES' : '❌ NO'}
                    </Text>
                </View>
                <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Recording:</Text>
                    <Text style={[styles.statusValue, state.isRecording && styles.statusActive]}>
                        {state.isRecording ? '🔴 ACTIVE' : '⚪ STOPPED'}
                    </Text>
                </View>
                <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Buffer:</Text>
                    <Text style={styles.statusValue}>
                        {state.bufferSize} readings ({bufferSeconds}s / 90s)
                    </Text>
                </View>
                {state.bufferSize > 0 && (
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, bufferPercent)}%` }]} />
                    </View>
                )}
                <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Crash Detected:</Text>
                    <Text style={[styles.statusValue, state.crashDetected && styles.statusDanger]}>
                        {state.crashDetected ? '🚨 YES' : 'NO'}
                    </Text>
                </View>
                {state.deviceKeys && (
                    <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Device ID:</Text>
                        <Text style={styles.statusValueSmall}>
                            {state.deviceKeys.deviceId.substring(0, 16)}...
                        </Text>
                    </View>
                )}
            </View>

            {/* Control Buttons */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Controls</Text>

                {!initialized ? (
                    <TouchableOpacity
                        style={[styles.button, styles.buttonPrimary]}
                        onPress={initializeBlackBox}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>
                            {loading ? 'Initializing...' : 'Initialize System'}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        {!state.isRecording ? (
                            <TouchableOpacity
                                style={[styles.button, styles.buttonSuccess]}
                                onPress={handleStartRecording}
                                disabled={loading}
                            >
                                <Text style={styles.buttonText}>▶️ Start Recording</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.button, styles.buttonDanger]}
                                onPress={handleStopRecording}
                                disabled={loading}
                            >
                                <Text style={styles.buttonText}>⏹️ Stop Recording</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.button, styles.buttonWarning]}
                            onPress={handleSimulateCrash}
                            disabled={loading || !state.isRecording}
                        >
                            <Text style={styles.buttonText}>🚨 Simulate Crash</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.buttonSecondary]}
                            onPress={handleTestSystems}
                            disabled={loading}
                        >
                            <Text style={styles.buttonText}>🧪 Test All Systems</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {/* Evidence Controls (only show if crash detected) */}
            {state.crashDetected && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Evidence Management</Text>

                    <TouchableOpacity
                        style={[styles.button, styles.buttonPrimary]}
                        onPress={handleFinalizeEvidence}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>📦 Finalize Evidence Package</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.buttonSecondary]}
                        onPress={handleGenerateLegalNotice}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>⚖️ Generate Legal Notice</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.buttonDanger]}
                        onPress={handleReset}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>🔄 Reset System</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Activity Log */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Activity Log</Text>
                {logs.length === 0 ? (
                    <Text style={styles.logEmpty}>No activity yet...</Text>
                ) : (
                    logs.map((log, index) => (
                        <Text key={index} style={styles.logEntry}>
                            {log}
                        </Text>
                    ))
                )}
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Processing...</Text>
                </View>
            )}

            <View style={{ height: 50 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        padding: 20,
        backgroundColor: '#007AFF',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
    },
    subtitle: {
        fontSize: 14,
        color: '#FFF',
        opacity: 0.9,
        marginTop: 4,
    },
    card: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        marginTop: 16,
        padding: 16,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
        color: '#333',
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    statusLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    statusValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '600',
    },
    statusValueSmall: {
        fontSize: 12,
        color: '#333',
        fontWeight: '600',
    },
    statusActive: {
        color: '#34C759',
    },
    statusDanger: {
        color: '#FF3B30',
    },
    progressBar: {
        height: 8,
        backgroundColor: '#E0E0E0',
        borderRadius: 4,
        marginVertical: 12,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 4,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginVertical: 6,
        alignItems: 'center',
    },
    buttonPrimary: {
        backgroundColor: '#007AFF',
    },
    buttonSuccess: {
        backgroundColor: '#34C759',
    },
    buttonDanger: {
        backgroundColor: '#FF3B30',
    },
    buttonWarning: {
        backgroundColor: '#FF9500',
    },
    buttonSecondary: {
        backgroundColor: '#8E8E93',
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    logEntry: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'monospace',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    logEmpty: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        textAlign: 'center',
        padding: 20,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFF',
        marginTop: 12,
        fontSize: 16,
        fontWeight: '600',
    },
});