/**
 * HazardMapLayer — Hazard cluster markers on the map
 *
 * FIXES:
 * - No <Callout> component — uses onClusterPress callback instead.
 *   Callout is broken on Android; the parent renders a custom card overlay.
 * - Each marker shows the correct emoji for its specific hazard type
 *   (now guaranteed because clusters are keyed by type+location).
 * - Count badge shows on all markers with >1 report.
 * - Credibility ring color reflects how many people reported this.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, Circle } from 'react-native-maps';
import type { HazardCluster, HazardType } from '../services/DriverIntelligence/types';

// ── Display config ────────────────────────────────────────────────────────────

export const HAZARD_EMOJI: Record<HazardType, string> = {
  pothole:     '🕳️',
  accident:    '💥',
  road_closed: '🚧',
  debris:      '🪨',
};

export const HAZARD_LABEL: Record<HazardType, string> = {
  pothole:     'Pothole',
  accident:    'Accident',
  road_closed: 'Road Closed',
  debris:      'Debris on Road',
};

const CRED_COLORS = {
  low:    { ring: 'rgba(142,142,147,0.18)', stroke: 'rgba(142,142,147,0.55)', badge: '#8E8E93' },
  medium: { ring: 'rgba(255,149,0,0.18)',   stroke: 'rgba(255,149,0,0.60)',   badge: '#FF9500' },
  high:   { ring: 'rgba(255,59,48,0.22)',   stroke: 'rgba(255,59,48,0.70)',   badge: '#FF3B30' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface HazardMapLayerProps {
  clusters: HazardCluster[];
  /** Called when user taps a cluster marker — parent handles overlay display */
  onClusterPress?: (cluster: HazardCluster) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HazardMapLayer({ clusters, onClusterPress }: HazardMapLayerProps) {
  if (clusters.length === 0) return null;

  return (
    <>
      {clusters.map(cluster => {
        const colors   = CRED_COLORS[cluster.credibilityLevel];
        const emoji    = HAZARD_EMOJI[cluster.hazardType];  // correct per type
        const hasMulti = cluster.reportCount > 1;

        return (
          <React.Fragment key={cluster.clusterKey}>
            {/* Glow halo */}
            <Circle
              center={{ latitude: cluster.lat, longitude: cluster.lng }}
              radius={90}
              fillColor={colors.ring.replace('0.18', '0.07').replace('0.22', '0.07')}
              strokeColor="transparent"
            />

            {/* Hazard zone circle */}
            <Circle
              center={{ latitude: cluster.lat, longitude: cluster.lng }}
              radius={50}
              fillColor={colors.ring}
              strokeColor={colors.stroke}
              strokeWidth={1.5}
            />

            {/* Marker — uses onPress, no Callout (Android fix) */}
            <Marker
              key={cluster.clusterKey}
              coordinate={{ latitude: cluster.lat, longitude: cluster.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={e => {
                e.stopPropagation();
                onClusterPress?.(cluster);
              }}
            >
              <View style={styles.markerWrap}>
                {/* Emoji bubble */}
                <View style={[
                  styles.emojiBubble,
                  { borderColor: colors.badge },
                ]}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </View>

                {/* Report count badge — only shows when >1 */}
                {hasMulti && (
                  <View style={[styles.countBadge, { backgroundColor: colors.badge }]}>
                    <Text style={styles.countText}>{cluster.reportCount}</Text>
                  </View>
                )}
              </View>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  markerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 5,
  },
  emojiText: {
    fontSize: 20,
  },
  countBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
});
