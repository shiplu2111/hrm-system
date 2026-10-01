import type { SyncableRecord } from './common';
import type { AttendanceDisplayFields, LocaleContext } from './locale';

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
  /** Resolved branch locale (timezone + country formatting). */
  locale?: LocaleContext;
  /** Human-readable timestamps in the employee's branch timezone. */
  display?: AttendanceDisplayFields;
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

// --- Admin register, exceptions and corrections (ATTENDANCE_LOGIC.md §7–§8) ---

/**
 * Day status shown in the register. Record statuses come from the attendance record; the rest are
 * derived when there is no record: `scheduled` (rostered, today or later) and `off` (no roster entry).
 */
export type AttendanceDayStatus = AttendanceStatus | 'scheduled' | 'off';

export type AttendanceExceptionType =
  | 'missed_punch'
  | 'time_anomaly'
  | 'geofence_mismatch'
  | 'correction_request';

export interface AttendanceDayFlags {
  missedPunch: boolean;
  timeAnomaly: boolean;
  geofenceMismatch: boolean;
  /** An approved correction has been applied to this day. */
  corrected: boolean;
  pendingCorrection: boolean;
}

export interface AttendanceRegisterEmployee {
  id: string;
  employeeNumber: string;
  name: string;
  departmentName: string | null;
  designationName: string | null;
}

export interface AttendanceRegisterDay {
  date: string;
  status: AttendanceDayStatus;
  recordId: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  netMinutes: number | null;
  shiftName: string | null;
  holidayName: string | null;
  leaveTypeName: string | null;
  flags: AttendanceDayFlags;
}

export interface AttendanceRegisterRow {
  employee: AttendanceRegisterEmployee;
  timezone: string;
  days: AttendanceRegisterDay[];
  counts: Partial<Record<AttendanceDayStatus, number>>;
  netMinutes: number;
  exceptions: number;
}

export interface AttendanceRegister {
  from: string;
  to: string;
  /** Today in the company timezone, for greying out future days. */
  today: string;
  timezone: string;
  rows: AttendanceRegisterRow[];
  counts: Partial<Record<AttendanceDayStatus, number>>;
}

export type AttendanceCorrectionKind = 'regularization' | 'flag_approval';
export type AttendanceCorrectionStatus = 'pending' | 'approved' | 'rejected';

export interface AttendanceCorrectionSnapshot {
  exists: boolean;
  clockInAt: string | null;
  clockOutAt: string | null;
  status: AttendanceStatus | null;
  timeAnomaly: boolean;
  geofenceMismatch: boolean;
  reviewStatus: AttendanceReviewStatus | null;
  payrollEligible: boolean | null;
}

export interface AttendanceCorrectionRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  attendanceRecordId: string | null;
  kind: AttendanceCorrectionKind;
  status: AttendanceCorrectionStatus;
  reason: string;
  requestedClockInAt: string | null;
  requestedClockOutAt: string | null;
  requestedStatus: AttendanceStatus | null;
  useServerTime: boolean;
  original: AttendanceCorrectionSnapshot;
  requestedBy: { userId: string; name: string };
  reviewedBy: { userId: string; name: string } | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
}

export interface AttendanceSyncEventSummary {
  eventType: AttendanceEventType;
  deviceTimestamp: string;
  serverTimestamp: string;
  skewMinutes: number;
  timeAnomaly: boolean;
  deviceGeofenceOk: boolean | null;
  serverGeofenceOk: boolean | null;
  geofenceMismatch: boolean;
}

export interface AttendanceDayDetail {
  employee: AttendanceRegisterEmployee;
  timezone: string;
  date: string;
  status: AttendanceDayStatus;
  exceptionTypes: AttendanceExceptionType[];
  record: {
    id: string;
    clockInAt: string | null;
    clockOutAt: string | null;
    clockInServerAt: string | null;
    clockOutServerAt: string | null;
    status: AttendanceStatus;
    source: string;
    deviceId: string | null;
    gps: { lat: number; lng: number } | null;
    reviewStatus: AttendanceReviewStatus;
    payrollEligible: boolean;
    breaks: AttendanceBreakRecord[];
    grossMinutes: number | null;
    breakMinutes: number;
    netMinutes: number | null;
  } | null;
  shift: { name: string; startTime: string; endTime: string; graceMinutes: number } | null;
  location: { name: string; lat: number | null; lng: number | null; radiusM: number | null } | null;
  /** Distance from the geofence centre to the recorded GPS point. */
  distanceM: number | null;
  syncEvents: AttendanceSyncEventSummary[];
  holidayName: string | null;
  leaveTypeName: string | null;
  corrections: AttendanceCorrectionRecord[];
}

export interface AttendanceExceptionItem {
  id: string;
  types: AttendanceExceptionType[];
  employee: AttendanceRegisterEmployee;
  date: string;
  timezone: string;
  recordId: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInServerAt: string | null;
  clockOutServerAt: string | null;
  status: AttendanceStatus | null;
  source: string | null;
  maxSkewMinutes: number | null;
  distanceM: number | null;
  locationName: string | null;
  correction: AttendanceCorrectionRecord | null;
}

export interface AttendanceExceptionList {
  from: string;
  to: string;
  items: AttendanceExceptionItem[];
  counts: Record<AttendanceExceptionType, number>;
}

export interface CreateAttendanceCorrectionInput {
  employeeId: string;
  date: string;
  kind: AttendanceCorrectionKind;
  /** Local wall-clock time "HH:mm" in the employee's timezone. */
  clockIn?: string;
  clockOut?: string;
  /** Clock-out falls on the next calendar day (overnight shift). */
  clockOutNextDay?: boolean;
  status?: AttendanceStatus;
  /** flag_approval only: replace device punch times with server sync times. */
  useServerTime?: boolean;
  reason: string;
  /** Apply immediately when the caller can approve; otherwise a pending request is created. */
  applyNow?: boolean;
}
