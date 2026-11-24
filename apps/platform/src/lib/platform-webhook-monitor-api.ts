// apps/platform/src/lib/platform-webhook-monitor-api.ts
import type {
  AutoDisableFailingEndpointsInput,
  AutoDisableFailingEndpointsResult,
  PlatformWebhookDeliveriesQuery,
  PlatformWebhookDeliveryItem,
  PlatformWebhookEndpointItem,
  PlatformWebhookEndpointsQuery,
  PlatformWebhookMonitorSummary,
  RedeliverWebhookResult,
  TenantWebhookStatus,
} from '@hrm/shared-types';
import { getPlatformAccessToken } from './api-client';

const API_BASE = '/api/v1/platform/webhook-monitor';

async function platformWebhookFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ data: T; meta?: any }> {
  const token = getPlatformAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const body = await res.json();
  if (!res.ok) {
    const errorMsg =
      body?.error?.message ||
      body?.message ||
      `HTTP ${res.status} request failed`;
    const err = new Error(errorMsg);
    (err as any).statusCode = res.status;
    (err as any).errorData = body?.error || body;
    throw err;
  }

  return body;
}

export async function getPlatformWebhookMonitorSummary(): Promise<PlatformWebhookMonitorSummary> {
  const res = await platformWebhookFetch<PlatformWebhookMonitorSummary>('/summary');
  return res.data;
}

export async function listPlatformWebhookDeliveries(
  query: PlatformWebhookDeliveriesQuery = {},
): Promise<{ data: PlatformWebhookDeliveryItem[]; meta: any }> {
  const params = new URLSearchParams();
  if (query.tenantId) params.set('tenantId', query.tenantId);
  if (query.eventType) params.set('eventType', query.eventType);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.search) params.set('search', query.search);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));

  const qs = params.toString();
  return platformWebhookFetch<PlatformWebhookDeliveryItem[]>(
    `/deliveries${qs ? `?${qs}` : ''}`,
  );
}

export async function getPlatformWebhookDeliveryDetail(
  id: string,
): Promise<PlatformWebhookDeliveryItem> {
  const res = await platformWebhookFetch<PlatformWebhookDeliveryItem>(
    `/deliveries/${id}`,
  );
  return res.data;
}

export async function redeliverPlatformWebhook(
  id: string,
): Promise<RedeliverWebhookResult> {
  const res = await platformWebhookFetch<RedeliverWebhookResult>(
    `/deliveries/${id}/redeliver`,
    { method: 'POST' },
  );
  return res.data;
}

export async function listPlatformWebhookEndpoints(
  query: PlatformWebhookEndpointsQuery = {},
): Promise<{ data: PlatformWebhookEndpointItem[]; meta: any }> {
  const params = new URLSearchParams();
  if (query.tenantId) params.set('tenantId', query.tenantId);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.search) params.set('search', query.search);
  if (query.failingOnly) params.set('failingOnly', 'true');
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));

  const qs = params.toString();
  return platformWebhookFetch<PlatformWebhookEndpointItem[]>(
    `/endpoints${qs ? `?${qs}` : ''}`,
  );
}

export async function togglePlatformWebhookEndpointStatus(
  id: string,
  status: TenantWebhookStatus,
): Promise<PlatformWebhookEndpointItem> {
  const res = await platformWebhookFetch<PlatformWebhookEndpointItem>(
    `/endpoints/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
  return res.data;
}

export async function autoDisableFailingPlatformEndpoints(
  input: AutoDisableFailingEndpointsInput = {},
): Promise<AutoDisableFailingEndpointsResult> {
  const res = await platformWebhookFetch<AutoDisableFailingEndpointsResult>(
    '/auto-disable',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return res.data;
}
