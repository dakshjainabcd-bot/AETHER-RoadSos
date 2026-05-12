/**
 * Phase 7: RSA Cryptography for Evidence Signing
 * 
 * Why we need this:
 * Imagine you have a video of an accident. How do you prove it wasn't edited?
 * 
 * Solution: Digital Signatures
 * 1. Generate a unique "fingerprint" (hash) of the data
 * 2. Encrypt that fingerprint with your private key (sign it)
 * 3. Anyone can verify with your public key that you created it
 * 
 * Like a wax seal on a letter - only you can make it, but anyone can verify it.
 * 
 * RSA = Public-key cryptography algorithm
 * SHA-256 = Hash function (creates data fingerprint)
 */

import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RSAKeyPair, BLACK_BOX_STORAGE_KEYS, BLACK_BOX_CONFIG } from './types';

// Import RSA library
// Note: jsrsasign is a pure JS implementation (works in Expo Go)
// For production, use react-native-rsa-native (faster, more secure)
const KJUR = require('jsrsasign');

export class RSACrypto {
    private keyPair: RSAKeyPair | null = null;

    /**
     * Initialize crypto system
     * - Load existing keys from storage, OR
     * - Generate new keys if first time
     */
    public async initialize(): Promise<void> {
        console.log('[RSACrypto] Initializing...');

        // Try to load existing keys
        const existingKeys = await this.loadKeys();
        if (existingKeys) {
            this.keyPair = existingKeys;
            console.log(`[RSACrypto] ✅ Loaded existing keys for device: ${existingKeys.deviceId}`);
            return;
        }

        // No existing keys, generate new ones
        console.log('[RSACrypto] No existing keys found, generating new pair...');
        await this.generateKeyPair();
    }

    /**
     * Generate a new RSA key pair
     * 
     * What happens:
     * 1. Generate random device ID (UUID)
     * 2. Create RSA key pair (2048-bit)
     * 3. Save to AsyncStorage (persistent)
     * 
     * Key size: 2048 bits = 256 bytes
     * Security: Equivalent to 112-bit symmetric key
     * Performance: ~100ms to generate on modern phones
     */
    private async generateKeyPair(): Promise<void> {
        console.log('[RSACrypto] 🔑 Generating RSA key pair (' + BLACK_BOX_CONFIG.RSA_KEY_SIZE + '-bit)...');

        try {
            // Generate unique device ID
            const deviceId = await this.generateDeviceId();
            console.log('[RSACrypto] Device ID generated:', deviceId);

            // Generate RSA key pair using jsrsasign
            console.log('[RSACrypto] Generating RSA keypair (this may take 10-30 seconds)...');
            const startTime = Date.now();
            const rsaKeypair = KJUR.KEYUTIL.generateKeypair('RSA', BLACK_BOX_CONFIG.RSA_KEY_SIZE);
            const generationTime = Date.now() - startTime;
            console.log(`[RSACrypto] RSA keypair generated in ${generationTime}ms`);

            // Export keys to PEM format (standard format)
            const publicKeyPEM = KJUR.KEYUTIL.getPEM(rsaKeypair.pubKeyObj);
            const privateKeyPEM = KJUR.KEYUTIL.getPEM(rsaKeypair.prvKeyObj, 'PKCS8PRV');

            this.keyPair = {
                publicKey: publicKeyPEM,
                privateKey: privateKeyPEM,
                deviceId: deviceId,
            };

            // Save to persistent storage
            await this.saveKeys(this.keyPair);

            console.log(`[RSACrypto] ✅ Generated and saved RSA keys for device: ${deviceId}`);
            console.log(`[RSACrypto] Public key (shareable): ${publicKeyPEM.substring(0, 50)}...`);
        } catch (error) {
            console.error('[RSACrypto] ❌ Key generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate a unique device ID
     * Uses cryptographically secure random UUID
     */
    private async generateDeviceId(): Promise<string> {
        // Generate UUID v4
        const randomBytes = await Crypto.getRandomBytesAsync(16);
        const uuid = Array.from(randomBytes)
            .map((b, i) => {
                // Format as UUID: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
                if (i === 6) return ((b & 0x0f) | 0x40).toString(16); // Version 4
                if (i === 8) return ((b & 0x3f) | 0x80).toString(16); // Variant
                return b.toString(16).padStart(2, '0');
            })
            .join('');

        return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
    }

    /**
     * Sign data with private key
     * 
     * Process:
     * 1. Calculate SHA-256 hash of data (fingerprint)
     * 2. Encrypt hash with private key (signature)
     * 3. Return both hash and signature
     * 
     * @param data - Data to sign (usually JSON string)
     * @returns { dataHash, signature }
     */
    public async signData(data: string): Promise<{ dataHash: string; signature: string }> {
        if (!this.keyPair) {
            throw new Error('RSA keys not initialized');
        }

        console.log(`[RSACrypto] Signing data (${data.length} bytes)...`);

        try {
            // Step 1: Calculate SHA-256 hash
            const dataHash = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                data
            );

            // Step 2: Sign the hash with private key
            const privateKey = KJUR.KEYUTIL.getKey(this.keyPair.privateKey);
            const sig = new KJUR.crypto.Signature({ alg: 'SHA256withRSA' });
            sig.init(privateKey);
            sig.updateString(dataHash);
            const signature = sig.sign();

            console.log(`[RSACrypto] ✅ Data signed. Hash: ${dataHash.substring(0, 16)}...`);

            return {
                dataHash,
                signature: signature, // Hex string
            };
        } catch (error) {
            console.error('[RSACrypto] ❌ Signing failed:', error);
            throw error;
        }
    }

    /**
     * Verify a signature using public key
     * 
     * This is how we check if data was tampered with:
     * 1. Recalculate hash of current data
     * 2. Decrypt signature with public key
     * 3. Compare: do they match?
     * 
     * @param data - Original data
     * @param signature - Signature to verify
     * @param publicKey - Public key of signer
     * @returns true if valid, false if tampered
     */
    public async verifySignature(
        data: string,
        expectedHash: string,
        signature: string,
        publicKey: string
    ): Promise<boolean> {
        console.log('[RSACrypto] Verifying signature...');

        try {
            // Step 1: Recalculate hash of current data
            const actualHash = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                data
            );

            // Step 2: Check if hash matches (data not modified)
            if (actualHash !== expectedHash) {
                console.log('[RSACrypto] ❌ Hash mismatch - data was modified!');
                console.log(`  Expected: ${expectedHash.substring(0, 16)}...`);
                console.log(`  Actual: ${actualHash.substring(0, 16)}...`);
                return false;
            }

            // Step 3: Verify signature with public key
            const pubKey = KJUR.KEYUTIL.getKey(publicKey);
            const sig = new KJUR.crypto.Signature({ alg: 'SHA256withRSA' });
            sig.init(pubKey);
            sig.updateString(expectedHash);
            const isValid = sig.verify(signature);

            if (isValid) {
                console.log('[RSACrypto] ✅ Signature valid - data authentic');
            } else {
                console.log('[RSACrypto] ❌ Signature invalid - possibly forged');
            }

            return isValid;
        } catch (error) {
            console.error('[RSACrypto] ❌ Verification failed:', error);
            return false;
        }
    }

    /**
     * Calculate SHA-256 hash of data
     * Used for quick integrity checks
     */
    public async hashData(data: string): Promise<string> {
        return await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            data
        );
    }

