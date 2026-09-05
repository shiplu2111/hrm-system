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

export const DEFAULT_CONTRACT_APPROVAL_STEPS = [
  { roleName: 'Manager' },
  { roleName: 'HR Admin' },
] as const;

@Injectable()
export class ContractWorkflowService {
  constructor(
    private readonly workflowEngine: WorkflowEngineService,
    private readonly definitionsService: WorkflowDefinitionsService,
  ) {}

  async startForRenewal(input: {
    companyId: string;
    tenantId: string;
    renewalContractId: string;
    requesterEmployeeId: string;
    requesterUserId: string;
  }): Promise<WorkflowInstanceRecord> {
    const existing = await this.workflowEngine.findByEntity(
      'contract',
      input.renewalContractId,
    );
    if (existing) {
      return this.workflowEngine.toRecord(existing);
    }

    const definition = await this.definitionsService.findEffectiveDefault(
      input.companyId,
      'contract',
    );

    return this.workflowEngine.startInstance({
      companyId: input.companyId,
      tenantId: input.tenantId,
      entityType: 'contract',
      entityId: input.renewalContractId,
      requesterEmployeeId: input.requesterEmployeeId,
      requesterUserId: input.requesterUserId,
      definitionId: definition?.id ?? null,
      steps: definition
        ? undefined
        : policyStepsToDefinitionSteps([...DEFAULT_CONTRACT_APPROVAL_STEPS]),
    });
  }

  async ensureInstance(input: {
    companyId: string;
    tenantId: string;
    renewalContractId: string;
    requesterEmployeeId: string;
    requesterUserId?: string;
  }): Promise<WorkflowInstanceRecord> {
    const existing = await this.workflowEngine.findByEntity(
      'contract',
      input.renewalContractId,
    );
    if (existing) {
      return this.workflowEngine.toRecord(existing);
    }

    return this.startForRenewal({
      ...input,
      requesterUserId: input.requesterUserId ?? '',
    });
  }

  async approve(input: {
    renewalContractId: string;
    user: AuthenticatedUser;
    comment?: string | null;
    audit: WorkflowAuditContext;
    companyId: string;
    tenantId: string;
    requesterEmployeeId: string;
    requesterUserId?: string;
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
    renewalContractId: string;
    user: AuthenticatedUser;
    comment?: string | null;
    audit: WorkflowAuditContext;
    companyId: string;
    tenantId: string;
    requesterEmployeeId: string;
    requesterUserId?: string;
  }): Promise<WorkflowTransitionResult> {
    const instance = await this.ensureInstance(input);
    return this.workflowEngine.reject({
      instanceId: instance.id,
      user: input.user,
      comment: input.comment,
      audit: input.audit,
    });
  }

  async findForContract(
    renewalContractId: string,
  ): Promise<WorkflowInstanceRecord | null> {
    const row = await this.workflowEngine.findByEntity(
      'contract',
      renewalContractId,
    );
    return row ? this.workflowEngine.toRecord(row) : null;
  }

  getCurrentStep(instance: WorkflowInstanceRecord) {
    return getCurrentWorkflowStep(instance.steps);
  }
}
