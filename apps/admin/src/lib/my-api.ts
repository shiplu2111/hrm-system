/**
 * Self-service ("My Space") API calls for the signed-in user's own employee record.
 * Every endpoint here is marked `@SelfService()` on the API, so own-scope roles can use it.
 */
import type {
  AttendanceCaptureInput,
  AttendanceDayRecord,
  CreateOvertimeRequestInput,
  CreateProfileUpdateRequestInput,
  CreateShiftSwapRequestInput,
  DocumentTypeRecord,
  EmployeeAttendanceHistoryView,
  EmployeeDashboardView,
  EmployeeDirectoryEntry,
  EmployeeDocumentRecord,
  EmployeeKudosRecord,
  EmployeeRecord,
  EngagementSurveyAnswerInput,
  EngagementSurveyRecord,
  LeaveBalanceRecord,
  LeaveRequestPreview,
  LeaveRequestPreviewInput,
  LeaveRequestRecord,
  LeaveTypeRecord,
  OvertimeRequestRecord,
  PayslipRecord,
  ProfileUpdateRequestRecord,
  RosterRecord,
  ShiftSwapRequestRecord,
  SubmitAttendanceCorrectionInput,
  UpdateSelfProfileInput,
  WorkflowApprovalRoute,
} from '@hrm/shared-types';
import { portalDownload } from '@hrm/portal-ui';
import type { AttendanceCorrectionRecord } from './attendance-api';
import { fetchTenantFile, type DownloadedFile } from './download';
import {
  createEmployeeDocument,
  uploadEmployeeDocumentFile,
} from './employee-documents-api';
import { tenantApiRequest } from './tenant-api-client';

export type AttendanceAction = 'clock-in' | 'clock-out' | 'break-start' | 'break-end';

export function getMyProfile(employeeId: string): Promise<EmployeeRecord> {
  return tenantApiRequest<EmployeeRecord>(`/employees/${employeeId}`);
}

