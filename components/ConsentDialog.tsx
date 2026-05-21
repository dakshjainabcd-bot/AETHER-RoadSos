/**
 * ConsentDialog.tsx — Phase 10 DPDP Consent Screen
 *
 * WHY THIS IS REQUIRED:
 * India's DPDP Act 2023, Section 6: "A Data Fiduciary shall not process
 * personal data of a Data Principal unless she has given her consent."
 *
 * WHAT WE COLLECT:
 * 1. GPS Location — to detect crash location and find nearby hospitals
 * 2. Accelerometer data — to detect crashes (not stored raw, only analyzed)
 * 3. Driving events — anonymous hard brakes, swerves (for blackspot map)
 * 4. Voice (optional) — only when you speak to report injury, never stored raw
 *
 * WHAT WE DON'T COLLECT:
 * - No raw audio recordings
 * - No photos stored on our servers
 * - No user accounts required
 * - No advertising data
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows } from '../theme';

interface ConsentDialogProps {
  onAccept: () => void;
  onDecline: () => void;
}

// Data items we clearly explain to the user
const DATA_ITEMS = [
  {
    icon: 'location-sharp' as const,
    title: 'GPS Location',
    detail: 'Used to detect crash site and find the nearest hospital. Stored locally only.',
    collected: true,
  },
  {
    icon: 'speedometer' as const,
    title: 'Movement Sensors',
    detail: 'Accelerometer reads g-force to detect crashes. Raw data never leaves your phone.',
    collected: true,
  },
  {
    icon: 'car' as const,
    title: 'Driving Events (Anonymous)',
    detail: 'Hard brakes and swerves are logged WITHOUT your identity, to build a danger map.',
    collected: true,
  },
  {
    icon: 'mic' as const,
    title: 'Microphone (Optional)',
    detail: 'Only active when YOU press the record button. No background listening, ever.',
    collected: true,
  },
  {
    icon: 'person' as const,
    title: 'Personal Identity',
    detail: 'We do NOT collect your name, phone number, or any account information.',
    collected: false,
  },
  {
    icon: 'bar-chart' as const,
    title: 'Advertising Data',
    detail: 'AETHER does NOT show ads. We never sell your data. Ever.',
    collected: false,
  },
];

export function ConsentDialog({ onAccept, onDecline }: ConsentDialogProps) {
  return (
    <View style={styles.container}>
      {/* Header with shield icon */}
      <View style={styles.header}>
        <View style={styles.shieldWrap}>
          <Ionicons name="shield-checkmark" size={36} color={Colors.brand.primary} />
        </View>
        <Text style={styles.title}>Before We Begin</Text>
        <Text style={styles.subtitle}>
          AETHER needs your permission to protect you during road accidents.
          Please review what we collect.
        </Text>
      </View>

      {/* Scrollable data list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* What we collect section */}
        <Text style={styles.sectionHeader}>DATA WE COLLECT</Text>
        {DATA_ITEMS.map((item) => (
          <View key={item.title} style={styles.dataRow}>
            {/* Icon */}
            <View style={[
              styles.iconWrap,
              { backgroundColor: item.collected ? `${Colors.brand.accent}15` : `${Colors.status.success}15` }
            ]}>
              <Ionicons
                name={item.icon}
                size={18}
                color={item.collected ? Colors.brand.accent : Colors.status.success}
              />
            </View>

            {/* Text */}
            <View style={styles.dataText}>
              <View style={styles.dataTitle}>
                <Text style={styles.dataTitleText}>{item.title}</Text>
                {/* Collected / Not collected badge */}
                <View style={[
                  styles.badge,
                  { backgroundColor: item.collected ? `${Colors.status.warning}15` : `${Colors.status.success}15` }
                ]}>
                  <Text style={[
                    styles.badgeText,
                    { color: item.collected ? Colors.status.warning : Colors.status.success }
                  ]}>
                    {item.collected ? 'COLLECTED' : '✗ NOT COLLECTED'}
                  </Text>
                </View>
              </View>
              <Text style={styles.dataDetail}>{item.detail}</Text>
            </View>
          </View>
        ))}

        {/* Legal note */}
        <View style={styles.legalNote}>
          <Ionicons name="document-text-outline" size={14} color={Colors.label.tertiary} />
          <Text style={styles.legalNoteText}>
            Protected under India's Digital Personal Data Protection Act 2023 (DPDP).
            You can delete all your data at any time from Settings → Privacy.
          </Text>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.actions}>
        {/* Primary: Accept */}
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
          <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
          <Text style={styles.acceptBtnText}>I Agree — Enable Full Protection</Text>
        </TouchableOpacity>

        {/* Secondary: Decline */}
        <TouchableOpacity style={styles.declineBtn} onPress={onDecline} activeOpacity={0.75}>
          <Text style={styles.declineBtnText}>Continue Without Location Access</Text>
        </TouchableOpacity>

        <Text style={styles.declineNote}>
          Note: Crash detection and hospital alerts require location access.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  shieldWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${Colors.brand.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Shadows.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.label.primary,
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.label.secondary,
    lineHeight: 21,
    textAlign: 'center',
  },

  // Scroll area
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 0 },

  sectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.label.tertiary,
    letterSpacing: 1.5,
    marginBottom: 14,
    marginTop: 4,
  },

  // Each data row
  dataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.separator.nonOpaque,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dataText: { flex: 1 },
  dataTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  dataTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.label.primary,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dataDetail: {
    fontSize: 12,
    color: Colors.label.secondary,
    lineHeight: 17,
  },

  // Legal note
  legalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    padding: 14,
    backgroundColor: Colors.background.grouped,
    borderRadius: BorderRadius.lg,
  },
  legalNoteText: {
    flex: 1,
    fontSize: 11,
    color: Colors.label.tertiary,
    lineHeight: 16,
  },

  // Action buttons
  actions: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.background.primary,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.brand.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    ...Shadows.sm,
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  declineBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  declineBtnText: {
    fontSize: 14,
    color: Colors.label.secondary,
    textDecorationLine: 'underline',
  },
  declineNote: {
    fontSize: 11,
    color: Colors.label.tertiary,
    textAlign: 'center',
    lineHeight: 15,
  },
});