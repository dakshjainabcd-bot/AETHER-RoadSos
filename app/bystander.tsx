/**
 * Bystander Empathy Coach — Main Screen
 *
 * This screen is triggered when a bystander receives an SOS and wants to help.
 * It coordinates three phases:
 *
 * 1. ASSESS: Yes/no decision tree to identify injury type
 * 2. TREAT: Step-by-step first aid for that injury
 * 3. CPR: Real-time CPR coaching (if cardiac arrest)
 *
 * The Golden Hour clock and Good Samaritan legal banner are persistent.
 * They are always visible regardless of which phase the user is in.
 *
 * NAVIGATION:
 * Opened from BystanderAlert via:
 *   router.push({ pathname: '/bystander', params: { incidentTimestamp: '...' } })
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { Colors, BorderRadius, Layout, Shadows } from '../theme';
import { useAppContext } from './_layout';
import {
  determineInjuryType,
  getProtocol,
  getInjurySummary,
  type DecisionTreeAnswers,
  type InjuryType,
  type FirstAidProtocol,
} from '../services/BystAI';

import { DecisionTree } from '../components/BystAI/DecisionTree';
import { FirstAidDisplay } from '../components/BystAI/FirstAidDisplay';
import { CPRCoach } from '../components/BystAI/CPRCoach';
import { GoldenHourClock } from '../components/BystAI/GoldenHourClock';
import { LegalBanner } from '../components/BystAI/LegalBanner';

type Phase = 'assess' | 'treat' | 'cpr';

export default function BystanderScreen() {
  // Get the incident timestamp from navigation params
  const params = useLocalSearchParams<{ incidentTimestamp?: string }>();
  const { language, emergencyNumbers } = useAppContext();

  // Parse the timestamp — fall back to now if not provided
  const incidentTimestamp = params.incidentTimestamp
    ? parseInt(params.incidentTimestamp, 10)
    : Date.now();

  // Screen state
  const [phase, setPhase] = useState<Phase>('assess');
  const [injuryType, setInjuryType] = useState<InjuryType | null>(null);
  const [protocol, setProtocol] = useState<FirstAidProtocol | null>(null);
  const [showLegalBanner, setShowLegalBanner] = useState(true);

  // Re-show legal banner every 2 minutes (as per master document spec)
  const legalBannerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    legalBannerTimerRef.current = setInterval(() => {
      setShowLegalBanner(true);
    }, 120000);
    return () => {
      if (legalBannerTimerRef.current) clearInterval(legalBannerTimerRef.current);
    };
  }, []);

  // ── PHASE TRANSITIONS ────────────────────────────────────────────────────

  function handleDecisionComplete(answers: DecisionTreeAnswers) {
    const injury = determineInjuryType(answers);
    const p = getProtocol(injury);
    setInjuryType(injury);
    setProtocol(p);
    // Go straight to CPR phase for cardiac arrest
    setPhase(injury === 'cardiac_arrest' ? 'cpr' : 'treat');
  }

  function handleStartCPR() {
    setInjuryType('cardiac_arrest');
    setProtocol(getProtocol('cardiac_arrest'));
    setPhase('cpr');
  }

  function handleBackToAssess() {
    setPhase('assess');
    setInjuryType(null);
    setProtocol(null);
  }

  // ── HEADER TITLE ─────────────────────────────────────────────────────────

  function getHeaderTitle(): string {
    if (phase === 'assess') return 'Assess the Situation';
    if (phase === 'cpr') return 'CPR Coach';
    return protocol?.name ?? 'First Aid';
  }

  // ── RENDER ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Top safe area — header */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.header}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color={Colors.label.primary} />
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {getHeaderTitle()}
          </Text>

          {/* Golden Hour clock — compact version in header */}
          <GoldenHourClock incidentTimestamp={incidentTimestamp} compact />
        </View>
      </SafeAreaView>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Full-size Golden Hour clock — only on assess phase */}
        {phase === 'assess' && (
          <GoldenHourClock incidentTimestamp={incidentTimestamp} compact={false} />
        )}

        {/* PHASE: Assess — Decision Tree */}
        {phase === 'assess' && (
          <DecisionTree onComplete={handleDecisionComplete} />
        )}

        {/* PHASE: Treat — First Aid Steps */}
        {phase === 'treat' && protocol && (
          <FirstAidDisplay
            protocol={protocol}
            onStartCPR={handleStartCPR}
            onBack={handleBackToAssess}
          />
        )}

        {/* PHASE: CPR — CPR Coach */}
        {phase === 'cpr' && (
          <CPRCoach language={language} onExit={handleBackToAssess} />
        )}

        {/* Bottom padding so content isn't hidden behind the legal banner */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Legal Banner — always at the bottom */}
      {showLegalBanner && (
        <LegalBanner onDismiss={() => setShowLegalBanner(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.grouped,
  },

  // Header
  headerSafeArea: {
    backgroundColor: Colors.background.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
    ...Shadows.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.fill.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.3,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 0,
  },
});