import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { TimesheetsModule } from '../timesheets/timesheets.module';
import { AttendanceSyncService } from './attendance-sync.service';
import { TimesheetSyncService } from './timesheet-sync.service';
import {
  AttendanceSyncController,
  TimesheetSyncController,
} from './sync.controller';

@Module({
  imports: [PrismaModule, TimesheetsModule],
  controllers: [AttendanceSyncController, TimesheetSyncController],
  providers: [AttendanceSyncService, TimesheetSyncService],
  exports: [AttendanceSyncService, TimesheetSyncService],
})
export class SyncModule {}
