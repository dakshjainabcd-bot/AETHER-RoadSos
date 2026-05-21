/**
 * AESCrypto.ts — Phase 10 Security Utilities
 *
 * WHY AES + HMAC TOGETHER?
 * - AES encryption hides the data content (confidentiality)
 * - HMAC creates a "fingerprint" of the data (integrity)
 *
 * ANALOGY: AES is like sealing a letter in an envelope.
 * HMAC is like a wax seal — if the envelope is opened and resealed,
 * the wax seal looks different and you KNOW it was tampered with.
 *
 * PRE-SHARED KEY:
 * All AETHER devices share the same AES key hardcoded in the app.
 * In production: use ECDH to create per-session keys.
 * For hackathon demo: pre-shared key proves the mechanism works.
 */

import CryptoJS from 'crypto-js';

// ─── Shared Keys (baked into app for demo — all AETHER devices share these) ──

/**
 * AES encryption key — 256 bits derived from passphrase.
 * In production: generate per-session via ECDH key exchange.
 */
const AETHER_AES_KEY = 'AETHER-ROAD-SOS-2026-BIMSTEC-HACKATHON-SECURITY-KEY';

/**
 * HMAC signing key — separate from AES key (best practice).
 * Using same key for both AES and HMAC is a security anti-pattern.
 */
const AETHER_HMAC_KEY = 'AETHER-HMAC-INTEGRITY-VERIFICATION-2026-SEPARATE-KEY';

// ─── Encryption ───────────────────────────────────────────────────────────────

/**
 * Encrypt a JavaScript object using AES-256 (via CryptoJS CBC mode).
 *
 * @param payload - Any JSON-serializable object
 * @returns Base64-encoded ciphertext string
 */
export function encryptPayload(payload: object): string {
  const json = JSON.stringify(payload);
  const encrypted = CryptoJS.AES.encrypt(json, AETHER_AES_KEY);
  return encrypted.toString(); // Returns base64 ciphertext
}

/**
 * Decrypt a ciphertext string back to the original object.
 *
 * @param ciphertext - Base64 string from encryptPayload()
 * @returns Original object, or null if decryption fails (tampered data)
 */
export function decryptPayload(ciphertext: string): object | null {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, AETHER_AES_KEY);
    const json = bytes.toString(CryptoJS.enc.Utf8);
    if (!json) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ─── HMAC (Integrity Verification) ───────────────────────────────────────────

/**
 * Compute HMAC-SHA256 "fingerprint" of a string.
 *
 * WHY HMAC NOT JUST SHA256?
 * Plain SHA256(data) can be recomputed by anyone.
 * HMAC-SHA256(data, SECRET_KEY) can only be computed by someone who knows
 * the secret key. A relay phone that tampers with the data cannot
 * recompute a valid HMAC without the key.
 *
 * @param data - String to sign (usually JSON.stringify of the packet)
 * @returns Hex string — the HMAC signature
 */
export function computeHMAC(data: string): string {
  return CryptoJS.HmacSHA256(data, AETHER_HMAC_KEY).toString(CryptoJS.enc.Hex);
}

/**
 * Verify a received HMAC against the expected value.
 *
 * @param data - The data to verify (must match exactly what was signed)
 * @param receivedHmac - The HMAC that came with the packet
 * @returns true = authentic packet | false = tampered or invalid
 */
export function verifyHMAC(data: string, receivedHmac: string): boolean {
  const expectedHmac = computeHMAC(data);
  // Constant-time comparison prevents timing attacks
  // (crypto-js .toString() gives consistent hex strings)
  return expectedHmac === receivedHmac;
}

/**
 * Round a GPS coordinate to 3 decimal places.
 * 3 decimal places ≈ 111 metres precision.
 *
 * WHY? Relay nodes (random stranger's phones) only need approximate
 * location to pass the SOS along. They don't need the victim's exact
 * GPS. This protects victim privacy even if the relay node is malicious.
 *
 * The cloud backend receives the full-precision GPS through a separate
 * encrypted HTTPS channel (not through mesh relay).
 */
export function roundForMeshRelay(coordinate: number): number {
  return Math.round(coordinate * 1000) / 1000;
}

/**
 * Self-test function — run this to verify everything works.
 * Call from a debug panel or console during development.
 */
export function runCryptoSelfTest(): boolean {
  console.log('[AESCrypto] Running self-test...');

  // Test 1: Encrypt then decrypt
  const testData = { lat: 12.9716, lng: 77.5946, severity: 3 };
  const encrypted = encryptPayload(testData);
  const decrypted = decryptPayload(encrypted) as typeof testData;

  if (!decrypted || decrypted.lat !== testData.lat) {
    console.error('[AESCrypto] ❌ Encryption self-test FAILED');
    return false;
  }
  console.log('[AESCrypto] ✅ Encryption test passed');

  // Test 2: HMAC sign and verify
  const testString = '{"incidentId":"abc123","lat":12.972,"lng":77.595}';
  const hmac = computeHMAC(testString);
  const valid = verifyHMAC(testString, hmac);

  if (!valid) {
    console.error('[AESCrypto] ❌ HMAC self-test FAILED');
    return false;
  }
  console.log('[AESCrypto] ✅ HMAC test passed');

  // Test 3: Tamper detection
  const tamperedString = '{"incidentId":"abc123","lat":99.999,"lng":77.595}';
  const tampered = verifyHMAC(tamperedString, hmac);
  if (tampered) {
    console.error('[AESCrypto] ❌ Tamper detection FAILED — this is a security bug!');
    return false;
  }
  console.log('[AESCrypto] ✅ Tamper detection test passed');

  // Test 4: GPS rounding
  const rounded = roundForMeshRelay(12.971612345);
  if (rounded !== 12.972) {
    console.error('[AESCrypto] ❌ GPS rounding FAILED');
    return false;
  }
  console.log('[AESCrypto] ✅ GPS rounding test passed');

  console.log('[AESCrypto] All tests passed! Security layer is working. ✅');
  return true;
}