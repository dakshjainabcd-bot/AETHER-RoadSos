/**
 * BadgeTypes.ts — Phase 13: Trust & Gamification
 *
 * Defines all 8 badge types that Rakshak volunteers can earn.
 *
 * CONCEPT:
 * Each badge is defined by:
 * - id: a unique string used as a database key
 * - threshold: how much progress is needed (e.g., 10 relays, 120 CPR seconds)
 * - unit: what we measure (relays, seconds, days, etc.)
 *
 * The BadgeService reads these definitions to know when to award a badge.
 */

// The 8 unique badge IDs
export type BadgeId =
  | 'first_responder'       // Arrived at scene within 10 minutes
  | 'cpr_hero'              // Performed CPR for 2+ minutes
  | 'relay_node'            // Relayed 10+ SOS packets via mesh
  | 'blackspot_reporter'    // Reported 5+ road hazards
  | 'multilingual_helper'   // Helped in a different language
  | 'evidence_witness'      // Donated sensor data to 3+ incidents
  | 'safe_driver'           // 30-day safe driving streak
  | 'lifesaver';            // Received hospital READY reply for victim helped

// Complete definition of a single badge
export interface BadgeDefinition {
  id: BadgeId;
  name: string;          // Short display name
  description: string;   // What this badge means to earn
  howToEarn: string;     // Clear instruction shown to the user
  icon: string;          // Ionicons icon name
  color: string;         // Accent color for this badge
  threshold: number;     // Progress value needed to earn it
  unit: string;          // Label for the progress unit
}

// All 8 badge definitions — the single source of truth
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_responder',
    name: 'First Responder',
    description:
      'You arrived at an accident scene within 10 minutes of an SOS alert. Your speed could have saved a life.',
    howToEarn: 'Arrive at a crash scene within 10 min of the SOS alert',
    icon: 'flash',
    color: '#FF6B35',
    threshold: 1,
    unit: 'arrival',
  },
  {
    id: 'cpr_hero',
    name: 'CPR Hero',
    description:
      'You performed CPR compressions for more than 2 minutes. That sustained effort keeps blood flowing to the brain.',
    howToEarn: 'Perform CPR for 2+ minutes using the AETHER CPR Coach',
    icon: 'heart',
    color: '#FF3B30',
    threshold: 120, // 120 seconds = 2 minutes
    unit: 'seconds of CPR',
  },
  {
    id: 'relay_node',
    name: 'Relay Node',
    description:
      'Your phone has relayed 10 or more SOS signals through the mesh network, extending the reach of crash alerts.',
    howToEarn: 'Successfully relay 10+ SOS packets via the AETHER mesh network',
    icon: 'radio',
    color: '#007AFF',
    threshold: 10,
    unit: 'relays',
  },
  {
    id: 'blackspot_reporter',
    name: 'Blackspot Reporter',
    description:
      'You have reported 5 or more road hazards, helping the community avoid danger zones.',
    howToEarn: 'Report 5+ road hazards using the AETHER Map screen',
    icon: 'warning',
    color: '#FF9500',
    threshold: 5,
    unit: 'hazard reports',
  },
  {
    id: 'multilingual_helper',
    name: 'Multilingual Helper',
    description:
      'You helped an accident victim in a language different from your own app language.',
    howToEarn: 'Use the Multilingual Bridge to communicate in a different language at a scene',
    icon: 'language',
    color: '#5856D6',
    threshold: 1,
    unit: 'cross-language assist',
  },
  {
    id: 'evidence_witness',
    name: 'Evidence Witness',
    description:
      'You donated your sensor data to 3 or more accident incidents, building a stronger evidence chain for victims.',
    howToEarn: 'Share your device sensor data for 3+ nearby incidents via the Black Box',
    icon: 'shield-checkmark',
    color: '#34C759',
    threshold: 3,
    unit: 'evidence contributions',
  },
  {
    id: 'safe_driver',
    name: 'Safe Driver',
    description:
      'You maintained a safe driving record for 30 consecutive days without any crash detection events.',
    howToEarn: 'Drive for 30 consecutive days without triggering crash detection',
    icon: 'car',
    color: '#30B0C7',
    threshold: 30,
    unit: 'safe days',
  },
  {
    id: 'lifesaver',
    name: 'Lifesaver',
    description:
      'A hospital confirmed READY status for a victim you helped. Your actions directly connected a victim to the right care.',
    howToEarn: 'Help a crash victim and receive a hospital READY confirmation',
    icon: 'medal',
    color: '#FFD700',
    threshold: 1,
    unit: 'hospital ready confirmation',
  },
];

/**
 * Helper: get a badge definition by its ID.
 * Returns undefined if the ID doesn't exist.
 */
export function getBadgeById(id: BadgeId): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find((b) => b.id === id);
}