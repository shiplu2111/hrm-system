import type { TimesheetSyncItemResult } from '@hrm/shared-types';
import {
  listTimesheetQueueItems,
  updateTimesheetQueueItemStatus,
} from '../db/timesheet-queue-repository';
import type { TimesheetSyncQueueItem } from '../db/types';
import { syncTimesheetBatch } from '../api/client';
import { getDeviceId } from '../lib/device-id';

const MAX_BATCH = 50;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

let syncing = false;

function backoffMs(retryCount: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** retryCount, MAX_BACKOFF_MS);
}

function shouldRetry(item: TimesheetSyncQueueItem): boolean {
  if (item.status !== 'failed') return false;
  const elapsed = Date.now() - new Date(item.updatedAt).getTime();
  return elapsed >= backoffMs(item.retryCount);
}

function toPayloadItem(item: TimesheetSyncQueueItem) {
  const queueAgeSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 1000),
  );

  return {
    local_id: item.localId,
    employee_id: item.employeeId,
    type: item.eventType,
    timestamp_device: item.timestampDevice,
    entry_date: item.entryDate ?? undefined,
    project_id: item.projectId ?? undefined,
    task_name: item.taskName ?? undefined,
    start_time: item.startTime ?? undefined,
    end_time: item.endTime ?? undefined,
    break_minutes: item.breakMinutes ?? undefined,
    is_billable: item.isBillable ?? undefined,
    notes: item.notes ?? undefined,
    entry_local_id: item.entryLocalId ?? undefined,
    offline_duration_seconds:
      item.offlineDurationSeconds ?? queueAgeSeconds,
  };
}

async function applyResults(
  items: TimesheetSyncQueueItem[],
  results: TimesheetSyncItemResult[],
): Promise<void> {
  const byLocalId = new Map(results.map((r) => [r.local_id, r]));

  for (const item of items) {
    const result = byLocalId.get(item.localId);
    if (!result) {
      await updateTimesheetQueueItemStatus(item.localId, 'failed', 'missing_result');
      continue;
    }

    if (result.status === 'created' || result.status === 'duplicate') {
      await updateTimesheetQueueItemStatus(
        item.localId,
        'synced',
        result.reason ?? null,
      );
      continue;
    }

    await updateTimesheetQueueItemStatus(
      item.localId,
      'failed',
      result.reason ?? 'rejected',
    );
  }
}

export async function processTimesheetSyncQueue(): Promise<{ processed: number }> {
  if (syncing) return { processed: 0 };
  syncing = true;

  try {
    const pending = await listTimesheetQueueItems({ status: 'pending' });
    const retryable = (await listTimesheetQueueItems({ status: 'failed' })).filter(
      shouldRetry,
    );
    const batch = [...pending, ...retryable].slice(0, MAX_BATCH);

    if (batch.length === 0) {
      return { processed: 0 };
    }

    for (const item of batch) {
      await updateTimesheetQueueItemStatus(item.localId, 'syncing');
    }

    const deviceId = await getDeviceId();

    try {
      const response = await syncTimesheetBatch({
        deviceId,
        events: batch.map(toPayloadItem),
      });
      await applyResults(batch, response.results);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'sync_failed';
      for (const item of batch) {
        await updateTimesheetQueueItemStatus(item.localId, 'failed', message);
      }
    }

    return { processed: batch.length };
  } finally {
    syncing = false;
  }
}

export function isTimesheetSyncInProgress(): boolean {
  return syncing;
}
