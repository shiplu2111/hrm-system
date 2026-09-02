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
}
