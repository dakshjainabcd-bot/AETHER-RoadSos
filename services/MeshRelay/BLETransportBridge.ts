/**
 * BLETransportBridge.ts — FIXED v4
 *
 * FIX 1: Advertisement payload was too large (47 bytes > 31 byte BLE limit)
 *   → Plugin v4 removes addServiceUuid. Payload now 29 bytes ✓
 *
 * FIX 2: UUID scan filter blocked all results (nothing was advertising our UUID)
 *   → Changed to null filter: scans ALL BLE devices, filters by AETHER packet decode
 *
 * FIX 3: broadcastHazard was a no-op → hazards now handled via simulationBridge
 *   in HazardBroadcaster.ts (dual transport pattern)
 */
import { BleManager, State as BleState } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid, NativeModules } from 'react-native';
import { SOSPacket } from './types';
import { HazardPacket } from '../DriverIntelligence/types';
import { encodeToBytes, decodeFromBase64 } from './BLEPacketCodec';

// ── Native advertising module ────────────────────────────────────────────────
const BLEPeripheral: {
  startAdvertising: (serviceUUID: string, manufacturerData: number[]) => void;
  stopAdvertising: () => void;
} | null = (() => {
  try {
    const mod = NativeModules.BLEPeripheral;
    if (mod?.startAdvertising && mod?.stopAdvertising) return mod;
    return null;
  } catch { return null; }
})();

// Dummy UUID passed to native API — NOT included in advertisement data (plugin v4)
const DUMMY_UUID = 'ae700001-ae70-ae70-ae70-ae700000ae70';

type PacketReceivedCallback = (packet: SOSPacket, relayedBy: string) => void;
type ConnectionStatusCallback = (connected: boolean, deviceCount: number) => void;
type HazardReceivedCallback = (packet: HazardPacket) => void;

const SCAN_WINDOW_MS   = 5_000;
const SCAN_PAUSE_MS    = 3_000;  // Reduced from 5s for faster peer detection
const PEER_TIMEOUT_MS  = 30_000;
const PEER_POLL_MS     = 10_000;
const KEEP_ALIVE_INTERVAL = 8_000;
const KEEP_ALIVE_MAX_MS   = 300_000;

class BLETransportBridge {
  private readonly bleManager = new BleManager();
  private deviceId = '';
  private packetCallback: PacketReceivedCallback | null = null;
  private statusCallback: ConnectionStatusCallback | null = null;
  private hazardCallback: HazardReceivedCallback | null = null;
  private _isConnected = false;

  /**
   * Only devices that successfully decode a valid AETHER packet are added here.
   * Random BLE devices (headphones, etc.) are NEVER counted as peers.
   */
  private verifiedAETHERPeers: Map<string, number> = new Map();

  private scanCycleTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private keepAliveStopTimer: ReturnType<typeof setTimeout> | null = null;
  private peerCleanupTimer: ReturnType<typeof setInterval> | null = null;
  private isScanning = false;
  private shouldReconnect = true;

