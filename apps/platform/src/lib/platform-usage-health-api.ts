// platform-usage-health-api.ts
// Platform API client for Usage Metering and System Health Monitoring

import { apiRequest } from './api-client';
import type {
  ApiLatencyAndErrorRate,
  CreatePlatformIncidentInput,
  DatabaseConnectionHealth,
  HealthTimeseriesResponse,
  MobileSyncHealth,
  NotificationProvidersHealth,
  PlatformComprehensiveHealth,
  PlatformIncidentItem,
  PlatformIncidentsResponse,
  QueueHealthSummary,
  RedisHealth,
  StorageHealth,
  TenantUsageOverviewFilter,
  TenantUsageOverviewResponse,
  TenantUsageTrendsResponse,
  TriggerUsageMeteringInput,
  UpdatePlatformIncidentInput,
  UsageDailyRecord,
  UsageDailySummary,
  UsageMeteringFilter,
  WebSocketHealth,
} from '@hrm/shared-types';

export function getTenantUsageOverview(
  filter?: TenantUsageOverviewFilter,
): Promise<TenantUsageOverviewResponse> {
  const params = new URLSearchParams();
  if (filter?.search) params.append('search', filter.search);
  if (filter?.plan && filter.plan !== 'all') params.append('plan', filter.plan);
  if (filter?.status && filter.status !== 'all') params.append('status', filter.status);
  if (filter?.resource && filter.resource !== 'all') params.append('resource', filter.resource);
  if (filter?.sortBy) params.append('sortBy', filter.sortBy);
  if (filter?.sortOrder) params.append('sortOrder', filter.sortOrder);
  if (filter?.page) params.append('page', String(filter.page));
  if (filter?.limit) params.append('limit', String(filter.limit));

  const query = params.toString();
  return apiRequest<TenantUsageOverviewResponse>(`/platform/usage/overview${query ? `?${query}` : ''}`);
}

export function getTenantUsageTrends(query?: {
  tenantId?: string;
  days?: number;
}): Promise<TenantUsageTrendsResponse> {
  const params = new URLSearchParams();
  if (query?.tenantId) params.append('tenantId', query.tenantId);
  if (query?.days) params.append('days', String(query.days));

  const qs = params.toString();
  return apiRequest<TenantUsageTrendsResponse>(`/platform/usage/trends${qs ? `?${qs}` : ''}`);
}

export function exportTenantUsage(query?: {
  format?: 'csv' | 'json';
  search?: string;
  plan?: string;
  status?: string;
  resource?: string;
}): Promise<{ csv?: string; json?: any; filename: string }> {
  const params = new URLSearchParams();
  if (query?.format) params.append('format', query.format);
  if (query?.search) params.append('search', query.search);
  if (query?.plan && query.plan !== 'all') params.append('plan', query.plan);
  if (query?.status && query.status !== 'all') params.append('status', query.status);
  if (query?.resource && query.resource !== 'all') params.append('resource', query.resource);

  const qs = params.toString();
  return apiRequest<{ csv?: string; json?: any; filename: string }>(
    `/platform/usage/export${qs ? `?${qs}` : ''}`,
  );
}

export function getPlatformComprehensiveHealth(): Promise<PlatformComprehensiveHealth> {
  return apiRequest<PlatformComprehensiveHealth>('/platform/health');
}

export function getPlatformApiMetrics(): Promise<ApiLatencyAndErrorRate> {
  return apiRequest<ApiLatencyAndErrorRate>('/platform/health/api');
}

export function getPlatformDatabaseHealth(): Promise<DatabaseConnectionHealth> {
  return apiRequest<DatabaseConnectionHealth>('/platform/health/database');
}

export function getPlatformRedisHealth(): Promise<RedisHealth> {
  return apiRequest<RedisHealth>('/platform/health/redis');
}

export function getPlatformQueuesHealth(): Promise<QueueHealthSummary> {
  return apiRequest<QueueHealthSummary>('/platform/health/queues');
}

export function getPlatformWebSocketHealth(): Promise<WebSocketHealth> {
  return apiRequest<WebSocketHealth>('/platform/health/websocket');
}

export function getPlatformMobileSyncHealth(): Promise<MobileSyncHealth> {
  return apiRequest<MobileSyncHealth>('/platform/health/mobile-sync');
}

export function getPlatformStorageHealth(): Promise<StorageHealth> {
  return apiRequest<StorageHealth>('/platform/health/storage');
}

export function getPlatformNotificationsHealth(): Promise<NotificationProvidersHealth> {
  return apiRequest<NotificationProvidersHealth>('/platform/health/notifications');
}

export function getPlatformHealthTrends(
  timeRange: '1h' | '6h' | '24h' | '7d' = '24h',
): Promise<HealthTimeseriesResponse> {
  return apiRequest<HealthTimeseriesResponse>(`/platform/health/trends?timeRange=${timeRange}`);
}

export function getPlatformIncidents(params?: {
  subsystem?: string;
  status?: string;
}): Promise<PlatformIncidentsResponse> {
  const q = new URLSearchParams();
  if (params?.subsystem && params.subsystem !== 'all') q.append('subsystem', params.subsystem);
  if (params?.status && params.status !== 'all') q.append('status', params.status);
  const qs = q.toString();
  return apiRequest<PlatformIncidentsResponse>(`/platform/health/incidents${qs ? `?${qs}` : ''}`);
}

export function createPlatformIncident(
  input: CreatePlatformIncidentInput,
): Promise<PlatformIncidentItem> {
  return apiRequest<PlatformIncidentItem>('/platform/health/incidents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePlatformIncident(
  id: string,
  input: UpdatePlatformIncidentInput,
): Promise<PlatformIncidentItem> {
  return apiRequest<PlatformIncidentItem>(`/platform/health/incidents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listDailyUsage(
  filter?: UsageMeteringFilter,
): Promise<{ items: UsageDailyRecord[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams();
  if (filter?.tenantId) params.append('tenantId', filter.tenantId);
  if (filter?.startDate) params.append('startDate', filter.startDate);
  if (filter?.endDate) params.append('endDate', filter.endDate);
  if (filter?.search) params.append('search', filter.search);
  if (filter?.page) params.append('page', String(filter.page));
  if (filter?.limit) params.append('limit', String(filter.limit));

  const query = params.toString();
  return apiRequest<{ items: UsageDailyRecord[]; total: number; page: number; limit: number }>(
    `/platform/usage/daily${query ? `?${query}` : ''}`,
  );
}

export function getUsageSummary(filter?: UsageMeteringFilter): Promise<UsageDailySummary> {
  const params = new URLSearchParams();
  if (filter?.tenantId) params.append('tenantId', filter.tenantId);
  if (filter?.startDate) params.append('startDate', filter.startDate);
  if (filter?.endDate) params.append('endDate', filter.endDate);

  const query = params.toString();
  return apiRequest<UsageDailySummary>(`/platform/usage/summary${query ? `?${query}` : ''}`);
}

export function getTenantUsageTimeline(
  tenantId: string,
  days = 30,
): Promise<UsageDailyRecord[]> {
  return apiRequest<UsageDailyRecord[]>(`/platform/usage/tenants/${tenantId}?days=${days}`);
}

export function triggerUsageMetering(
  input?: TriggerUsageMeteringInput,
): Promise<UsageDailySummary> {
  return apiRequest<UsageDailySummary>('/platform/usage/trigger', {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  });
}
