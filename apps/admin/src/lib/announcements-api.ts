import { tenantApiRequest } from './tenant-api-client';
import type { TenantActiveAnnouncement } from '@hrm/shared-types';

export async function getActiveAnnouncements(): Promise<TenantActiveAnnouncement[]> {
  try {
    return await tenantApiRequest<TenantActiveAnnouncement[]>('/announcements/active');
  } catch (err) {
    // If user is not authenticated yet or network fails, return empty list
    return [];
  }
}

export async function dismissAnnouncement(
  id: string,
): Promise<{ success: boolean }> {
  return await tenantApiRequest<{ success: boolean }>(
    `/announcements/${id}/dismiss`,
    {
      method: 'POST',
    },
  );
}

export async function recordAnnouncementRead(
  id: string,
): Promise<{ success: boolean }> {
  try {
    return await tenantApiRequest<{ success: boolean }>(
      `/announcements/${id}/read`,
      {
        method: 'POST',
      },
    );
  } catch {
    return { success: false };
  }
}
