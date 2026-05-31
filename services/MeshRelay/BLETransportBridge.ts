/**
 * BLETransportBridge.ts — FINAL FIX (v3)
 *
 * THREE BUGS FIXED IN THIS VERSION:
 *
 * BUG 1 — Plugin didn't register BLEPeripheral (fixed in withBLEPeripheral.js v3)
 *   Result: BLEPeripheral was null → startAdvertising() silently did nothing
 *   → SOS could never be broadcast → other phone never received it
 *
 * BUG 2 — False peer detection (MESH · 1/2/3 jumping randomly)
 *   BEFORE: ANY BLE device with 22–24 byte manufacturer data was added to
 *           activePeers (random headphones, fitness trackers, etc.)
 *   AFTER:  A device is only counted as an AETHER peer AFTER we successfully
 *           decode a valid AETHER SOS packet from it. Random devices never pass
 *           the packet decode and are never counted.
 *
 * BUG 3 — Single-shot advertising (SOS easily missed)
 *   BEFORE: Advertised once for 12s then stopped. If the other phone was in a
 *           5s scan pause at that exact moment, it missed the SOS forever.
 *   AFTER:  Keep-alive advertising re-broadcasts every 8s for up to 5 minutes.
 *           Any scan window (5s on / 5s off) will catch it within one cycle.
 */

import { BleManager, State as BleState } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid, NativeModules } from 'react-native';
import { SOSPacket } from './types';
import { HazardPacket } from '../DriverIntelligence/types';
import {
  encodeToBytes,
  decodeFromBase64,
  AETHER_SERVICE_UUID,
} from './BLEPacketCodec';

// ── Native advertising module ─────────────────────────────────────────────────
const BLEPeripheral: {
  startAdvertising: (serviceUUID: string, manufacturerData: number[]) => void;
  stopAdvertising: () => void;
} | null = (() => {
  try {
    const mod = NativeModules.BLEPeripheral;
    if (mod?.startAdvertising && mod?.stopAdvertising) return mod;
    return null;
  } catch {
    return null;
  }
})();

// ── Types ─────────────────────────────────────────────────────────────────────
type PacketReceivedCallback = (packet: SOSPacket, relayedBy: string) => void;
type ConnectionStatusCallback = (connected: boolean, deviceCount: number) => void;
type HazardReceivedCallback = (packet: HazardPacket) => void;

// ── Constants ─────────────────────────────────────────────────────────────────
const SCAN_WINDOW_MS      = 5_000;  // Scan on for 5s
const SCAN_PAUSE_MS       = 5_000;  // Scan off for 5s
const PEER_TIMEOUT_MS     = 30_000; // Remove peer if not seen for 30s
const PEER_POLL_MS        = 10_000; // Check stale peers every 10s
const KEEP_ALIVE_INTERVAL = 8_000;  // Re-advertise SOS every 8s
const KEEP_ALIVE_MAX_MS   = 300_000;// Keep-alive stops after 5 minutes

class BLETransportBridge {
  private readonly bleManager = new BleManager();
  private deviceId = '';

  private packetCallback: PacketReceivedCallback | null = null;
  private statusCallback: ConnectionStatusCallback | null = null;
  private hazardCallback: HazardReceivedCallback | null = null;

  private _isConnected = false;

  /**
   * Only AETHER-verified peers are stored here.
   * A device is added ONLY when we successfully decode a valid SOS packet from it.
   * Random BLE devices with coincidentally-sized manufacturer data are NEVER added.
   */
  private verifiedAETHERPeers: Map<string, number> = new Map(); // deviceId → lastSeenMs

  private scanCycleTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private keepAliveStopTimer: ReturnType<typeof setTimeout> | null = null;
  private peerCleanupTimer: ReturnType<typeof setInterval> | null = null;
  private isScanning = false;
  private shouldReconnect = true;
  private keepAlivePacket: SOSPacket | null = null;

  // ── Initialization ──────────────────────────────────────────────────────────

  async connect(deviceId: string): Promise<boolean> {
    this.deviceId = deviceId;
    this.shouldReconnect = true;

    if (Platform.OS === 'android') {
      const granted = await this.requestAndroidPermissions();
      if (!granted) {
        console.warn('[BLETransport] ❌ Permissions denied');
        return false;
      }
    }

    if (!BLEPeripheral) {
      console.error(
        '[BLETransport] ❌ CRITICAL: BLEPeripheralModule not loaded.',
        'This means the config plugin (plugins/withBLEPeripheral.js) did not register',
        'BLEPeripheralPackage in MainApplication.kt.',
        'SOS CANNOT be advertised. Fix the plugin and rebuild.'
      );
    } else {
      console.log('[BLETransport] ✅ BLEPeripheralModule loaded');
    }

    const ready = await this.waitForBLEReady(5000);
    if (!ready) {
      console.warn('[BLETransport] BLE not on yet — will start when enabled');
      this.bleManager.onStateChange((state) => {
        if (state === BleState.PoweredOn && this.shouldReconnect && !this._isConnected) {
          this.startMesh();
        }
      }, true);
      return false;
    }

    this.startMesh();
    return true;
  }

