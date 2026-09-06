import type {
  TimesheetEntryRecord,
  TimesheetEntryStatus,
  TimesheetProjectRecord,
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
  query?: {
    employeeId?: string;
    status?: TimesheetEntryStatus;
    fromDate?: string;
    toDate?: string;
  },
): Promise<TimesheetEntryRecord[]> {
  const params = new URLSearchParams();
  if (query?.employeeId) params.set('employeeId', query.employeeId);
  if (query?.status) params.set('status', query.status);
  if (query?.fromDate) params.set('fromDate', query.fromDate);
  if (query?.toDate) params.set('toDate', query.toDate);
  const qs = params.toString();
  return tenantApiRequest<TimesheetEntryRecord[]>(
    `/companies/${companyId}/timesheet-entries${qs ? `?${qs}` : ''}`,
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
  comment?: string,
): Promise<TimesheetEntryRecord> {
  return tenantApiRequest<TimesheetEntryRecord>(
    `/timesheet-entries/${entryId}/reject`,
    { method: 'POST', body: JSON.stringify({ comment }) },
  );
}
