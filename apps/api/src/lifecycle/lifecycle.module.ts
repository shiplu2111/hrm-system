import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { PrismaModule } from '../database/prisma.module';
import { OffboardingModule } from '../offboarding/offboarding.module';
import { LifecycleController } from './lifecycle.controller';
import { LifecycleService } from './lifecycle.service';

@Module({
  imports: [PrismaModule, OffboardingModule, BillingModule],
  controllers: [LifecycleController],
  providers: [LifecycleService],
  exports: [LifecycleService],
})
export class LifecycleModule {}
