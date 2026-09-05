import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  WorkflowInstanceStatus,
  type Prisma,
  type WorkflowEntityType,
  type WorkflowInstance,
} from '@prisma/client';
import type {
  WorkflowDefinitionStep,
  WorkflowInstanceRecord,
  WorkflowInstanceStep,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { WorkflowAssigneeService } from './workflow-assignee.service';
import {
  applyApprovalTransition,
  applyRejectionTransition,
  buildInitialInstanceSteps,
  getCurrentWorkflowStep,
  isWorkflowComplete,
  nextPendingStepOrder,
  parseDefinitionSteps,
  parseInstanceSteps,
  resolveInstanceStatusFromSteps,
} from './workflow.utils';

export interface WorkflowAuditContext {
  tenantId: string;
  module: string;
  recordId: string;
}

export interface WorkflowTransitionResult {
  instance: WorkflowInstanceRecord;
  fullyApproved: boolean;
  rejected: boolean;
}

@Injectable()
export class WorkflowEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assigneeService: WorkflowAssigneeService,
    private readonly auditService: AuditService,
  ) {}

  async findByEntity(
    entityType: WorkflowEntityType,
    entityId: string,
  ): Promise<WorkflowInstance | null> {
    return this.prisma.unscoped.workflowInstance.findUnique({
      where: {
        entityType_entityId: { entityType, entityId },
      },
    });
  }

  async startInstance(input: {
    companyId: string;
    tenantId: string;
    entityType: WorkflowEntityType;
    entityId: string;
    requesterEmployeeId: string;
    requesterUserId?: string | null;
    definitionId?: string | null;
    steps?: WorkflowDefinitionStep[];
    /** When backfilling from a domain entity that already has partial approval progress */
    runtimeSteps?: WorkflowInstanceStep[];
  }): Promise<WorkflowInstanceRecord> {
    const existing = await this.findByEntity(input.entityType, input.entityId);
    if (existing) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Workflow instance already exists for this entity',
      });
    }

    let definitionId = input.definitionId ?? null;
    let definitionSteps = input.steps ?? [];

    if (definitionId) {
      const definition = await this.prisma.unscoped.workflowDefinition.findFirst({
        where: {
          id: definitionId,
          companyId: input.companyId,
          isActive: true,
        },
      });
      if (!definition) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Workflow definition not found',
        });
      }
      definitionSteps = parseDefinitionSteps(definition.steps);
    }

    const runtimeSteps =
      input.runtimeSteps ??
      (definitionSteps.length > 0
        ? buildInitialInstanceSteps(definitionSteps)
        : []);

    if (runtimeSteps.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Workflow must have at least one approval step',
      });
    }

    const workflowStatus = resolveInstanceStatusFromSteps(runtimeSteps);
    const status =
      workflowStatus === 'approved'
        ? WorkflowInstanceStatus.approved
        : workflowStatus === 'rejected'
          ? WorkflowInstanceStatus.rejected
          : WorkflowInstanceStatus.pending;

    const row = await this.prisma.unscoped.workflowInstance.create({
      data: {
        definitionId,
        companyId: input.companyId,
        tenantId: input.tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        requesterEmployeeId: input.requesterEmployeeId,
        requesterUserId: input.requesterUserId ?? null,
        status,
        steps: runtimeSteps as unknown as Prisma.InputJsonValue,
        currentStepOrder: nextPendingStepOrder(runtimeSteps),
        completedAt:
          status === WorkflowInstanceStatus.pending ? null : new Date(),
      },
    });

    return this.toRecord(row);
  }

  async approve(input: {
    instanceId: string;
    user: AuthenticatedUser;
    comment?: string | null;
    audit: WorkflowAuditContext;
  }): Promise<WorkflowTransitionResult> {
    const row = await this.findInstanceOrThrow(input.instanceId);
    if (row.status !== WorkflowInstanceStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Workflow is not pending approval',
      });
    }

    const steps = parseInstanceSteps(row.steps);
    const currentStep = getCurrentWorkflowStep(steps);
    if (!currentStep) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No pending approval step',
      });
    }

    await this.assigneeService.assertCanActOnStep({
      requesterEmployeeId: row.requesterEmployeeId,
      step: currentStep,
      user: input.user,
    });

    const oldSnapshot = this.stepSnapshot(currentStep);
    const updatedSteps = applyApprovalTransition({
      steps,
      currentStep,
      actedByUserId: input.user.id,
      actedByEmployeeId: input.user.employeeId,
      comment: input.comment,
    });

    const fullyApproved = isWorkflowComplete(updatedSteps);
    const status = fullyApproved
      ? WorkflowInstanceStatus.approved
      : WorkflowInstanceStatus.pending;

    const updated = await this.prisma.unscoped.workflowInstance.update({
      where: { id: row.id },
      data: {
        steps: updatedSteps as unknown as Prisma.InputJsonValue,
        status,
        currentStepOrder: nextPendingStepOrder(updatedSteps),
        completedAt: fullyApproved ? new Date() : null,
      },
    });

    await this.auditService.log({
      tenantId: input.audit.tenantId,
      userId: input.user.id,
      action: AuditAction.approve,
      module: input.audit.module,
      recordId: input.audit.recordId,
      oldValue: { step: oldSnapshot, workflowStatus: row.status },
      newValue: {
        step: this.stepSnapshot(
          updatedSteps.find((s) => s.order === currentStep.order)!,
        ),
        workflowStatus: status,
        fullyApproved,
      },
    });

    return {
      instance: this.toRecord(updated),
      fullyApproved,
      rejected: false,
    };
  }

  async reject(input: {
    instanceId: string;
    user: AuthenticatedUser;
    comment?: string | null;
    audit: WorkflowAuditContext;
  }): Promise<WorkflowTransitionResult> {
    const row = await this.findInstanceOrThrow(input.instanceId);
    if (row.status !== WorkflowInstanceStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Workflow is not pending approval',
      });
    }

    const steps = parseInstanceSteps(row.steps);
    const currentStep = getCurrentWorkflowStep(steps);
    if (!currentStep) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No pending approval step',
      });
    }

    await this.assigneeService.assertCanActOnStep({
      requesterEmployeeId: row.requesterEmployeeId,
      step: currentStep,
      user: input.user,
    });

    const oldSnapshot = this.stepSnapshot(currentStep);
    const updatedSteps = applyRejectionTransition({
      steps,
      currentStep,
      actedByUserId: input.user.id,
      actedByEmployeeId: input.user.employeeId,
      comment: input.comment,
    });

    const updated = await this.prisma.unscoped.workflowInstance.update({
      where: { id: row.id },
      data: {
        steps: updatedSteps as unknown as Prisma.InputJsonValue,
        status: WorkflowInstanceStatus.rejected,
        currentStepOrder: nextPendingStepOrder(updatedSteps),
        completedAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId: input.audit.tenantId,
      userId: input.user.id,
      action: AuditAction.reject,
      module: input.audit.module,
      recordId: input.audit.recordId,
      oldValue: { step: oldSnapshot, workflowStatus: row.status },
      newValue: {
        step: this.stepSnapshot(
          updatedSteps.find((s) => s.order === currentStep.order)!,
        ),
        workflowStatus: WorkflowInstanceStatus.rejected,
      },
    });

    return {
      instance: this.toRecord(updated),
      fullyApproved: false,
      rejected: true,
    };
  }

  async cancelInstance(instanceId: string): Promise<WorkflowInstanceRecord> {
    const row = await this.findInstanceOrThrow(instanceId);
    if (row.status !== WorkflowInstanceStatus.pending) {
      if (row.status === WorkflowInstanceStatus.cancelled) {
        return this.toRecord(row);
      }
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only pending workflows can be cancelled',
      });
    }

    const updated = await this.prisma.unscoped.workflowInstance.update({
      where: { id: row.id },
      data: {
        status: WorkflowInstanceStatus.cancelled,
        completedAt: new Date(),
      },
    });

    return this.toRecord(updated);
  }

  private async findInstanceOrThrow(instanceId: string): Promise<WorkflowInstance> {
    const row = await this.prisma.unscoped.workflowInstance.findUnique({
      where: { id: instanceId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Workflow instance not found',
      });
    }
    return row;
  }

  private stepSnapshot(step: WorkflowInstanceStep): Record<string, unknown> {
    return {
      order: step.order,
      assigneeType: step.assigneeType,
      roleName: step.roleName,
      status: step.status,
      actedByUserId: step.actedByUserId,
      actedAt: step.actedAt,
    };
  }

  toRecord(row: WorkflowInstance): WorkflowInstanceRecord {
    return {
      id: row.id,
      definitionId: row.definitionId,
      companyId: row.companyId,
      tenantId: row.tenantId,
      entityType: row.entityType,
      entityId: row.entityId,
      requesterEmployeeId: row.requesterEmployeeId,
      requesterUserId: row.requesterUserId,
      status: row.status,
      steps: parseInstanceSteps(row.steps),
      currentStepOrder: row.currentStepOrder,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
