/**
 * Security Screen — Phase 10 Hub
 *
 * Shows AES mesh encryption status, STRIDE threat mitigations,
 * DPDP compliance, rate limiting, and lets users run crypto self-tests.
 */

import React, { useState } from 'react';
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
import { runCryptoSelfTest } from '../../utils/AESCrypto';
import { deleteAllUserData } from '../../utils/PrivacyManager';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ text, marginTop = 24 }: { text: string; marginTop?: number }) {
  return (
    <Text style={[styles.sectionLabel, { marginTop }]}>
      {text.toUpperCase()}
    </Text>
  );
}

function StatusRow({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  valueColor,
  onPress,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor?: string;
  onPress?: () => void;
}) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap style={styles.statusRow} onPress={onPress} activeOpacity={0.65}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={17} color={iconColor} />
      </View>
      <View style={styles.rowCenter}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
      {onPress && (
        <Ionicons name="chevron-forward" size={15} color={Colors.label.tertiary} style={{ marginLeft: 4 }} />
      )}
    </Wrap>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SecurityScreen() {
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  async function handleCryptoTest() {
    setTestRunning(true);
    setTestResult(null);
    try {
      // runCryptoSelfTest is synchronous internally; wrap to avoid blocking
      await new Promise((r) => setTimeout(r, 100));
      const result = runCryptoSelfTest();
      setTestResult(result);
      Alert.alert(
        result ? '✅ All Tests Passed' : '❌ Tests Failed',
        result
          ? 'AES-256 encryption, HMAC-SHA256 integrity, GPS rounding, and tamper detection are all working correctly.'
          : 'One or more crypto tests failed. Check console logs for details.',
        [{ text: 'OK' }]
      );
    } catch (e) {
      setTestResult(false);
      Alert.alert('Test Error', String(e));
    } finally {
      setTestRunning(false);
    }
  }

  async function handleDeleteData() {
    Alert.alert(
      '⚠️ Delete All My Data',
      'This permanently deletes all GPS history, driving events, translations, evidence, and preferences. You will see the consent dialog on next launch.\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllUserData();
              Alert.alert('✅ Data Deleted', 'All data has been removed. Restart the app to see the consent screen again.');
            } catch {
              Alert.alert('Error', 'Some data could not be deleted. Please try again.');
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.status.success} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Security & Privacy</Text>
          <Text style={styles.subtitle}>DPDP Compliant · AES-128-GCM Mesh Encryption</Text>
        </View>
      </View>

      {/* ── Security summary ──────────────────────────────────────────── */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Ionicons name="shield-checkmark" size={28} color={Colors.status.success} />
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.summaryTitle}>System Secured</Text>
          <Text style={styles.summarySub}>
            AES-256 + HMAC-SHA256 + RSA-signed evidence chain + DPDP compliant
          </Text>
        </View>
      </View>

      {/* ── Encryption ────────────────────────────────────────────────── */}
      <SectionLabel text="Mesh Encryption" marginTop={8} />
      <View style={styles.group}>
        <StatusRow
          icon="lock-closed"
          iconBg={`${Colors.status.success}15`}
          iconColor={Colors.status.success}
          label="SOS Packet Encryption"
          value="AES-256"
          valueColor={Colors.status.success}
        />
        <View style={styles.sep} />
        <StatusRow
          icon="shield"
          iconBg={`${Colors.status.success}15`}
          iconColor={Colors.status.success}
          label="Payload Integrity"
          value="HMAC-SHA256"
          valueColor={Colors.status.success}
        />
        <View style={styles.sep} />
        <StatusRow
          icon="location"
          iconBg={`${Colors.brand.gold}15`}
          iconColor={Colors.brand.gold}
          label="GPS in Relay Packets"
          value="±111 m (3 dp)"
          valueColor={Colors.brand.gold}
        />
        <View style={styles.sep} />
        <StatusRow
          icon="key"
          iconBg={`${Colors.brand.accent}15`}
          iconColor={Colors.brand.accent}
          label="Evidence Signing"
          value="RSA-1024 (dev)"
          valueColor={Colors.brand.accent}
        />
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={14} color={Colors.brand.gold} />
        <Text style={styles.infoText}>
          Relay nodes only see the encrypted ciphertext and hop count — never the victim's precise GPS, severity, or identity. Only authorised AETHER devices with the shared AES key can decrypt.
        </Text>
      </View>

      {/* ── STRIDE threat model ───────────────────────────────────────── */}
      <SectionLabel text="STRIDE Threat Mitigations" />
      <View style={styles.group}>
        {[
          {
            threat: 'Spoofing',
            mitigation: 'RSA-signed packets — unknown device hash is queued',
            icon: 'person-circle-outline',
            color: Colors.brand.accent,
          },
          {
            threat: 'Tampering',
            mitigation: 'HMAC-SHA256 on payload before AES encrypt — relay nodes verify',
            icon: 'create-outline',
            color: Colors.status.warning,
          },
          {
            threat: 'Repudiation',
            mitigation: 'RSA-signed audit trail + immutable cloud log for every action',
            icon: 'document-text-outline',
            color: Colors.brand.purple,
          },
          {
            threat: 'Info Disclosure',
            mitigation: 'GPS rounded to 3 dp in relay; precise coords only in HTTPS payload',
            icon: 'eye-off-outline',
            color: Colors.status.success,
          },
          {
            threat: 'Denial of Service',
            mitigation: '1 SOS per device per 60 s; cloud API rate-limited 100 req/min',
            icon: 'ban-outline',
            color: Colors.brand.primary,
          },
          {
            threat: 'Elevation of Privilege',
            mitigation: 'JWT tokens + role-based routes on FastAPI cloud backend',
            icon: 'medal-outline',
            color: Colors.brand.gold,
          },
        ].map((item, i, arr) => (
          <React.Fragment key={item.threat}>
            <View style={styles.strideRow}>
              <View style={[styles.strideIcon, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={16} color={item.color} />
              </View>
              <View style={styles.strideText}>
                <Text style={[styles.strideThreat, { color: item.color }]}>{item.threat}</Text>
                <Text style={styles.strideMit}>{item.mitigation}</Text>
              </View>
            </View>
            {i < arr.length - 1 && <View style={styles.sep} />}
          </React.Fragment>
        ))}
      </View>

      {/* ── Rate limiting ─────────────────────────────────────────────── */}
      <SectionLabel text="Rate Limiting" />
      <View style={styles.group}>
        <StatusRow
          icon="timer-outline"
          iconBg={`${Colors.brand.primary}15`}
          iconColor={Colors.brand.primary}
          label="SOS Trigger Cooldown"
          value="60 s / device"
        />
        <View style={styles.sep} />
        <StatusRow
          icon="cloud-outline"
          iconBg={`${Colors.brand.accent}15`}
          iconColor={Colors.brand.accent}
          label="Cloud API Rate Limit"
          value="100 req / min"
        />
        <View style={styles.sep} />
        <StatusRow
          icon="git-network-outline"
          iconBg={`${Colors.brand.purple}15`}
          iconColor={Colors.brand.purple}
          label="Max Relay Hops"
          value="30 hops"
        />
      </View>

      {/* ── DPDP Compliance ───────────────────────────────────────────── */}
      <SectionLabel text="DPDP Act 2023 Compliance" />
      <View style={styles.group}>
        {[
          { label: 'Explicit consent before GPS tracking', status: '✅ Done', ok: true },
          { label: 'Data minimisation — no user ID in telemetry', status: '✅ Done', ok: true },
          { label: 'Right to Erasure (Section 12)', status: '✅ Done', ok: true },
          { label: 'Emergency exemption documented (Section 17)', status: '✅ Done', ok: true },
          { label: 'No raw audio ever stored or transmitted', status: '✅ Done', ok: true },
          { label: 'Breach notification monitoring', status: '⚙ Backend', ok: true },
        ].map((item, i, arr) => (
          <React.Fragment key={item.label}>
            <View style={styles.dpdpRow}>
              <Text style={styles.dpdpLabel}>{item.label}</Text>
              <Text style={[styles.dpdpStatus, { color: item.ok ? Colors.status.success : Colors.status.warning }]}>
                {item.status}
              </Text>
            </View>
            {i < arr.length - 1 && <View style={styles.sep} />}
          </React.Fragment>
        ))}
      </View>

      {/* ── Developer tools ───────────────────────────────────────────── */}
      <SectionLabel text="Developer Tools" />
      <View style={styles.group}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleCryptoTest}
          disabled={testRunning}
          activeOpacity={0.65}
        >
          <View style={[styles.rowIcon, { backgroundColor: `${Colors.brand.accent}15` }]}>
            {testRunning
              ? <ActivityIndicator size="small" color={Colors.brand.accent} />
              : <Ionicons name="flask-outline" size={17} color={Colors.brand.accent} />
            }
          </View>
          <View style={styles.rowCenter}>
            <Text style={styles.rowLabel}>Run Crypto Self-Test</Text>
            <Text style={styles.rowSub}>AES + HMAC + GPS rounding + tamper detection</Text>
          </View>
          {testResult !== null && (
            <Ionicons
              name={testResult ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={testResult ? Colors.status.success : Colors.brand.primary}
            />
          )}
        </TouchableOpacity>
        <View style={styles.sep} />
        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleDeleteData}
          activeOpacity={0.65}
        >
          <View style={[styles.rowIcon, { backgroundColor: Colors.soft.red }]}>
            <Ionicons name="trash-outline" size={17} color={Colors.brand.primary} />
          </View>
          <View style={styles.rowCenter}>
            <Text style={[styles.rowLabel, { color: Colors.brand.primary }]}>Delete All My Data</Text>
            <Text style={styles.rowSub}>Right to Erasure · DPDP Section 12</Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={Colors.brand.primary} style={{ marginLeft: 4 }} />
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
    marginBottom: 16,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.soft.green,
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

  // Summary card
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: `${Colors.status.success}08`,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: `${Colors.status.success}30`,
    padding: 16,
    marginBottom: 8,
    ...Shadows.xs,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: `${Colors.status.success}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: { flex: 1 },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.status.success,
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  summarySub: {
    fontSize: 12,
    color: Colors.label.secondary,
    lineHeight: 17,
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

  // Group
  group: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: 8,
    ...Shadows.xs,
  },
  sep: {
    height: 0.5,
    backgroundColor: Colors.border.subtle,
    marginLeft: 52,
  },

  // Status row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCenter: { flex: 1 },
  rowLabel: {
    fontSize: 14,
    color: Colors.label.primary,
    fontWeight: '500',
  },
  rowSub: {
    fontSize: 11,
    color: Colors.label.tertiary,
    marginTop: 1,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.label.secondary,
  },

  // Info box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: `${Colors.brand.gold}08`,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: `${Colors.brand.gold}25`,
    padding: 12,
    marginBottom: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.label.secondary,
    lineHeight: 17,
  },

  // STRIDE row
  strideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  strideIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  strideText: { flex: 1 },
  strideThreat: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  strideMit: {
    fontSize: 12,
    color: Colors.label.secondary,
    lineHeight: 16,
  },

  // DPDP row
  dpdpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  dpdpLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.label.primary,
    lineHeight: 17,
  },
  dpdpStatus: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
});