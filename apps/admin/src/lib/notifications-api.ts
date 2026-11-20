import type {
  InAppNotificationRecord,
  UpdateUserNotificationPreferencesInput,
  UserNotificationPreferencesView,
} from '@hrm/shared-types';
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
  _notifications?: InAppNotificationRecord[],
): Promise<void> {
  await tenantApiRequest<{ updatedCount: number }>(`/notifications/read-all`, {
    method: 'PATCH',
  });
}

export function deleteNotification(
  id: string,
): Promise<{ deleted: boolean }> {
  return tenantApiRequest<{ deleted: boolean }>(`/notifications/${id}`, {
    method: 'DELETE',
  });
}

export function clearAllReadNotifications(): Promise<{ deletedCount: number }> {
  return tenantApiRequest<{ deletedCount: number }>(`/notifications/clear-all`, {
    method: 'DELETE',
  });
}

export function getNotificationPreferences(): Promise<UserNotificationPreferencesView> {
  return tenantApiRequest<UserNotificationPreferencesView>(
    `/notifications/preferences`,
  );
}

export function updateNotificationPreferences(
  input: UpdateUserNotificationPreferencesInput,
): Promise<UserNotificationPreferencesView> {
  return tenantApiRequest<UserNotificationPreferencesView>(
    `/notifications/preferences`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

