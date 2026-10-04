import { Injectable } from '@nestjs/common';
import type { WorkflowApprovalRoute, WorkflowInstanceRecord } from '@hrm/shared-types';
import { getCurrentWorkflowStep } from '../workflow/workflow.utils';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import {
  WorkflowEngineService,
  type WorkflowAuditContext,
  type WorkflowTransitionResult,
} from '../workflow/workflow-engine.service';
import { WorkflowDefinitionsService } from '../workflow/workflow-definitions.service';
import { policyStepsToDefinitionSteps } from '../workflow/workflow.utils';
import {
  DEFAULT_EXPENSE_APPROVAL_STEPS,
  DEFAULT_EXPENSE_ROUTE_NAME,
} from './expense.utils';

@Injectable()
export class ExpenseWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
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

  async findForClaims(claimIds: string[]): Promise<Map<string, WorkflowInstanceRecord>> {
    if (claimIds.length === 0) return new Map();
    const rows = await this.prisma.unscoped.workflowInstance.findMany({
      where: { entityType: 'expense_claim', entityId: { in: claimIds } },
    });
    return new Map(rows.map((row) => [row.entityId, this.workflowEngine.toRecord(row)]));
  }

  /** Chain a claim of this amount would follow if submitted now. */
  async previewRoute(companyId: string, amount: number): Promise<WorkflowApprovalRoute> {
    const definition = await this.definitionsService.findMatchingDefinition(
      companyId,
      'expense_claim',
      { amount },
    );
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
      name: DEFAULT_EXPENSE_ROUTE_NAME,
      source: 'system_default',
      steps: policyStepsToDefinitionSteps([...DEFAULT_EXPENSE_APPROVAL_STEPS]),
    };
  }

  /** Route each submitted claim actually went through, keyed by workflow instance id. */
  async resolveRoutes(
    workflows: WorkflowInstanceRecord[],
  ): Promise<Map<string, WorkflowApprovalRoute>> {
    const definitionIds = [
      ...new Set(workflows.map((w) => w.definitionId).filter((id): id is string => !!id)),
    ];
    const definitions = definitionIds.length
      ? await this.prisma.unscoped.workflowDefinition.findMany({
          where: { id: { in: definitionIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(definitions.map((d) => [d.id, d.name]));

    return new Map(
      workflows.map((workflow) => [
        workflow.id,
        {
          definitionId: workflow.definitionId,
          name:
            (workflow.definitionId && nameOf.get(workflow.definitionId)) ||
            DEFAULT_EXPENSE_ROUTE_NAME,
          source: workflow.definitionId ? 'workflow_builder' : 'system_default',
          steps: workflow.steps.map(({ order, assigneeType, roleName }) => ({
            order,
            assigneeType,
            roleName,
          })),
        },
      ]),
    );
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
