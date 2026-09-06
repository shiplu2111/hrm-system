import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TimesheetEntryStatus,
  type TimesheetEntry,
  type TimesheetProject,
} from '@prisma/client';
import type {
  TimesheetEntryRecord,
  WorkflowInstanceRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import {
  detectTimeAnomaly,
  getTimeAnomalyThresholdMinutes,
} from '../attendance/attendance.utils';
import { PrismaService } from '../database/prisma.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { buildApprovalPendingVariables } from '../notifications/notification.helpers';
import { CompanyScopeService } from '../organization/company-scope.service';
import { WorkflowAssigneeService } from '../workflow/workflow-assignee.service';
import { getCurrentWorkflowStep } from '../workflow/workflow.utils';
import type {
  CreateTimesheetEntryDto,
  ListTimesheetEntriesQueryDto,
  TimesheetEntryActionDto,
} from './dto/timesheet.dto';
import { TimesheetProjectsService } from './timesheet-projects.service';
import { TimesheetWorkflowService } from './timesheet-workflow.service';
import {
  computeTimesheetHours,
  formatDateValue,
  parseDateString,
  parseIsoDateTime,
  resolveTimesheetDisplayStatus,
  splitBillableHours,
} from './timesheet.utils';

type EntryWithRelations = TimesheetEntry & {
  employee: { firstName: string; lastName: string; employeeNumber: string };
  project: TimesheetProject;
};

@Injectable()
export class TimesheetEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly projectsService: TimesheetProjectsService,
    private readonly timesheetWorkflow: TimesheetWorkflowService,
    private readonly workflowAssignee: WorkflowAssigneeService,
    private readonly notificationEngine: NotificationEngineService,
  ) {}

  async list(
    companyId: string,
    query: ListTimesheetEntriesQueryDto,
  ): Promise<TimesheetEntryRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.timesheetEntry.findMany({
      where: {
        companyId,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status
          ? { status: query.status as TimesheetEntryStatus }
          : {}),
        ...(query.fromDate || query.toDate
          ? {
              entryDate: {
                ...(query.fromDate
                  ? { gte: parseDateString(query.fromDate) }
                  : {}),
                ...(query.toDate ? { lte: parseDateString(query.toDate) } : {}),
              },
            }
          : {}),
      },
      include: this.defaultInclude(),
      orderBy: [{ entryDate: 'desc' }, { startTime: 'desc' }],
    });

    const records: TimesheetEntryRecord[] = [];
    for (const row of rows) {
      const workflow = await this.timesheetWorkflow.findForEntry(row.id);
      records.push(this.toRecord(row, workflow));
    }
    return records;
  }

  async create(
    companyId: string,
    dto: CreateTimesheetEntryDto,
    user: AuthenticatedUser,
    options?: { localId?: string; source?: string; timeAnomaly?: boolean },
  ): Promise<TimesheetEntryRecord> {
    const employee = await this.assertEmployee(dto.employeeId, companyId);
    const project = await this.projectsService.findOrThrow(dto.projectId);
    if (project.companyId !== companyId || !project.isActive) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Timesheet project is not available',
      });
    }

    const startTime = parseIsoDateTime(dto.startTime);
    const endTime = parseIsoDateTime(dto.endTime);
    if (endTime <= startTime) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'End time must be after start time',
      });
    }

    const breakMinutes = dto.breakMinutes ?? 0;
    const totalHours = computeTimesheetHours(startTime, endTime, breakMinutes);
    const isBillable = dto.isBillable ?? true;
    const { billableHours, nonBillableHours } = splitBillableHours(
      totalHours,
      isBillable,
    );

    const row = await this.prisma.unscoped.timesheetEntry.create({
      data: {
        tenantId: employee.tenantId,
        companyId,
        employeeId: dto.employeeId,
        localId: options?.localId ?? null,
        projectId: dto.projectId,
        entryDate: parseDateString(dto.entryDate),
        taskName: dto.taskName.trim(),
        startTime,
        endTime,
        breakMinutes,
        totalHours: new Prisma.Decimal(totalHours),
        isBillable,
        billableHours: new Prisma.Decimal(billableHours),
        nonBillableHours: new Prisma.Decimal(nonBillableHours),
        notes: dto.notes?.trim() ?? null,
        source: options?.source ?? 'manual',
        timeAnomaly: options?.timeAnomaly ?? false,
        status: TimesheetEntryStatus.draft,
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: employee.tenantId,
      userId: user.id,
      action: 'create',
      module: 'attendance',
      recordId: row.id,
    });

    if (dto.submit === true) {
      return this.submit(row.id, user);
    }

    return this.toRecord(row, null);
  }

  async submit(
    entryId: string,
    user: AuthenticatedUser,
  ): Promise<TimesheetEntryRecord> {
    const row = await this.findOrThrow(entryId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (row.status !== TimesheetEntryStatus.draft) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only draft entries can be submitted',
      });
    }

    const instance = await this.timesheetWorkflow.startForEntry({
      companyId: row.companyId,
      tenantId: row.tenantId,
      entryId: row.id,
      requesterEmployeeId: row.employeeId,
      requesterUserId: user.id,
    });

    const updated = await this.prisma.unscoped.timesheetEntry.update({
      where: { id: entryId },
      data: {
        status: TimesheetEntryStatus.pending_approval,
        submittedAt: new Date(),
      },
      include: this.defaultInclude(),
    });

    await this.emitApprovalPending(updated, instance);

    return this.toRecord(updated, instance);
  }

  async submitByLocalId(
    employeeId: string,
    localId: string,
    user: AuthenticatedUser,
  ): Promise<TimesheetEntryRecord> {
    const row = await this.prisma.unscoped.timesheetEntry.findFirst({
      where: { employeeId, localId },
      include: this.defaultInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Timesheet entry not found for local_id',
      });
    }
    return this.submit(row.id, user);
  }

  async approve(
    entryId: string,
    user: AuthenticatedUser,
    dto: TimesheetEntryActionDto,
  ): Promise<TimesheetEntryRecord> {
    const row = await this.findOrThrow(entryId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (row.status !== TimesheetEntryStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Entry is not pending approval',
      });
    }

    const transition = await this.timesheetWorkflow.approve({
      entryId: row.id,
      user,
      comment: dto.comment,
      audit: {
        tenantId: row.tenantId,
        module: 'attendance',
        recordId: row.id,
      },
      companyId: row.companyId,
      tenantId: row.tenantId,
      requesterEmployeeId: row.employeeId,
      requesterUserId: user.id,
    });

    let updated = row;
    if (transition.fullyApproved) {
      updated = await this.prisma.unscoped.timesheetEntry.update({
        where: { id: row.id },
        data: {
          status: TimesheetEntryStatus.approved,
          approvedAt: new Date(),
        },
        include: this.defaultInclude(),
      });
    } else if (!transition.rejected) {
      await this.emitApprovalPending(row, transition.instance);
    }

    return this.toRecord(updated, transition.instance);
  }

  async reject(
    entryId: string,
    user: AuthenticatedUser,
    dto: TimesheetEntryActionDto,
  ): Promise<TimesheetEntryRecord> {
    const row = await this.findOrThrow(entryId);
    await this.companyScope.assertCompanyInTenant(row.companyId);

    if (row.status !== TimesheetEntryStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Entry is not pending approval',
      });
    }

    const transition = await this.timesheetWorkflow.reject({
      entryId: row.id,
      user,
      comment: dto.comment,
      audit: {
        tenantId: row.tenantId,
        module: 'attendance',
        recordId: row.id,
      },
      companyId: row.companyId,
      tenantId: row.tenantId,
      requesterEmployeeId: row.employeeId,
      requesterUserId: user.id,
    });

    const updated = await this.prisma.unscoped.timesheetEntry.update({
      where: { id: row.id },
      data: {
        status: TimesheetEntryStatus.rejected,
        rejectedAt: new Date(),
      },
      include: this.defaultInclude(),
    });

    return this.toRecord(updated, transition.instance);
  }

  evaluateTimeAnomaly(
    deviceTimestamp: string,
    offlineDurationSeconds?: number,
  ): boolean {
    const deviceTime = parseIsoDateTime(deviceTimestamp);
    const serverTime = new Date();
    const adjustedServerMs =
      serverTime.getTime() -
      (offlineDurationSeconds ?? 0) * 1000;
    return detectTimeAnomaly(
      deviceTime,
      new Date(adjustedServerMs),
      getTimeAnomalyThresholdMinutes(),
    );
  }

  private async emitApprovalPending(
    entry: EntryWithRelations,
    instance: WorkflowInstanceRecord,
  ): Promise<void> {
    const currentStep = getCurrentWorkflowStep(instance.steps);
    if (!currentStep) return;

    const employeeName =
      `${entry.employee.firstName} ${entry.employee.lastName}`.trim();
    const approverUserIds = await this.workflowAssignee.resolveApproverUserIds({
      step: currentStep,
      requesterEmployeeId: entry.employeeId,
      tenantId: entry.tenantId,
    });

    if (approverUserIds.length === 0) return;

    await this.notificationEngine.emit({
      tenantId: entry.tenantId,
      companyId: entry.companyId,
      eventType: 'approval.pending',
      subjectEmployeeId: entry.employeeId,
      directUserIds: approverUserIds,
      variables: buildApprovalPendingVariables({
        employeeName,
        entityLabel: 'timesheet entry',
        stepName: currentStep.roleName,
      }),
      payload: {
        entryId: entry.id,
        workflowInstanceId: instance.id,
        entityType: 'timesheet_entry',
        eventType: 'approval.pending',
      },
    });
  }

  private async assertEmployee(employeeId: string, companyId: string) {
    const row = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true, tenantId: true, companyId: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }
    return row;
  }

  async findOrThrow(entryId: string): Promise<EntryWithRelations> {
    const row = await this.prisma.unscoped.timesheetEntry.findUnique({
      where: { id: entryId },
      include: this.defaultInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Timesheet entry not found',
      });
    }
    return row;
  }

  private defaultInclude() {
    return {
      employee: {
        select: { firstName: true, lastName: true, employeeNumber: true },
      },
      project: true,
    };
  }

  private toRecord(
    row: EntryWithRelations,
    workflow: WorkflowInstanceRecord | null,
  ): TimesheetEntryRecord {
    const status = row.status as TimesheetEntryRecord['status'];
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      localId: row.localId,
      projectId: row.projectId,
      projectName: row.project.name,
      entryDate: formatDateValue(row.entryDate),
      taskName: row.taskName,
      startTime: row.startTime.toISOString(),
      endTime: row.endTime.toISOString(),
      breakMinutes: row.breakMinutes,
      totalHours: Number(row.totalHours),
      isBillable: row.isBillable,
      billableHours: Number(row.billableHours),
      nonBillableHours: Number(row.nonBillableHours),
      status,
      displayStatus: resolveTimesheetDisplayStatus({ status, workflow }),
      timeAnomaly: row.timeAnomaly,
      notes: row.notes,
      source: row.source,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      workflow,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
