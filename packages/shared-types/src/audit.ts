/** Audit log viewer — AUDIT_LOG.md §2, §5 */

export type AuditLogAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'finalize'
  | 'reject'
  | 'suspend'
  | 'restore';

export interface AuditLogActor {
  id: string;
  name: string | null;
  email: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: AuditLogAction;
  module: string;
  recordId: string;
  actor: AuditLogActor;
  /** Sensitive keys are redacted or masked by the API (AUDIT_LOG.md §3). */
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  device: string | null;
  createdAt: string;
}

export interface AuditLogQuery {
  module?: string;
  userId?: string;
  recordId?: string;
  action?: AuditLogAction;
  /** Inclusive lower bound, ISO 8601 date-time. */
  from?: string;
  /** Exclusive upper bound, ISO 8601 date-time. */
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogFilterOptions {
  modules: string[];
  actors: AuditLogActor[];
}
