import type { InAppNotificationRecord } from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listNotifications(options?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<InAppNotificationRecord[]> {
  const params = new URLSearchParams();
  if (options?.unreadOnly) params.set('unreadOnly', 'true');
  if (options?.limit != null) params.set('limit', String(options.limit));
  const query = params.toString();
  return tenantApiRequest<InAppNotificationRecord[]>(
    `/notifications${query ? `?${query}` : ''}`,
  );
}

export function markNotificationRead(
  id: string,
): Promise<InAppNotificationRecord> {
  return tenantApiRequest<InAppNotificationRecord>(
    `/notifications/${id}/read`,
    { method: 'PATCH' },
  );
}

export async function markAllNotificationsRead(
  notifications: InAppNotificationRecord[],
): Promise<void> {
  const unread = notifications.filter((n) => !n.readAt);
  await Promise.all(unread.map((n) => markNotificationRead(n.id)));
}
