import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { FeatureGateService } from './feature-gate.service';
import { PlanFeaturesService } from './plan-features.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionController],
  providers: [FeatureGateService, PlanFeaturesService, SubscriptionService],
  exports: [FeatureGateService, PlanFeaturesService, SubscriptionService],
})
export class BillingModule {}
