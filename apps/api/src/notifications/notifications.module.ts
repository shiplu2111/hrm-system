import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PushModule } from '../push/push.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { OrganizationModule } from '../organization/organization.module';
import { InAppNotificationsService } from './in-app-notifications.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationEngineService } from './notification-engine.service';
import { NotificationRecipientsService } from './notification-recipients.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationSettingsController } from './notification-settings.controller';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationsController } from './notifications.controller';
import { PushDeviceTokensService } from './push-device-tokens.service';

@Module({
  imports: [PrismaModule, SettingsModule, RealtimeModule, PushModule, WebhooksModule, OrganizationModule],
  controllers: [NotificationsController, NotificationSettingsController],
  providers: [
    NotificationRulesService,
    NotificationSettingsService,
    NotificationRecipientsService,
    NotificationDeliveryService,
    NotificationEngineService,
    InAppNotificationsService,
    PushDeviceTokensService,
  ],
  exports: [NotificationEngineService, InAppNotificationsService],
})
export class NotificationsModule {}