export function updateMySelfProfile(
  employeeId: string,
  input: UpdateSelfProfileInput,
): Promise<EmployeeRecord> {
  return tenantApiRequest<EmployeeRecord>(`/employees/${employeeId}/self-profile`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listMyProfileUpdateRequests(
  employeeId: string,
): Promise<ProfileUpdateRequestRecord[]> {
  return tenantApiRequest<ProfileUpdateRequestRecord[]>(
    `/employees/${employeeId}/profile-update-requests`,
  );
}

export function createMyProfileUpdateRequest(
  employeeId: string,
  input: CreateProfileUpdateRequestInput,
): Promise<ProfileUpdateRequestRecord> {
  return tenantApiRequest<ProfileUpdateRequestRecord>(
    `/employees/${employeeId}/profile-update-requests`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function cancelMyProfileUpdateRequest(
  requestId: string,
): Promise<ProfileUpdateRequestRecord> {
  return tenantApiRequest<ProfileUpdateRequestRecord>(
    `/profile-update-requests/${requestId}/cancel`,
    { method: 'POST' },
  );
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

export function getMyAttendanceHistory(
  employeeId: string,
  from: string,
  to: string,
): Promise<EmployeeAttendanceHistoryView> {
  const qs = new URLSearchParams({ from, to }).toString();
  return tenantApiRequest<EmployeeAttendanceHistoryView>(
    `/employees/${employeeId}/attendance/history?${qs}`,
  );
}

export function getMyAttendanceCorrections(
  employeeId: string,
  date?: string,
): Promise<AttendanceCorrectionRecord[]> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  return tenantApiRequest<AttendanceCorrectionRecord[]>(
    `/employees/${employeeId}/attendance/corrections${qs}`,
  );
}

export function submitMyAttendanceCorrection(
  employeeId: string,
  input: SubmitAttendanceCorrectionInput,
): Promise<AttendanceCorrectionRecord> {
  return tenantApiRequest<AttendanceCorrectionRecord>(
    `/employees/${employeeId}/attendance/corrections`,
    { method: 'POST', body: JSON.stringify(input) },
  );
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

export function getShiftSwapApprovalRoute(companyId: string): Promise<WorkflowApprovalRoute> {
  return tenantApiRequest<WorkflowApprovalRoute>(
    `/companies/${companyId}/shift-swap-requests/approval-route`,
  );
}

export function listMyShiftSwaps(
  companyId: string,
  employeeId: string,
): Promise<ShiftSwapRequestRecord[]> {
  const params = new URLSearchParams({ employeeId });
  return tenantApiRequest<ShiftSwapRequestRecord[]>(
    `/companies/${companyId}/shift-swap-requests?${params.toString()}`,
  );
}

export function createMyShiftSwap(
  employeeId: string,
  input: CreateShiftSwapRequestInput,
): Promise<ShiftSwapRequestRecord> {
  return tenantApiRequest<ShiftSwapRequestRecord>(
    `/employees/${employeeId}/shift-swap-requests`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function cancelMyShiftSwap(requestId: string): Promise<ShiftSwapRequestRecord> {
  return tenantApiRequest<ShiftSwapRequestRecord>(
    `/shift-swap-requests/${requestId}/cancel`,
    { method: 'POST' },
  );
}

export function getOvertimeApprovalRoute(companyId: string): Promise<WorkflowApprovalRoute> {
  return tenantApiRequest<WorkflowApprovalRoute>(
    `/companies/${companyId}/overtime-requests/approval-route`,
  );
}

export function listMyOvertimeRequests(
  companyId: string,
  employeeId: string,
): Promise<OvertimeRequestRecord[]> {
  const params = new URLSearchParams({ employeeId });
  return tenantApiRequest<OvertimeRequestRecord[]>(
    `/companies/${companyId}/overtime-requests?${params.toString()}`,
  );
}

export function createMyOvertimeRequest(
  employeeId: string,
  input: CreateOvertimeRequestInput,
): Promise<OvertimeRequestRecord> {
  return tenantApiRequest<OvertimeRequestRecord>(
    `/employees/${employeeId}/overtime-requests`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function cancelMyOvertimeRequest(requestId: string): Promise<OvertimeRequestRecord> {
  return tenantApiRequest<OvertimeRequestRecord>(
    `/overtime-requests/${requestId}/cancel`,
    { method: 'POST' },
  );
}

export function listMyPayslips(employeeId: string): Promise<PayslipRecord[]> {
  return tenantApiRequest<PayslipRecord[]>(`/employees/${employeeId}/payslips`);
}

export function downloadMyPayslip(downloadUrl: string, filename = 'payslip.pdf'): Promise<void> {
  return portalDownload('admin', downloadUrl, filename);
}

export function listMyDocumentTypes(companyId: string): Promise<DocumentTypeRecord[]> {
  return tenantApiRequest<DocumentTypeRecord[]>(
    `/organization/companies/${companyId}/document-types`,
  );
}

export function listMyDocuments(employeeId: string): Promise<EmployeeDocumentRecord[]> {
  return tenantApiRequest<EmployeeDocumentRecord[]>(`/employees/${employeeId}/documents`);
}

export { createEmployeeDocument as createMyDocument, uploadEmployeeDocumentFile as uploadMyDocumentFile };

export function updateMyDocument(
  employeeId: string,
  documentId: string,
  input: { fields?: Record<string, unknown>; expiryDate?: string | null },
): Promise<EmployeeDocumentRecord> {
  return tenantApiRequest<EmployeeDocumentRecord>(
    `/employees/${employeeId}/documents/${documentId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function fetchMyDocumentFile(
  employeeId: string,
  documentId: string,
): Promise<DownloadedFile> {
  return fetchTenantFile(`/employees/${employeeId}/documents/${documentId}/download`, {
    filename: 'document',
    errorMessage: (status) => `Could not load document file (${status})`,
  });
}

export function downloadMyDocument(
  employeeId: string,
  documentId: string,
  filename = 'document',
): Promise<void> {
  return portalDownload(
    'admin',
    `/employees/${employeeId}/documents/${documentId}/download`,
    filename,
  );
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
