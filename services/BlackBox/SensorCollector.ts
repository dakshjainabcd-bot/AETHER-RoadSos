/**
 * Phase 7: Sensor Data Collector
 * 
 * This module collects data from phone sensors:
 * 1. Accelerometer - detects phone movement (shakes, sudden stops)
 * 2. Gyroscope - detects phone rotation (tilting, spinning)
 * 3. GPS - tracks location and speed
 * 4. Audio Envelope - measures sound level (NOT recording audio for privacy)
 * 
 * Why every 100ms? (10 times per second)
 * - Fast enough to catch sudden movements (crashes)
 * - Slow enough to not drain battery
 * - Standard rate for automotive black boxes
 */

import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { SensorReading, BLACK_BOX_CONFIG } from './types';

export class SensorCollector {
    private accelerometerSubscription: any;
    private gyroscopeSubscription: any;
    private locationWatcher: Location.LocationSubscription | null = null;
    private audioRecording: Audio.Recording | null = null;

    private isCollecting: boolean = false;
    private onDataCallback: ((reading: SensorReading) => void) | null = null;

    // Latest sensor values (updated by subscriptions)
    private latestAccelerometer = { x: 0, y: 0, z: 0 };
    private latestGyroscope = { x: 0, y: 0, z: 0 };
    private latestGPS = {
        latitude: 0,
        longitude: 0,
        speed: null as number | null,
        accuracy: null as number | null
    };
    private latestAudioLevel = 0;

    /**
     * Initialize and request permissions
     * Must be called before starting collection
     */
    public async initialize(): Promise<boolean> {
        console.log('[SensorCollector] Initializing...');

        try {
            // Request location permission
            const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
            if (locationStatus !== 'granted') {
                console.error('[SensorCollector] ❌ Location permission denied');
                return false;
            }

            // Request audio permission (for amplitude measurement)
            const { status: audioStatus } = await Audio.requestPermissionsAsync();
            if (audioStatus !== 'granted') {
                console.error('[SensorCollector] ❌ Audio permission denied');
                return false;
            }

            // Check if sensors are available
            const accelAvailable = await Accelerometer.isAvailableAsync();
            const gyroAvailable = await Gyroscope.isAvailableAsync();

            if (!accelAvailable) {
                console.warn('[SensorCollector] ⚠️ Accelerometer not available');
            }
            if (!gyroAvailable) {
                console.warn('[SensorCollector] ⚠️ Gyroscope not available');
            }

            console.log('[SensorCollector] ✅ Initialized successfully');
            return true;
        } catch (error) {
            console.error('[SensorCollector] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Start collecting sensor data
     * 
     * @param onData - Callback function called every 100ms with new reading
     * 
     * Example usage:
     * collector.startCollecting((reading) => {
     *   console.log('New reading:', reading);
     *   buffer.push(reading);  // Add to circular buffer
     * });
     */
    public async startCollecting(onData: (reading: SensorReading) => void): Promise<void> {
        if (this.isCollecting) {
            console.log('[SensorCollector] Already collecting');
            return;
        }

        this.onDataCallback = onData;
        this.isCollecting = true;

        console.log('[SensorCollector] 🎬 Starting sensor collection (10 Hz)');

        // Start accelerometer
        Accelerometer.setUpdateInterval(BLACK_BOX_CONFIG.SAMPLING_RATE_MS);
        this.accelerometerSubscription = Accelerometer.addListener((data) => {
            this.latestAccelerometer = {
                x: data.x,
                y: data.y,
                z: data.z,
            };
        });

        // Start gyroscope
        Gyroscope.setUpdateInterval(BLACK_BOX_CONFIG.SAMPLING_RATE_MS);
        this.gyroscopeSubscription = Gyroscope.addListener((data) => {
            this.latestGyroscope = {
                x: data.x,
                y: data.y,
                z: data.z,
            };
        });

        // Start GPS tracking
        this.locationWatcher = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: BLACK_BOX_CONFIG.SAMPLING_RATE_MS,
                distanceInterval: 0,  // Get updates even if not moving
            },
            (location) => {
                this.latestGPS = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    speed: location.coords.speed,
                    accuracy: location.coords.accuracy,
                };
            }
        );

        // Start audio level monitoring (MVP: simulated)
        // In production, use expo-av to measure audio amplitude
        this.startAudioMonitoring();

        // Start the main sampling loop
        this.startSamplingLoop();
    }

