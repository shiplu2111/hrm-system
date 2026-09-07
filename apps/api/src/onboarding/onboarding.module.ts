import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AssetsModule } from '../assets/assets.module';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationModule } from '../organization/organization.module';
import { EmployeeOnboardingService } from './employee-onboarding.service';
import { OnboardingChecklistTemplatesService } from './onboarding-checklist-templates.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingTaskSyncService } from './onboarding-task-sync.service';

@Module({
  imports: [
    PrismaModule,
    OrganizationModule,
    AuditModule,
    NotificationsModule,
    forwardRef(() => AssetsModule),
  ],
  controllers: [OnboardingController],
  providers: [
    OnboardingChecklistTemplatesService,
    EmployeeOnboardingService,
    OnboardingTaskSyncService,
  ],
  exports: [EmployeeOnboardingService, OnboardingTaskSyncService],
})
export class OnboardingModule {}
