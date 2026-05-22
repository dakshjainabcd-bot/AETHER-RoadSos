/**
 * PsychAid Types — Psychological First Aid Module — Phase 11
 *
 * WHY PSYCHOLOGICAL FIRST AID?
 * Research shows that how bystanders SPEAK to victims dramatically
 * affects survival rates. Calm, structured communication:
 * - Reduces panic (which raises heart rate and blood pressure)
 * - Keeps the victim still (preventing further injury)
 * - Reduces psychological trauma
 * - Helps the bystander stay calm too
 *
 * These scripts are based on WHO Psychological First Aid guidelines.
 */

export type PsychAidPhase =
  | 'connect'   // Phase 1: Establish safety and presence
  | 'assess'    // Phase 2: Ask about needs, maintain contact
  | 'reassure'  // Phase 3: Reassure about help coming
  | 'breathe';  // Phase 4: Guided calm breathing

export interface PsychAidScript {
  phase: PsychAidPhase;
  phaseLabel: string;       // Human-readable phase name shown in UI
  scriptForVictim: string;  // What the BYSTANDER reads ALOUD to the victim
  coachNote: string;        // Italic coaching note for the bystander (not read aloud)
}

export interface PsychAidConfig {
  scripts: PsychAidScript[];
  bystanderNote: string;    // General note shown at top of panel
}

// Injury types from BystAI — same string values, kept separate to avoid circular imports
export type BystAIInjuryType =
  | 'cardiac_arrest'
  | 'head_trauma'
  | 'fracture'
  | 'burns'
  | 'spinal';