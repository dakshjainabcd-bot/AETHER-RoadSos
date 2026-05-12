/**
 * BystAIModal — Phase 4: Bystander Empathy Coach
 *
 * Full-screen modal mounted at ROOT level (in _layout.tsx) so it overlays
 * the entire app, including the tab navigator.
 *
 * FLOW:
 *   intro → camera (online) → analyzing → results → [cpr]
 *   intro → questions (offline) → results → [cpr]
 *
 * ONLINE PATH  : Takes photo → sends to Claude Vision API → shows protocol
 * OFFLINE PATH : 5 yes/no questions → maps to one of 6 first-aid protocols
 *
 * CPR COACH    : Visual metronome at 110 BPM + vibration + voice cues
 * GOLDEN HOUR  : Live clock counting up from packet.timestamp
 * LEGAL BANNER : Good Samaritan Law information — shown throughout
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';

import { SOSPacket } from '../services/MeshRelay/types';
import { Colors, BorderRadius, Shadows, Spacing } from '../theme';
import { analyseInjuryPhoto } from '../services/BystAI/BystAIService';
import {
  getFirstQuestion,
  getQuestion,
  getProtocol,
  isResultId,
  getTotalQuestions,
  getQuestionIndex,
  type InjuryProtocol,
  type DecisionQuestion,
} from '../services/offlineDecisionTree';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Phase =
  | 'intro'       // Choose online (camera) or offline (questions)
  | 'camera'      // Prompt to take photo
  | 'questions'   // Step through yes/no decision tree
  | 'analyzing'   // API call in progress
  | 'results'     // Show first aid protocol
  | 'cpr';        // CPR coach active

interface BystAIModalProps {
  visible: boolean;
  packet: SOSPacket | null;
  emergencyAmbulanceNumber: string;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getSeverityLabel(severity: number): string {
  return ['', 'Minor', 'Moderate', 'Serious', 'Severe', 'Critical'][severity] ?? 'Unknown';
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function clockColor(totalSeconds: number): string {
  if (totalSeconds < 600) return Colors.status.success;   // < 10 min — green
  if (totalSeconds < 2400) return Colors.status.warning;   // < 40 min — yellow
  return Colors.brand.primary;                             // > 40 min — red
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function BystAIModal({
  visible,
  packet,
  emergencyAmbulanceNumber,
  onClose,
}: BystAIModalProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('intro');
  const [protocol, setProtocol] = useState<InjuryProtocol | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<DecisionQuestion | null>(null);
  const [apiError, setApiError] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [compressionCount, setCompressionCount] = useState(0);

  // ── Animations ────────────────────────────────────────────────────────────
  const cprPulse = useRef(new Animated.Value(1)).current;
  const cprAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const cprIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Golden hour clock ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !packet) return;

    const update = () => {
      setElapsedSeconds(Math.floor((Date.now() - packet.timestamp) / 1000));
    };
    update();
    clockIntervalRef.current = setInterval(update, 1000);

    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, [visible, packet]);

  // ── Reset when modal closes ───────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      setPhase('intro');
      setProtocol(null);
      setCurrentQuestion(null);
      setApiError(false);
      setCompressionCount(0);
      stopCPR();
      Speech.stop();
    }
  }, [visible]);

  // ── CPR coach ─────────────────────────────────────────────────────────────
  const stopCPR = useCallback(() => {
    cprAnimRef.current?.stop();
    cprPulse.setValue(1);
    if (cprIntervalRef.current) {
      clearInterval(cprIntervalRef.current);
      cprIntervalRef.current = null;
    }
  }, [cprPulse]);

  useEffect(() => {
    if (phase !== 'cpr') {
      stopCPR();
      return;
    }

    const BPM_INTERVAL_MS = 545; // 110 BPM

    // Visual pulse
    cprAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(cprPulse, {
          toValue: 1.30,
          duration: BPM_INTERVAL_MS / 2,
          useNativeDriver: true,
        }),
        Animated.timing(cprPulse, {
          toValue: 1.0,
          duration: BPM_INTERVAL_MS / 2,
          useNativeDriver: true,
        }),
      ])
    );
    cprAnimRef.current.start();

    // Haptic + counter
    let count = 0;
    setCompressionCount(0);

    // Initial voice cue
    Speech.speak('Start compressions. Push hard and fast.', { rate: 0.9 });

    cprIntervalRef.current = setInterval(() => {
      Vibration.vibrate(40);
      count += 1;
      setCompressionCount(count);

      // Every 30 compressions: remind about rescue breaths
      if (count % 30 === 0) {
        Speech.stop();
        setTimeout(() => Speech.speak('Give two breaths now.', { rate: 0.9 }), 100);
      }
    }, BPM_INTERVAL_MS);

    return () => stopCPR();
  }, [phase, cprPulse, stopCPR]);

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Needed',
          'Please grant camera access so BystAI can analyse the injury.',
          [
            { text: 'Use Offline Instead', onPress: startOfflineQuestions },
            { text: 'OK' },
          ]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'] as any,
        quality: 0.7,
        base64: true,
        exif: false,
      });

      if (!result.canceled && result.assets?.[0]?.base64) {
        setPhase('analyzing');
        await analyzeWithGemini(result.assets[0].base64);
      }
    } catch (error) {
      console.error('[BystAI] Camera error:', error);
      Alert.alert('Camera Error', 'Could not open camera. Using offline questions instead.');
      startOfflineQuestions();
    }
  };

  const analyzeWithGemini = async (base64Image: string) => {
    try {
      const parsed = await analyseInjuryPhoto(base64Image, 'image/jpeg');
      
      if (!parsed) {
        throw new Error('Gemini analysis failed or returned null');
      }

      const sev = Math.max(1, Math.min(5, parsed.severity_1_to_5 ?? 3)) as 1 | 2 | 3 | 4 | 5;

      setProtocol({
        id: 'ai_result',
        injuryType: parsed.injury_type ?? 'Unknown Injury',
        severity: sev,
        cprNeeded: parsed.injury_type === 'cardiac' || parsed.injury_type === 'unconscious',
        callAmbulance: Boolean(parsed.call_ambulance),
        steps: Array.isArray(parsed.first_aid_steps) ? parsed.first_aid_steps : [],
        doNots: Array.isArray(parsed.do_not_do) ? parsed.do_not_do : [],
        severityColor: sev >= 4 ? '#CC0000' : sev >= 3 ? Colors.brand.primary : Colors.status.warning,
      });
      setPhase('results');
    } catch (error) {
      console.error('[BystAI] Gemini API error:', error);
      setApiError(true);
      // Seamless fallback to offline questions
      startOfflineQuestions();
    }
  };

  const startOfflineQuestions = () => {
    setCurrentQuestion(getFirstQuestion());
    setPhase('questions');
  };

  const handleAnswer = (answer: 'yes' | 'no') => {
    if (!currentQuestion) return;
    const nextId = answer === 'yes' ? currentQuestion.yesNext : currentQuestion.noNext;

    if (isResultId(nextId)) {
      const proto = getProtocol(nextId);
      if (proto) {
        setProtocol(proto);
        setPhase('results');
      }
    } else {
      const nextQ = getQuestion(nextId);
      if (nextQ) setCurrentQuestion(nextQ);
    }
  };

  const handleStartCPR = () => {
    setPhase('cpr');
  };

  const handleStopCPR = () => {
    Speech.stop();
    setPhase('results');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const renderGoldenHourClock = () => {
    const color = clockColor(elapsedSeconds);
    return (
      <View style={[styles.clockBanner, { borderColor: `${color}40`, backgroundColor: `${color}10` }]}>
        <Ionicons name="timer-outline" size={14} color={color} />
        <Text style={[styles.clockLabel, { color }]}>Golden Hour</Text>
        <Text style={[styles.clockValue, { color }]}>{formatClock(elapsedSeconds)}</Text>
        <Text style={[styles.clockRemaining, { color }]}>
          {elapsedSeconds < 3600 ? `${Math.max(0, 60 - Math.floor(elapsedSeconds / 60))} min left` : 'Over 1 hour'}
        </Text>
      </View>
    );
  };

  const renderLegalBanner = () => (
    <View style={styles.legalBanner}>
      <Ionicons name="shield-checkmark" size={15} color={Colors.brand.gold} />
      <Text style={styles.legalText}>
        <Text style={styles.legalBold}>Good Samaritan Law protects you. </Text>
        No police detention. Eligible for ₹25,000 reward. (MV Act §134A)
      </Text>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE RENDERERS
  // ─────────────────────────────────────────────────────────────────────────

  const renderIntro = () => (
    <View style={styles.phaseContainer}>
      <View style={styles.introIconWrap}>
        <Ionicons name="medical" size={36} color="#FFFFFF" />
      </View>
      <Text style={styles.introTitle}>Help the Victim</Text>
      <Text style={styles.introSub}>
        BystAI will guide you step by step.{'\n'}
        Choose how to assess the injury:
      </Text>

      {renderGoldenHourClock()}

      <TouchableOpacity style={styles.primaryBtn} onPress={() => setPhase('camera')}>
        <Ionicons name="camera" size={20} color="#FFFFFF" />
        <View style={styles.btnTextBlock}>
          <Text style={styles.primaryBtnText}>Take Photo — AI Analysis</Text>
          <Text style={styles.primaryBtnSub}>Best accuracy · Requires internet</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={startOfflineQuestions}>
        <Ionicons name="list" size={20} color={Colors.brand.accent} />
        <View style={styles.btnTextBlock}>
          <Text style={[styles.primaryBtnText, { color: Colors.brand.accent }]}>
            Answer 5 Questions — Offline
          </Text>
          <Text style={styles.primaryBtnSub}>Works without internet</Text>
        </View>
      </TouchableOpacity>

      {renderLegalBanner()}
    </View>
  );

  const renderCamera = () => (
    <View style={styles.phaseContainer}>
      {renderGoldenHourClock()}
      <View style={styles.cameraIconWrap}>
        <Ionicons name="camera-outline" size={52} color={Colors.brand.primary} />
      </View>
      <Text style={styles.sectionTitle}>Take an Injury Photo</Text>
      <Text style={styles.cameraSub}>
        Stand 1 metre away from the victim.{'\n'}
        Ensure the injured area is visible and well-lit.
      </Text>

      <TouchableOpacity style={styles.primaryBtn} onPress={handleTakePhoto}>
        <Ionicons name="camera" size={20} color="#FFFFFF" />
        <Text style={styles.primaryBtnText}>Open Camera</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.ghostBtn} onPress={startOfflineQuestions}>
        <Text style={styles.ghostBtnText}>No camera — answer questions instead</Text>
      </TouchableOpacity>

      {renderLegalBanner()}
    </View>
  );

  const renderAnalyzing = () => (
    <View style={[styles.phaseContainer, styles.centeredPhase]}>
      <ActivityIndicator size="large" color={Colors.brand.primary} />
      <Text style={styles.analyzingTitle}>Analysing Injury…</Text>
      <Text style={styles.analyzingSub}>Claude Vision AI is assessing the photo</Text>
      {renderGoldenHourClock()}
    </View>
  );

  const renderQuestions = () => {
    if (!currentQuestion) return null;
    const totalQs = getTotalQuestions();
    const idx = getQuestionIndex(currentQuestion.id);
    const progress = ((idx + 1) / totalQs) * 100;

    return (
      <View style={styles.phaseContainer}>
        {renderGoldenHourClock()}

        {apiError && (
          <View style={styles.errorBanner}>
            <Ionicons name="wifi-outline" size={13} color={Colors.status.warning} />
            <Text style={styles.errorBannerText}>No internet — using offline assessment</Text>
          </View>
        )}

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` as `${number}%` }]} />
        </View>
        <Text style={styles.progressLabel}>Question {idx + 1} of {totalQs}</Text>

        <Text style={styles.questionText}>{currentQuestion.text}</Text>
        <Text style={styles.questionHint}>{currentQuestion.hint}</Text>

        <View style={styles.answerRow}>
          <TouchableOpacity
            style={[styles.answerBtn, styles.yesBtn]}
            onPress={() => handleAnswer('yes')}
            activeOpacity={0.75}
          >
            <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
            <Text style={styles.answerBtnText}>YES</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.answerBtn, styles.noBtn]}
            onPress={() => handleAnswer('no')}
            activeOpacity={0.75}
          >
            <Ionicons name="close-circle" size={22} color="#FFFFFF" />
            <Text style={styles.answerBtnText}>NO</Text>
          </TouchableOpacity>
        </View>

        {renderLegalBanner()}
      </View>
    );
  };

  const renderResults = () => {
    if (!protocol) return null;

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderGoldenHourClock()}

        {/* Injury header */}
        <View style={[styles.injuryHeader, { borderLeftColor: protocol.severityColor }]}>
          <Text style={styles.injuryLabel}>INJURY ASSESSMENT</Text>
          <Text style={styles.injuryType}>{protocol.injuryType}</Text>
          <View style={styles.severityRow}>
            <View style={[styles.severityBadge, { backgroundColor: protocol.severityColor }]}>
              <Text style={styles.severityText}>
                {getSeverityLabel(protocol.severity)} — {protocol.severity}/5
              </Text>
            </View>
          </View>
        </View>

        {/* CPR prompt */}
        {protocol.cprNeeded && (
          <TouchableOpacity style={styles.cprPrompt} onPress={handleStartCPR} activeOpacity={0.8}>
            <Ionicons name="heart" size={20} color="#FFFFFF" />
            <View>
              <Text style={styles.cprPromptTitle}>CPR Required — Start Coach</Text>
              <Text style={styles.cprPromptSub}>Tap to open the guided CPR coach</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* First aid steps */}
        <Text style={styles.stepsHeader}>FIRST AID STEPS</Text>
        {protocol.steps.map((step: string, i: number) => (
          <View key={i} style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}

        {/* Do not do */}
        {protocol.doNots.length > 0 && (
          <>
            <Text style={styles.doNotHeader}>DO NOT DO</Text>
            {protocol.doNots.map((item: string, i: number) => (
              <View key={i} style={styles.doNotCard}>
                <Ionicons name="close-circle" size={16} color={Colors.brand.primary} />
                <Text style={styles.doNotText}>{item}</Text>
              </View>
            ))}
          </>
        )}

        {renderLegalBanner()}

        <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
          <Text style={styles.doneBtnText}>Done Helping</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    );
  };

  const renderCPR = () => (
    <View style={styles.cprContainer}>
      {renderGoldenHourClock()}

      <Text style={styles.cprTitle}>CPR COACH</Text>
      <Text style={styles.cprSub}>Push to the rhythm — 110 per minute</Text>

      {/* Metronome circle */}
      <View style={styles.cprMetronomeWrap}>
        <Animated.View
          style={[
            styles.cprMetronome,
            { transform: [{ scale: cprPulse }] },
          ]}
        >
          <Text style={styles.cprMetronomeCount}>{compressionCount}</Text>
          <Text style={styles.cprMetronomeLabel}>pushes</Text>
        </Animated.View>
      </View>

      <View style={styles.cprInstructions}>
        <Text style={styles.cprInstLine}>
          <Text style={styles.bold}>30</Text> compressions → <Text style={styles.bold}>2</Text> breaths
        </Text>
        <Text style={styles.cprInstLine}>
          Push hard — at least <Text style={styles.bold}>5 cm</Text> deep
        </Text>
        {compressionCount > 0 && compressionCount % 30 >= 25 && (
          <Text style={[styles.cprInstLine, { color: Colors.brand.gold, fontWeight: '700' }]}>
            GIVE 2 BREATHS IN {30 - (compressionCount % 30)} compressions
          </Text>
        )}
      </View>

      {renderLegalBanner()}

      <TouchableOpacity style={styles.stopCprBtn} onPress={handleStopCPR}>
        <Text style={styles.stopCprText}>Stop CPR — Back to Instructions</Text>
      </TouchableOpacity>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const canGoBack = phase === 'camera' || phase === 'questions';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* ── Header bar ─────────────────────────────────────────── */}
        <View style={styles.header}>
          {canGoBack ? (
            <TouchableOpacity style={styles.headerBack} onPress={() => setPhase('intro')}>
              <Ionicons name="chevron-back" size={20} color={Colors.brand.primary} />
              <Text style={styles.headerBackText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBack} />
          )}

          <View style={styles.headerCenter}>
            <Ionicons name="medical" size={14} color={Colors.brand.primary} />
            <Text style={styles.headerTitle}>BystAI</Text>
          </View>

          <TouchableOpacity style={styles.headerClose} onPress={onClose}>
            <Ionicons name="close" size={20} color={Colors.label.secondary} />
          </TouchableOpacity>
        </View>

        {/* ── Phase content ───────────────────────────────────────── */}
        {phase === 'intro' && renderIntro()}
        {phase === 'camera' && renderCamera()}
        {phase === 'analyzing' && renderAnalyzing()}
        {phase === 'questions' && renderQuestions()}
        {phase === 'results' && renderResults()}
        {phase === 'cpr' && renderCPR()}
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    paddingTop: Platform.OS === 'ios' ? 54 : 32,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
    marginBottom: 4,
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 70,
    gap: 2,
  },
  headerBackText: {
    fontSize: 15,
    color: Colors.brand.primary,
    fontWeight: '500',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: 0.5,
  },
  headerClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.fill.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Phase containers
  phaseContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  centeredPhase: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // Golden hour clock
  clockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'center',
    marginBottom: 20,
  },
  clockLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  clockValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  clockRemaining: {
    fontSize: 11,
    fontWeight: '400',
    opacity: 0.8,
  },

  // Legal banner
  legalBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: `${Colors.brand.gold}12`,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: `${Colors.brand.gold}30`,
    padding: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  legalText: {
    flex: 1,
    fontSize: 12,
    color: Colors.label.primary,
    lineHeight: 17,
  },
  legalBold: {
    fontWeight: '700',
    color: Colors.brand.gold,
  },

  // Intro phase
  introIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 14,
    elevation: 8,
  },
  introTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  introSub: {
    fontSize: 14,
    color: Colors.label.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 12,
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  primaryBtnSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  btnTextBlock: {
    flex: 1,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.brand.accent}10`,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: `${Colors.brand.accent}30`,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 12,
  },
  ghostBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 8,
  },
  ghostBtnText: {
    fontSize: 14,
    color: Colors.label.secondary,
    textDecorationLine: 'underline',
  },

  // Camera phase
  cameraIconWrap: {
    alignSelf: 'center',
    marginVertical: 20,
  },
  cameraSub: {
    fontSize: 14,
    color: Colors.label.secondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },

  // Analyzing phase
  analyzingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  analyzingSub: {
    fontSize: 14,
    color: Colors.label.secondary,
    textAlign: 'center',
  },

  // Questions phase
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${Colors.status.warning}10`,
    borderRadius: BorderRadius.md,
    padding: 10,
    marginBottom: 12,
  },
  errorBannerText: {
    fontSize: 12,
    color: Colors.status.warning,
    fontWeight: '500',
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.fill.tertiary,
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.brand.primary,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: Colors.label.tertiary,
    textAlign: 'right',
    marginBottom: 20,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.3,
    lineHeight: 28,
    marginBottom: 8,
  },
  questionHint: {
    fontSize: 13,
    color: Colors.label.secondary,
    lineHeight: 19,
    marginBottom: 28,
    fontStyle: 'italic',
  },
  answerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  answerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
    borderRadius: BorderRadius.xl,
  },
  yesBtn: {
    backgroundColor: Colors.status.success,
  },
  noBtn: {
    backgroundColor: Colors.label.secondary,
  },
  answerBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },

  // Results phase
  injuryHeader: {
    borderLeftWidth: 4,
    paddingLeft: 14,
    marginBottom: 16,
  },
  injuryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.label.tertiary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  injuryType: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  severityRow: {
    flexDirection: 'row',
  },
  severityBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cprPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.brand.primary,
    borderRadius: BorderRadius.xl,
    padding: 16,
    marginBottom: 20,
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  cprPromptTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cprPromptSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  stepsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.label.tertiary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.background.grouped,
    borderRadius: BorderRadius.lg,
    padding: 14,
    marginBottom: 8,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: Colors.label.primary,
    lineHeight: 20,
  },
  doNotHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.primary,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 10,
  },
  doNotCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: `${Colors.brand.primary}08`,
    borderRadius: BorderRadius.md,
    padding: 12,
    marginBottom: 6,
  },
  doNotText: {
    flex: 1,
    fontSize: 13,
    color: Colors.label.primary,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.label.primary,
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  doneBtn: {
    backgroundColor: Colors.background.grouped,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  doneBtnText: {
    fontSize: 15,
    color: Colors.label.secondary,
    fontWeight: '600',
  },

  // CPR phase
  cprContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: '#050000',
  },
  cprTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.brand.primary,
    letterSpacing: 4,
    marginBottom: 4,
  },
  cprSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.50)',
    marginBottom: 24,
  },
  cprMetronomeWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  cprMetronome: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 5,
    borderColor: Colors.brand.primary,
    backgroundColor: `${Colors.brand.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  cprMetronomeCount: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 62,
  },
  cprMetronomeLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cprInstructions: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  cprInstLine: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  bold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stopCprBtn: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.20)',
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 24,
  },
  stopCprText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
});