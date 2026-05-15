/**
 * Phase 8: Black Box Evidence System - Type Definitions
 * 
 * This file defines all the data structures used in the black box system.
 * Think of it as the "contract" that all components follow.
 */

/**
 * A single sensor reading snapshot
 * Captured every 100ms (10 times per second)
 */
export interface SensorReading {
    timestamp: number;              // Unix timestamp in milliseconds
    accelerometer: {                // Phone movement
        x: number;                    // Forward/backward tilt
        y: number;                    // Left/right tilt
        z: number;                    // Up/down (gravity direction)
    };
    gyroscope: {                    // Phone rotation
        x: number;                    // Pitch (front-to-back rotation)
        y: number;                    // Roll (side-to-side rotation)
        z: number;                    // Yaw (spinning rotation)
    };
    gps: {                          // Location
        latitude: number;
        longitude: number;
        speed: number | null;         // Speed in m/s
        accuracy: number | null;      // GPS accuracy in meters
    };
    audioEnvelope: number;          // Sound level (0-100), NOT raw audio for privacy
}

/**
 * Circular buffer configuration
 * Buffer size: 90 seconds × 10 readings/sec = 900 readings
 */
export interface CircularBufferConfig {
    maxSize: number;                // 900 readings (90 seconds at 10 Hz)
    samplingRate: number;           // 100ms = 10 Hz
}

/**
 * RSA key pair for signing evidence
 * Generated once per device on first launch
 */
export interface RSAKeyPair {
    publicKey: string;              // PEM format public key (shareable)
    privateKey: string;             // PEM format private key (SECRET - never share)
    deviceId: string;               // Unique device identifier
}

/**
 * Witness contribution - data shared by a nearby phone
 */
export interface WitnessContribution {
    deviceId: string;               // Unique ID of witness phone
    publicKey: string;              // Witness's public RSA key (for verification)
    bufferData: SensorReading[];    // Their 90-second sensor recording
    dataHash: string;               // SHA-256 hash of bufferData (integrity check)
    signature: string;              // RSA signature of dataHash (proof it's authentic)
    timestamp: number;              // When they contributed
    consentGiven: boolean;          // Did they agree to share?
}

/**
 * Complete evidence package for one incident
 * This is what gets uploaded to cloud and used in court
 */
export interface EvidencePackage {
    incidentId: string;             // Unique incident identifier (UUID)
    victimData: {                   // Data from the crashed phone
        deviceId: string;
        bufferData: SensorReading[];
        crashTimestamp: number;       // Exact moment of crash detection
        crashSeverity: number;        // 1-10 scale from Phase 3
        location: {
            latitude: number;
            longitude: number;
        };
    };
    witnessContributions: WitnessContribution[];  // All witness data
    verificationStatus: {           // Which contributions are valid
        [deviceId: string]: boolean;  // true = verified, false = tampered
    };
    createdAt: number;              // When evidence package assembled
    uploadedToCloud: boolean;       // Whether uploaded to S3
    cloudUrl?: string;              // S3 URL if uploaded
}

/**
 * Road classification for legal filing
 * NH = National Highway (NHAI)
 * SH = State Highway (State PWD)
 * MDR = Major District Road (District authority)
 * ODR = Other District Road (Municipality)
 */
export type RoadClassification = 'NH' | 'SH' | 'MDR' | 'ODR' | 'UNKNOWN';

/**
 * Road authority contact information
 */
export interface RoadAuthority {
    type: RoadClassification;
    name: string;                   // e.g., "NHAI" or "Haryana State PWD"
    email: string;                  // Grievance portal email
    statute: string;                // Legal reference (e.g., "National Highways Act Section 27")
    portalUrl?: string;             // Online complaint portal
}

/**
 * Legal notice template data
 */
export interface LegalNoticeData {
    incidentId: string;
    roadClassification: RoadClassification;
    authority: RoadAuthority;
    location: {
        latitude: number;
        longitude: number;
        address: string;              // Reverse geocoded address
    };
    timestamp: number;              // Incident time
    severity: string;               // "Minor", "Moderate", "Severe"
    witnessCount: number;           // Number of witness contributions
    evidenceUrl: string;            // S3 URL of evidence package
    description: string;            // Human-readable incident summary
}

