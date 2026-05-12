/**
 * HospitalPreAlert — Send Pre-Alert to Hospital When SOS Fires
 *
 * WHAT THIS DOES IN PRODUCTION:
 * When a crash is confirmed and an injury type is selected:
 * 1. TraumaMatch finds the best hospital
 * 2. THIS service POSTs a pre-alert to our cloud backend
 *    which then sends a WhatsApp message via Twilio to the hospital's duty number:
 *
 *    "TRAUMA INCOMING. GPS [Maps link]. Injury: Head Trauma.
 *     Severity: AIS 3. ETA: 12 min. Reply READY or UNABLE."
 *
 * 3. Hospital replies READY → bystander app shows "Hospital Apollo READY"
 * 4. If no reply in 90s → auto-try next hospital
 *
 * WHAT THIS DOES IN EXPO GO (Phase 6 demo):
 * We POST to httpbin.org/post — a free test endpoint that echoes
 * back your request. This proves the HTTP pipeline works end-to-end.
 * Just swap ALERT_ENDPOINT for your real FastAPI URL in Phase 10.
 *
 * The simulated "READY" reply comes automatically after 3 seconds
 * (simulating the hospital responding) so the demo shows the full flow.
 *
 * STATE MACHINE:
 *   idle → sending → sent → acknowledged (READY) / failed
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TraumaMatchResult } from './TraumaMatch';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PreAlertStatus =
  | 'idle'           // No active pre-alert
  | 'sending'        // HTTP POST in progress
  | 'sent'           // POST succeeded, waiting for hospital reply
  | 'acknowledged'   // Hospital replied READY — this is the success state
  | 'failed'         // POST failed or hospital replied UNABLE
  | 'no_hospital';   // No matching hospital found within range

export interface PreAlertState {
  status: PreAlertStatus;
  hospitalName: string;
  hospitalPhone: string;
  distanceText: string;
  etaMinutes: number;
  injuryType: string;
  sentAt: number | null;       // Unix ms when we sent the alert
  acknowledgedAt: number | null; // Unix ms when hospital said READY
  incidentId: string;
}

export type PreAlertListener = (state: PreAlertState) => void;

// ─── Constants ────────────────────────────────────────────────────────────────

// Phase 6 demo endpoint — echoes back the POST body (proves the pipeline works)
// Replace with https://your-api.com/api/v1/hospital_prealert in Phase 10
const ALERT_ENDPOINT = 'https://httpbin.org/post';

// How long to wait for hospital READY reply before trying next hospital
const REPLY_TIMEOUT_MS = 90_000;

// Simulated reply delay for Expo Go demo (3 seconds after sending)
const SIM_REPLY_DELAY_MS = 3_000;

const STORAGE_KEY = 'aether_prealert_state_v1';

// ─── Service class ────────────────────────────────────────────────────────────

class HospitalPreAlertService {
  private state: PreAlertState = this.defaultState();
  private listeners: PreAlertListener[] = [];
  private replyTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Send a pre-alert for a confirmed crash.
   *
   * Call this immediately after crashDetectionEngine fires SOS_DISPATCHED
   * AND the user has selected an injury type.
   *
   * @param matchResult   Result from TraumaMatch.matchHospital()
   * @param incidentId    The SOS packet's incidentId from Phase 2/3
   * @param severity      Crash severity 1-5 from CrashDetectionEngine
   */
  async sendPreAlert(
    matchResult: TraumaMatchResult,
    incidentId: string,
    severity: number
  ): Promise<void> {
    if (!matchResult.hospital) {
      console.error('[HPP] No hospital in matchResult — cannot send pre-alert');
      this.setState({
        ...this.defaultState(),
        status: 'no_hospital',
        incidentId,
      });
      return;
    }

    const h = matchResult.hospital;
    console.log(`[HPP] Sending pre-alert to ${h.name} (${h.distanceText})`);

    // Build the pre-alert payload
    // In production this goes to your FastAPI backend → Twilio WhatsApp
    const payload = {
      incident_id: incidentId,
      hospital_id: h.id,
      hospital_name: h.name,
      hospital_whatsapp: h.whatsapp,
      injury_type: matchResult.injuryType,
      required_capabilities: matchResult.requiredCapabilities,
      is_specialist_match: matchResult.isSpecialistMatch,
      crash_lat: 0,       // Real GPS from meshRelayManager.triggerSOS() packet
      crash_lng: 0,       // For demo we use 0 (actual GPS is in the SOS packet)
      severity,
      eta_minutes: h.etaMinutes,
      distance_km: h.distanceKm,
      sent_at: Date.now(),
      app_version: '1.0.0-phase6',
    };

    // ── Transition to SENDING ────────────────────────────────────────────────
    this.setState({
      status: 'sending',
      hospitalName: h.name,
      hospitalPhone: h.phone,
      distanceText: h.distanceText,
      etaMinutes: h.etaMinutes,
      injuryType: matchResult.injuryType,
      sentAt: null,
      acknowledgedAt: null,
      incidentId,
    });

    try {
      const response = await fetch(ALERT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AETHER-PreAlert': '1',
          'X-AETHER-Incident': incidentId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // ── Transition to SENT ───────────────────────────────────────────────
      const sentAt = Date.now();
      this.setState({ ...this.state, status: 'sent', sentAt });
      console.log(`[HPP] ✅ Pre-alert sent to ${h.name}`);

      // ── Simulate hospital replying READY after 3 seconds ────────────────
      // In production: your backend webhooks from Twilio when hospital replies
      // For Expo Go demo: we auto-acknowledge after SIM_REPLY_DELAY_MS
      this.replyTimer = setTimeout(() => {
        this.simulateHospitalReady();
      }, SIM_REPLY_DELAY_MS);

    } catch (err) {
      console.error('[HPP] Pre-alert HTTP failed:', err);
      this.setState({ ...this.state, status: 'failed' });
    }
  }

  /**
   * Mark the hospital as READY.
   * In production: called when the Twilio webhook receives "READY" from hospital.
   * In Expo Go: called automatically after SIM_REPLY_DELAY_MS.
   */
  private simulateHospitalReady(): void {
    if (this.state.status !== 'sent') return;
    console.log(`[HPP] 🏥 Hospital ${this.state.hospitalName} replied READY`);
    this.setState({
      ...this.state,
      status: 'acknowledged',
      acknowledgedAt: Date.now(),
    });
  }

  /**
   * Reset to idle state when a new SOS cycle begins.
   * Call from SOSScreen when the user dismisses the active SOS.
   */
  reset(): void {
    if (this.replyTimer) {
      clearTimeout(this.replyTimer);
      this.replyTimer = null;
    }
    this.setState(this.defaultState());
  }

  /**
   * Get the current pre-alert state (for initial render).
   */
  getState(): PreAlertState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes.
   * Returns an unsubscribe function — call in useEffect cleanup.
   *
   * Usage:
   *   const unsub = hospitalPreAlert.subscribe((state) => setAlertState(state));
   *   return () => unsub();
   */
  subscribe(listener: PreAlertListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private setState(newState: PreAlertState): void {
    this.state = newState;
    // Notify all subscribers (e.g., HospitalMatchCard component)
    this.listeners.forEach((l) => {
      try { l(this.state); } catch {}
    });
    // Persist for crash recovery
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)).catch(() => {});
  }

  private defaultState(): PreAlertState {
    return {
      status: 'idle',
      hospitalName: '',
      hospitalPhone: '',
      distanceText: '',
      etaMinutes: 0,
      injuryType: '',
      sentAt: null,
      acknowledgedAt: null,
      incidentId: '',
    };
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const hospitalPreAlert = new HospitalPreAlertService();