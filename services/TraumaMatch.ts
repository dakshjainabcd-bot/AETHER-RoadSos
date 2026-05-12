/**
 * TraumaMatch — Injury-to-Hospital Capability Matching
 *
 * THE MEDICAL LOGIC:
 * Different injuries need different hospital equipment.
 * Sending a head trauma victim to a hospital with no CT scanner
 * means the doctor cannot see the brain bleed → fatal delay.
 *
 * This file encodes that medical knowledge as simple data.
 * When BystAI (Phase 4) identifies the injury, TraumaMatch
 * looks up which hospital capabilities are required, then
 * asks HospitalRegistry to find the nearest matching hospital.
 *
 * INJURY → CAPABILITY MAPPING (medically grounded):
 *
 *   head_trauma  → neurosurgery + ct_scan
 *     (need to image the bleed and possibly operate)
 *
 *   cardiac      → cath_lab
 *     (heart attack = blocked artery = needs catheter lab to open it)
 *
 *   burns        → burn_unit
 *     (specialist wound care, skin grafts, infection control)
 *
 *   spinal       → neurosurgery
 *     (spinal cord compression may need decompression surgery)
 *
 *   paediatric   → paediatric_icu
 *     (children need child-sized equipment and specialist staff)
 *
 *   general      → emergency + blood_bank
 *     (bleeding, fractures — any A&E department with blood)
 *
 *   unknown      → emergency
 *     (we don't know yet — send to nearest A&E, escalate if needed)
 */

import { HospitalMatch, matchAllCapabilities, getHospitalsNearby } from './HospitalRegistry';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The injury types that the bystander can select.
 * In Phase 4, BystAI returns one of these strings.
 * In Phase 6, the user picks one from the InjuryTypeSelector UI.
 *
 * IMPORTANT: These string values are used as keys in INJURY_CAPABILITY_MAP below.
 * Do not rename them without updating that map.
 */
export type InjuryType =
  | 'head_trauma'
  | 'cardiac'
  | 'burns'
  | 'spinal'
  | 'paediatric'
  | 'general'
  | 'unknown';

/**
 * Human-readable info for each injury type.
 * Used by InjuryTypeSelector component.
 */
export interface InjuryTypeInfo {
  type: InjuryType;
  label: string;
  icon: string;           // Ionicons name
  color: string;          // Accent color for the chip
  description: string;    // Shown in tooltip / subtitle
}

/**
 * The result returned by matchHospital().
 * The SOS screen and HospitalMatchCard use this.
 */
export interface TraumaMatchResult {
  /** The best hospital found */
  hospital: HospitalMatch | null;
  /** The injury type that was matched */
  injuryType: InjuryType;
  /** Capabilities that were required */
  requiredCapabilities: string[];
  /** Whether a specialised hospital was found (vs generic emergency fallback) */
  isSpecialistMatch: boolean;
  /** Total hospitals searched */
  totalSearched: number;
}

// ─── Injury → Capability Map ──────────────────────────────────────────────────

/**
 * Maps each injury type to the hospital capabilities REQUIRED for that injury.
 *
 * Design principle: list only what is truly required.
 * More requirements = fewer matching hospitals = longer distance.
 * We prefer the minimal required set so we always find SOMETHING nearby.
 */
const INJURY_CAPABILITY_MAP: Record<InjuryType, string[]> = {
  head_trauma:  ['neurosurgery', 'ct_scan'],
  cardiac:      ['cath_lab'],
  burns:        ['burn_unit'],
  spinal:       ['neurosurgery'],
  paediatric:   ['paediatric_icu'],
  general:      ['emergency', 'blood_bank'],
  unknown:      ['emergency'],
};

/**
 * All injury types with their display info.
 * Import this in InjuryTypeSelector to render the chips.
 */
