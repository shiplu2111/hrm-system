import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { PushModule } from '../push/push.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SettingsModule } from '../settings/settings.module';
import { InAppNotificationsService } from './in-app-notifications.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationEngineService } from './notification-engine.service';
import { NotificationRecipientsService } from './notification-recipients.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationsController } from './notifications.controller';
import { PushDeviceTokensService } from './push-device-tokens.service';

@Module({
  imports: [PrismaModule, SettingsModule, RealtimeModule, PushModule],
  controllers: [NotificationsController],
  providers: [
    NotificationRulesService,
    NotificationRecipientsService,
    NotificationDeliveryService,
    NotificationEngineService,
    InAppNotificationsService,
    PushDeviceTokensService,
  ],
  exports: [NotificationEngineService, InAppNotificationsService],
})
export class NotificationsModule {}
