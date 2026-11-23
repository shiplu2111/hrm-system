import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformExchangeRatesController } from './platform-exchange-rates.controller';
import { PlatformExchangeRatesService } from './platform-exchange-rates.service';
import { ManualRateProvider } from './providers/manual-rate.provider';
import { PlatformFxRateProvider } from './providers/platform-fx.provider';

@Module({
  imports: [
    PrismaModule,
    PlatformAuthModule,
    PlatformAuditModule,
  ],
  controllers: [PlatformExchangeRatesController],
  providers: [
    PlatformExchangeRatesService,
    ManualRateProvider,
    PlatformFxRateProvider,
  ],
  exports: [
    PlatformExchangeRatesService,
    ManualRateProvider,
    PlatformFxRateProvider,
  ],
})
export class PlatformExchangeRatesModule {}
