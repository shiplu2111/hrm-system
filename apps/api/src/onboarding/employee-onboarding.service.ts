import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OnboardingTaskStatus,
  OnboardingTaskType,
  type Prisma,
} from '@prisma/client';
import type { EmployeeOnboardingRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { CompanyAssetsService } from '../assets/company-assets.service';
import { PrismaService } from '../database/prisma.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
import { OnboardingChecklistTemplatesService } from './onboarding-checklist-templates.service';
import { OnboardingTaskSyncService } from './onboarding-task-sync.service';
import type {
  AssignOnboardingAssetsDto,
  CompleteOnboardingTaskDto,
  ListEmployeeOnboardingsQueryDto,
  ReopenOnboardingTaskDto,
  SkipOnboardingTaskDto,
  StartEmployeeOnboardingDto,
} from './dto/onboarding.dto';
import {
  addDays,
  formatDateValue,
  toOnboardingRecord,
  toTaskRecord,
} from './onboarding.utils';

const TASK_INCLUDE = {
  documentType: { select: { name: true, requiresVerification: true } },
  employeeDocument: { select: { verifiedAt: true, fileKey: true, createdAt: true } },
  companyAsset: { select: { name: true } },
};

const ONBOARDING_INCLUDE = {
  employee: {
    select: {
      firstName: true,
      lastName: true,
      employeeNumber: true,
      hireDate: true,
      designation: { select: { name: true } },
    },
  },
  template: { select: { name: true } },
  tasks: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    include: TASK_INCLUDE,
  },
  _count: { select: { tasks: true } },
};

type TemplateItemForCopy = Prisma.OnboardingChecklistTemplateItemGetPayload<object>;

