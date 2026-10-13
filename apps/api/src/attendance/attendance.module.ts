import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { LocaleModule } from '../locale/locale.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AttendanceController, CompanyAttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [PrismaModule, NotificationsModule, LocaleModule],
  controllers: [AttendanceController, CompanyAttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
