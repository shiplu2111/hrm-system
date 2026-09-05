import type { WorkflowInstanceStep } from '@hrm/shared-types';
import {
  applyApprovalTransition,
  applyRejectionTransition,
  buildInitialInstanceSteps,
  getCurrentWorkflowStep,
  isWorkflowComplete,
  leaveChainToRuntimeSteps,
  policyStepsToDefinitionSteps,
  resolveInstanceStatusFromSteps,
} from './workflow.utils';

describe('workflow.utils', () => {
  const policySteps = [{ roleName: 'Manager' }, { roleName: 'HR Admin' }];

  it('maps legacy Manager policy step to direct_manager assignee', () => {
    const steps = policyStepsToDefinitionSteps(policySteps);
    expect(steps[0]).toMatchObject({
      order: 1,
      assigneeType: 'direct_manager',
      roleName: 'Manager',
    });
    expect(steps[1]).toMatchObject({
      order: 2,
      assigneeType: 'role',
      roleName: 'HR Admin',
    });
  });

  it('approves steps sequentially until complete', () => {
    const definitionSteps = policyStepsToDefinitionSteps(policySteps);
    let steps = buildInitialInstanceSteps(definitionSteps);

    const first = getCurrentWorkflowStep(steps)!;
    steps = applyApprovalTransition({
      steps,
      currentStep: first,
      actedByUserId: 'user-manager',
      actedByEmployeeId: 'emp-manager',
      comment: 'ok',
      actedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(isWorkflowComplete(steps)).toBe(false);

    const second = getCurrentWorkflowStep(steps)!;
    steps = applyApprovalTransition({
      steps,
      currentStep: second,
      actedByUserId: 'user-hr',
      actedByEmployeeId: 'emp-hr',
      actedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(isWorkflowComplete(steps)).toBe(true);
  });

  it('rejects current step and skips remaining pending steps', () => {
    const definitionSteps = policyStepsToDefinitionSteps(policySteps);
    let steps = buildInitialInstanceSteps(definitionSteps);
    const first = getCurrentWorkflowStep(steps)!;

    steps = applyRejectionTransition({
      steps,
      currentStep: first,
      actedByUserId: 'user-manager',
      actedByEmployeeId: 'emp-manager',
      comment: 'no',
      actedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(steps.map((s: WorkflowInstanceStep) => s.status)).toEqual([
      'rejected',
      'skipped',
    ]);
  });

  it('backfills runtime steps from legacy leave approval chain', () => {
    const runtime = leaveChainToRuntimeSteps([
      {
        roleName: 'Manager',
        status: 'approved',
        actedByUserId: 'u1',
        actedByEmployeeId: 'e1',
        actedAt: '2026-01-01T00:00:00.000Z',
        comment: 'ok',
      },
      {
        roleName: 'HR Admin',
        status: 'pending',
        actedByUserId: null,
        actedByEmployeeId: null,
        actedAt: null,
        comment: null,
      },
    ]);

    expect(runtime[0].assigneeType).toBe('direct_manager');
    expect(runtime[1].assigneeType).toBe('role');
    expect(resolveInstanceStatusFromSteps(runtime)).toBe('pending');
  });
});
