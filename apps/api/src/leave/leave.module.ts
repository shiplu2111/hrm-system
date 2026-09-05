import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationModule } from '../organization/organization.module';
import { WorkflowModule } from '../workflow/workflow.module';
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
import { LeaveWorkflowService } from './leave-workflow.service';
import { LeaveTypesService } from './leave-types.service';

@Module({
  imports: [PrismaModule, OrganizationModule, NotificationsModule, WorkflowModule],
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
    LeaveWorkflowService,
  ],
  exports: [
    LeaveTypesService,
    LeavePoliciesService,
    LeaveBalancesService,
    LeaveRequestsService,
    LeaveAttendanceService,
    LeaveWorkflowService,
  ],
})
export class LeaveModule {}