    /**
     * Get current device's public key
     * This is safe to share - it's used to verify signatures
     */
    public getPublicKey(): string | null {
        return this.keyPair?.publicKey || null;
    }

    /**
     * Get device ID
     */
    public getDeviceId(): string | null {
        return this.keyPair?.deviceId || null;
    }

    /**
     * Get complete key pair (internal use only)
     * WARNING: Never expose private key to network!
     */
    public getKeyPair(): RSAKeyPair | null {
        return this.keyPair;
    }

    /**
     * Save keys to AsyncStorage
     */
    private async saveKeys(keys: RSAKeyPair): Promise<void> {
        try {
            await AsyncStorage.setItem(
                BLACK_BOX_STORAGE_KEYS.RSA_KEYS,
                JSON.stringify(keys)
            );
            console.log('[RSACrypto] Keys saved to storage');
        } catch (error) {
            console.error('[RSACrypto] Failed to save keys:', error);
            throw error;
        }
    }

    /**
     * Load keys from AsyncStorage
     */
    private async loadKeys(): Promise<RSAKeyPair | null> {
        try {
            const data = await AsyncStorage.getItem(BLACK_BOX_STORAGE_KEYS.RSA_KEYS);
            if (!data) {
                return null;
            }

            const keys: RSAKeyPair = JSON.parse(data);
            console.log('[RSACrypto] Keys loaded from storage');
            return keys;
        } catch (error) {
            console.error('[RSACrypto] Failed to load keys:', error);
            return null;
        }
    }

    /**
     * Delete keys (for testing)
     * WARNING: This will make old signatures unverifiable!
     */
    public async deleteKeys(): Promise<void> {
        try {
            await AsyncStorage.removeItem(BLACK_BOX_STORAGE_KEYS.RSA_KEYS);
            this.keyPair = null;
            console.log('[RSACrypto] Keys deleted');
        } catch (error) {
            console.error('[RSACrypto] Failed to delete keys:', error);
        }
    }

    /**
     * Test the crypto system
     * Useful for debugging
     */
    public async test(): Promise<boolean> {
        console.log('[RSACrypto] Running self-test...');

        try {
            const testData = 'Test data for black box evidence system';

            // Sign data
            const { dataHash, signature } = await this.signData(testData);

            // Verify signature
            const isValid = await this.verifySignature(
                testData,
                dataHash,
                signature,
                this.keyPair!.publicKey
            );

            if (isValid) {
                console.log('[RSACrypto] ✅ Self-test PASSED');
            } else {
                console.log('[RSACrypto] ❌ Self-test FAILED');
            }

            // Test tampering detection
            const tamperedData = testData + ' MODIFIED';
            const tamperedValid = await this.verifySignature(
                tamperedData,
                dataHash,
                signature,
                this.keyPair!.publicKey
            );

            if (!tamperedValid) {
                console.log('[RSACrypto] ✅ Tampering detection works');
            } else {
                console.log('[RSACrypto] ❌ Tampering detection failed');
            }

            return isValid && !tamperedValid;
        } catch (error) {
            console.error('[RSACrypto] Self-test error:', error);
            return false;
        }
    }
}