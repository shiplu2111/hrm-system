import type { SyncableRecord } from './common';

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'early_leave'
  | 'half_day'
  | 'holiday'
  | 'weekend'
  | 'leave'
  | 'wfh'
  | 'business_trip';

export type AttendanceEventType =
  | 'clock_in'
  | 'clock_out'
  | 'break_start'
  | 'break_end';

export interface AttendanceEventDTO extends SyncableRecord {
  employee_id: string;
  type: AttendanceEventType;
  /** ISO 8601 — device timestamp; server resolves payroll truth */
  timestamp_device: string;
  gps?: { lat: number; lng: number };
  /** Device geofence verdict at capture (OFFLINE_SYNC.md §6) */
  geofence_ok?: boolean;
  offline_duration_seconds?: number;
}

export type AttendanceReviewStatus = 'none' | 'pending_manager' | 'approved';

export type AttendancePhase = 'not_started' | 'working' | 'on_break' | 'completed';

export interface AttendanceBreakRecord {
  id: string;
  startAt: string;
  endAt: string | null;
}

export interface AttendanceShiftInfo {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  standardMinutes: number;
}

export interface AttendanceMetrics {
  grossMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  standardMinutes: number;
  overtimeMinutes: number;
  isLate: boolean;
  isEarlyLeave: boolean;
  phase: AttendancePhase;
}

export interface AttendanceDayRecord {
  id: string | null;
  employeeId: string | null;
  date: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInServerAt: string | null;
  clockOutServerAt: string | null;
  status: AttendanceStatus;
  source: string | null;
  timeAnomaly: boolean;
  geofenceMismatch: boolean;
  payrollEligible: boolean;
  reviewStatus: AttendanceReviewStatus;
  shift: AttendanceShiftInfo;
  breaks: AttendanceBreakRecord[];
  metrics: AttendanceMetrics;
}

export interface AttendanceCaptureInput {
  source?: 'manual' | 'mobile' | 'biometric' | 'qr' | 'gps';
  deviceId?: string;
  gpsLat?: number;
  gpsLng?: number;
  /** Optional ISO timestamp for test harnesses */
  timestamp?: string;
}

export type AttendanceSyncResultStatus = 'created' | 'duplicate' | 'rejected';

export interface AttendanceSyncItemResult {
  local_id: string;
  status: AttendanceSyncResultStatus;
  server_id?: string;
  reason?: string;
}

export interface AttendanceSyncBatchRequest {
  deviceId: string;
  events: Array<
    Pick<AttendanceEventDTO, 'local_id' | 'employee_id' | 'type' | 'timestamp_device' | 'gps'>
  >;
}

export interface AttendanceSyncBatchResponse {
  results: AttendanceSyncItemResult[];
}
