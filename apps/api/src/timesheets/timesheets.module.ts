import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationModule } from '../organization/organization.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { TimesheetEntriesService } from './timesheet-entries.service';
import { TimesheetProjectsService } from './timesheet-projects.service';
import { TimesheetWorkflowService } from './timesheet-workflow.service';
import { TimesheetsController } from './timesheets.controller';

@Module({
  imports: [
    PrismaModule,
    OrganizationModule,
    AuditModule,
    WorkflowModule,
    NotificationsModule,
  ],
  controllers: [TimesheetsController],
  providers: [
    TimesheetProjectsService,
    TimesheetEntriesService,
    TimesheetWorkflowService,
  ],
  exports: [TimesheetEntriesService, TimesheetProjectsService],
})
export class TimesheetsModule {}
