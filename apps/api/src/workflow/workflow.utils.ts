import type {
  WorkflowDefinitionStep,
  WorkflowInstanceStep,
  WorkflowStepStatus,
} from '@hrm/shared-types';

export function parseDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date "${value}", expected YYYY-MM-DD`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

const DIRECT_MANAGER_LABELS = new Set(['Manager', 'Direct Manager']);

export function isDirectManagerLabel(roleName: string): boolean {
  return DIRECT_MANAGER_LABELS.has(roleName);
}

export function policyStepsToDefinitionSteps(
  steps: Array<{ roleName: string }>,
): WorkflowDefinitionStep[] {
  return steps.map((step, index) => ({
    order: index + 1,
    assigneeType: isDirectManagerLabel(step.roleName) ? 'direct_manager' : 'role',
    roleName: step.roleName,
  }));
}

export function parseDefinitionSteps(value: unknown): WorkflowDefinitionStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((step, index) => {
      const record = step as Partial<WorkflowDefinitionStep>;
      return {
        order: record.order ?? index + 1,
        assigneeType: record.assigneeType ?? 'role',
        roleName: record.roleName ?? 'Approver',
      } satisfies WorkflowDefinitionStep;
    })
    .sort((a, b) => a.order - b.order);
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
    assigneeType: isDirectManagerLabel(step.roleName) ? 'direct_manager' : 'role',
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
