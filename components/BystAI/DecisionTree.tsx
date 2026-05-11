/**
 * DecisionTree — Offline Injury Assessment
 *
 * WHY A DECISION TREE?
 * Claude Vision API needs internet. In a highway crash at 2 AM,
 * there is no internet. The decision tree works in airplane mode.
 *
 * WHY 5 QUESTIONS?
 * These 5 questions cover the 5 most critical emergency scenarios:
 * cardiac arrest, head trauma, fracture, burns, and spinal injury.
 * Together they account for ~95% of road accident presentations.
 *
 * EARLY EXIT:
 * If the person is not conscious AND not breathing, we skip to cardiac
 * arrest immediately without asking the remaining 3 questions — because
 * those seconds are needed for CPR, not more questions.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadows } from '../../theme';
import { DecisionTreeAnswers } from '../../services/BystAI';

interface Question {
  key: keyof DecisionTreeAnswers;
  question: string;
  hint: string;
  yesLabel: string;
  noLabel: string;
  iconName: string;
}

const QUESTIONS: Question[] = [
  {
    key: 'isConscious',
    question: 'Is the person conscious?',
    hint: 'Tap their shoulders firmly and shout "Are you OK?" — do they respond, open their eyes, or move?',
    yesLabel: 'Yes — they respond',
    noLabel: 'No — unresponsive',
    iconName: 'person',
  },
  {
    key: 'isBreathing',
    question: 'Is the person breathing?',
    hint: 'Look at the chest (is it rising?), listen near the mouth, feel for breath on your cheek. Take 10 seconds.',
    yesLabel: 'Yes — breathing',
    noLabel: 'No — not breathing',
    iconName: 'pulse',
  },
  {
    key: 'hasSpinalRisk',
    question: 'Could there be a neck or spine injury?',
    hint: 'High-speed crash, motorcycle accident, fall from height, or the victim complains of neck pain?',
    yesLabel: 'Yes — likely spine risk',
    noLabel: 'No — unlikely',
    iconName: 'body',
  },
  {
    key: 'hasBleeding',
    question: 'Is there visible bleeding or a suspected broken bone?',
    hint: 'Blood visible through clothing, a limb in an unnatural position, or the person cannot move a limb?',
    yesLabel: 'Yes — bleeding or break',
    noLabel: 'No — neither visible',
    iconName: 'bandage',
  },
  {
    key: 'hasBurns',
    question: 'Are there burns visible on the skin?',
    hint: 'Redness, blistering, or charred skin from fire, hot metal, chemicals, or friction.',
    yesLabel: 'Yes — burns visible',
    noLabel: 'No — no burns',
    iconName: 'flame',
  },
];

interface DecisionTreeProps {
  onComplete: (answers: DecisionTreeAnswers) => void;
}

export function DecisionTree({ onComplete }: DecisionTreeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<DecisionTreeAnswers>>({});

  function handleAnswer(answer: boolean) {
    const question = QUESTIONS[currentIndex];
    const updatedAnswers: Partial<DecisionTreeAnswers> = {
      ...answers,
      [question.key]: answer,
    };

    // EARLY EXIT: Not conscious + not breathing = cardiac arrest
    // Don't waste time on remaining questions — start CPR protocol
    if (
      question.key === 'isBreathing' &&
      !answer &&
      updatedAnswers.isConscious === false
    ) {
      const finalAnswers: DecisionTreeAnswers = {
        isConscious: false,
        isBreathing: false,
        hasBleeding: false,
        hasSpinalRisk: false,
        hasBurns: false,
      };
      onComplete(finalAnswers);
      return;
    }

    setAnswers(updatedAnswers);

    // Move to next question or complete
    if (currentIndex < QUESTIONS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete(updatedAnswers as DecisionTreeAnswers);
    }
  }

  function handleBack() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  const question = QUESTIONS[currentIndex];
  const progressPercent = Math.round((currentIndex / QUESTIONS.length) * 100);

  return (
    <View style={styles.container}>
      {/* Intro text */}
      <Text style={styles.intro}>
        Answer these quick questions to get the right first aid steps.
      </Text>

      {/* Progress */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%` as `${number}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {QUESTIONS.length}
        </Text>
      </View>

      {/* Question card */}
      <View style={styles.questionCard}>
        <View style={styles.questionIconWrap}>
          <Ionicons
            name={question.iconName as any}
            size={28}
            color={Colors.brand.accent}
          />
        </View>
        <Text style={styles.questionText}>{question.question}</Text>
        <Text style={styles.questionHint}>{question.hint}</Text>
      </View>

      {/* YES button */}
      <TouchableOpacity
        style={styles.yesBtn}
        onPress={() => handleAnswer(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="checkmark-circle" size={22} color="#fff" />
        <Text style={styles.yesBtnText}>{question.yesLabel}</Text>
      </TouchableOpacity>

      {/* NO button */}
      <TouchableOpacity
        style={styles.noBtn}
        onPress={() => handleAnswer(false)}
        activeOpacity={0.8}
      >
        <Ionicons name="close-circle" size={22} color={Colors.label.primary} />
        <Text style={styles.noBtnText}>{question.noLabel}</Text>
      </TouchableOpacity>

      {/* Back */}
      {currentIndex > 0 && (
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={14} color={Colors.label.secondary} />
          <Text style={styles.backBtnText}>Previous question</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  intro: {
    fontSize: 14,
    color: Colors.label.secondary,
    lineHeight: 20,
    textAlign: 'center',
  },

  // Progress bar
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.fill.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.brand.accent,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: Colors.label.tertiary,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },

  // Question card
  questionCard: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    ...Shadows.sm,
  },
  questionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${Colors.brand.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.label.primary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  questionHint: {
    fontSize: 13,
    color: Colors.label.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Answer buttons
  yesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.status.success,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    ...Shadows.sm,
  },
  yesBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  noBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: Colors.border.medium,
    ...Shadows.xs,
  },
  noBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.label.primary,
  },

  // Back button
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  backBtnText: {
    fontSize: 13,
    color: Colors.label.secondary,
  },
});