// services/firebase.ts
/**
 * Firebase Configuration — Phase 7
 * 
 * Initializes Firebase App, Auth, and Firestore.
 * Called once at app startup.
 * 
 * WHY FIREBASE?
 * - Rakshak profiles need to be stored in cloud (other users need to see verified status)
 * - Push notifications need FCM (Firebase Cloud Messaging)
 * - Real-time queries (find Rakshak within 2km) need Firestore GeoPoint
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// REMOVED: Storage import (requires paid plan)

// ── YOUR Firebase config goes here ──────────────────────────────────────────
// Replace with the config you copied from Firebase Console in Step 1
const firebaseConfig = {
  apiKey: "AIzaSyAoMTM4nQxS4E1HevjK7JcHIWAbX-jKYBU",
  authDomain: "aether-roadsos.firebaseapp.com",
  projectId: "aether-roadsos",
  storageBucket: "aether-roadsos.firebasestorage.app",
  messagingSenderId: "48855216560",
  appId: "1:48855216560:web:93c1b6fbc0772d807e2675"
};

// Initialize Firebase — only once (guard against hot reload reinitializing)
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  console.log('[Firebase] Initialized');
} else {
  app = getApps()[0];
  console.log('[Firebase] Already initialized — reusing existing app');
}

// Export initialized services
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
// REMOVED: export const storage (requires Firebase Blaze plan)
export default app;