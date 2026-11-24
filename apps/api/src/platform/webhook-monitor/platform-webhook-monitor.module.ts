// apps/api/src/platform/webhook-monitor/platform-webhook-monitor.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { WebhooksModule } from '../../webhooks/webhooks.module';
import { CryptoModule } from '../../crypto/crypto.module';
import { PlatformWebhookMonitorController } from './platform-webhook-monitor.controller';
import { PlatformWebhookMonitorService } from './platform-webhook-monitor.service';

@Module({
  imports: [
    PrismaModule,
    PlatformAuthModule,
    PlatformAuditModule,
    NotificationsModule,
    WebhooksModule,
    CryptoModule,
  ],
  controllers: [PlatformWebhookMonitorController],
  providers: [PlatformWebhookMonitorService],
  exports: [PlatformWebhookMonitorService],
})
export class PlatformWebhookMonitorModule {}
