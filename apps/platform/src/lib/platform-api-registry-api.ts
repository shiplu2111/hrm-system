// apps/platform/src/lib/platform-api-registry-api.ts
import type {
  PlatformApiKeyItem,
  PlatformApiKeyQuery,
  PlatformApiRegistrySummary,
  PlatformOAuthClientItem,
  PlatformOAuthClientQuery,
  PlatformRateLimitQuery,
  RevokePlatformApiKeyInput,
  RevokePlatformOAuthClientInput,
  SetTenantRateLimitOverrideInput,
  TenantRateLimitItem,
} from '@hrm/shared-types';
import { getPlatformAccessToken } from './api-client';

const API_BASE = '/api/v1/platform/api-registry';

async function platformApiFetch<T>(
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

export async function getPlatformApiRegistrySummary(): Promise<PlatformApiRegistrySummary> {
  const res = await platformApiFetch<PlatformApiRegistrySummary>('/summary');
  return res.data;
}

export async function listPlatformApiKeys(
  query: PlatformApiKeyQuery = {},
): Promise<{ data: PlatformApiKeyItem[]; meta: any }> {
  const params = new URLSearchParams();
  if (query.tenantId) params.set('tenantId', query.tenantId);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.scope) params.set('scope', query.scope);
  if (query.search) params.set('search', query.search);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));

  const qs = params.toString();
  return platformApiFetch<PlatformApiKeyItem[]>(`/keys${qs ? `?${qs}` : ''}`);
}

export async function revokePlatformApiKey(
  id: string,
  input: RevokePlatformApiKeyInput,
): Promise<PlatformApiKeyItem> {
  const res = await platformApiFetch<PlatformApiKeyItem>(`/keys/${id}/revoke`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function listPlatformOAuthClients(
  query: PlatformOAuthClientQuery = {},
): Promise<{ data: PlatformOAuthClientItem[]; meta: any }> {
  const params = new URLSearchParams();
  if (query.tenantId) params.set('tenantId', query.tenantId);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.search) params.set('search', query.search);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));

  const qs = params.toString();
  return platformApiFetch<PlatformOAuthClientItem[]>(
    `/oauth-clients${qs ? `?${qs}` : ''}`,
  );
}

export async function revokePlatformOAuthClient(
  id: string,
  input: RevokePlatformOAuthClientInput,
): Promise<PlatformOAuthClientItem> {
  const res = await platformApiFetch<PlatformOAuthClientItem>(
    `/oauth-clients/${id}/revoke`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return res.data;
}

export async function listTenantRateLimits(
  query: PlatformRateLimitQuery = {},
): Promise<{ data: TenantRateLimitItem[]; meta: any }> {
  const params = new URLSearchParams();
  if (query.tenantId) params.set('tenantId', query.tenantId);
  if (query.hasOverride !== undefined)
    params.set('hasOverride', String(query.hasOverride));
  if (query.search) params.set('search', query.search);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));

  const qs = params.toString();
  return platformApiFetch<TenantRateLimitItem[]>(
    `/rate-limits${qs ? `?${qs}` : ''}`,
  );
}

export async function setTenantRateLimitOverride(
  tenantId: string,
  input: SetTenantRateLimitOverrideInput,
): Promise<TenantRateLimitItem> {
  const res = await platformApiFetch<TenantRateLimitItem>(
    `/rate-limits/${tenantId}`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return res.data;
}

export async function removeTenantRateLimitOverride(
  tenantId: string,
): Promise<TenantRateLimitItem> {
  const res = await platformApiFetch<TenantRateLimitItem>(
    `/rate-limits/${tenantId}`,
    {
      method: 'DELETE',
    },
  );
  return res.data;
}
