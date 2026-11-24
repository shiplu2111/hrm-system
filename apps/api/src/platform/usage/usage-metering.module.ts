// usage-metering.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformHealthModule } from '../health/platform-health.module';
import { UsageMeteringController } from './usage-metering.controller';
import { UsageMeteringService } from './usage-metering.service';

@Module({
  imports: [PrismaModule, PlatformHealthModule, forwardRef(() => PlatformAuthModule)],
  controllers: [UsageMeteringController],
  providers: [UsageMeteringService],
  exports: [UsageMeteringService],
})
export class UsageMeteringModule {}
