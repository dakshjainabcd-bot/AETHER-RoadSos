/**
 * Bystander Empathy Coach — Main Screen
 *
 * Phase 11 additions:
 * 1. 'chat' phase → PocketRAGChat embedded in bystander flow
 * 2. PsychAidPanel shown in 'treat' phase below first aid steps
 * 3. "Ask AI" button in 'treat' phase to open the chatbot
 *
 * Original phases preserved unchanged: assess → treat → cpr
 * New phase added: chat (AI chatbot)
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

// ── PHASE 11 IMPORTS ──────────────────────────────────────────────────────────
import { PocketRAGChat } from '../components/PocketRAGChat';
import { PsychAidPanel } from '../components/PsychAidPanel';
// ─────────────────────────────────────────────────────────────────────────────

// Phase 11 adds 'chat' to the phase type
type Phase = 'assess' | 'treat' | 'cpr' | 'chat';

export default function BystanderScreen() {
  const params = useLocalSearchParams<{ incidentTimestamp?: string }>();
  const { language, emergencyNumbers, preAlertState } = useAppContext();

  const incidentTimestamp = params.incidentTimestamp
    ? parseInt(params.incidentTimestamp, 10)
    : Date.now();

  const [phase, setPhase] = useState<Phase>('assess');
  const [injuryType, setInjuryType] = useState<InjuryType | null>(null);
  const [protocol, setProtocol] = useState<FirstAidProtocol | null>(null);
  const [showLegalBanner, setShowLegalBanner] = useState(true);

  // Re-show legal banner every 2 minutes
  const legalBannerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    legalBannerTimerRef.current = setInterval(() => {
      setShowLegalBanner(true);
    }, 120000);
    return () => {
      if (legalBannerTimerRef.current) clearInterval(legalBannerTimerRef.current);
    };
  }, []);

  // ── PHASE TRANSITIONS ────────────────────────────────────────────────────────

  function handleDecisionComplete(answers: DecisionTreeAnswers) {
    const injury = determineInjuryType(answers);
    const p = getProtocol(injury);
    setInjuryType(injury);
    setProtocol(p);
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

  // ── PHASE 11: Navigation ─────────────────────────────────────────────────────

  function handleOpenChat() {
    setPhase('chat');
  }

  function handleBackFromChat() {
    // Return to treat phase if we had a protocol, otherwise back to assess
    setPhase(protocol ? 'treat' : 'assess');
  }

  // ── HEADER TITLE ─────────────────────────────────────────────────────────────

  function getHeaderTitle(): string {
    if (phase === 'assess') return 'Assess the Situation';
    if (phase === 'cpr') return 'CPR Coach';
    if (phase === 'chat') return 'AI First-Aid Assistant';  // Phase 11
    return protocol?.name ?? 'First Aid';
  }

  // Get ETA from hospital pre-alert state
  const etaMinutes =
    preAlertState.status === 'acknowledged' || preAlertState.status === 'sent'
      ? preAlertState.etaMinutes
      : null;

  // ── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Top safe area — header */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.header}>
          {/* Back / Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              if (phase === 'chat') {
                handleBackFromChat();
              } else {
                router.back();
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={phase === 'chat' ? 'arrow-back' : 'close'}
              size={20}
              color={Colors.label.primary}
            />
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {getHeaderTitle()}
          </Text>

          {/* Golden Hour clock — compact version in header (not shown in chat phase) */}
          {phase !== 'chat' && (
            <GoldenHourClock incidentTimestamp={incidentTimestamp} compact />
          )}

          {/* Phase 11: "Ask AI" button shown in treat phase header */}
          {phase === 'treat' && (
            <TouchableOpacity
              style={styles.askAIBtn}
              onPress={handleOpenChat}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-ellipses" size={12} color={Colors.brand.accent} />
              <Text style={styles.askAIBtnText}>Ask AI</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* ── PHASE 11: Chat phase — full screen PocketRAG ─────────────────── */}
      {phase === 'chat' && (
        <View style={styles.chatContainer}>
          <PocketRAGChat contextInjuryType={injuryType ?? undefined} />
        </View>
      )}

      {/* ── Original phases ─────────────────────────────────────────────── */}
      {phase !== 'chat' && (
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

          {/* PHASE: Treat — First Aid Steps + PsychAid */}
          {phase === 'treat' && protocol && (
            <>
              <FirstAidDisplay
                protocol={protocol}
                onStartCPR={handleStartCPR}
                onBack={handleBackToAssess}
              />

              {/* ── PHASE 11: PsychAid panel ─────────────────────────────── */}
              <PsychAidPanel
                injuryType={injuryType ?? 'unknown'}
                language={language}
                etaMinutes={etaMinutes}
              />

              {/* ── PHASE 11: Ask AI button at bottom ───────────────────── */}
              <TouchableOpacity
                style={styles.openChatBtn}
                onPress={handleOpenChat}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.brand.accent} />
                <View style={styles.openChatBtnText}>
                  <Text style={styles.openChatBtnTitle}>Ask the AI Assistant</Text>
                  <Text style={styles.openChatBtnSub}>
                    Get answers to specific first-aid questions
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.brand.accent} />
              </TouchableOpacity>
            </>
          )}

          {/* PHASE: CPR — CPR Coach */}
          {phase === 'cpr' && (
            <CPRCoach language={language} onExit={handleBackToAssess} />
          )}

          {/* Bottom padding so content isn't hidden behind the legal banner */}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Legal Banner — always at the bottom (except in chat phase) */}
      {showLegalBanner && phase !== 'chat' && (
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

  // Phase 11: Ask AI button in header
  askAIBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.brand.accent}12`,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: `${Colors.brand.accent}30`,
  },
  askAIBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.accent,
    letterSpacing: 0.3,
  },

  // Phase 11: Chat container
  chatContainer: {
    flex: 1,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 0,
  },

  // Phase 11: Open chat button at bottom of treat phase
  openChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: `${Colors.brand.accent}30`,
    padding: 14,
    marginTop: 12,
    ...Shadows.xs,
  },
  openChatBtnText: {
    flex: 1,
  },
  openChatBtnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.brand.accent,
    letterSpacing: -0.2,
  },
  openChatBtnSub: {
    fontSize: 12,
    color: Colors.label.secondary,
    marginTop: 2,
  },
});