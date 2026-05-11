/**
 * BystAI Service — Injury Assessment and First Aid Protocol Retrieval
 *
 * This service handles two things:
 * 1. Decision tree logic: maps yes/no answers → injury type
 * 2. Protocol retrieval: returns the correct first aid data for that injury
 *
 * ONLINE PATH (optional): Claude Vision API for photo analysis
 * OFFLINE PATH (primary): Rule-based decision tree — always works, no internet needed
 *
 * WHY OFFLINE FIRST?
 * A crash on NH-44 at 2 AM has no internet. The offline path ensures
 * a bystander always gets life-saving guidance regardless of connectivity.
 */

import firstAidData from '../assets/data/first_aid_protocols.json';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InjuryType =
  | 'cardiac_arrest'
  | 'head_trauma'
  | 'fracture'
  | 'burns'
  | 'spinal';

export interface DecisionTreeAnswers {
  isConscious: boolean;     // Q1: Is the person responding?
  isBreathing: boolean;     // Q2: Are they breathing normally?
  hasBleeding: boolean;     // Q3: Visible bleeding or broken bone?
  hasSpinalRisk: boolean;   // Q4: High-speed crash, neck/spine injury risk?
  hasBurns: boolean;        // Q5: Burns visible on skin?
}

export interface FirstAidStep {
  id: string;
  title: string;
  description: string;
  warning: boolean;  // true = show with red warning styling
}

export interface FirstAidProtocol {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  severity: number;
  callAmbulance: boolean;
  cprRequired: boolean;
  steps: FirstAidStep[];
  doNot: string[];
}

// ─── Decision Tree Logic ─────────────────────────────────────────────────────

/**
 * Determines injury type from decision tree answers.
 *
 * Decision logic (priority order — most critical first):
 *
 * 1. Not conscious + Not breathing → CARDIAC ARREST (CPR immediately!)
 * 2. Spinal risk present → SPINAL INJURY (overrides most others)
 * 3. Not conscious + Breathing → HEAD TRAUMA
 * 4. Burns visible → BURNS
 * 5. Bleeding / default → FRACTURE
 *
 * The priority order matters: cardiac arrest and spinal are the most
 * dangerous and time-critical, so they are checked first.
 */
export function determineInjuryType(answers: DecisionTreeAnswers): InjuryType {
  // Priority 1: Not conscious AND not breathing → cardiac arrest
  // This is the most time-critical — every second without CPR reduces survival
  if (!answers.isConscious && !answers.isBreathing) {
    return 'cardiac_arrest';
  }

  // Priority 2: Spinal risk → spinal (even if conscious)
  // Moving someone with a spinal injury can cause permanent paralysis
  if (answers.hasSpinalRisk) {
    return 'spinal';
  }

  // Priority 3: Unconscious but breathing → head trauma
  // They need airway management and monitoring
  if (!answers.isConscious && answers.isBreathing) {
    return 'head_trauma';
  }

  // Priority 4: Burns visible
  if (answers.hasBurns) {
    return 'burns';
  }

  // Priority 5: Bleeding / broken bone, or general conscious trauma
  return 'fracture';
}

/**
 * Returns the complete first aid protocol for a given injury type.
 * Data is read from the bundled JSON file — works 100% offline.
 */
export function getProtocol(injuryType: InjuryType): FirstAidProtocol {
  const data = firstAidData as Record<string, FirstAidProtocol>;
  return data[injuryType];
}

/**
 * Returns a human-readable summary of what the injury type means.
 * Used in the "here's what we think" confirmation step.
 */
export function getInjurySummary(injuryType: InjuryType): string {
  const summaries: Record<InjuryType, string> = {
    cardiac_arrest:
      'The person is not breathing. This is a cardiac emergency requiring immediate CPR.',
    head_trauma:
      'The person is unconscious but breathing. They likely have a head injury. Do not move them.',
    fracture:
      'The person has visible bleeding or a suspected broken bone. Control bleeding first.',
    burns:
      'The person has visible burns. Cool immediately with running water for 20 minutes.',
    spinal:
      'There is a risk of spinal injury. The person must not be moved under any circumstances.',
  };
  return summaries[injuryType];
}

/**
 * Maps app language code to BCP-47 tag for expo-speech.
 *
 * expo-speech needs language tags like 'hi-IN', 'ta-IN', 'en-US'.
 * Our app uses codes like 'hi', 'ta', 'en'.
 */
export function getSpokenLanguageTag(languageCode: string): string {
  const langMap: Record<string, string> = {
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    mr: 'mr-IN',
    bn: 'bn-IN',
    gu: 'gu-IN',
    pa: 'pa-IN',
    en: 'en-US',
    fr: 'fr-FR',
    ar: 'ar-SA',
    zh: 'zh-CN',
    es: 'es-ES',
  };
  return langMap[languageCode] ?? 'en-US';
}