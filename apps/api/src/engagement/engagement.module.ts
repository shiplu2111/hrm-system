import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrganizationModule } from '../organization/organization.module';
import { AnnouncementsService } from './announcements.service';
import { EngagementController } from './engagement.controller';
import { EngagementSurveysService } from './engagement-surveys.service';
import { KudosService } from './kudos.service';

@Module({
  imports: [OrganizationModule, AuditModule, NotificationsModule],
  controllers: [EngagementController],
  providers: [AnnouncementsService, EngagementSurveysService, KudosService],
  exports: [AnnouncementsService, EngagementSurveysService, KudosService],
})
export class EngagementModule {}
