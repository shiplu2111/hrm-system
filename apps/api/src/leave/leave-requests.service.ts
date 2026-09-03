import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LeaveRequestStatus,
  Prisma,
  type LeaveRequest,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { LeaveRequestRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateLeaveRequestDto,
  LeaveApprovalActionDto,
  ListLeaveRequestsQueryDto,
} from './dto/leave.dto';
import { LeaveAttendanceService } from './leave-attendance.service';
import { LeaveBalancesService } from './leave-balances.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import {
  buildLeaveNotificationVariables,
} from '../notifications/notification.helpers';
import {
  buildInitialApprovalChain,
  calculateLeaveDays,
  decimal,
  formatDateValue,
  getCurrentApprovalStep,
  isApprovalComplete,
  parseApprovalChain,
  parseDateString,
} from './leave.utils';

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly balancesService: LeaveBalancesService,
    private readonly leaveAttendanceService: LeaveAttendanceService,
    private readonly notificationEngine: NotificationEngineService,
  ) {}

  async list(
    companyId: string,
    query: ListLeaveRequestsQueryDto,
  ): Promise<{ data: LeaveRequestRecord[]; total: number }> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const where: Prisma.LeaveRequestWhereInput = {
      employee: { companyId, deletedAt: null },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
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
        include: { leaveType: { select: { name: true, isPaid: true } } },
      }),
      this.prisma.unscoped.leaveRequest.count({ where }),
    ]);

    return {
      data: await Promise.all(rows.map((row) => this.toRecord(row))),
      total,
    };
  }

  async get(requestId: string): Promise<LeaveRequestRecord> {
    const row = await this.findRequestOrThrow(requestId);
    return this.toRecord(row);
  }

  async create(
    employeeId: string,
    dto: CreateLeaveRequestDto,
    user: AuthenticatedUser,
  ): Promise<LeaveRequestRecord> {
    const employee = await this.assertEmployee(employeeId);
    if (user.employeeId && user.employeeId !== employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot create leave for another employee',
      });
    }

    const startDate = parseDateString(dto.startDate);
    const endDate = parseDateString(dto.endDate);
    if (startDate > endDate) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'startDate must be on or before endDate',
      });
    }

    const leaveType = await this.prisma.unscoped.leaveType.findFirst({
      where: { id: dto.leaveTypeId, companyId: employee.companyId },
    });
    if (!leaveType) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Leave type not found',
      });
    }

    const policy = await this.balancesService.findEffectivePolicy(
      employee.companyId,
      dto.leaveTypeId,
      startDate,
    );
    if (!policy) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No effective leave policy for this type',
      });
    }

    this.validateProbation(employee, policy.probationRestricted, startDate);
    if (dto.halfDay && !policy.halfDayAllowed) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Half-day leave is not allowed for this leave type',
      });
    }

    const holidayDates = await this.leaveAttendanceService.getHolidayDatesForEmployee(
      employee.companyId,
      startDate,
      endDate,
    );

    const totalDays = calculateLeaveDays({
      startDate,
      endDate,
      halfDay: dto.halfDay ?? false,
      holidayDates,
      deductPublicHolidays: policy.deductPublicHolidays,
    });

    if (totalDays <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Leave request must cover at least one working day',
      });
    }

    const balanceWarning = await this.buildBalanceWarning(
      employeeId,
      dto.leaveTypeId,
      decimal(totalDays),
      policy.allowNegativeBalance,
      policy.negativeBalanceCap ? Number(policy.negativeBalanceCap) : null,
      leaveType.isPaid,
    );

    if (
      leaveType.isPaid &&
      !policy.allowNegativeBalance &&
      balanceWarning.exceedsBalance
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Insufficient leave balance',
      });
    }

    if (
      leaveType.isPaid &&
      policy.allowNegativeBalance &&
      balanceWarning.negativeCapExceeded
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request exceeds negative balance cap',
      });
    }

    const approvalSteps = Array.isArray(policy.approvalSteps)
      ? (policy.approvalSteps as Array<{ roleName: string }>)
      : [{ roleName: 'Manager' }, { roleName: 'HR Admin' }];

    const row = await this.prisma.unscoped.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        halfDay: dto.halfDay ?? false,
        totalDays,
        reason: dto.reason?.trim() ?? null,
        status: dto.submit ? LeaveRequestStatus.pending : LeaveRequestStatus.draft,
        approvalChain: dto.submit
          ? (buildInitialApprovalChain(approvalSteps) as unknown as Prisma.InputJsonValue)
          : ([] as Prisma.InputJsonValue),
        localId: dto.localId ?? null,
      },
      include: { leaveType: { select: { name: true, isPaid: true } } },
    });

    return this.toRecord(row, balanceWarning);
  }

  async submit(requestId: string, user: AuthenticatedUser): Promise<LeaveRequestRecord> {
    const row = await this.findRequestOrThrow(requestId);
    if (row.status !== LeaveRequestStatus.draft) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only draft requests can be submitted',
      });
    }
    if (user.employeeId && user.employeeId !== row.employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot submit another employee\'s request',
      });
    }

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

    const steps = Array.isArray(policy.approvalSteps)
      ? (policy.approvalSteps as Array<{ roleName: string }>)
      : [{ roleName: 'Manager' }, { roleName: 'HR Admin' }];

    const updated = await this.prisma.unscoped.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveRequestStatus.pending,
        approvalChain: buildInitialApprovalChain(steps) as unknown as Prisma.InputJsonValue,
      },
      include: { leaveType: { select: { name: true, isPaid: true } } },
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

    const chain = parseApprovalChain(row.approvalChain);
    const currentStep = getCurrentApprovalStep(chain);
    if (!currentStep) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No pending approval step',
      });
    }

    await this.assertCanApproveStep(row.employeeId, currentStep.roleName, user);

    const now = new Date().toISOString();
    const updatedChain = chain.map((step) =>
      step.roleName === currentStep.roleName && step.status === 'pending'
        ? {
            ...step,
            status: 'approved' as const,
            actedByUserId: user.id,
            actedByEmployeeId: user.employeeId,
            actedAt: now,
            comment: dto.comment ?? null,
          }
        : step,
    );

    const employee = await this.assertEmployee(row.employeeId);
    const leaveType = await this.prisma.unscoped.leaveType.findUniqueOrThrow({
      where: { id: row.leaveTypeId },
    });
    const policy = await this.balancesService.findEffectivePolicy(
      employee.companyId,
      row.leaveTypeId,
      row.startDate,
    );

    let status: LeaveRequestStatus = LeaveRequestStatus.pending;
    let deductedAt: Date | null = null;

    if (isApprovalComplete(updatedChain)) {
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
      include: { leaveType: { select: { name: true, isPaid: true } } },
    });

    if (status === LeaveRequestStatus.approved) {
      await this.emitLeaveNotification('leave.approved', updated, employee);
    }

    return this.toRecord(updated);
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

    const chain = parseApprovalChain(row.approvalChain);
    const currentStep = getCurrentApprovalStep(chain);
    if (!currentStep) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No pending approval step',
      });
    }

    await this.assertCanApproveStep(row.employeeId, currentStep.roleName, user);

    const now = new Date().toISOString();
    const updatedChain = chain.map((step) =>
      step.status === 'pending'
        ? {
            ...step,
            status: step.roleName === currentStep.roleName ? ('rejected' as const) : ('skipped' as const),
            actedByUserId: step.roleName === currentStep.roleName ? user.id : step.actedByUserId,
            actedByEmployeeId:
              step.roleName === currentStep.roleName ? user.employeeId : step.actedByEmployeeId,
            actedAt: step.roleName === currentStep.roleName ? now : step.actedAt,
            comment: step.roleName === currentStep.roleName ? (dto.comment ?? null) : step.comment,
          }
        : step,
    );

    const updated = await this.prisma.unscoped.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveRequestStatus.rejected,
        approvalChain: updatedChain as unknown as Prisma.InputJsonValue,
      },
      include: { leaveType: { select: { name: true, isPaid: true } } },
    });

    const employee = await this.assertEmployee(row.employeeId);
    await this.emitLeaveNotification('leave.rejected', updated, employee);

    return this.toRecord(updated);
  }

  async cancel(requestId: string, user: AuthenticatedUser): Promise<LeaveRequestRecord> {
    const row = await this.findRequestOrThrow(requestId);
    if (!['draft', 'pending'].includes(row.status)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only draft or pending requests can be cancelled',
      });
    }
    if (user.employeeId && user.employeeId !== row.employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot cancel another employee\'s request',
      });
    }

    const updated = await this.prisma.unscoped.leaveRequest.update({
      where: { id: requestId },
      data: { status: LeaveRequestStatus.cancelled },
      include: { leaveType: { select: { name: true, isPaid: true } } },
    });

    return this.toRecord(updated);
  }

  private async assertCanApproveStep(
    employeeId: string,
    roleName: string,
    user: AuthenticatedUser,
  ) {
    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId },
      select: { managerId: true, companyId: true },
    });
    if (!employee) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Employee not found' });
    }

    const role = await this.prisma.unscoped.role.findUnique({
      where: { id: user.roleId },
      select: { name: true },
    });

    if (roleName === 'Manager') {
      if (user.employeeId === employee.managerId) return;
      if (role?.name === 'Company Owner' || role?.name === 'HR Admin') return;
    }

    if (role?.name === roleName) return;
    if (role?.name === 'Company Owner') return;

    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: `You are not authorized for the ${roleName} approval step`,
    });
  }

  private validateProbation(
    employee: { probationEndDate: Date | null },
    probationRestricted: boolean,
    startDate: Date,
  ) {
    if (
      probationRestricted &&
      employee.probationEndDate &&
      startDate <= employee.probationEndDate
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Leave cannot be taken during probation for this leave type',
      });
    }
  }

  private async buildBalanceWarning(
    employeeId: string,
    leaveTypeId: string,
    totalDays: Decimal,
    allowNegative: boolean,
    negativeCap: number | null,
    isPaid: boolean,
  ) {
    if (!isPaid) {
      return {
        projectedBalance: 0,
        exceedsBalance: false,
        negativeCapExceeded: false,
      };
    }

    const available = await this.balancesService.getAvailableBalance(
      employeeId,
      leaveTypeId,
      new Date(),
    );
    const projected = available - Number(totalDays);
    return {
      projectedBalance: projected,
      exceedsBalance: projected < 0,
      negativeCapExceeded:
        allowNegative && negativeCap !== null ? projected < -negativeCap : false,
    };
  }

  private async findRequestOrThrow(requestId: string) {
    const row = await this.prisma.unscoped.leaveRequest.findFirst({
      where: { id: requestId },
      include: {
        employee: { select: { companyId: true, tenantId: true } },
        leaveType: { select: { name: true, isPaid: true } },
      },
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

  private async assertEmployee(employeeId: string) {
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

  private async toRecord(
    row: LeaveRequest & { leaveType?: { name: string; isPaid: boolean } },
    balanceWarning?: {
      projectedBalance: number;
      exceedsBalance: boolean;
      negativeCapExceeded: boolean;
    } | null,
  ): Promise<LeaveRequestRecord> {
    const warning =
      balanceWarning ??
      (row.status === 'pending'
        ? await this.buildBalanceWarning(
            row.employeeId,
            row.leaveTypeId,
            decimal(row.totalDays),
            false,
            null,
            row.leaveType?.isPaid ?? true,
          )
        : null);

    return {
      id: row.id,
      employeeId: row.employeeId,
      leaveTypeId: row.leaveTypeId,
      leaveTypeName: row.leaveType?.name,
      startDate: formatDateValue(row.startDate),
      endDate: formatDateValue(row.endDate),
      halfDay: row.halfDay,
      totalDays: Number(row.totalDays),
      reason: row.reason,
      status: row.status,
      approvalChain: parseApprovalChain(row.approvalChain),
      deductedAt: row.deductedAt?.toISOString() ?? null,
      balanceWarning:
        warning &&
        (warning.exceedsBalance || warning.negativeCapExceeded)
          ? warning
          : null,
      localId: row.localId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
