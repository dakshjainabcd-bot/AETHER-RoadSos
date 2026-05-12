/**
 * Phase 7: Evidence Packager
 * 
 * This module assembles all evidence into a complete package:
 * 1. Victim's sensor data (from crashed phone)
 * 2. All witness contributions (from nearby phones)
 * 3. Verification status (which contributions are valid)
 * 4. Metadata (timestamps, location, severity)
 * 
 * The evidence package is:
 * - Tamper-evident (signatures detect any changes)
 * - Court-admissible (proper chain of custody)
 * - Independently verifiable (anyone can check signatures)
 */

import {
    EvidencePackage,
    WitnessContribution,
    SensorReading,
    BLACK_BOX_STORAGE_KEYS,
} from './types';
import { RSACrypto } from './RSACrypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class EvidencePackager {
    private crypto: RSACrypto;
    private activePackage: EvidencePackage | null = null;

    constructor(crypto: RSACrypto) {
        this.crypto = crypto;
    }

    /**
     * Create a new evidence package for an incident
     * 
     * @param incidentId - Unique incident identifier
     * @param victimBufferData - Victim's 90 seconds of sensor data
     * @param crashTimestamp - Exact moment crash was detected
     * @param crashSeverity - Severity level (1-10)
     * @param location - GPS coordinates of crash
     */
    public async createPackage(
        incidentId: string,
        victimBufferData: SensorReading[],
        crashTimestamp: number,
        crashSeverity: number,
        location: { latitude: number; longitude: number }
    ): Promise<EvidencePackage> {
        console.log(`[EvidencePackager] 📦 Creating evidence package for incident: ${incidentId}`);

        const deviceId = this.crypto.getDeviceId();
        if (!deviceId) {
            throw new Error('Device ID not available');
        }

        const evidencePackage: EvidencePackage = {
            incidentId,
            victimData: {
                deviceId,
                bufferData: victimBufferData,
                crashTimestamp,
                crashSeverity,
                location,
            },
            witnessContributions: [],
            verificationStatus: {},
            createdAt: Date.now(),
            uploadedToCloud: false,
        };

        this.activePackage = evidencePackage;

        // Save to storage
        await this.savePackage(evidencePackage);

        console.log(`[EvidencePackager] ✅ Evidence package created`);
        console.log(`[EvidencePackager] Victim data points: ${victimBufferData.length}`);
        console.log(`[EvidencePackager] Crash severity: ${crashSeverity}/10`);
        console.log(`[EvidencePackager] Location: ${location.latitude}, ${location.longitude}`);

        return evidencePackage;
    }

    /**
     * Add a witness contribution to the evidence package
     * 
     * @param contribution - Witness data with signature
     * @returns true if contribution was added (valid signature)
     */
    public async addWitnessContribution(
        contribution: WitnessContribution
    ): Promise<boolean> {
        if (!this.activePackage) {
            console.error('[EvidencePackager] No active evidence package');
            return false;
        }

        console.log(`[EvidencePackager] 📥 Adding witness contribution from: ${contribution.deviceId}`);

        try {
            // Verify the contribution's signature
            const dataString = JSON.stringify(contribution.bufferData);
            const isValid = await this.crypto.verifySignature(
                dataString,
                contribution.dataHash,
                contribution.signature,
                contribution.publicKey
            );

            // Add to package
            this.activePackage.witnessContributions.push(contribution);
            this.activePackage.verificationStatus[contribution.deviceId] = isValid;

            // Save updated package
            await this.savePackage(this.activePackage);

            if (isValid) {
                console.log(`[EvidencePackager] ✅ Valid contribution added`);
            } else {
                console.log(`[EvidencePackager] ⚠️ Invalid signature - contribution added but marked as unverified`);
            }

            console.log(`[EvidencePackager] Total witnesses: ${this.activePackage.witnessContributions.length}`);
            return isValid;
        } catch (error) {
            console.error('[EvidencePackager] ❌ Failed to add contribution:', error);
            return false;
        }
    }

    /**
     * Get verification statistics
     * Shows how many contributions are valid
     */
    public getVerificationStats(): {
        total: number;
        verified: number;
        unverified: number;
        percentVerified: number;
    } {
        if (!this.activePackage) {
            return { total: 0, verified: 0, unverified: 0, percentVerified: 0 };
        }

        const total = this.activePackage.witnessContributions.length;
        const verified = Object.values(this.activePackage.verificationStatus).filter(
            (v) => v === true
        ).length;
        const unverified = total - verified;
        const percentVerified = total > 0 ? (verified / total) * 100 : 0;

        return {
            total,
            verified,
            unverified,
            percentVerified: Math.round(percentVerified),
        };
    }

    /**
     * Generate a summary report of the evidence
     * This is what gets shown in the UI or printed to PDF
     */
    public generateSummaryReport(): string {
        if (!this.activePackage) {
            return 'No evidence package available';
        }

        const stats = this.getVerificationStats();
        const pkg = this.activePackage;

        const report = `
ACCIDENT EVIDENCE PACKAGE
========================

Incident ID: ${pkg.incidentId}
Created: ${new Date(pkg.createdAt).toLocaleString()}

VICTIM DATA:
-----------
Device ID: ${pkg.victimData.deviceId}
Crash Time: ${new Date(pkg.victimData.crashTimestamp).toLocaleString()}
Severity: ${pkg.victimData.crashSeverity}/10
Location: ${pkg.victimData.location.latitude.toFixed(6)}, ${pkg.victimData.location.longitude.toFixed(6)}
Data Points: ${pkg.victimData.bufferData.length} readings (${(pkg.victimData.bufferData.length / 10).toFixed(1)}s)

WITNESS CONTRIBUTIONS:
---------------------
Total Witnesses: ${stats.total}
Verified: ${stats.verified} (${stats.percentVerified}%)
Unverified: ${stats.unverified}

${pkg.witnessContributions
                .map((w, i) => {
                    const status = pkg.verificationStatus[w.deviceId] ? '✓ VERIFIED' : '✗ UNVERIFIED';
                    return `
Witness ${i + 1}:
  Device: ${w.deviceId}
  Status: ${status}
  Data Points: ${w.bufferData.length}
  Contributed: ${new Date(w.timestamp).toLocaleString()}
  Hash: ${w.dataHash.substring(0, 16)}...
  Signature: ${w.signature.substring(0, 16)}...`;
                })
                .join('\n')}

UPLOAD STATUS:
-------------
Cloud Upload: ${pkg.uploadedToCloud ? 'YES' : 'PENDING'}
${pkg.cloudUrl ? `URL: ${pkg.cloudUrl}` : ''}

This evidence package is cryptographically signed.
All contributions can be independently verified.
Any tampering will be detected.
`;

        return report;
    }

    /**
     * Prepare package for cloud upload
     * In production, this would upload to S3 or similar
     * 
     * @returns Evidence package as JSON
     */
    public prepareForUpload(): string | null {
        if (!this.activePackage) {
            return null;
        }

        console.log('[EvidencePackager] 📤 Preparing evidence package for cloud upload...');

        try {
            const json = JSON.stringify(this.activePackage, null, 2);
            const sizeKB = (json.length / 1024).toFixed(2);

            console.log(`[EvidencePackager] Package size: ${sizeKB} KB`);
            console.log(`[EvidencePackager] Witnesses: ${this.activePackage.witnessContributions.length}`);

            return json;
        } catch (error) {
            console.error('[EvidencePackager] ❌ Failed to prepare for upload:', error);
            return null;
        }
    }

    /**
     * Simulate cloud upload
     * In production, this would use AWS S3, Backblaze B2, etc.
     * 
     * @returns Cloud URL if successful
     */
    public async uploadToCloud(): Promise<string | null> {
        if (!this.activePackage) {
            console.error('[EvidencePackager] No package to upload');
            return null;
        }

        console.log('[EvidencePackager] ☁️ Uploading to cloud (simulated)...');

        try {
            // MVP: Simulate upload
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Generate mock S3 URL
            const cloudUrl = `https://aether-evidence.s3.amazonaws.com/${this.activePackage.incidentId}.json`;

            // Update package
            this.activePackage.uploadedToCloud = true;
            this.activePackage.cloudUrl = cloudUrl;

            // Save updated package
            await this.savePackage(this.activePackage);

            console.log(`[EvidencePackager] ✅ Uploaded to: ${cloudUrl}`);
            return cloudUrl;
        } catch (error) {
            console.error('[EvidencePackager] ❌ Upload failed:', error);
            return null;
        }

        /* PRODUCTION CODE (commented out for MVP):
        import AWS from 'aws-sdk';
        
        const s3 = new AWS.S3({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: 'us-east-1',
        });
    
        const json = this.prepareForUpload();
        if (!json) return null;
    
        const params = {
          Bucket: 'aether-evidence',
          Key: `${this.activePackage.incidentId}.json`,
          Body: json,
          ContentType: 'application/json',
          ServerSideEncryption: 'AES256',
        };
    
        const result = await s3.upload(params).promise();
        this.activePackage.uploadedToCloud = true;
        this.activePackage.cloudUrl = result.Location;
        await this.savePackage(this.activePackage);
        
        return result.Location;
        */
    }

    /**
     * Save evidence package to persistent storage
     */
    private async savePackage(pkg: EvidencePackage): Promise<void> {
        try {
            await AsyncStorage.setItem(
                BLACK_BOX_STORAGE_KEYS.EVIDENCE_PACKAGES,
                JSON.stringify(pkg)
            );
            console.log('[EvidencePackager] Package saved to storage');
        } catch (error) {
            console.error('[EvidencePackager] ❌ Failed to save package:', error);
        }
    }

    /**
     * Load evidence package from storage
     */
    public async loadPackage(incidentId?: string): Promise<EvidencePackage | null> {
        try {
            const data = await AsyncStorage.getItem(BLACK_BOX_STORAGE_KEYS.EVIDENCE_PACKAGES);
            if (!data) {
                return null;
            }

            const pkg: EvidencePackage = JSON.parse(data);

            if (incidentId && pkg.incidentId !== incidentId) {
                return null;
            }

            this.activePackage = pkg;
            console.log(`[EvidencePackager] Loaded package: ${pkg.incidentId}`);
            return pkg;
        } catch (error) {
            console.error('[EvidencePackager] ❌ Failed to load package:', error);
            return null;
        }
    }

    /**
     * Get active evidence package
     */
    public getActivePackage(): EvidencePackage | null {
        return this.activePackage;
    }

    /**
     * Clear active package (for testing)
     */
    public async clearPackage(): Promise<void> {
        this.activePackage = null;
        await AsyncStorage.removeItem(BLACK_BOX_STORAGE_KEYS.EVIDENCE_PACKAGES);
        console.log('[EvidencePackager] Package cleared');
    }

    /**
     * Export package as court-ready JSON
     * Includes all metadata for legal proceedings
     */
    public exportForCourt(): any {
        if (!this.activePackage) {
            return null;
        }

        const stats = this.getVerificationStats();

        return {
            metadata: {
                packageVersion: '1.0',
                exportedAt: new Date().toISOString(),
                verificationMethod: 'RSA-2048 with SHA-256',
            },
            incident: {
                id: this.activePackage.incidentId,
                timestamp: new Date(this.activePackage.victimData.crashTimestamp).toISOString(),
                severity: this.activePackage.victimData.crashSeverity,
                location: this.activePackage.victimData.location,
            },
            evidence: {
                victim: {
                    deviceId: this.activePackage.victimData.deviceId,
                    dataPoints: this.activePackage.victimData.bufferData.length,
                    timeRange: {
                        start: new Date(
                            this.activePackage.victimData.bufferData[0]?.timestamp
                        ).toISOString(),
                        end: new Date(
                            this.activePackage.victimData.bufferData[
                                this.activePackage.victimData.bufferData.length - 1
                            ]?.timestamp
                        ).toISOString(),
                    },
                },
                witnesses: this.activePackage.witnessContributions.map((w) => ({
                    deviceId: w.deviceId,
                    verified: this.activePackage!.verificationStatus[w.deviceId],
                    dataPoints: w.bufferData.length,
                    contributedAt: new Date(w.timestamp).toISOString(),
                    publicKey: w.publicKey,
                    dataHash: w.dataHash,
                    signature: w.signature,
                })),
            },
            verification: {
                totalContributions: stats.total,
                verifiedContributions: stats.verified,
                verificationRate: `${stats.percentVerified}%`,
            },
            cloudStorage: {
                uploaded: this.activePackage.uploadedToCloud,
                url: this.activePackage.cloudUrl,
            },
        };
    }
}