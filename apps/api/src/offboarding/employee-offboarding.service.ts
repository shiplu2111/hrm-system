import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssetAssignmentStatus,
  OffboardingStatus,
  OffboardingTaskStatus,
  OffboardingTaskType,
  PayComponentCalculationType,
  PayrollAdjustmentKind,
  PayrollAdjustmentStatus,
  PayrollPeriodStatus,
  PayrollRunStatus,
  Prisma,
} from '@prisma/client';
import type {
  EmployeeOffboardingRecord,
  OffboardingAccessStatus,
  OffboardingAssetRecord,
  OffboardingSettlementOptions,
  OffboardingSettlementRecord,
  PayrollCalculationPreview,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CompanyAssetsService } from '../assets/company-assets.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { PayrollAdjustmentsService } from '../payroll/payroll-adjustments.service';
import { formatDateOnly, formatMoney, isEffectiveOn, parseAmountConfig } from '../payroll/payroll.utils';
import { DataScopeService } from '../rbac/data-scope.service';
import { PermissionsService } from '../rbac/permissions.service';
import { OffboardingChecklistTemplatesService } from './offboarding-checklist-templates.service';
import { OffboardingTaskSyncService } from './offboarding-task-sync.service';
import type {
  CancelFinalSettlementDto,
  CompleteOffboardingTaskDto,
  ListEmployeeOffboardingsQueryDto,
  ReopenOffboardingTaskDto,
  ReturnOffboardingAssetDto,
  ReturnOffboardingAssetsDto,
  SaveExitInterviewDto,
  SkipOffboardingTaskDto,
  StartEmployeeOffboardingDto,
  TriggerFinalSettlementDto,
} from './dto/offboarding.dto';
import {
  SettlementLineError,
  addDays,
  buildSettlementLines,
  formatDateValue,
  sanitizeExitRatings,
  settlementLinesToOverrides,
  toOffboardingRecord,
  toTaskRecord,
  todayIsoDate,
} from './offboarding.utils';

const TASK_INCLUDE = {
  companyAsset: { select: { name: true } },
} as const;

const OFFBOARDING_INCLUDE = {
  employee: {
    select: {
      firstName: true,
      lastName: true,
      employeeNumber: true,
      designation: { select: { name: true } },
      department: { select: { name: true } },
    },
  },
  template: { select: { name: true } },
  tasks: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    include: TASK_INCLUDE,
  },
  exitInterview: {
    include: {
      interviewer: { select: { firstName: true, lastName: true } },
    },
  },
  _count: { select: { tasks: true } },
};

type OffboardingRow = Prisma.EmployeeOffboardingGetPayload<{
  include: typeof OFFBOARDING_INCLUDE;
}>;

type TemplateWithItems = Prisma.OffboardingChecklistTemplateGetPayload<{
  include: { items: true };
}>;

const AUTO_COMPLETED_TASK_TYPES: OffboardingTaskType[] = [
  OffboardingTaskType.asset_return,
  OffboardingTaskType.access_revocation,
  OffboardingTaskType.exit_interview,
  OffboardingTaskType.final_settlement,
];

