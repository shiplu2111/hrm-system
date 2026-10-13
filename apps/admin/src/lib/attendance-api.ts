import type {
  AttendanceCaptureInput,
  AttendanceDayRecord,
  AttendancePhase,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function getAttendanceToday(
  employeeId: string,
  date?: string,
): Promise<AttendanceDayRecord> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return tenantApiRequest<AttendanceDayRecord>(
    `/employees/${employeeId}/attendance/today${query}`,
  );
}

export function clockIn(
  employeeId: string,
  input: AttendanceCaptureInput = {},
): Promise<AttendanceDayRecord> {
  return tenantApiRequest<AttendanceDayRecord>(
    `/employees/${employeeId}/attendance/clock-in`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function clockOut(
  employeeId: string,
  input: AttendanceCaptureInput = {},
): Promise<AttendanceDayRecord> {
  return tenantApiRequest<AttendanceDayRecord>(
    `/employees/${employeeId}/attendance/clock-out`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function breakStart(
  employeeId: string,
  input: AttendanceCaptureInput = {},
): Promise<AttendanceDayRecord> {
  return tenantApiRequest<AttendanceDayRecord>(
    `/employees/${employeeId}/attendance/break-start`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function breakEnd(
  employeeId: string,
  input: AttendanceCaptureInput = {},
): Promise<AttendanceDayRecord> {
  return tenantApiRequest<AttendanceDayRecord>(
    `/employees/${employeeId}/attendance/break-end`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export { formatMinutes as formatAttendanceMinutes };

export interface BreakItemInput {
  startAt: string;
  endAt?: string | null;
}

export interface AttendanceCorrectionInput {
  date: string;
  clockInAt?: string | null;
  clockOutAt?: string | null;
  status?: string;
  reason: string;
  breaks?: BreakItemInput[];
}

export interface AttendanceCorrectionRecord {
  id: string;
  date: string;
  reason: string;
  status: string;
  kind: string;
  originalValues: {
    clockInAt?: string | null;
    clockOutAt?: string | null;
    status?: string | null;
    source?: string | null;
    breaks?: Array<{ id?: string; startAt: string; endAt: string | null }>;
  };
  requestedClockInAt: string | null;
  requestedClockOutAt: string | null;
  requestedStatus: string | null;
  requestedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
}

export interface AttendanceCorrectionResponse {
  attendance: AttendanceDayRecord;
  correction: AttendanceCorrectionRecord;
}

export function correctAttendance(
  employeeId: string,
  input: AttendanceCorrectionInput,
): Promise<AttendanceCorrectionResponse> {
  return tenantApiRequest<AttendanceCorrectionResponse>(
    `/employees/${employeeId}/attendance/correct`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function getAttendanceCorrections(
  employeeId: string,
  date?: string,
): Promise<AttendanceCorrectionRecord[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return tenantApiRequest<AttendanceCorrectionRecord[]>(
    `/employees/${employeeId}/attendance/corrections${query}`,
  );
}

export interface DailyAttendanceRow {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    department: { id: string; name: string } | null;
    designation: { id: string; title: string } | null;
    employmentStatus: string;
  };
  attendance: {
    id: string | null;
    employeeId: string;
    date: string;
    clockInAt: string | null;
    clockOutAt: string | null;
    status: string;
    source: string | null;
    shift: {
      id: string;
      name: string;
      startTime: string;
      endTime: string;
      breakMinutes: number;
      graceMinutes: number;
      standardMinutes: number;
    };
    breaks: Array<{ id: string; startAt: string; endAt: string | null }>;
    metrics: {
      grossMinutes: number;
      breakMinutes: number;
      netMinutes: number;
      standardMinutes: number;
      overtimeMinutes: number;
      isLate: boolean;
      lateMinutes: number;
      isEarlyLeave: boolean;
      earlyLeaveMinutes: number;
      phase: AttendancePhase;
    };
  };
}

export interface DailyAttendanceKpis {
  totalStaff: number;
  present: number;
  late: number;
  earlyLeave: number;
  onBreak: number;
  absent: number;
  onLeave: number;
}

export interface CompanyDailyAttendanceResponse {
  date: string;
  kpis: DailyAttendanceKpis;
  rows: DailyAttendanceRow[];
}

export function getCompanyDailyAttendance(
  companyId: string,
  date?: string,
): Promise<CompanyDailyAttendanceResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return tenantApiRequest<CompanyDailyAttendanceResponse>(
    `/companies/${companyId}/attendance/daily${query}`,
  );
}
