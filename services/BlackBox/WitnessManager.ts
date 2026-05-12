/**
 * Phase 7: Witness Manager
 * 
 * When an accident happens, nearby phones can help by sharing their sensor data.
 * This module:
 * 1. Receives SOS requests from crashed phones
 * 2. Shows consent dialog to witness
 * 3. Packages and signs witness data
 * 4. Sends data to incident phone
 * 
 * Privacy-first:
 * - User MUST consent before sharing
 * - No raw audio (only amplitude levels)
 * - Location only used for this incident
 * - Data cryptographically signed (can't be faked)
 */

import { WitnessConsentData, WitnessContribution, SensorReading } from './types';
import { RSACrypto } from './RSACrypto';

export class WitnessManager {
    private crypto: RSACrypto;
    private pendingRequests: Map<string, WitnessConsentData> = new Map();

    constructor(crypto: RSACrypto) {
        this.crypto = crypto;
    }

    /**
     * Receive an SOS request from a crashed phone
     * 
     * In production, this would come via:
     * - BLE (Bluetooth Low Energy) mesh network
     * - Or cellular network if available
     * 
     * @param request - Incident details from victim
     */
    public async receiveSOSRequest(request: WitnessConsentData): Promise<void> {
        console.log(`[WitnessManager] 🚨 Received SOS request for incident: ${request.incidentId}`);
        console.log(`[WitnessManager] Distance from victim: ${request.distanceFromVictim}m`);
        console.log(`[WitnessManager] Severity: ${request.severity}`);

        // Store request (waiting for user consent)
        this.pendingRequests.set(request.incidentId, request);

        // In a real app, this would trigger a notification
        // and show the consent dialog
        console.log('[WitnessManager] Consent dialog should be shown to user');
    }

    /**
     * Get pending SOS requests (for UI display)
     */
    public getPendingRequests(): WitnessConsentData[] {
        return Array.from(this.pendingRequests.values());
    }

    /**
     * User responds to consent dialog
     * 
     * @param incidentId - Which incident
     * @param consent - Did user agree to help?
     * @param bufferData - User's sensor data (if consent = true)
     */
    public async handleConsentResponse(
        incidentId: string,
        consent: boolean,
        bufferData: SensorReading[]
    ): Promise<WitnessContribution | null> {
        const request = this.pendingRequests.get(incidentId);
        if (!request) {
            console.error(`[WitnessManager] No pending request for incident: ${incidentId}`);
            return null;
        }

        // Remove from pending list
        this.pendingRequests.delete(incidentId);

        if (!consent) {
            console.log(`[WitnessManager] User declined to help with incident: ${incidentId}`);
            return null;
        }

        console.log(`[WitnessManager] ✅ User consented to share data for incident: ${incidentId}`);

        // Package and sign the witness contribution
        return await this.packageContribution(bufferData, request);
    }

    /**
     * Package witness data with cryptographic signature
     * 
     * Steps:
     * 1. Serialize buffer data to JSON
     * 2. Calculate SHA-256 hash (fingerprint)
     * 3. Sign hash with device's private key
     * 4. Create contribution object
     * 
     * @param bufferData - 90 seconds of sensor readings
     * @param request - Original SOS request
     * @returns Signed witness contribution
     */
    private async packageContribution(
        bufferData: SensorReading[],
        request: WitnessConsentData
    ): Promise<WitnessContribution> {
        console.log(`[WitnessManager] 📦 Packaging witness contribution...`);
        console.log(`[WitnessManager] Data points: ${bufferData.length}`);

        try {
            // Get device's RSA key pair
            const deviceId = this.crypto.getDeviceId();
            const publicKey = this.crypto.getPublicKey();

            if (!deviceId || !publicKey) {
                throw new Error('Device keys not available');
            }

            // Serialize buffer data
            const dataString = JSON.stringify(bufferData);

            // Sign the data
            const { dataHash, signature } = await this.crypto.signData(dataString);

            // Create contribution object
            const contribution: WitnessContribution = {
                deviceId,
                publicKey,
                bufferData,
                dataHash,
                signature,
                timestamp: Date.now(),
                consentGiven: true,
            };

            console.log(`[WitnessManager] ✅ Contribution packaged successfully`);
            console.log(`[WitnessManager] Device ID: ${deviceId}`);
            console.log(`[WitnessManager] Data hash: ${dataHash.substring(0, 16)}...`);
            console.log(`[WitnessManager] Signature: ${signature.substring(0, 16)}...`);

            return contribution;
        } catch (error) {
            console.error('[WitnessManager] ❌ Failed to package contribution:', error);
            throw error;
        }
    }

