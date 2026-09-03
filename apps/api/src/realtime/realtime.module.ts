import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { NotificationGateway } from './notification.gateway';
import { NotificationRealtimeService } from './notification-realtime.service';
import { RealtimeNotificationSettingsController } from './realtime-notification-settings.controller';
import { RealtimeNotificationSettingsService } from './realtime-notification-settings.service';

@Module({
  imports: [PrismaModule, OrganizationModule, AuditModule, AuthModule],
  controllers: [RealtimeNotificationSettingsController],
  providers: [
    NotificationGateway,
    NotificationRealtimeService,
    RealtimeNotificationSettingsService,
  ],
  exports: [NotificationRealtimeService, RealtimeNotificationSettingsService],
})
export class RealtimeModule {}
