/**
 * Phase 8: Black Box System - Main Exports
 * 
 * This file provides clean exports for all black box components.
 * 
 * Usage:
 * import { BlackBoxManager, BLACK_BOX_CONFIG } from '@/services/BlackBox';
 */

import { BlackBoxManager } from './BlackBoxManager';

// Main orchestrator (most commonly used)
export { BlackBoxManager } from './BlackBoxManager';

// Individual components (for advanced usage)
export { CircularBuffer } from './CircularBuffer';
export { SensorCollector } from './SensorCollector';
export { RSACrypto } from './RSACrypto';
export { WitnessManager } from './WitnessManager';
export { EvidencePackager } from './EvidencePackager';
export { LegalNoticeGenerator } from './LegalNoticeGenerator';

// Types and constants
export type {
    SensorReading,
    CircularBufferConfig,
    RSAKeyPair,
    WitnessContribution,
    WitnessConsentData,
    EvidencePackage,
    RoadClassification,
    RoadAuthority,
    LegalNoticeData,
    RepairCase,
    BlackBoxState,
} from './types';

export {
    BLACK_BOX_CONFIG,
    BLACK_BOX_STORAGE_KEYS,
    ROAD_CLASSIFICATIONS,
} from './types';

// Singleton instance for easy access
let blackBoxInstance: BlackBoxManager | null = null;

/**
 * Get the global Black Box manager instance
 * Creates one if it doesn't exist
 * 
 * Usage:
 * const blackBox = getBlackBoxManager();
 * await blackBox.initialize();
 */
export function getBlackBoxManager(): BlackBoxManager {
    if (!blackBoxInstance) {
        blackBoxInstance = new BlackBoxManager();
        console.log('[BlackBox] Created singleton instance');
    }
    return blackBoxInstance;
}

/**
 * Reset the global instance (for testing)
 */
export function resetBlackBoxManager(): void {
    blackBoxInstance = null;
    console.log('[BlackBox] Singleton instance reset');
}