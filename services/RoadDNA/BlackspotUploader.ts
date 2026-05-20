/**
 * Phase 9 — BlackspotUploader
 *
 * WHAT THIS DOES:
 * When the device is on WiFi, it batches all pending driving events
 * and POSTs them to the cloud endpoint (httpbin.org for demo,
 * your FastAPI server in production).
 *
 * WHY WIFI ONLY?
 * Driving events are low-priority data. We never want to waste the
 * user's cellular data on anonymous road statistics. WiFi upload
 * means zero cost to the user and no privacy concerns about
 * background data usage.
 *
 * UPLOAD FLOW:
 * 1. NetInfo detects WiFi connection
 * 2. Load all events where uploaded = 0
 * 3. POST batch to cloud
 * 4. On success: mark events as uploaded = 1
 * 5. Log last upload time to AsyncStorage
 */

import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getPendingEvents,
    markEventsUploaded,
} from './DrivingEventLogger';
import { ROAD_DNA_CONFIG, ROAD_DNA_STORAGE_KEYS } from './types';

class BlackspotUploader {
    private unsubscribeNetInfo: (() => void) | null = null;
    private isUploading = false;

    /**
     * Start monitoring WiFi connectivity.
     * When WiFi connects, automatically trigger a batch upload.
     * Call once at app startup from _layout.tsx.
     */
    startMonitoring(): void {
        this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
            // Only upload on WiFi (type === 'wifi') — never on cellular
            if (state.type === 'wifi' && state.isConnected && state.isInternetReachable) {
                this.uploadPendingEvents();
            }
        });
        console.log('[RoadDNA] Upload monitor started — will batch upload on WiFi');
    }

    /**
     * Stop monitoring. Call when app goes to background or shuts down.
     */
    stopMonitoring(): void {
        this.unsubscribeNetInfo?.();
        this.unsubscribeNetInfo = null;
    }

    /**
     * Manually trigger upload (called from Settings debug panel).
     */
    async triggerManualUpload(): Promise<{ uploaded: number; failed: boolean }> {
        return this.uploadPendingEvents();
    }

    /**
     * Core upload logic.
     * Returns how many events were successfully uploaded.
     */
    private async uploadPendingEvents(): Promise<{ uploaded: number; failed: boolean }> {
        if (this.isUploading) {
            console.log('[RoadDNA] Upload already in progress — skipping');
            return { uploaded: 0, failed: false };
        }

        this.isUploading = true;

        try {
            const pending = await getPendingEvents();

            if (pending.length === 0) {
                console.log('[RoadDNA] No pending events to upload');
                return { uploaded: 0, failed: false };
            }

            console.log(`[RoadDNA] Uploading ${pending.length} driving events...`);

            // Build the upload payload
            // The server receives a clean, anonymised batch
            const payload = {
                events: pending.map((e) => ({
                    event_type: e.event_type,
                    lat: e.lat,
                    lng: e.lng,
                    timestamp: e.timestamp,
                    speed_kmh: Math.round(e.speed_kmh),
                    magnitude: e.magnitude,
                    // NO user ID, NO device ID — fully anonymous
                })),
                client_version: '1.0.0-phase9',
                event_count: pending.length,
            };

            const response = await fetch(ROAD_DNA_CONFIG.UPLOAD_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-AETHER-DataType': 'driving_events',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            // Mark all uploaded events as done
            const ids = pending.map((e) => e.id!).filter(Boolean);
            await markEventsUploaded(ids);
            await AsyncStorage.setItem(
                ROAD_DNA_STORAGE_KEYS.LAST_UPLOAD_TIME,
                Date.now().toString()
            );

            console.log(`[RoadDNA] ✅ Uploaded ${pending.length} events successfully`);
            return { uploaded: pending.length, failed: false };
        } catch (error) {
            console.warn('[RoadDNA] Upload failed:', error);
            return { uploaded: 0, failed: true };
        } finally {
            this.isUploading = false;
        }
    }

    /**
     * Get the last upload timestamp (for Settings debug panel).
     */
    async getLastUploadTime(): Promise<number | null> {
        const raw = await AsyncStorage.getItem(ROAD_DNA_STORAGE_KEYS.LAST_UPLOAD_TIME);
        return raw ? parseInt(raw, 10) : null;
    }
}

// Singleton
export const blackspotUploader = new BlackspotUploader();