/**
 * withBLEPeripheral.js — Expo Config Plugin
 *
 * WHY THIS FILE EXISTS:
 * When you run `eas build`, Expo's servers run `expo prebuild` FRESH and
 * regenerate the entire android/ folder from scratch. Any Kotlin files you
 * manually added to android/ on your local machine are WIPED.
 *
 * This config plugin tells expo prebuild to automatically:
 *   1. Write BLEPeripheralModule.kt into the android source tree
 *   2. Write BLEPeripheralPackage.kt into the android source tree
 *   3. Register the package in MainApplication.kt
 *
 * It runs on EVERY prebuild — local and EAS cloud — so your native module
 * is always included.
 *
 * USAGE: Referenced in app.json plugins array (already done if you followed the guide).
 */

const { withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// ─── Kotlin source files ────────────────────────────────────────────────────
// These are embedded directly so EAS cloud servers don't need any extra files.

const BLE_PERIPHERAL_MODULE_KT = `
package com.aether.roadsos.bleperipheral

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
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

    private var advertiser: BluetoothLeAdvertiser? = null
    private var advertiseCallback: AdvertiseCallback? = null

    override fun getName(): String = "BLEPeripheral"

    @ReactMethod
    fun startAdvertising(serviceUUID: String, manufacturerDataArray: ReadableArray) {
        try {
            val bluetoothManager =
                reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val bluetoothAdapter: BluetoothAdapter? = bluetoothManager?.adapter

            if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) {
                Log.w(TAG, "Bluetooth not available or not enabled")
                return
            }

            val bleAdvertiser = bluetoothAdapter.bluetoothLeAdvertiser
            if (bleAdvertiser == null) {
                Log.w(TAG, "BLE advertising not supported on this device")
                return
            }

            stopAdvertisingInternal(bleAdvertiser)

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
                    Log.i(TAG, "BLE advertising started OK — \${manufacturerBytes.size} byte payload")
                }
                override fun onStartFailure(errorCode: Int) {
                    val reason = when (errorCode) {
                        ADVERTISE_FAILED_ALREADY_STARTED      -> "ALREADY_STARTED"
                        ADVERTISE_FAILED_DATA_TOO_LARGE       -> "DATA_TOO_LARGE"
                        ADVERTISE_FAILED_FEATURE_UNSUPPORTED  -> "FEATURE_UNSUPPORTED"
                        ADVERTISE_FAILED_INTERNAL_ERROR       -> "INTERNAL_ERROR"
                        ADVERTISE_FAILED_TOO_MANY_ADVERTISERS -> "TOO_MANY_ADVERTISERS"
                        else -> "UNKNOWN(\$errorCode)"
                    }
                    Log.e(TAG, "BLE advertising FAILED: \$reason")
                }
            }

            bleAdvertiser.startAdvertising(settings, data, callback)
            advertiser = bleAdvertiser
            advertiseCallback = callback
            Log.i(TAG, "startAdvertising called for UUID: \$serviceUUID")

        } catch (e: SecurityException) {
            Log.e(TAG, "Missing BLE permission: \${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "startAdvertising error: \${e.message}")
        }
    }

    @ReactMethod
    fun stopAdvertising() {
        try {
            advertiser?.let { stopAdvertisingInternal(it) }
        } catch (e: Exception) {
            Log.w(TAG, "stopAdvertising error: \${e.message}")
        }
    }

    private fun stopAdvertisingInternal(adv: BluetoothLeAdvertiser) {
        try {
            advertiseCallback?.let {
                adv.stopAdvertising(it)
                Log.d(TAG, "BLE advertising stopped")
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "Stop advertising permission error: \${e.message}")
        } catch (e: Exception) {
            Log.w(TAG, "Stop advertising error: \${e.message}")
        } finally {
            advertiseCallback = null
        }
    }

    override fun invalidate() {
        super.invalidate()
        try {
            advertiser?.let { stopAdvertisingInternal(it) }
            advertiser = null
        } catch (_: Exception) {}
    }
}
`.trim();

const BLE_PERIPHERAL_PACKAGE_KT = `
package com.aether.roadsos.bleperipheral

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BLEPeripheralPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(BLEPeripheralModule(ctx))

    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`.trim();

// ─── Config Plugin ──────────────────────────────────────────────────────────

/**
 * Step 1: Write the Kotlin files into the android source tree during prebuild.
 * Uses withDangerousMod for direct filesystem access.
 */
function withBLEKotlinFiles(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;
      // Path: android/app/src/main/java/com/aether/roadsos/bleperipheral/
      const dir = path.join(
        platformRoot,
        'app', 'src', 'main', 'java',
        'com', 'aether', 'roadsos', 'bleperipheral'
      );

      fs.mkdirSync(dir, { recursive: true });

      const modulePath  = path.join(dir, 'BLEPeripheralModule.kt');
      const packagePath = path.join(dir, 'BLEPeripheralPackage.kt');

      fs.writeFileSync(modulePath, BLE_PERIPHERAL_MODULE_KT, 'utf8');
      fs.writeFileSync(packagePath, BLE_PERIPHERAL_PACKAGE_KT, 'utf8');

      console.log('[withBLEPeripheral] ✅ BLEPeripheralModule.kt written to', modulePath);
      console.log('[withBLEPeripheral] ✅ BLEPeripheralPackage.kt written to', packagePath);

      return config;
    },
  ]);
}

/**
 * Step 2: Register BLEPeripheralPackage in MainApplication.kt.
 * Uses withMainApplication which provides the file contents as a string.
 */
function withBLEMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    // Skip if already registered (idempotent)
    if (contents.includes('BLEPeripheralPackage')) {
      console.log('[withBLEPeripheral] ℹ️  BLEPeripheralPackage already registered — skipping');
      return config;
    }

    // Pattern 1: Standard expo-generated MainApplication.kt (SDK 50+)
    //   val packages = PackageList(this).packages
    const pattern1 = 'val packages = PackageList(this).packages';
    if (contents.includes(pattern1)) {
      contents = contents.replace(
        pattern1,
        `${pattern1}\n        packages.add(com.aether.roadsos.bleperipheral.BLEPeripheralPackage())`
      );
      config.modResults.contents = contents;
      console.log('[withBLEPeripheral] ✅ Registered BLEPeripheralPackage in MainApplication.kt (pattern 1)');
      return config;
    }

    // Pattern 2: Older template — return PackageList(this).packages directly
    const pattern2 = 'return PackageList(this).packages';
    if (contents.includes(pattern2)) {
      contents = contents.replace(
        pattern2,
        [
          'val packages = PackageList(this).packages',
          '        packages.add(com.aether.roadsos.bleperipheral.BLEPeripheralPackage())',
          '        return packages',
        ].join('\n')
      );
      config.modResults.contents = contents;
      console.log('[withBLEPeripheral] ✅ Registered BLEPeripheralPackage in MainApplication.kt (pattern 2)');
      return config;
    }

    // Neither pattern found — log a warning but don't crash the build
    console.warn(
      '[withBLEPeripheral] ⚠️  Could not find getPackages() pattern in MainApplication.kt.',
      'BLEPeripheralPackage was NOT registered. BLE advertising will not work.',
      'Please add manually: packages.add(com.aether.roadsos.bleperipheral.BLEPeripheralPackage())'
    );

    return config;
  });
}

// ─── Export ─────────────────────────────────────────────────────────────────

module.exports = function withBLEPeripheral(config) {
  config = withBLEKotlinFiles(config);
  config = withBLEMainApplication(config);
  return config;
};
