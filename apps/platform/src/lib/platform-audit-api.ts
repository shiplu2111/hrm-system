// apps/platform/src/lib/platform-audit-api.ts
import type {
  PlatformAuditFilterOptions,
  PlatformAuditLogItem,
  PlatformAuditLogQuery,
  PlatformAuditLogResponse,
} from '@hrm/shared-types';
import { getPlatformAccessToken } from './api-client';

const API_BASE = '/api/v1/platform/audit-logs';

async function platformAuditFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
    const errorMsg = body?.error?.message || body?.message || `HTTP ${res.status} request failed`;
    const err = new Error(errorMsg);
    (err as any).statusCode = res.status;
    (err as any).errorData = body?.error || body;
    throw err;
  }

  return body.data as T;
}

export async function listPlatformAuditLogs(
  query: PlatformAuditLogQuery = {},
): Promise<PlatformAuditLogResponse> {
  const params = new URLSearchParams();
  if (query.userId) params.set('userId', query.userId);
  if (query.tenantId) params.set('tenantId', query.tenantId);
  if (query.module) params.set('module', query.module);
  if (query.action) params.set('action', query.action);
  if (query.search) params.set('search', query.search);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));

  const qs = params.toString();
  const endpoint = qs ? `?${qs}` : '';

  const token = getPlatformAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { headers });
  const body = await res.json();
  if (!res.ok) {
    const errorMsg = body?.error?.message || body?.message || `HTTP ${res.status} request failed`;
    const err = new Error(errorMsg);
    (err as any).statusCode = res.status;
    throw err;
  }

  return {
    items: body.data || [],
    total: body.meta?.total ?? 0,
    page: body.meta?.page ?? 1,
    pageSize: body.meta?.pageSize ?? 25,
    totalPages: body.meta?.totalPages ?? 1,
  };
}

export async function getPlatformAuditFilterOptions(): Promise<PlatformAuditFilterOptions> {
  return platformAuditFetch<PlatformAuditFilterOptions>('/filters');
}

export async function exportPlatformAuditCsv(query: PlatformAuditLogQuery = {}): Promise<Blob> {
  const params = new URLSearchParams();
  if (query.userId) params.set('userId', query.userId);
  if (query.tenantId) params.set('tenantId', query.tenantId);
  if (query.module) params.set('module', query.module);
  if (query.action) params.set('action', query.action);
  if (query.search) params.set('search', query.search);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);

  const qs = params.toString();
  const endpoint = `/export${qs ? `?${qs}` : ''}`;

  const token = getPlatformAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status} export failed`;
    try {
      const errJson = await res.json();
      msg = errJson?.error?.message || errJson?.message || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  return res.blob();
}
