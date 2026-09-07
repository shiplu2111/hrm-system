import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssetAssignmentStatus,
  OffboardingTaskStatus,
  OffboardingTaskType,
  PayrollRunStatus,
} from '@prisma/client';
import type { EmployeeOffboardingRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CompanyAssetsService } from '../assets/company-assets.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { PayrollAdjustmentsService } from '../payroll/payroll-adjustments.service';
import { OffboardingChecklistTemplatesService } from './offboarding-checklist-templates.service';
import type {
  ListEmployeeOffboardingsQueryDto,
  RecordExitInterviewDto,
  ReturnOffboardingAssetsDto,
  StartEmployeeOffboardingDto,
  TriggerFinalSettlementDto,
} from './dto/offboarding.dto';
import {
  addDays,
  toOffboardingRecord,
  toTaskRecord,
} from './offboarding.utils';

const OFFBOARDING_INCLUDE = {
  employee: {
    select: {
      firstName: true,
      lastName: true,
      employeeNumber: true,
      designation: { select: { name: true } },
    },
  },
  template: { select: { name: true } },
  tasks: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    include: {
      companyAsset: { select: { name: true } },
    },
  },
  exitInterview: {
    include: {
      interviewer: { select: { firstName: true, lastName: true } },
    },
  },
  _count: { select: { tasks: true } },
};

