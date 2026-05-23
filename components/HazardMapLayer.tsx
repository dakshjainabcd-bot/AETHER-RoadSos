/**
 * HazardMapLayer — Shows hazard report clusters on the map
 *
 * Each cluster = 1+ user reports of the same hazard in a 50m area.
 * The marker badge shows the report count for instant credibility signal.
 *
 * CREDIBILITY COLORS:
 *   grey  = 1 report  (low credibility)
 *   amber = 2–4 reports (medium credibility)
 *   red   = 5+ reports  (high credibility — slow down!)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, Circle, Callout } from 'react-native-maps';
import { HazardCluster, HazardType } from '../services/DriverIntelligence/types';
import { Colors } from '../theme';

interface HazardMapLayerProps {
  clusters: HazardCluster[];
}

const HAZARD_EMOJI: Record<HazardType, string> = {
  pothole:     '🕳️',
  accident:    '💥',
  road_closed: '🚧',
  debris:      '🪨',
};

const HAZARD_LABEL: Record<HazardType, string> = {
  pothole:     'Pothole',
  accident:    'Accident',
  road_closed: 'Road Closed',
  debris:      'Debris',
};

const CREDIBILITY_COLORS = {
  low:    { fill: 'rgba(142,142,147,0.15)', stroke: 'rgba(142,142,147,0.50)', badge: '#8E8E93' },
  medium: { fill: 'rgba(255,149,0,0.15)',   stroke: 'rgba(255,149,0,0.55)',   badge: '#FF9500' },
  high:   { fill: 'rgba(255,59,48,0.18)',   stroke: 'rgba(255,59,48,0.65)',   badge: '#FF3B30' },
};

const CREDIBILITY_LABEL = {
  low:    'Unverified',
  medium: 'Likely Real',
  high:   'Confirmed',
};

export function HazardMapLayer({ clusters }: HazardMapLayerProps) {
  if (clusters.length === 0) return null;

  return (
    <>
      {clusters.map(cluster => {
        const colors = CREDIBILITY_COLORS[cluster.credibilityLevel];
        const minutesAgo = Math.round((Date.now() - cluster.lastReportedAt) / 60000);
        const timeText = minutesAgo === 0 ? 'Just now' : `${minutesAgo}m ago`;

        return (
          <React.Fragment key={cluster.clusterKey}>
            {/* Outer glow circle */}
            <Circle
              center={{ latitude: cluster.lat, longitude: cluster.lng }}
              radius={80}
              fillColor={colors.fill.replace('0.15', '0.07').replace('0.18', '0.07')}
              strokeColor="transparent"
            />

            {/* Main hazard zone circle */}
            <Circle
              center={{ latitude: cluster.lat, longitude: cluster.lng }}
              radius={50}
              fillColor={colors.fill}
              strokeColor={colors.stroke}
              strokeWidth={1.5}
            />

            {/* Marker with count badge */}
            <Marker
              coordinate={{ latitude: cluster.lat, longitude: cluster.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              {/* Custom marker view */}
              <View style={styles.markerWrap}>
                {/* Emoji icon */}
                <View style={[styles.emojiBubble, { borderColor: colors.badge, backgroundColor: '#FFFFFF' }]}>
                  <Text style={styles.emoji}>
                    {HAZARD_EMOJI[cluster.hazardType]}
                  </Text>
                </View>

                {/* Report count badge */}
                {cluster.reportCount > 1 && (
                  <View style={[styles.countBadge, { backgroundColor: colors.badge }]}>
                    <Text style={styles.countText}>{cluster.reportCount}</Text>
                  </View>
                )}
              </View>

              {/* Callout (shown on tap) */}
              <Callout tooltip={false}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>
                    {HAZARD_EMOJI[cluster.hazardType]} {HAZARD_LABEL[cluster.hazardType]}
                  </Text>

                  <View style={[styles.credBadge, { backgroundColor: `${colors.badge}20` }]}>
                    <Text style={[styles.credText, { color: colors.badge }]}>
                      {CREDIBILITY_LABEL[cluster.credibilityLevel]}
                    </Text>
                  </View>

                  <Text style={styles.calloutCount}>
                    {cluster.reportCount === 1
                      ? '1 person reported this'
                      : `${cluster.reportCount} people reported this`}
                  </Text>
                  <Text style={styles.calloutTime}>Last report: {timeText}</Text>
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
  markerWrap: {
    alignItems: 'center',
  },
  emojiBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  emoji: {
    fontSize: 18,
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  callout: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    minWidth: 180,
    maxWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    gap: 5,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  credBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  credText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  calloutCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  calloutTime: {
    fontSize: 11,
    color: '#888',
  },
});
