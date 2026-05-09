/**
 * GPSIndicator — iOS-style GPS accuracy badge
 * Displays as a small pill with a colored dot.
 */

import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '../theme';
import { getAccuracyLevel, type StoredLocation } from '../services/GPSService';

interface GPSIndicatorProps {
  location: StoredLocation | null;
}

export function GPSIndicator({ location }: GPSIndicatorProps) {
  const level = location ? getAccuracyLevel(location.accuracy) : 'none';

  const config = {
    good:  { dot: Colors.status.success, label: location ? `±${Math.round(location.accuracy)}m` : 'GPS', bg: 'rgba(52, 199, 89, 0.10)' },
    fair:  { dot: Colors.status.warning, label: 'Weak GPS', bg: 'rgba(255, 149, 0, 0.10)' },
    poor:  { dot: Colors.status.danger,  label: 'Poor GPS', bg: 'rgba(255, 59, 48, 0.10)' },
    none:  { dot: Colors.status.neutral, label: 'No GPS',   bg: 'rgba(142, 142, 147, 0.10)' },
  }[level];

  return (
    <View style={[styles.pill, { backgroundColor: config.bg }]}>
      <View style={[styles.dot, { backgroundColor: config.dot }]} />
      <Text style={[styles.label, { color: config.dot }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});