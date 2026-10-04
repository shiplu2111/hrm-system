export type WorkflowEntityType =
  | 'leave_request'
  | 'expense_claim'
  | 'payroll_adjustment'
  | 'contract'
  | 'timesheet_entry'
  | 'job_requisition'
  | 'offer_letter'
  | 'performance_review';

export type WorkflowAssigneeType = 'role' | 'direct_manager' | 'skip_level_manager';

export type WorkflowInstanceStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type WorkflowStepStatus = 'pending' | 'approved' | 'rejected' | 'skipped';

/** A step that only joins the chain when the request amount passes a threshold. */
export interface WorkflowStepCondition {
  type: 'amount_threshold';
  operator: 'gt' | 'gte';
  value: number;
}

/** Ordered step in a workflow definition template */
export interface WorkflowDefinitionStep {
  order: number;
  assigneeType: WorkflowAssigneeType;
  /** Display label; for role steps must match Role.name (e.g. "HR Admin") */
  roleName: string;
  /** Omitted or null: the step always applies. */
  condition?: WorkflowStepCondition | null;
}

/**
 * How a module chooses which definition a new request follows.
 * - `amount_match`: the highest matching amount trigger wins, else the default "always" workflow.
 * - `default_only`: only the default workflow is used.
 * - `leave_policy`: approval steps come from each leave policy, not from workflow definitions.
 * - `not_connected`: nothing submits requests through workflows yet.
 */
export type WorkflowRoutingMode =
  | 'amount_match'
  | 'default_only'
  | 'leave_policy'
  | 'not_connected';

export const WORKFLOW_ROUTING_MODES: Record<WorkflowEntityType, WorkflowRoutingMode> = {
  expense_claim: 'amount_match',
  timesheet_entry: 'default_only',
  contract: 'default_only',
  job_requisition: 'default_only',
  offer_letter: 'default_only',
  performance_review: 'default_only',
  leave_request: 'leave_policy',
  payroll_adjustment: 'not_connected',
};

/** Modules whose requests carry an amount, so triggers and step conditions can use it. */
export const WORKFLOW_AMOUNT_ENTITY_TYPES: readonly WorkflowEntityType[] = ['expense_claim'];

export const WORKFLOW_MAX_STEPS = 10;

/** Whether new requests would follow this definition today, and why not if they wouldn't. */
export type WorkflowDefinitionRoutingStatus =
  | 'in_use'
  | 'inactive'
  | 'scheduled'
  | 'ended'
  | 'not_default'
  | 'overridden'
  | 'module_not_connected';

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

/** Which approval chain a record goes through (Settings → Approval Workflows). */
export interface WorkflowApprovalRoute {
  definitionId: string | null;
  name: string;
  /** `system_default` when no active workflow is configured for the entity type. */
  source: 'workflow_builder' | 'system_default';
  steps: WorkflowDefinitionStep[];
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
  /** Requests that ever ran on this definition; a used definition can't be deleted. */
  instanceCount: number;
  pendingInstanceCount: number;
  routingStatus: WorkflowDefinitionRoutingStatus;
  /** Set when `routingStatus` is `overridden`: the definition requests go to instead. */
  routingOverriddenBy: { id: string; name: string } | null;
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
