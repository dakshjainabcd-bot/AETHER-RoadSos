/**
 * Phase 8: Circular Buffer Implementation
 * 
 * A circular buffer (ring buffer) is like a conveyor belt that loops back on itself.
 * - New data pushes out old data automatically
 * - Always maintains exactly the last 90 seconds
 * - Memory-efficient: no growing arrays
 * 
 * Example: If buffer holds 900 readings (90 seconds × 10 Hz):
 * [0, 1, 2, 3, ..., 899] ← newest reading goes to position 0
 * When reading 900 arrives, it overwrites position 0 (oldest)
 */

import { SensorReading, CircularBufferConfig, BLACK_BOX_CONFIG } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class CircularBuffer {
    private buffer: SensorReading[];           // The ring buffer array
    private head: number;                      // Index where next reading goes
    private size: number;                      // Current number of readings
    private readonly maxSize: number;          // Maximum capacity (900)
    private frozen: boolean;                   // Is buffer frozen after crash?

    constructor(config?: CircularBufferConfig) {
        this.maxSize = config?.maxSize || BLACK_BOX_CONFIG.MAX_BUFFER_SIZE;
        this.buffer = new Array(this.maxSize);   // Pre-allocate array
        this.head = 0;
        this.size = 0;
        this.frozen = false;

        console.log(`[CircularBuffer] Initialized with capacity: ${this.maxSize} readings (${BLACK_BOX_CONFIG.BUFFER_DURATION_SECONDS}s)`);
    }

    /**
     * Add a new sensor reading to the buffer
     * 
     * How it works:
     * 1. If frozen (crash happened), ignore new data
     * 2. Write reading to current head position
     * 3. Move head forward (wraps around at maxSize)
     * 4. Update size counter (caps at maxSize)
     * 
     * @param reading - Sensor data snapshot
     */
    public push(reading: SensorReading): void {
        if (this.frozen) {
            console.log('[CircularBuffer] Buffer frozen, ignoring new readings');
            return;
        }

        // Write to buffer at head position
        this.buffer[this.head] = reading;

        // Move head forward (wrap around if needed)
        this.head = (this.head + 1) % this.maxSize;

        // Increase size until we hit maxSize
        if (this.size < this.maxSize) {
            this.size++;
        }

        // Log every 100 readings (10 seconds) to avoid console spam
        if (this.size % 100 === 0) {
            console.log(`[CircularBuffer] Size: ${this.size}/${this.maxSize} readings (${(this.size / 10).toFixed(1)}s)`);
        }
    }

    /**
     * Get all readings in chronological order (oldest → newest)
     * 
     * Why we need this:
     * Buffer is circular, so readings aren't in order in the array.
     * This method reorganizes them chronologically.
     * 
     * Example:
     * If head=300 and buffer is full:
     * - Positions 300-899 = oldest readings
     * - Positions 0-299 = newest readings
     * Result: [...buffer.slice(300, 900), ...buffer.slice(0, 300)]
     * 
     * @returns Array of readings, oldest first
     */
    public getReadings(): SensorReading[] {
        if (this.size === 0) {
            return [];
        }

        // If buffer not full yet, just return filled portion
        if (this.size < this.maxSize) {
            return this.buffer.slice(0, this.size);
        }

        // Buffer is full, need to reorder
        // head points to oldest reading
        const oldestPart = this.buffer.slice(this.head, this.maxSize);
        const newestPart = this.buffer.slice(0, this.head);

        return [...oldestPart, ...newestPart];
    }

    /**
     * Get the most recent reading (last added)
     * Useful for real-time display
     */
    public getLatest(): SensorReading | undefined {
        if (this.size === 0) {
            return undefined;
        }

        // Latest reading is one position before head
        const latestIndex = (this.head - 1 + this.maxSize) % this.maxSize;
        return this.buffer[latestIndex];
    }

    /**
     * Freeze the buffer (called when crash detected)
     * 
     * What this does:
     * 1. Stop accepting new readings
     * 2. Save current buffer to persistent storage
     * 3. Mark buffer as frozen
     * 
     * This preserves the exact 90 seconds before the crash.
     */
    public async freeze(storageKey: string): Promise<void> {
        if (this.frozen) {
            console.log('[CircularBuffer] Already frozen');
            return;
        }

        this.frozen = true;
        const readings = this.getReadings();

        console.log(`[CircularBuffer] 🧊 FREEZING buffer: ${readings.length} readings`);

        try {
            // Save to AsyncStorage (persistent storage)
            await AsyncStorage.setItem(storageKey, JSON.stringify(readings));
            console.log(`[CircularBuffer] ✅ Frozen buffer saved to storage: ${storageKey}`);
        } catch (error) {
            console.error('[CircularBuffer] ❌ Failed to save frozen buffer:', error);
            throw error;
        }
    }

    /**
     * Load frozen buffer from storage
     * Used when reopening app after crash
     */
    public async loadFrozen(storageKey: string): Promise<SensorReading[]> {
        try {
            const data = await AsyncStorage.getItem(storageKey);
            if (!data) {
                console.log('[CircularBuffer] No frozen buffer found in storage');
                return [];
            }

            const readings: SensorReading[] = JSON.parse(data);
            console.log(`[CircularBuffer] Loaded frozen buffer: ${readings.length} readings`);
            return readings;
        } catch (error) {
            console.error('[CircularBuffer] Failed to load frozen buffer:', error);
            return [];
        }
    }

    /**
     * Unfreeze buffer and clear data
     * Used after evidence package is created
     */
    public async unfreeze(storageKey: string): Promise<void> {
        this.frozen = false;
        this.clear();

        try {
            await AsyncStorage.removeItem(storageKey);
            console.log('[CircularBuffer] 🔓 Buffer unfrozen and cleared');
        } catch (error) {
            console.error('[CircularBuffer] Failed to clear frozen buffer:', error);
        }
    }

    /**
     * Clear all data from buffer
     * Resets to initial state
     */
    public clear(): void {
        this.buffer = new Array(this.maxSize);
        this.head = 0;
        this.size = 0;
        console.log('[CircularBuffer] Buffer cleared');
    }

    /**
     * Get buffer statistics (for debugging)
     */
    public getStats() {
        return {
            size: this.size,
            maxSize: this.maxSize,
            head: this.head,
            frozen: this.frozen,
            durationSeconds: (this.size / 10).toFixed(1),  // Assuming 10 Hz sampling
            memoryUsageKB: ((this.size * 200) / 1024).toFixed(2),  // Rough estimate
        };
    }

    /**
     * Check if buffer is full (has 90 seconds of data)
     */
    public isFull(): boolean {
        return this.size >= this.maxSize;
    }

    /**
     * Check if buffer is frozen
     */
    public isFrozen(): boolean {
        return this.frozen;
    }

    /**
     * Get current buffer size
     */
    public getSize(): number {
        return this.size;
    }

    /**
     * Get time range covered by buffer
     * Returns { start, end } timestamps
     */
    public getTimeRange(): { start: number; end: number } | null {
        if (this.size === 0) {
            return null;
        }

        const readings = this.getReadings();
        return {
            start: readings[0].timestamp,
            end: readings[readings.length - 1].timestamp,
        };
    }

    /**
     * Get readings within a specific time range
     * Useful for filtering data around crash moment
     * 
     * @param startTime - Unix timestamp (ms)
     * @param endTime - Unix timestamp (ms)
     * @returns Filtered readings
     */
    public getReadingsInRange(startTime: number, endTime: number): SensorReading[] {
        const allReadings = this.getReadings();
        return allReadings.filter(
            (reading) => reading.timestamp >= startTime && reading.timestamp <= endTime
        );
    }
}