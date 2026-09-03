import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AttendancePhase } from '@hrm/shared-types';
import { useAttendanceState } from '../hooks/useAttendanceState';
import { useNetworkSync } from '../hooks/useNetworkSync';
import type { QueueItemStatus, SyncQueueItem } from '../db/types';
import { deriveSyncIndicatorState, type SyncIndicatorState } from '../sync/sync-status';

interface SyncStatusContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  phase: AttendancePhase;
  todayEvents: SyncQueueItem[];
  counts: Record<QueueItemStatus, number>;
  indicator: SyncIndicatorState;
  reload: () => void;
}

const SyncStatusContext = createContext<SyncStatusContextValue | null>(null);

export function SyncStatusProvider({
  employeeId,
  children,
}: {
  employeeId: string | null;
  children: ReactNode;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  const bump = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const { isOnline, isSyncing, syncNow } = useNetworkSync(bump);
  const { phase, todayEvents, counts, reload } = useAttendanceState(
    employeeId,
    refreshKey,
  );

  useEffect(() => {
    const interval = setInterval(() => {
      void reload();
    }, 5000);
    return () => clearInterval(interval);
  }, [reload]);

  const refresh = useCallback(() => {
    void reload();
    bump();
  }, [reload, bump]);

  const indicator = useMemo(
    () =>
      deriveSyncIndicatorState({
        isOnline,
        isSyncing,
        counts,
        todayEvents,
        phase,
      }),
    [isOnline, isSyncing, counts, todayEvents, phase],
  );

  const value = useMemo(
    () => ({
      isOnline,
      isSyncing,
      syncNow,
      phase,
      todayEvents,
      counts,
      indicator,
      reload: refresh,
    }),
    [isOnline, isSyncing, syncNow, phase, todayEvents, counts, indicator, refresh],
  );

  return (
    <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>
  );
}

export function useSyncStatus(): SyncStatusContextValue {
  const ctx = useContext(SyncStatusContext);
  if (!ctx) {
    throw new Error('useSyncStatus must be used within SyncStatusProvider');
  }
  return ctx;
}
