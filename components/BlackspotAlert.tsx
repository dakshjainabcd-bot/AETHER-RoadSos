/**
 * Phase 9 — BlackspotAlert Component
 *
 * A slim, non-intrusive banner that slides in from the top of the screen
 * when the driver is approaching a known danger zone.
 *
 * DESIGN DECISIONS:
 * - NOT a modal — modals block the screen which is dangerous while driving
 * - Slides in from top → visible on all screens without blocking content
 * - Auto-dismisses after 8 seconds (driver needs to focus on road)
 * - Haptic + beep to get attention without the driver looking at phone
 * - Color-coded: red = high, orange = medium, yellow = low severity
 *
 * WHERE IT RENDERS:
 * In _layout.tsx (root level), above all screens — same as CrashCountdown.
 * This means it appears regardless of which tab the user is on.
 */

import React, { useEffect, useRef } from 'react';
import {
    Animated,
    View,
    Text,
    StyleSheet,
    Vibration,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '../theme';
import type { BlackspotAlertState } from '../services/RoadDNA/types';

interface BlackspotAlertProps {
    alert: BlackspotAlertState | null;
    onDismiss: () => void;
}

const SEVERITY_CONFIG = {
    high: {
        color: Colors.brand.primary,  // Red
        bg: '#FF3B3010',
        border: '#FF3B3040',
        icon: 'warning' as const,
        label: 'HIGH RISK ZONE',
    },
    medium: {
        color: Colors.brand.gold,     // Orange
        bg: '#FF950010',
        border: '#FF950040',
        icon: 'alert-circle' as const,
        label: 'CAUTION ZONE',
    },
    low: {
        color: '#FFCC00',             // Yellow
        bg: '#FFCC0010',
        border: '#FFCC0040',
        icon: 'information-circle' as const,
        label: 'WATCH ZONE',
    },
};

export function BlackspotAlert({ alert, onDismiss }: BlackspotAlertProps) {
    const slideAnim = useRef(new Animated.Value(-120)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (alert) {
            // Slide in from top
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 60,
                    friction: 12,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();

            // Haptic alert — short double buzz
            Vibration.vibrate([0, 150, 100, 150]);

            // Auto-dismiss after 8 seconds
            autoDismissTimer.current = setTimeout(() => {
                dismiss();
            }, 8000);
        } else {
            // Slide out
            dismiss();
        }

        return () => {
            if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
        };
    }, [alert?.blackspot.id]);

    function dismiss() {
        if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -120,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => onDismiss());
    }

    if (!alert) return null;

    const { blackspot, distanceM } = alert;
    const config = SEVERITY_CONFIG[blackspot.severity];

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: config.bg,
                    borderColor: config.border,
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                },
            ]}
        >
            {/* Icon */}
            <View style={[styles.iconWrap, { backgroundColor: `${config.color}20` }]}>
                <Ionicons name={config.icon} size={22} color={config.color} />
            </View>

            {/* Text */}
            <View style={styles.textBlock}>
                <Text style={[styles.title, { color: config.color }]}>
                    ⚠ {config.label}
                </Text>
                <Text style={styles.subtitle}>
                    Hazardous road segment {distanceM}m ahead — slow down
                </Text>
                <Text style={styles.meta}>
                    {blackspot.event_count} events recorded · {blackspot.severity} severity
                </Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 54 : 32,
        left: 16,
        right: 16,
        zIndex: 9999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: BorderRadius.xl,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
    },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    textBlock: {
        flex: 1,
        gap: 2,
    },
    title: {
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 13,
        color: '#1A1A1A',
        fontWeight: '500',
        lineHeight: 18,
    },
    meta: {
        fontSize: 11,
        color: '#666',
        marginTop: 2,
    },
});