  private startMesh(): void {
    this._isConnected = true;
    this.startDutyCycleScan();
    this.startPeerCleanup();
    console.log(
      `[BLETransport] ✅ BLE mesh active | ` +
      `advertising: ${BLEPeripheral ? '✅' : '❌ BROKEN — rebuild APK'} | ` +
      `scanning: ✅`
    );
    this.statusCallback?.(true, this.connectedDevices);
  }

  // ── Broadcasting ────────────────────────────────────────────────────────────

  broadcast(packet: SOSPacket): boolean {
    if (!this._isConnected) {
      console.warn('[BLETransport] Not connected');
      return false;
    }
    if (!BLEPeripheral) {
      console.error('[BLETransport] ❌ BLEPeripheralModule is null — cannot broadcast');
      return false;
    }

    const bytes = encodeToBytes(packet);
    if (!bytes) {
      console.warn('[BLETransport] Encode failed for', packet.incidentId);
      return false;
    }

    this.advertiseOnce(bytes, packet.incidentId);
    return true;
  }

  broadcastHazard(_packet: HazardPacket): boolean {
    return true; // Hazards sync via cloud
  }

  private advertiseOnce(bytes: number[], incidentId: string): void {
    if (!BLEPeripheral) return;
    try { BLEPeripheral.stopAdvertising(); } catch {}
    try {
      BLEPeripheral.startAdvertising(AETHER_SERVICE_UUID, bytes);
      console.log(`[BLETransport] 📡 Advertising ${incidentId} (${bytes.length}B)`);
    } catch (e) {
      console.error('[BLETransport] startAdvertising threw:', e);
    }
  }

  /**
   * Keep-alive: re-advertise every 8s so any phone entering range
   * gets the SOS even if it missed the first broadcast.
   * Automatically stops after KEEP_ALIVE_MAX_MS (5 minutes).
   *
   * Called by MeshRelayManager after triggerSOS().
   */
  startKeepAlive(packet: SOSPacket): void {
    if (!BLEPeripheral) {
      console.warn('[BLETransport] startKeepAlive skipped — BLEPeripheral null');
      return;
    }

    this.stopKeepAlive(); // Clear any previous keep-alive

    const bytes = encodeToBytes(packet);
    if (!bytes) return;

    this.keepAlivePacket = packet;
    console.log(`[BLETransport] 🔄 Keep-alive started for ${packet.incidentId}`);

    // Advertise immediately, then every 8s
    this.advertiseOnce(bytes, packet.incidentId);

    this.keepAliveTimer = setInterval(() => {
      if (!this.shouldReconnect) return;
      this.advertiseOnce(bytes, packet.incidentId);
    }, KEEP_ALIVE_INTERVAL);

    // Auto-stop after 5 minutes
    this.keepAliveStopTimer = setTimeout(() => {
      console.log(`[BLETransport] Keep-alive expired for ${packet.incidentId}`);
      this.stopKeepAlive();
    }, KEEP_ALIVE_MAX_MS);
  }

  stopKeepAlive(): void {
    if (this.keepAliveTimer)     { clearInterval(this.keepAliveTimer);    this.keepAliveTimer = null; }
    if (this.keepAliveStopTimer) { clearTimeout(this.keepAliveStopTimer); this.keepAliveStopTimer = null; }
    this.keepAlivePacket = null;
    try { BLEPeripheral?.stopAdvertising(); } catch {}
  }

  // ── Scanning ────────────────────────────────────────────────────────────────

  /**
   * Duty-cycle scan with UUID filter.
   *
   * We use the AETHER service UUID as a filter so Android only wakes us up for
   * AETHER advertisements. This is reliable because our BLEPeripheralModule
   * correctly includes the service UUID in the advertisement packet.
   *
   * UUID filter is far more battery-efficient and precise than null (scan-all).
   * It was unreliable in the previous APK only because BLEPeripheral wasn't
   * registered — so nothing was advertising with our UUID to be found.
   * Now that the plugin is fixed, UUID filter is the correct approach.
   */
  private startDutyCycleScan(): void {
    const scan = () => {
      if (!this.shouldReconnect) return;

      this.isScanning = true;
      this.bleManager.startDeviceScan(
        [AETHER_SERVICE_UUID],   // UUID filter — only wake up for AETHER devices
        { allowDuplicates: true }, // allowDuplicates so we see every advertisement
        (error, device) => {
          if (error) {
            console.warn('[BLETransport] Scan error:', error.message);
            this.bleManager.stopDeviceScan();
            this.isScanning = false;
            // Back off on error
            this.scanCycleTimer = setTimeout(scan, SCAN_PAUSE_MS * 2);
            return;
          }
          if (!device?.manufacturerData) return;

          this.onDeviceSeen(device.id, device.manufacturerData);
        }
      );

      // Stop scan after SCAN_WINDOW_MS, pause, then resume
      this.scanCycleTimer = setTimeout(() => {
        this.bleManager.stopDeviceScan();
        this.isScanning = false;
        this.scanCycleTimer = setTimeout(scan, SCAN_PAUSE_MS);
      }, SCAN_WINDOW_MS);
    };

    scan();
  }

