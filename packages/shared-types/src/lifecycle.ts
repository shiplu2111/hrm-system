/** Employee lifecycle event types (MODULES.md §05) */

export type LifecycleEventType =
  | 'promotion'
  | 'transfer'
  | 'salary_revision'
  | 'probation'
  | 'confirmation'
  | 'suspension'
  | 'resignation'
  | 'termination'
  | 'rehire';

export interface LifecycleEventRecord {
  id: string;
  employeeId: string;
  eventType: LifecycleEventType;
  effectiveDate: string;
  details: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLifecycleEventInput {
  eventType: LifecycleEventType;
  effectiveDate: string;
  details: Record<string, unknown>;
}
