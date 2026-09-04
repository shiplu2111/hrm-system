import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EmployeeDashboardView } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AttendanceService } from '../attendance/attendance.service';
import { LeaveBalancesService } from '../leave/leave-balances.service';
import { LeaveRequestsService } from '../leave/leave-requests.service';
import { InAppNotificationsService } from '../notifications/in-app-notifications.service';
import { PayslipService } from '../payroll/payslip.service';
import { PrismaService } from '../database/prisma.service';
import { RostersService } from '../roster/rosters.service';
import { formatDateValue } from '../leave/leave.utils';
import { startOfUtcDay } from '../attendance/attendance.utils';

@Injectable()
export class EmployeeDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
    private readonly leaveBalancesService: LeaveBalancesService,
    private readonly leaveRequestsService: LeaveRequestsService,
    private readonly rostersService: RostersService,
    private readonly payslipService: PayslipService,
    private readonly inAppNotificationsService: InAppNotificationsService,
  ) {}

  async getEmployeeDashboard(
    employeeId: string,
    user: AuthenticatedUser,
  ): Promise<EmployeeDashboardView> {
    await this.assertCanView(employeeId, user);

    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true, companyId: true },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const today = formatDateValue(startOfUtcDay());

    const [
      attendance,
      leaveBalances,
      rosterResult,
      leaveRows,
      payslips,
      notifications,
      unreadNotificationCount,
    ] = await Promise.all([
      this.attendanceService.getDayRecord(employeeId),
      this.leaveBalancesService.listForEmployee(employeeId),
      this.rostersService.list(employee.companyId, {
        employeeId,
        from: today,
        to: today,
        page: 1,
        pageSize: 1,
      }),
      this.leaveRequestsService.list(employee.companyId, {
        employeeId,
        page: 1,
        pageSize: 20,
      }),
      this.payslipService.listForEmployee(employeeId),
      this.inAppNotificationsService.listForUser(user, { limit: 8 }),
      this.prisma.unscoped.inAppNotification.count({
        where: { userId: user.id, readAt: null },
      }),
    ]);

    const todayDate = startOfUtcDay();
    const upcomingLeave = leaveRows.data
      .filter(
        (req) =>
          (req.status === 'pending' || req.status === 'approved') &&
          new Date(req.endDate) >= todayDate,
      )
      .slice(0, 5);

    return {
      asOf: new Date().toISOString(),
      todayShift: rosterResult.data[0] ?? null,
      attendance,
      leaveBalances,
      upcomingLeave,
      latestPayslip: payslips[0] ?? null,
      notifications,
      unreadNotificationCount,
    };
  }

  private async assertCanView(
    employeeId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.employeeId && user.employeeId !== employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot view another employee dashboard',
      });
    }
  }
}
