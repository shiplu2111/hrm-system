import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationModule } from '../organization/organization.module';
import { CertificationExpiryAlertsService } from './certification-expiry-alerts.service';
import { TrainingCertificationsService } from './training-certifications.service';
import { TrainingController } from './training.controller';
import { TrainingSessionsService } from './training-sessions.service';
import { TrainingSkillsService } from './training-skills.service';
import { TrainingService } from './training.service';

@Module({
  imports: [PrismaModule, OrganizationModule, AuditModule, NotificationsModule],
  controllers: [TrainingController],
  providers: [
    TrainingService,
    TrainingSessionsService,
    TrainingCertificationsService,
    TrainingSkillsService,
    CertificationExpiryAlertsService,
  ],
  exports: [
    TrainingService,
    TrainingSessionsService,
    TrainingCertificationsService,
    TrainingSkillsService,
    CertificationExpiryAlertsService,
  ],
})
export class TrainingModule {}
