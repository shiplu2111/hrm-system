import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { BillingModule } from '../../billing/billing.module';
import {
  PlatformFeatureFlagsController,
  PlatformTenantFeatureOverridesController,
} from './platform-feature-flags.controller';
import { PlatformFeatureFlagsService } from './platform-feature-flags.service';

@Module({
  imports: [PrismaModule, PlatformAuditModule, PlatformAuthModule, BillingModule],
  controllers: [
    PlatformFeatureFlagsController,
    PlatformTenantFeatureOverridesController,
  ],
  providers: [PlatformFeatureFlagsService],
  exports: [PlatformFeatureFlagsService],
})
export class PlatformFeatureFlagsModule {}
