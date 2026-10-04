import {
  WORKFLOW_AMOUNT_ENTITY_TYPES,
  WORKFLOW_MAX_STEPS,
  WORKFLOW_ROUTING_MODES,
  type WorkflowDefinitionStep,
  type WorkflowEntityType,
  type WorkflowTriggerConfig,
} from '@hrm/shared-types';

export const WORKFLOW_MODULE_LABELS: Record<WorkflowEntityType, string> = {
  leave_request: 'Leave request',
  expense_claim: 'Expense claim',
  payroll_adjustment: 'Payroll adjustment',
  contract: 'Contract renewal',
  timesheet_entry: 'Timesheet',
  job_requisition: 'Job requisition',
  offer_letter: 'Offer letter',
  performance_review: 'Performance review',
};

export function supportsAmountRouting(entityType: WorkflowEntityType): boolean {
  return WORKFLOW_AMOUNT_ENTITY_TYPES.includes(entityType);
}

export function stepLabel(step: Pick<WorkflowDefinitionStep, 'assigneeType' | 'roleName'>): string {
  if (step.assigneeType === 'direct_manager') return "Requester's manager";
  if (step.assigneeType === 'skip_level_manager') return "Manager's manager";
  return step.roleName;
}

export interface WorkflowDefinitionDraft {
  entityType: WorkflowEntityType;
  triggerConfig: WorkflowTriggerConfig | null;
  steps: WorkflowDefinitionStep[];
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface NormalizedWorkflowDefinition {
  triggerConfig: WorkflowTriggerConfig;
  steps: WorkflowDefinitionStep[];
  isDefault: boolean;
}

/**
 * Checks a full definition (after merging an update) and returns the shape to store:
 * steps sorted and renumbered from 1, manager steps with canonical labels, and a
 * non-default flag whenever the workflow is turned off.
 */
export function normalizeWorkflowDefinition(
  draft: WorkflowDefinitionDraft,
): { ok: true; value: NormalizedWorkflowDefinition } | { ok: false; message: string } {
  const fail = (message: string) => ({ ok: false as const, message });
  const module = WORKFLOW_MODULE_LABELS[draft.entityType];
  const amountCapable = supportsAmountRouting(draft.entityType);

  if (draft.steps.length === 0) return fail('Add at least one approval step');
  if (draft.steps.length > WORKFLOW_MAX_STEPS) {
    return fail(`A workflow can have at most ${WORKFLOW_MAX_STEPS} steps`);
  }
  if (new Set(draft.steps.map((s) => s.order)).size !== draft.steps.length) {
    return fail('Workflow step order values must be unique');
  }

  const steps: WorkflowDefinitionStep[] = [...draft.steps]
    .sort((a, b) => a.order - b.order)
    .map((step, index) => {
      const roleName =
        step.assigneeType === 'direct_manager'
          ? 'Manager'
          : step.assigneeType === 'skip_level_manager'
            ? 'Skip-level Manager'
            : step.roleName.trim();
      return {
        order: index + 1,
        assigneeType: step.assigneeType,
        roleName,
        ...(step.condition ? { condition: { ...step.condition } } : {}),
      };
    });

  for (const step of steps) {
    if (step.assigneeType === 'role' && !step.roleName) {
      return fail(`Step ${step.order}: choose a role`);
    }
    const earlier = steps.find(
      (other) =>
        other.order < step.order &&
        other.assigneeType === step.assigneeType &&
        other.roleName.toLowerCase() === step.roleName.toLowerCase(),
    );
    if (earlier) {
      return fail(`Step ${step.order} repeats step ${earlier.order} (${stepLabel(step)})`);
    }
  }

  const conditional = steps.filter((s) => s.condition);
  if (conditional.length > 0 && !amountCapable) {
    return fail(`${module} requests have no amount, so steps can't have amount conditions`);
  }
  if (conditional.length === steps.length) {
    return fail('At least one step must apply to every request (no amount condition)');
  }

  let triggerConfig: WorkflowTriggerConfig = { type: 'always' };
  if (draft.triggerConfig?.type === 'amount_threshold') {
    if (!amountCapable) {
      return fail(`${module} requests have no amount, so this workflow can't use an amount trigger`);
    }
    if (draft.triggerConfig.value == null || draft.triggerConfig.value <= 0) {
      return fail('Enter the amount that triggers this workflow');
    }
    triggerConfig = {
      type: 'amount_threshold',
      operator: draft.triggerConfig.operator ?? 'gt',
      value: draft.triggerConfig.value,
      ...(draft.triggerConfig.currency
        ? { currency: draft.triggerConfig.currency.toUpperCase() }
        : {}),
    };
  }

  const isDefault = draft.isDefault && draft.isActive;
  if (isDefault && triggerConfig.type !== 'always') {
    return fail(
      'The default workflow must apply to every request; remove the amount trigger or turn off Default',
    );
  }

  if (draft.effectiveTo && draft.effectiveTo < draft.effectiveFrom) {
    return fail('End date must be on or after the start date');
  }

  return { ok: true, value: { triggerConfig, steps, isDefault } };
}

/** Message explaining why new workflows can't be created for a module, or null if they can. */
export function unconnectedModuleMessage(entityType: WorkflowEntityType): string | null {
  const mode = WORKFLOW_ROUTING_MODES[entityType];
  if (mode === 'leave_policy') {
    return 'Leave requests follow the approval steps on each leave policy; edit those under Leave → Leave Types & Policies';
  }
  if (mode === 'not_connected') {
    return `${WORKFLOW_MODULE_LABELS[entityType]} requests don't go through approval workflows yet`;
  }
  return null;
}
