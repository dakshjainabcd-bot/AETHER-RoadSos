/**
 * Phase 2 — Simulation Bridge (Expo Go Mode)
 * Phase 12 — Extended with HAZARD packet support
 * Phase 14 — Extended with PEER_COUNT_UPDATE for DTN
 *
 * WHAT'S NEW IN PHASE 12:
 * - broadcastHazard(packet): sends a HAZARD_PACKET to the server
 * - onHazardReceived(callback): called when server relays a hazard to us
 * - handleMessage() now handles HAZARD_RECEIVED messages
 *
 * WHAT'S NEW IN PHASE 14:
 * - Handles PEER_COUNT_UPDATE messages from server so DTN knows when new peers join
 *
 * The hazard system works exactly like SOS packets but with:
 * - Different packet type (HazardPacket vs SOSPacket)
 * - Shorter TTL (30 min) and fewer hops (max 15)
 * - Alert radius of 3km (vs 500m for bystander SOS alerts)
 */

import { SOSPacket } from './types';
import { HazardPacket } from '../DriverIntelligence/types';
import { SIMULATION_SERVER_URL } from '../../utils/constants';

type PacketReceivedCallback = (packet: SOSPacket, relayedBy: string) => void;
type ConnectionStatusCallback = (connected: boolean, deviceCount: number) => void;
type HazardReceivedCallback = (packet: HazardPacket) => void;

class SimulationBridge {
  private ws: WebSocket | null = null;
  private deviceId: string = '';
  private packetCallback: PacketReceivedCallback | null = null;
  private statusCallback: ConnectionStatusCallback | null = null;
  private hazardCallback: HazardReceivedCallback | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _isConnected: boolean = false;
  private _connectedDevices: number = 0;
  private shouldReconnect: boolean = true;

  async connect(deviceId: string): Promise<boolean> {
    this.deviceId = deviceId;
    this.shouldReconnect = true;
    return this._connect();
  }

