import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LeaveRequestStatus,
  Prisma,
  WorkflowEntityType,
  type LeavePolicy,
  type LeaveRequest,
} from '@prisma/client';
import type {
  LeaveApprovalStep,
  LeaveRequestIssue,
  LeaveRequestPreview,
  LeaveRequestRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
import { WorkflowInstancesService } from '../workflow/workflow-instances.service';
import type {
  CreateLeaveRequestDto,
  LeaveApprovalActionDto,
  ListLeaveRequestsQueryDto,
  PreviewLeaveRequestDto,
} from './dto/leave.dto';
import { LeaveAttendanceService } from './leave-attendance.service';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveWorkflowService } from './leave-workflow.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import {
  buildLeaveNotificationVariables,
} from '../notifications/notification.helpers';
import {
  calculateLeaveDays,
  decimal,
  eachDateInRange,
  formatDateValue,
  isWeekend,
  parseApprovalChain,
  parseDateString,
} from './leave.utils';

const MAX_REQUEST_CALENDAR_DAYS = 366;

const REQUEST_INCLUDE = {
  leaveType: { select: { name: true, isPaid: true } },
  employee: {
    select: {
      id: true,
      companyId: true,
      tenantId: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      department: { select: { name: true } },
      designation: { select: { name: true } },
    },
  },
} satisfies Prisma.LeaveRequestInclude;

type LeaveRequestRow = Prisma.LeaveRequestGetPayload<{ include: typeof REQUEST_INCLUDE }>;

type RequestEmployee = {
  id: string;
  tenantId: string;
  companyId: string;
  firstName: string;
  lastName: string;
  probationEndDate: Date | null;
};

type BalanceWarning = {
  projectedBalance: number;
  exceedsBalance: boolean;
  negativeCapExceeded: boolean;
};

interface RequestEvaluation {
  policy: LeavePolicy | null;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  balanceWarning: BalanceWarning | null;
  preview: LeaveRequestPreview;
}

