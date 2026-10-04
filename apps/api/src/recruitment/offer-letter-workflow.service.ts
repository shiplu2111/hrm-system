import { Injectable } from '@nestjs/common';
import type { OfferApprovalRoute, WorkflowInstanceRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  WorkflowEngineService,
  type WorkflowAuditContext,
  type WorkflowTransitionResult,
} from '../workflow/workflow-engine.service';
import { WorkflowDefinitionsService } from '../workflow/workflow-definitions.service';
import { policyStepsToDefinitionSteps } from '../workflow/workflow.utils';

export const DEFAULT_OFFER_LETTER_APPROVAL_STEPS = [
  { roleName: 'HR Admin' },
  { roleName: 'Company Owner' },
] as const;

export const DEFAULT_OFFER_LETTER_ROUTE_NAME = 'Default offer approval';

@Injectable()
export class OfferLetterWorkflowService {
  constructor(
    private readonly workflowEngine: WorkflowEngineService,
    private readonly definitionsService: WorkflowDefinitionsService,
  ) {}

  async startForOfferLetter(input: {
    companyId: string;
    tenantId: string;
    offerLetterId: string;
    requesterEmployeeId: string;
    requesterUserId: string;
  }): Promise<WorkflowInstanceRecord> {
    const existing = await this.workflowEngine.findByEntity(
      'offer_letter',
      input.offerLetterId,
    );
    if (existing) {
      const record = this.workflowEngine.toRecord(existing);
      if (record.status === 'pending' || record.status === 'approved') {
        return record;
      }
      // A revised offer goes through a fresh approval run; the previous decision stays in the audit log.
      await this.workflowEngine.deleteInstance(existing.id);
    }

    const definition = await this.definitionsService.findEffectiveDefault(
      input.companyId,
      'offer_letter',
    );

    return this.workflowEngine.startInstance({
      companyId: input.companyId,
      tenantId: input.tenantId,
      entityType: 'offer_letter',
      entityId: input.offerLetterId,
      requesterEmployeeId: input.requesterEmployeeId,
      requesterUserId: input.requesterUserId,
      definitionId: definition?.id ?? null,
      steps: definition
        ? undefined
        : policyStepsToDefinitionSteps([...DEFAULT_OFFER_LETTER_APPROVAL_STEPS]),
    });
  }

  /** The chain a submission uses (or used), for display before and during approval. */
  async resolveRoute(
    companyId: string,
    workflow: WorkflowInstanceRecord | null,
  ): Promise<OfferApprovalRoute> {
    const definition = workflow
      ? workflow.definitionId
        ? await this.definitionsService.findById(workflow.definitionId)
        : null
      : await this.definitionsService.findEffectiveDefault(companyId, 'offer_letter');

    if (workflow) {
      return {
        definitionId: workflow.definitionId,
        name: definition?.name ?? DEFAULT_OFFER_LETTER_ROUTE_NAME,
        source: workflow.definitionId ? 'workflow_builder' : 'system_default',
        steps: workflow.steps.map(({ order, assigneeType, roleName }) => ({
          order,
          assigneeType,
          roleName,
        })),
      };
    }

    if (definition) {
      return {
        definitionId: definition.id,
        name: definition.name,
        source: 'workflow_builder',
        steps: definition.steps,
      };
    }

    return {
      definitionId: null,
      name: DEFAULT_OFFER_LETTER_ROUTE_NAME,
      source: 'system_default',
      steps: policyStepsToDefinitionSteps([...DEFAULT_OFFER_LETTER_APPROVAL_STEPS]),
    };
  }

  async findForOfferLetter(
    offerLetterId: string,
  ): Promise<WorkflowInstanceRecord | null> {
    const row = await this.workflowEngine.findByEntity(
      'offer_letter',
      offerLetterId,
    );
    return row ? this.workflowEngine.toRecord(row) : null;
  }

  async approve(input: {
    offerLetterId: string;
    user: AuthenticatedUser;
    comment?: string | null;
    audit: WorkflowAuditContext;
    companyId: string;
    tenantId: string;
    requesterEmployeeId: string;
    requesterUserId?: string;
  }): Promise<WorkflowTransitionResult> {
    let instance = await this.workflowEngine.findByEntity(
      'offer_letter',
      input.offerLetterId,
    );
    if (!instance) {
      const created = await this.startForOfferLetter({
        companyId: input.companyId,
        tenantId: input.tenantId,
        offerLetterId: input.offerLetterId,
        requesterEmployeeId: input.requesterEmployeeId,
        requesterUserId: input.requesterUserId ?? input.user.id,
      });
      if (created.status !== 'pending') {
        return {
          instance: created,
          fullyApproved: created.status === 'approved',
          rejected: created.status === 'rejected',
        };
      }
      return this.workflowEngine.approve({
        instanceId: created.id,
        user: input.user,
        comment: input.comment,
        audit: input.audit,
      });
    }

    const record = this.workflowEngine.toRecord(instance);
    if (record.status !== 'pending') {
      return {
        instance: record,
        fullyApproved: record.status === 'approved',
        rejected: record.status === 'rejected',
      };
    }

    return this.workflowEngine.approve({
      instanceId: instance.id,
      user: input.user,
      comment: input.comment,
      audit: input.audit,
    });
  }

  async reject(input: {
    offerLetterId: string;
    user: AuthenticatedUser;
    comment?: string | null;
    audit: WorkflowAuditContext;
    companyId: string;
    tenantId: string;
    requesterEmployeeId: string;
    requesterUserId?: string;
  }): Promise<WorkflowTransitionResult> {
    let instance = await this.workflowEngine.findByEntity(
      'offer_letter',
      input.offerLetterId,
    );
    if (!instance) {
      await this.startForOfferLetter({
        companyId: input.companyId,
        tenantId: input.tenantId,
        offerLetterId: input.offerLetterId,
        requesterEmployeeId: input.requesterEmployeeId,
        requesterUserId: input.requesterUserId ?? input.user.id,
      });
      instance = await this.workflowEngine.findByEntity(
        'offer_letter',
        input.offerLetterId,
      );
    }
    if (!instance) {
      throw new Error('Failed to resolve offer letter workflow instance');
    }

    const record = this.workflowEngine.toRecord(instance);
    if (record.status !== 'pending') {
      return {
        instance: record,
        fullyApproved: record.status === 'approved',
        rejected: record.status === 'rejected',
      };
    }

    return this.workflowEngine.reject({
      instanceId: instance.id,
      user: input.user,
      comment: input.comment,
      audit: input.audit,
    });
  }
}