  private _connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.ws) {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        try { this.ws.close(); } catch {}
        this.ws = null;
      }

      try {
        console.log(`[SimBridge] Connecting to ${SIMULATION_SERVER_URL}...`);
        this.ws = new WebSocket(SIMULATION_SERVER_URL);

        const connectTimeout = setTimeout(() => {
          if (!this._isConnected) {
            console.warn('[SimBridge] Connection timeout — server not reachable');
            try { this.ws?.close(); } catch {}
            resolve(false);
          }
        }, 5000);

        this.ws.onopen = () => {
          clearTimeout(connectTimeout);
          console.log('[SimBridge] ✅ Connected to simulation server');
          this._isConnected = true;

          this.ws!.send(JSON.stringify({
            type: 'REGISTER',
            deviceId: this.deviceId,
          }));

          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data as string);
        };

        this.ws.onerror = () => {
          clearTimeout(connectTimeout);
          if (!this._isConnected) {
            console.warn('[SimBridge] ⚠️  Cannot reach simulation server');
            console.warn('   → Start it with: cd server && npm start');
            this._isConnected = false;
            resolve(false);
          }
        };

        this.ws.onclose = () => {
          const wasConnected = this._isConnected;
          this._isConnected = false;
          this._connectedDevices = 0;

          if (wasConnected) {
            console.log('[SimBridge] Disconnected from server');
            this.statusCallback?.(false, 0);
          }

          if (this.shouldReconnect) {
            this.reconnectTimer = setTimeout(() => {
              console.log('[SimBridge] Attempting reconnect...');
              this._connect().catch(() => {});
            }, 5000);
          }
        };

      } catch (error) {
        console.warn('[SimBridge] WebSocket creation failed:', error);
        this._isConnected = false;
        resolve(false);
      }
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as {
        type: string;
        deviceId?: string;
        connectedDevices?: number;
        packet?: SOSPacket | HazardPacket;
        relayedBy?: string;
      };

      switch (message.type) {
        case 'REGISTERED':
          this._connectedDevices = message.connectedDevices ?? 0;
          console.log(
            `[SimBridge] Registered. ${this._connectedDevices} phone(s) online.`
          );
          this.statusCallback?.(true, this._connectedDevices);
          break;

        case 'SOS_RECEIVED':
          if (message.packet && message.relayedBy) {
            console.log(
              `[SimBridge] 🚨 SOS received! Incident: ${(message.packet as SOSPacket).incidentId}, ` +
              `Hop: ${message.packet.hopCount}, From: ${message.relayedBy.substring(0, 8)}...`
            );
            this.packetCallback?.(message.packet as SOSPacket, message.relayedBy);
          }
          break;

        // ── NEW CASE: Phase 14 DTN ────────────────────────────────────────────
        // The server now sends this message to ALL phones whenever the total
        // number of connected phones changes (new join OR disconnect).
        //
        // WHY WE NEED THIS:
        // Without this message, a phone that joined FIRST would never know
        // when a second phone joins. It would keep its connectedDevices count
        // at 1 forever and never try to forward DTN packets.
        //
        // WITH this message, when Phone B joins:
        //   - Server sends PEER_COUNT_UPDATE to Phone A
        //   - Phone A's connectedDevices updates to 2
        //   - DTNManager.tryForward() is triggered
        //   - Buffered packets are forwarded to Phone B
        case 'PEER_COUNT_UPDATE':
          this._connectedDevices = message.connectedDevices ?? 0;
          console.log(
            `[SimBridge] 📱 Peer count updated: ${this._connectedDevices} phone(s) online`
          );
          // Fire the status callback — MeshRelayManager listens to this
          // and will trigger DTN.tryForward() if count increased
          this.statusCallback?.(this._isConnected, this._connectedDevices);
          break;

        // ── PHASE 12 ADDITION ──────────────────────────────────────────────
        case 'HAZARD_RECEIVED':
          if (message.packet) {
            const hazard = message.packet as HazardPacket;
            console.log(
              `[SimBridge] ⚠️  Hazard received! Type: ${hazard.hazardType}, ` +
              `Hop: ${hazard.hopCount}`
            );
            this.hazardCallback?.(hazard);
          }
          break;
        // ──────────────────────────────────────────────────────────────────

        default:
          // Unknown message type — ignore
          break;
      }
    } catch (error) {
      console.error('[SimBridge] Failed to parse server message:', error);
    }
  }

  /**
   * Broadcast an SOS packet (Phase 2 — unchanged).
   */
  broadcast(packet: SOSPacket): boolean {
    if (!this._isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[SimBridge] Cannot broadcast — not connected to simulation server');
      return false;
    }

    this.ws.send(JSON.stringify({
      type: 'SOS_PACKET',
      packet,
    }));

    console.log(`[SimBridge] 📡 Broadcasted SOS hop=${packet.hopCount} incident=${packet.incidentId}`);
    return true;
  }

  /**
   * Broadcast a HAZARD packet (Phase 12 — new).
   * Called by HazardBroadcaster when a hazard is reported or relayed.
   */
  broadcastHazard(packet: HazardPacket): boolean {
    if (!this._isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.ws.send(JSON.stringify({
      type: 'HAZARD_PACKET',
      packet,
    }));

    console.log(
      `[SimBridge] ⚠️  Broadcasted hazard hop=${packet.hopCount} ` +
      `type=${packet.hazardType} id=${packet.hazardId}`
    );
    return true;
  }

  /** Register callback for received SOS packets */
  onPacketReceived(callback: PacketReceivedCallback): void {
    this.packetCallback = callback;
  }

  /** Register callback for connection status changes */
  onStatusChanged(callback: ConnectionStatusCallback): void {
    this.statusCallback = callback;
  }

  /**
   * Register callback for received HAZARD packets (Phase 12 — new).
   * Called by HazardBroadcaster.initialize().
   */
  onHazardReceived(callback: HazardReceivedCallback): void {
    this.hazardCallback = callback;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get connectedDevices(): number {
    return this._connectedDevices;
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this._isConnected = false;
  }
}

export const simulationBridge = new SimulationBridge();