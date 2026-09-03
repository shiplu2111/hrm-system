import { useCallback, useEffect, useState } from 'react';
import type { AttendancePhase } from '@hrm/shared-types';
import { derivePhaseFromLocalEvents } from '../api/client';
import { countByStatus, getTodayEvents } from '../db/queue-repository';
import type { QueueItemStatus, SyncQueueItem } from '../db/types';

export function useAttendanceState(employeeId: string | null, refreshKey = 0) {
  const [phase, setPhase] = useState<AttendancePhase>('not_started');
  const [todayEvents, setTodayEvents] = useState<SyncQueueItem[]>([]);
  const [counts, setCounts] = useState<Record<QueueItemStatus, number>>({
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
  });

  const reload = useCallback(async () => {
    if (!employeeId) return;
    const events = await getTodayEvents(employeeId);
    setTodayEvents(events);
    setPhase(
      derivePhaseFromLocalEvents(
        events.map((e) => ({ eventType: e.eventType, status: e.status })),
      ),
    );
    setCounts(await countByStatus(employeeId));
  }, [employeeId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  return { phase, todayEvents, counts, reload };
}
