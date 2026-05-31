/**
 * withBLEPeripheral.js — Expo Config Plugin (FIXED v3)
 *
 * FIX: The previous version failed to register BLEPeripheralPackage because
 * it searched for patterns that don't exist in Expo SDK 54's generated
 * MainApplication.kt. The actual SDK 54 template uses:
 *
 *   PackageList(this).packages.toMutableList().apply {
 *     // Packages that cannot be autolinked yet can be added manually here, for example:
 *     // add(MyReactNativePackage())
 *   }
 *
 * This version searches for the comment anchor `// add(MyReactNativePackage())`
 * which is present in every Expo SDK version's generated MainApplication.kt,
 * making the plugin resilient to SDK version changes.
 */

const { withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// ─── Kotlin source files ─────────────────────────────────────────────────────

const BLE_PERIPHERAL_MODULE_KT = `package com.aether.roadsos.bleperipheral

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.content.Context
import android.os.ParcelUuid
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
            val bluetoothManager =
                reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
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

            // Stop any previous advertisement first
            advertiseCallback?.let {
                try { bleAdvertiser.stopAdvertising(it) } catch (_: Exception) {}
                advertiseCallback = null
            }

            val manufacturerBytes = ByteArray(manufacturerDataArray.size()) { i ->
                (manufacturerDataArray.getInt(i) and 0xFF).toByte()
            }

            val settings = AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(false)
                .setTimeout(0)
                .build()

            val data = AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .setIncludeTxPowerLevel(false)
                .addServiceUuid(ParcelUuid(UUID.fromString(serviceUUID)))
                .addManufacturerData(AETHER_MANUFACTURER_ID, manufacturerBytes)
                .build()

            val callback = object : AdvertiseCallback() {
                override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
                    Log.i(TAG, "✅ BLE advertising started — \${manufacturerBytes.size} bytes, UUID=\$serviceUUID")
                }
                override fun onStartFailure(errorCode: Int) {
                    val reason = when (errorCode) {
                        ADVERTISE_FAILED_ALREADY_STARTED      -> "ALREADY_STARTED"
                        ADVERTISE_FAILED_DATA_TOO_LARGE       -> "DATA_TOO_LARGE (\${manufacturerBytes.size} bytes)"
                        ADVERTISE_FAILED_FEATURE_UNSUPPORTED  -> "FEATURE_UNSUPPORTED"
                        ADVERTISE_FAILED_INTERNAL_ERROR       -> "INTERNAL_ERROR"
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
            val bluetoothManager =
                reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = bluetoothManager?.adapter
            adapter?.bluetoothLeAdvertiser?.let { adv ->
                advertiseCallback?.let {
                    adv.stopAdvertising(it)
                    Log.d(TAG, "BLE advertising stopped")
                }
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

// ─── Step 1: Write Kotlin files ───────────────────────────────────────────────

function withBLEKotlinFiles(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const root = config.modRequest.platformProjectRoot;
      const dir = path.join(
        root, 'app', 'src', 'main', 'java',
        'com', 'aether', 'roadsos', 'bleperipheral'
      );

      fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(path.join(dir, 'BLEPeripheralModule.kt'), BLE_PERIPHERAL_MODULE_KT, 'utf8');
      fs.writeFileSync(path.join(dir, 'BLEPeripheralPackage.kt'), BLE_PERIPHERAL_PACKAGE_KT, 'utf8');

      console.log('[withBLEPeripheral] ✅ BLEPeripheralModule.kt written');
      console.log('[withBLEPeripheral] ✅ BLEPeripheralPackage.kt written');

      return config;
    },
  ]);
}

// ─── Step 2: Register in MainApplication.kt ──────────────────────────────────

function withBLEMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    const LINE_TO_ADD =
      'add(com.aether.roadsos.bleperipheral.BLEPeripheralPackage())';

    // Skip if already registered (makes the plugin idempotent)
    if (contents.includes(LINE_TO_ADD)) {
      console.log('[withBLEPeripheral] ℹ️  Already registered — skipping');
      return config;
    }

    // ── ANCHOR: the comment Expo puts in every generated MainApplication.kt ──
    // Present in SDK 50, 51, 52, 53, 54 (and likely beyond)
    const ANCHOR = '// add(MyReactNativePackage())';

    if (contents.includes(ANCHOR)) {
      contents = contents.replace(
        ANCHOR,
        `${ANCHOR}\n              ${LINE_TO_ADD}`
      );
      config.modResults.contents = contents;
      console.log('[withBLEPeripheral] ✅ Registered BLEPeripheralPackage (anchor pattern)');
      return config;
    }

    // ── FALLBACK 1: val packages = PackageList(this).packages (SDK 49 and below) ──
    const FALLBACK1 = 'val packages = PackageList(this).packages';
    if (contents.includes(FALLBACK1)) {
      contents = contents.replace(
        FALLBACK1,
        `${FALLBACK1}\n        packages.add(com.aether.roadsos.bleperipheral.BLEPeripheralPackage())`
      );
      config.modResults.contents = contents;
      console.log('[withBLEPeripheral] ✅ Registered BLEPeripheralPackage (fallback 1)');
      return config;
    }

    // ── FALLBACK 2: return PackageList(this).packages ─────────────────────────
    const FALLBACK2 = 'return PackageList(this).packages';
    if (contents.includes(FALLBACK2)) {
      contents = contents.replace(
        FALLBACK2,
        [
          'val packages = PackageList(this).packages',
          '        packages.add(com.aether.roadsos.bleperipheral.BLEPeripheralPackage())',
          '        return packages',
        ].join('\n')
      );
      config.modResults.contents = contents;
      console.log('[withBLEPeripheral] ✅ Registered BLEPeripheralPackage (fallback 2)');
      return config;
    }

    // ── Nothing worked ────────────────────────────────────────────────────────
    console.error(
      '[withBLEPeripheral] ❌ CRITICAL: Could not register BLEPeripheralPackage.',
      'None of the expected patterns were found in MainApplication.kt.',
      'BLE advertising WILL NOT WORK. Check the plugin or register manually.'
    );

    return config;
  });
}

// ─── Export ──────────────────────────────────────────────────────────────────

module.exports = function withBLEPeripheral(config) {
  config = withBLEKotlinFiles(config);
  config = withBLEMainApplication(config);
  return config;
};
