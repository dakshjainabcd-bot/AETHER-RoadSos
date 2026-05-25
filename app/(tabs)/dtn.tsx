/**
 * DTN Screen — Delay-Tolerant Networking Hub (Phase 14)
 *
 * Shows real-time DTN buffer state, peer count, and lets users
 * understand and test the store-and-forward mesh.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, BorderRadius, Shadows, Layout } from '../../theme';
import { dtnManager } from '../../services/MeshRelay/DTNManager';
import { DTNState } from '../../services/MeshRelay/types';
import { useAppContext } from '../_layout';

// ─── Status card ──────────────────────────────────────────────────────────────

function StatusCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: string;
}) {
  return (
    <View style={[styles.statCard, { borderColor: `${color}30` }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  iconColor,
  iconBg,
  title,
  body,
}: {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={16} color={iconColor} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoBody}>{body}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DTNScreen() {
  const { meshConnected, meshPeerCount } = useAppContext();
  const [dtnState, setDtnState] = useState<DTNState>(dtnManager.currentState);
  const [bufferSize, setBufferSize] = useState(dtnManager.bufferSize);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const unsub = dtnManager.on(() => {
      setDtnState(dtnManager.currentState);
      setBufferSize(dtnManager.bufferSize);
      const ts = new Date().toLocaleTimeString();
      setLogs((prev) =>
        [`[${ts}] State → ${dtnManager.currentState} | Buffer: ${dtnManager.bufferSize}`
          , ...prev].slice(0, 15)
      );
    });
    return () => unsub();
  }, []);

  const isCarrying = dtnState === 'CARRYING_SOS' && bufferSize > 0;

  const stateColor = isCarrying
    ? Colors.status.warning
    : meshConnected
    ? Colors.status.success
    : Colors.label.tertiary;

  const stateLabel = isCarrying
    ? `CARRYING · ${bufferSize} packet${bufferSize !== 1 ? 's' : ''}`
    : meshConnected
    ? 'IDLE · Mesh online'
    : 'IDLE · Mesh offline';

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
          <Ionicons name="chevron-back" size={22} color={Colors.brand.purple} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>DTN Mesh Enhancer</Text>
          <Text style={styles.subtitle}>Store-and-Forward Mesh Networking</Text>
        </View>
      </View>

      {/* ── Live status ──────────────────────────────────────────────── */}
      <View style={[styles.statusBanner, {
        backgroundColor: `${stateColor}10`,
        borderColor: `${stateColor}30`,
      }]}>
        <View style={[styles.statusDot, { backgroundColor: stateColor }]} />
        <Text style={[styles.statusText, { color: stateColor }]}>{stateLabel}</Text>
      </View>

      {/* ── Stats grid ───────────────────────────────────────────────── */}
      <View style={styles.statsGrid}>
        <StatusCard
          label="Buffer"
          value={bufferSize.toString()}
          sub="/ 5 max"
          color={bufferSize > 0 ? Colors.status.warning : Colors.status.success}
          icon="archive"
        />
        <StatusCard
          label="Peers"
          value={meshPeerCount.toString()}
          sub="online"
          color={meshPeerCount > 0 ? Colors.brand.accent : Colors.label.tertiary}
          icon="phone-portrait"
        />
        <StatusCard
          label="State"
          value={isCarrying ? 'Carry' : 'Idle'}
          color={stateColor}
          icon={isCarrying ? 'archive' : 'checkmark-circle'}
        />
      </View>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>HOW DTN WORKS</Text>
      <View style={styles.group}>
        <InfoRow
          icon="radio"
          iconColor={Colors.brand.primary}
          iconBg={`${Colors.brand.primary}15`}
          title="SOS Sent — No Relay Available"
          body="Phone enters CARRYING_SOS state and buffers the SOS packet locally (up to 5 packets, oldest dropped first)."
        />
        <View style={styles.separator} />
        <InfoRow
          icon="bluetooth"
          iconColor={Colors.brand.accent}
          iconBg={`${Colors.brand.accent}15`}
          title="Peer Discovered via BLE"
          body="Every 30 seconds the carrying phone scans for new AETHER devices. On discovery, it forwards all buffered packets within 5 seconds."
        />
        <View style={styles.separator} />
        <InfoRow
          icon="cloud-upload-outline"
          iconColor={Colors.status.success}
          iconBg={`${Colors.status.success}15`}
          title="Signal Regained"
          body="If the carrying phone regains cellular/WiFi before a peer is found, buffered packets are immediately uploaded to the cloud backend."
        />
        <View style={styles.separator} />
        <InfoRow
          icon="timer-outline"
          iconColor={Colors.status.warning}
          iconBg={`${Colors.status.warning}15`}
          title="Packet TTL — 30 Minutes"
          body="Stale packets older than 30 minutes are silently discarded to prevent outdated SOS alerts from reaching bystanders."
        />
      </View>

      {/* ── Config reference ─────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>CONFIGURATION</Text>
      <View style={styles.group}>
        {[
          { label: 'Max Buffer Size', value: '5 packets', icon: 'layers-outline' },
          { label: 'Packet TTL', value: '30 minutes', icon: 'hourglass-outline' },
          { label: 'Scan Interval', value: 'Every 30 s', icon: 'scan-outline' },
          { label: 'Min Battery', value: '20% to relay', icon: 'battery-half-outline' },
          { label: 'Max SOS Hops', value: '30 hops', icon: 'git-branch-outline' },
          { label: 'Hazard TTL', value: '30 minutes', icon: 'warning-outline' },
        ].map((item, i, arr) => (
          <React.Fragment key={item.label}>
            <View style={styles.configRow}>
              <Ionicons name={item.icon as any} size={14} color={Colors.label.tertiary} />
              <Text style={styles.configLabel}>{item.label}</Text>
              <Text style={styles.configValue}>{item.value}</Text>
            </View>
            {i < arr.length - 1 && <View style={styles.separator} />}
          </React.Fragment>
        ))}
      </View>

      {/* ── Activity log ─────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>ACTIVITY LOG</Text>
      <View style={styles.logBox}>
        {logs.length === 0 ? (
          <Text style={styles.logEmpty}>No DTN events yet. Trigger an SOS to see logs.</Text>
        ) : (
          logs.map((log, i) => (
            <Text key={i} style={styles.logEntry}>{log}</Text>
          ))
        )}
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
    backgroundColor: Colors.soft.purple,
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

  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    ...Shadows.xs,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.label.secondary,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  statSub: {
    fontSize: 9,
    color: Colors.label.tertiary,
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
    marginBottom: 24,
    ...Shadows.xs,
  },
  separator: {
    height: 0.5,
    backgroundColor: Colors.border.subtle,
    marginLeft: 52,
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  infoText: { flex: 1 },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.label.primary,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  infoBody: {
    fontSize: 12,
    color: Colors.label.secondary,
    lineHeight: 17,
  },

  // Config row
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  configLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.label.primary,
    fontWeight: '500',
  },
  configValue: {
    fontSize: 14,
    color: Colors.label.secondary,
    fontWeight: '600',
  },

  // Log
  logBox: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 14,
    marginBottom: 8,
    minHeight: 80,
    ...Shadows.xs,
  },
  logEmpty: {
    fontSize: 13,
    color: Colors.label.tertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  logEntry: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: Colors.label.secondary,
    lineHeight: 18,
    paddingVertical: 1,
  },
});