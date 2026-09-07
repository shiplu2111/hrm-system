import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { PlanFeaturesService } from './plan-features.service';

@Module({
  imports: [PrismaModule],
  providers: [PlanFeaturesService],
  exports: [PlanFeaturesService],
})
export class BillingModule {}
