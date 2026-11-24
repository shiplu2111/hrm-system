// apps/platform/src/lib/platform-support-api.ts
import {
  CreatePlatformTicketMessageInput,
  PlatformStaffAssignee,
  PlatformSupportQueueQuery,
  PlatformSupportQueueResponse,
  PlatformSupportTicketDetail,
  PlatformTicketMessageItem,
  UpdatePlatformTicketInput,
} from '@hrm/shared-types';
import { getPlatformAccessToken } from './api-client';

const API_BASE = '/api/v1/platform/support-tickets';

async function platformSupportFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

export async function getPlatformTickets(query: PlatformSupportQueueQuery = {}): Promise<PlatformSupportQueueResponse> {
  const params = new URLSearchParams();
  if (query.tenantId && query.tenantId !== 'all') params.set('tenantId', query.tenantId);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.priority && query.priority !== 'all') params.set('priority', query.priority);
  if (query.assigneeId && query.assigneeId !== 'all') params.set('assigneeId', query.assigneeId);
  if (query.slaStatus && query.slaStatus !== 'all') params.set('slaStatus', query.slaStatus);
  if (query.search) params.set('search', query.search);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));

  const qs = params.toString();
  return platformSupportFetch<PlatformSupportQueueResponse>(qs ? `?${qs}` : '');
}

export async function getPlatformTicketDetail(id: string): Promise<PlatformSupportTicketDetail> {
  return platformSupportFetch<PlatformSupportTicketDetail>(`/${id}`);
}

export async function updatePlatformTicket(
  id: string,
  input: UpdatePlatformTicketInput,
): Promise<PlatformSupportTicketDetail> {
  return platformSupportFetch<PlatformSupportTicketDetail>(`/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function createPlatformTicketMessage(
  id: string,
  input: CreatePlatformTicketMessageInput,
): Promise<PlatformTicketMessageItem> {
  return platformSupportFetch<PlatformTicketMessageItem>(`/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getPlatformStaffAssignees(): Promise<PlatformStaffAssignee[]> {
  return platformSupportFetch<PlatformStaffAssignee[]>('/staff');
}
