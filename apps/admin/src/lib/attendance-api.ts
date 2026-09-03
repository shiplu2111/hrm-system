import type {
  AttendanceCaptureInput,
  AttendanceDayRecord,
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
