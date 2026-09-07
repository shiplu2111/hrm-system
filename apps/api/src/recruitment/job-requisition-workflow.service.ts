import { Injectable } from '@nestjs/common';
import type { WorkflowInstanceRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  WorkflowEngineService,
  type WorkflowAuditContext,
  type WorkflowTransitionResult,
} from '../workflow/workflow-engine.service';
import { WorkflowDefinitionsService } from '../workflow/workflow-definitions.service';
import { policyStepsToDefinitionSteps } from '../workflow/workflow.utils';

export const DEFAULT_REQUISITION_APPROVAL_STEPS = [
  { roleName: 'HR Admin' },
] as const;

@Injectable()
export class JobRequisitionWorkflowService {
  constructor(
    private readonly workflowEngine: WorkflowEngineService,
    private readonly definitionsService: WorkflowDefinitionsService,
  ) {}

  async startForRequisition(input: {
    companyId: string;
    tenantId: string;
    requisitionId: string;
    requesterEmployeeId: string;
    requesterUserId: string;
  }): Promise<WorkflowInstanceRecord> {
    const existing = await this.workflowEngine.findByEntity(
      'job_requisition',
      input.requisitionId,
    );
    if (existing) {
      return this.workflowEngine.toRecord(existing);
    }

    const definition = await this.definitionsService.findEffectiveDefault(
      input.companyId,
      'job_requisition',
    );

    return this.workflowEngine.startInstance({
      companyId: input.companyId,
      tenantId: input.tenantId,
      entityType: 'job_requisition',
      entityId: input.requisitionId,
      requesterEmployeeId: input.requesterEmployeeId,
      requesterUserId: input.requesterUserId,
      definitionId: definition?.id ?? null,
      steps: definition
        ? undefined
        : policyStepsToDefinitionSteps([...DEFAULT_REQUISITION_APPROVAL_STEPS]),
    });
  }

  async findForRequisition(
    requisitionId: string,
  ): Promise<WorkflowInstanceRecord | null> {
    const row = await this.workflowEngine.findByEntity(
      'job_requisition',
      requisitionId,
    );
    return row ? this.workflowEngine.toRecord(row) : null;
  }

  async approve(input: {
    requisitionId: string;
    user: AuthenticatedUser;
    comment?: string | null;
    audit: WorkflowAuditContext;
    companyId: string;
    tenantId: string;
    requesterEmployeeId: string;
    requesterUserId?: string;
  }): Promise<WorkflowTransitionResult> {
    let instance = await this.workflowEngine.findByEntity(
      'job_requisition',
      input.requisitionId,
    );
    if (!instance) {
      const created = await this.startForRequisition({
        companyId: input.companyId,
        tenantId: input.tenantId,
        requisitionId: input.requisitionId,
        requesterEmployeeId: input.requesterEmployeeId,
        requesterUserId: input.requesterUserId ?? input.user.id,
      });
      return this.workflowEngine.approve({
        instanceId: created.id,
        user: input.user,
        comment: input.comment,
        audit: input.audit,
      });
    }

    return this.workflowEngine.approve({
      instanceId: instance.id,
      user: input.user,
      comment: input.comment,
      audit: input.audit,
    });
  }

  async reject(input: {
    requisitionId: string;
    user: AuthenticatedUser;
    comment?: string | null;
    audit: WorkflowAuditContext;
    companyId: string;
    tenantId: string;
    requesterEmployeeId: string;
    requesterUserId?: string;
  }): Promise<WorkflowTransitionResult> {
    let instance = await this.workflowEngine.findByEntity(
      'job_requisition',
      input.requisitionId,
    );
    if (!instance) {
      await this.startForRequisition({
        companyId: input.companyId,
        tenantId: input.tenantId,
        requisitionId: input.requisitionId,
        requesterEmployeeId: input.requesterEmployeeId,
        requesterUserId: input.requesterUserId ?? input.user.id,
      });
      instance = await this.workflowEngine.findByEntity(
        'job_requisition',
        input.requisitionId,
      );
    }
    if (!instance) {
      throw new Error('Failed to resolve requisition workflow instance');
    }

    return this.workflowEngine.reject({
      instanceId: instance.id,
      user: input.user,
      comment: input.comment,
      audit: input.audit,
    });
  }
}
