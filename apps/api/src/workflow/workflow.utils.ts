import {
  WORKFLOW_ROUTING_MODES,
  type WorkflowDefinitionRoutingStatus,
  type WorkflowDefinitionStep,
  type WorkflowEntityType,
  type WorkflowInstanceStep,
  type WorkflowStepCondition,
  type WorkflowStepStatus,
  type WorkflowTriggerConfig,
} from '@hrm/shared-types';

export function parseDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date "${value}", expected YYYY-MM-DD`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

const DIRECT_MANAGER_LABELS = new Set(['Manager', 'Direct Manager']);
const SKIP_LEVEL_MANAGER_LABELS = new Set(['Skip-level Manager', 'Skip Level Manager']);

export function isDirectManagerLabel(roleName: string): boolean {
  return DIRECT_MANAGER_LABELS.has(roleName);
}

export function isSkipLevelManagerLabel(roleName: string): boolean {
  return SKIP_LEVEL_MANAGER_LABELS.has(roleName);
}

export function resolveWorkflowAssigneeType(
  roleName: string,
): WorkflowDefinitionStep['assigneeType'] {
  if (isDirectManagerLabel(roleName)) return 'direct_manager';
  if (isSkipLevelManagerLabel(roleName)) return 'skip_level_manager';
  return 'role';
}

export function policyStepsToDefinitionSteps(
  steps: Array<{ roleName: string }>,
): WorkflowDefinitionStep[] {
  return steps.map((step, index) => ({
    order: index + 1,
    assigneeType: resolveWorkflowAssigneeType(step.roleName),
    roleName: step.roleName,
  }));
}

export function parseStepCondition(value: unknown): WorkflowStepCondition | null {
  if (value == null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.type !== 'amount_threshold' || typeof record.value !== 'number') return null;
  return {
    type: 'amount_threshold',
    operator: record.operator === 'gte' ? 'gte' : 'gt',
    value: record.value,
  };
}

export function parseDefinitionSteps(value: unknown): WorkflowDefinitionStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((step, index) => {
      const record = step as Partial<WorkflowDefinitionStep>;
      const condition = parseStepCondition(record.condition);
      return {
        order: record.order ?? index + 1,
        assigneeType: record.assigneeType ?? 'role',
        roleName: record.roleName ?? 'Approver',
        ...(condition ? { condition } : {}),
      } satisfies WorkflowDefinitionStep;
    })
    .sort((a, b) => a.order - b.order);
}

/** A step with no condition always applies; without a known amount, conditional steps are kept. */
export function stepApplies(
  step: Pick<WorkflowDefinitionStep, 'condition'>,
  context: { amount?: number },
): boolean {
  if (!step.condition || context.amount == null) return true;
  return matchesAmountTrigger(context.amount, step.condition);
}

/** Steps a request with this context goes through, renumbered from 1. */
export function applicableDefinitionSteps(
  steps: WorkflowDefinitionStep[],
  context: { amount?: number },
): WorkflowDefinitionStep[] {
  return steps
    .filter((step) => stepApplies(step, context))
    .map((step, index) => ({
      order: index + 1,
      assigneeType: step.assigneeType,
      roleName: step.roleName,
    }));
}

export function buildInitialInstanceSteps(
  definitionSteps: WorkflowDefinitionStep[],
): WorkflowInstanceStep[] {
  return definitionSteps.map((step) => ({
    order: step.order,
    assigneeType: step.assigneeType,
    roleName: step.roleName,
    status: 'pending',
    actedByUserId: null,
    actedByEmployeeId: null,
    actedAt: null,
    comment: null,
  }));
}

export function parseInstanceSteps(value: unknown): WorkflowInstanceStep[] {
  if (!Array.isArray(value)) return [];
  return (value as WorkflowInstanceStep[]).slice().sort((a, b) => a.order - b.order);
}

export function getCurrentWorkflowStep(
  steps: WorkflowInstanceStep[],
): WorkflowInstanceStep | null {
  return steps.find((step) => step.status === 'pending') ?? null;
}

export function isWorkflowComplete(steps: WorkflowInstanceStep[]): boolean {
  return steps.every(
    (step) => step.status === 'approved' || step.status === 'skipped',
  );
}

export function applyApprovalTransition(input: {
  steps: WorkflowInstanceStep[];
  currentStep: WorkflowInstanceStep;
  actedByUserId: string;
  actedByEmployeeId: string | null;
  comment?: string | null;
  actedAt?: string;
}): WorkflowInstanceStep[] {
  const actedAt = input.actedAt ?? new Date().toISOString();
  return input.steps.map((step) =>
    step.order === input.currentStep.order && step.status === 'pending'
      ? {
          ...step,
          status: 'approved' as WorkflowStepStatus,
          actedByUserId: input.actedByUserId,
          actedByEmployeeId: input.actedByEmployeeId,
          actedAt,
          comment: input.comment ?? null,
        }
      : step,
  );
}

export function applyRejectionTransition(input: {
  steps: WorkflowInstanceStep[];
  currentStep: WorkflowInstanceStep;
  actedByUserId: string;
  actedByEmployeeId: string | null;
  comment?: string | null;
  actedAt?: string;
}): WorkflowInstanceStep[] {
  const actedAt = input.actedAt ?? new Date().toISOString();
  return input.steps.map((step) => {
    if (step.status !== 'pending') return step;
    if (step.order === input.currentStep.order) {
      return {
        ...step,
        status: 'rejected' as WorkflowStepStatus,
        actedByUserId: input.actedByUserId,
        actedByEmployeeId: input.actedByEmployeeId,
        actedAt,
        comment: input.comment ?? null,
      };
    }
    return {
      ...step,
      status: 'skipped' as WorkflowStepStatus,
    };
  });
}

export function instanceStepsToLeaveChain(
  steps: WorkflowInstanceStep[],
): Array<{
  roleName: string;
  status: WorkflowStepStatus;
  actedByUserId: string | null;
  actedByEmployeeId: string | null;
  actedAt: string | null;
  comment: string | null;
}> {
  return steps.map((step) => ({
    roleName: step.roleName,
    status: step.status,
    actedByUserId: step.actedByUserId,
    actedByEmployeeId: step.actedByEmployeeId,
    actedAt: step.actedAt,
    comment: step.comment,
  }));
}

export function nextPendingStepOrder(steps: WorkflowInstanceStep[]): number {
  const current = getCurrentWorkflowStep(steps);
  return current?.order ?? steps.length + 1;
}

/** Backfill a workflow instance from legacy leave approval_chain JSON */
export function leaveChainToRuntimeSteps(
  chain: Array<{
    roleName: string;
    status: WorkflowStepStatus;
    actedByUserId: string | null;
    actedByEmployeeId: string | null;
    actedAt: string | null;
    comment: string | null;
  }>,
): WorkflowInstanceStep[] {
  return chain.map((step, index) => ({
    order: index + 1,
    assigneeType: resolveWorkflowAssigneeType(step.roleName),
    roleName: step.roleName,
    status: step.status,
    actedByUserId: step.actedByUserId,
    actedByEmployeeId: step.actedByEmployeeId,
    actedAt: step.actedAt,
    comment: step.comment,
  }));
}

export function resolveInstanceStatusFromSteps(
  steps: WorkflowInstanceStep[],
): 'pending' | 'approved' | 'rejected' {
  if (steps.some((step) => step.status === 'rejected')) {
    return 'rejected';
  }
  if (isWorkflowComplete(steps)) {
    return 'approved';
  }
  return 'pending';
}

/** Evaluate amount-based workflow trigger (MODULES.md §35). */
export function matchesAmountTrigger(
  amount: number,
  config: {
    type: 'always' | 'amount_threshold';
    operator?: 'gt' | 'gte';
    value?: number;
  } | null,
): boolean {
  if (!config || config.type === 'always') return true;
  if (config.type !== 'amount_threshold') return false;
  const threshold = config.value ?? 0;
  const operator = config.operator ?? 'gt';
  return operator === 'gte' ? amount >= threshold : amount > threshold;
}

/** Pick the most specific matching workflow definition for a context. */
export function pickMatchingWorkflowDefinition<
  T extends {
    triggerConfig: {
      type: 'always' | 'amount_threshold';
      operator?: 'gt' | 'gte';
      value?: number;
    } | null;
    isDefault: boolean;
  },
>(definitions: T[], context: { amount?: number }): T | null {
  if (definitions.length === 0) return null;

  const amount = context.amount ?? 0;
  const thresholdMatches = definitions
    .filter((d) => d.triggerConfig?.type === 'amount_threshold')
    .filter((d) => matchesAmountTrigger(amount, d.triggerConfig))
    .sort(
      (a, b) =>
        (b.triggerConfig?.value ?? 0) - (a.triggerConfig?.value ?? 0),
    );

  if (thresholdMatches.length > 0) return thresholdMatches[0];

  const alwaysMatches = definitions.filter(
    (d) => !d.triggerConfig || d.triggerConfig.type === 'always',
  );
  return (
    alwaysMatches.find((d) => d.isDefault) ?? alwaysMatches[0] ?? null
  );
}

export interface RoutableWorkflowDefinition {
  id: string;
  name: string;
  entityType: WorkflowEntityType;
  isDefault: boolean;
  isActive: boolean;
  /** YYYY-MM-DD */
  effectiveFrom: string;
  effectiveTo: string | null;
  triggerConfig: WorkflowTriggerConfig | null;
}

export interface WorkflowRoutingResult {
  status: WorkflowDefinitionRoutingStatus;
  overriddenBy: { id: string; name: string } | null;
}

/**
 * Whether new requests submitted on `today` would follow each definition, mirroring
 * `findEffectiveDefault` (default-only modules) and `pickMatchingWorkflowDefinition` (amount match).
 */
export function describeWorkflowRouting(
  definitions: RoutableWorkflowDefinition[],
  today: string,
): Map<string, WorkflowRoutingResult> {
  const result = new Map<string, WorkflowRoutingResult>();
  const live = definitions
    .filter(
      (d) =>
        d.isActive &&
        d.effectiveFrom <= today &&
        (d.effectiveTo == null || d.effectiveTo >= today),
    )
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  for (const definition of definitions) {
    const mode = WORKFLOW_ROUTING_MODES[definition.entityType];
    const set = (status: WorkflowDefinitionRoutingStatus, overriddenBy: RoutableWorkflowDefinition | null = null) =>
      result.set(definition.id, {
        status,
        overriddenBy: overriddenBy ? { id: overriddenBy.id, name: overriddenBy.name } : null,
      });

    if (mode === 'leave_policy' || mode === 'not_connected') {
      set('module_not_connected');
      continue;
    }
    if (!definition.isActive) {
      set('inactive');
      continue;
    }
    if (definition.effectiveFrom > today) {
      set('scheduled');
      continue;
    }
    if (definition.effectiveTo != null && definition.effectiveTo < today) {
      set('ended');
      continue;
    }

    const peers = live.filter((d) => d.entityType === definition.entityType);
    if (mode === 'default_only') {
      const winner = peers.find((d) => d.isDefault);
      if (winner?.id === definition.id) set('in_use');
      else if (definition.isDefault && winner) set('overridden', winner);
      else set('not_default');
      continue;
    }

    const trigger = definition.triggerConfig;
    if (trigger?.type === 'amount_threshold') {
      const operator = trigger.operator ?? 'gt';
      const value = trigger.value ?? 0;
      const covering = peers.find(
        (d) =>
          d.id !== definition.id &&
          d.triggerConfig?.type === 'amount_threshold' &&
          (d.triggerConfig.value ?? 0) === value &&
          ((d.triggerConfig.operator ?? 'gt') === operator || d.triggerConfig.operator === 'gte') &&
          peers.indexOf(d) < peers.indexOf(definition),
      );
      if (covering) set('overridden', covering);
      else set('in_use');
      continue;
    }

    const always = peers.filter((d) => !d.triggerConfig || d.triggerConfig.type === 'always');
    const winner = always.find((d) => d.isDefault) ?? always[0];
    if (winner?.id === definition.id) set('in_use');
    else set('overridden', winner ?? null);
  }

  return result;
}
