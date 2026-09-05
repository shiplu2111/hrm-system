import type {
  WorkflowDefinitionRecord,
  WorkflowDefinitionStep,
  WorkflowEntityType,
  WorkflowTriggerConfig,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export interface SaveWorkflowDefinitionInput {
  entityType: WorkflowEntityType;
  name: string;
  description?: string;
  triggerConfig?: WorkflowTriggerConfig | null;
  steps: WorkflowDefinitionStep[];
  isDefault?: boolean;
  isActive?: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export const ENTITY_TYPE_OPTIONS: Array<{
  value: WorkflowEntityType;
  label: string;
}> = [
  { value: 'leave_request', label: 'Leave Request' },
  { value: 'expense_claim', label: 'Expense Claim' },
  { value: 'payroll_adjustment', label: 'Payroll Adjustment' },
  { value: 'contract', label: 'Contract' },
];

export function entityTypeLabel(entityType: WorkflowEntityType): string {
  return ENTITY_TYPE_OPTIONS.find((o) => o.value === entityType)?.label ?? entityType;
}

export function formatWorkflowTrigger(
  entityType: WorkflowEntityType,
  trigger: WorkflowTriggerConfig | null,
): string {
  if (!trigger || trigger.type === 'always') {
    return `All ${entityTypeLabel(entityType).toLowerCase()}s`;
  }
  if (trigger.type === 'amount_threshold' && trigger.value != null) {
    const op = trigger.operator === 'gte' ? '≥' : '>';
    const currency = trigger.currency ?? '$';
    return `${entityTypeLabel(entityType)} amount ${op} ${currency}${trigger.value.toLocaleString()}`;
  }
  return 'Custom trigger';
}

export function listWorkflowDefinitions(
  companyId: string,
  query?: { entityType?: WorkflowEntityType; activeOnly?: boolean },
): Promise<WorkflowDefinitionRecord[]> {
  const params = new URLSearchParams();
  if (query?.entityType) params.set('entityType', query.entityType);
  if (query?.activeOnly) params.set('activeOnly', 'true');
  const qs = params.toString();
  return tenantApiRequest<WorkflowDefinitionRecord[]>(
    `/companies/${companyId}/workflow-definitions${qs ? `?${qs}` : ''}`,
  );
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
  return tenantApiRequest<WorkflowDefinitionRecord>(
    `/companies/${companyId}/workflow-definitions`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateWorkflowDefinition(
  companyId: string,
  definitionId: string,
  input: Partial<SaveWorkflowDefinitionInput>,
): Promise<WorkflowDefinitionRecord> {
  return tenantApiRequest<WorkflowDefinitionRecord>(
    `/companies/${companyId}/workflow-definitions/${definitionId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export const EXPENSE_HIGH_VALUE_TEMPLATE: SaveWorkflowDefinitionInput = {
  entityType: 'expense_claim',
  name: 'High-Value Expense Approval',
  description: 'Multi-level approval for expense claims above threshold',
  triggerConfig: {
    type: 'amount_threshold',
    operator: 'gt',
    value: 1000,
    currency: '$',
  },
  steps: [
    { order: 1, assigneeType: 'direct_manager', roleName: 'Manager' },
    { order: 2, assigneeType: 'role', roleName: 'Accountant' },
    { order: 3, assigneeType: 'role', roleName: 'Company Owner' },
  ],
  isDefault: true,
  isActive: true,
  effectiveFrom: new Date().toISOString().slice(0, 10),
};

export const STANDARD_LEAVE_TEMPLATE: SaveWorkflowDefinitionInput = {
  entityType: 'leave_request',
  name: 'Standard Leave Approval',
  description: 'Manager review followed by HR sign-off',
  triggerConfig: { type: 'always' },
  steps: [
    { order: 1, assigneeType: 'direct_manager', roleName: 'Manager' },
    { order: 2, assigneeType: 'role', roleName: 'HR Admin' },
  ],
  isDefault: false,
  isActive: true,
  effectiveFrom: new Date().toISOString().slice(0, 10),
};
