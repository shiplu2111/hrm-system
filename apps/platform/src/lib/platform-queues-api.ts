// apps/platform/src/lib/platform-queues-api.ts
import {
  BullMqJobItem,
  CleanQueueJobsInput,
  CleanQueueJobsResult,
  JobState,
  QueueJobsQuery,
  QueueJobsResponse,
  QueueSystemOverview,
  RemoveJobInput,
  RemoveJobResult,
  RetryJobResult,
  RetryQueueFailedJobsResult,
} from '@hrm/shared-types';
import { getPlatformAccessToken } from './api-client';

const API_BASE = '/api/v1/platform/queues';

async function platformQueueFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

export async function getQueueOverview(): Promise<QueueSystemOverview> {
  return platformQueueFetch<QueueSystemOverview>('/overview');
}

export async function getQueueJobs(query: QueueJobsQuery = {}): Promise<QueueJobsResponse> {
  const params = new URLSearchParams();
  if (query.queueName) params.set('queueName', query.queueName);
  if (query.state && query.state !== 'all') params.set('state', query.state);
  if (query.search) params.set('search', query.search);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.prominentOnly) params.set('prominentOnly', 'true');

  const qs = params.toString();
  return platformQueueFetch<QueueJobsResponse>(`/jobs${qs ? `?${qs}` : ''}`);
}

export async function getJobDetails(queueName: string, jobId: string): Promise<BullMqJobItem> {
  return platformQueueFetch<BullMqJobItem>(`/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(jobId)}`);
}

export async function retryJob(queueName: string, jobId: string): Promise<RetryJobResult> {
  return platformQueueFetch<RetryJobResult>(`/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(jobId)}/retry`, {
    method: 'POST',
  });
}

export async function retryQueueFailed(queueName: string): Promise<RetryQueueFailedJobsResult> {
  return platformQueueFetch<RetryQueueFailedJobsResult>(`/${encodeURIComponent(queueName)}/retry-failed`, {
    method: 'POST',
  });
}

export async function removeJob(
  queueName: string,
  jobId: string,
  input: RemoveJobInput = {},
): Promise<RemoveJobResult> {
  const params = new URLSearchParams();
  if (input.reason) params.set('reason', input.reason);
  const qs = params.toString();
  return platformQueueFetch<RemoveJobResult>(`/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(jobId)}${qs ? `?${qs}` : ''}`, {
    method: 'DELETE',
    body: JSON.stringify(input),
  });
}

export async function cleanQueue(
  queueName: string,
  input: CleanQueueJobsInput,
): Promise<CleanQueueJobsResult> {
  return platformQueueFetch<CleanQueueJobsResult>(`/${encodeURIComponent(queueName)}/clean`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
