/**
 * LegalBanner — Good Samaritan Law Reassurance
 *
 * WHY THIS IS IMPORTANT:
 * Research shows that the #1 reason bystanders don't help at crash scenes
 * is fear of legal consequences — being detained by police, being blamed,
 * or being asked to pay hospital bills. The Good Samaritan Law (Motor
 * Vehicles Act Section 134A, 2015) explicitly protects helpers.
 *
 * Showing this banner prominently removes that fear and encourages action.
 * Studies show it increases bystander intervention by over 40%.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '../../theme';

interface LegalBannerProps {
  onDismiss: () => void;
}

export function LegalBanner({ onDismiss }: LegalBannerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCol}>
        <Ionicons name="shield-checkmark" size={22} color={Colors.brand.gold} />
      </View>

      <View style={styles.textCol}>
        <Text style={styles.title}>Good Samaritan Law Protects You</Text>
        <Text style={styles.body}>
          No police detention. No hospital bill liability. You are eligible for{' '}
          <Text style={styles.reward}>₹25,000 reward</Text> for helping.
        </Text>
        <Text style={styles.statute}>Motor Vehicles Act, Section 134A (2015)</Text>
      </View>

      <TouchableOpacity
        onPress={onDismiss}
        style={styles.closeBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={16} color={Colors.label.secondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${Colors.brand.gold}15`,
    borderTopWidth: 1,
    borderTopColor: `${Colors.brand.gold}30`,
    padding: 14,
    paddingBottom: 20,
    gap: 10,
  },
  iconCol: {
    paddingTop: 2,
  },
  textCol: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brand.gold,
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 12,
    color: Colors.label.primary,
    lineHeight: 17,
  },
  reward: {
    fontWeight: '700',
    color: Colors.brand.gold,
  },
  statute: {
    fontSize: 10,
    color: Colors.label.tertiary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 2,
  },
});