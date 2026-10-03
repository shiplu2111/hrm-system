import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { PlanFeaturesService } from './plan-features.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionController],
  providers: [PlanFeaturesService, SubscriptionService],
  exports: [PlanFeaturesService, SubscriptionService],
})
export class BillingModule {}
