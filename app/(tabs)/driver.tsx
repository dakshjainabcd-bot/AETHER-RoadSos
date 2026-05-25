/**
 * Driver Intelligence Screen — Phase 12 + 13
 *
 * Hub for all driver-related intelligence features:
 *   - Phase 12: Weekly Safety Score, Trip coaching, Hazard broadcasting
 *   - Phase 13: Trust score, Good Samaritan badges, Reward tracking
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, BorderRadius, Shadows, Layout } from '../../theme';
import { WeeklySafetyCard } from '../../components/WeeklySafetyCard';
import { BadgeGallery } from '../../components/Rakshak/BadgeGallery';
import { tripScoreService } from '../../services/DriverIntelligence/TripScoreService';

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ text, marginTop = 24 }: { text: string; marginTop?: number }) {
  return (
    <Text style={[styles.sectionLabel, { marginTop }]}>
      {text.toUpperCase()}
    </Text>
  );
}

// ─── Info row (iOS-style) ─────────────────────────────────────────────────────

function InfoRow({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  onPress,
  showChevron = false,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={styles.infoRow}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={[styles.infoIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={17} color={iconColor} />
      </View>
      <View style={styles.infoCenter}>
        <Text style={styles.infoLabel}>{label}</Text>
        {value ? <Text style={styles.infoValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={16} color={Colors.label.tertiary} />
      )}
    </Wrapper>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DriverScreen() {
  const [simulating, setSimulating] = useState(false);

  async function handleSimulateTrip() {
    setSimulating(true);
    try {
      await tripScoreService.simulateTrip();
      Alert.alert(
        '🚗 Trip Simulated',
        'A demo trip has been scored and added to your weekly summary.',
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert('Error', 'Could not simulate trip. Please try again.');
    } finally {
      setSimulating(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.brand.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Driver Intelligence</Text>
          <Text style={styles.subtitle}>Safety Coaching & Gamification</Text>
        </View>
      </View>

      {/* ── Weekly Safety Score ─────────────────────────────────────────── */}
      <SectionLabel text="Weekly Safety Score" marginTop={8} />
      <WeeklySafetyCard />

      {/* ── How scoring works ───────────────────────────────────────────── */}
      <SectionLabel text="How Trip Scoring Works" />
      <View style={styles.group}>
        <InfoRow
          icon="close-circle"
          iconBg={`${Colors.brand.primary}15`}
          iconColor={Colors.brand.primary}
          label="Hard Brakes"
          value="-5 points each"
        />
        <View style={styles.separator} />
        <InfoRow
          icon="swap-horizontal"
          iconBg={`${Colors.status.warning}15`}
          iconColor={Colors.status.warning}
          label="Lateral Swerves"
          value="-4 points each"
        />
        <View style={styles.separator} />
        <InfoRow
          icon="refresh"
          iconBg={`${Colors.status.info}15`}
          iconColor={Colors.status.info}
          label="Sharp Heading Changes"
          value="-3 points each"
        />
        <View style={styles.separator} />
        <InfoRow
          icon="moon"
          iconBg={`${Colors.brand.purple}15`}
          iconColor={Colors.brand.purple}
          label="Night Driving — Clean Trip"
          value="+10 points"
        />
        <View style={styles.separator} />
        <InfoRow
          icon="checkmark-circle"
          iconBg={`${Colors.status.success}15`}
          iconColor={Colors.status.success}
          label="Clean Trip — No Events"
          value="+15 points"
        />
      </View>

      {/* ── Hazard Broadcasting ─────────────────────────────────────────── */}
      <SectionLabel text="Hazard Broadcasting" />
      <View style={styles.group}>
        <InfoRow
          icon="git-network"
          iconBg={`${Colors.brand.purple}15`}
          iconColor={Colors.brand.purple}
          label="DTN Mesh"
          value="Hazards relay to nearby phones"
          onPress={() => router.push('/(tabs)/dtn' as any)}
          showChevron
        />
        <View style={styles.separator} />
        <InfoRow
          icon="map"
          iconBg={`${Colors.brand.accent}15`}
          iconColor={Colors.brand.accent}
          label="Report a Road Hazard"
          value="Open Map → tap 'Report Hazard'"
          onPress={() => router.push('/(tabs)/map' as any)}
          showChevron
        />
      </View>

      <View style={styles.hazardExplainBox}>
        <Ionicons name="information-circle-outline" size={14} color={Colors.status.info} />
        <Text style={styles.hazardExplainText}>
          When you report a hazard on the Map screen, AETHER broadcasts it over the mesh
          to all nearby phones. Drivers approaching within 500 m receive an automatic warning.
        </Text>
      </View>

      {/* ── Hazard types reference ──────────────────────────────────────── */}
      <View style={styles.hazardGrid}>
        {[
          { emoji: '🕳️', label: 'Pothole', color: Colors.status.warning },
          { emoji: '💥', label: 'Accident', color: Colors.brand.primary },
          { emoji: '🚧', label: 'Road Closed', color: Colors.brand.primary },
          { emoji: '🪨', label: 'Debris', color: Colors.status.warning },
        ].map((h) => (
          <View key={h.label} style={[styles.hazardChip, { borderColor: `${h.color}30` }]}>
            <Text style={styles.hazardEmoji}>{h.emoji}</Text>
            <Text style={[styles.hazardChipLabel, { color: h.color }]}>{h.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Badges & Trust ─────────────────────────────────────────────── */}
      <SectionLabel text="Good Samaritan Badges" />
      <BadgeGallery />

      {/* ── Debug / Demo ────────────────────────────────────────────────── */}
      <SectionLabel text="Developer Tools" />
      <View style={styles.group}>
        <TouchableOpacity
          style={styles.demoRow}
          onPress={handleSimulateTrip}
          disabled={simulating}
          activeOpacity={0.65}
        >
          <View style={[styles.infoIcon, { backgroundColor: `${Colors.brand.gold}15` }]}>
            {simulating
              ? <ActivityIndicator size="small" color={Colors.brand.gold} />
              : <Ionicons name="flask-outline" size={17} color={Colors.brand.gold} />
            }
          </View>
          <View style={styles.infoCenter}>
            <Text style={styles.infoLabel}>Simulate a Trip</Text>
            <Text style={styles.infoValue}>Generates demo score with events</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.label.tertiary} />
        </TouchableOpacity>
      </View>

      <View style={{ height: Layout.CONTENT_BOTTOM_PADDING }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.grouped,
  },
  content: {
    paddingTop: Layout.STATUS_BAR_HEIGHT,
    paddingHorizontal: Layout.HORIZONTAL_PADDING,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.soft.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.label.primary,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.label.secondary,
    marginTop: 1,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.label.secondary,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },

  // iOS-style group card
  group: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.xs,
    marginBottom: 4,
  },
  separator: {
    height: 0.5,
    backgroundColor: Colors.border.subtle,
    marginLeft: 56,
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCenter: { flex: 1 },
  infoLabel: {
    fontSize: 15,
    color: Colors.label.primary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 12,
    color: Colors.label.secondary,
    marginTop: 1,
  },

  // Demo row
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },

  // Hazard explain
  hazardExplainBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: `${Colors.status.info}08`,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: `${Colors.status.info}20`,
    padding: 12,
    marginBottom: 12,
  },
  hazardExplainText: {
    flex: 1,
    fontSize: 12,
    color: Colors.label.secondary,
    lineHeight: 17,
  },

  // Hazard chips
  hazardGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  hazardChip: {
    flex: 1,
    minWidth: '22%',
    alignItems: 'center',
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    paddingVertical: 10,
    gap: 4,
    ...Shadows.xs,
  },
  hazardEmoji: { fontSize: 22 },
  hazardChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});