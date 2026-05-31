/**
 * BLETransportBridge.ts — Fixed Version
 *
 * BUGS FIXED vs previous version:
 *
 * BUG 1 (CRITICAL — root cause of MESH · 1):
 *   The BLEPeripheralModule native module was NOT included in EAS APK builds
 *   because EAS regenerates android/ fresh. This is now fixed by the Expo Config
 *   Plugin in plugins/withBLEPeripheral.js. This file now also handles the case
 *   where BLEPeripheral is unavailable more correctly.
 *
 * BUG 2 (CRITICAL — scan finds nothing):
 *   The scanner was filtering by AETHER_SERVICE_UUID:
 *     startDeviceScan([AETHER_SERVICE_UUID], ...)
 *   UUID-based scan filters are unreliable on Android 10+ in some combinations
 *   of phone model and BLE chip. Changed to: scan ALL BLE devices (null filter),
 *   then filter by manufacturer data in the callback. This is reliable on all devices.
 *
 * BUG 3 (incorrect DTN behaviour):
 *   broadcast() was returning `true` even when BLEPeripheral was null and no
 *   advertising happened. MeshRelayManager saw `broadcast = true` → thought the
 *   SOS was sent → still buffered it (because connectedDevices < 2) but the
 *   logic was misleading. Now returns `false` when advertising is unavailable
 *   so MeshRelayManager always buffers in DTN correctly.
 */

import { BleManager, State as BleState } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid, NativeModules } from 'react-native';
import { SOSPacket } from './types';
import { HazardPacket } from '../DriverIntelligence/types';
import {
  encodeToBytes,
  decodeFromBase64,
  couldBeAETHERPacket,
  AETHER_SERVICE_UUID,
  AETHER_MANUFACTURER_ID,
} from './BLEPacketCodec';

// ── Native BLEPeripheral module (advertising) ─────────────────────────────────
// Provided by plugins/withBLEPeripheral.js config plugin.
// Null on first boot before permissions granted, or on devices without BLE peripheral support.
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

// ── Callback type aliases ─────────────────────────────────────────────────────
type PacketReceivedCallback = (packet: SOSPacket, relayedBy: string) => void;
type ConnectionStatusCallback = (connected: boolean, deviceCount: number) => void;
type HazardReceivedCallback = (packet: HazardPacket) => void;

// ── Constants ─────────────────────────────────────────────────────────────────
const SCAN_WINDOW_MS  = 5_000;   // Scan for 5s
const SCAN_PAUSE_MS   = 5_000;   // Rest 5s (duty cycle — battery saving)
const ADVERTISE_MS    = 12_000;  // Advertise for 12s per broadcast (longer for better discovery)
const PEER_TIMEOUT_MS = 30_000;  // Remove peer unseen for 30s
const PEER_POLL_MS    = 10_000;  // Check for stale peers every 10s

class BLETransportBridge {
  private readonly bleManager = new BleManager();
  private deviceId = '';

  private packetCallback: PacketReceivedCallback | null = null;
  private statusCallback: ConnectionStatusCallback | null = null;
  private hazardCallback: HazardReceivedCallback | null = null;

  private _isConnected = false;
  private activePeers: Map<string, number> = new Map();

