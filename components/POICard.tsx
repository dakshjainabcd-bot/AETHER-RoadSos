/**
 * POICard — iOS-style nearby service card
 *
 * Displays a hospital, police station, or other POI.
 * White card with icon, name, distance, phone.
 */

import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows } from '../theme';
import { type POI } from '../services/POIDatabase';
import { type POIType } from '../utils/constants';

const TYPE_CONFIG: Record<string, { icon: string; color: string; tint: string }> = {
  hospital:  { icon: 'medical',           color: '#FF3B30', tint: '#FFEDEC' },
  police:    { icon: 'shield-checkmark',  color: '#007AFF', tint: '#EBF3FF' },
  towing:    { icon: 'car',              color: '#FF9500', tint: '#FFF5E6' },
  puncture:  { icon: 'ellipse',          color: '#34C759', tint: '#EDFAF3' },
  petrol:    { icon: 'flash',            color: '#5856D6', tint: '#F0EEFF' },
  blood_bank:{ icon: 'water',            color: '#FF3B30', tint: '#FFEDEC' },
};

interface POICardProps {
  poi: POI;
}

export function POICard({ poi }: POICardProps) {
  const cfg = TYPE_CONFIG[poi.type] ?? { icon: 'location', color: '#8E8E93', tint: '#F2F2F7' };

  function call() {
    if (poi.phone) Linking.openURL(`tel:${poi.phone}`);
  }

  function navigate() {
    const url = `geo:${poi.lat},${poi.lng}?q=${poi.lat},${poi.lng}(${encodeURIComponent(poi.name)})`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${poi.lat},${poi.lng}`);
    });
  }

  return (
    <View style={styles.card}>
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: cfg.tint }]}>
        <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{poi.name}</Text>
        <View style={styles.meta}>
          <Text style={[styles.distance, { color: cfg.color }]}>{poi.distanceText}</Text>
          {poi.phone ? (
            <Text style={styles.phone}>{poi.phone}</Text>
          ) : null}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {poi.phone ? (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.brand.accent }]} onPress={call}>
            <Ionicons name="call" size={15} color="#FFF" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: cfg.tint }]} onPress={navigate}>
          <Ionicons name="navigate" size={15} color={cfg.color} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 16,
    gap: 14,
    ...Shadows.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.label.primary,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distance: {
    fontSize: 12,
    fontWeight: '600',
  },
  phone: {
    fontSize: 12,
    color: Colors.label.secondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});