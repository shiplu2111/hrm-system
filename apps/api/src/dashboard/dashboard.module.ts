import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { LeaveModule } from '../leave/leave.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationModule } from '../organization/organization.module';
import { PayrollModule } from '../payroll/payroll.module';
import { RosterModule } from '../roster/roster.module';
import { AdminDashboardService } from './admin-dashboard.service';
import { DashboardController } from './dashboard.controller';
import { EmployeeDashboardService } from './employee-dashboard.service';

@Module({
  imports: [
    OrganizationModule,
    AttendanceModule,
    LeaveModule,
    RosterModule,
    PayrollModule,
    NotificationsModule,
  ],
  controllers: [DashboardController],
  providers: [AdminDashboardService, EmployeeDashboardService],
})
export class DashboardModule {}
