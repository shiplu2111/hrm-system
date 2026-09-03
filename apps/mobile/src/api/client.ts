import type {
  ApiResponse,
  AttendancePhase,
  AttendanceSyncBatchResponse,
  LoginRequest,
  LoginResponse,
} from '@hrm/shared-types';
import { Platform } from 'react-native';
import { getAccessToken } from '../db/session-repository';
import { getApiBaseUrl } from './api-config';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const apiBase = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, { ...init, headers });
  } catch (error) {
    const hint =
      Platform.OS === 'android'
        ? ' On Android emulator the API must be reachable at 10.0.2.2:3000 (not localhost).'
        : '';
    throw new ApiError(
      `${error instanceof Error ? error.message : 'Network request failed'}.${hint}`,
      0,
    );
  }
  const body = (await response.json()) as ApiResponse<T> | { error?: { message?: string } };

  if (!response.ok) {
    const message =
      'error' in body && body.error?.message
        ? body.error.message
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return (body as ApiResponse<T>).data;
}

export function login(input: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface SyncAttendancePayload {
  deviceId: string;
  events: Array<{
    local_id: string;
    employee_id: string;
    type: string;
    timestamp_device: string;
    gps?: { lat: number; lng: number };
    geofence_ok?: boolean;
    offline_duration_seconds?: number;
  }>;
}

export function syncAttendanceBatch(
  payload: SyncAttendancePayload,
): Promise<AttendanceSyncBatchResponse> {
  return request<AttendanceSyncBatchResponse>('/sync/attendance', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function derivePhaseFromLocalEvents(
  events: Array<{ eventType: string; status: string }>,
): AttendancePhase {
  const todayEvents = events.filter((e) => e.status !== 'failed');
  const hasClockIn = todayEvents.some((e) => e.eventType === 'clock_in');
  const hasClockOut = todayEvents.some((e) => e.eventType === 'clock_out');
  const openBreak =
    todayEvents.filter((e) => e.eventType === 'break_start').length >
    todayEvents.filter((e) => e.eventType === 'break_end').length;

  if (!hasClockIn) return 'not_started';
  if (hasClockOut) return 'completed';
  if (openBreak) return 'on_break';
  return 'working';
}
