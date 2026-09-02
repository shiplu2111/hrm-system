import type { SyncableRecord } from './common';

export type LeaveRequestStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface LeaveRequestDTO extends SyncableRecord {
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  status: LeaveRequestStatus;
}
