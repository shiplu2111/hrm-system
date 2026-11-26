import type {
  PlatformLeadDetail,
  PlatformLeadRecordKind,
  PlatformLeadsListQuery,
  PlatformLeadsListResponse,
  UpdatePlatformLeadInput,
} from '@hrm/shared-types';
import { getPlatformAccessToken } from './api-client';

const API_BASE = '/api/v1/platform/leads';

async function platformLeadsFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = body?.error?.message || body?.message || `HTTP ${res.status} request failed`;
    const err = new Error(errorMsg);
    (err as any).statusCode = res.status;
    throw err;
  }

  return body.data as T;
}

function buildQueryString(query: PlatformLeadsListQuery): string {
  const params = new URLSearchParams();
  if (query.kind) params.set('kind', query.kind);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.country && query.country !== 'all') params.set('country', query.country);
  if (query.source && query.source !== 'all') params.set('source', query.source);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.assigneeUserId && query.assigneeUserId !== 'all') {
    params.set('assigneeUserId', query.assigneeUserId);
  }
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  return params.toString();
}

export async function listPlatformLeads(
  query: PlatformLeadsListQuery = {},
): Promise<PlatformLeadsListResponse> {
  const qs = buildQueryString(query);
  return platformLeadsFetch<PlatformLeadsListResponse>(qs ? `?${qs}` : '');
}

export async function getPlatformLeadDetail(
  kind: PlatformLeadRecordKind,
  id: string,
): Promise<PlatformLeadDetail> {
  return platformLeadsFetch<PlatformLeadDetail>(`/${kind}/${id}`);
}

export async function updatePlatformLead(
  kind: PlatformLeadRecordKind,
  id: string,
  input: UpdatePlatformLeadInput,
): Promise<PlatformLeadDetail> {
  return platformLeadsFetch<PlatformLeadDetail>(`/${kind}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function downloadPlatformLeadsCsv(query: PlatformLeadsListQuery = {}): Promise<void> {
  const token = getPlatformAccessToken();
  const qs = buildQueryString(query);
  const res = await fetch(`${API_BASE}/export${qs ? `?${qs}` : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error(`Failed to export CSV (HTTP ${res.status})`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : `cmsn-leads-${new Date().toISOString().slice(0, 10)}.csv`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
