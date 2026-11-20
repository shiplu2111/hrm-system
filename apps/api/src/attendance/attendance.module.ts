import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { LocaleModule } from '../locale/locale.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationModule } from '../organization/organization.module';
import {
  AttendanceController,
  AttendanceCorrectionController,
  CompanyAttendanceController,
} from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [PrismaModule, NotificationsModule, LocaleModule, OrganizationModule],
  controllers: [
    AttendanceController,
    CompanyAttendanceController,
    AttendanceCorrectionController,
  ],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