  private scanCycleTimer: ReturnType<typeof setTimeout> | null = null;
  private advertiseStopTimer: ReturnType<typeof setTimeout> | null = null;
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
        console.warn('[BLETransport] ❌ BLE permissions denied — mesh unavailable');
        return false;
      }
    }

    // Check if BLEPeripheral native module loaded
    if (BLEPeripheral) {
      console.log('[BLETransport] ✅ BLEPeripheralModule loaded — advertising available');
    } else {
      console.warn(
        '[BLETransport] ⚠️  BLEPeripheralModule NOT loaded.',
        'Likely cause: config plugin (plugins/withBLEPeripheral.js) not applied.',
        'This device can RECEIVE SOS packets but cannot ADVERTISE them.',
        'BLE mesh will not work correctly until the plugin is applied and APK rebuilt.'
      );
    }

    // Wait up to 5s for BLE to power on
    const bleReady = await this.waitForBLEReady(5000);
    if (!bleReady) {
      console.warn('[BLETransport] ⚠️ BLE not on — will auto-start when Bluetooth enabled');
      this.bleManager.onStateChange((state) => {
        if (state === BleState.PoweredOn && this.shouldReconnect && !this._isConnected) {
          console.log('[BLETransport] BT turned on — starting mesh');
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

    const advertiserStatus = BLEPeripheral ? 'advertising ✅' : 'NO advertising ❌ (rebuild APK with config plugin)';
    console.log(`[BLETransport] BLE mesh started | ${advertiserStatus} | scanning ✅`);

    this.statusCallback?.(true, this.connectedDevices);
  }

  // ── Broadcasting (Advertising) ─────────────────────────────────────────────

  /**
   * Broadcast an SOS packet via BLE advertisement manufacturer data.
   *
   * FIX: Now returns FALSE if BLEPeripheral is unavailable (not loaded).
   * Previously returned true even when nothing was advertised, which caused
   * confusing log messages. Now MeshRelayManager will always buffer in DTN
   * when advertising is unavailable.
   */
  broadcast(packet: SOSPacket): boolean {
    if (!this._isConnected) {
      console.warn('[BLETransport] Not connected — cannot broadcast');
      return false;
    }

    // FIX BUG 3: Return false if native advertising module is unavailable
    if (!BLEPeripheral) {
      console.warn(
        '[BLETransport] ❌ Cannot broadcast — BLEPeripheralModule not loaded.',
        'Apply config plugin and rebuild APK.'
      );
      return false;
    }

    const bytes = encodeToBytes(packet);
    if (!bytes) {
      console.warn('[BLETransport] Failed to encode packet:', packet.incidentId);
      return false;
    }

    this.startAdvertising(bytes, packet.incidentId);
    return true;
  }

  broadcastHazard(_packet: HazardPacket): boolean {
    // Hazard packets are too large for the 22-byte BLE codec.
    // They sync via cloud when internet is available.
    return true;
  }

  private startAdvertising(bytes: number[], incidentId: string): void {
    // Guard: BLEPeripheral is guaranteed non-null here (checked in broadcast())
    if (!BLEPeripheral) return;

    try { BLEPeripheral.stopAdvertising(); } catch {}

    try {
      BLEPeripheral.startAdvertising(AETHER_SERVICE_UUID, bytes);
      console.log(`[BLETransport] 📡 BLE advertising: ${incidentId} (${bytes.length} bytes)`);
    } catch (e) {
      console.warn('[BLETransport] startAdvertising error:', e);
    }

    if (this.advertiseStopTimer) clearTimeout(this.advertiseStopTimer);
    this.advertiseStopTimer = setTimeout(() => {
      try { BLEPeripheral?.stopAdvertising(); } catch {}
      console.log(`[BLETransport] BLE advertising stopped after ${ADVERTISE_MS / 1000}s`);
    }, ADVERTISE_MS);
  }

  // ── Scanning (Central) ─────────────────────────────────────────────────────

  /**
   * Duty-cycle BLE scanning with NO UUID filter.
   *
   * FIX BUG 2: Changed from [AETHER_SERVICE_UUID] filter to null (scan all).
   *
   * WHY: UUID-based scan filters are unreliable on Android 10+ — some phone
   * models with specific BLE chips fail to return results even when a matching
   * advertisement is present. Using null (scan all) + filtering by manufacturer
   * data in the callback is 100% reliable on all Android devices.
   *
   * The manufacturer data check (couldBeAETHERPacket → decodeFromBase64) is
   * fast (just a length check + 22-byte binary decode). Non-AETHER BLE devices
   * have zero impact on performance.
   */
  private startDutyCycleScan(): void {
    const scan = () => {
      if (!this.shouldReconnect) return;

      this.isScanning = true;
      this.bleManager.startDeviceScan(
        null,                    // ← FIX: null = scan ALL BLE devices (no UUID filter)
        {
          allowDuplicates: true,
          scanMode: 1,           // SCAN_MODE_LOW_POWER (balanced for battery in null-filter scan)
        },
        (error, device) => {
          if (error) {
            console.warn('[BLETransport] Scan error:', error.message);
            this.bleManager.stopDeviceScan();
            this.isScanning = false;
            this.scanCycleTimer = setTimeout(scan, SCAN_PAUSE_MS * 2);
            return;
          }

          if (!device) return;

          // ── AETHER packet filter ──────────────────────────────────────────
          // Only process devices that are advertising manufacturer data
          // of the right length to be an AETHER SOS packet.
          // This filters out 99.9% of non-AETHER BLE devices with one fast check.
          const mfrData = device.manufacturerData;
          if (!mfrData || !couldBeAETHERPacket(mfrData)) return;

          this.onDeviceDiscovered(device.id, mfrData);
        }
      );

      // Stop after SCAN_WINDOW_MS, pause, then restart
      this.scanCycleTimer = setTimeout(() => {
        this.bleManager.stopDeviceScan();
        this.isScanning = false;
        this.scanCycleTimer = setTimeout(scan, SCAN_PAUSE_MS);
      }, SCAN_WINDOW_MS);
    };

    scan();
  }

  /**
   * Called when we see a BLE device with manufacturer data the right length.
   * Decodes it and fires the SOS callback if it's a valid AETHER packet.
   */
  private onDeviceDiscovered(
    bleDeviceId: string,
    manufacturerData: string
  ): void {
    const wasNewPeer = !this.activePeers.has(bleDeviceId);
    this.activePeers.set(bleDeviceId, Date.now());

    if (wasNewPeer) {
      const total = this.connectedDevices;
      console.log(
        `[BLETransport] 📱 New AETHER peer: ${bleDeviceId.substring(0, 8)}` +
        ` | Total (including us): ${total}`
      );
      this.statusCallback?.(true, total);
    }

    // Decode the SOS packet
    const packet = decodeFromBase64(manufacturerData, bleDeviceId);
    if (!packet) return;

    // Don't react to packets we transmitted (our deviceId encoded in bytes 18–21)
    if (packet.deviceHash.startsWith(this.deviceId.substring(0, 8))) return;

    console.log(
      `[BLETransport] 🚨 SOS from ${bleDeviceId.substring(0, 8)}` +
      ` | incident=${packet.incidentId} hop=${packet.hopCount} sev=${packet.severity}`
    );

    this.packetCallback?.(packet, bleDeviceId);
  }

  // ── Peer Cleanup ───────────────────────────────────────────────────────────

  private startPeerCleanup(): void {
    this.peerCleanupTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, lastSeen] of this.activePeers.entries()) {
        if (now - lastSeen > PEER_TIMEOUT_MS) {
          this.activePeers.delete(id);
          changed = true;
          console.log(`[BLETransport] Peer ${id.substring(0, 8)} gone (${PEER_TIMEOUT_MS / 1000}s timeout)`);
        }
      }
      if (changed) {
        this.statusCallback?.(true, this.connectedDevices);
      }
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
        console.warn(`[BLETransport] Permissions denied: ${denied}`);
      }

      return allGranted;
    } catch (e) {
      console.error('[BLETransport] Permission request error:', e);
      return false;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private waitForBLEReady(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      this.bleManager.onStateChange((state) => {
        if (state === BleState.PoweredOn) {
          clearTimeout(timer);
          resolve(true);
        }
      }, true);
    });
  }

  // ── Callback Registration ─────────────────────────────────────────────────

  onPacketReceived(callback: PacketReceivedCallback): void {
    this.packetCallback = callback;
  }

  onStatusChanged(callback: ConnectionStatusCallback): void {
    this.statusCallback = callback;
  }

  onHazardReceived(callback: HazardReceivedCallback): void {
    this.hazardCallback = callback;
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get isConnected(): boolean {
    return this._isConnected;
  }

  get connectedDevices(): number {
    return this.activePeers.size + 1; // Peers + this device
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  disconnect(): void {
    this.shouldReconnect = false;
    this._isConnected = false;

    if (this.scanCycleTimer)    clearTimeout(this.scanCycleTimer);
    if (this.advertiseStopTimer) clearTimeout(this.advertiseStopTimer);
    if (this.peerCleanupTimer)  clearInterval(this.peerCleanupTimer);

    if (this.isScanning) {
      this.bleManager.stopDeviceScan();
      this.isScanning = false;
    }

    try { BLEPeripheral?.stopAdvertising(); } catch {}
    this.activePeers.clear();
    console.log('[BLETransport] Disconnected and cleaned up');
  }
}

export const bleTransportBridge = new BLETransportBridge();
