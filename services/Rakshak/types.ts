// services/Rakshak/types.ts
/**
 * Rakshak Type Definitions — Phase 7
 * 
 * A Rakshak is a certified first-aid volunteer.
 * They register in the app, get verified, and receive alerts.
 */

export type CertificateType = 
  | 'red_cross'
  | 'st_john_ambulance'
  | 'first_aid_cert'
  | 'medical_professional'
  | 'other';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

// ── Main Rakshak Profile ───────────────────────────────────────────────────

export interface RakshakProfile {
  uid: string;                    // Firebase Auth UID
  name: string;                   // Full name
  phone: string;                  // Phone number
  address: string;                // Home address (for proximity calculation)
  certificateType: CertificateType;
  certificateImageUrl?: string;   // Firebase Storage URL
  verificationStatus: VerificationStatus;
  registeredAt: number;           // Unix ms
  fcmToken?: string;              // Push notification token
  isActive: boolean;              // Has the Rakshak opted in to receive alerts?
}

// ── Incident Response Log ──────────────────────────────────────────────────

export interface RakshakResponse {
  responseId: string;
  incidentId: string;
  rakshakUid: string;
  arrivedAt?: number;             // Unix ms when they arrived at scene
  handoverAt?: number;            // Unix ms when they handed over to ambulance
  interventions: string[];        // What they did (CPR, wound pressure, etc.)
  notes: string;                  // Free text observations
}

// ── Good Samaritan PDF Data ─────────────────────────────────────────────────

// Badge reference (inline to avoid circular dependencies)
export interface EarnedBadgeRef {
  badgeId: string;
  earnedAt: number;
}

export interface RewardClaimData {
  rakshakName: string;
  rakshakPhone: string;
  certificateNumber: string;
  certificateType: string;
  incidentId: string;
  incidentGPS: string;
  incidentDate: string;
  arrivalTime: string;
  handoverTime: string;
  interventions: string[];
  ambulanceDetails: string;
  earnedBadges?: EarnedBadgeRef[]; // NEW — optional badge list for PDF
  // ── NEW FIELDS ────────────────────────────────────────
  proofImageBase64?: string[];   // Base64-encoded proof photos
  proofImageLabels?: string[];   // Label for each photo (e.g. "Accident Scene")
  additionalNotes?: string;      // Free-text notes from the Rakshak
}

// ── Storage Keys ────────────────────────────────────────────────────────────

export const RAKSHAK_STORAGE_KEYS = {
  PROFILE: 'aether_rakshak_profile',
  FCM_TOKEN: 'aether_fcm_token',
  ACTIVE_RESPONSE: 'aether_active_response',
} as const;