import { Injectable } from '@nestjs/common';
import type { LeaveApprovalStep } from '@hrm/shared-types';
import type { WorkflowInstanceRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  WorkflowEngineService,
  type WorkflowAuditContext,
  type WorkflowTransitionResult,
} from '../workflow/workflow-engine.service';
import {
  instanceStepsToLeaveChain,
  leaveChainToRuntimeSteps,
  policyStepsToDefinitionSteps,
} from '../workflow/workflow.utils';

export const DEFAULT_LEAVE_APPROVAL_STEPS = [
  { roleName: 'Manager' },
  { roleName: 'HR Admin' },
] as const;

@Injectable()
export class LeaveWorkflowService {
  constructor(private readonly workflowEngine: WorkflowEngineService) {}

  policyApprovalSteps(policy: { approvalSteps: unknown }): Array<{ roleName: string }> {
    return Array.isArray(policy.approvalSteps)
      ? (policy.approvalSteps as Array<{ roleName: string }>)
      : [...DEFAULT_LEAVE_APPROVAL_STEPS];
  }

  async startForLeaveRequest(input: {
    companyId: string;
    tenantId: string;
    requestId: string;
    requesterEmployeeId: string;
    requesterUserId: string;
    policyApprovalSteps: Array<{ roleName: string }>;
  }): Promise<LeaveApprovalStep[]> {
    const instance = await this.ensureInstance(input);
    return instanceStepsToLeaveChain(instance.steps);
  }

  async ensureInstance(input: {
    companyId: string;
    tenantId: string;
    requestId: string;
    requesterEmployeeId: string;
    requesterUserId?: string;
    policyApprovalSteps: Array<{ roleName: string }>;
    legacyApprovalChain?: LeaveApprovalStep[] | null;
  }): Promise<WorkflowInstanceRecord> {
    const existing = await this.workflowEngine.findByEntity(
      'leave_request',
      input.requestId,
    );
    if (existing) {
      return this.workflowEngine.toRecord(existing);
    }

    const runtimeSteps = input.legacyApprovalChain?.length
      ? leaveChainToRuntimeSteps(input.legacyApprovalChain)
      : undefined;

    return this.workflowEngine.startInstance({
      companyId: input.companyId,
      tenantId: input.tenantId,
      entityType: 'leave_request',
      entityId: input.requestId,
      requesterEmployeeId: input.requesterEmployeeId,
      requesterUserId: input.requesterUserId ?? null,
      steps: policyStepsToDefinitionSteps(input.policyApprovalSteps),
      runtimeSteps,
    });
  }

  async approve(input: {
    requestId: string;
    user: AuthenticatedUser;
    comment?: string | null;
    audit: WorkflowAuditContext;
    companyId: string;
    tenantId: string;
    requesterEmployeeId: string;
    policyApprovalSteps: Array<{ roleName: string }>;
    legacyApprovalChain?: LeaveApprovalStep[] | null;
  }): Promise<WorkflowTransitionResult> {
    const instance = await this.ensureInstance(input);
    return this.workflowEngine.approve({
      instanceId: instance.id,
      user: input.user,
      comment: input.comment,
      audit: input.audit,
    });
  }

  async reject(input: {
    requestId: string;
    user: AuthenticatedUser;
    comment?: string | null;
    audit: WorkflowAuditContext;
    companyId: string;
    tenantId: string;
    requesterEmployeeId: string;
    policyApprovalSteps: Array<{ roleName: string }>;
    legacyApprovalChain?: LeaveApprovalStep[] | null;
  }): Promise<WorkflowTransitionResult> {
    const instance = await this.ensureInstance(input);
    return this.workflowEngine.reject({
      instanceId: instance.id,
      user: input.user,
      comment: input.comment,
      audit: input.audit,
    });
  }

  async cancelForLeaveRequest(requestId: string): Promise<void> {
    const instance = await this.workflowEngine.findByEntity('leave_request', requestId);
    if (instance) {
      await this.workflowEngine.cancelInstance(instance.id);
    }
  }

  toLeaveApprovalChain(steps: WorkflowInstanceRecord['steps']): LeaveApprovalStep[] {
    return instanceStepsToLeaveChain(steps);
  }
}
