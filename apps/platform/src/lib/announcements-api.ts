import { apiRequest } from './api-client';
import type {
  AudiencePreviewQuery,
  AudiencePreviewResult,
  CreatePlatformAnnouncementInput,
  PlatformAnnouncement,
  PlatformAnnouncementStats,
  UpdatePlatformAnnouncementInput,
} from '@hrm/shared-types';

export interface ListAnnouncementsParams {
  status?: string;
  severity?: string;
  audienceType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ListAnnouncementsResponse {
  items: Array<PlatformAnnouncement & { active: boolean; stats: PlatformAnnouncementStats }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function listPlatformAnnouncements(
  params?: ListAnnouncementsParams,
): Promise<ListAnnouncementsResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.severity) query.set('severity', params.severity);
  if (params?.audienceType) query.set('audienceType', params.audienceType);
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));

  const qs = query.toString();
  return apiRequest<ListAnnouncementsResponse>(
    `/platform/announcements${qs ? `?${qs}` : ''}`,
  );
}

export function getPlatformAnnouncement(
  id: string,
): Promise<PlatformAnnouncement & { active: boolean; stats: PlatformAnnouncementStats }> {
  return apiRequest<PlatformAnnouncement & { active: boolean; stats: PlatformAnnouncementStats }>(
    `/platform/announcements/${id}`,
  );
}

export function createPlatformAnnouncement(
  input: CreatePlatformAnnouncementInput,
): Promise<PlatformAnnouncement> {
  return apiRequest<PlatformAnnouncement>('/platform/announcements', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePlatformAnnouncement(
  id: string,
  input: UpdatePlatformAnnouncementInput,
): Promise<PlatformAnnouncement> {
  return apiRequest<PlatformAnnouncement>(`/platform/announcements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function publishPlatformAnnouncement(
  id: string,
): Promise<PlatformAnnouncement> {
  return apiRequest<PlatformAnnouncement>(`/platform/announcements/${id}/publish`, {
    method: 'POST',
  });
}

export function archivePlatformAnnouncement(
  id: string,
): Promise<PlatformAnnouncement> {
  return apiRequest<PlatformAnnouncement>(`/platform/announcements/${id}/archive`, {
    method: 'POST',
  });
}

export function deletePlatformAnnouncement(
  id: string,
): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/platform/announcements/${id}`, {
    method: 'DELETE',
  });
}

export function previewPlatformAudience(
  query: AudiencePreviewQuery,
): Promise<AudiencePreviewResult> {
  return apiRequest<AudiencePreviewResult>('/platform/announcements/audience-preview', {
    method: 'POST',
    body: JSON.stringify(query),
  });
}