@Injectable()
export class EmployeeOffboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly templatesService: OffboardingChecklistTemplatesService,
    private readonly assetsService: CompanyAssetsService,
    private readonly payrollAdjustmentsService: PayrollAdjustmentsService,
    private readonly auditService: AuditService,
    private readonly dataScope: DataScopeService,
    private readonly permissions: PermissionsService,
    private readonly taskSync: OffboardingTaskSyncService,
  ) {}

  async list(
    companyId: string,
    query: ListEmployeeOffboardingsQueryDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeOffboardingRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.employeeOffboarding.findMany({
      where: {
        companyId,
        employeeId: await this.dataScope.employeeIdFilter(user),
        ...(query.status ? { status: query.status } : {}),
      },
      include: OFFBOARDING_INCLUDE,
      orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
    });

    const outstanding = rows.length
      ? await this.prisma.unscoped.employeeAssetAssignment.groupBy({
          by: ['employeeId'],
          where: {
            employeeId: { in: rows.map((row) => row.employeeId) },
            status: AssetAssignmentStatus.active,
          },
          _count: { _all: true },
        })
      : [];
    const outstandingByEmployee = new Map(
      outstanding.map((entry) => [entry.employeeId, entry._count._all]),
    );

    const today = todayIsoDate();
    return rows.map((row) =>
      toOffboardingRecord(row, {
        assetsOutstandingCount: outstandingByEmployee.get(row.employeeId) ?? 0,
        today,
      }),
    );
  }

  async get(
    offboardingId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeeOffboardingRecord> {
    const row = await this.findOrThrow(offboardingId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    await this.dataScope.assertEmployeeInScope(user, row.employeeId);
    return this.present(row, user);
  }

  async getForEmployee(
    employeeId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeeOffboardingRecord | null> {
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    const row = await this.prisma.unscoped.employeeOffboarding.findUnique({
      where: { employeeId },
      include: OFFBOARDING_INCLUDE,
    });
    if (!row) return null;
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return this.present(row, user);
  }

  async start(
    companyId: string,
    dto: StartEmployeeOffboardingDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeOffboardingRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    await this.dataScope.assertEmployeeInScope(user, dto.employeeId, { includeSelf: false });

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
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'This employee already has an offboarding record',
      });
    }

    const template = dto.templateId
      ? await this.prisma.unscoped.offboardingChecklistTemplate.findFirst({
          where: { id: dto.templateId, companyId, isActive: true },
          include: {
            items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
          },
        })
      : await this.templatesService.findDefaultTemplate(companyId);

    if (!template || template.items.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: template
          ? 'The selected checklist template has no items'
          : 'No active offboarding checklist template found for this company',
      });
    }

    const offboarding = await this.createFromTemplate({
      tenantId: company.tenantId,
      companyId,
      employeeId: dto.employeeId,
      template,
      anchorDate: dto.startDate ? dto.startDate.slice(0, 10) : undefined,
      lastWorkingDate: dto.lastWorkingDate ? dto.lastWorkingDate.slice(0, 10) : undefined,
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
        lastWorkingDate: dto.lastWorkingDate ?? null,
      },
    });

    return this.present(offboarding, user);
  }

  async startFromLifecycle(input: {
    tenantId: string;
    companyId: string;
    employeeId: string;
    lastWorkingDate?: string;
    userId: string;
  }): Promise<EmployeeOffboardingRecord | null> {
    const template = await this.templatesService.findDefaultTemplate(input.companyId);
    if (!template || template.items.length === 0) {
      return null;
    }

    const existing = await this.prisma.unscoped.employeeOffboarding.findUnique({
      where: { employeeId: input.employeeId },
    });
    if (existing) {
      return null;
    }

    const offboarding = await this.createFromTemplate({
      tenantId: input.tenantId,
      companyId: input.companyId,
      employeeId: input.employeeId,
      template,
      lastWorkingDate: input.lastWorkingDate?.slice(0, 10),
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

    return toOffboardingRecord(offboarding, { includeTasks: true });
  }

  async completeTask(
    offboardingId: string,
    taskId: string,
    dto: CompleteOffboardingTaskDto,
    user: AuthenticatedUser,
  ) {
    const offboarding = await this.findActiveOrThrow(offboardingId, user);
    const task = await this.getTaskOrThrow(offboardingId, taskId);
    this.assertPending(task.status);

    if (AUTO_COMPLETED_TASK_TYPES.includes(task.taskType)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Use the dedicated action for this step',
      });
    }

    const updated = await this.completeTaskRow(taskId, user.id);
    await this.logTaskChange(offboarding, user, task.id, 'completed', {
      note: dto.note?.trim() || null,
    });
    await this.refreshOffboardingCompletion(offboardingId);
    return toTaskRecord(updated);
  }

  async skipTask(
    offboardingId: string,
    taskId: string,
    dto: SkipOffboardingTaskDto,
    user: AuthenticatedUser,
  ) {
    const offboarding = await this.findActiveOrThrow(offboardingId, user);
    const task = await this.getTaskOrThrow(offboardingId, taskId);
    this.assertPending(task.status);

    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A reason is required to skip a step',
      });
    }

    const updated = await this.prisma.unscoped.employeeOffboardingTask.update({
      where: { id: taskId },
      data: {
        status: OffboardingTaskStatus.skipped,
        completedAt: new Date(),
        completedByUserId: user.id,
      },
      include: TASK_INCLUDE,
    });
    await this.logTaskChange(offboarding, user, task.id, 'skipped', { reason });
    await this.refreshOffboardingCompletion(offboardingId);
    return toTaskRecord(updated);
  }

  async reopenTask(
    offboardingId: string,
    taskId: string,
    dto: ReopenOffboardingTaskDto,
    user: AuthenticatedUser,
  ) {
    const offboarding = await this.findActiveOrThrow(offboardingId, user);
    const task = await this.getTaskOrThrow(offboardingId, taskId);

    if (task.status === OffboardingTaskStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Task is already pending',
      });
    }

    if (task.status === OffboardingTaskStatus.completed) {
      const blocked: Partial<Record<OffboardingTaskType, string>> = {
        [OffboardingTaskType.access_revocation]:
          'Access has already been revoked. Reactivate the user account from Settings → Users if it was revoked in error.',
        [OffboardingTaskType.final_settlement]:
          'Cancel the settlement entry instead — that reopens this step.',
        [OffboardingTaskType.asset_return]:
          'The assets have been returned. Re-assign them from the asset register if needed.',
      };
      const message = blocked[task.taskType];
      if (message) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message });
      }
    }

    const updated = await this.prisma.unscoped.$transaction(async (tx) => {
      if (
        task.taskType === OffboardingTaskType.exit_interview &&
        task.status === OffboardingTaskStatus.completed
      ) {
        await tx.exitInterviewRecord.updateMany({
          where: { offboardingId },
          data: { conductedAt: null },
        });
      }
      return tx.employeeOffboardingTask.update({
        where: { id: taskId },
        data: {
          status: OffboardingTaskStatus.pending,
          completedAt: null,
          completedByUserId: null,
        },
        include: TASK_INCLUDE,
      });
    });

    await this.logTaskChange(offboarding, user, task.id, 'reopened', {
      previousStatus: task.status,
      reason: dto.reason?.trim() || null,
    });
    await this.reopenOffboardingIfIncomplete(offboardingId);
    return toTaskRecord(updated);
  }

  /** Returns every matching asset for an asset-return step, or confirms nothing is outstanding. */
  async returnAssetsForTask(
    offboardingId: string,
    taskId: string,
    dto: ReturnOffboardingAssetsDto,
    user: AuthenticatedUser,
  ) {
    const offboarding = await this.findActiveOrThrow(offboardingId, user);
    const task = await this.getTaskOrThrow(offboardingId, taskId);
    if (task.taskType !== OffboardingTaskType.asset_return) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This task is not an asset return task',
      });
    }
    this.assertPending(task.status);

    const activeAssignments = await this.prisma.unscoped.employeeAssetAssignment.findMany({
      where: {
        employeeId: offboarding.employeeId,
        status: AssetAssignmentStatus.active,
        ...(task.assetCategory ? { asset: { category: task.assetCategory } } : {}),
        ...(dto.assetIds?.length ? { assetId: { in: dto.assetIds } } : {}),
      },
    });

    if (activeAssignments.length === 0 && dto.assetIds?.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'None of the selected assets are assigned to this employee',
      });
    }

    // Each return runs the register's checklist sync, which completes this step once nothing is outstanding.
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
    const current = await this.getTaskOrThrow(offboardingId, taskId);

    if (remaining === 0 && current.status === OffboardingTaskStatus.pending) {
      const updated = await this.completeTaskRow(taskId, user.id);
      await this.logTaskChange(offboarding, user, task.id, 'completed', {
        returnedAssetIds: [],
        nothingOutstanding: true,
      });
      await this.refreshOffboardingCompletion(offboardingId);
      return toTaskRecord(updated, 0);
    }

    return toTaskRecord(current, current.status === OffboardingTaskStatus.pending ? remaining : 0);
  }

  /** Returns one asset; asset-return steps for its category complete once nothing is outstanding. */
  async returnAsset(
    offboardingId: string,
    assetId: string,
    dto: ReturnOffboardingAssetDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeOffboardingRecord> {
    const offboarding = await this.findActiveOrThrow(offboardingId, user);

    const assignment = await this.prisma.unscoped.employeeAssetAssignment.findFirst({
      where: {
        assetId,
        employeeId: offboarding.employeeId,
        status: AssetAssignmentStatus.active,
      },
      include: { asset: { select: { category: true } } },
    });
    if (!assignment) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This asset is not currently assigned to the employee',
      });
    }

    const category = assignment.asset.category;
    const coveringTasks = offboarding.tasks.filter(
      (task) =>
        task.taskType === OffboardingTaskType.asset_return &&
        task.status === OffboardingTaskStatus.pending &&
        (task.assetCategory == null || task.assetCategory === category),
    );
    const linkedTask =
      coveringTasks.find((task) => task.assetCategory === category) ?? coveringTasks[0];

    await this.assetsService.returnAsset(
      assetId,
      {
        conditionOnReturn: dto.conditionOnReturn,
        notes: dto.notes,
        offboardingTaskId: linkedTask?.id,
      },
      user,
    );

    return this.get(offboardingId, user);
  }

  async revokeAccess(
    offboardingId: string,
    taskId: string,
    user: AuthenticatedUser,
  ) {
    const offboarding = await this.findActiveOrThrow(offboardingId, user);
    const task = await this.getTaskOrThrow(offboardingId, taskId);
    if (task.taskType !== OffboardingTaskType.access_revocation) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This task is not an access revocation task',
      });
    }
    this.assertPending(task.status);

    const employeeUser = await this.prisma.unscoped.user.findFirst({
      where: { employeeId: offboarding.employeeId },
    });
    if (employeeUser?.id === user.id) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'You cannot revoke your own access',
      });
    }

    let revokedSessions = 0;
    if (employeeUser) {
      revokedSessions = await this.prisma.unscoped.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: employeeUser.id },
          data: { isActive: false },
        });
        const result = await tx.refreshToken.updateMany({
          where: { userId: employeeUser.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return result.count;
      });
    }

    await this.prisma.unscoped.employeeOffboarding.update({
      where: { id: offboardingId },
      data: { accessRevokedAt: new Date() },
    });

    const updated = await this.completeTaskRow(taskId, user.id);
    await this.logTaskChange(offboarding, user, task.id, 'access_revoked', {
      userId: employeeUser?.id ?? null,
      hadPortalAccount: employeeUser != null,
      revokedSessions,
    });
    await this.refreshOffboardingCompletion(offboardingId);
    return toTaskRecord(updated);
  }

  async saveExitInterview(
    offboardingId: string,
    dto: SaveExitInterviewDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeOffboardingRecord> {
    const offboarding = await this.findActiveOrThrow(offboardingId, user);
    const existing = offboarding.exitInterview;

    if (dto.interviewerEmployeeId) {
      if (dto.interviewerEmployeeId === offboarding.employeeId) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'The departing employee cannot be their own interviewer',
        });
      }
      const interviewer = await this.prisma.unscoped.employee.findFirst({
        where: {
          id: dto.interviewerEmployeeId,
          companyId: offboarding.companyId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!interviewer) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Interviewer not found in this company',
        });
      }
    }

    if (dto.ratings != null) {
      const accepted = sanitizeExitRatings(dto.ratings);
      const invalid = Object.entries(dto.ratings).filter(
        ([area, value]) => value != null && !(area in accepted),
      );
      if (invalid.length > 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Ratings must be whole numbers from 1 to 5 (invalid: ${invalid
            .map(([area]) => area)
            .join(', ')})`,
        });
      }
    }

    const text = (value: string | null | undefined) =>
      value === undefined ? undefined : value?.trim() || null;
    const date = (value: string | null | undefined) =>
      value === undefined ? undefined : value ? new Date(value) : null;

    const fields = {
      scheduledAt: date(dto.scheduledAt),
      interviewerEmployeeId: dto.interviewerEmployeeId,
      reasonCategory: dto.reasonCategory,
      reasonForLeaving: text(dto.reasonForLeaving),
      ratings: dto.ratings !== undefined
        ? (sanitizeExitRatings(dto.ratings) as Prisma.InputJsonValue)
        : undefined,
      rating: dto.rating,
      likedMost: text(dto.likedMost),
      improvementSuggestions: text(dto.improvementSuggestions),
      feedback: text(dto.feedback),
      wouldRecommend: dto.wouldRecommend,
      wouldRehire: dto.wouldRehire,
    };

    const wasConducted = existing?.conductedAt != null;
    if (dto.conductedAt === null && wasConducted) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Reopen the exit interview step to mark it as not conducted',
      });
    }
    const conductedAt =
      date(dto.conductedAt) ??
      existing?.conductedAt ??
      (dto.complete ? new Date() : null);

    if (conductedAt && conductedAt.getTime() > Date.now() + 60_000) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The interview date cannot be in the future',
      });
    }

    const reasonCategory =
      fields.reasonCategory !== undefined ? fields.reasonCategory : existing?.reasonCategory;
    if (conductedAt && !reasonCategory) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Choose the main reason for leaving before completing the interview',
      });
    }

    await this.prisma.unscoped.exitInterviewRecord.upsert({
      where: { offboardingId },
      create: {
        offboardingId,
        employeeId: offboarding.employeeId,
        scheduledAt: fields.scheduledAt ?? null,
        conductedAt,
        interviewerEmployeeId: fields.interviewerEmployeeId ?? null,
        reasonCategory: fields.reasonCategory ?? null,
        reasonForLeaving: fields.reasonForLeaving ?? null,
        ratings: fields.ratings ?? Prisma.DbNull,
        rating: fields.rating ?? null,
        likedMost: fields.likedMost ?? null,
        improvementSuggestions: fields.improvementSuggestions ?? null,
        feedback: fields.feedback ?? null,
        wouldRecommend: fields.wouldRecommend ?? null,
        wouldRehire: fields.wouldRehire ?? null,
        recordedByUserId: user.id,
      },
      update: {
        ...fields,
        conductedAt,
        recordedByUserId: user.id,
      },
    });

    if (conductedAt) {
      const pending = offboarding.tasks.filter(
        (task) =>
          task.taskType === OffboardingTaskType.exit_interview &&
          task.status === OffboardingTaskStatus.pending,
      );
      for (const task of pending) {
        await this.completeTaskRow(task.id, user.id);
      }
      if (pending.length) {
        await this.refreshOffboardingCompletion(offboardingId);
      }
    }

    await this.auditService.log({
      tenantId: offboarding.tenantId,
      userId: user.id,
      action: existing ? 'update' : 'create',
      module: 'employee',
      recordId: offboardingId,
      newValue: {
        exitInterview: {
          scheduledAt: fields.scheduledAt?.toISOString() ?? null,
          conductedAt: conductedAt?.toISOString() ?? null,
          reasonCategory: reasonCategory ?? null,
          completedNow: conductedAt != null && !wasConducted,
        },
      },
    });

    return this.get(offboardingId, user);
  }

  /** Kept for the task-scoped route; the form uses {@link saveExitInterview}. */
  async recordExitInterview(
    offboardingId: string,
    taskId: string,
    dto: SaveExitInterviewDto,
    user: AuthenticatedUser,
  ) {
    const task = await this.getTaskOrThrow(offboardingId, taskId);
    if (task.taskType !== OffboardingTaskType.exit_interview) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This task is not an exit interview task',
      });
    }
    await this.saveExitInterview(offboardingId, dto, user);
    return toTaskRecord(await this.getTaskOrThrow(offboardingId, taskId));
  }

  async settlementOptions(
    offboardingId: string,
    user: AuthenticatedUser,
  ): Promise<OffboardingSettlementOptions> {
    const offboarding = await this.findOrThrow(offboardingId);
    await this.companyScope.assertCompanyInTenant(offboarding.companyId);
    await this.dataScope.assertEmployeeInScope(user, offboarding.employeeId, {
      includeSelf: false,
    });

    const [runs, periods, components, structures] = await Promise.all([
      this.prisma.unscoped.payrollRun.findMany({
        where: {
          employeeId: offboarding.employeeId,
          deletedAt: null,
          status: { in: [PayrollRunStatus.finalized, PayrollRunStatus.paid] },
          payrollPeriod: { companyId: offboarding.companyId },
        },
        include: { payrollPeriod: { select: { startDate: true, endDate: true } } },
        orderBy: { payrollPeriod: { endDate: 'desc' } },
        take: 12,
      }),
      this.prisma.unscoped.payrollPeriod.findMany({
        where: {
          companyId: offboarding.companyId,
          status: { not: PayrollPeriodStatus.closed },
        },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.unscoped.payComponent.findMany({
        where: {
          companyId: offboarding.companyId,
          calculationType: PayComponentCalculationType.fixed,
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.unscoped.salaryStructure.findMany({
        where: { employeeId: offboarding.employeeId },
      }),
    ]);

    const today = new Date(`${todayIsoDate()}T00:00:00.000Z`);
    const currentAmount = new Map<string, string>();
    for (const row of structures) {
      if (!isEffectiveOn(row.effectiveFrom, row.effectiveTo, today)) continue;
      try {
        const amount = parseAmountConfig(row.amountOrFormula).amount;
        if (amount) currentAmount.set(row.componentId, amount);
      } catch {
        // Unreadable amount config — treat the component as unassigned.
      }
    }

    return {
      runs: runs.map((run) => ({
        id: run.id,
        periodId: run.payrollPeriodId,
        periodStart: formatDateOnly(run.payrollPeriod.startDate),
        periodEnd: formatDateOnly(run.payrollPeriod.endDate),
        status: run.status,
        grossPay: formatMoney(run.grossPay),
        netPay: formatMoney(run.netPay),
        payCurrency: run.payCurrency,
      })),
      periods: periods.map((period) => ({
        id: period.id,
        startDate: formatDateOnly(period.startDate),
        endDate: formatDateOnly(period.endDate),
        paymentDate: formatDateOnly(period.paymentDate),
        status: period.status,
      })),
      components: components.map((component) => ({
        id: component.id,
        name: component.name,
        type: component.type,
        calculationType: component.calculationType,
        currentAmount: currentAmount.get(component.id) ?? null,
      })),
    };
  }

  async triggerFinalSettlement(
    offboardingId: string,
    taskId: string,
    dto: TriggerFinalSettlementDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeOffboardingRecord> {
    const offboarding = await this.findActiveOrThrow(offboardingId, user);
    const task = await this.getTaskOrThrow(offboardingId, taskId);
    if (task.taskType !== OffboardingTaskType.final_settlement) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This task is not a final settlement task',
      });
    }

    if (task.status === OffboardingTaskStatus.skipped) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This step was skipped. Reopen it before generating a settlement.',
      });
    }
    if (task.payrollAdjustmentId) {
      const current = await this.prisma.unscoped.payrollAdjustment.findUnique({
        where: { id: task.payrollAdjustmentId },
        select: { status: true },
      });
      if (current && current.status !== PayrollAdjustmentStatus.cancelled) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'A settlement entry already exists. Cancel it to generate a new one.',
        });
      }
    } else {
      this.assertPending(task.status);
    }

    let lineOverrides: Array<{ componentId: string; amount: string }>;
    try {
      lineOverrides = settlementLinesToOverrides(dto.lines);
    } catch (error) {
      if (error instanceof SettlementLineError) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: error.message });
      }
      throw error;
    }
    if (lineOverrides.length) {
      const components = await this.prisma.unscoped.payComponent.findMany({
        where: {
          id: { in: lineOverrides.map((line) => line.componentId) },
          companyId: offboarding.companyId,
        },
        select: { id: true, calculationType: true },
      });
      if (components.length !== lineOverrides.length) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'One or more pay components were not found',
        });
      }
      if (components.some((c) => c.calculationType !== PayComponentCalculationType.fixed)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Only fixed-amount pay components can be used as settlement lines',
        });
      }
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
        message: 'A finalized payroll run is required to create a full & final settlement entry',
      });
    }

    const employeeName = `${offboarding.employee.firstName} ${offboarding.employee.lastName}`.trim();
    const lastDay = formatDateValue(offboarding.lastWorkingDate);
    const adjustment = await this.payrollAdjustmentsService.create(
      offboarding.companyId,
      {
        originalPayrollRunId: originalRun.id,
        applyToPayrollPeriodId: dto.applyToPayrollPeriodId,
        reason:
          dto.reason?.trim() ||
          `Full & final settlement for ${employeeName}${lastDay ? ` (last working day ${lastDay})` : ''}`,
        structureOverrides: [...lineOverrides, ...(dto.structureOverrides ?? [])],
      },
      user,
      { kind: PayrollAdjustmentKind.final_settlement },
    );

    await this.prisma.unscoped.employeeOffboardingTask.update({
      where: { id: taskId },
      data: {
        payrollAdjustmentId: adjustment.id,
        status: OffboardingTaskStatus.completed,
        completedAt: new Date(),
        completedByUserId: user.id,
      },
    });
    await this.logTaskChange(offboarding, user, task.id, 'settlement_generated', {
      payrollAdjustmentId: adjustment.id,
      replacedAdjustmentId: task.payrollAdjustmentId,
      adjustmentNetPay: adjustment.adjustmentNetPay,
    });
    await this.refreshOffboardingCompletion(offboardingId);

    return this.get(offboardingId, user);
  }

  async cancelFinalSettlement(
    offboardingId: string,
    dto: CancelFinalSettlementDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeOffboardingRecord> {
    const offboarding = await this.findActiveOrThrow(offboardingId, user);
    const task = offboarding.tasks.find(
      (row) =>
        row.taskType === OffboardingTaskType.final_settlement && row.payrollAdjustmentId,
    );
    if (!task?.payrollAdjustmentId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No settlement entry has been generated yet',
      });
    }

    const adjustment = await this.prisma.unscoped.payrollAdjustment.findUnique({
      where: { id: task.payrollAdjustmentId },
      select: { status: true },
    });
    if (adjustment && adjustment.status !== PayrollAdjustmentStatus.cancelled) {
      await this.payrollAdjustmentsService.cancel(
        offboarding.companyId,
        task.payrollAdjustmentId,
        user,
      );
    }

    await this.prisma.unscoped.employeeOffboardingTask.update({
      where: { id: task.id },
      data: {
        status: OffboardingTaskStatus.pending,
        completedAt: null,
        completedByUserId: null,
      },
    });
    await this.logTaskChange(offboarding, user, task.id, 'settlement_cancelled', {
      payrollAdjustmentId: task.payrollAdjustmentId,
      reason: dto.reason?.trim() || null,
    });
    await this.reopenOffboardingIfIncomplete(offboardingId);

    return this.get(offboardingId, user);
  }

  private async present(
    row: OffboardingRow,
    user: AuthenticatedUser,
  ): Promise<EmployeeOffboardingRecord> {
    const [assets, access] = await Promise.all([
      this.loadAssets(row),
      this.loadAccess(row),
    ]);

    const active = assets.filter((asset) => asset.status === 'active');
    const pendingAssetCounts = new Map<string, number>();
    for (const task of row.tasks) {
      if (
        task.taskType === OffboardingTaskType.asset_return &&
        task.status === OffboardingTaskStatus.pending
      ) {
        pendingAssetCounts.set(
          task.id,
          active.filter((a) => !task.assetCategory || a.category === task.assetCategory).length,
        );
      }
    }

    const record = toOffboardingRecord(row, {
      includeTasks: true,
      pendingAssetCounts,
      assetsOutstandingCount: active.length,
    });
    record.assets = assets;
    record.access = access;
    if (user.employeeId === row.employeeId) {
      // Interviewer notes and rehire eligibility are not shared with the departing employee.
      record.exitInterview = null;
    }

    const settlementVisible = this.permissions.hasPermission(user, 'payroll', 'view');
    record.settlementVisible = settlementVisible;
    record.settlement = settlementVisible ? await this.loadSettlement(row) : null;
    return record;
  }

  private async loadAssets(row: OffboardingRow): Promise<OffboardingAssetRecord[]> {
    const taskIds = row.tasks.map((task) => task.id);
    const assignments = await this.prisma.unscoped.employeeAssetAssignment.findMany({
      where: {
        employeeId: row.employeeId,
        OR: [
          { status: AssetAssignmentStatus.active },
          { offboardingTaskId: { in: taskIds } },
          { returnedAt: { gte: row.startedAt } },
        ],
      },
      include: { asset: true },
      orderBy: [{ status: 'asc' }, { assignedAt: 'desc' }],
    });

    const returnTasks = row.tasks.filter(
      (task) => task.taskType === OffboardingTaskType.asset_return,
    );

    return assignments.map((assignment) => ({
      assignmentId: assignment.id,
      assetId: assignment.assetId,
      assetName: assignment.asset.name,
      assetTag: assignment.asset.assetTag,
      category: assignment.asset.category,
      serialNumber: assignment.asset.serialNumber,
      purchaseValue: assignment.asset.purchaseValue
        ? formatMoney(assignment.asset.purchaseValue)
        : null,
      currency: assignment.asset.currency,
      status: assignment.status,
      assignedAt: assignment.assignedAt.toISOString(),
      returnedAt: assignment.returnedAt?.toISOString() ?? null,
      conditionOnAssign: assignment.conditionOnAssign,
      conditionOnReturn: assignment.conditionOnReturn,
      notes: assignment.notes,
      coveredByChecklist: returnTasks.some(
        (task) => task.assetCategory == null || task.assetCategory === assignment.asset.category,
      ),
    }));
  }

  private async loadAccess(row: OffboardingRow): Promise<OffboardingAccessStatus> {
    const account = await this.prisma.unscoped.user.findFirst({
      where: { employeeId: row.employeeId },
      select: { id: true, email: true, isActive: true, lastLoginAt: true },
    });
    const activeSessionCount = account
      ? await this.prisma.unscoped.refreshToken.count({
          where: { userId: account.id, revokedAt: null, expiresAt: { gt: new Date() } },
        })
      : 0;

    return {
      hasPortalAccount: account != null,
      email: account?.email ?? null,
      accountActive: account?.isActive ?? false,
      activeSessionCount,
      lastLoginAt: account?.lastLoginAt?.toISOString() ?? null,
      revokedAt: row.accessRevokedAt?.toISOString() ?? null,
    };
  }

  private async loadSettlement(row: OffboardingRow): Promise<OffboardingSettlementRecord | null> {
    const task = row.tasks.find(
      (t) => t.taskType === OffboardingTaskType.final_settlement && t.payrollAdjustmentId,
    );
    if (!task?.payrollAdjustmentId) return null;

    const adjustment = await this.prisma.unscoped.payrollAdjustment.findFirst({
      where: { id: task.payrollAdjustmentId, companyId: row.companyId },
      include: {
        originalPayrollRun: {
          select: {
            id: true,
            status: true,
            payCurrency: true,
            calculationSnapshot: true,
            payrollPeriod: { select: { startDate: true, endDate: true } },
          },
        },
        applyToPayrollPeriod: true,
      },
    });
    if (!adjustment) return null;

    const record = this.payrollAdjustmentsService.toRecord(adjustment);
    const original =
      (adjustment.originalPayrollRun.calculationSnapshot as unknown as PayrollCalculationPreview | null) ??
      null;
    const period = adjustment.applyToPayrollPeriod;

    return {
      adjustment: record,
      currency: adjustment.originalPayrollRun.payCurrency,
      originalRun: {
        id: adjustment.originalPayrollRun.id,
        periodStart: formatDateOnly(adjustment.originalPayrollRun.payrollPeriod.startDate),
        periodEnd: formatDateOnly(adjustment.originalPayrollRun.payrollPeriod.endDate),
        status: adjustment.originalPayrollRun.status,
      },
      applyToPeriod: period
        ? {
            id: period.id,
            startDate: formatDateOnly(period.startDate),
            endDate: formatDateOnly(period.endDate),
            paymentDate: formatDateOnly(period.paymentDate),
            status: period.status,
          }
        : null,
      lines: buildSettlementLines(original, record.calculation),
      originalBreakdownAvailable: original != null,
    };
  }

  private async createFromTemplate(input: {
    tenantId: string;
    companyId: string;
    employeeId: string;
    template: TemplateWithItems;
    anchorDate?: string;
    lastWorkingDate?: string;
  }): Promise<OffboardingRow> {
    const anchor = new Date(`${input.anchorDate ?? todayIsoDate()}T00:00:00.000Z`);
    const lastWorkingDate = input.lastWorkingDate
      ? new Date(`${input.lastWorkingDate}T00:00:00.000Z`)
      : null;

    return this.prisma.unscoped.employeeOffboarding.create({
      data: {
        tenantId: input.tenantId,
        companyId: input.companyId,
        employeeId: input.employeeId,
        templateId: input.template.id,
        lastWorkingDate,
        tasks: {
          create: input.template.items.map((item) => ({
            templateItemId: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            taskType: item.taskType,
            assetCategory: item.assetCategory,
            assigneeLabel: item.assigneeLabel,
            dueDate:
              item.dueDaysOffset != null ? addDays(anchor, item.dueDaysOffset) : lastWorkingDate,
            sortOrder: item.sortOrder,
            isRequired: item.isRequired,
          })),
        },
      },
      include: OFFBOARDING_INCLUDE,
    });
  }

  private async completeTaskRow(taskId: string, userId: string) {
    return this.prisma.unscoped.employeeOffboardingTask.update({
      where: { id: taskId },
      data: {
        status: OffboardingTaskStatus.completed,
        completedAt: new Date(),
        completedByUserId: userId,
      },
      include: TASK_INCLUDE,
    });
  }

  private async logTaskChange(
    offboarding: { id: string; tenantId: string },
    user: AuthenticatedUser,
    taskId: string,
    change: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.log({
      tenantId: offboarding.tenantId,
      userId: user.id,
      action: 'update',
      module: 'employee',
      recordId: offboarding.id,
      newValue: { taskId, change, ...details },
    });
  }

  private refreshOffboardingCompletion(offboardingId: string): Promise<void> {
    return this.taskSync.refreshOffboardingCompletion(offboardingId);
  }

  private reopenOffboardingIfIncomplete(offboardingId: string): Promise<void> {
    return this.taskSync.reopenOffboardingIfIncomplete(offboardingId);
  }

  private assertPending(status: OffboardingTaskStatus): void {
    if (status !== OffboardingTaskStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Task is not pending',
      });
    }
  }

  private async findActiveOrThrow(offboardingId: string, user: AuthenticatedUser) {
    const offboarding = await this.findOrThrow(offboardingId);
    await this.companyScope.assertCompanyInTenant(offboarding.companyId);
    await this.dataScope.assertEmployeeInScope(user, offboarding.employeeId, {
      includeSelf: false,
    });
    if (offboarding.status === OffboardingStatus.cancelled) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This offboarding has been cancelled',
      });
    }
    return offboarding;
  }

  private async findOrThrow(offboardingId: string): Promise<OffboardingRow> {
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
      include: TASK_INCLUDE,
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