@Injectable()
export class EmployeeOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly templatesService: OnboardingChecklistTemplatesService,
    private readonly taskSync: OnboardingTaskSyncService,
    private readonly assetsService: CompanyAssetsService,
    private readonly notificationEngine: NotificationEngineService,
    private readonly auditService: AuditService,
    private readonly dataScope: DataScopeService,
  ) {}

  async list(
    companyId: string,
    query: ListEmployeeOnboardingsQueryDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeOnboardingRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.employeeOnboarding.findMany({
      where: {
        companyId,
        employeeId: await this.dataScope.employeeIdFilter(user),
        ...(query.status ? { status: query.status } : {}),
      },
      include: ONBOARDING_INCLUDE,
      orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
    });

    return rows.map((row) => toOnboardingRecord(row));
  }

  async get(
    onboardingId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeeOnboardingRecord> {
    const row = await this.findOrThrow(onboardingId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    await this.dataScope.assertEmployeeInScope(user, row.employeeId);
    return this.present(row);
  }

  async getForEmployee(
    employeeId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeeOnboardingRecord | null> {
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    const row = await this.prisma.unscoped.employeeOnboarding.findUnique({
      where: { employeeId },
      include: ONBOARDING_INCLUDE,
    });
    if (!row) return null;
    await this.companyScope.assertCompanyInTenant(row.companyId);
    return this.present(row);
  }

  async start(
    companyId: string,
    dto: StartEmployeeOnboardingDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeOnboardingRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    await this.dataScope.assertEmployeeInScope(user, dto.employeeId);

    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: dto.employeeId, companyId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const existing = await this.prisma.unscoped.employeeOnboarding.findUnique({
      where: { employeeId: dto.employeeId },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This employee already has an onboarding record',
      });
    }

    const template = dto.templateId
      ? await this.prisma.unscoped.onboardingChecklistTemplate.findFirst({
          where: { id: dto.templateId, companyId, isActive: true },
          include: { items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
        })
      : await this.templatesService.findDefaultTemplate(companyId);

    if (!template) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: dto.templateId
          ? 'Checklist template not found or inactive'
          : 'No default onboarding checklist template is set for this company',
      });
    }
    if (template.items.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `"${template.name}" has no checklist items yet`,
      });
    }

    const startDate = dto.startDate
      ? new Date(`${dto.startDate.slice(0, 10)}T00:00:00.000Z`)
      : employee.hireDate;

    const onboardingId = await this.createFromTemplate({
      tenantId: company.tenantId,
      companyId,
      employeeId: dto.employeeId,
      templateId: template.id,
      items: template.items,
      startDate,
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'employee',
      recordId: onboardingId,
      newValue: {
        employeeId: dto.employeeId,
        templateId: template.id,
        taskCount: template.items.length,
        startDate: formatDateValue(startDate),
      },
    });

    if (dto.sendWelcome !== false) {
      await this.sendWelcomeNotification(onboardingId);
    }

    return this.present(await this.findOrThrow(onboardingId));
  }

  async startFromHire(input: {
    tenantId: string;
    companyId: string;
    employeeId: string;
    hireDate: string;
    userId: string;
  }): Promise<EmployeeOnboardingRecord | null> {
    const template = await this.templatesService.findDefaultTemplate(
      input.companyId,
    );
    if (!template || template.items.length === 0) {
      return null;
    }

    const existing = await this.prisma.unscoped.employeeOnboarding.findUnique({
      where: { employeeId: input.employeeId },
    });
    if (existing) {
      return null;
    }

    const onboardingId = await this.createFromTemplate({
      tenantId: input.tenantId,
      companyId: input.companyId,
      employeeId: input.employeeId,
      templateId: template.id,
      items: template.items,
      startDate: new Date(`${input.hireDate}T00:00:00.000Z`),
    });

    await this.auditService.log({
      tenantId: input.tenantId,
      userId: input.userId,
      action: 'create',
      module: 'employee',
      recordId: onboardingId,
      newValue: {
        employeeId: input.employeeId,
        templateId: template.id,
        source: 'hire',
      },
    });

    await this.sendWelcomeNotification(onboardingId);
    return toOnboardingRecord(await this.findOrThrow(onboardingId), true);
  }

  async completeTask(
    onboardingId: string,
    taskId: string,
    dto: CompleteOnboardingTaskDto,
    user: AuthenticatedUser,
  ) {
    const onboarding = await this.findActiveOrThrow(onboardingId, user);
    const task = await this.getTaskOrThrow(onboardingId, taskId);
    this.assertPending(task.status);

    if (
      task.taskType === OnboardingTaskType.document_collection ||
      task.taskType === OnboardingTaskType.policy_acceptance
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'Document and policy tasks must be completed via document upload, verification, or policy acceptance',
      });
    }

    if (
      task.taskType === OnboardingTaskType.provisioning &&
      task.assetCategory
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Assign an asset from the asset register to complete this task',
      });
    }

    const updated = await this.prisma.unscoped.employeeOnboardingTask.update({
      where: { id: taskId },
      data: {
        status: OnboardingTaskStatus.completed,
        completedAt: new Date(),
        completedByUserId: user.id,
      },
      include: TASK_INCLUDE,
    });

    await this.logTaskChange(onboarding.tenantId, user, onboardingId, task, 'completed', {
      note: dto.note?.trim() || undefined,
    });
    await this.taskSync.refreshOnboardingCompletion(onboardingId);
    return toTaskRecord(updated);
  }

  async skipTask(
    onboardingId: string,
    taskId: string,
    dto: SkipOnboardingTaskDto,
    user: AuthenticatedUser,
  ) {
    const onboarding = await this.findActiveOrThrow(onboardingId, user, {
      includeSelf: false,
    });
    const task = await this.getTaskOrThrow(onboardingId, taskId);
    this.assertPending(task.status);

    const updated = await this.prisma.unscoped.employeeOnboardingTask.update({
      where: { id: taskId },
      data: {
        status: OnboardingTaskStatus.skipped,
        completedAt: new Date(),
        completedByUserId: user.id,
      },
      include: TASK_INCLUDE,
    });

    await this.logTaskChange(onboarding.tenantId, user, onboardingId, task, 'skipped', {
      reason: dto.reason?.trim() || undefined,
    });
    await this.taskSync.refreshOnboardingCompletion(onboardingId);
    return toTaskRecord(updated);
  }

  /**
   * Puts a skipped or hand-completed task back to pending. Tasks completed by a document
   * or an asset assignment follow that record instead: replace the document or return the asset.
   */
  async reopenTask(
    onboardingId: string,
    taskId: string,
    dto: ReopenOnboardingTaskDto,
    user: AuthenticatedUser,
  ) {
    const onboarding = await this.findActiveOrThrow(onboardingId, user);
    const task = await this.getTaskOrThrow(onboardingId, taskId);

    if (task.status === OnboardingTaskStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Task is already pending',
      });
    }

    if (task.status === OnboardingTaskStatus.completed) {
      if (task.companyAssetId) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'This task was completed by an asset assignment. Return the asset from Asset Management instead.',
        });
      }
      if (task.employeeDocumentId && !task.policyAcceptedAt) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'This task was completed by an uploaded document. Replace or delete the document instead.',
        });
      }
    }

    const updated = await this.prisma.unscoped.employeeOnboardingTask.update({
      where: { id: taskId },
      data: {
        status: OnboardingTaskStatus.pending,
        completedAt: null,
        completedByUserId: null,
        policyAcceptedAt: null,
      },
      include: TASK_INCLUDE,
    });

    await this.logTaskChange(onboarding.tenantId, user, onboardingId, task, 'reopened', {
      reason: dto.reason?.trim() || undefined,
    });
    await this.taskSync.reopenOnboardingIfIncomplete(onboardingId);
    return toTaskRecord(updated);
  }

  async assignAssetsForTask(
    onboardingId: string,
    taskId: string,
    dto: AssignOnboardingAssetsDto,
    user: AuthenticatedUser,
  ) {
    const onboarding = await this.findActiveOrThrow(onboardingId, user);

    const task = await this.getTaskOrThrow(onboardingId, taskId);
    if (task.taskType !== OnboardingTaskType.provisioning) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This task is not an asset provisioning task',
      });
    }
    this.assertPending(task.status);

    const asset = await this.prisma.unscoped.companyAsset.findFirst({
      where: {
        id: dto.assetId,
        companyId: onboarding.companyId,
        status: 'available',
        ...(task.assetCategory ? { category: task.assetCategory } : {}),
      },
    });

    if (!asset) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: task.assetCategory
          ? `No available ${task.assetCategory.replace('_', ' ')} asset found`
          : 'Selected asset is not available',
      });
    }

    await this.assetsService.assign(
      asset.id,
      {
        employeeId: onboarding.employeeId,
        assignedAt: dto.assignedAt,
        conditionOnAssign: dto.conditionOnAssign,
        notes: dto.notes,
        onboardingTaskId: taskId,
      },
      user,
    );

    const updated = await this.prisma.unscoped.employeeOnboardingTask.findUnique({
      where: { id: taskId },
      include: TASK_INCLUDE,
    });

    return toTaskRecord(updated!);
  }

  async acceptPolicy(
    onboardingId: string,
    taskId: string,
    user: AuthenticatedUser,
  ) {
    const onboarding = await this.findActiveOrThrow(onboardingId, user);

    const task = await this.getTaskOrThrow(onboardingId, taskId);
    if (task.taskType !== OnboardingTaskType.policy_acceptance) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This task is not a policy acceptance task',
      });
    }
    this.assertPending(task.status);

    if (task.documentTypeId) {
      const docType = await this.prisma.unscoped.documentType.findUnique({
        where: { id: task.documentTypeId },
        select: { requiresVerification: true, name: true },
      });

      if (docType?.requiresVerification) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `${docType.name} requires an uploaded and verified document. Upload it from the employee profile documents section.`,
        });
      }
    }

    const updated = await this.prisma.unscoped.employeeOnboardingTask.update({
      where: { id: taskId },
      data: {
        status: OnboardingTaskStatus.completed,
        policyAcceptedAt: new Date(),
        completedAt: new Date(),
        completedByUserId: user.id,
      },
      include: TASK_INCLUDE,
    });

    await this.logTaskChange(onboarding.tenantId, user, onboardingId, task, 'policy_accepted');
    await this.taskSync.refreshOnboardingCompletion(onboardingId);
    return toTaskRecord(updated);
  }

  async resendWelcome(
    onboardingId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeeOnboardingRecord> {
    const row = await this.findOrThrow(onboardingId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    await this.dataScope.assertEmployeeInScope(user, row.employeeId);
    await this.sendWelcomeNotification(onboardingId);
    return this.present(await this.findOrThrow(onboardingId));
  }

  private async createFromTemplate(input: {
    tenantId: string;
    companyId: string;
    employeeId: string;
    templateId: string;
    items: TemplateItemForCopy[];
    startDate: Date;
  }): Promise<string> {
    const onboarding = await this.prisma.unscoped.employeeOnboarding.create({
      data: {
        tenantId: input.tenantId,
        companyId: input.companyId,
        employeeId: input.employeeId,
        templateId: input.templateId,
        tasks: {
          create: input.items.map((item) => ({
            templateItemId: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            taskType: item.taskType,
            documentTypeId: item.documentTypeId,
            assetCategory: item.assetCategory,
            policyDocumentUrl: item.policyDocumentUrl,
            assigneeLabel: item.assigneeLabel,
            dueDate:
              item.dueDaysOffset != null
                ? addDays(input.startDate, item.dueDaysOffset)
                : null,
            sortOrder: item.sortOrder,
            isRequired: item.isRequired,
          })),
        },
      },
      select: { id: true },
    });

    await this.taskSync.linkExistingDocuments(onboarding.id);
    await this.taskSync.refreshOnboardingCompletion(onboarding.id);
    return onboarding.id;
  }

  private async present(
    row: Awaited<ReturnType<EmployeeOnboardingService['findOrThrow']>>,
  ): Promise<EmployeeOnboardingRecord> {
    const pendingCounts = await this.buildPendingAssetCounts(row);
    return toOnboardingRecord(row, true, pendingCounts);
  }

  private async logTaskChange(
    tenantId: string,
    user: AuthenticatedUser,
    onboardingId: string,
    task: { id: string; title: string; status: OnboardingTaskStatus },
    change: 'completed' | 'skipped' | 'reopened' | 'policy_accepted',
    extra: Record<string, string | undefined> = {},
  ): Promise<void> {
    await this.auditService.log({
      tenantId,
      userId: user.id,
      action: 'update',
      module: 'employee',
      recordId: onboardingId,
      oldValue: { taskId: task.id, title: task.title, status: task.status },
      newValue: { taskId: task.id, title: task.title, change, ...extra },
    });
  }

  private assertPending(status: OnboardingTaskStatus): void {
    if (status !== OnboardingTaskStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Task is not pending',
      });
    }
  }

  private async findActiveOrThrow(
    onboardingId: string,
    user: AuthenticatedUser,
    scopeOptions?: { includeSelf?: boolean },
  ) {
    const onboarding = await this.findOrThrow(onboardingId);
    await this.companyScope.assertCompanyInTenant(onboarding.companyId);
    await this.dataScope.assertEmployeeInScope(user, onboarding.employeeId, scopeOptions);
    if (onboarding.status === 'cancelled') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This onboarding was cancelled',
      });
    }
    return onboarding;
  }

  private async buildPendingAssetCounts(
    row: {
      companyId: string;
      tasks?: Array<{
        id: string;
        taskType: string;
        assetCategory: string | null;
        status: string;
      }>;
    },
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (!row.tasks) return counts;

    for (const task of row.tasks) {
      if (
        task.taskType !== OnboardingTaskType.provisioning ||
        task.status !== OnboardingTaskStatus.pending ||
        !task.assetCategory
      ) {
        continue;
      }

      const available = await this.taskSync.countAvailableAssetsForTask(
        row.companyId,
        task.assetCategory,
      );
      counts.set(task.id, available);
    }

    return counts;
  }

  private async sendWelcomeNotification(onboardingId: string): Promise<void> {
    const onboarding = await this.prisma.unscoped.employeeOnboarding.findUnique({
      where: { id: onboardingId },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            hireDate: true,
          },
        },
        company: { select: { name: true } },
        tasks: {
          where: { isRequired: true, status: OnboardingTaskStatus.pending },
          select: { id: true },
        },
      },
    });

    if (!onboarding) return;

    const employeeName =
      `${onboarding.employee.firstName} ${onboarding.employee.lastName}`.trim();

    try {
      await this.notificationEngine.emit({
        tenantId: onboarding.tenantId,
        companyId: onboarding.companyId,
        eventType: 'onboarding.welcome',
        subjectEmployeeId: onboarding.employeeId,
        variables: {
          employee_name: employeeName,
          company_name: onboarding.company.name,
          start_date: formatDateValue(onboarding.employee.hireDate) ?? '',
          pending_task_count: String(onboarding.tasks.length),
        },
        payload: {
          onboardingId: onboarding.id,
          employeeId: onboarding.employeeId,
          eventType: 'onboarding.welcome',
        },
      });

      await this.prisma.unscoped.employeeOnboarding.update({
        where: { id: onboardingId },
        data: { welcomeSentAt: new Date() },
      });
    } catch {
      // Notification failures should not block onboarding creation.
    }
  }

  private async findOrThrow(onboardingId: string) {
    const row = await this.prisma.unscoped.employeeOnboarding.findUnique({
      where: { id: onboardingId },
      include: ONBOARDING_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee onboarding not found',
      });
    }
    return row;
  }

  private async getTaskOrThrow(onboardingId: string, taskId: string) {
    const task = await this.prisma.unscoped.employeeOnboardingTask.findFirst({
      where: { id: taskId, onboardingId },
    });
    if (!task) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Onboarding task not found',
      });
    }
    return task;
  }
}
