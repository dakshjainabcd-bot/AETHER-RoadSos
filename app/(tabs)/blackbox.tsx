/**
 * Phase 8: Black Box System
 *
 * Redesigned to match AETHER's warm parchment design system:
 * - iOS-style grouped cards with separator rows
 * - Warm parchment background, AETHER red accents
 * - Consistent typography and spacing from theme/index.ts
 * - All original functionality preserved
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, BorderRadius, Shadows, Layout } from '../../theme';
import { getBlackBoxManager, BlackBoxState } from '@/services/BlackBox';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ text, marginTop = 24 }: { text: string; marginTop?: number }) {
  return (
    <Text style={[styles.sectionLabel, { marginTop }]}>
      {text.toUpperCase()}
    </Text>
  );
}

function StatusRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  sublabel,
  color,
  bg,
  onPress,
  disabled = false,
  danger = false,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  color: string;
  bg: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        { borderColor: `${color}30`, opacity: disabled ? 0.4 : 1 },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.72}
    >
      <View style={[styles.actionIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={styles.actionText}>
        <Text style={[styles.actionLabel, danger ? { color: Colors.brand.primary } : null]}>
          {label}
        </Text>
        {sublabel && <Text style={styles.actionSublabel}>{sublabel}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={15} color={Colors.label.tertiary} />
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BlackBoxScreen() {
  const [blackBox] = useState(() => getBlackBoxManager());
  const [state, setState] = useState<BlackBoxState>({
    isRecording: false,
    bufferSize: 0,
    crashDetected: false,
  });
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    addLog('Black Box ready. Tap "Initialize" to begin.');
  }, []);

  useEffect(() => {
    blackBox.onStateChange((newState) => setState(newState));
    const intervalId = setInterval(() => setState(blackBox.getState()), 2000);
    return () => clearInterval(intervalId);
  }, []);

  function addLog(message: string) {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${ts}] ${message}`, ...prev].slice(0, 20));
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function initializeBlackBox() {
    try {
      setLoading(true);
      addLog('Initializing…');
      const success = await blackBox.initialize();
      if (success) {
        setInitialized(true);
        addLog('✅ Black Box initialized');
        setState(blackBox.getState());
      } else {
        addLog('❌ Initialization failed');
        Alert.alert('Error', 'Failed to initialize Black Box. Check permissions.');
      }
    } catch (e) {
      addLog(`❌ ${e}`);
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleStartRecording() {
    try {
      setLoading(true);
      addLog('Starting sensor recording…');
      await blackBox.startRecording();
      addLog('✅ Recording started — 90 s circular buffer active');
    } catch (e) {
      addLog(`❌ ${e}`);
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleStopRecording() {
    addLog('Stopping recording…');
    blackBox.stopRecording();
    addLog('⏹ Recording stopped');
  }

  async function handleSimulateCrash() {
    if (!state.isRecording) {
      Alert.alert('Not Recording', 'Start recording first before simulating a crash.');
      return;
    }
    Alert.alert(
      '🚨 Simulate Crash',
      'This freezes the 90-second buffer and creates a tamper-proof evidence package.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Simulate',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              addLog('🚨 Crash detected — freezing buffer…');
              const incidentId = await blackBox.onCrashDetected(7, {
                latitude: 28.8955,
                longitude: 76.6066,
              });
              addLog(`✅ Evidence package created: ${incidentId.substring(0, 20)}…`);
              Alert.alert('✅ Crash Simulated', `Incident ID: ${incidentId.substring(0, 24)}…`);
            } catch (e) {
              addLog(`❌ ${e}`);
              Alert.alert('Error', String(e));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  async function handleTestSystems() {
    try {
      setLoading(true);
      addLog('🧪 Testing all systems…');
      const results = await blackBox.testSystems();
      const passed = Object.entries(results)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const failed = Object.entries(results)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      addLog(`✅ Passed: ${passed.join(', ')}`);
      if (failed.length) addLog(`❌ Failed: ${failed.join(', ')}`);
      Alert.alert(
        'System Test',
        `Passed: ${passed.length}/${Object.keys(results).length}\n\n✅ ${passed.join('\n✅ ')}${failed.length ? `\n\n❌ ${failed.join('\n❌ ')}` : ''}`
      );
    } catch (e) {
      addLog(`❌ ${e}`);
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalizeEvidence() {
    if (!state.crashDetected) {
      Alert.alert('No Crash Detected', 'Simulate a crash first to create evidence.');
      return;
    }
    try {
      setLoading(true);
      addLog('📦 Finalizing evidence package…');
      const evidence = await blackBox.finalizeEvidence();
      if (evidence) {
        addLog('✅ Evidence finalized and uploaded');
        addLog(`Witnesses: ${evidence.witnessContributions.length}`);
        Alert.alert(
          '✅ Evidence Finalized',
          `Incident: ${evidence.incidentId.substring(0, 20)}…\nWitnesses: ${evidence.witnessContributions.length}\nUploaded: ${evidence.uploadedToCloud ? 'Yes' : 'Pending'}`
        );
      } else {
        addLog('❌ Evidence finalization failed');
      }
    } catch (e) {
      addLog(`❌ ${e}`);
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateLegalNotice() {
    try {
      setLoading(true);
      addLog('⚖️ Generating legal notice…');
      const notice = await blackBox.generateLegalNotice(
        'Accident caused by pothole. Vehicle lost control due to poor road conditions.'
      );
      if (notice) {
        addLog('✅ Legal notice generated — ART filing ready');
        Alert.alert(
          '⚖️ Legal Notice Generated',
          'Notice prepared under National Highways Act, 1956 — Section 27 (NHAI).\n\nFiled to: grievance-hq@nhai.org\n\nCheck console for full text.',
          [{ text: 'OK' }]
        );
        console.log('=== LEGAL NOTICE ===\n', notice, '\n===================');
      }
    } catch (e) {
      addLog(`❌ ${e}`);
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    Alert.alert(
      'Reset Black Box',
      'This deletes all buffered sensor data and evidence packages. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await blackBox.reset();
            setInitialized(false);
            setState(blackBox.getState());
            addLog('🔄 System reset — all data cleared');
          },
        },
      ]
    );
  }

  const bufferPercent = Math.min(100, (state.bufferSize / 900) * 100);
  const bufferSeconds = (state.bufferSize / 10).toFixed(1);

  // ── Render ─────────────────────────────────────────────────────────────────

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
          <Ionicons name="chevron-back" size={22} color={Colors.brand.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Black Box System</Text>
          <Text style={styles.subtitle}>Phase 8 · Tamper-Proof Sensor Evidence</Text>
        </View>
      </View>

      {/* ── System Status ─────────────────────────────────────────────── */}
      <SectionLabel text="System Status" marginTop={8} />
      <View style={styles.group}>
        <StatusRow
          label="Initialized"
          value={initialized ? '✅ YES' : '❌ NO'}
          valueColor={initialized ? Colors.status.success : Colors.brand.primary}
        />
        <View style={styles.sep} />
        <StatusRow
          label="Recording"
          value={state.isRecording ? '🔴 ACTIVE' : '⚪ STOPPED'}
          valueColor={state.isRecording ? Colors.brand.primary : Colors.label.secondary}
        />
        <View style={styles.sep} />
        <View style={styles.bufferRow}>
          <Text style={styles.statusLabel}>Buffer</Text>
          <Text style={styles.statusValue}>
            {state.bufferSize} readings ({bufferSeconds} s / 90 s)
          </Text>
        </View>
        {state.bufferSize > 0 && (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${bufferPercent}%` as any }]}
              />
            </View>
          </View>
        )}
        <View style={styles.sep} />
        <StatusRow
          label="Crash Detected"
          value={state.crashDetected ? '🚨 YES' : 'NO'}
          valueColor={state.crashDetected ? Colors.brand.primary : Colors.label.secondary}
        />
        {state.deviceKeys && (
          <>
            <View style={styles.sep} />
            <StatusRow
              label="Device ID"
              value={`${state.deviceKeys.deviceId.substring(0, 18)}…`}
              valueColor={Colors.label.tertiary}
            />
          </>
        )}
      </View>

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <SectionLabel text="Controls" />
      <View style={styles.actionsGroup}>
        {!initialized ? (
          <ActionButton
            icon={loading ? 'hourglass-outline' : 'power'}
            label={loading ? 'Initializing…' : 'Initialize System'}
            sublabel="Request permissions and generate RSA keys"
            color={Colors.brand.accent}
            bg={Colors.soft.blue}
            onPress={initializeBlackBox}
            disabled={loading}
          />
        ) : !state.isRecording ? (
          <ActionButton
            icon="play-circle"
            label="Start Recording"
            sublabel="Begin 90-second circular sensor buffer"
            color={Colors.status.success}
            bg={Colors.soft.green}
            onPress={handleStartRecording}
            disabled={loading}
          />
        ) : (
          <ActionButton
            icon="stop-circle"
            label="Stop Recording"
            sublabel="Pause sensor collection"
            color={Colors.brand.primary}
            bg={Colors.soft.red}
            onPress={handleStopRecording}
            disabled={loading}
          />
        )}

        {initialized && (
          <>
            <ActionButton
              icon="warning"
              label="Simulate Crash"
              sublabel="Freeze buffer and create evidence package"
              color={Colors.status.warning}
              bg={Colors.soft.amber}
              onPress={handleSimulateCrash}
              disabled={loading || !state.isRecording}
            />
            <ActionButton
              icon="flask"
              label="Test All Systems"
              sublabel="Run crypto, sensors, buffer, evidence checks"
              color={Colors.brand.accent}
              bg={Colors.soft.blue}
              onPress={handleTestSystems}
              disabled={loading}
            />
          </>
        )}
      </View>

      {/* ── Evidence Management (post-crash) ──────────────────────────── */}
      {state.crashDetected && (
        <>
          <SectionLabel text="Evidence Management" />
          <View style={[styles.crashBanner]}>
            <Ionicons name="warning" size={16} color={Colors.brand.primary} />
            <Text style={styles.crashBannerText}>
              Crash detected — buffer frozen. Finalize evidence and file legal notice.
            </Text>
          </View>
          <View style={styles.actionsGroup}>
            <ActionButton
              icon="cube"
              label="Finalize Evidence Package"
              sublabel="Upload RSA-signed sensor data to cloud (S3)"
              color={Colors.brand.accent}
              bg={Colors.soft.blue}
              onPress={handleFinalizeEvidence}
              disabled={loading}
            />
            <ActionButton
              icon="document-text"
              label="Generate Legal Notice"
              sublabel="ART — file with NHAI under NH Act Section 27"
              color={Colors.brand.purple}
              bg={Colors.soft.purple}
              onPress={handleGenerateLegalNotice}
              disabled={loading}
            />
            <ActionButton
              icon="refresh"
              label="Reset System"
              sublabel="Delete all data and start fresh"
              color={Colors.brand.primary}
              bg={Colors.soft.red}
              onPress={handleReset}
              disabled={loading}
              danger
            />
          </View>
        </>
      )}

      {/* ── Activity Log ──────────────────────────────────────────────── */}
      <SectionLabel text="Activity Log" />
      <View style={styles.logBox}>
        {logs.length === 0 ? (
          <Text style={styles.logEmpty}>No activity yet…</Text>
        ) : (
          logs.map((log, i) => (
            <Text key={i} style={styles.logEntry}>{log}</Text>
          ))
        )}
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.brand.primary} />
          <Text style={styles.loadingText}>Processing…</Text>
        </View>
      )}

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

  // Group card
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
    marginLeft: 16,
  },

  // Status rows
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: Colors.label.secondary,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    color: Colors.label.primary,
    fontWeight: '600',
  },

  // Buffer row
  bufferRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  progressWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.fill.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.brand.accent,
    borderRadius: 3,
  },

  // Crash banner
  crashBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Colors.brand.primary}08`,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: `${Colors.brand.primary}25`,
    padding: 12,
    marginBottom: 8,
  },
  crashBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.brand.primary,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Actions group
  actionsGroup: {
    gap: 10,
    marginBottom: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: 14,
    ...Shadows.xs,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.label.primary,
    letterSpacing: -0.2,
  },
  actionSublabel: {
    fontSize: 11,
    color: Colors.label.tertiary,
    marginTop: 2,
  },

  // Log
  logBox: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 14,
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

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.label.secondary,
  },
});