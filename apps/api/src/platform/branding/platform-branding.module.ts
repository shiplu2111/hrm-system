import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { BillingModule } from '../../billing/billing.module';
import { PlatformBrandingController } from './platform-branding.controller';
import { PlatformBrandingService } from './platform-branding.service';

@Module({
  imports: [PrismaModule, PlatformAuditModule, PlatformAuthModule, BillingModule],
  controllers: [PlatformBrandingController],
  providers: [PlatformBrandingService],
  exports: [PlatformBrandingService],
})
export class PlatformBrandingModule {}
