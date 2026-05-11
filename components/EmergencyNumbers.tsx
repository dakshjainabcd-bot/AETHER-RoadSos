/**
 * EmergencyNumbers — Matches screenshot design exactly.
 * Individual colored cards, large bold numbers, dark navy call button.
 */

import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type EmergencyNumbers as EmergencyNumbersType } from '../services/MCCService';

interface EmergencyNumbersProps {
  emergencyNumbers: EmergencyNumbersType;
}

interface CardProps {
  label: string;
  number: string;
  icon: string;
  cardBg: string;
  iconBg: string;
  iconColor: string;
}

function EmergencyCard({ label, number, icon, cardBg, iconBg, iconColor }: CardProps) {
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
      style={[styles.card, { backgroundColor: cardBg }]}
      onPress={dial}
      activeOpacity={0.78}
    >
      {/* Icon box */}
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={26} color={iconColor} />
      </View>

      {/* Number + label */}
      <View style={styles.textBlock}>
        <Text style={styles.number}>{number}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>

      {/* Call button */}
      <TouchableOpacity style={styles.callBtn} onPress={dial} activeOpacity={0.85}>
        <Ionicons name="call" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export function EmergencyNumbers({ emergencyNumbers }: EmergencyNumbersProps) {
  const cards: CardProps[] = [
    {
      label: 'Police',
      number: emergencyNumbers.police,
      icon: 'shield',
      cardBg: '#D6E8F6',
      iconBg: '#B8D4EE',
      iconColor: '#2B5EA7',
    },
    {
      label: 'Ambulance',
      number: emergencyNumbers.ambulance,
      icon: 'medkit',
      cardBg: '#FBDBDB',
      iconBg: '#F5BFBF',
      iconColor: '#B52B2B',
    },
    {
      label: 'Fire',
      number: emergencyNumbers.fire,
      icon: 'flame',
      cardBg: '#FDEFD4',
      iconBg: '#F9DBA8',
      iconColor: '#C07010',
    },
    {
      label: 'Universal',
      number: emergencyNumbers.unified,
      icon: 'call',
      cardBg: '#D2EFE0',
      iconBg: '#AEDEC5',
      iconColor: '#1B8A4D',
    },
  ];

  return (
    <View style={styles.container}>
      {cards.map((card) => (
        <EmergencyCard key={card.label} {...card} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  number: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  label: {
    fontSize: 14,
    color: '#555555',
    fontWeight: '400',
    marginTop: 1,
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