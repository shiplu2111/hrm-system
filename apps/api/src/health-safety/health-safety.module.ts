import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationModule } from '../organization/organization.module';
import { RuleResolverModule } from '../rule-resolver/rule-resolver.module';
import { HealthSafetyController } from './health-safety.controller';
import { HealthSafetyRulesService } from './health-safety-rules.service';
import { InjuryLogService } from './injury-log.service';
import { SafetyComplianceService } from './safety-compliance.service';
import { WorkplaceIncidentsService } from './workplace-incidents.service';

@Module({
  imports: [
    OrganizationModule,
    AuditModule,
    NotificationsModule,
    RuleResolverModule,
  ],
  controllers: [HealthSafetyController],
  providers: [
    WorkplaceIncidentsService,
    InjuryLogService,
    SafetyComplianceService,
    HealthSafetyRulesService,
  ],
  exports: [
    WorkplaceIncidentsService,
    InjuryLogService,
    SafetyComplianceService,
    HealthSafetyRulesService,
  ],
})
export class HealthSafetyModule {}
