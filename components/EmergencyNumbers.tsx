/**
 * EmergencyNumbers — Premium iOS-style emergency number cards
 *
 * Full-width rows with colored tint backgrounds.
 * Each row: colored icon + large bold number + label + call button.
 * Matches the design language of iOS Health / Wallet cards.
 */

import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows } from '../theme';
import { type EmergencyNumbers as EmergencyNumbersType } from '../services/MCCService';

interface EmergencyNumbersProps {
  emergencyNumbers: EmergencyNumbersType;
}

interface EmergencyRowProps {
  label: string;
  number: string;
  icon: string;
  tintBg: string;
  iconColor: string;
}

function EmergencyRow({ label, number, icon, tintBg, iconColor }: EmergencyRowProps) {
  function dial() {
    Alert.alert(
      `Call ${label}`,
      `Calling ${number}…`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Call ${number}`,
          style: 'destructive',
          onPress: () => Linking.openURL(`tel:${number}`),
        },
      ]
    );
  }

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: tintBg }]}
      onPress={dial}
      activeOpacity={0.75}
    >
      {/* Icon container */}
      <View style={[styles.iconWrap, { backgroundColor: `${iconColor}20` }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>

      {/* Number + label */}
      <View style={styles.textBlock}>
        <Text style={[styles.number, { color: iconColor }]}>{number}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>

      {/* Call button */}
      <TouchableOpacity style={styles.callBtn} onPress={dial} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="call" size={17} color="#FFFFFF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export function EmergencyNumbers({ emergencyNumbers }: EmergencyNumbersProps) {
  const rows = [
    {
      label: 'Police',
      number: emergencyNumbers.police,
      icon: 'shield',
      tintBg: Colors.tint.police,
      iconColor: Colors.service.police,
    },
    {
      label: 'Ambulance',
      number: emergencyNumbers.ambulance,
      icon: 'medkit',
      tintBg: Colors.tint.ambulance,
      iconColor: Colors.service.ambulance,
    },
    {
      label: 'Fire',
      number: emergencyNumbers.fire,
      icon: 'flame',
      tintBg: Colors.tint.fire,
      iconColor: Colors.service.fire,
    },
    {
      label: 'Universal',
      number: emergencyNumbers.unified,
      icon: 'call',
      tintBg: Colors.tint.universal,
      iconColor: Colors.service.universal,
    },
  ];

  return (
    <View style={styles.container}>
      {rows.map((row, i) => (
        <View key={row.label}>
          <EmergencyRow {...row} />
          {i < rows.length - 1 && <View style={styles.separator} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  separator: {
    height: 0.5,
    backgroundColor: 'rgba(60, 60, 67, 0.12)',
    marginLeft: 68,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  number: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  label: {
    fontSize: 12,
    color: Colors.label.secondary,
    fontWeight: '400',
    marginTop: 1,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 8,
    elevation: 6,
  },
});