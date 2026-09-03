import type { AttendanceEventType } from '@hrm/shared-types';
import type { QueueItemStatus, SyncQueueItem } from './types';
import { getDatabase } from './database';

interface QueueRow {
  id: string;
  local_id: string;
  employee_id: string;
  event_type: string;
  timestamp_device: string;
  gps_lat: number | null;
  gps_lng: number | null;
  geofence_ok: number | null;
  offline_duration_seconds: number | null;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: QueueRow): SyncQueueItem {
  return {
    id: row.id,
    localId: row.local_id,
    employeeId: row.employee_id,
    eventType: row.event_type as AttendanceEventType,
    timestampDevice: row.timestamp_device,
    gpsLat: row.gps_lat,
    gpsLng: row.gps_lng,
    geofenceOk: row.geofence_ok === null ? null : row.geofence_ok === 1,
    offlineDurationSeconds: row.offline_duration_seconds,
    status: row.status as QueueItemStatus,
    retryCount: row.retry_count,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface EnqueueInput {
  id: string;
  localId: string;
  employeeId: string;
  eventType: AttendanceEventType;
  timestampDevice: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  geofenceOk?: boolean | null;
  offlineDurationSeconds?: number | null;
}

export async function enqueueAttendanceEvent(input: EnqueueInput): Promise<SyncQueueItem> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sync_queue (
      id, local_id, employee_id, event_type, timestamp_device,
      gps_lat, gps_lng, geofence_ok, offline_duration_seconds,
      status, retry_count, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?)`,
    input.id,
    input.localId,
    input.employeeId,
    input.eventType,
    input.timestampDevice,
    input.gpsLat ?? null,
    input.gpsLng ?? null,
    input.geofenceOk === undefined || input.geofenceOk === null
      ? null
      : input.geofenceOk
        ? 1
        : 0,
    input.offlineDurationSeconds ?? null,
    now,
    now,
  );

  const row = await db.getFirstAsync<QueueRow>(
    'SELECT * FROM sync_queue WHERE local_id = ?',
    input.localId,
  );
  if (!row) {
    throw new Error('Failed to persist queue item');
  }
  return mapRow(row);
}

export async function listQueueItems(filter?: {
  status?: QueueItemStatus | QueueItemStatus[];
  employeeId?: string;
}): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filter?.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    clauses.push(`status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }
  if (filter?.employeeId) {
    clauses.push('employee_id = ?');
    params.push(filter.employeeId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await db.getAllAsync<QueueRow>(
    `SELECT * FROM sync_queue ${where} ORDER BY created_at ASC`,
    params,
  );
  return rows.map(mapRow);
}

export async function updateQueueItemStatus(
  localId: string,
  status: QueueItemStatus,
  lastError: string | null = null,
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue
     SET status = ?, last_error = ?, updated_at = ?,
         retry_count = CASE WHEN ? = 'failed' THEN retry_count + 1 ELSE retry_count END
     WHERE local_id = ?`,
    status,
    lastError,
    now,
    status,
    localId,
  );
}

export async function countByStatus(
  employeeId: string,
): Promise<Record<QueueItemStatus, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ status: string; count: number }>(
    `SELECT status, COUNT(*) as count FROM sync_queue WHERE employee_id = ?
     GROUP BY status`,
    employeeId,
  );
  const base: Record<QueueItemStatus, number> = {
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
  };
  for (const row of rows) {
    base[row.status as QueueItemStatus] = row.count;
  }
  return base;
}

export async function getTodayEvents(employeeId: string): Promise<SyncQueueItem[]> {
  const items = await listQueueItems({ employeeId });
  const today = new Date().toISOString().slice(0, 10);
  return items.filter((item) => item.timestampDevice.slice(0, 10) === today);
}
