import {
  BadRequestException,
  ForbiddenException,
  HttpException,
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
  TimesheetApprovalQueue,
  TimesheetBulkActionResult,
  TimesheetEntryRecord,
  WorkflowApprovalRoute,
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
import { DataScopeService } from '../rbac/data-scope.service';
import { PermissionsService } from '../rbac/permissions.service';
import { WorkflowAssigneeService } from '../workflow/workflow-assignee.service';
import { getCurrentWorkflowStep } from '../workflow/workflow.utils';
import type {
  BulkTimesheetActionDto,
  CreateTimesheetEntryDto,
  ListTimesheetApprovalsQueryDto,
  ListTimesheetEntriesQueryDto,
  RejectTimesheetEntryDto,
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

function errorMessage(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse() as { message?: unknown } | string;
    if (typeof body === 'string') return body;
    if (typeof body.message === 'string') return body.message;
  }
  return err instanceof Error ? err.message : 'Action failed';
}

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
    private readonly dataScope: DataScopeService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(
    companyId: string,
    query: ListTimesheetEntriesQueryDto,
    user: AuthenticatedUser,
  ): Promise<TimesheetEntryRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (query.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, query.employeeId);
    }
    const employeeFilter = await this.dataScope.employeeIdFilter(user);

    const rows = await this.prisma.unscoped.timesheetEntry.findMany({
      where: {
        companyId,
        employeeId: query.employeeId ?? employeeFilter,
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...this.dateRangeFilter(query.fromDate, query.toDate),
      },
      include: this.defaultInclude(),
      orderBy: [{ entryDate: 'desc' }, { startTime: 'desc' }],
    });

    return this.presentMany(rows, user);
  }

  /**
   * Pending entries the user may review: inside their data scope, never their own, and
   * (for `scope=mine`) only those whose current workflow step they can act on.
   */
  async listApprovals(
    companyId: string,
    query: ListTimesheetApprovalsQueryDto,
    user: AuthenticatedUser,
  ): Promise<TimesheetApprovalQueue> {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (query.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, query.employeeId, { includeSelf: false });
    }
    const employeeFilter = await this.dataScope.employeeIdFilter(user, { includeSelf: false });

    const rows = await this.prisma.unscoped.timesheetEntry.findMany({
      where: {
        companyId,
        status: TimesheetEntryStatus.pending_approval,
        employeeId: query.employeeId ?? employeeFilter,
        ...(user.employeeId ? { NOT: { employeeId: user.employeeId } } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...this.dateRangeFilter(query.fromDate, query.toDate),
      },
      include: this.defaultInclude(),
      orderBy: [{ submittedAt: 'asc' }, { entryDate: 'asc' }],
    });

    const [records, route] = await Promise.all([
      this.presentMany(rows, user),
      this.timesheetWorkflow.resolveDefaultRoute(companyId),
    ]);
    const awaitingMe = records.filter((record) => record.canAct);

    return {
      route,
      entries: (query.scope ?? 'mine') === 'mine' ? awaitingMe : records,
      awaitingMeCount: awaitingMe.length,
      pendingCount: records.length,
    };
  }

  async getApprovalRoute(companyId: string): Promise<WorkflowApprovalRoute> {
    await this.companyScope.assertCompanyInTenant(companyId);
    return this.timesheetWorkflow.resolveDefaultRoute(companyId);
  }

  /** Applies one decision to many entries; each entry succeeds or fails on its own. */
  async bulkAction(
    companyId: string,
    dto: BulkTimesheetActionDto,
    user: AuthenticatedUser,
  ): Promise<TimesheetBulkActionResult> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const comment = dto.comment?.trim() || undefined;
    if (dto.action === 'reject' && !comment) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A reason is required to reject timesheet entries',
      });
    }

    const entryIds = [...new Set(dto.entryIds)];
    const inCompany = await this.prisma.unscoped.timesheetEntry.findMany({
      where: { id: { in: entryIds }, companyId },
      select: { id: true },
    });
    const known = new Set(inCompany.map((row) => row.id));

    const result: TimesheetBulkActionResult = { succeeded: [], failed: [] };
    for (const entryId of entryIds) {
      if (!known.has(entryId)) {
        result.failed.push({ entryId, message: 'Timesheet entry not found' });
        continue;
      }
      try {
        const record =
          dto.action === 'approve'
            ? await this.approve(entryId, user, { comment })
            : await this.reject(entryId, user, { comment: comment! });
        result.succeeded.push(record);
      } catch (err) {
        result.failed.push({ entryId, message: errorMessage(err) });
      }
    }
    return result;
  }

  async create(
    companyId: string,
    dto: CreateTimesheetEntryDto,
    user: AuthenticatedUser,
    options?: { localId?: string; source?: string; timeAnomaly?: boolean },
  ): Promise<TimesheetEntryRecord> {
    const employee = await this.assertEmployee(dto.employeeId, companyId);
    await this.dataScope.assertEmployeeInScope(user, dto.employeeId);
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
    await this.dataScope.assertEmployeeInScope(user, row.employeeId);

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

    const [record] = await this.presentMany([updated], user);
    return record;
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
    await this.assertCanReview(row, user);

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

    const [record] = await this.presentMany([updated], user);
    return record;
  }

  async reject(
    entryId: string,
    user: AuthenticatedUser,
    dto: RejectTimesheetEntryDto,
  ): Promise<TimesheetEntryRecord> {
    const row = await this.findOrThrow(entryId);
    await this.assertCanReview(row, user);

    if (row.status !== TimesheetEntryStatus.pending_approval) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Entry is not pending approval',
      });
    }

    await this.timesheetWorkflow.reject({
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

    const [record] = await this.presentMany([updated], user);
    return record;
  }

  private async assertCanReview(row: EntryWithRelations, user: AuthenticatedUser): Promise<void> {
    await this.companyScope.assertCompanyInTenant(row.companyId);
    if (user.employeeId && user.employeeId === row.employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You cannot approve or reject your own timesheet entries',
      });
    }
    await this.dataScope.assertEmployeeInScope(user, row.employeeId, { includeSelf: false });
  }

  private dateRangeFilter(fromDate?: string, toDate?: string): Prisma.TimesheetEntryWhereInput {
    if (!fromDate && !toDate) return {};
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The start date must be on or before the end date',
      });
    }
    return {
      entryDate: {
        ...(fromDate ? { gte: parseDateString(fromDate) } : {}),
        ...(toDate ? { lte: parseDateString(toDate) } : {}),
      },
    };
  }

  /** Adds each entry's workflow, approval route and whether `user` can act on its current step. */
  private async presentMany(
    rows: EntryWithRelations[],
    user: AuthenticatedUser,
  ): Promise<TimesheetEntryRecord[]> {
    const workflows = await this.timesheetWorkflow.findForEntries(rows.map((row) => row.id));
    const routes = await this.timesheetWorkflow.resolveRoutes([...workflows.values()]);

    const reviewable = this.permissions.hasPermission(user, 'attendance', 'approve')
      ? rows.flatMap((row) => {
          const workflow = workflows.get(row.id);
          const step = workflow ? getCurrentWorkflowStep(workflow.steps) : null;
          return row.status === TimesheetEntryStatus.pending_approval &&
            workflow?.status === 'pending' &&
            step &&
            row.employeeId !== user.employeeId
            ? [{ entryId: row.id, requesterEmployeeId: row.employeeId, step }]
            : [];
        })
      : [];
    const flags = await this.workflowAssignee.canActOnSteps(user, reviewable);
    const canAct = new Set(reviewable.filter((_, i) => flags[i]).map((item) => item.entryId));

    return rows.map((row) => {
      const workflow = workflows.get(row.id) ?? null;
      return {
        ...this.toRecord(row, workflow),
        approvalRoute: workflow ? (routes.get(workflow.id) ?? null) : null,
        canAct: canAct.has(row.id),
      };
    });
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