/**
 * Case tracking in database
 */
export interface RepairCase {
    incidentId: string;
    authority: string;              // Authority name
    caseId?: string;                // Case ID from government reply
    filedAt: number;                // When complaint was sent
    status: 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
    lastEscalation?: number;        // Last escalation reminder timestamp
    replies: Array<{                // Email thread
        from: string;
        subject: string;
        body: string;
        receivedAt: number;
    }>;
}

/**
 * Black box system state
 */
export interface BlackBoxState {
    isRecording: boolean;           // Is sensor collection active?
    bufferSize: number;             // Current number of readings in buffer
    lastReading?: SensorReading;    // Most recent sensor snapshot
    deviceKeys?: RSAKeyPair;        // This device's RSA keys
    crashDetected: boolean;         // Has Phase 3 crash detector triggered?
    frozenBuffer?: SensorReading[]; // Buffer frozen at crash moment
    incidentId?: string;            // Active incident ID
}

/**
 * Witness consent dialog data
 */
export interface WitnessConsentData {
    incidentId: string;             // Which incident needs help?
    victimLocation: {
        latitude: number;
        longitude: number;
    };
    distanceFromVictim: number;     // Meters away from crash site
    requestedAt: number;            // When SOS received
    severity: string;               // Crash severity level
}

/**
 * Storage keys for AsyncStorage
 */
export const BLACK_BOX_STORAGE_KEYS = {
    RSA_KEYS: '@aether/blackbox/rsa_keys',           // Device RSA key pair
    FROZEN_BUFFER: '@aether/blackbox/frozen_buffer', // Buffer at crash
    INCIDENT_DATA: '@aether/blackbox/incident_data', // Current incident
    EVIDENCE_PACKAGES: '@aether/blackbox/evidence',  // All evidence packages
    REPAIR_CASES: '@aether/blackbox/repair_cases',   // Legal case tracking
} as const;

/**
 * Configuration constants
 */
export const BLACK_BOX_CONFIG = {
    BUFFER_DURATION_SECONDS: 90,           // 90 second recording window
    SAMPLING_RATE_MS: 100,                 // 100ms = 10 Hz
    MAX_BUFFER_SIZE: 900,                  // 90s × 10Hz = 900 readings
    AUDIO_ENVELOPE_SMOOTHING: 0.3,         // Audio smoothing factor
    CRASH_BUFFER_FREEZE_DELAY_MS: 500,     // Delay before freezing buffer
    WITNESS_CONSENT_TIMEOUT_MS: 60000,     // 60 seconds to respond
    RSA_KEY_SIZE: 1024,                    // 1024-bit for dev speed (use 2048 in production)
    HASH_ALGORITHM: 'SHA-256',             // Hash function for signatures
} as const;

/**
 * Road classification database (sample data)
 * In production, this would be a GeoJSON file or API
 */
export const ROAD_CLASSIFICATIONS: { [key: string]: RoadAuthority } = {
    'NH': {
        type: 'NH',
        name: 'National Highways Authority of India (NHAI)',
        email: 'grievance-hq@nhai.org',
        statute: 'National Highways Act, 1956 - Section 27',
        portalUrl: 'https://cgrs.nhai.gov.in/',
    },
    'SH_HR': {
        type: 'SH',
        name: 'Haryana State Public Works Department',
        email: 'pws-hry@nic.in',
        statute: 'Haryana State Highways Act - Section 15',
        portalUrl: 'https://haryanapwd.gov.in/complaints',
    },
    'MDR': {
        type: 'MDR',
        name: 'District Roads & Buildings',
        email: 'drrb@district.gov.in',
        statute: 'District Roads Act - Section 12',
    },
    'ODR': {
        type: 'ODR',
        name: 'Municipal Corporation',
        email: 'complaints@municipal.gov.in',
        statute: 'Municipality Act - Section 8',
    },
};