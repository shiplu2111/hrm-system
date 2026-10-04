import {
  WORKFLOW_AMOUNT_ENTITY_TYPES,
  WORKFLOW_ROUTING_MODES,
  type WorkflowDefinitionRecord,
  type WorkflowDefinitionStep,
  type WorkflowEntityType,
  type WorkflowStepCondition,
  type WorkflowTriggerConfig,
} from '@hrm/shared-types';
import { formatMoney } from './payroll-copy';
import { tenantApiRequest } from './tenant-api-client';

export interface SaveWorkflowDefinitionInput {
  entityType: WorkflowEntityType;
  name: string;
  description?: string | null;
  triggerConfig?: WorkflowTriggerConfig | null;
  steps: WorkflowDefinitionStep[];
  isDefault?: boolean;
  isActive?: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

interface WorkflowModuleInfo {
  label: string;
  /** Noun for one request in this module, e.g. "expense claim". */
  request: string;
  requests: string;
  /** Approval chain used when no workflow applies (mirrors the API's built-in defaults). */
  builtInSteps: string[];
}

export const WORKFLOW_MODULES: Record<WorkflowEntityType, WorkflowModuleInfo> = {
  expense_claim: {
    label: 'Expense claims',
    request: 'expense claim',
    requests: 'expense claims',
    builtInSteps: ["Requester's manager", 'Accountant'],
  },
  timesheet_entry: {
    label: 'Timesheets',
    request: 'timesheet entry',
    requests: 'timesheet entries',
    builtInSteps: ["Requester's manager"],
  },
  contract: {
    label: 'Contract renewals',
    request: 'contract renewal',
    requests: 'contract renewals',
    builtInSteps: ["Requester's manager", 'HR Admin'],
  },
  job_requisition: {
    label: 'Job requisitions',
    request: 'job requisition',
    requests: 'job requisitions',
    builtInSteps: ['HR Admin'],
  },
  offer_letter: {
    label: 'Offer letters',
    request: 'offer letter',
    requests: 'offer letters',
    builtInSteps: ['HR Admin', 'Company Owner'],
  },
  performance_review: {
    label: 'Performance reviews',
    request: 'performance review',
    requests: 'performance reviews',
    builtInSteps: ["Requester's manager", "Manager's manager", 'HR Admin'],
  },
  leave_request: {
    label: 'Leave requests',
    request: 'leave request',
    requests: 'leave requests',
    builtInSteps: [],
  },
  payroll_adjustment: {
    label: 'Payroll adjustments',
    request: 'payroll adjustment',
    requests: 'payroll adjustments',
    builtInSteps: [],
  },
};

export const WORKFLOW_MODULE_ORDER: WorkflowEntityType[] = [
  'expense_claim',
  'timesheet_entry',
  'contract',
  'job_requisition',
  'offer_letter',
  'performance_review',
  'leave_request',
  'payroll_adjustment',
];

export function isConnectedModule(entityType: WorkflowEntityType): boolean {
  const mode = WORKFLOW_ROUTING_MODES[entityType];
  return mode === 'amount_match' || mode === 'default_only';
}

export function supportsAmounts(entityType: WorkflowEntityType): boolean {
  return WORKFLOW_AMOUNT_ENTITY_TYPES.includes(entityType);
}

/** One sentence on how the module picks the workflow a new request follows. */
export function moduleRoutingText(entityType: WorkflowEntityType): string {
  switch (WORKFLOW_ROUTING_MODES[entityType]) {
    case 'amount_match':
      return 'A new claim follows the workflow with the highest amount trigger it passes; otherwise it follows the default workflow.';
    case 'default_only':
      return `New ${WORKFLOW_MODULES[entityType].requests} follow the default workflow; other workflows here are kept but not used.`;
    case 'leave_policy':
      return 'Leave requests follow the approval steps set on each leave policy, so workflows here are not applied.';
    default:
      return `${WORKFLOW_MODULES[entityType].label} don't go through approval workflows yet, so workflows here are not applied.`;
  }
}

export function entityTypeLabel(entityType: WorkflowEntityType): string {
  return WORKFLOW_MODULES[entityType]?.label ?? entityType;
}

export function stepApproverLabel(step: Pick<WorkflowDefinitionStep, 'assigneeType' | 'roleName'>): string {
  if (step.assigneeType === 'direct_manager') return "Requester's manager";
  if (step.assigneeType === 'skip_level_manager') return "Manager's manager";
  return step.roleName;
}

export function amountComparisonText(operator: 'gt' | 'gte' | undefined, value: number): string {
  return `${operator === 'gte' ? 'at least' : 'over'} ${formatMoney(value)}`;
}

export function stepConditionText(condition: WorkflowStepCondition): string {
  return `Only when the amount is ${amountComparisonText(condition.operator, condition.value)}`;
}

export function formatWorkflowTrigger(
  entityType: WorkflowEntityType,
  trigger: WorkflowTriggerConfig | null,
): string {
  if (trigger?.type === 'amount_threshold' && trigger.value != null) {
    return `${WORKFLOW_MODULES[entityType].label} ${amountComparisonText(trigger.operator, trigger.value)}`;
  }
  return `Every ${WORKFLOW_MODULES[entityType].request}`;
}

export function matchesAmount(
  amount: number,
  rule: { operator?: 'gt' | 'gte'; value?: number },
): boolean {
  const threshold = rule.value ?? 0;
  return rule.operator === 'gte' ? amount >= threshold : amount > threshold;
}

export function listWorkflowDefinitions(companyId: string): Promise<WorkflowDefinitionRecord[]> {
  return tenantApiRequest<WorkflowDefinitionRecord[]>(`/companies/${companyId}/workflow-definitions`);
}

export function getWorkflowDefinition(
  companyId: string,
  definitionId: string,
): Promise<WorkflowDefinitionRecord> {
  return tenantApiRequest<WorkflowDefinitionRecord>(
    `/companies/${companyId}/workflow-definitions/${definitionId}`,
  );
}

export function createWorkflowDefinition(
  companyId: string,
  input: SaveWorkflowDefinitionInput,
): Promise<WorkflowDefinitionRecord> {
  return tenantApiRequest<WorkflowDefinitionRecord>(`/companies/${companyId}/workflow-definitions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateWorkflowDefinition(
  companyId: string,
  definitionId: string,
  input: Partial<SaveWorkflowDefinitionInput>,
): Promise<WorkflowDefinitionRecord> {
  return tenantApiRequest<WorkflowDefinitionRecord>(
    `/companies/${companyId}/workflow-definitions/${definitionId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteWorkflowDefinition(companyId: string, definitionId: string): Promise<void> {
  return tenantApiRequest<void>(`/companies/${companyId}/workflow-definitions/${definitionId}`, {
    method: 'DELETE',
  });
}

export interface WorkflowTemplate {
  key: string;
  label: string;
  input: Omit<SaveWorkflowDefinitionInput, 'effectiveFrom'>;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: 'expense-owner-over-1000',
    label: 'Expenses: owner signs off claims over 1,000',
    input: {
      entityType: 'expense_claim',
      name: 'Expense Approval',
      description: 'Manager and Accountant for every claim; Company Owner as well when the claim is over 1,000',
      triggerConfig: { type: 'always' },
      steps: [
        { order: 1, assigneeType: 'direct_manager', roleName: 'Manager' },
        { order: 2, assigneeType: 'role', roleName: 'Accountant' },
        {
          order: 3,
          assigneeType: 'role',
          roleName: 'Company Owner',
          condition: { type: 'amount_threshold', operator: 'gt', value: 1000 },
        },
      ],
      isDefault: true,
      isActive: true,
    },
  },
  {
    key: 'expense-high-value',
    label: 'Expenses: separate chain for claims over 1,000',
    input: {
      entityType: 'expense_claim',
      name: 'High-Value Expense Approval',
      description: 'Extra owner sign-off for claims over 1,000',
      triggerConfig: { type: 'amount_threshold', operator: 'gt', value: 1000 },
      steps: [
        { order: 1, assigneeType: 'direct_manager', roleName: 'Manager' },
        { order: 2, assigneeType: 'role', roleName: 'Accountant' },
        { order: 3, assigneeType: 'role', roleName: 'Company Owner' },
      ],
      isDefault: false,
      isActive: true,
    },
  },
  {
    key: 'contract-renewal',
    label: 'Contract renewals: manager then HR',
    input: {
      entityType: 'contract',
      name: 'Contract Renewal Approval',
      description: "Requester's manager, then HR Admin",
      triggerConfig: { type: 'always' },
      steps: [
        { order: 1, assigneeType: 'direct_manager', roleName: 'Manager' },
        { order: 2, assigneeType: 'role', roleName: 'HR Admin' },
      ],
      isDefault: true,
      isActive: true,
    },
  },
  {
    key: 'performance-review',
    label: 'Performance reviews: manager, skip-level, HR',
    input: {
      entityType: 'performance_review',
      name: 'Performance Review Sign-off',
      description: "Manager, manager's manager, then HR Admin",
      triggerConfig: { type: 'always' },
      steps: [
        { order: 1, assigneeType: 'direct_manager', roleName: 'Manager' },
        { order: 2, assigneeType: 'skip_level_manager', roleName: 'Skip-level Manager' },
        { order: 3, assigneeType: 'role', roleName: 'HR Admin' },
      ],
      isDefault: true,
      isActive: true,
    },
  },
];
