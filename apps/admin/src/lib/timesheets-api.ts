import type {
  TimesheetApprovalQueue,
  TimesheetApprovalScope,
  TimesheetBulkAction,
  TimesheetBulkActionResult,
  TimesheetEntryRecord,
  TimesheetEntryStatus,
  TimesheetProjectRecord,
  WorkflowApprovalRoute,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export interface CreateTimesheetProjectInput {
  name: string;
  code?: string;
  isActive?: boolean;
}

export interface CreateTimesheetEntryInput {
  employeeId: string;
  projectId: string;
  entryDate: string;
  taskName: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  isBillable?: boolean;
  notes?: string;
  submit?: boolean;
}

export interface TimesheetFilters {
  employeeId?: string;
  projectId?: string;
  fromDate?: string;
  toDate?: string;
}

function toQuery(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function listTimesheetProjects(
  companyId: string,
): Promise<TimesheetProjectRecord[]> {
  return tenantApiRequest<TimesheetProjectRecord[]>(
    `/companies/${companyId}/timesheet-projects`,
  );
}

export function createTimesheetProject(
  companyId: string,
  input: CreateTimesheetProjectInput,
): Promise<TimesheetProjectRecord> {
  return tenantApiRequest<TimesheetProjectRecord>(
    `/companies/${companyId}/timesheet-projects`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listTimesheetEntries(
  companyId: string,
  query?: TimesheetFilters & { status?: TimesheetEntryStatus },
): Promise<TimesheetEntryRecord[]> {
  return tenantApiRequest<TimesheetEntryRecord[]>(
    `/companies/${companyId}/timesheet-entries${toQuery({ ...query })}`,
  );
}

export function listTimesheetApprovals(
  companyId: string,
  query?: TimesheetFilters & { scope?: TimesheetApprovalScope },
): Promise<TimesheetApprovalQueue> {
  return tenantApiRequest<TimesheetApprovalQueue>(
    `/companies/${companyId}/timesheet-approvals${toQuery({ ...query })}`,
  );
}

export function getTimesheetApprovalRoute(companyId: string): Promise<WorkflowApprovalRoute> {
  return tenantApiRequest<WorkflowApprovalRoute>(
    `/companies/${companyId}/timesheet-approval-route`,
  );
}

export function createTimesheetEntry(
  companyId: string,
  input: CreateTimesheetEntryInput,
): Promise<TimesheetEntryRecord> {
  return tenantApiRequest<TimesheetEntryRecord>(
    `/companies/${companyId}/timesheet-entries`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function submitTimesheetEntry(
  entryId: string,
): Promise<TimesheetEntryRecord> {
  return tenantApiRequest<TimesheetEntryRecord>(
    `/timesheet-entries/${entryId}/submit`,
    { method: 'POST' },
  );
}

export function approveTimesheetEntry(
  entryId: string,
  comment?: string,
): Promise<TimesheetEntryRecord> {
  return tenantApiRequest<TimesheetEntryRecord>(
    `/timesheet-entries/${entryId}/approve`,
    { method: 'POST', body: JSON.stringify({ comment }) },
  );
}

export function rejectTimesheetEntry(
  entryId: string,
  reason: string,
): Promise<TimesheetEntryRecord> {
  return tenantApiRequest<TimesheetEntryRecord>(
    `/timesheet-entries/${entryId}/reject`,
    { method: 'POST', body: JSON.stringify({ comment: reason }) },
  );
}

export function bulkTimesheetAction(
  companyId: string,
  input: { action: TimesheetBulkAction; entryIds: string[]; comment?: string },
): Promise<TimesheetBulkActionResult> {
  return tenantApiRequest<TimesheetBulkActionResult>(
    `/companies/${companyId}/timesheet-entries/bulk-action`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}
