export type WorkflowEntityType =
  | 'leave_request'
  | 'expense_claim'
  | 'payroll_adjustment'
  | 'contract';

export type WorkflowAssigneeType = 'role' | 'direct_manager';

export type WorkflowInstanceStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type WorkflowStepStatus = 'pending' | 'approved' | 'rejected' | 'skipped';

/** Ordered step in a workflow definition template */
export interface WorkflowDefinitionStep {
  order: number;
  assigneeType: WorkflowAssigneeType;
  /** Display label; for role steps must match Role.name (e.g. "HR Admin") */
  roleName: string;
}

/** Optional entry conditions (MODULES.md §35 — amount-based triggers, etc.) */
export interface WorkflowTriggerConfig {
  type: 'always' | 'amount_threshold';
  /** Minimum amount for expense_claim workflows */
  operator?: 'gt' | 'gte';
  value?: number;
  currency?: string;
}

/** Runtime step on a workflow instance */
export interface WorkflowInstanceStep {
  order: number;
  assigneeType: WorkflowAssigneeType;
  roleName: string;
  status: WorkflowStepStatus;
  actedByUserId: string | null;
  actedByEmployeeId: string | null;
  actedAt: string | null;
  comment: string | null;
}

export interface WorkflowDefinitionRecord {
  id: string;
  companyId: string;
  entityType: WorkflowEntityType;
  name: string;
  description: string | null;
  steps: WorkflowDefinitionStep[];
  triggerConfig: WorkflowTriggerConfig | null;
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowInstanceRecord {
  id: string;
  definitionId: string | null;
  companyId: string;
  tenantId: string;
  entityType: WorkflowEntityType;
  entityId: string;
  requesterEmployeeId: string;
  requesterUserId: string | null;
  status: WorkflowInstanceStatus;
  steps: WorkflowInstanceStep[];
  currentStepOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
