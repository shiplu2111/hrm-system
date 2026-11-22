import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { CountriesController } from './countries.controller';
import { ComplianceNoticesController } from './compliance-notices.controller';
import { CountriesService } from './countries.service';
import { RuleVersionsService } from './rule-versions.service';
import { RuleSandboxService } from './rule-sandbox.service';
import { ComplianceEventsService } from './compliance-events.service';
import { ComplianceNoticeJobService } from './compliance-notice-job.service';

@Module({
  imports: [
    PrismaModule,
    PlatformAuthModule,
    PlatformAuditModule,
    NotificationsModule,
  ],
  controllers: [CountriesController, ComplianceNoticesController],
  providers: [
    CountriesService,
    RuleVersionsService,
    RuleSandboxService,
    ComplianceEventsService,
    ComplianceNoticeJobService,
  ],
  exports: [
    CountriesService,
    RuleVersionsService,
    RuleSandboxService,
    ComplianceEventsService,
    ComplianceNoticeJobService,
  ],
})
export class CountriesModule {}