@Injectable()
export class EmployeeOffboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly templatesService: OffboardingChecklistTemplatesService,
    private readonly assetsService: CompanyAssetsService,
    private readonly payrollAdjustmentsService: PayrollAdjustmentsService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    companyId: string,
    query: ListEmployeeOffboardingsQueryDto,
  ): Promise<EmployeeOffboardingRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.employeeOffboarding.findMany({
      where: {
        companyId,
        ...(query.status ? { status: query.status } : {}),
      },
      include: OFFBOARDING_INCLUDE,
      orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
    });

    const records: EmployeeOffboardingRecord[] = [];
    for (const row of rows) {
      const pendingCounts = await this.buildPendingAssetCounts(row);
      records.push(toOffboardingRecord(row, true, pendingCounts));
    }
    return records;
  }

  async get(offboardingId: string): Promise<EmployeeOffboardingRecord> {
    const row = await this.findOrThrow(offboardingId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    const pendingCounts = await this.buildPendingAssetCounts(row);
    return toOffboardingRecord(row, true, pendingCounts);
  }

  async start(
    companyId: string,
    dto: StartEmployeeOffboardingDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeOffboardingRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: dto.employeeId, companyId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const existing = await this.prisma.unscoped.employeeOffboarding.findUnique({
      where: { employeeId: dto.employeeId },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This employee already has an offboarding record',
      });
    }

    const template = dto.templateId
      ? await this.prisma.unscoped.offboardingChecklistTemplate.findFirst({
          where: { id: dto.templateId, companyId, isActive: true },
          include: {
            items: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        })
      : await this.templatesService.findDefaultTemplate(companyId);

    if (!template) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No active offboarding checklist template found for this company',
      });
    }

    const anchorDate = dto.startDate
      ? new Date(`${dto.startDate}T00:00:00.000Z`)
      : new Date();
    const lastWorkingDate = dto.lastWorkingDate
      ? new Date(`${dto.lastWorkingDate}T00:00:00.000Z`)
      : null;

    const offboarding = await this.prisma.unscoped.employeeOffboarding.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        employeeId: dto.employeeId,
        templateId: template.id,
        lastWorkingDate,
        tasks: {
          create: template.items.map((item) => ({
            templateItemId: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            taskType: item.taskType,
            assetCategory: item.assetCategory,
            assigneeLabel: item.assigneeLabel,
            dueDate: item.dueDaysOffset != null
              ? addDays(anchorDate, item.dueDaysOffset)
              : lastWorkingDate,
            sortOrder: item.sortOrder,
            isRequired: item.isRequired,
          })),
        },
      },
      include: OFFBOARDING_INCLUDE,
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'employee',
      recordId: offboarding.id,
      newValue: {
        employeeId: dto.employeeId,
        templateId: template.id,
        taskCount: template.items.length,
      },
    });

    const pendingCounts = await this.buildPendingAssetCounts(offboarding);
    return toOffboardingRecord(offboarding, true, pendingCounts);
  }

  async startFromLifecycle(input: {
    tenantId: string;
    companyId: string;
    employeeId: string;
    lastWorkingDate?: string;
    userId: string;
  }): Promise<EmployeeOffboardingRecord | null> {
    const template = await this.templatesService.findDefaultTemplate(
      input.companyId,
    );
    if (!template || template.items.length === 0) {
      return null;
    }

    const existing = await this.prisma.unscoped.employeeOffboarding.findUnique({
      where: { employeeId: input.employeeId },
    });
    if (existing) {
      return null;
    }

    const anchorDate = new Date();
    const lastWorkingDate = input.lastWorkingDate
      ? new Date(`${input.lastWorkingDate}T00:00:00.000Z`)
      : null;

    const offboarding = await this.prisma.unscoped.employeeOffboarding.create({
      data: {
        tenantId: input.tenantId,
        companyId: input.companyId,
        employeeId: input.employeeId,
        templateId: template.id,
        lastWorkingDate,
        tasks: {
          create: template.items.map((item) => ({
            templateItemId: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            taskType: item.taskType,
            assetCategory: item.assetCategory,
            assigneeLabel: item.assigneeLabel,
            dueDate: item.dueDaysOffset != null
              ? addDays(anchorDate, item.dueDaysOffset)
              : lastWorkingDate,
            sortOrder: item.sortOrder,
            isRequired: item.isRequired,
          })),
        },
      },
      include: OFFBOARDING_INCLUDE,
    });

    await this.auditService.log({
      tenantId: input.tenantId,
      userId: input.userId,
      action: 'create',
      module: 'employee',
      recordId: offboarding.id,
      newValue: {
        employeeId: input.employeeId,
        templateId: template.id,
        source: 'lifecycle',
      },
    });

    const pendingCounts = await this.buildPendingAssetCounts(offboarding);
    return toOffboardingRecord(offboarding, true, pendingCounts);
  }

  async completeTask(
    offboardingId: string,
    taskId: string,
    user: AuthenticatedUser,
  ) {
    const offboarding = await this.findOrThrow(offboardingId);
    await this.companyScope.assertCompanyInTenant(offboarding.companyId);

    const task = await this.getTaskOrThrow(offboardingId, taskId);
    if (task.status !== OffboardingTaskStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Task is not pending',
      });
    }

    if (
      task.taskType === OffboardingTaskType.asset_return ||
      task.taskType === OffboardingTaskType.access_revocation ||
      task.taskType === OffboardingTaskType.exit_interview ||
      task.taskType === OffboardingTaskType.final_settlement
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Use the dedicated action endpoint for this task type',
      });
    }

    const updated = await this.completeTaskRow(taskId, user.id);
    await this.refreshOffboardingCompletion(offboardingId);
    return toTaskRecord(updated);
  }

  async returnAssetsForTask(
    offboardingId: string,
    taskId: string,
    dto: ReturnOffboardingAssetsDto,
    user: AuthenticatedUser,
  ) {
    const offboarding = await this.findOrThrow(offboardingId);
    await this.companyScope.assertCompanyInTenant(offboarding.companyId);

    const task = await this.getTaskOrThrow(offboardingId, taskId);
    if (task.taskType !== OffboardingTaskType.asset_return) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This task is not an asset return task',
      });
    }
    if (task.status !== OffboardingTaskStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Task is not pending',
      });
    }

    const activeAssignments = await this.prisma.unscoped.employeeAssetAssignment.findMany({
      where: {
        employeeId: offboarding.employeeId,
        status: AssetAssignmentStatus.active,
        ...(task.assetCategory ? { asset: { category: task.assetCategory } } : {}),
        ...(dto.assetIds?.length ? { assetId: { in: dto.assetIds } } : {}),
      },
      include: { asset: true },
    });

    if (activeAssignments.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No matching assigned assets to return',
      });
    }

    for (const assignment of activeAssignments) {
      await this.assetsService.returnAsset(
        assignment.assetId,
        {
          conditionOnReturn: dto.conditionOnReturn,
          notes: dto.notes,
          offboardingTaskId: taskId,
        },
        user,
      );
    }

    const remaining = await this.assetsService.countActiveAssignmentsForEmployee(
      offboarding.employeeId,
      task.assetCategory ?? undefined,
    );

    if (remaining === 0) {
      const updated = await this.completeTaskRow(taskId, user.id);
      await this.refreshOffboardingCompletion(offboardingId);
      return toTaskRecord(updated, 0);
    }

    const refreshed = await this.getTaskOrThrow(offboardingId, taskId);
    return toTaskRecord(refreshed, remaining);
  }

  async revokeAccess(
    offboardingId: string,
    taskId: string,
    user: AuthenticatedUser,
  ) {
    const offboarding = await this.findOrThrow(offboardingId);
    await this.companyScope.assertCompanyInTenant(offboarding.companyId);

    const task = await this.getTaskOrThrow(offboardingId, taskId);
    if (task.taskType !== OffboardingTaskType.access_revocation) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This task is not an access revocation task',
      });
    }
    if (task.status !== OffboardingTaskStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Task is not pending',
      });
    }

    const employeeUser = await this.prisma.unscoped.user.findFirst({
      where: { employeeId: offboarding.employeeId },
    });

    if (employeeUser) {
      await this.prisma.unscoped.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: employeeUser.id },
          data: { isActive: false },
        });
        await tx.refreshToken.updateMany({
          where: { userId: employeeUser.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
    }

    await this.prisma.unscoped.employeeOffboarding.update({
      where: { id: offboardingId },
      data: { accessRevokedAt: new Date() },
    });

    const updated = await this.completeTaskRow(taskId, user.id);
    await this.refreshOffboardingCompletion(offboardingId);
    return toTaskRecord(updated);
  }

  async recordExitInterview(
    offboardingId: string,
    taskId: string,
    dto: RecordExitInterviewDto,
    user: AuthenticatedUser,
  ) {
    const offboarding = await this.findOrThrow(offboardingId);
    await this.companyScope.assertCompanyInTenant(offboarding.companyId);

    const task = await this.getTaskOrThrow(offboardingId, taskId);
    if (task.taskType !== OffboardingTaskType.exit_interview) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This task is not an exit interview task',
      });
    }

    const conductedAt = dto.conductedAt
      ? new Date(dto.conductedAt)
      : dto.feedback
        ? new Date()
        : null;

    await this.prisma.unscoped.exitInterviewRecord.upsert({
      where: { offboardingId },
      create: {
        offboardingId,
        employeeId: offboarding.employeeId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        conductedAt,
        interviewerEmployeeId: dto.interviewerEmployeeId ?? null,
        feedback: dto.feedback?.trim() ?? null,
        reasonForLeaving: dto.reasonForLeaving?.trim() ?? null,
        wouldRehire: dto.wouldRehire ?? null,
        rating: dto.rating ?? null,
      },
      update: {
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        conductedAt: conductedAt ?? undefined,
        interviewerEmployeeId: dto.interviewerEmployeeId ?? undefined,
        feedback: dto.feedback?.trim() ?? undefined,
        reasonForLeaving: dto.reasonForLeaving?.trim() ?? undefined,
        wouldRehire: dto.wouldRehire ?? undefined,
        rating: dto.rating ?? undefined,
      },
    });

    let updated = await this.getTaskOrThrow(offboardingId, taskId);
    if (
      conductedAt &&
      updated.status === OffboardingTaskStatus.pending
    ) {
      updated = await this.completeTaskRow(taskId, user.id);
      await this.refreshOffboardingCompletion(offboardingId);
    }

    return toTaskRecord(updated);
  }

  async triggerFinalSettlement(
    offboardingId: string,
    taskId: string,
    dto: TriggerFinalSettlementDto,
    user: AuthenticatedUser,
  ) {
    const offboarding = await this.findOrThrow(offboardingId);
    await this.companyScope.assertCompanyInTenant(offboarding.companyId);

    const task = await this.getTaskOrThrow(offboardingId, taskId);
    if (task.taskType !== OffboardingTaskType.final_settlement) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This task is not a final settlement task',
      });
    }
    if (task.status !== OffboardingTaskStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Task is not pending',
      });
    }

    const originalRun = dto.originalPayrollRunId
      ? await this.prisma.unscoped.payrollRun.findFirst({
          where: {
            id: dto.originalPayrollRunId,
            employeeId: offboarding.employeeId,
            deletedAt: null,
            payrollPeriod: { companyId: offboarding.companyId },
          },
        })
      : await this.prisma.unscoped.payrollRun.findFirst({
          where: {
            employeeId: offboarding.employeeId,
            deletedAt: null,
            status: { in: [PayrollRunStatus.finalized, PayrollRunStatus.paid] },
            payrollPeriod: { companyId: offboarding.companyId },
          },
          orderBy: { payrollPeriod: { endDate: 'desc' } },
        });

    if (!originalRun) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'A finalized payroll run is required to create a full & final settlement adjustment',
      });
    }

    const adjustment = await this.payrollAdjustmentsService.create(
      offboarding.companyId,
      {
        originalPayrollRunId: originalRun.id,
        applyToPayrollPeriodId: dto.applyToPayrollPeriodId,
        reason:
          dto.reason?.trim() ??
          `Full & final settlement for ${offboarding.employee.firstName} ${offboarding.employee.lastName}`.trim(),
        structureOverrides: dto.structureOverrides,
      },
      user,
    );

    const updated = await this.prisma.unscoped.employeeOffboardingTask.update({
      where: { id: taskId },
      data: {
        payrollAdjustmentId: adjustment.id,
        status: OffboardingTaskStatus.completed,
        completedAt: new Date(),
        completedByUserId: user.id,
      },
      include: {
        companyAsset: { select: { name: true } },
      },
    });

    await this.refreshOffboardingCompletion(offboardingId);
    return toTaskRecord(updated);
  }

  private async completeTaskRow(taskId: string, userId: string) {
    return this.prisma.unscoped.employeeOffboardingTask.update({
      where: { id: taskId },
      data: {
        status: OffboardingTaskStatus.completed,
        completedAt: new Date(),
        completedByUserId: userId,
      },
      include: {
        companyAsset: { select: { name: true } },
      },
    });
  }

  private async refreshOffboardingCompletion(offboardingId: string): Promise<void> {
    const offboarding = await this.prisma.unscoped.employeeOffboarding.findUnique({
      where: { id: offboardingId },
      include: {
        tasks: {
          where: { isRequired: true },
          select: { status: true },
        },
      },
    });

    if (!offboarding || offboarding.status !== 'in_progress') {
      return;
    }

    const allComplete = offboarding.tasks.every(
      (task) =>
        task.status === OffboardingTaskStatus.completed ||
        task.status === OffboardingTaskStatus.skipped,
    );

    if (!allComplete) {
      return;
    }

    await this.prisma.unscoped.employeeOffboarding.update({
      where: { id: offboardingId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
  }

  private async buildPendingAssetCounts(
    row: { employeeId: string; tasks?: Array<{ id: string; taskType: string; assetCategory: string | null; status: string }> },
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (!row.tasks) return counts;

    for (const task of row.tasks) {
      if (
        task.taskType !== OffboardingTaskType.asset_return ||
        task.status !== OffboardingTaskStatus.pending
      ) {
        continue;
      }
      const pending = await this.assetsService.countActiveAssignmentsForEmployee(
        row.employeeId,
        task.assetCategory ?? undefined,
      );
      counts.set(task.id, pending);
    }
    return counts;
  }

  private async findOrThrow(offboardingId: string) {
    const row = await this.prisma.unscoped.employeeOffboarding.findUnique({
      where: { id: offboardingId },
      include: OFFBOARDING_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee offboarding not found',
      });
    }
    return row;
  }

  private async getTaskOrThrow(offboardingId: string, taskId: string) {
    const task = await this.prisma.unscoped.employeeOffboardingTask.findFirst({
      where: { id: taskId, offboardingId },
      include: {
        companyAsset: { select: { name: true } },
      },
    });
    if (!task) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Offboarding task not found',
      });
    }
    return task;
  }
}
