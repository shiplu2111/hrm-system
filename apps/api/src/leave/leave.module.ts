import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationModule } from '../organization/organization.module';
import {
  LeaveBalancesController,
  LeavePoliciesController,
  LeaveRequestsController,
  LeaveTypesController,
} from './leave.controller';
import { LeaveAttendanceService } from './leave-attendance.service';
import { LeaveBalancesService } from './leave-balances.service';
import { LeavePoliciesService } from './leave-policies.service';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveTypesService } from './leave-types.service';

@Module({
  imports: [PrismaModule, OrganizationModule, NotificationsModule],
  controllers: [
    LeaveTypesController,
    LeavePoliciesController,
    LeaveBalancesController,
    LeaveRequestsController,
  ],
  providers: [
    LeaveTypesService,
    LeavePoliciesService,
    LeaveBalancesService,
    LeaveRequestsService,
    LeaveAttendanceService,
  ],
  exports: [
    LeaveTypesService,
    LeavePoliciesService,
    LeaveBalancesService,
    LeaveRequestsService,
    LeaveAttendanceService,
  ],
})
export class LeaveModule {}
