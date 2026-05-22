/**
 * DTNStatusBadge — Visual indicator for the DTN buffer state
 *
 * Shows one of three states:
 *   ● IDLE     (green)  — no buffered packets, normal operation
 *   ● CARRYING (amber)  — carrying N buffered packets, waiting for relay
 *
 * This component subscribes to DTN events and updates itself automatically.
 * Use it in the SOS screen to show the user their phone is storing packets.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dtnManager } from '../services/MeshRelay/DTNManager';
import { DTNState } from '../services/MeshRelay/types';
import { Colors, BorderRadius } from '../theme';

export function DTNStatusBadge() {
    const [dtnState, setDtnState] = useState<DTNState>(dtnManager.currentState);
    const [bufferSize, setBufferSize] = useState(dtnManager.bufferSize);

    useEffect(() => {
        // Subscribe to DTN events so this badge updates in real time
        const unsubscribe = dtnManager.on((event) => {
            setDtnState(dtnManager.currentState);
            setBufferSize(dtnManager.bufferSize);
        });

        // Set initial values
        setDtnState(dtnManager.currentState);
        setBufferSize(dtnManager.bufferSize);

        return () => unsubscribe();
    }, []);

    // Don't show the badge at all when idle and no packets
    if (dtnState === 'IDLE' && bufferSize === 0) return null;

    const isCarrying = dtnState === 'CARRYING_SOS' && bufferSize > 0;

    const config = isCarrying
        ? {
            icon: 'archive' as const,
            color: Colors.status.warning,        // Amber
            bg: `${Colors.status.warning}15`,
            border: `${Colors.status.warning}40`,
            text: `DTN: ${bufferSize} queued`,
        }
        : {
            icon: 'checkmark-circle' as const,
            color: Colors.status.success,         // Green
            bg: `${Colors.status.success}15`,
            border: `${Colors.status.success}40`,
            text: 'DTN: Idle',
        };

    return (
        <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
            <Ionicons name={config.icon} size={11} color={config.color} />
            <Text style={[styles.text, { color: config.color }]}>
                {config.text}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
    },
    text: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});