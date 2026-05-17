// services/Rakshak/RakshakService.ts
/**
 * RakshakService — Core Business Logic for Rakshak Network
 * 
 * Handles:
 * 1. Registration and profile storage in Firestore
 * 2. FCM token management (for push notifications)
 * 3. Querying nearby Rakshak when a crash occurs
 * 4. Logging incident responses
 * 
 * WHY FIRESTORE FOR RAKSHAK DATA?
 * Unlike the SQLite offline DB (Phase 1), Rakshak profiles need to be:
 * - Accessible by the cloud backend (to send notifications)
 * - Shareable across devices (verified badge shows to everyone)
 * - Real-time (active status changes instantly)
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  GeoPoint,
  serverTimestamp,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from '../firebase';
import {
  RakshakProfile,
  RakshakResponse,
  RAKSHAK_STORAGE_KEYS,
  CertificateType,
} from './types';

class RakshakService {
  private currentUser: User | null = null;
  private profile: RakshakProfile | null = null;

  // ── Authentication ──────────────────────────────────────────────────────

  /**
   * Listen to auth state changes.
   * Call once at app startup to know if user is logged in.
   */
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      callback(user);
    });
  }

  /**
   * Register a new Rakshak account.
   * Creates Firebase Auth account AND Firestore profile document.
   * 
   * @param email - Login email
   * @param password - Login password
   * @param profileData - Registration form data
   */
  async register(
    email: string,
    password: string,
    profileData: {
      name: string;
      phone: string;
      address: string;
      certificateType: CertificateType;
    }
  ): Promise<RakshakProfile> {
    console.log('[Rakshak] Registering new user:', email);

    // Step 1: Create Firebase Auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Step 2: Create Firestore profile document
    const profile: RakshakProfile = {
      uid,
      name: profileData.name,
      phone: profileData.phone,
      address: profileData.address,
      certificateType: profileData.certificateType,
      verificationStatus: 'pending',
      registeredAt: Date.now(),
      isActive: true,
    };

    // Save to Firestore: collection 'rakshak_profiles', document = uid
    await setDoc(doc(db, 'rakshak_profiles', uid), profile);
    console.log('[Rakshak] Profile created in Firestore:', uid);

    this.profile = profile;

    // Cache locally for offline use
    await AsyncStorage.setItem(
      RAKSHAK_STORAGE_KEYS.PROFILE,
      JSON.stringify(profile)
    );

    return profile;
  }

  /**
   * Login existing Rakshak.
   */
  async login(email: string, password: string): Promise<RakshakProfile | null> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return await this.fetchProfile(userCredential.user.uid);
  }

  /**
   * Logout.
   */
  async logout(): Promise<void> {
    await signOut(auth);
    this.profile = null;
    await AsyncStorage.removeItem(RAKSHAK_STORAGE_KEYS.PROFILE);
  }

  // ── Profile Management ──────────────────────────────────────────────────

  /**
   * Fetch Rakshak profile from Firestore.
   */
  async fetchProfile(uid: string): Promise<RakshakProfile | null> {
    try {
      const docSnap = await getDoc(doc(db, 'rakshak_profiles', uid));
      if (docSnap.exists()) {
        const profile = docSnap.data() as RakshakProfile;
        this.profile = profile;
        await AsyncStorage.setItem(
          RAKSHAK_STORAGE_KEYS.PROFILE,
          JSON.stringify(profile)
        );
        return profile;
      }
      return null;
    } catch (error) {
      console.error('[Rakshak] Failed to fetch profile:', error);
      // Try cached version
      const cached = await AsyncStorage.getItem(RAKSHAK_STORAGE_KEYS.PROFILE);
      return cached ? JSON.parse(cached) : null;
    }
  }

  /**
   * Get currently loaded profile (no network call).
   */
  getProfile(): RakshakProfile | null {
    return this.profile;
  }

  /**
   * Upload certificate image.
   * Storage not available on free plan — stub for demo.
   * In production: upgrade to Blaze plan for real upload.
   */
  async uploadCertificate(
    uid: string,
    imageUri: string
  ): Promise<string> {
    // Storage not available on free plan
    // In production: upgrade to Blaze plan for real upload
    console.log('[Rakshak] Certificate image stored locally only (demo mode)');
    return 'certificate_pending_upload';
  }

  /**
   * Save the FCM push notification token to Firestore.
   * This is how the backend knows where to send notifications.
   */
  async saveFCMToken(uid: string, token: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'rakshak_profiles', uid), {
        fcmToken: token,
      });
      await AsyncStorage.setItem(RAKSHAK_STORAGE_KEYS.FCM_TOKEN, token);
      console.log('[Rakshak] FCM token saved');
    } catch (error) {
      console.error('[Rakshak] Failed to save FCM token:', error);
    }
  }

  /**
   * Toggle active status (opt in/out of receiving alerts).
   */
  async setActiveStatus(uid: string, isActive: boolean): Promise<void> {
    await updateDoc(doc(db, 'rakshak_profiles', uid), { isActive });
    if (this.profile) {
      this.profile.isActive = isActive;
    }
    console.log('[Rakshak] Active status set to:', isActive);
  }

  // ── Incident Response ───────────────────────────────────────────────────

  /**
   * Log that this Rakshak has arrived at the scene.
   */
  async logArrival(incidentId: string, uid: string): Promise<void> {
    const responseData: Partial<RakshakResponse> = {
      responseId: `resp_${Date.now()}`,
      incidentId,
      rakshakUid: uid,
      arrivedAt: Date.now(),
      interventions: [],
      notes: '',
    };

    await setDoc(
      doc(db, 'rakshak_responses', `${incidentId}_${uid}`),
      responseData
    );

    // Cache active response
    await AsyncStorage.setItem(
      RAKSHAK_STORAGE_KEYS.ACTIVE_RESPONSE,
      JSON.stringify(responseData)
    );

    console.log('[Rakshak] Arrival logged for incident:', incidentId);
  }

  /**
   * Log handover to ambulance and save interventions.
   */
  async logHandover(
    incidentId: string,
    uid: string,
    interventions: string[],
    notes: string
  ): Promise<void> {
    await updateDoc(
      doc(db, 'rakshak_responses', `${incidentId}_${uid}`),
      {
        handoverAt: Date.now(),
        interventions,
        notes,
      }
    );

    console.log('[Rakshak] Handover logged');
  }

  // ── Notification Dispatch ────────────────────────────────────────────────

  /**
   * Find all active Rakshak (returns profiles with fcmToken).
   * 
   * In production: filter by GeoHash for 2km radius.
   * In Expo Go demo: return all active Rakshak (we don't have
   * real location data for other users' phones).
   * 
   * Real proximity query would use:
   *   - geohash library to encode lat/lng
   *   - Firestore query: where('geohash', '>=', minHash).where('geohash', '<=', maxHash)
   */
  async getActiveRakshak(): Promise<RakshakProfile[]> {
    try {
      const q = query(
        collection(db, 'rakshak_profiles'),
        where('isActive', '==', true),
        where('verificationStatus', '==', 'verified')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => d.data() as RakshakProfile);
    } catch (error) {
      console.error('[Rakshak] Failed to fetch active Rakshak:', error);
      return [];
    }
  }

  /**
   * Get current Firebase Auth user.
   */
  getCurrentUser(): User | null {
    return auth.currentUser;
  }
}

// Singleton
export const rakshakService = new RakshakService();