    /**
     * Main sampling loop - collects all sensor data every 100ms
     * This is the "heartbeat" of the black box
     */
    private startSamplingLoop(): void {
        const intervalId = setInterval(() => {
            if (!this.isCollecting) {
                clearInterval(intervalId);
                return;
            }

            // Create a snapshot of all sensors at this moment
            const reading: SensorReading = {
                timestamp: Date.now(),
                accelerometer: { ...this.latestAccelerometer },
                gyroscope: { ...this.latestGyroscope },
                gps: { ...this.latestGPS },
                audioEnvelope: this.latestAudioLevel,
            };

            // Send to callback (which adds it to circular buffer)
            if (this.onDataCallback) {
                this.onDataCallback(reading);
            }
        }, BLACK_BOX_CONFIG.SAMPLING_RATE_MS);

        console.log('[SensorCollector] Sampling loop started');
    }

    /**
     * Start monitoring audio amplitude
     * 
     * NOTE: For MVP, we simulate audio levels.
     * Production implementation would use:
     * - expo-av Audio.Recording
     * - metering enabled
     * - read amplitude levels every 100ms
     * 
     * Privacy: We ONLY store amplitude (0-100), NOT raw audio.
     * This tells us if there was a loud noise (crash) without recording conversations.
     */
    private async startAudioMonitoring(): Promise<void> {
        console.log('[SensorCollector] Audio monitoring: SIMULATED for MVP');

        // MVP: Simulate random audio levels
        // Production: Use actual Audio.Recording with metering
        setInterval(() => {
            if (!this.isCollecting) return;

            // Simulate ambient noise level (20-40) with occasional spikes
            const baseLevel = 30;
            const randomVariation = Math.random() * 10 - 5;  // ±5
            this.latestAudioLevel = Math.max(0, Math.min(100, baseLevel + randomVariation));
        }, BLACK_BOX_CONFIG.SAMPLING_RATE_MS);

        /* PRODUCTION CODE (commented out for MVP):
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
    
          const { recording } = await Audio.Recording.createAsync(
            Audio.RecordingOptionsPresets.HIGH_QUALITY,
            (status) => {
              if (status.isRecording && status.metering !== undefined) {
                // Convert metering to 0-100 scale
                // Metering is in dB, typically -160 to 0
                const normalized = (status.metering + 160) / 160 * 100;
                this.latestAudioLevel = Math.max(0, Math.min(100, normalized));
              }
            },
            100  // Update interval in ms
          );
    
          this.audioRecording = recording;
          console.log('[SensorCollector] Audio monitoring started');
        } catch (error) {
          console.error('[SensorCollector] Audio monitoring failed:', error);
          // Continue without audio - other sensors still work
        }
        */
    }

    /**
     * Stop collecting sensor data
     * Called when app closes or user stops recording
     */
    public stopCollecting(): void {
        if (!this.isCollecting) {
            return;
        }

        console.log('[SensorCollector] 🛑 Stopping sensor collection');

        this.isCollecting = false;

        // Stop accelerometer
        if (this.accelerometerSubscription) {
            this.accelerometerSubscription.remove();
            this.accelerometerSubscription = null;
        }

        // Stop gyroscope
        if (this.gyroscopeSubscription) {
            this.gyroscopeSubscription.remove();
            this.gyroscopeSubscription = null;
        }

        // Stop GPS
        if (this.locationWatcher) {
            this.locationWatcher.remove();
            this.locationWatcher = null;
        }

        // Stop audio monitoring
        if (this.audioRecording) {
            this.audioRecording.stopAndUnloadAsync();
            this.audioRecording = null;
        }

        this.onDataCallback = null;

        console.log('[SensorCollector] All sensors stopped');
    }

    /**
     * Get current sensor status (for debugging UI)
     */
    public getStatus() {
        return {
            isCollecting: this.isCollecting,
            latestReading: {
                accelerometer: this.latestAccelerometer,
                gyroscope: this.latestGyroscope,
                gps: this.latestGPS,
                audioLevel: this.latestAudioLevel,
            },
        };
    }

    /**
     * Test if sensors are responding
     * Useful for debugging
     */
    public async testSensors(): Promise<{ [key: string]: boolean }> {
        const results = {
            accelerometer: false,
            gyroscope: false,
            gps: false,
            audio: false,
        };

        try {
            results.accelerometer = await Accelerometer.isAvailableAsync();
            results.gyroscope = await Gyroscope.isAvailableAsync();

            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
            results.gps = location !== null;

            const audioPermission = await Audio.getPermissionsAsync();
            results.audio = audioPermission.granted;

            console.log('[SensorCollector] Sensor test results:', results);
        } catch (error) {
            console.error('[SensorCollector] Sensor test failed:', error);
        }

        return results;
    }
}