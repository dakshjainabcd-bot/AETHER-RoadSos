/**
 * Phase 9 — BlackspotMapLayer
 *
 * Renders danger zones as colored circles on the existing react-native-maps
 * MapView in app/(tabs)/map.tsx.
 *
 * WHY CIRCLES (not custom markers)?
 * A circle represents the 50m grid cell that events were aggregated into.
 * The radius visually communicates "this road SEGMENT is dangerous" —
 * not just a single point. Circles are also cleaner at highway zoom levels.
 *
 * COLOR CODING (matches BlackspotAlert component):
 *   Red    = high severity (>50 events)
 *   Orange = medium severity (11-50 events)
 *   Yellow = low severity (5-10 events)
 *
 * USAGE in map.tsx:
 *   import { BlackspotMapLayer } from '../../components/BlackspotMapLayer';
 *   // Inside MapView:
 *   <BlackspotMapLayer blackspots={blackspots} />
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Circle, Marker, Callout } from 'react-native-maps';
import type { Blackspot } from '../services/RoadDNA/types';

interface BlackspotMapLayerProps {
    blackspots: Blackspot[];
}

const SEVERITY_COLORS = {
    high: { fill: 'rgba(255, 59, 48, 0.18)', stroke: 'rgba(255, 59, 48, 0.70)', label: '#CC0000' },
    medium: { fill: 'rgba(255, 149, 0, 0.15)', stroke: 'rgba(255, 149, 0, 0.65)', label: '#CC7700' },
    low: { fill: 'rgba(255, 204, 0, 0.12)', stroke: 'rgba(255, 204, 0, 0.55)', label: '#887700' },
};

export function BlackspotMapLayer({ blackspots }: BlackspotMapLayerProps) {
    if (blackspots.length === 0) return null;

    return (
        <>
            {blackspots.map((spot) => {
                const colors = SEVERITY_COLORS[spot.severity];
                return (
                    <React.Fragment key={spot.id}>
                        {/* Outer glow circle — larger, more transparent */}
                        <Circle
                            center={{ latitude: spot.lat, longitude: spot.lng }}
                            radius={spot.radius_m * 2}
                            fillColor={colors.fill.replace('0.18', '0.06').replace('0.15', '0.05').replace('0.12', '0.04')}
                            strokeColor="transparent"
                        />

                        {/* Main danger zone circle */}
                        <Circle
                            center={{ latitude: spot.lat, longitude: spot.lng }}
                            radius={spot.radius_m}
                            fillColor={colors.fill}
                            strokeColor={colors.stroke}
                            strokeWidth={2}
                        />

                        {/* Pin marker for tapping to see details */}
                        <Marker
                            coordinate={{ latitude: spot.lat, longitude: spot.lng }}
                            anchor={{ x: 0.5, y: 0.5 }}
                            tracksViewChanges={false}
                        >
                            {/* Custom small dot marker */}
                            <View style={[styles.markerDot, { backgroundColor: colors.label }]} />

                            <Callout tooltip={false}>
                                <View style={styles.callout}>
                                    <Text style={[styles.calloutSeverity, { color: colors.label }]}>
                                        {spot.severity.toUpperCase()} RISK ZONE
                                    </Text>
                                    <Text style={styles.calloutCount}>
                                        {spot.event_count} driving events recorded
                                    </Text>
                                    <Text style={styles.calloutBreakdown}>
                                        🛑 {spot.event_types.hard_brake} hard brakes{'\n'}
                                        ↔️ {spot.event_types.lateral_swerve} swerves{'\n'}
                                        ↗️ {spot.event_types.heading_change} sudden turns
                                    </Text>
                                </View>
                            </Callout>
                        </Marker>
                    </React.Fragment>
                );
            })}
        </>
    );
}

const styles = StyleSheet.create({
    markerDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
    },
    callout: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 12,
        minWidth: 180,
        maxWidth: 220,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    calloutSeverity: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    calloutCount: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 6,
    },
    calloutBreakdown: {
        fontSize: 12,
        color: '#555',
        lineHeight: 18,
    },
});