/**
 * Phase 2 — Cloud Egress (Upload SOS when internet arrives)
 *
 * REAL-WORLD SCENARIO:
 * - Crash on NH-44 at 2 AM. No signal anywhere for 3km.
 * - Phone A broadcasts SOS via BLE → Phone B → Phone C → ...
 * - Phone D is on a truck 3km away, moving. Gets 1 bar of EDGE signal.
 * - CloudEgress on Phone D: "I have internet! Upload the queued SOS."
 * - Cloud receives it → dispatches ambulance.
 *
 * HOW IT WORKS:
 * Every phone that receives an SOS packet adds it to a queue.
 * NetInfo watches for internet connectivity.
 * When internet arrives → process the queue → POST to cloud API.
 * Failed uploads retry automatically.
 *
 * FOR PHASE 2 DEMO: We POST to httpbin.org/post (a test endpoint that
 * echoes back your data). Replace with your real FastAPI endpoint later.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { SOSPacket } from './MeshRelay/types';

// Where we upload SOS packets
// httpbin.org/post is a free test endpoint that accepts any POST and echoes it back
// Replace this with your FastAPI endpoint in Phase 6
// Phase 15: Production endpoint on Render
const CLOUD_ENDPOINT = 'https://YOUR-RENDER-URL.onrender.com/api/v1/sos';

const EGRESS_QUEUE_KEY = 'aether_egress_queue_v1';

class CloudEgress {
  private isProcessing = false;
  private netInfoUnsubscribe: (() => void) | null = null;

  /**
   * Start listening for internet connectivity.
   * When internet is detected, automatically upload queued packets.
   *
   * Call this once at app startup.
   */
  startMonitoring(): void {
    this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        this.processQueue();
      }
    });
    console.log('[CloudEgress] Monitoring internet connectivity');
  }

  /**
   * Add an SOS packet to the upload queue.
   * Immediately tries to upload if internet is available.
   * If not available, packet waits in SQLite until connectivity returns.
   */
  async enqueue(packet: SOSPacket): Promise<void> {
    try {
      const queue = await this.loadQueue();

      // Avoid duplicates in queue
      if (queue.some(p => p.incidentId === packet.incidentId)) {
        return;
      }

      queue.push(packet);
      await this.saveQueue(queue);
      console.log(`[CloudEgress] Queued ${packet.incidentId} (queue size: ${queue.length})`);

      // Try to upload right now
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        this.processQueue();
      }
    } catch (error) {
      console.error('[CloudEgress] Enqueue error:', error);
    }
  }

  /**
   * Process the upload queue.
   * Upload each packet, remove successful ones from queue.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return; // Prevent concurrent runs
    this.isProcessing = true;

    try {
      const queue = await this.loadQueue();
      if (queue.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log(`[CloudEgress] Processing ${queue.length} queued SOS packet(s)`);
      const successfulIds: string[] = [];

      for (const packet of queue) {
        const success = await this.upload(packet);
        if (success) {
          successfulIds.push(packet.incidentId);
          this.emit('CLOUD_EGRESS_SUCCESS', packet);
        } else {
          this.emit('CLOUD_EGRESS_FAILED', packet);
        }
      }

      // Remove successfully uploaded packets
      const remaining = queue.filter(p => !successfulIds.includes(p.incidentId));
      await this.saveQueue(remaining);

      console.log(
        `[CloudEgress] Uploaded ${successfulIds.length}/${queue.length}. ` +
        `${remaining.length} remaining in queue.`
      );
    } catch (error) {
      console.error('[CloudEgress] Queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Upload a single SOS packet to the cloud endpoint.
   */
  private async upload(packet: SOSPacket): Promise<boolean> {
    try {
      const response = await fetch(CLOUD_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AETHER-Client': '1.0',
          'X-AETHER-Incident': packet.incidentId,
        },
        body: JSON.stringify({
          ...packet,
          uploadedAt: Date.now(),
          appVersion: '1.0.0',
          phase: 'phase2_demo',
        }),
      });

      if (response.ok) {
        console.log(`[CloudEgress] ✅ Uploaded ${packet.incidentId}`);
        return true;
      } else {
        console.warn(`[CloudEgress] Server error ${response.status} for ${packet.incidentId}`);
        return false;
      }
    } catch (error) {
      console.warn(`[CloudEgress] Network error for ${packet.incidentId}:`, error);
      return false;
    }
  }

  private async loadQueue(): Promise<SOSPacket[]> {
    try {
      const stored = await AsyncStorage.getItem(EGRESS_QUEUE_KEY);
      return stored ? (JSON.parse(stored) as SOSPacket[]) : [];
    } catch {
      return [];
    }
  }

  private async saveQueue(queue: SOSPacket[]): Promise<void> {
    await AsyncStorage.setItem(EGRESS_QUEUE_KEY, JSON.stringify(queue));
  }

  /** Get current queue size for the debug panel */
  async getQueueSize(): Promise<number> {
    return (await this.loadQueue()).length;
  }

  // Simple event bridge so MeshRelayManager can get upload status events
  private successListeners: Array<(packet: SOSPacket) => void> = [];
  private failListeners: Array<(packet: SOSPacket) => void> = [];

  onSuccess(cb: (packet: SOSPacket) => void): void { this.successListeners.push(cb); }
  onFail(cb: (packet: SOSPacket) => void): void { this.failListeners.push(cb); }

  private emit(type: 'CLOUD_EGRESS_SUCCESS' | 'CLOUD_EGRESS_FAILED', packet: SOSPacket): void {
    const list = type === 'CLOUD_EGRESS_SUCCESS' ? this.successListeners : this.failListeners;
    list.forEach(cb => { try { cb(packet); } catch {} });
  }

  stopMonitoring(): void {
    this.netInfoUnsubscribe?.();
    this.netInfoUnsubscribe = null;
  }
}

export const cloudEgress = new CloudEgress();