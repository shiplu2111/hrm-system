import { Injectable } from '@nestjs/common';
import type { WorkflowInstanceRecord } from '@hrm/shared-types';
import { getCurrentWorkflowStep } from '../workflow/workflow.utils';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  WorkflowEngineService,
  type WorkflowAuditContext,
  type WorkflowTransitionResult,
} from '../workflow/workflow-engine.service';
import { WorkflowDefinitionsService } from '../workflow/workflow-definitions.service';
import { policyStepsToDefinitionSteps } from '../workflow/workflow.utils';
import { DEFAULT_EXPENSE_APPROVAL_STEPS } from './expense.utils';

@Injectable()
export class ExpenseWorkflowService {
  constructor(
    private readonly workflowEngine: WorkflowEngineService,
    private readonly definitionsService: WorkflowDefinitionsService,
  ) {}

  async startForClaim(input: {
    companyId: string;
    tenantId: string;
    claimId: string;
    requesterEmployeeId: string;
    requesterUserId: string;
    amount: number;
  }): Promise<WorkflowInstanceRecord> {
    const existing = await this.workflowEngine.findByEntity(
      'expense_claim',
      input.claimId,
    );
    if (existing) {
      return this.workflowEngine.toRecord(existing);
    }

    const definition = await this.definitionsService.findMatchingDefinition(
      input.companyId,
      'expense_claim',
      { amount: input.amount },
    );

    return this.workflowEngine.startInstance({
      companyId: input.companyId,
      tenantId: input.tenantId,
      entityType: 'expense_claim',
      entityId: input.claimId,
      requesterEmployeeId: input.requesterEmployeeId,
      requesterUserId: input.requesterUserId,
      definitionId: definition?.id ?? null,
      steps: definition
        ? undefined
        : policyStepsToDefinitionSteps([...DEFAULT_EXPENSE_APPROVAL_STEPS]),
    });
  }

  async ensureInstance(input: {
    companyId: string;
    tenantId: string;
    claimId: string;
    requesterEmployeeId: string;
    requesterUserId?: string;
    amount: number;
  }): Promise<WorkflowInstanceRecord> {
    const existing = await this.workflowEngine.findByEntity(
      'expense_claim',
      input.claimId,
    );
    if (existing) {
      return this.workflowEngine.toRecord(existing);
    }

    return this.startForClaim({
      ...input,
      requesterUserId: input.requesterUserId ?? '',
    });
  }

  async approve(input: {
    claimId: string;
    user: AuthenticatedUser;
    comment?: string | null;
    audit: WorkflowAuditContext;
    companyId: string;
    tenantId: string;
    requesterEmployeeId: string;
    requesterUserId?: string;
    amount: number;
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
    claimId: string;
    user: AuthenticatedUser;
    comment?: string | null;
    audit: WorkflowAuditContext;
    companyId: string;
    tenantId: string;
    requesterEmployeeId: string;
    requesterUserId?: string;
    amount: number;
  }): Promise<WorkflowTransitionResult> {
    const instance = await this.ensureInstance(input);
    return this.workflowEngine.reject({
      instanceId: instance.id,
      user: input.user,
      comment: input.comment,
      audit: input.audit,
    });
  }

  async findForClaim(claimId: string): Promise<WorkflowInstanceRecord | null> {
    const row = await this.workflowEngine.findByEntity('expense_claim', claimId);
    return row ? this.workflowEngine.toRecord(row) : null;
  }

  getCurrentStep(instance: WorkflowInstanceRecord) {
    return getCurrentWorkflowStep(instance.steps);
  }

  async cancelForClaim(claimId: string): Promise<void> {
    const instance = await this.findForClaim(claimId);
    if (instance && instance.status === 'pending') {
      await this.workflowEngine.cancelInstance(instance.id);
    }
  }
}
