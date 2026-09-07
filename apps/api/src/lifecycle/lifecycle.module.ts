import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { OffboardingModule } from '../offboarding/offboarding.module';
import { LifecycleController } from './lifecycle.controller';
import { LifecycleService } from './lifecycle.service';

@Module({
  imports: [PrismaModule, OffboardingModule],
  controllers: [LifecycleController],
  providers: [LifecycleService],
  exports: [LifecycleService],
})
export class LifecycleModule {}
