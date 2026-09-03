import type { InAppNotificationRecord } from '@hrm/shared-types';

export function toInAppNotificationRecord(row: {
  id: string;
  eventType: string;
  title: string;
  body: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}): InAppNotificationRecord {
  return {
    id: row.id,
    eventType: row.eventType,
    title: row.title,
    body: row.body,
    payload:
      row.payload && typeof row.payload === 'object'
        ? (row.payload as Record<string, unknown>)
        : {},
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