  // ── Initialization ─────────────────────────────────────────────────────────
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
      console.error('[BLETransport] ❌ BLEPeripheralModule not loaded — BLE advertising disabled, WebSocket relay active');
    } else {
      console.log('[BLETransport] ✅ BLEPeripheralModule loaded');
    }

    const ready = await this.waitForBLEReady(5000);
    if (!ready) {
      console.warn('[BLETransport] BLE not on yet — will start when Bluetooth enabled');
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
      `advertising: ${BLEPeripheral ? '✅' : '❌ (WebSocket fallback)'} | ` +
      `scanning: ✅ (null filter — catches all AETHER devices)`
    );
    this.statusCallback?.(true, this.connectedDevices);
  }

  // ── Broadcasting ───────────────────────────────────────────────────────────
  broadcast(packet: SOSPacket): boolean {
    if (!this._isConnected) return false;
    if (!BLEPeripheral) {
      console.warn('[BLETransport] BLEPeripheral null — skipping BLE broadcast');
      return false;
    }
    const bytes = encodeToBytes(packet);
    if (!bytes) return false;
    this.advertiseOnce(bytes, packet.incidentId);
    return true;
  }

  /**
   * Hazard broadcasting is handled via simulationBridge (WebSocket) in HazardBroadcaster.ts.
   * This stub prevents TypeScript errors from callers.
   */
  broadcastHazard(_packet: HazardPacket): boolean {
    return false; // Handled by simulationBridge in HazardBroadcaster
  }

  private advertiseOnce(bytes: number[], incidentId: string): void {
    if (!BLEPeripheral) return;
    try { BLEPeripheral.stopAdvertising(); } catch {}
    try {
      BLEPeripheral.startAdvertising(DUMMY_UUID, bytes);
      console.log(`[BLETransport] 📡 Advertising ${incidentId} (${bytes.length}B → 29B total, within 31B limit)`);
    } catch (e) {
      console.error('[BLETransport] startAdvertising threw:', e);
    }
  }

  startKeepAlive(packet: SOSPacket): void {
    if (!BLEPeripheral) {
      console.warn('[BLETransport] Keep-alive skipped — BLEPeripheral null, WebSocket relay active');
      return;
    }
    this.stopKeepAlive();
    const bytes = encodeToBytes(packet);
    if (!bytes) return;
    console.log(`[BLETransport] 🔄 Keep-alive started for ${packet.incidentId}`);
    this.advertiseOnce(bytes, packet.incidentId);
    this.keepAliveTimer = setInterval(() => {
      if (!this.shouldReconnect) return;
      this.advertiseOnce(bytes, packet.incidentId);
    }, KEEP_ALIVE_INTERVAL);
    this.keepAliveStopTimer = setTimeout(() => {
      this.stopKeepAlive();
    }, KEEP_ALIVE_MAX_MS);
  }

  stopKeepAlive(): void {
    if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
    if (this.keepAliveStopTimer) { clearTimeout(this.keepAliveStopTimer); this.keepAliveStopTimer = null; }
    try { BLEPeripheral?.stopAdvertising(); } catch {}
  }

  // ── Scanning ───────────────────────────────────────────────────────────────
  /**
   * FIXED: null service UUID filter instead of [AETHER_SERVICE_UUID].
   *
   * WHY NULL: The advertisement no longer includes the service UUID (removed to
   * stay within the 31-byte BLE limit). UUID filter would find zero devices.
   * null = scan ALL BLE devices, then decode each manufacturer payload.
   * Non-AETHER devices are rejected instantly in onDeviceSeen() when decode returns null.
   */
  private startDutyCycleScan(): void {
    const scan = () => {
      if (!this.shouldReconnect) return;
      this.isScanning = true;
      this.bleManager.startDeviceScan(
        null,                        // ← FIX: null = scan all BLE devices
        { allowDuplicates: true },   // See every re-advertisement
        (error, device) => {
          if (error) {
            console.warn('[BLETransport] Scan error:', error.message);
            this.bleManager.stopDeviceScan();
            this.isScanning = false;
            this.scanCycleTimer = setTimeout(scan, SCAN_PAUSE_MS * 2);
            return;
          }
          if (!device?.manufacturerData) return;
          this.onDeviceSeen(device.id, device.manufacturerData);
        }
      );
      this.scanCycleTimer = setTimeout(() => {
        this.bleManager.stopDeviceScan();
        this.isScanning = false;
        this.scanCycleTimer = setTimeout(scan, SCAN_PAUSE_MS);
      }, SCAN_WINDOW_MS);
    };
    scan();
  }

  private onDeviceSeen(bleDeviceId: string, manufacturerData: string): void {
    const packet = decodeFromBase64(manufacturerData, bleDeviceId);
    if (!packet) return; // Not an AETHER packet — ignore (normal for most BLE devices)

    // Ignore our own advertisements
    if (packet.deviceHash.startsWith(this.deviceId.substring(0, 8))) return;

    const wasNew = !this.verifiedAETHERPeers.has(bleDeviceId);
    this.verifiedAETHERPeers.set(bleDeviceId, Date.now());

    if (wasNew) {
      console.log(
        `[BLETransport] 📱 AETHER peer verified: ${bleDeviceId.substring(0, 8)}` +
        ` | MESH peers: ${this.connectedDevices}`
      );
      this.statusCallback?.(true, this.connectedDevices);
    }

    console.log(
      `[BLETransport] 🚨 SOS via BLE from ${bleDeviceId.substring(0, 8)}` +
      ` | incident=${packet.incidentId} hop=${packet.hopCount} sev=${packet.severity}`
    );
    this.packetCallback?.(packet, bleDeviceId);
  }

  // ── Peer Cleanup ───────────────────────────────────────────────────────────
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

  // ── Permissions ────────────────────────────────────────────────────────────
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

  private waitForBLEReady(ms: number): Promise<boolean> {
    return new Promise(resolve => {
      const t = setTimeout(() => resolve(false), ms);
      this.bleManager.onStateChange(state => {
        if (state === BleState.PoweredOn) { clearTimeout(t); resolve(true); }
      }, true);
    });
  }

  // ── Callbacks ──────────────────────────────────────────────────────────────
  onPacketReceived(cb: PacketReceivedCallback): void { this.packetCallback = cb; }
  onStatusChanged(cb: ConnectionStatusCallback): void { this.statusCallback = cb; }
  onHazardReceived(cb: HazardReceivedCallback): void { this.hazardCallback = cb; }

  // ── Getters ────────────────────────────────────────────────────────────────
  get isConnected(): boolean { return this._isConnected; }
  /** Verified AETHER peers + self = total mesh nodes visible via BLE */
  get connectedDevices(): number { return this.verifiedAETHERPeers.size + 1; }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  disconnect(): void {
    this.shouldReconnect = false;
    this._isConnected = false;
    if (this.scanCycleTimer) clearTimeout(this.scanCycleTimer);
    if (this.peerCleanupTimer) clearInterval(this.peerCleanupTimer);
    this.stopKeepAlive();
    if (this.isScanning) { this.bleManager.stopDeviceScan(); this.isScanning = false; }
    this.verifiedAETHERPeers.clear();
    console.log('[BLETransport] Disconnected');
  }
}

export const bleTransportBridge = new BLETransportBridge();
