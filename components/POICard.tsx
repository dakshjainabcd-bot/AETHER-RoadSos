/**
 * POICard — Matches screenshot design exactly.
 * White card, icon in gray circle, name/distance/phone, dark navy call button.
 */

import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type POI } from '../services/POIDatabase';

const TYPE_CONFIG: Record<string, { icon: string }> = {
  hospital:   { icon: 'medical'          },
  police:     { icon: 'shield-checkmark' },
  towing:     { icon: 'car'             },
  puncture:   { icon: 'ellipse'         },
  petrol:     { icon: 'flash'           },
  blood_bank: { icon: 'water'           },
};

interface POICardProps {
  poi: POI;
}

export function POICard({ poi }: POICardProps) {
  const cfg = TYPE_CONFIG[poi.type] ?? { icon: 'location-outline' };

  function call() {
    if (poi.phone) Linking.openURL(`tel:${poi.phone}`);
  }

  return (
    <View style={styles.card}>
      {/* Icon circle */}
      <View style={styles.iconWrap}>
        <Ionicons name={cfg.icon as any} size={26} color="#2A2A2A" />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {poi.name}
        </Text>
        <Text style={styles.meta}>
          {poi.distanceText} away
        </Text>
        {poi.phone ? (
          <Text style={styles.phone}>{poi.phone}</Text>
        ) : null}
      </View>

      {/* Call button */}
      {poi.phone ? (
        <TouchableOpacity style={styles.callBtn} onPress={call} activeOpacity={0.85}>
          <Ionicons name="call" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  meta: {
    fontSize: 13,
    color: '#888888',
  },
  phone: {
    fontSize: 13,
    color: '#888888',
  },
  callBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1C3A6E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.20,
    shadowRadius: 6,
    elevation: 5,
  },
});