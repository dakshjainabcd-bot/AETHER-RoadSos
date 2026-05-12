/**
 * AudioSessionManager — Shared Microphone Lock
 *
 * WHY THIS EXISTS:
 * expo-av enforces a hard rule: only ONE Audio.Recording object can exist
 * at any time. AETHER has two components that need the mic independently:
 *
 *   1. AcousticDetector (Phase 3) — passive crash sound monitoring
 *      Activates automatically when accelerometer detects a candidate event.
 *
 *   2. WhisperSTT (Phase 5) — speech-to-text for voice commands & translation
 *      Activates when user speaks or presses the voice input button.
 *
 * Without coordination, whichever component creates its Recording second
 * throws: "Only one Recording object can be prepared at a given time."
 *
 * HOW THIS FIXES IT:
 * This singleton acts as a gatekeeper for mic access.
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  PRIORITY: WhisperSTT > AcousticDetector                        │
 *   │                                                                  │
 *   │  When WhisperSTT calls acquire():                               │
 *   │    → Manager calls AcousticDetector's revoke callback           │
 *   │    → AcousticDetector deactivates (stops + unloads recording)   │
 *   │    → WhisperSTT gets the mic                                    │
 *   │                                                                  │
 *   │  When WhisperSTT calls release():                               │
 *   │    → Mic is free again                                          │
 *   │    → AcousticDetector can acquire next time crash sensors fire  │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * USAGE (AcousticDetector):
 *   audioSessionManager.register('AcousticDetector', () => this.deactivate());
 *   const granted = await audioSessionManager.acquire('AcousticDetector');
 *   if (!granted) return;  // gracefully skip — WhisperSTT has the mic
 *   // ... create recording ...
 *   audioSessionManager.release('AcousticDetector');
 *
 * USAGE (WhisperSTT):
 *   await audioSessionManager.acquire('WhisperSTT'); // always succeeds, revokes Acoustic first
 *   // ... create recording ...
 *   audioSessionManager.release('WhisperSTT');
 */

export type AudioOwner = 'AcousticDetector' | 'WhisperSTT';

/**
 * Priority ranking — higher number wins.
 * When a higher-priority owner acquires, lower-priority owner is revoked first.
 */
const PRIORITY: Record<AudioOwner, number> = {
  AcousticDetector: 1,
  WhisperSTT: 2,
};

class AudioSessionManager {
  private currentOwner: AudioOwner | null = null;
  private revokeCallbacks = new Map<AudioOwner, () => Promise<void>>();

  /**
   * Register a revoke callback for an owner.
   * Called when a higher-priority owner needs the mic.
   * The callback MUST stop and unload any active recording.
   *
   * Call this ONCE during component initialization.
   *
   * @param owner     The component registering ('AcousticDetector' | 'WhisperSTT')
   * @param onRevoke  Async function that stops the recording immediately
   */
  register(owner: AudioOwner, onRevoke: () => Promise<void>): void {
    this.revokeCallbacks.set(owner, onRevoke);
  }

  /**
   * Request exclusive mic access.
   *
   * Behaviour:
   * - If mic is free → grant immediately, return true
   * - If requesting owner already holds it → grant (no-op), return true
   * - If a LOWER-priority owner holds it → revoke them first, then grant, return true
   * - If a HIGHER-priority owner holds it → deny, return false
   *
   * @param owner  The component requesting mic access
   * @returns      true if mic access granted, false if denied
   */
  async acquire(owner: AudioOwner): Promise<boolean> {
    // Already own it
    if (this.currentOwner === owner) {
      return true;
    }

    // Mic is free
    if (this.currentOwner === null) {
      this.currentOwner = owner;
      console.log(`[AudioSession] ${owner} acquired mic (was free)`);
      return true;
    }

    // Another owner holds it — check priority
    const currentPriority = PRIORITY[this.currentOwner];
    const requestPriority  = PRIORITY[owner];

    if (requestPriority > currentPriority) {
      // Requester has higher priority → revoke current owner first
      const prevOwner = this.currentOwner;
      const revoke = this.revokeCallbacks.get(prevOwner);

      if (revoke) {
        console.log(`[AudioSession] ${owner} (priority ${requestPriority}) revoking ${prevOwner} (priority ${currentPriority})`);
        try {
          await revoke();
        } catch (err) {
          // Don't let a failed revoke block the higher-priority owner
          console.warn(`[AudioSession] Revoke callback for ${prevOwner} threw:`, err);
        }
      }

      this.currentOwner = owner;
      console.log(`[AudioSession] ${owner} acquired mic (revoked ${prevOwner})`);
      return true;
    } else {
      // Requester has lower or equal priority — deny
      console.log(
        `[AudioSession] ${owner} denied mic — ${this.currentOwner} has equal/higher priority`
      );
      return false;
    }
  }

  /**
   * Release mic access.
   * Must be called when the owner stops recording, even if it failed midway.
   *
   * @param owner  The component releasing mic access
   */
  release(owner: AudioOwner): void {
    if (this.currentOwner === owner) {
      this.currentOwner = null;
      console.log(`[AudioSession] ${owner} released mic`);
    }
  }

  /**
   * Check if an owner currently holds the mic.
   * Useful for guards before attempting recording.
   */
  isOwner(owner: AudioOwner): boolean {
    return this.currentOwner === owner;
  }

  /** Current mic holder (for debug/logging) */
  get currentHolder(): AudioOwner | null {
    return this.currentOwner;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
// One instance shared by the entire app.
// Import this wherever you need mic access.
export const audioSessionManager = new AudioSessionManager();