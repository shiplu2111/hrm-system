import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { AttendanceReportsService } from './attendance-reports.service';
import { HrReportsService } from './hr-reports.service';
import { PayrollReportsService } from './payroll-reports.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [OrganizationModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    PayrollReportsService,
    AttendanceReportsService,
    HrReportsService,
  ],
})
export class ReportsModule {}
