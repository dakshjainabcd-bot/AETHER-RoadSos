/**
 * NetworkMonitor — Thin wrapper around @react-native-community/netinfo
 *
 * Used by CloudEgress to detect when connectivity returns so queued
 * SOS packets can be uploaded. Logic is identical to the original
 * CloudEgress integration — this file simply re-exports a convenience
 * hook for any UI component that wants to display connectivity state.
 */

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
}

/**
 * Subscribe to real-time network status changes.
 * Returns the current status and a cleanup function.
 */
export function subscribeToNetworkStatus(
  onChange: (status: NetworkStatus) => void
): () => void {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    onChange({
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      type: state.type,
    });
  });
  return unsubscribe;
}

/**
 * One-shot fetch of current network status.
 */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  const state = await NetInfo.fetch();
  return {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable ?? false,
    type: state.type,
  };
}

/**
 * React hook — returns live network status.
 * Components can use this to show/hide the cloud-sync indicator.
 *
 * Usage:
 *   const { isConnected } = useNetworkStatus();
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: false,
    isInternetReachable: false,
    type: 'unknown',
  });

  useEffect(() => {
    // Fetch immediately on mount
    getNetworkStatus().then(setStatus);

    // Then subscribe for live updates
    const unsub = subscribeToNetworkStatus(setStatus);
    return unsub;
  }, []);

  return status;
}