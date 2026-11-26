import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformPlansController } from './platform-plans.controller';
import { PlatformPlansService } from './platform-plans.service';
import { PublicCurrenciesController } from './public-currencies.controller';
import { PublicPlansController } from './public-plans.controller';
import { PublicPlansService } from './public-plans.service';

@Module({
  imports: [PrismaModule, PlatformAuditModule, PlatformAuthModule],
  controllers: [
    PlatformPlansController,
    PublicPlansController,
    PublicCurrenciesController,
  ],
  providers: [PlatformPlansService, PublicPlansService],
  exports: [PlatformPlansService, PublicPlansService],
})
export class PlatformPlansModule {}
