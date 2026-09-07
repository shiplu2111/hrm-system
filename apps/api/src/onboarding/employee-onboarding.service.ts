import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OnboardingTaskStatus,
  OnboardingTaskType,
} from '@prisma/client';
import type { EmployeeOnboardingRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { CompanyAssetsService } from '../assets/company-assets.service';
import { PrismaService } from '../database/prisma.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { OnboardingChecklistTemplatesService } from './onboarding-checklist-templates.service';
import { OnboardingTaskSyncService } from './onboarding-task-sync.service';
import type {
  AssignOnboardingAssetsDto,
  ListEmployeeOnboardingsQueryDto,
  StartEmployeeOnboardingDto,
} from './dto/onboarding.dto';
import {
  addDays,
  formatDateValue,
  toOnboardingRecord,
  toTaskRecord,
} from './onboarding.utils';

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
    include: {
      documentType: { select: { name: true, requiresVerification: true } },
      employeeDocument: { select: { verifiedAt: true } },
      companyAsset: { select: { name: true } },
    },
  },
  _count: { select: { tasks: true } },
};

const TASK_INCLUDE = {
  documentType: { select: { name: true, requiresVerification: true } },
  employeeDocument: { select: { verifiedAt: true } },
  companyAsset: { select: { name: true } },
};

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
  ) {}

  async list(
    companyId: string,
    query: ListEmployeeOnboardingsQueryDto,
  ): Promise<EmployeeOnboardingRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.employeeOnboarding.findMany({
      where: {
        companyId,
        ...(query.status ? { status: query.status } : {}),
      },
      include: ONBOARDING_INCLUDE,
      orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
    });

    const records: EmployeeOnboardingRecord[] = [];
    for (const row of rows) {
      const pendingCounts = await this.buildPendingAssetCounts(row);
      records.push(toOnboardingRecord(row, true, pendingCounts));
    }
    return records;
  }

  async get(onboardingId: string): Promise<EmployeeOnboardingRecord> {
    const row = await this.findOrThrow(onboardingId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    const pendingCounts = await this.buildPendingAssetCounts(row);
    return toOnboardingRecord(row, true, pendingCounts);
  }

  async getForEmployee(employeeId: string): Promise<EmployeeOnboardingRecord | null> {
    const row = await this.prisma.unscoped.employeeOnboarding.findUnique({
      where: { employeeId },
      include: ONBOARDING_INCLUDE,
    });
    if (!row) return null;
    await this.companyScope.assertCompanyInTenant(row.companyId);
    const pendingCounts = await this.buildPendingAssetCounts(row);
    return toOnboardingRecord(row, true, pendingCounts);
  }

  async start(
    companyId: string,
    dto: StartEmployeeOnboardingDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeOnboardingRecord> {
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
          where: {
            id: dto.templateId,
            companyId,
            isActive: true,
          },
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
        message: 'No active onboarding checklist template found for this company',
      });
    }

    const startDate = dto.startDate
      ? new Date(`${dto.startDate}T00:00:00.000Z`)
      : employee.hireDate;

    const onboarding = await this.prisma.unscoped.employeeOnboarding.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        employeeId: dto.employeeId,
        templateId: template.id,
        tasks: {
          create: template.items.map((item) => ({
            templateItemId: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            taskType: item.taskType,
            documentTypeId: item.documentTypeId,
            assetCategory: item.assetCategory,
            policyDocumentUrl: item.policyDocumentUrl,
            assigneeLabel: item.assigneeLabel,
            dueDate: item.dueDaysOffset != null
              ? addDays(startDate, item.dueDaysOffset)
              : null,
            sortOrder: item.sortOrder,
            isRequired: item.isRequired,
          })),
        },
      },
      include: ONBOARDING_INCLUDE,
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'employee',
      recordId: onboarding.id,
      newValue: {
        employeeId: dto.employeeId,
        templateId: template.id,
        taskCount: template.items.length,
      },
    });

    const sendWelcome = dto.sendWelcome !== false;
    if (sendWelcome) {
      await this.sendWelcomeNotification(onboarding.id);
    }

    return toOnboardingRecord(onboarding, true);
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

    const startDate = new Date(`${input.hireDate}T00:00:00.000Z`);

    const onboarding = await this.prisma.unscoped.employeeOnboarding.create({
      data: {
        tenantId: input.tenantId,
        companyId: input.companyId,
        employeeId: input.employeeId,
        templateId: template.id,
        tasks: {
          create: template.items.map((item) => ({
            templateItemId: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            taskType: item.taskType,
            documentTypeId: item.documentTypeId,
            assetCategory: item.assetCategory,
            policyDocumentUrl: item.policyDocumentUrl,
            assigneeLabel: item.assigneeLabel,
            dueDate: item.dueDaysOffset != null
              ? addDays(startDate, item.dueDaysOffset)
              : null,
            sortOrder: item.sortOrder,
            isRequired: item.isRequired,
          })),
        },
      },
      include: ONBOARDING_INCLUDE,
    });

    await this.auditService.log({
      tenantId: input.tenantId,
      userId: input.userId,
      action: 'create',
      module: 'employee',
      recordId: onboarding.id,
      newValue: {
        employeeId: input.employeeId,
        templateId: template.id,
        source: 'hire',
      },
    });

    await this.sendWelcomeNotification(onboarding.id);
    return toOnboardingRecord(onboarding, true);
  }

  async completeTask(
    onboardingId: string,
    taskId: string,
    user: AuthenticatedUser,
  ) {
    const onboarding = await this.findOrThrow(onboardingId);
    await this.companyScope.assertCompanyInTenant(onboarding.companyId);

    const task = await this.getTaskOrThrow(onboardingId, taskId);

    if (task.status !== OnboardingTaskStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Task is not pending',
      });
    }

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

    await this.taskSync.refreshOnboardingCompletion(onboardingId);
    return toTaskRecord(updated);
  }

  async skipTask(
    onboardingId: string,
    taskId: string,
    user: AuthenticatedUser,
  ) {
    const onboarding = await this.findOrThrow(onboardingId);
    await this.companyScope.assertCompanyInTenant(onboarding.companyId);

    const task = await this.getTaskOrThrow(onboardingId, taskId);
    if (task.status !== OnboardingTaskStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Task is not pending',
      });
    }

    const updated = await this.prisma.unscoped.employeeOnboardingTask.update({
      where: { id: taskId },
      data: {
        status: OnboardingTaskStatus.skipped,
        completedAt: new Date(),
        completedByUserId: user.id,
      },
      include: TASK_INCLUDE,
    });

    await this.taskSync.refreshOnboardingCompletion(onboardingId);
    return toTaskRecord(updated);
  }

  async assignAssetsForTask(
    onboardingId: string,
    taskId: string,
    dto: AssignOnboardingAssetsDto,
    user: AuthenticatedUser,
  ) {
    const onboarding = await this.findOrThrow(onboardingId);
    await this.companyScope.assertCompanyInTenant(onboarding.companyId);

    const task = await this.getTaskOrThrow(onboardingId, taskId);
    if (task.taskType !== OnboardingTaskType.provisioning) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This task is not an asset provisioning task',
      });
    }
    if (task.status !== OnboardingTaskStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Task is not pending',
      });
    }

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
    const onboarding = await this.findOrThrow(onboardingId);
    await this.companyScope.assertCompanyInTenant(onboarding.companyId);

    const task = await this.getTaskOrThrow(onboardingId, taskId);
    if (task.taskType !== OnboardingTaskType.policy_acceptance) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'This task is not a policy acceptance task',
      });
    }
    if (task.status !== OnboardingTaskStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Task is not pending',
      });
    }

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

    await this.taskSync.refreshOnboardingCompletion(onboardingId);
    return toTaskRecord(updated);
  }

  async resendWelcome(onboardingId: string): Promise<EmployeeOnboardingRecord> {
    const row = await this.findOrThrow(onboardingId);
    await this.companyScope.assertCompanyInTenant(row.companyId);
    await this.sendWelcomeNotification(onboardingId);
    const refreshed = await this.findOrThrow(onboardingId);
    const pendingCounts = await this.buildPendingAssetCounts(refreshed);
    return toOnboardingRecord(refreshed, true, pendingCounts);
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
