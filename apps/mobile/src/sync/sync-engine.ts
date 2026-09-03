import type { AttendanceSyncItemResult } from '@hrm/shared-types';
import {
  listQueueItems,
  updateQueueItemStatus,
} from '../db/queue-repository';
import type { SyncQueueItem } from '../db/types';
import { syncAttendanceBatch } from '../api/client';
import { getDeviceId } from '../lib/device-id';

const MAX_BATCH = 50;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

let syncing = false;

function backoffMs(retryCount: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** retryCount, MAX_BACKOFF_MS);
}

function shouldRetry(item: SyncQueueItem): boolean {
  if (item.status !== 'failed') return false;
  const elapsed = Date.now() - new Date(item.updatedAt).getTime();
  return elapsed >= backoffMs(item.retryCount);
}

function toPayloadItem(item: SyncQueueItem) {
  const event: {
    local_id: string;
    employee_id: string;
    type: string;
    timestamp_device: string;
    gps?: { lat: number; lng: number };
    geofence_ok?: boolean;
    offline_duration_seconds?: number;
  } = {
    local_id: item.localId,
    employee_id: item.employeeId,
    type: item.eventType,
    timestamp_device: item.timestampDevice,
  };

  if (item.gpsLat != null && item.gpsLng != null) {
    event.gps = { lat: item.gpsLat, lng: item.gpsLng };
  }
  if (item.geofenceOk != null) {
    event.geofence_ok = item.geofenceOk;
  }
  const queueAgeSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 1000),
  );
  event.offline_duration_seconds =
    item.offlineDurationSeconds ?? queueAgeSeconds;

  return event;
}

async function applyResults(
  items: SyncQueueItem[],
  results: AttendanceSyncItemResult[],
): Promise<void> {
  const byLocalId = new Map(results.map((r) => [r.local_id, r]));

  for (const item of items) {
    const result = byLocalId.get(item.localId);
    if (!result) {
      await updateQueueItemStatus(item.localId, 'failed', 'missing_result');
      continue;
    }

    if (result.status === 'created' || result.status === 'duplicate') {
      await updateQueueItemStatus(item.localId, 'synced', result.reason ?? null);
      continue;
    }

    await updateQueueItemStatus(
      item.localId,
      'failed',
      result.reason ?? 'rejected',
    );
  }
}

export async function processSyncQueue(): Promise<{ processed: number }> {
  if (syncing) return { processed: 0 };
  syncing = true;

  try {
    const pending = await listQueueItems({ status: 'pending' });
    const retryable = (await listQueueItems({ status: 'failed' })).filter(shouldRetry);
    const batch = [...pending, ...retryable].slice(0, MAX_BATCH);

    if (batch.length === 0) {
      return { processed: 0 };
    }

    for (const item of batch) {
      await updateQueueItemStatus(item.localId, 'syncing');
    }

    const deviceId = await getDeviceId();

    try {
      const response = await syncAttendanceBatch({
        deviceId,
        events: batch.map(toPayloadItem),
      });
      await applyResults(batch, response.results);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'sync_failed';
      for (const item of batch) {
        await updateQueueItemStatus(item.localId, 'failed', message);
      }
    }

    return { processed: batch.length };
  } finally {
    syncing = false;
  }
}

export function isSyncInProgress(): boolean {
  return syncing;
}
