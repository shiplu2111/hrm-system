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
  DEFAULT_TIMESHEET_APPROVAL_STEPS,
  DEFAULT_TIMESHEET_ROUTE_NAME,
} from './timesheet.utils';

@Injectable()
export class TimesheetWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly definitionsService: WorkflowDefinitionsService,
  ) {}

  async startForEntry(input: {
    companyId: string;
    tenantId: string;
    entryId: string;
    requesterEmployeeId: string;
    requesterUserId: string;
  }): Promise<WorkflowInstanceRecord> {
    const existing = await this.workflowEngine.findByEntity(
      'timesheet_entry',
      input.entryId,
    );
    if (existing) {
      return this.workflowEngine.toRecord(existing);
    }

    const definition = await this.definitionsService.findEffectiveDefault(
      input.companyId,
      'timesheet_entry',
    );

    return this.workflowEngine.startInstance({
      companyId: input.companyId,
      tenantId: input.tenantId,
      entityType: 'timesheet_entry',
      entityId: input.entryId,
      requesterEmployeeId: input.requesterEmployeeId,
      requesterUserId: input.requesterUserId,
      definitionId: definition?.id ?? null,
      steps: definition
        ? undefined
        : policyStepsToDefinitionSteps([...DEFAULT_TIMESHEET_APPROVAL_STEPS]),
    });
  }

  async ensureInstance(input: {
    companyId: string;
    tenantId: string;
    entryId: string;
    requesterEmployeeId: string;
    requesterUserId?: string;
  }): Promise<WorkflowInstanceRecord> {
    const existing = await this.workflowEngine.findByEntity(
      'timesheet_entry',
      input.entryId,
    );
    if (existing) {
      return this.workflowEngine.toRecord(existing);
    }

    return this.startForEntry({
      ...input,
      requesterUserId: input.requesterUserId ?? '',
    });
  }

  async approve(input: {
    entryId: string;
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
    entryId: string;
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

  async findForEntry(entryId: string): Promise<WorkflowInstanceRecord | null> {
    const row = await this.workflowEngine.findByEntity('timesheet_entry', entryId);
    return row ? this.workflowEngine.toRecord(row) : null;
  }

  async findForEntries(entryIds: string[]): Promise<Map<string, WorkflowInstanceRecord>> {
    if (entryIds.length === 0) return new Map();
    const rows = await this.prisma.unscoped.workflowInstance.findMany({
      where: { entityType: 'timesheet_entry', entityId: { in: entryIds } },
    });
    return new Map(rows.map((row) => [row.entityId, this.workflowEngine.toRecord(row)]));
  }

  /** Chain new submissions follow: the company's default timesheet workflow, else the built-in one. */
  async resolveDefaultRoute(companyId: string): Promise<WorkflowApprovalRoute> {
    const definition = await this.definitionsService.findEffectiveDefault(
      companyId,
      'timesheet_entry',
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
      name: DEFAULT_TIMESHEET_ROUTE_NAME,
      source: 'system_default',
      steps: policyStepsToDefinitionSteps([...DEFAULT_TIMESHEET_APPROVAL_STEPS]),
    };
  }

  /** Route each submitted entry actually went through, keyed by workflow instance id. */
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
            DEFAULT_TIMESHEET_ROUTE_NAME,
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

  async cancelForEntry(entryId: string): Promise<void> {
    const instance = await this.findForEntry(entryId);
    if (instance && instance.status === 'pending') {
      await this.workflowEngine.cancelInstance(instance.id);
    }
  }
}
