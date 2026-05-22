/**
 * PsychAidPanel — Psychological First Aid Script Display
 *
 * WHAT THE BYSTANDER SEES:
 * - Phase selector: Connect → Assess → Reassure → Breathe
 * - The script to read aloud (large, readable text)
 * - A coaching note (what to do, not what to say)
 * - "Read Aloud" button → expo-speech reads the script in their language
 * - Next/Previous buttons to move between phases
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { getPsychAidConfig } from '../services/PsychAid';
import type { PsychAidScript } from '../services/PsychAid/types';
import { Colors, BorderRadius, Shadows } from '../theme';

interface PsychAidPanelProps {
  /** Injury type from BystAI assessment */
  injuryType: string;
  /** Language code for TTS (e.g., 'en', 'hi', 'ta') */
  language?: string;
  /** ETA in minutes from hospital pre-alert (null = unknown) */
  etaMinutes?: number | null;
}

// Map app language codes to TTS locale tags
const LANG_TO_TTS: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
};

// Phase icons
const PHASE_ICONS: Record<string, string> = {
  connect: 'hand-left',
  assess: 'ear',
  reassure: 'heart',
  breathe: 'flower',
};

export function PsychAidPanel({ injuryType, language = 'en', etaMinutes = null }: PsychAidPanelProps) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const config = getPsychAidConfig(injuryType, etaMinutes);
  const { scripts, bystanderNote } = config;
  const currentScript: PsychAidScript = scripts[currentPhase];

  const ttsLocale = LANG_TO_TTS[language] ?? 'en-IN';

  const handleReadAloud = useCallback(async () => {
    if (isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    Speech.speak(currentScript.scriptForVictim, {
      language: ttsLocale,
      rate: 0.85,    // Slightly slower for clarity in emergency
      pitch: 1.0,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, [isSpeaking, currentScript, ttsLocale]);

  const goNext = () => {
    if (currentPhase < scripts.length - 1) {
      Speech.stop();
      setIsSpeaking(false);
      setCurrentPhase(currentPhase + 1);
    }
  };

  const goPrev = () => {
    if (currentPhase > 0) {
      Speech.stop();
      setIsSpeaking(false);
      setCurrentPhase(currentPhase - 1);
    }
  };

  if (!isExpanded) {
    // Collapsed state — just a banner to open it
    return (
      <TouchableOpacity
        style={styles.collapsedBanner}
        onPress={() => setIsExpanded(true)}
        activeOpacity={0.8}
      >
        <View style={styles.collapsedLeft}>
          <Ionicons name="heart" size={16} color={Colors.brand.gold} />
          <Text style={styles.collapsedTitle}>Psychological First Aid</Text>
        </View>
        <View style={styles.collapsedRight}>
          <Text style={styles.collapsedSub}>What to say to the victim</Text>
          <Ionicons name="chevron-down" size={16} color={Colors.label.secondary} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => {
          Speech.stop();
          setIsSpeaking(false);
          setIsExpanded(false);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="heart" size={16} color={Colors.brand.gold} />
          <Text style={styles.headerTitle}>Psychological First Aid</Text>
        </View>
        <Ionicons name="chevron-up" size={16} color={Colors.label.secondary} />
      </TouchableOpacity>

      {/* Bystander coaching note */}
      <View style={styles.noteBox}>
        <Ionicons name="information-circle-outline" size={14} color={Colors.brand.gold} />
        <Text style={styles.noteText}>{bystanderNote}</Text>
      </View>

      {/* Phase progress dots */}
      <View style={styles.phaseDots}>
        {scripts.map((_, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.phaseDot, idx === currentPhase && styles.phaseDotActive]}
            onPress={() => {
              Speech.stop();
              setIsSpeaking(false);
              setCurrentPhase(idx);
            }}
          />
        ))}
      </View>

      {/* Current phase label */}
      <View style={styles.phaseLabelRow}>
        <Ionicons
          name={(PHASE_ICONS[currentScript.phase] ?? 'heart') as any}
          size={14}
          color={Colors.brand.gold}
        />
        <Text style={styles.phaseLabel}>{currentScript.phaseLabel.toUpperCase()}</Text>
        <Text style={styles.phaseCount}>
          {currentPhase + 1} of {scripts.length}
        </Text>
      </View>

      {/* Script to say aloud */}
      <View style={styles.scriptBox}>
        <Text style={styles.speakLabel}>SAY THIS TO THE VICTIM:</Text>
        <Text style={styles.scriptText}>{currentScript.scriptForVictim}</Text>
      </View>

      {/* Coaching note */}
      <View style={styles.coachBox}>
        <Ionicons name="eye-outline" size={12} color={Colors.label.tertiary} />
        <Text style={styles.coachText}>{currentScript.coachNote}</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.navBtn, currentPhase === 0 && styles.navBtnDisabled]}
          onPress={goPrev}
          disabled={currentPhase === 0}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={16}
            color={currentPhase === 0 ? Colors.label.muted : Colors.label.secondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.readBtn, isSpeaking && styles.readBtnSpeaking]}
          onPress={handleReadAloud}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isSpeaking ? 'stop-circle' : 'volume-high'}
            size={18}
            color={isSpeaking ? Colors.brand.primary : '#fff'}
          />
          <Text style={[styles.readBtnText, isSpeaking && styles.readBtnTextSpeaking]}>
            {isSpeaking ? 'Stop' : 'Read Aloud'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navBtn, currentPhase === scripts.length - 1 && styles.navBtnDisabled]}
          onPress={goNext}
          disabled={currentPhase === scripts.length - 1}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-forward"
            size={16}
            color={
              currentPhase === scripts.length - 1 ? Colors.label.muted : Colors.label.secondary
            }
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Collapsed banner
  collapsedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${Colors.brand.gold}10`,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: `${Colors.brand.gold}30`,
    padding: 12,
    marginTop: 12,
  },
  collapsedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.brand.gold,
  },
  collapsedRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  collapsedSub: {
    fontSize: 12,
    color: Colors.label.secondary,
  },

  // Expanded container
  container: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: `${Colors.brand.gold}30`,
    marginTop: 12,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: `${Colors.brand.gold}08`,
    borderBottomWidth: 1,
    borderBottomColor: `${Colors.brand.gold}20`,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.brand.gold,
  },

  // Note box
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.background.grouped,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.label.secondary,
    lineHeight: 17,
    fontStyle: 'italic',
  },

  // Phase dots
  phaseDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  phaseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.border.medium,
  },
  phaseDotActive: {
    backgroundColor: Colors.brand.gold,
    width: 20,
    borderRadius: 3.5,
  },

  // Phase label
  phaseLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  phaseLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.gold,
    letterSpacing: 1.5,
  },
  phaseCount: {
    fontSize: 11,
    color: Colors.label.tertiary,
  },

  // Script
  scriptBox: {
    marginHorizontal: 14,
    backgroundColor: Colors.background.grouped,
    borderRadius: BorderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    marginBottom: 8,
  },
  speakLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.label.tertiary,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  scriptText: {
    fontSize: 16,
    color: Colors.label.primary,
    lineHeight: 26,
    fontWeight: '500',
  },

  // Coach note
  coachBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginHorizontal: 14,
    marginBottom: 14,
  },
  coachText: {
    flex: 1,
    fontSize: 12,
    color: Colors.label.tertiary,
    lineHeight: 17,
    fontStyle: 'italic',
  },

  // Action buttons
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.grouped,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
  readBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.brand.gold,
    borderRadius: BorderRadius.xl,
    paddingVertical: 12,
    ...Shadows.sm,
  },
  readBtnSpeaking: {
    backgroundColor: Colors.background.grouped,
    borderWidth: 1.5,
    borderColor: Colors.brand.primary,
  },
  readBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  readBtnTextSpeaking: {
    color: Colors.brand.primary,
  },
});