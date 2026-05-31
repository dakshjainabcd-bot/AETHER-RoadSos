/**
 * withBLEPeripheral.js — Expo Config Plugin (FIXED v4 — BLE Data Size Fix)
 *
 * ROOT CAUSE FIX:
 * Previous version added BOTH addServiceUuid (18 bytes) AND addManufacturerData (26 bytes).
 * With BLE Flags (3 bytes), total = 47 bytes — EXCEEDS the 31-byte BLE legacy advertising limit.
 * Android fires ADVERTISE_FAILED_DATA_TOO_LARGE silently → nothing broadcasts → MESH stays at 1.
 *
 * FIX: Remove addServiceUuid from the advertisement payload.
 * - Flags: 3 bytes (auto-added by Android)
 * - ManufacturerData: 26 bytes (1+1 overhead + 2 mfr ID + 22 payload)
 * - Total: 29 bytes ✓ fits within 31-byte limit
 *
 * SCAN SIDE: BLETransportBridge.ts uses null filter + AETHER decode to identify peers.
 */
const { withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const BLE_PERIPHERAL_MODULE_KT = `package com.aether.roadsos.bleperipheral

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.content.Context
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.util.UUID

class BLEPeripheralModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "BLEPeripheral"
        private const val AETHER_MANUFACTURER_ID = 0xAE70
    }

    private var advertiseCallback: AdvertiseCallback? = null

    override fun getName(): String = "BLEPeripheral"

    @ReactMethod
    fun startAdvertising(serviceUUID: String, manufacturerDataArray: ReadableArray) {
        try {
            val bluetoothManager = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter: BluetoothAdapter? = bluetoothManager?.adapter
            if (adapter == null || !adapter.isEnabled) {
                Log.w(TAG, "Bluetooth not available or disabled")
                return
            }
            val bleAdvertiser = adapter.bluetoothLeAdvertiser
            if (bleAdvertiser == null) {
                Log.w(TAG, "BLE advertising not supported on this device")
                return
            }
            advertiseCallback?.let {
                try { bleAdvertiser.stopAdvertising(it) } catch (_: Exception) {}
                advertiseCallback = null
            }
            val manufacturerBytes = ByteArray(manufacturerDataArray.size()) { i ->
                (manufacturerDataArray.getInt(i) and 0xFF).toByte()
            }
            // ── CRITICAL SIZE FIX ──────────────────────────────────────────────────
            // Legacy BLE advertising max payload = 31 bytes.
            // Flags AD: 3 bytes (auto-added by Android)
            // ManufacturerData AD: 26 bytes (1+1 overhead + 2 mfr ID + 22 payload)
            // Total: 29 bytes ✓ (WITHIN limit)
            //
            // Do NOT add addServiceUuid — it adds 18 more bytes → 47 bytes total
            // → ADVERTISE_FAILED_DATA_TOO_LARGE → silent failure → MESH stays at 1.
            // ──────────────────────────────────────────────────────────────────────
            val settings = AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(false)
                .setTimeout(0)
                .build()
            val data = AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .setIncludeTxPowerLevel(false)
                // NO addServiceUuid — removed to keep payload within 31-byte limit
                .addManufacturerData(AETHER_MANUFACTURER_ID, manufacturerBytes)
                .build()
            val callback = object : AdvertiseCallback() {
                override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
                    Log.i(TAG, "✅ BLE advertising started — \${manufacturerBytes.size} bytes [29B total, within 31B limit]")
                }
                override fun onStartFailure(errorCode: Int) {
                    val reason = when (errorCode) {
                        ADVERTISE_FAILED_ALREADY_STARTED -> "ALREADY_STARTED"
                        ADVERTISE_FAILED_DATA_TOO_LARGE -> "DATA_TOO_LARGE (\${manufacturerBytes.size} bytes)"
                        ADVERTISE_FAILED_FEATURE_UNSUPPORTED -> "FEATURE_UNSUPPORTED"
                        ADVERTISE_FAILED_INTERNAL_ERROR -> "INTERNAL_ERROR"
                        ADVERTISE_FAILED_TOO_MANY_ADVERTISERS -> "TOO_MANY_ADVERTISERS"
                        else -> "UNKNOWN(\$errorCode)"
                    }
                    Log.e(TAG, "❌ BLE advertising FAILED: \$reason")
                }
            }
            bleAdvertiser.startAdvertising(settings, data, callback)
            advertiseCallback = callback
        } catch (e: SecurityException) {
            Log.e(TAG, "Missing BLE permission: \${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "startAdvertising error: \${e.message}")
        }
    }

    @ReactMethod
    fun stopAdvertising() {
        try {
            val bluetoothManager = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = bluetoothManager?.adapter
            adapter?.bluetoothLeAdvertiser?.let { adv ->
                advertiseCallback?.let { adv.stopAdvertising(it); Log.d(TAG, "BLE advertising stopped") }
            }
        } catch (e: Exception) {
            Log.w(TAG, "stopAdvertising: \${e.message}")
        } finally {
            advertiseCallback = null
        }
    }

    override fun invalidate() {
        super.invalidate()
        try { stopAdvertising() } catch (_: Exception) {}
    }
}`;

const BLE_PERIPHERAL_PACKAGE_KT = `package com.aether.roadsos.bleperipheral

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BLEPeripheralPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(BLEPeripheralModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}`;

function withBLEKotlinFiles(config) {
  return withDangerousMod(config, ['android', (config) => {
    const root = config.modRequest.platformProjectRoot;
    const dir = path.join(root, 'app', 'src', 'main', 'java', 'com', 'aether', 'roadsos', 'bleperipheral');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'BLEPeripheralModule.kt'), BLE_PERIPHERAL_MODULE_KT, 'utf8');
    fs.writeFileSync(path.join(dir, 'BLEPeripheralPackage.kt'), BLE_PERIPHERAL_PACKAGE_KT, 'utf8');
    console.log('[withBLEPeripheral] ✅ BLEPeripheralModule.kt written');
    console.log('[withBLEPeripheral] ✅ BLEPeripheralPackage.kt written');
    return config;
  }]);
}

function withBLEMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    const LINE_TO_ADD = 'add(com.aether.roadsos.bleperipheral.BLEPeripheralPackage())';
    if (contents.includes(LINE_TO_ADD)) {
      console.log('[withBLEPeripheral] ℹ️ Already registered — skipping');
      return config;
    }
    const ANCHOR = '// add(MyReactNativePackage())';
    if (contents.includes(ANCHOR)) {
      contents = contents.replace(ANCHOR, `${ANCHOR}\n              ${LINE_TO_ADD}`);
      config.modResults.contents = contents;
      console.log('[withBLEPeripheral] ✅ Registered BLEPeripheralPackage (anchor pattern)');
      return config;
    }
    const FALLBACK1 = 'val packages = PackageList(this).packages';
    if (contents.includes(FALLBACK1)) {
      contents = contents.replace(FALLBACK1, `${FALLBACK1}\n              packages.add(com.aether.roadsos.bleperipheral.BLEPeripheralPackage())`);
      config.modResults.contents = contents;
      console.log('[withBLEPeripheral] ✅ Registered BLEPeripheralPackage (fallback 1)');
      return config;
    }
    console.error('[withBLEPeripheral] ❌ CRITICAL: Could not register BLEPeripheralPackage.');
    return config;
  });
}

module.exports = function withBLEPeripheral(config) {
  config = withBLEKotlinFiles(config);
  config = withBLEMainApplication(config);
  return config;
};
