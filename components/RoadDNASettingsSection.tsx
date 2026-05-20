/**
 * Phase 9 — RoadDNASettingsSection
 *
 * Settings panel for the Road DNA feature.
 * Shows opt-in/out toggle, event count, upload controls, and debug tools.
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Switch,
    TouchableOpacity,
    Alert,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows } from '../theme';
import {
    getDrivingEventCount,
    drivingEventLogger,
    initDrivingEventsDB,
} from '../services/RoadDNA/DrivingEventLogger';
import { computeBlackspots, seedTestBlackspot } from '../services/RoadDNA/BlackspotEngine';
import { blackspotUploader } from '../services/RoadDNA/BlackspotUploader';
import { proximityAlertService } from '../services/RoadDNA/ProximityAlertService';
import { ROAD_DNA_STORAGE_KEYS } from '../services/RoadDNA/types';

export function RoadDNASettingsSection() {
    const [enabled, setEnabled] = useState(true);
    const [eventCount, setEventCount] = useState(0);
    const [lastUpload, setLastUpload] = useState<string>('Never');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadState();
    }, []);

    async function loadState() {
        const optOut = await AsyncStorage.getItem(ROAD_DNA_STORAGE_KEYS.OPT_OUT);
        setEnabled(optOut !== 'true');

        const count = await getDrivingEventCount();
        setEventCount(count);

        const lastTime = await blackspotUploader.getLastUploadTime();
        if (lastTime) {
            const date = new Date(lastTime);
            setLastUpload(date.toLocaleDateString() + ' ' + date.toLocaleTimeString());
        }
    }

    async function toggleEnabled(value: boolean) {
        setEnabled(value);
        await AsyncStorage.setItem(ROAD_DNA_STORAGE_KEYS.OPT_OUT, value ? 'false' : 'true');

        if (value) {
            await drivingEventLogger.start();
            console.log('[RoadDNA] User opted back in');
        } else {
            drivingEventLogger.stop();
            console.log('[RoadDNA] User opted out');
        }
    }

    async function handleSeedTestData() {
        setLoading(true);
        try {
            const loc = await Location.getLastKnownPositionAsync();
            const lat = loc?.coords.latitude ?? 13.0585;
            const lng = loc?.coords.longitude ?? 80.2596;

            await initDrivingEventsDB();
            await seedTestBlackspot(lat, lng);
            const spots = await computeBlackspots();
            await proximityAlertService.refreshBlackspots();

            const count = await getDrivingEventCount();
            setEventCount(count);

            Alert.alert(
                'Test Data Seeded',
                `25 test events seeded at your location.\n${spots.length} blackspot(s) computed.`,
                [{ text: 'OK' }]
            );
        } catch (err) {
            Alert.alert('Error', 'Failed to seed test data');
            console.error('[RoadDNA] Seed error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleUploadNow() {
        setLoading(true);
        try {
            const result = await blackspotUploader.triggerManualUpload();
            if (result.failed) {
                Alert.alert('Upload Failed', 'Could not reach the server. Will retry on WiFi.');
            } else if (result.uploaded === 0) {
                Alert.alert('Nothing to Upload', 'No pending events to upload.');
            } else {
                Alert.alert('Upload Complete', `${result.uploaded} events uploaded successfully.`);
                await loadState();
            }
        } catch (err) {
            Alert.alert('Error', 'Upload failed unexpectedly.');
        } finally {
            setLoading(false);
        }
    }

    async function handleRecompute() {
        setLoading(true);
        try {
            const spots = await computeBlackspots();
            await proximityAlertService.refreshBlackspots();
            Alert.alert('Recomputed', `${spots.length} blackspot(s) found from local data.`);
        } catch (err) {
            Alert.alert('Error', 'Recompute failed.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={s.section}>
            {/* Header */}
            <View style={s.headerRow}>
                <View style={s.iconWrap}>
                    <Ionicons name="warning" size={18} color="#CC0000" />
                </View>
                <Text style={s.headerTitle}>Road DNA — Danger Zones</Text>
            </View>
            <Text style={s.headerDesc}>
                Anonymously detect dangerous road segments to warn other drivers.
            </Text>

            {/* Toggle */}
            <View style={s.row}>
                <View style={s.rowLeft}>
                    <Text style={s.rowLabel}>Contribute Road Data</Text>
                    <Text style={s.rowHint}>No personal data is collected</Text>
                </View>
                <Switch
                    value={enabled}
                    onValueChange={toggleEnabled}
                    trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                />
            </View>

            {/* Stats */}
            <View style={s.statsRow}>
                <View style={s.stat}>
                    <Text style={s.statValue}>{eventCount}</Text>
                    <Text style={s.statLabel}>Events Logged</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.stat}>
                    <Text style={s.statValue}>{lastUpload}</Text>
                    <Text style={s.statLabel}>Last Upload</Text>
                </View>
            </View>

            {/* Actions */}
            <View style={s.actions}>
                <TouchableOpacity
                    style={[s.actionBtn, s.actionPrimary]}
                    onPress={handleRecompute}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    <Ionicons name="refresh" size={15} color="#CC0000" />
                    <Text style={s.actionPrimaryText}>Recompute Map</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[s.actionBtn, s.actionSecondary]}
                    onPress={handleUploadNow}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    <Ionicons name="cloud-upload-outline" size={15} color={Colors.label.secondary} />
                    <Text style={s.actionSecondaryText}>Upload Now</Text>
                </TouchableOpacity>
            </View>

            {/* Debug: Seed test data */}
            <TouchableOpacity
                style={s.seedBtn}
                onPress={handleSeedTestData}
                disabled={loading}
                activeOpacity={0.8}
            >
                <Ionicons name="flask-outline" size={14} color={Colors.label.tertiary} />
                <Text style={s.seedText}>Seed Test Data (Debug)</Text>
            </TouchableOpacity>
        </View>
    );
}

const s = StyleSheet.create({
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: BorderRadius.xl,
        padding: 18,
        marginBottom: 16,
        ...Shadows.sm,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
    },
    iconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#CC000010',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.label.primary,
    },
    headerDesc: {
        fontSize: 12,
        color: Colors.label.tertiary,
        marginBottom: 16,
        marginLeft: 42,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderTopWidth: 0.5,
        borderTopColor: Colors.border.subtle,
    },
    rowLeft: {
        flex: 1,
    },
    rowLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.label.primary,
    },
    rowHint: {
        fontSize: 12,
        color: Colors.label.tertiary,
        marginTop: 2,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background.grouped,
        borderRadius: BorderRadius.lg,
        padding: 14,
        marginTop: 12,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 0.5,
        height: 28,
        backgroundColor: Colors.border.subtle,
    },
    statValue: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.label.primary,
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 11,
        color: Colors.label.tertiary,
        fontWeight: '500',
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 11,
        borderRadius: BorderRadius.lg,
    },
    actionPrimary: {
        backgroundColor: '#CC000010',
        borderWidth: 1,
        borderColor: '#CC000025',
    },
    actionPrimaryText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#CC0000',
    },
    actionSecondary: {
        backgroundColor: Colors.background.grouped,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    actionSecondaryText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.label.secondary,
    },
    seedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        paddingVertical: 8,
    },
    seedText: {
        fontSize: 12,
        color: Colors.label.tertiary,
        fontWeight: '500',
    },
});
