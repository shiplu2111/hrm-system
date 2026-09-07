import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { PayrollModule } from '../payroll/payroll.module';
import { EmployeeOffboardingService } from './employee-offboarding.service';
import { OffboardingChecklistTemplatesService } from './offboarding-checklist-templates.service';
import { OffboardingController } from './offboarding.controller';

@Module({
  imports: [
    PrismaModule,
    OrganizationModule,
    AuditModule,
    AssetsModule,
    PayrollModule,
  ],
  controllers: [OffboardingController],
  providers: [
    OffboardingChecklistTemplatesService,
    EmployeeOffboardingService,
  ],
  exports: [EmployeeOffboardingService],
})
export class OffboardingModule {}
