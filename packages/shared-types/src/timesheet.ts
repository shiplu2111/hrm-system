import type { WorkflowInstanceRecord } from './workflow';

export type TimesheetEntryStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type TimesheetSyncEventType = 'log_entry' | 'submit_entry';

export interface TimesheetProjectRecord {
  id: string;
  tenantId: string;
  companyId: string;
  name: string;
  code: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetEntryRecord {
  id: string;
  tenantId: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  employeeNumber?: string;
  localId: string | null;
  projectId: string;
  projectName?: string;
  entryDate: string;
  taskName: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  totalHours: number;
  isBillable: boolean;
  billableHours: number;
  nonBillableHours: number;
  status: TimesheetEntryStatus;
  displayStatus: string;
  timeAnomaly: boolean;
  notes: string | null;
  source: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  workflow: WorkflowInstanceRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetSyncEventDTO {
  local_id: string;
  employee_id: string;
  type: TimesheetSyncEventType;
  timestamp_device: string;
  entry_date: string;
  project_id: string;
  task_name: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  is_billable?: boolean;
  notes?: string;
  offline_duration_seconds?: number;
  /** For submit_entry — references prior log_entry local_id */
  entry_local_id?: string;
}

export type TimesheetSyncResultStatus = 'created' | 'duplicate' | 'rejected';

export interface TimesheetSyncItemResult {
  local_id: string;
  status: TimesheetSyncResultStatus;
  server_id?: string;
  reason?: string;
}

export interface TimesheetSyncBatchRequest {
  deviceId: string;
  events: TimesheetSyncEventDTO[];
}

export interface TimesheetSyncBatchResponse {
  results: TimesheetSyncItemResult[];
}
