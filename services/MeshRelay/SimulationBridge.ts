/**
 * Phase 2 — Simulation Bridge (Expo Go Mode)
 *
 * In PRODUCTION: AETHER uses Bluetooth Low Energy (BLE) to broadcast
 * SOS packets phone-to-phone without internet.
 *
 * In EXPO GO (development/demo): BLE native modules aren't available.
 * This SimulationBridge connects all phones to a WebSocket server on
 * your laptop (over WiFi). The SERVER rebroadcasts to all other phones,
 * perfectly simulating what BLE would do.
 *
 * DEMO FLOW:
 * Phone A crashes → sends SOS to server → server broadcasts to B and C
 * B receives it → shows "Accident nearby" → relays to server
 * Server broadcasts relay to C (with hopCount = 2)
 *
 * This is IDENTICAL behavior to real BLE — just using WiFi for the demo.
 *
 * REPLACING IN PRODUCTION: Delete this file. Replace SimulationBridge
 * calls in MeshRelayManager.ts with react-native-ble-plx calls.
 */

import { SOSPacket } from './types';
import { SIMULATION_SERVER_URL } from '../../utils/constants';

type PacketReceivedCallback = (packet: SOSPacket, relayedBy: string) => void;
type ConnectionStatusCallback = (connected: boolean, deviceCount: number) => void;

class SimulationBridge {
  private ws: WebSocket | null = null;
  private deviceId: string = '';
  private packetCallback: PacketReceivedCallback | null = null;
  private statusCallback: ConnectionStatusCallback | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _isConnected: boolean = false;
  private _connectedDevices: number = 0;
  private shouldReconnect: boolean = true;

  /**
   * Connect to the simulation server.
   *
   * @param deviceId - Anonymous device identifier
   * @returns true if connected, false if server not reachable
   */
  async connect(deviceId: string): Promise<boolean> {
    this.deviceId = deviceId;
    this.shouldReconnect = true;
    return this._connect();
  }

  private _connect(): Promise<boolean> {
    return new Promise((resolve) => {
      // Clear any pending reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // Clean up existing connection
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

        // Set a 5-second connection timeout
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

          // Register this device with the server
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

          // Auto-reconnect after 5 seconds (if we should)
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

  /**
   * Process messages received from the simulation server.
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as {
        type: string;
        deviceId?: string;
        connectedDevices?: number;
        packet?: SOSPacket;
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
              `[SimBridge] 🚨 SOS received! Incident: ${message.packet.incidentId}, ` +
              `Hop: ${message.packet.hopCount}, From: ${message.relayedBy.substring(0, 8)}...`
            );
            this.packetCallback?.(message.packet, message.relayedBy);
          }
          break;

        default:
          // Unknown message type — ignore
          break;
      }
    } catch (error) {
      console.error('[SimBridge] Failed to parse server message:', error);
    }
  }

  /**
   * Broadcast an SOS packet to all other phones (via server).
   * In real BLE, this would be a Bluetooth advertisement.
   *
   * @returns true if sent successfully
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

  /** Register callback for received SOS packets */
  onPacketReceived(callback: PacketReceivedCallback): void {
    this.packetCallback = callback;
  }

  /** Register callback for connection status changes */
  onStatusChanged(callback: ConnectionStatusCallback): void {
    this.statusCallback = callback;
  }

  /** Is the bridge currently connected to the simulation server? */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /** How many phones are currently connected (including this one)? */
  get connectedDevices(): number {
    return this._connectedDevices;
  }

  /** Permanently disconnect (don't reconnect) */
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

// One singleton shared by the entire app
export const simulationBridge = new SimulationBridge();