export const INJURY_TYPES: InjuryTypeInfo[] = [
  {
    type: 'head_trauma',
    label: 'Head / Brain',
    icon: 'brain-outline',
    color: '#FF3B30',
    description: 'Head injury, unconscious, skull trauma',
  },
  {
    type: 'cardiac',
    label: 'Heart / Cardiac',
    icon: 'heart-outline',
    color: '#FF6B35',
    description: 'Chest pain, cardiac arrest, heart attack',
  },
  {
    type: 'burns',
    label: 'Burns',
    icon: 'flame-outline',
    color: '#FF9500',
    description: 'Fire, chemical, or electrical burns',
  },
  {
    type: 'spinal',
    label: 'Spine / Neck',
    icon: 'body-outline',
    color: '#AF52DE',
    description: 'Back / neck pain, cannot move limbs',
  },
  {
    type: 'paediatric',
    label: 'Child (under 12)',
    icon: 'person-outline',
    color: '#007AFF',
    description: 'Infant or child victim',
  },
  {
    type: 'general',
    label: 'General / Bleeding',
    icon: 'bandage-outline',
    color: '#34C759',
    description: 'Fractures, bleeding, multiple injuries',
  },
  {
    type: 'unknown',
    label: 'Not Sure',
    icon: 'help-outline',
    color: '#8E8E93',
    description: 'Injury type unclear',
  },
];

// ─── Main Matching Function ───────────────────────────────────────────────────

/**
 * Find the best hospital for a given injury and crash location.
 *
 * ALGORITHM:
 * 1. Look up required capabilities for the injury type
 * 2. Search all hospitals within 150 km for that combination
 * 3. If found → return nearest specialist hospital (isSpecialistMatch = true)
 * 4. If NOT found → fall back to nearest ANY hospital (isSpecialistMatch = false)
 *    (better to get there alive than to search forever)
 *
 * @param lat         Crash latitude
 * @param lng         Crash longitude
 * @param injuryType  One of the InjuryType values
 * @returns           TraumaMatchResult with the best hospital and match details
 */
export function matchHospital(
  lat: number,
  lng: number,
  injuryType: InjuryType
): TraumaMatchResult {
  const required = INJURY_CAPABILITY_MAP[injuryType] ?? ['emergency'];

  console.log(`[TraumaMatch] Injury: ${injuryType} | Required: ${required.join(', ')}`);

  // ── PASS 1: Find specialist hospital ─────────────────────────────────
  const specialists = matchAllCapabilities(lat, lng, required, 150);

  if (specialists.length > 0) {
    const best = specialists[0]; // Already sorted by distance
    console.log(
      `[TraumaMatch] ✅ Specialist match: ${best.name} ` +
      `(${best.distanceText}, ETA ${best.etaMinutes} min)`
    );
    return {
      hospital: best,
      injuryType,
      requiredCapabilities: required,
      isSpecialistMatch: true,
      totalSearched: specialists.length,
    };
  }

  // ── PASS 2: Fallback — any hospital with emergency dept ───────────────
  console.warn(
    `[TraumaMatch] ⚠️ No specialist hospital found for ${injuryType}. ` +
    `Falling back to nearest hospital with emergency dept.`
  );
  const fallbacks = matchAllCapabilities(lat, lng, ['emergency'], 150);

  if (fallbacks.length > 0) {
    return {
      hospital: fallbacks[0],
      injuryType,
      requiredCapabilities: required,
      isSpecialistMatch: false,
      totalSearched: fallbacks.length,
    };
  }

  // ── PASS 3: Absolute fallback — any hospital at all ───────────────────
  console.error('[TraumaMatch] ❌ No hospital found within 150 km with any capability!');
  const any = getHospitalsNearby(lat, lng, 200);

  return {
    hospital: any[0] ?? null,
    injuryType,
    requiredCapabilities: required,
    isSpecialistMatch: false,
    totalSearched: any.length,
  };
}

/**
 * Get the required capabilities for an injury type.
 * Useful for displaying what kind of hospital is needed to the bystander.
 *
 * Example:
 *   getRequiredCapabilities('head_trauma')
 *   → ['neurosurgery', 'ct_scan']
 */
export function getRequiredCapabilities(injuryType: InjuryType): string[] {
  return INJURY_CAPABILITY_MAP[injuryType] ?? ['emergency'];
}

/**
 * Format a capability string for display.
 * Converts snake_case to Title Case with spaces.
 *
 * Examples:
 *   'neurosurgery'  → 'Neurosurgery'
 *   'cath_lab'      → 'Cath Lab'
 *   'paediatric_icu'→ 'Paediatric ICU'
 */
export function formatCapability(capability: string): string {
  const specialCases: Record<string, string> = {
    cath_lab: 'Cath Lab',
    paediatric_icu: 'Paediatric ICU',
    ct_scan: 'CT Scan',
    blood_bank: 'Blood Bank',
    burn_unit: 'Burn Unit',
  };
  if (specialCases[capability]) return specialCases[capability];
  return capability.charAt(0).toUpperCase() + capability.slice(1).replace(/_/g, ' ');
}