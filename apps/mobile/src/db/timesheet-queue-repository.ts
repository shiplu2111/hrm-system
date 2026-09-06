import type { TimesheetSyncEventType } from '@hrm/shared-types';
import type { QueueItemStatus, TimesheetSyncQueueItem } from './types';
import { getDatabase } from './database';

interface TimesheetQueueRow {
  id: string;
  local_id: string;
  employee_id: string;
  event_type: string;
  timestamp_device: string;
  entry_date: string | null;
  project_id: string | null;
  task_name: string | null;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number | null;
  is_billable: number | null;
  notes: string | null;
  entry_local_id: string | null;
  offline_duration_seconds: number | null;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: TimesheetQueueRow): TimesheetSyncQueueItem {
  return {
    id: row.id,
    localId: row.local_id,
    employeeId: row.employee_id,
    eventType: row.event_type as TimesheetSyncEventType,
    timestampDevice: row.timestamp_device,
    entryDate: row.entry_date,
    projectId: row.project_id,
    taskName: row.task_name,
    startTime: row.start_time,
    endTime: row.end_time,
    breakMinutes: row.break_minutes,
    isBillable: row.is_billable === null ? null : row.is_billable === 1,
    notes: row.notes,
    entryLocalId: row.entry_local_id,
    offlineDurationSeconds: row.offline_duration_seconds,
    status: row.status as QueueItemStatus,
    retryCount: row.retry_count,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface EnqueueTimesheetInput {
  id: string;
  localId: string;
  employeeId: string;
  eventType: TimesheetSyncEventType;
  timestampDevice: string;
  entryDate?: string;
  projectId?: string;
  taskName?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  isBillable?: boolean;
  notes?: string;
  entryLocalId?: string;
  offlineDurationSeconds?: number;
}

export async function enqueueTimesheetEvent(
  input: EnqueueTimesheetInput,
): Promise<TimesheetSyncQueueItem> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO timesheet_sync_queue (
      id, local_id, employee_id, event_type, timestamp_device,
      entry_date, project_id, task_name, start_time, end_time,
      break_minutes, is_billable, notes, entry_local_id, offline_duration_seconds,
      status, retry_count, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?)`,
    input.id,
    input.localId,
    input.employeeId,
    input.eventType,
    input.timestampDevice,
    input.entryDate ?? null,
    input.projectId ?? null,
    input.taskName ?? null,
    input.startTime ?? null,
    input.endTime ?? null,
    input.breakMinutes ?? null,
    input.isBillable === undefined || input.isBillable === null
      ? null
      : input.isBillable
        ? 1
        : 0,
    input.notes ?? null,
    input.entryLocalId ?? null,
    input.offlineDurationSeconds ?? null,
    now,
    now,
  );

  const row = await db.getFirstAsync<TimesheetQueueRow>(
    'SELECT * FROM timesheet_sync_queue WHERE local_id = ?',
    input.localId,
  );
  if (!row) {
    throw new Error('Failed to persist timesheet queue item');
  }
  return mapRow(row);
}

export async function listTimesheetQueueItems(filter?: {
  status?: QueueItemStatus | QueueItemStatus[];
  employeeId?: string;
}): Promise<TimesheetSyncQueueItem[]> {
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
  const rows = await db.getAllAsync<TimesheetQueueRow>(
    `SELECT * FROM timesheet_sync_queue ${where} ORDER BY created_at ASC`,
    params,
  );
  return rows.map(mapRow);
}

export async function updateTimesheetQueueItemStatus(
  localId: string,
  status: QueueItemStatus,
  lastError: string | null = null,
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE timesheet_sync_queue
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

export async function countTimesheetByStatus(
  employeeId: string,
): Promise<Record<QueueItemStatus, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ status: string; count: number }>(
    `SELECT status, COUNT(*) as count FROM timesheet_sync_queue WHERE employee_id = ?
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
