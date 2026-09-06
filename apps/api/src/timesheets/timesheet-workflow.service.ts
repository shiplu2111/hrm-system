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
import { DEFAULT_TIMESHEET_APPROVAL_STEPS } from './timesheet.utils';

@Injectable()
export class TimesheetWorkflowService {
  constructor(
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
