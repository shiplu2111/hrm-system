import { Injectable } from '@nestjs/common';
import {
  AttendanceRecordStatus,
  AttendanceReviewStatus,
  LeaveRequestStatus,
  PayrollAdjustmentStatus,
  PayrollRunStatus,
  Prisma,
} from '@prisma/client';
import type {
  AdminDashboardView,
  AdminExpiryItem,
  AdminPendingApprovalItem,
} from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { startOfUtcDay } from '../attendance/attendance.utils';
import { formatDateValue } from '../leave/leave.utils';

const EXPIRY_WINDOW_DAYS = 30;
const PRESENT_STATUSES: AttendanceRecordStatus[] = [
  AttendanceRecordStatus.present,
  AttendanceRecordStatus.late,
  AttendanceRecordStatus.early_leave,
  AttendanceRecordStatus.wfh,
  AttendanceRecordStatus.business_trip,
  AttendanceRecordStatus.half_day,
];

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  async getAdminDashboard(companyId: string): Promise<AdminDashboardView> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const company = await this.prisma.unscoped.company.findUniqueOrThrow({
      where: { id: companyId },
      include: { country: { select: { currency: true } } },
    });

    const today = startOfUtcDay();
    const employeeFilter: Prisma.EmployeeWhereInput = {
      companyId,
      deletedAt: null,
    };

    const [
      headcount,
      onLeaveToday,
      absentLateToday,
      workingNow,
      payrollCostMonth,
      pendingPayroll,
      pendingLeave,
      pendingAdjustments,
      pendingPayrollRuns,
      pendingAttendanceReviews,
      departmentGroups,
      attendanceTrend,
      pendingApprovals,
      expiryItems,
    ] = await Promise.all([
      this.prisma.unscoped.employee.count({
        where: { ...employeeFilter, employmentStatus: 'active' },
      }),
      this.prisma.unscoped.attendanceRecord.count({
        where: {
          date: today,
          status: { in: [AttendanceRecordStatus.leave, AttendanceRecordStatus.half_day] },
          employee: employeeFilter,
        },
      }),
      this.prisma.unscoped.attendanceRecord.count({
        where: {
          date: today,
          status: { in: [AttendanceRecordStatus.absent, AttendanceRecordStatus.late] },
          employee: employeeFilter,
        },
      }),
      this.prisma.unscoped.attendanceRecord.count({
        where: {
          date: today,
          clockInAt: { not: null },
          clockOutAt: null,
          status: {
            notIn: [
              AttendanceRecordStatus.leave,
              AttendanceRecordStatus.absent,
              AttendanceRecordStatus.holiday,
              AttendanceRecordStatus.weekend,
            ],
          },
          employee: employeeFilter,
        },
      }),
      this.sumPayrollForMonth(companyId, [
        PayrollRunStatus.finalized,
        PayrollRunStatus.paid,
      ]),
      this.sumPayrollForMonth(companyId, [
        PayrollRunStatus.draft,
        PayrollRunStatus.calculated,
        PayrollRunStatus.under_review,
        PayrollRunStatus.approved,
      ]),
      this.prisma.unscoped.leaveRequest.count({
        where: {
          status: LeaveRequestStatus.pending,
          employee: employeeFilter,
        },
      }),
      this.prisma.unscoped.payrollAdjustment.count({
        where: { companyId, status: PayrollAdjustmentStatus.pending },
      }),
      this.prisma.unscoped.payrollRun.count({
        where: {
          deletedAt: null,
          status: PayrollRunStatus.under_review,
          employee: employeeFilter,
        },
      }),
      this.prisma.unscoped.attendanceRecord.count({
        where: {
          date: today,
          reviewStatus: AttendanceReviewStatus.pending_manager,
          employee: employeeFilter,
        },
      }),
      this.prisma.unscoped.employee.groupBy({
        by: ['departmentId'],
        where: { ...employeeFilter, employmentStatus: 'active' },
        _count: { _all: true },
      }),
      this.buildAttendanceTrend(companyId, today),
      this.listPendingApprovals(companyId),
      this.listExpiryItems(companyId, today),
    ]);

    const pendingApprovalsTotal =
      pendingLeave +
      pendingAdjustments +
      pendingPayrollRuns +
      pendingAttendanceReviews;

    const departmentIds = departmentGroups
      .map((g) => g.departmentId)
      .filter((id): id is string => id !== null);
    const departments = departmentIds.length
      ? await this.prisma.unscoped.department.findMany({
          where: { id: { in: departmentIds } },
          select: { id: true, name: true },
        })
      : [];
    const departmentNameById = new Map(
      departments.map((d) => [d.id, d.name] as const),
    );

    return {
      asOf: new Date().toISOString(),
      currency: company.country.currency,
      kpis: {
        headcount,
        onLeaveToday,
        absentLateToday,
        workingNow,
        payrollCostMonth,
        pendingPayroll,
        pendingApprovals: pendingApprovalsTotal,
        expiryAlerts: expiryItems.length,
      },
      departmentHeadcount: departmentGroups.map((group) => ({
        departmentId: group.departmentId,
        departmentName: group.departmentId
          ? (departmentNameById.get(group.departmentId) ?? 'Unknown')
          : 'Unassigned',
        count: group._count._all,
      })),
      attendanceTrend,
      pendingApprovals,
      expiryItems,
    };
  }

  private async sumPayrollForMonth(
    companyId: string,
    statuses: PayrollRunStatus[],
  ): Promise<number> {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    );

    const result = await this.prisma.unscoped.payrollRun.aggregate({
      where: {
        deletedAt: null,
        status: { in: statuses },
        employee: { companyId, deletedAt: null },
        payrollPeriod: {
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
      },
      _sum: { netPay: true },
    });

    return Number(result._sum.netPay ?? 0);
  }

  private async buildAttendanceTrend(companyId: string, today: Date) {
    const points: { date: string; presentCount: number }[] = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - offset);
      const count = await this.prisma.unscoped.attendanceRecord.count({
        where: {
          date: day,
          status: { in: PRESENT_STATUSES },
          employee: { companyId, deletedAt: null },
        },
      });
      points.push({
        date: formatDateValue(day),
        presentCount: count,
      });
    }
    return points;
  }

  private async listPendingApprovals(
    companyId: string,
  ): Promise<AdminPendingApprovalItem[]> {
    const items: AdminPendingApprovalItem[] = [];

    const leaveRows = await this.prisma.unscoped.leaveRequest.findMany({
      where: {
        status: LeaveRequestStatus.pending,
        employee: { companyId, deletedAt: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        leaveType: { select: { name: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    for (const row of leaveRows) {
      items.push({
        id: row.id,
        type: 'leave_request',
        title: 'Leave request',
        detail: `${row.leaveType.name} · ${formatDateValue(row.startDate)} → ${formatDateValue(row.endDate)}`,
        employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
        createdAt: row.createdAt.toISOString(),
      });
    }

    const adjustmentRows = await this.prisma.unscoped.payrollAdjustment.findMany({
      where: { companyId, status: PayrollAdjustmentStatus.pending },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    for (const row of adjustmentRows) {
      items.push({
        id: row.id,
        type: 'payroll_adjustment',
        title: 'Payroll adjustment',
        detail: row.reason,
        employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
        createdAt: row.createdAt.toISOString(),
      });
    }

    return items
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 10);
  }

  private async listExpiryItems(
    companyId: string,
    today: Date,
  ): Promise<AdminExpiryItem[]> {
    const windowEnd = new Date(today);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + EXPIRY_WINDOW_DAYS);

    const items: AdminExpiryItem[] = [];

    const documents = await this.prisma.unscoped.employeeDocument.findMany({
      where: {
        expiryDate: { gte: today, lte: windowEnd },
        employee: { companyId, deletedAt: null },
        documentType: { tracksExpiry: true },
      },
      include: {
        documentType: { select: { name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { expiryDate: 'asc' },
      take: 15,
    });

    for (const doc of documents) {
      if (!doc.expiryDate) continue;
      items.push({
        id: doc.id,
        type: 'document',
        employeeId: doc.employee.id,
        employeeName: `${doc.employee.firstName} ${doc.employee.lastName}`.trim(),
        label: doc.documentType.name,
        expiryDate: formatDateValue(doc.expiryDate),
        daysUntil: this.daysUntil(today, doc.expiryDate),
      });
    }

    const probationEmployees = await this.prisma.unscoped.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        probationEndDate: { gte: today, lte: windowEnd },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        probationEndDate: true,
      },
      orderBy: { probationEndDate: 'asc' },
      take: 10,
    });

    for (const employee of probationEmployees) {
      if (!employee.probationEndDate) continue;
      items.push({
        id: `probation-${employee.id}`,
        type: 'probation',
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        label: 'Probation ending',
        expiryDate: formatDateValue(employee.probationEndDate),
        daysUntil: this.daysUntil(today, employee.probationEndDate),
      });
    }

    const contracts = await this.prisma.unscoped.employmentContract.findMany({
      where: {
        employee: { companyId, deletedAt: null },
        status: 'active',
        endDate: { gte: today, lte: windowEnd },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { endDate: 'asc' },
      take: 10,
    });

    for (const contract of contracts) {
      if (!contract.endDate) continue;
      items.push({
        id: contract.id,
        type: 'contract',
        employeeId: contract.employee.id,
        employeeName: `${contract.employee.firstName} ${contract.employee.lastName}`.trim(),
        label: 'Contract expiring',
        expiryDate: formatDateValue(contract.endDate),
        daysUntil: this.daysUntil(today, contract.endDate),
      });
    }

    return items
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 15);
  }

  private daysUntil(from: Date, to: Date): number {
    const ms = to.getTime() - from.getTime();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }
}
