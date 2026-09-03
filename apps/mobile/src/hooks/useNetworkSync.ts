import { useCallback, useEffect, useState } from 'react';
import * as Network from 'expo-network';
import { processSyncQueue } from '../sync/sync-engine';

export function useNetworkSync(onSyncComplete?: () => void): {
  isOnline: boolean;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
} {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      await processSyncQueue();
      onSyncComplete?.();
    } finally {
      setIsSyncing(false);
    }
  }, [onSyncComplete]);

  useEffect(() => {
    let mounted = true;

    async function checkNetwork() {
      const state = await Network.getNetworkStateAsync();
      if (!mounted) return;
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      if (online) {
        await syncNow();
      }
    }

    void checkNetwork();
    const interval = setInterval(() => {
      void checkNetwork();
    }, 15_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [syncNow]);

  return { isOnline, isSyncing, syncNow };
}
