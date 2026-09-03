import type {
  AttendanceCaptureInput,
  AttendanceDayRecord,
  EmployeeRecord,
  LeaveBalanceRecord,
  LeaveRequestRecord,
  LeaveTypeRecord,
  RosterRecord,
} from '@hrm/shared-types';
import { portalApiRequest } from '@hrm/portal-ui';

const PORTAL = 'employee' as const;

export function getEmployeeProfile(employeeId: string): Promise<EmployeeRecord> {
  return portalApiRequest<EmployeeRecord>(PORTAL, `/employees/${employeeId}`);
}

export function getAttendanceToday(
  employeeId: string,
  date?: string,
): Promise<AttendanceDayRecord> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return portalApiRequest<AttendanceDayRecord>(
    PORTAL,
    `/employees/${employeeId}/attendance/today${query}`,
  );
}

export function clockIn(
  employeeId: string,
  input: AttendanceCaptureInput = {},
): Promise<AttendanceDayRecord> {
  return portalApiRequest<AttendanceDayRecord>(
    PORTAL,
    `/employees/${employeeId}/attendance/clock-in`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function clockOut(
  employeeId: string,
  input: AttendanceCaptureInput = {},
): Promise<AttendanceDayRecord> {
  return portalApiRequest<AttendanceDayRecord>(
    PORTAL,
    `/employees/${employeeId}/attendance/clock-out`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function breakStart(
  employeeId: string,
  input: AttendanceCaptureInput = {},
): Promise<AttendanceDayRecord> {
  return portalApiRequest<AttendanceDayRecord>(
    PORTAL,
    `/employees/${employeeId}/attendance/break-start`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function breakEnd(
  employeeId: string,
  input: AttendanceCaptureInput = {},
): Promise<AttendanceDayRecord> {
  return portalApiRequest<AttendanceDayRecord>(
    PORTAL,
    `/employees/${employeeId}/attendance/break-end`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listLeaveTypes(companyId: string): Promise<LeaveTypeRecord[]> {
  return portalApiRequest<LeaveTypeRecord[]>(
    PORTAL,
    `/companies/${companyId}/leave-types`,
  );
}

export function getLeaveBalances(employeeId: string): Promise<LeaveBalanceRecord[]> {
  return portalApiRequest<LeaveBalanceRecord[]>(
    PORTAL,
    `/employees/${employeeId}/leave-balances`,
  );
}

export function listLeaveRequests(
  companyId: string,
  employeeId: string,
): Promise<LeaveRequestRecord[]> {
  const qs = `?employeeId=${encodeURIComponent(employeeId)}`;
  return portalApiRequest<LeaveRequestRecord[]>(
    PORTAL,
    `/companies/${companyId}/leave-requests${qs}`,
  );
}

export function createLeaveRequest(
  employeeId: string,
  input: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    halfDay?: boolean;
    reason?: string;
    submit?: boolean;
  },
): Promise<LeaveRequestRecord> {
  return portalApiRequest<LeaveRequestRecord>(
    PORTAL,
    `/employees/${employeeId}/leave-requests`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listRosters(
  companyId: string,
  employeeId: string,
  query?: { from?: string; to?: string },
): Promise<RosterRecord[]> {
  const params = new URLSearchParams({ employeeId });
  if (query?.from) params.set('from', query.from);
  if (query?.to) params.set('to', query.to);
  return portalApiRequest<RosterRecord[]>(
    PORTAL,
    `/companies/${companyId}/rosters?${params.toString()}`,
  );
}

export function formatAttendanceMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}