    /**
     * Send contribution to incident phone
     * 
     * In production, this would use:
     * - BLE (Bluetooth Low Energy) for direct transfer
     * - Or upload to server if victim phone offline
     * 
     * For MVP, we just return the contribution object
     * (real transmission happens in Phase 3 mesh network)
     */
    public async sendContribution(
        contribution: WitnessContribution,
        victimDeviceId: string
    ): Promise<boolean> {
        console.log(`[WitnessManager] 📡 Sending contribution to victim: ${victimDeviceId}`);
        console.log(`[WitnessManager] Data size: ${JSON.stringify(contribution).length} bytes`);

        // MVP: Simulated transmission
        // Production: Use BLE or mesh network

        try {
            // Simulate network delay
            await new Promise((resolve) => setTimeout(resolve, 1000));

            console.log('[WitnessManager] ✅ Contribution sent successfully');
            return true;
        } catch (error) {
            console.error('[WitnessManager] ❌ Failed to send contribution:', error);
            return false;
        }
    }

    /**
     * Verify a received contribution's signature
     * 
     * This is called by the incident phone to check if witness data is authentic
     * 
     * @param contribution - Witness contribution to verify
     * @returns true if signature is valid
     */
    public async verifyContribution(contribution: WitnessContribution): Promise<boolean> {
        console.log(`[WitnessManager] 🔍 Verifying contribution from: ${contribution.deviceId}`);

        try {
            // Serialize buffer data (same as witness did)
            const dataString = JSON.stringify(contribution.bufferData);

            // Verify signature
            const isValid = await this.crypto.verifySignature(
                dataString,
                contribution.dataHash,
                contribution.signature,
                contribution.publicKey
            );

            if (isValid) {
                console.log(`[WitnessManager] ✅ Contribution verified - authentic`);
            } else {
                console.log(`[WitnessManager] ❌ Contribution verification failed - possibly tampered`);
            }

            return isValid;
        } catch (error) {
            console.error('[WitnessManager] ❌ Verification error:', error);
            return false;
        }
    }

    /**
     * Calculate distance between two GPS coordinates
     * Uses Haversine formula (accounts for Earth's curvature)
     * 
     * @param lat1, lon1 - First location
     * @param lat2, lon2 - Second location
     * @returns Distance in meters
     */
    public calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const distance = R * c; // Distance in meters
        return Math.round(distance);
    }

    /**
     * Check if witness is close enough to be useful
     * 
     * Typically:
     * - < 50m = Very relevant (direct witness)
     * - 50-200m = Relevant (nearby area)
     * - > 200m = Less relevant but may still help
     */
    public isRelevantWitness(distanceMeters: number): boolean {
        const MAX_RELEVANT_DISTANCE = 200; // meters
        return distanceMeters <= MAX_RELEVANT_DISTANCE;
    }

    /**
     * Format consent dialog message
     * Shows user clear information about what they're consenting to
     */
    public formatConsentMessage(request: WitnessConsentData): string {
        const distance = request.distanceFromVictim;
        const distanceText =
            distance < 50
                ? 'very close to you'
                : distance < 200
                    ? `${distance}m from you`
                    : `${(distance / 1000).toFixed(1)}km from you`;

        return `🚨 Emergency Alert

An accident just occurred ${distanceText}.

Can you help by sharing your last 90 seconds of sensor data?

What will be shared:
✓ Your phone's movement data (accelerometer/gyroscope)
✓ Your GPS location
✓ Sound levels (NOT audio recordings)

Privacy protection:
✓ No audio recordings
✓ Location only used for this incident
✓ Data cryptographically signed
✓ You can decline without consequence

This data may help:
- Determine accident cause
- Support victim's insurance claim
- Hold responsible parties accountable`;
    }

    /**
     * Get consent dialog options
     */
    public getConsentOptions() {
        return {
            acceptText: 'Share My Data',
            declineText: 'No Thanks',
            learnMoreText: 'What data is shared?',
        };
    }

    /**
     * Clear all pending requests (for testing)
     */
    public clearPendingRequests(): void {
        this.pendingRequests.clear();
        console.log('[WitnessManager] All pending requests cleared');
    }

    /**
     * Get statistics (for debugging)
     */
    public getStats() {
        return {
            pendingRequests: this.pendingRequests.size,
            requests: Array.from(this.pendingRequests.keys()),
        };
    }
}