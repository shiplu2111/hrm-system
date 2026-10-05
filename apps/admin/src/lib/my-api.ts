/**
 * Self-service ("My Space") API calls for the signed-in user's own employee record.
 * Every endpoint here is marked `@SelfService()` on the API, so own-scope roles can use it.
 */
import type {
  AttendanceCaptureInput,
  AttendanceDayRecord,
  EmployeeDashboardView,
  EmployeeDirectoryEntry,
  EmployeeKudosRecord,
  EmployeeRecord,
  EngagementSurveyAnswerInput,
  EngagementSurveyRecord,
  LeaveBalanceRecord,
  LeaveRequestPreview,
  LeaveRequestPreviewInput,
  LeaveRequestRecord,
  LeaveTypeRecord,
  PayslipRecord,
  RosterRecord,
} from '@hrm/shared-types';
import { portalDownload } from '@hrm/portal-ui';
import { tenantApiRequest } from './tenant-api-client';

export type AttendanceAction = 'clock-in' | 'clock-out' | 'break-start' | 'break-end';

export function getMyProfile(employeeId: string): Promise<EmployeeRecord> {
  return tenantApiRequest<EmployeeRecord>(`/employees/${employeeId}`);
}

export function getMyDashboard(employeeId: string): Promise<EmployeeDashboardView> {
  return tenantApiRequest<EmployeeDashboardView>(`/employees/${employeeId}/dashboard`);
}

export function getAttendanceToday(employeeId: string, date?: string): Promise<AttendanceDayRecord> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return tenantApiRequest<AttendanceDayRecord>(`/employees/${employeeId}/attendance/today${query}`);
}

export function runAttendanceAction(
  employeeId: string,
  action: AttendanceAction,
  input: AttendanceCaptureInput = { source: 'manual' },
): Promise<AttendanceDayRecord> {
  return tenantApiRequest<AttendanceDayRecord>(`/employees/${employeeId}/attendance/${action}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listLeaveTypes(companyId: string): Promise<LeaveTypeRecord[]> {
  return tenantApiRequest<LeaveTypeRecord[]>(`/companies/${companyId}/leave-types`);
}

export function getLeaveBalances(employeeId: string): Promise<LeaveBalanceRecord[]> {
  return tenantApiRequest<LeaveBalanceRecord[]>(`/employees/${employeeId}/leave-balances`);
}

export function listMyLeaveRequests(companyId: string, employeeId: string): Promise<LeaveRequestRecord[]> {
  const qs = `?employeeId=${encodeURIComponent(employeeId)}&pageSize=100`;
  return tenantApiRequest<LeaveRequestRecord[]>(`/companies/${companyId}/leave-requests${qs}`);
}

export function previewLeaveRequest(
  employeeId: string,
  input: LeaveRequestPreviewInput,
  signal?: AbortSignal,
): Promise<LeaveRequestPreview> {
  return tenantApiRequest<LeaveRequestPreview>(`/employees/${employeeId}/leave-requests/preview`, {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  });
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
  return tenantApiRequest<LeaveRequestRecord>(`/employees/${employeeId}/leave-requests`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function cancelLeaveRequest(requestId: string): Promise<LeaveRequestRecord> {
  return tenantApiRequest<LeaveRequestRecord>(`/leave-requests/${requestId}/cancel`, { method: 'POST' });
}

export function listMyRosters(
  companyId: string,
  employeeId: string,
  query?: { from?: string; to?: string },
): Promise<RosterRecord[]> {
  const params = new URLSearchParams({ employeeId });
  if (query?.from) params.set('from', query.from);
  if (query?.to) params.set('to', query.to);
  return tenantApiRequest<RosterRecord[]>(`/companies/${companyId}/rosters?${params.toString()}`);
}

export function listMyPayslips(employeeId: string): Promise<PayslipRecord[]> {
  return tenantApiRequest<PayslipRecord[]>(`/employees/${employeeId}/payslips`);
}

export function downloadMyPayslip(downloadUrl: string): Promise<void> {
  return portalDownload('admin', downloadUrl, 'payslip.pdf');
}

export function getEngagementSurvey(employeeId: string, surveyId: string): Promise<EngagementSurveyRecord> {
  return tenantApiRequest<EngagementSurveyRecord>(`/employees/${employeeId}/engagement/surveys/${surveyId}`);
}

export function submitEngagementSurveyResponse(
  employeeId: string,
  surveyId: string,
  answers: EngagementSurveyAnswerInput[],
): Promise<{ submitted: true }> {
  return tenantApiRequest<{ submitted: true }>(
    `/employees/${employeeId}/engagement/surveys/${surveyId}/responses`,
    { method: 'POST', body: JSON.stringify({ answers }) },
  );
}

export function createEmployeeKudos(
  employeeId: string,
  input: { toEmployeeId: string; message: string },
): Promise<EmployeeKudosRecord> {
  return tenantApiRequest<EmployeeKudosRecord>(`/employees/${employeeId}/engagement/kudos`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listColleagues(companyId: string): Promise<EmployeeDirectoryEntry[]> {
  return tenantApiRequest<EmployeeDirectoryEntry[]>(`/companies/${companyId}/employee-directory`);
}

export function formatAttendanceMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}
