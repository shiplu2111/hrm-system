import { forwardRef, Global, Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { PlatformAuditModule } from '../platform/audit/platform-audit.module';
import { SettingsModule } from '../settings/settings.module';
import { BillingInvoicingService } from './billing-invoicing.service';
import { BillingWebhookController } from './billing-webhook.controller';
import { DunningService } from './dunning.service';
import { FeatureGateService } from './feature-gate.service';
import { PAYMENT_PROVIDER } from './payment-provider/payment-provider.interface';
import { StripePaymentProvider } from './payment-provider/stripe-payment.provider';
import { PlanFeaturesService } from './plan-features.service';
import { PlanChangeService } from './plan-change.service';
import { SubscriptionBillingQueueService } from './subscription-billing-queue.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { TenantInvoicesController } from './tenant-invoices.controller';

@Global()
@Module({
  imports: [PrismaModule, PlatformAuditModule, forwardRef(() => SettingsModule)],
  controllers: [
    SubscriptionController,
    TenantInvoicesController,
    BillingWebhookController,
  ],
  providers: [
    FeatureGateService,
    PlanFeaturesService,
    PlanChangeService,
    SubscriptionService,
    BillingInvoicingService,
    DunningService,
    SubscriptionBillingQueueService,
    StripePaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useClass: StripePaymentProvider,
    },
  ],
  exports: [
    FeatureGateService,
    PlanFeaturesService,
    PlanChangeService,
    SubscriptionService,
    BillingInvoicingService,
    DunningService,
    SubscriptionBillingQueueService,
    PAYMENT_PROVIDER,
    StripePaymentProvider,
  ],
})
export class BillingModule {}