  /**
   * Called for every AETHER BLE advertisement received.
   *
   * KEY FIX: A device is only added to verifiedAETHERPeers AFTER a valid SOS
   * packet is successfully decoded from it. This prevents false peer detection
   * from random BLE devices. MESH count is now accurate.
   */
  private onDeviceSeen(
    bleDeviceId: string,
    manufacturerData: string
  ): void {
    // Attempt to decode the SOS packet
    const packet = decodeFromBase64(manufacturerData, bleDeviceId);

    if (!packet) {
      // Not a valid AETHER packet — ignore completely (don't add to peers)
      return;
    }

    // Don't react to our own advertisements
    if (packet.deviceHash.startsWith(this.deviceId.substring(0, 8))) return;

    // ── Verified AETHER peer ──────────────────────────────────────────────────
    const wasNew = !this.verifiedAETHERPeers.has(bleDeviceId);
    this.verifiedAETHERPeers.set(bleDeviceId, Date.now());

    if (wasNew) {
      console.log(
        `[BLETransport] 📱 Verified AETHER peer: ${bleDeviceId.substring(0, 8)}` +
        ` | MESH peers now: ${this.connectedDevices}`
      );
      this.statusCallback?.(true, this.connectedDevices);
    }

    // ── Deliver the SOS ───────────────────────────────────────────────────────
    console.log(
      `[BLETransport] 🚨 SOS received from ${bleDeviceId.substring(0, 8)}` +
      ` | incident=${packet.incidentId} hop=${packet.hopCount} sev=${packet.severity}`
    );
    this.packetCallback?.(packet, bleDeviceId);
  }

  // ── Peer Cleanup ────────────────────────────────────────────────────────────

  private startPeerCleanup(): void {
    this.peerCleanupTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, lastSeen] of this.verifiedAETHERPeers.entries()) {
        if (now - lastSeen > PEER_TIMEOUT_MS) {
          this.verifiedAETHERPeers.delete(id);
          changed = true;
          console.log(`[BLETransport] Peer ${id.substring(0, 8)} timed out`);
        }
      }
      if (changed) this.statusCallback?.(true, this.connectedDevices);
    }, PEER_POLL_MS);
  }

  // ── Permissions ─────────────────────────────────────────────────────────────

  private async requestAndroidPermissions(): Promise<boolean> {
    try {
      const permissions = [
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.BLUETOOTH_ADVERTISE',
        'android.permission.ACCESS_FINE_LOCATION',
      ];
      const results = await PermissionsAndroid.requestMultiple(permissions as any);
      const allGranted = Object.values(results).every(v => v === 'granted');
      if (!allGranted) {
        const denied = Object.entries(results)
          .filter(([, v]) => v !== 'granted')
          .map(([k]) => k.split('.').pop())
          .join(', ');
        console.warn(`[BLETransport] Denied: ${denied}`);
      }
      return allGranted;
    } catch (e) {
      console.error('[BLETransport] Permission error:', e);
      return false;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private waitForBLEReady(ms: number): Promise<boolean> {
    return new Promise(resolve => {
      const t = setTimeout(() => resolve(false), ms);
      this.bleManager.onStateChange(state => {
        if (state === BleState.PoweredOn) { clearTimeout(t); resolve(true); }
      }, true);
    });
  }

  // ── Callback registration ───────────────────────────────────────────────────

  onPacketReceived(cb: PacketReceivedCallback): void  { this.packetCallback = cb; }
  onStatusChanged(cb: ConnectionStatusCallback): void { this.statusCallback  = cb; }
  onHazardReceived(cb: HazardReceivedCallback): void  { this.hazardCallback  = cb; }

  // ── Getters ──────────────────────────────────────────────────────────────────

  get isConnected(): boolean  { return this._isConnected; }

  /**
   * Verified AETHER peers + this device.
   * Will now only show ≥ 2 when another AETHER phone has been decoded.
   */
  get connectedDevices(): number { return this.verifiedAETHERPeers.size + 1; }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  disconnect(): void {
    this.shouldReconnect = false;
    this._isConnected = false;
    if (this.scanCycleTimer)    clearTimeout(this.scanCycleTimer);
    if (this.peerCleanupTimer)  clearInterval(this.peerCleanupTimer);
    this.stopKeepAlive();
    if (this.isScanning) { this.bleManager.stopDeviceScan(); this.isScanning = false; }
    this.verifiedAETHERPeers.clear();
    console.log('[BLETransport] Disconnected');
  }
}

export const bleTransportBridge = new BLETransportBridge();