function roundDays(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatDays(value: number): string {
  return `${roundDays(value)} day${value === 1 ? '' : 's'}`;
}

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly balancesService: LeaveBalancesService,
    private readonly leaveAttendanceService: LeaveAttendanceService,
    private readonly notificationEngine: NotificationEngineService,
    private readonly leaveWorkflow: LeaveWorkflowService,
    private readonly workflowInstances: WorkflowInstancesService,
    private readonly dataScope: DataScopeService,
  ) {}

  async list(
    companyId: string,
    query: ListLeaveRequestsQueryDto,
    employeeFilter?: { in: string[] },
  ): Promise<{ data: LeaveRequestRecord[]; total: number }> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const where: Prisma.LeaveRequestWhereInput = {
      employee: { companyId, deletedAt: null },
      employeeId: query.employeeId ?? employeeFilter,
      ...(query.status
        ? { status: query.status as LeaveRequestStatus }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.unscoped.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: REQUEST_INCLUDE,
      }),
      this.prisma.unscoped.leaveRequest.count({ where }),
    ]);

    const records = await Promise.all(rows.map((row) => this.toRecord(row)));
    return { data: await this.withActorNames(records), total };
  }

  /**
   * Pending leave requests whose current workflow step the user can act on
   * (direct manager, skip-level manager or role step), oldest start date first.
   */
  async listApprovals(
    companyId: string,
    user: AuthenticatedUser,
  ): Promise<LeaveRequestRecord[]> {
    const instances = await this.workflowInstances.listPendingForUser(
      companyId,
      user,
      WorkflowEntityType.leave_request,
    );
    const requestIds = instances.map((instance) => instance.entityId);
    if (requestIds.length === 0) return [];

    const scopeFilter = await this.dataScope.employeeIdFilter(user, { includeSelf: false });
    const rows = await this.prisma.unscoped.leaveRequest.findMany({
      where: {
        id: { in: requestIds },
        status: LeaveRequestStatus.pending,
        employee: { companyId, deletedAt: null },
        employeeId: {
          ...scopeFilter,
          ...(user.employeeId ? { not: user.employeeId } : {}),
        },
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
      include: REQUEST_INCLUDE,
    });

    const records = await Promise.all(rows.map((row) => this.toRecord(row)));
    return this.withActorNames(records);
  }

  async get(requestId: string, user: AuthenticatedUser): Promise<LeaveRequestRecord> {
    const row = await this.findRequestOrThrow(requestId);
    await this.dataScope.assertEmployeeInScope(user, row.employeeId);
    const [record] = await this.withActorNames([await this.toRecord(row)]);
    return record;
  }

  async preview(
    employeeId: string,
    dto: PreviewLeaveRequestDto,
    user: AuthenticatedUser,
  ): Promise<LeaveRequestPreview> {
    const employee = await this.assertEmployee(employeeId);
    this.assertOwnRequest(user, employeeId, 'Cannot preview leave for another employee');
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    const evaluation = await this.evaluateRequest(employee, {
      leaveTypeId: dto.leaveTypeId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      halfDay: dto.halfDay ?? false,
    });
    return evaluation.preview;
  }

  async create(
    employeeId: string,
    dto: CreateLeaveRequestDto,
    user: AuthenticatedUser,
  ): Promise<LeaveRequestRecord> {
    const employee = await this.assertEmployee(employeeId);
    this.assertOwnRequest(user, employeeId, 'Cannot create leave for another employee');
    await this.dataScope.assertEmployeeInScope(user, employeeId);

    const evaluation = await this.evaluateRequest(employee, {
      leaveTypeId: dto.leaveTypeId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      halfDay: dto.halfDay ?? false,
    });
    this.throwOnBlockingIssue(evaluation.preview.issues);
    const policy = evaluation.policy!;

    const row = await this.prisma.unscoped.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate: evaluation.startDate,
        endDate: evaluation.endDate,
        halfDay: dto.halfDay ?? false,
        totalDays: evaluation.totalDays,
        reason: dto.reason?.trim() || null,
        status: dto.submit ? LeaveRequestStatus.pending : LeaveRequestStatus.draft,
        approvalChain: [] as Prisma.InputJsonValue,
        localId: dto.localId ?? null,
      },
      include: REQUEST_INCLUDE,
    });

    if (dto.submit) {
      const approvalChain = await this.leaveWorkflow.startForLeaveRequest({
        companyId: employee.companyId,
        tenantId: employee.tenantId,
        requestId: row.id,
        requesterEmployeeId: employeeId,
        requesterUserId: user.id,
        policyApprovalSteps: this.leaveWorkflow.policyApprovalSteps(policy),
      });
      const updated = await this.prisma.unscoped.leaveRequest.update({
        where: { id: row.id },
        data: {
          approvalChain: approvalChain as unknown as Prisma.InputJsonValue,
        },
        include: REQUEST_INCLUDE,
      });
      return this.toRecord(updated, evaluation.balanceWarning);
    }

    return this.toRecord(row, evaluation.balanceWarning);
  }

  async submit(requestId: string, user: AuthenticatedUser): Promise<LeaveRequestRecord> {
    const row = await this.findRequestOrThrow(requestId);
    if (row.status !== LeaveRequestStatus.draft) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only draft requests can be submitted',
      });
    }
    this.assertOwnRequest(user, row.employeeId, 'Cannot submit another employee\'s request');
    await this.dataScope.assertEmployeeInScope(user, row.employeeId);

    const employee = await this.assertEmployee(row.employeeId);
    const evaluation = await this.evaluateRequest(
      employee,
      {
        leaveTypeId: row.leaveTypeId,
        startDate: formatDateValue(row.startDate),
        endDate: formatDateValue(row.endDate),
        halfDay: row.halfDay,
      },
      row.id,
    );
    this.throwOnBlockingIssue(evaluation.preview.issues);

    const approvalChain = await this.leaveWorkflow.startForLeaveRequest({
      companyId: employee.companyId,
      tenantId: employee.tenantId,
      requestId,
      requesterEmployeeId: row.employeeId,
      requesterUserId: user.id,
      policyApprovalSteps: this.leaveWorkflow.policyApprovalSteps(evaluation.policy!),
    });

    const updated = await this.prisma.unscoped.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveRequestStatus.pending,
        totalDays: evaluation.totalDays,
        approvalChain: approvalChain as unknown as Prisma.InputJsonValue,
      },
      include: REQUEST_INCLUDE,
    });

    return this.toRecord(updated);
  }

  async approve(
    requestId: string,
    user: AuthenticatedUser,
    dto: LeaveApprovalActionDto,
  ): Promise<LeaveRequestRecord> {
    const row = await this.findRequestOrThrow(requestId);
    if (row.status !== LeaveRequestStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request is not pending approval',
      });
    }
    this.assertNotOwnApproval(user, row.employeeId);
    await this.dataScope.assertEmployeeInScope(user, row.employeeId, { includeSelf: false });

    const employee = await this.assertEmployee(row.employeeId);
    const policy = await this.balancesService.findEffectivePolicy(
      employee.companyId,
      row.leaveTypeId,
      row.startDate,
    );
    if (!policy) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No effective leave policy',
      });
    }

    const legacyChain = parseApprovalChain(row.approvalChain);
    const transition = await this.leaveWorkflow.approve({
      requestId,
      user,
      comment: dto.comment?.trim() || null,
      audit: {
        tenantId: employee.tenantId,
        module: 'leave',
        recordId: requestId,
      },
      companyId: employee.companyId,
      tenantId: employee.tenantId,
      requesterEmployeeId: row.employeeId,
      policyApprovalSteps: this.leaveWorkflow.policyApprovalSteps(policy),
      legacyApprovalChain: legacyChain,
    });

    const updatedChain = this.leaveWorkflow.toLeaveApprovalChain(
      transition.instance.steps,
    );
    const leaveType = await this.prisma.unscoped.leaveType.findUniqueOrThrow({
      where: { id: row.leaveTypeId },
    });

    let status: LeaveRequestStatus = LeaveRequestStatus.pending;
    let deductedAt: Date | null = null;

    if (transition.fullyApproved) {
      status = LeaveRequestStatus.approved;
      if (leaveType.isPaid) {
        await this.balancesService.deductBalance({
          employeeId: row.employeeId,
          leaveTypeId: row.leaveTypeId,
          days: decimal(row.totalDays),
        });
      }
      deductedAt = new Date();

      await this.leaveAttendanceService.applyApprovedLeave({
        employeeId: row.employeeId,
        startDate: row.startDate,
        endDate: row.endDate,
        halfDay: row.halfDay,
        isPaid: leaveType.isPaid,
      });
    }

    const updated = await this.prisma.unscoped.leaveRequest.update({
      where: { id: requestId },
      data: {
        status,
        approvalChain: updatedChain as unknown as Prisma.InputJsonValue,
        deductedAt,
      },
      include: REQUEST_INCLUDE,
    });

    if (status === LeaveRequestStatus.approved) {
      await this.emitLeaveNotification('leave.approved', updated, employee);
    }

    const [record] = await this.withActorNames([await this.toRecord(updated)]);
    return record;
  }

  async reject(
    requestId: string,
    user: AuthenticatedUser,
    dto: LeaveApprovalActionDto,
  ): Promise<LeaveRequestRecord> {
    const row = await this.findRequestOrThrow(requestId);
    if (row.status !== LeaveRequestStatus.pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request is not pending approval',
      });
    }
    this.assertNotOwnApproval(user, row.employeeId);
    await this.dataScope.assertEmployeeInScope(user, row.employeeId, { includeSelf: false });

    const employee = await this.assertEmployee(row.employeeId);
    const policy = await this.balancesService.findEffectivePolicy(
      employee.companyId,
      row.leaveTypeId,
      row.startDate,
    );
    if (!policy) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No effective leave policy',
      });
    }

    const legacyChain = parseApprovalChain(row.approvalChain);
    const transition = await this.leaveWorkflow.reject({
      requestId,
      user,
      comment: dto.comment?.trim() || null,
      audit: {
        tenantId: employee.tenantId,
        module: 'leave',
        recordId: requestId,
      },
      companyId: employee.companyId,
      tenantId: employee.tenantId,
      requesterEmployeeId: row.employeeId,
      policyApprovalSteps: this.leaveWorkflow.policyApprovalSteps(policy),
      legacyApprovalChain: legacyChain,
    });

    const updatedChain = this.leaveWorkflow.toLeaveApprovalChain(
      transition.instance.steps,
    );

    const updated = await this.prisma.unscoped.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveRequestStatus.rejected,
        approvalChain: updatedChain as unknown as Prisma.InputJsonValue,
      },
      include: REQUEST_INCLUDE,
    });

    await this.emitLeaveNotification('leave.rejected', updated, employee);

    const [record] = await this.withActorNames([await this.toRecord(updated)]);
    return record;
  }

  async cancel(requestId: string, user: AuthenticatedUser): Promise<LeaveRequestRecord> {
    const row = await this.findRequestOrThrow(requestId);
    if (!['draft', 'pending'].includes(row.status)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only draft or pending requests can be cancelled',
      });
    }
    this.assertOwnRequest(user, row.employeeId, 'Cannot cancel another employee\'s request');
    await this.dataScope.assertEmployeeInScope(user, row.employeeId);

    const updated = await this.prisma.unscoped.leaveRequest.update({
      where: { id: requestId },
      data: { status: LeaveRequestStatus.cancelled },
      include: REQUEST_INCLUDE,
    });

    await this.leaveWorkflow.cancelForLeaveRequest(requestId);

    return this.toRecord(updated);
  }

  /**
   * Single source of truth for request rules, shared by preview, create and submit.
   * Balance figures use accrual as of today, matching deduction on approval.
   */
  private async evaluateRequest(
    employee: RequestEmployee,
    input: { leaveTypeId: string; startDate: string; endDate: string; halfDay: boolean },
    excludeRequestId?: string,
  ): Promise<RequestEvaluation> {
    const leaveType = await this.prisma.unscoped.leaveType.findFirst({
      where: { id: input.leaveTypeId, companyId: employee.companyId },
    });
    if (!leaveType) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Leave type not found',
      });
    }

    const startDate = parseDateString(input.startDate);
    const endDate = parseDateString(input.endDate);
    const issues: LeaveRequestIssue[] = [];
    const preview: LeaveRequestPreview = {
      totalDays: 0,
      calendarDays: 0,
      excludedDates: [],
      isPaid: leaveType.isPaid,
      balance: null,
      policy: null,
      approvalSteps: [],
      overlapping: [],
      issues,
      canSubmit: false,
    };
    const result: RequestEvaluation = {
      policy: null,
      startDate,
      endDate,
      totalDays: 0,
      balanceWarning: null,
      preview,
    };

    if (startDate > endDate) {
      issues.push({
        code: 'invalid_range',
        severity: 'error',
        message: 'startDate must be on or before endDate',
      });
      return result;
    }

    const dates = eachDateInRange(startDate, endDate);
    preview.calendarDays = dates.length;
    if (dates.length > MAX_REQUEST_CALENDAR_DAYS) {
      issues.push({
        code: 'invalid_range',
        severity: 'error',
        message: `A single request can cover at most ${MAX_REQUEST_CALENDAR_DAYS} calendar days`,
        params: { max: MAX_REQUEST_CALENDAR_DAYS },
      });
      return result;
    }

    const policy = await this.balancesService.findEffectivePolicy(
      employee.companyId,
      leaveType.id,
      startDate,
    );
    result.policy = policy;
    if (policy) {
      preview.policy = {
        halfDayAllowed: policy.halfDayAllowed,
        allowNegativeBalance: policy.allowNegativeBalance,
        negativeBalanceCap:
          policy.negativeBalanceCap !== null ? Number(policy.negativeBalanceCap) : null,
        probationRestricted: policy.probationRestricted,
      };
      preview.approvalSteps = this.leaveWorkflow
        .policyApprovalSteps(policy)
        .map((step) => step.roleName);
    } else {
      issues.push({
        code: 'no_policy',
        severity: 'error',
        message: `No ${leaveType.name} policy is in effect on ${input.startDate}`,
        params: { leaveType: leaveType.name, date: input.startDate },
      });
    }

    if (
      policy?.probationRestricted &&
      employee.probationEndDate &&
      startDate <= employee.probationEndDate
    ) {
      const probationEnd = formatDateValue(employee.probationEndDate);
      issues.push({
        code: 'probation',
        severity: 'error',
        message: `${leaveType.name} cannot be taken during probation, which ends on ${probationEnd}`,
        params: { leaveType: leaveType.name, date: probationEnd },
      });
    }

    if (input.halfDay && policy && !policy.halfDayAllowed) {
      issues.push({
        code: 'half_day_not_allowed',
        severity: 'error',
        message: 'Half-day leave is not allowed for this leave type',
      });
    }
    if (input.halfDay && input.startDate !== input.endDate) {
      issues.push({
        code: 'half_day_multi_day',
        severity: 'error',
        message: 'A half-day request must start and end on the same day',
      });
    }

    const holidayDates = await this.leaveAttendanceService.getHolidayDatesForEmployee(
      employee.companyId,
      startDate,
      endDate,
    );
    const deductPublicHolidays = policy?.deductPublicHolidays ?? false;
    for (const date of dates) {
      const key = formatDateValue(date);
      if (isWeekend(date)) {
        preview.excludedDates.push({ date: key, reason: 'weekend' });
      } else if (!deductPublicHolidays && holidayDates.has(key)) {
        preview.excludedDates.push({ date: key, reason: 'public_holiday' });
      }
    }
    const workingDays = calculateLeaveDays({
      startDate,
      endDate,
      halfDay: false,
      holidayDates,
      deductPublicHolidays,
    });
    const totalDays = input.halfDay ? (workingDays > 0 ? 0.5 : 0) : workingDays;
    result.totalDays = totalDays;
    preview.totalDays = totalDays;

    if (totalDays <= 0) {
      issues.push({
        code: 'no_working_days',
        severity: 'error',
        message: 'Leave request must cover at least one working day',
      });
    }

    const overlapping = await this.prisma.unscoped.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        status: { in: [LeaveRequestStatus.pending, LeaveRequestStatus.approved] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
      },
      orderBy: { startDate: 'asc' },
      include: { leaveType: { select: { name: true } } },
    });
    for (const other of overlapping) {
      const summary = {
        id: other.id,
        leaveTypeName: other.leaveType.name,
        startDate: formatDateValue(other.startDate),
        endDate: formatDateValue(other.endDate),
        status: other.status,
      };
      preview.overlapping.push(summary);
      issues.push({
        code: 'overlap',
        severity: 'error',
        message: `Overlaps a ${other.status} ${summary.leaveTypeName} request (${summary.startDate} to ${summary.endDate})`,
        params: {
          leaveType: summary.leaveTypeName,
          status: other.status,
          start: summary.startDate,
          end: summary.endDate,
        },
      });
    }

    if (leaveType.isPaid) {
      const available = await this.balancesService.getAvailableBalance(
        employee.id,
        leaveType.id,
        new Date(),
      );
      const pendingAggregate = await this.prisma.unscoped.leaveRequest.aggregate({
        where: {
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          status: LeaveRequestStatus.pending,
          ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
        },
        _sum: { totalDays: true },
      });
      const pending = roundDays(Number(pendingAggregate._sum.totalDays ?? 0));
      const afterRequest = roundDays(available - totalDays);
      const afterPending = roundDays(afterRequest - pending);
      preview.balance = { available, pending, afterRequest, afterPending };

      const allowNegative = policy?.allowNegativeBalance ?? false;
      const cap =
        policy?.negativeBalanceCap !== null && policy?.negativeBalanceCap !== undefined
          ? Number(policy.negativeBalanceCap)
          : null;
      const negativeCapExceeded = allowNegative && cap !== null && afterRequest < -cap;
      result.balanceWarning = {
        projectedBalance: afterRequest,
        exceedsBalance: afterRequest < 0,
        negativeCapExceeded,
      };

      if (policy && totalDays > 0) {
        if (!allowNegative && afterRequest < 0) {
          issues.push({
            code: 'insufficient_balance',
            severity: 'error',
            message: `Insufficient leave balance: ${formatDays(available)} available, ${formatDays(totalDays)} requested`,
            params: { available, requested: totalDays },
          });
        } else if (negativeCapExceeded) {
          issues.push({
            code: 'negative_cap_exceeded',
            severity: 'error',
            message: `Request exceeds the negative balance cap of ${formatDays(cap!)}`,
            params: { cap: cap!, after: afterRequest },
          });
        } else if (afterRequest < 0) {
          issues.push({
            code: 'negative_balance',
            severity: 'warning',
            message: `This takes the balance to ${afterRequest} days; approvers will see it flagged`,
            params: { after: afterRequest },
          });
        }
        if (afterRequest >= 0 && afterPending < 0) {
          issues.push({
            code: 'exceeds_with_pending',
            severity: 'warning',
            message: `${formatDays(pending)} of this leave type is already pending; if approved first, this request would exceed the balance`,
            params: { pending },
          });
        }
      }
    }

    if (startDate < parseDateString(formatDateValue(new Date()))) {
      issues.push({
        code: 'starts_in_past',
        severity: 'warning',
        message: 'This request starts in the past',
      });
    }

    preview.canSubmit = !issues.some((issue) => issue.severity === 'error');
    return result;
  }

  private throwOnBlockingIssue(issues: LeaveRequestIssue[]): void {
    const blocking = issues.find((issue) => issue.severity === 'error');
    if (blocking) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: blocking.message,
      });
    }
  }

  private assertOwnRequest(user: AuthenticatedUser, employeeId: string, message: string) {
    if (user.employeeId && user.employeeId !== employeeId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message });
    }
  }

  private assertNotOwnApproval(user: AuthenticatedUser, requesterEmployeeId: string) {
    if (user.employeeId && user.employeeId === requesterEmployeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You cannot approve or reject your own leave request',
      });
    }
  }

  private async findRequestOrThrow(requestId: string): Promise<LeaveRequestRow> {
    const row = await this.prisma.unscoped.leaveRequest.findFirst({
      where: { id: requestId },
      include: REQUEST_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Leave request not found',
      });
    }
    await this.companyScope.assertCompanyInTenant(row.employee.companyId);
    return row;
  }

  private async emitLeaveNotification(
    eventType: 'leave.approved' | 'leave.rejected',
    row: LeaveRequest & { leaveType?: { name: string } },
    employee: {
      tenantId: string;
      companyId: string;
      firstName: string;
      lastName: string;
    },
  ): Promise<void> {
    await this.notificationEngine.emit({
      tenantId: employee.tenantId,
      companyId: employee.companyId,
      eventType,
      subjectEmployeeId: row.employeeId,
      variables: buildLeaveNotificationVariables({
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        leaveTypeName: row.leaveType?.name ?? 'Leave',
        startDate: formatDateValue(row.startDate),
        endDate: formatDateValue(row.endDate),
      }),
      payload: {
        leaveRequestId: row.id,
        employeeId: row.employeeId,
        eventType,
      },
    });
  }

  private async assertEmployee(employeeId: string): Promise<RequestEmployee> {
    const row = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        firstName: true,
        lastName: true,
        probationEndDate: true,
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }
    return row;
  }

  /** Pending requests carry a live balance check so approvers see overdrafts (LEAVE_LOGIC.md §7). */
  private async buildPendingBalanceWarning(row: LeaveRequestRow): Promise<BalanceWarning | null> {
    if (row.status !== LeaveRequestStatus.pending || !row.leaveType.isPaid) return null;
    const available = await this.balancesService.getAvailableBalance(
      row.employeeId,
      row.leaveTypeId,
      new Date(),
    );
    const projected = roundDays(available - Number(row.totalDays));
    if (projected >= 0) return null;

    const policy = await this.balancesService.findEffectivePolicy(
      row.employee.companyId,
      row.leaveTypeId,
      row.startDate,
    );
    const cap =
      policy?.allowNegativeBalance && policy.negativeBalanceCap !== null
        ? Number(policy.negativeBalanceCap)
        : null;
    return {
      projectedBalance: projected,
      exceedsBalance: true,
      negativeCapExceeded: policy?.allowNegativeBalance
        ? cap !== null && projected < -cap
        : true,
    };
  }

  private async toRecord(
    row: LeaveRequestRow,
    balanceWarning?: BalanceWarning | null,
  ): Promise<LeaveRequestRecord> {
    const warning =
      balanceWarning !== undefined
        ? balanceWarning
        : await this.buildPendingBalanceWarning(row);

    return {
      id: row.id,
      employeeId: row.employeeId,
      employee: {
        id: row.employee.id,
        fullName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
        employeeNumber: row.employee.employeeNumber,
        departmentName: row.employee.department?.name ?? null,
        designationName: row.employee.designation?.name ?? null,
      },
      leaveTypeId: row.leaveTypeId,
      leaveTypeName: row.leaveType.name,
      leaveTypeIsPaid: row.leaveType.isPaid,
      startDate: formatDateValue(row.startDate),
      endDate: formatDateValue(row.endDate),
      halfDay: row.halfDay,
      totalDays: Number(row.totalDays),
      reason: row.reason,
      status: row.status,
      approvalChain: parseApprovalChain(row.approvalChain),
      deductedAt: row.deductedAt?.toISOString() ?? null,
      balanceWarning:
        warning && (warning.exceedsBalance || warning.negativeCapExceeded)
          ? warning
          : null,
      localId: row.localId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Resolves `actedByName` on approval steps in one pass over all records. */
  private async withActorNames(records: LeaveRequestRecord[]): Promise<LeaveRequestRecord[]> {
    const steps = records.flatMap((record) => record.approvalChain);
    const employeeIds = [
      ...new Set(steps.map((s) => s.actedByEmployeeId).filter((id): id is string => !!id)),
    ];
    const userIds = [
      ...new Set(
        steps
          .filter((s) => !s.actedByEmployeeId && s.actedByUserId)
          .map((s) => s.actedByUserId as string),
      ),
    ];
    if (employeeIds.length === 0 && userIds.length === 0) return records;

    const [employees, users] = await Promise.all([
      employeeIds.length
        ? this.prisma.unscoped.employee.findMany({
            where: { id: { in: employeeIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [],
      userIds.length
        ? this.prisma.unscoped.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true },
          })
        : [],
    ]);
    const employeeNames = new Map(
      employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`.trim()]),
    );
    const userNames = new Map(users.map((u) => [u.id, u.email]));

    const nameFor = (step: LeaveApprovalStep): string | null =>
      (step.actedByEmployeeId && employeeNames.get(step.actedByEmployeeId)) ||
      (step.actedByUserId && userNames.get(step.actedByUserId)) ||
      null;

    return records.map((record) => ({
      ...record,
      approvalChain: record.approvalChain.map((step) => ({
        ...step,
        actedByName: nameFor(step),
      })),
    }));
  }
}
