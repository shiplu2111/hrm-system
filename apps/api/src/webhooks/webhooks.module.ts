import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { PrismaModule } from '../database/prisma.module';
import { TenantWebhooksService } from './tenant-webhooks.service';
import { WebhookDeliveryQueueService } from './webhook-delivery-queue.service';
import { WebhookEmitterService } from './webhook-emitter.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [PrismaModule, AuditModule, BillingModule],
  controllers: [WebhooksController],
  providers: [
    TenantWebhooksService,
    WebhookDeliveryQueueService,
    WebhookEmitterService,
  ],
  exports: [WebhookEmitterService, WebhookDeliveryQueueService],
})
export class WebhooksModule {}
